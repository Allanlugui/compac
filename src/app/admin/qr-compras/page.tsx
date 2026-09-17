import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import type { QrContexto } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import QrComprasManager from "./QrComprasManager";

export const metadata: Metadata = { title: "QR de compras · SGA-M" };

export default async function QrComprasPage() {
  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "compras.criar");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="QR de compras" descricao="QRs por contexto de solicitação." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita (ADMIN, GESTOR, COMPRAS)</p>
        </div>
      </div>
    );
  }

  const [{ data }, { data: locs }, { data: deptos }, { data: ccs }, { data: almoxs }] = await Promise.all([
    supabase
      .from("qr_contextos")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false }),
    // Pré-v23/v24: erro tolerado, selects caem para texto livre (legado).
    supabase
      .from("localidades")
      .select("id, nome, tipo")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true }),
    supabase
      .from("departamentos_setores")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    supabase
      .from("centros_custo")
      .select("id, codigo, nome")
      .eq("organization_id", ctx.orgId)
      .eq("ativo", true)
      .order("codigo", { ascending: true }),
    supabase
      .from("almoxarifados")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  ]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="QR de compras"
        descricao={`${ctx.orgNome} · um QR por unidade, setor ou almoxarifado.`}
      />
      <QrComprasManager
        contextos={(data ?? []) as QrContexto[]}
        siteUrl={siteUrl}
        locs={((locs ?? []) as { id: string; nome: string; tipo: string }[])}
        deptos={((deptos ?? []) as { id: string; nome: string }[])}
        ccs={((ccs ?? []) as { id: string; codigo: string; nome: string }[])}
        almoxs={((almoxs ?? []) as { id: string; nome: string }[])}
      />
    </div>
  );
}
