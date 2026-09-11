import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import type { Categoria, Localidade } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import EstruturaManager from "./EstruturaManager";

export const metadata: Metadata = { title: "Estrutura · SGA-M" };

export default async function EstruturaPage() {
  const ctx = await requireOrg();
  try {
    exigirPermissao(ctx, "estrutura.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Estrutura" descricao="Localidades e categorias da organização." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: locs }, { data: cats }] = await Promise.all([
    supabase
      .from("localidades")
      .select("id, organization_id, nome, tipo, parent_id, created_at")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true }),
    supabase
      .from("categorias")
      .select("id, organization_id, nome, tipo, atributos, ativa, created_at")
      .eq("organization_id", ctx.orgId)
      .order("tipo", { ascending: true })
      .order("nome", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Estrutura"
        descricao={`${ctx.orgNome} · hierarquia física e categorias com dados técnicos.`}
      />
      <EstruturaManager
        iniciaisLocs={(locs ?? []) as Localidade[]}
        iniciaisCats={(cats ?? []) as Categoria[]}
      />
    </div>
  );
}
