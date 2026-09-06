import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import NovoChamadoForm from "./NovoChamadoForm";

export const metadata: Metadata = { title: "Novo chamado · SGA-M" };

export default async function NovoChamadoPage() {
  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "chamados.criar");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Novo chamado" voltar={{ href: "/admin/dashboard", rotulo: "Dashboard" }} />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Abertura manual restrita (ADMIN, GESTOR, TÉCNICO)</p>
        </div>
      </div>
    );
  }

  const { data } = await supabase
    .from("ativos")
    .select("id, nome, codigo")
    .eq("organization_id", ctx.orgId)
    .order("nome")
    .limit(500);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Novo chamado"
        descricao={`${ctx.orgNome} · abertura manual (portal, telefone, e-mail).`}
        voltar={{ href: "/admin/dashboard", rotulo: "Dashboard" }}
      />
      <NovoChamadoForm ativos={(data ?? []) as { id: string; nome: string; codigo: string | null }[]} />
    </div>
  );
}
