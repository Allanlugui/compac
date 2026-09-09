import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  // Valida CRON_SECRET quando configurado (Vercel Cron envia Authorization: Bearer <CRON_SECRET>)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Cron não tem sessão de usuário — usar service_role para bypass RLS controlado
  // Se houver sessão (chamada manual autenticada), usa server client; senão service
  let supabase: Awaited<ReturnType<typeof createServerClient>> | ReturnType<typeof createServiceClient>;
  try {
    const server = await createServerClient();
    const { data: { user } } = await server.auth.getUser();
    if (user) {
      supabase = server;
    } else {
      supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
    }
  } catch {
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: planos } = await supabase
    .from("planos_manutencao")
    .select("id, organization_id, ativo_id, atividade, proxima_execucao, tolerancia_dias, ativo")
    .eq("ativo", true)
    .lte("proxima_execucao", hoje)
    .limit(50);

  let geradas = 0;
  for (const p of (planos ?? []) as { id: string; organization_id: string; ativo_id: string; atividade: string; proxima_execucao: string; tolerancia_dias: number }[]) {
    // Idempotência: verifica se já existe O.S. para este plano com created_at hoje
    const { count } = await supabase
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", p.organization_id)
      .eq("plano_id", p.id)
      .gte("created_at", hoje + "T00:00:00Z")
      .lt("created_at", hoje + "T23:59:59Z");
    if ((count ?? 0) > 0) continue;

    const { error } = await supabase.from("chamados").insert({
      organization_id: p.organization_id,
      ativo_id: p.ativo_id,
      solicitante: "Preventiva automática",
      descricao: p.atividade,
      status: "convertido_os",
      os_status: "aberta",
      os_tipo: "preventiva",
      plano_id: p.id,
      origem: "importacao",
      prioridade: "media",
    });
    if (!error) geradas++;
  }

  return Response.json({ geradas, data: hoje });
}
