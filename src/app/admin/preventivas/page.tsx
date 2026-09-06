import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao, pode } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import PlanoForm from "./PlanoForm";
import PlanosList, { type PlanoLista } from "./PlanosList";

export const metadata: Metadata = { title: "Preventivas · SGA-M" };

export default async function PreventivasPage() {
  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "preventiva.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Preventivas" descricao="Planos de manutenção." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita (ADMIN, GESTOR, TÉCNICO)</p>
        </div>
      </div>
    );
  }
  const podeCriar = pode(ctx, "preventiva.criar");
  const podeExecutar = pode(ctx, "preventiva.executar");

  const [{ data: planos }, { data: ativos }, { data: checks }] = await Promise.all([
    supabase
      .from("planos_manutencao")
      .select("*, ativos!inner(nome, codigo)")
      .eq("organization_id", ctx.orgId)
      .order("proxima_execucao", { ascending: true, nullsFirst: false }),
    podeCriar
      ? supabase.from("ativos").select("id, nome, codigo").eq("organization_id", ctx.orgId).order("nome").limit(500)
      : Promise.resolve({ data: [] }),
    podeCriar
      ? supabase.from("checklist_modelos").select("id, titulo").eq("organization_id", ctx.orgId).order("titulo").limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const lista = ((planos ?? []) as (PlanoLista & { ativos: { nome: string; codigo: string | null } | null })[]).map(
    (p) => ({
      ...p,
      ativo_nome: p.ativos?.nome ?? null,
      ativo_codigo: p.ativos?.codigo ?? null,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Preventivas"
        descricao={`${ctx.orgNome} · planos e geração manual de O.S.`}
      />
      {podeCriar && (
        <PlanoForm
          ativos={(ativos ?? []) as { id: string; nome: string; codigo: string | null }[]}
          checklists={(checks ?? []) as { id: string; titulo: string }[]}
        />
      )}
      <PlanosList planos={lista} podeExecutar={podeExecutar} />
    </div>
  );
}
