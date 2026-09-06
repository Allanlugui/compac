import type { Metadata } from "next";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { Movimentacao, Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EstoqueClient from "./EstoqueClient";

export const metadata: Metadata = { title: "Estoque · SGA-M" };

export default async function EstoquePage() {
  const supabase = await createClient();
  const ctx = await requireOrg();

  const [{ data: prods }, { data: movs }, { data: unis }, { data: cats }, { data: forns }] = await Promise.all([
    supabase
      .from("produtos")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .order("codigo", { ascending: true }),
    supabase
      .from("movimentacoes_estoque")
      .select("*, produtos!inner(codigo, descricao)")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("unidades_medida")
      .select("sigla, nome")
      .eq("organization_id", ctx.orgId)
      .eq("ativa", true)
      .order("sigla"),
    supabase
      .from("categorias")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .eq("tipo", "produto")
      .eq("ativa", true)
      .order("nome"),
    supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .eq("ativo", true)
      .order("nome")
      .limit(200),
  ]);

  const produtos = (prods ?? []) as Produto[];
  const movimentacoes = ((movs ?? []) as unknown as (Movimentacao & {
    produtos: { codigo: string; descricao: string };
  })[]).map((m) => ({
    ...m,
    produto_nome: `${m.produtos.codigo} — ${m.produtos.descricao}`,
  }));

  const criticos = produtos.filter(
    (p) => Number(p.estoque_atual ?? 0) - Number(p.estoque_reservado ?? 0) <= Number(p.estoque_minimo ?? 0),
  );
  const valor = produtos.reduce(
    (s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.custo_medio ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader titulo="Estoque" descricao={`${ctx.orgNome} · produtos e movimentações.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Itens cadastrados" valor={produtos.length} Icone={Package} tom="zinc" />
        <StatCard rotulo="Itens críticos" valor={criticos.length} detalhe="abaixo do mínimo" Icone={Package} tom={criticos.length > 0 ? "rose" : "emerald"} />
        <StatCard rotulo="Movimentações" valor={movimentacoes.length} detalhe="últimas 200" Icone={Package} tom="sky" />
        <StatCard rotulo="Valor estimado" valor={formatarMoeda(valor)} Icone={Package} tom="amber" />
      </div>
      <EstoqueClient
        produtos={produtos}
        movimentacoes={movimentacoes}
        unidades={(unis ?? []) as { sigla: string; nome: string }[]}
        categorias={(cats ?? []) as { id: string; nome: string }[]}
        fornecedores={(forns ?? []) as { id: string; nome: string }[]}
      />
    </div>
  );
}
