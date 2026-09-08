import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
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
