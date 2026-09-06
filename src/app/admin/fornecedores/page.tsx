import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { Compra, Fornecedor } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import FornecedoresClient from "./FornecedoresClient";

export const metadata: Metadata = { title: "Fornecedores · SGA-M" };

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const ctx = await requireOrg();

  const [{ data: forns }, { data: compras }] = await Promise.all([
    supabase
      .from("fornecedores")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true }),
    supabase
      .from("compras")
      .select("fornecedor_id, valor_total")
      .eq("organization_id", ctx.orgId)
      .not("fornecedor_id", "is", null),
  ]);

  const fornecedores = (forns ?? []) as Fornecedor[];
  const totais: Record<string, { qtd: number; total: number }> = {};
  for (const c of (compras ?? []) as Pick<Compra, "fornecedor_id" | "valor_total">[]) {
    if (!c.fornecedor_id) continue;
    const t = totais[c.fornecedor_id] ?? { qtd: 0, total: 0 };
    t.qtd += 1;
    t.total += Number(c.valor_total ?? 0);
    totais[c.fornecedor_id] = t;
  }

  return (
    <div className="space-y-6">
      <PageHeader titulo="Fornecedores" descricao={`${ctx.orgNome} · cadastro e histórico de compras.`} />
      <FornecedoresClient fornecedores={fornecedores} totais={totais} />
    </div>
  );
}
