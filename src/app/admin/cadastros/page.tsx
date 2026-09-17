import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import type { Almoxarifado, CentroCusto, DepartamentoSetor, Localidade } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import CadastrosManager from "./CadastrosManager";

export const metadata: Metadata = { title: "Cadastros · SGA-M" };

export default async function CadastrosPage() {
  const ctx = await requireOrg();
  try {
    exigirPermissao(ctx, "estrutura.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Cadastros" descricao="Departamentos e centros de custo da organização." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: deptos }, { data: ccs }, { data: almoxs }, { data: locs }] = await Promise.all([
    supabase
      .from("departamentos_setores")
      .select("id, organization_id, nome, sigla, localidade_id, ativo, created_at")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true }),
    supabase
      .from("centros_custo")
      .select("id, organization_id, codigo, nome, departamento_id, localidade_id, ativo, created_at")
      .eq("organization_id", ctx.orgId)
      .order("codigo", { ascending: true }),
    supabase
      .from("almoxarifados")
      .select("id, organization_id, nome, codigo, localidade_id, ativo, created_at")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true }),
    supabase
      .from("localidades")
      .select("id, organization_id, nome, tipo, parent_id, created_at")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Cadastros"
        descricao={`${ctx.orgNome} · departamentos/setores e centros de custo vinculados à estrutura física.`}
      />
      <CadastrosManager
        iniciaisDeptos={(deptos ?? []) as DepartamentoSetor[]}
        iniciaisCCs={(ccs ?? []) as CentroCusto[]}
        iniciaisAlmoxs={(almoxs ?? []) as Almoxarifado[]}
        locs={(locs ?? []) as Localidade[]}
      />
    </div>
  );
}
