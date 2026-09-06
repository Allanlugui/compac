import type { Metadata } from "next";
import Link from "next/link";
import { Clock, FileText, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { pode } from "@/lib/permissoes";
import { resolverFoto } from "@/lib/storage";
import type {
  Cotacao,
  SolicitacaoAnexo,
  SolicitacaoCompleta,
  SolicitacaoHistorico,
  SolicitacaoItem,
} from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusSolicBadge from "../StatusSolicBadge";
import SolicitacaoWorkflow from "./SolicitacaoWorkflow";
import ItensSolicitacao from "./ItensSolicitacao";
import CotacoesManager from "./CotacoesManager";
import AnexosSolicitacao from "./AnexosSolicitacao";
import GerarPedidoForm from "./GerarPedidoForm";

export const metadata: Metadata = { title: "Solicitação · SGA-M" };

interface Props {
  params: Promise<{ id: string }>;
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-black">
        <span className="flex size-8 items-center justify-center rounded-xl bg-zinc-900 text-white">
          {icone}
        </span>
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function SolicitacaoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await requireOrg();

  const podeAprovar = pode(ctx, "solicitacoes.aprovar");
  const podeEditar = pode(ctx, "solicitacoes.criar");
  const podeCotar = pode(ctx, "compras.cotar");
  const podePedir = pode(ctx, "compras.criar");

  const [
    { data: solData },
    { data: itensData },
    { data: histData },
    { data: cotsData },
    { data: anexosData },
    { data: pedsData },
    { data: prodsData },
    { data: fornsData },
  ] = await Promise.all([
    supabase.from("solicitacoes_compra").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("solicitacao_itens").select("*").eq("solicitacao_id", id).eq("organization_id", ctx.orgId).order("created_at"),
    supabase.from("solicitacao_historico").select("*").eq("solicitacao_id", id).eq("organization_id", ctx.orgId).order("created_at"),
    supabase.from("cotacoes").select("*, fornecedores(nome)").eq("solicitacao_id", id).eq("organization_id", ctx.orgId).order("valor"),
    supabase.from("solicitacao_anexos").select("*").eq("solicitacao_id", id).eq("organization_id", ctx.orgId).order("created_at"),
    supabase.from("pedidos_compra").select("id, numero, status, created_at").eq("solicitacao_id", id).eq("organization_id", ctx.orgId).order("created_at"),
    supabase.from("produtos").select("id, codigo, unidade, estoque_atual, estoque_reservado, estoque_minimo").eq("organization_id", ctx.orgId).eq("ativo", true).limit(500),
    supabase.from("fornecedores").select("id, nome").eq("organization_id", ctx.orgId).eq("ativo", true).order("nome").limit(200),
  ]);

  const sol = (solData ?? null) as SolicitacaoCompleta | null;
  if (!sol) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Solicitação" voltar={{ href: "/admin/compras/solicitacoes", rotulo: "Solicitações" }} />
        <EmptyState Icone={SearchX} titulo="Não encontrada" descricao="Verifique o link ou a organização." />
      </div>
    );
  }

  const prodsOpts = ((prodsData ?? []) as {
    id: string; codigo: string; unidade: string;
    estoque_atual: number; estoque_reservado: number; estoque_minimo: number;
  }[]).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    unidade: p.unidade,
    fisico: Number(p.estoque_atual ?? 0),
    reservado: Number(p.estoque_reservado ?? 0),
    minimo: Number(p.estoque_minimo ?? 0),
  }));
  const mapaEst = new Map(prodsOpts.map((p) => [p.id, { fisico: p.fisico, reservado: p.reservado, minimo: p.minimo }]));
  const itens = ((itensData ?? []) as SolicitacaoItem[]).map((it) => ({
    ...it,
    estoque: it.produto_id ? (mapaEst.get(it.produto_id) ?? null) : null,
  }));
  const historico = (histData ?? []) as SolicitacaoHistorico[];
  const cotacoes = ((cotsData ?? []) as (Cotacao & { fornecedores: { nome: string } | null })[]).map((c) => ({
    ...c,
    fornecedor_nome: c.fornecedores?.nome ?? null,
  }));
  const anexos = await Promise.all(
    ((anexosData ?? []) as SolicitacaoAnexo[]).map(async (a) => ({
      ...a,
      url: await resolverFoto(a.path, ctx.orgId),
    })),
  );
  const pedidos = (pedsData ?? []) as { id: string; numero: string; status: string; created_at: string }[];
  const editavel = ["rascunho", "enviada", "em_analise", "pendente"].includes(sol.status);
  const podeGerarPedido = ["aprovada", "aprovado", "em_cotacao"].includes(sol.status);

  return (
    <div className="space-y-4">
      <PageHeader
        titulo={sol.item}
        descricao={`${sol.setor} · ${sol.solicitante}${sol.origem ? ` · via ${sol.origem}` : ""}`}
        voltar={{ href: "/admin/compras/solicitacoes", rotulo: "Solicitações" }}
        acoes={<StatusSolicBadge status={sol.status} />}
      />

      <Secao icone={<Clock className="size-4" />} titulo="Situação e workflow">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Justificativa</dt><dd>{sol.justificativa}</dd></div>
          <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Prioridade / Centro</dt><dd>{[sol.prioridade, sol.centro_custo].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Prazo</dt><dd>{sol.prazo ?? "—"}</dd></div>
          {sol.aprovado_por && (
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Aprovação</dt><dd>{sol.aprovado_por}{sol.aprovado_em ? ` · ${formatarDataHora(sol.aprovado_em)}` : ""}</dd></div>
          )}
        </dl>
        <div className="mt-3">
          <SolicitacaoWorkflow solicitacaoId={sol.id} statusAtual={sol.status} podeAprovar={podeAprovar} />
        </div>
        {historico.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {historico.map((h) => (
              <li key={h.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200/70">
                <span className="font-bold">{h.de ?? "criação"} → {h.para}</span>
                {h.motivo && <span className="text-zinc-600"> · {h.motivo}</span>}
                <span className="block text-xs text-zinc-400">
                  {h.executado_por ?? ""} · {formatarDataHora(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icone={<FileText className="size-4" />} titulo={`Itens (${itens.length})`}>
        <ItensSolicitacao
          solicitacaoId={sol.id}
          itens={itens}
          produtos={prodsOpts}
          podeEditar={podeEditar && editavel}
        />
      </Secao>

      <Secao icone={<FileText className="size-4" />} titulo="Cotações">
        <CotacoesManager
          solicitacaoId={sol.id}
          cotacoes={cotacoes}
          fornecedores={(fornsData ?? []) as { id: string; nome: string }[]}
          podeCotar={podeCotar && ["aprovada", "aprovado", "em_cotacao"].includes(sol.status)}
        />
      </Secao>

      {podePedir && podeGerarPedido && (
        <Secao icone={<FileText className="size-4" />} titulo="Gerar pedido">
          <GerarPedidoForm
            solicitacaoId={sol.id}
            itens={itens}
            cotacoes={cotacoes}
            fornecedores={(fornsData ?? []) as { id: string; nome: string }[]}
          />
        </Secao>
      )}

      {pedidos.length > 0 && (
        <Secao icone={<FileText className="size-4" />} titulo="Pedidos vinculados">
          <ul className="space-y-1.5">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/compras/pedidos/${p.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200/70 hover:bg-zinc-100">
                  <span className="font-bold">{p.numero}</span>
                  <span className="text-xs text-zinc-500">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao icone={<FileText className="size-4" />} titulo="Anexos">
        <AnexosSolicitacao solicitacaoId={sol.id} anexos={anexos} />
      </Secao>
    </div>
  );
}
