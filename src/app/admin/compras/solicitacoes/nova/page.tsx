import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import NovaSolicitacaoForm from "./NovaSolicitacaoForm";

export const metadata: Metadata = { title: "Nova solicitação · SGA-M" };

interface Props {
  searchParams: Promise<{ produto?: string }>;
}

export default async function NovaSolicitacaoPage({ searchParams }: Props) {
  const { produto } = await searchParams;
  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "solicitacoes.criar");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Nova solicitação" voltar={{ href: "/admin/compras/solicitacoes", rotulo: "Solicitações" }} />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Sem permissão para solicitar</p>
        </div>
      </div>
    );
  }

  const { data: prods } = await supabase
    .from("produtos")
    .select("id, codigo, descricao, unidade, estoque_atual, estoque_reservado, estoque_minimo")
    .eq("organization_id", ctx.orgId)
    .eq("ativo", true)
    .order("codigo")
    .limit(500);

  const lista = ((prods ?? []) as {
    id: string; codigo: string; descricao: string; unidade: string;
    estoque_atual: number; estoque_reservado: number; estoque_minimo: number;
  }[]).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    unidade: p.unidade,
    fisico: Number(p.estoque_atual ?? 0),
    reservado: Number(p.estoque_reservado ?? 0),
    minimo: Number(p.estoque_minimo ?? 0),
  }));

  // Reposição (?produto=): pré-preenche item + justificativa com números.
  let prefill: {
    produto_id: string | null;
    descricao: string;
    unidade: string;
    justificativa: string;
  } | null = null;
  if (produto) {
    const p = lista.find((x) => x.id === produto);
    if (p) {
      const disp = p.fisico - p.reservado;
      const sugerida = Math.max(p.minimo * 2 - disp, 1);
      prefill = {
        produto_id: p.id,
        descricao: `${p.codigo} — ${p.descricao}`,
        unidade: p.unidade,
        justificativa: `Reposição: físico ${p.fisico}, reservado ${p.reservado}, disponível ${disp}, mínimo ${p.minimo}. Sugerido ${sugerida} ${p.unidade}.`,
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Nova solicitação"
        descricao={`${ctx.orgNome} · vira rascunho para análise.`}
        voltar={{ href: "/admin/compras/solicitacoes", rotulo: "Solicitações" }}
      />
      <NovaSolicitacaoForm produtos={lista} prefill={prefill} />
    </div>
  );
}
