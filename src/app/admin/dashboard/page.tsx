import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { formatarMoeda, formatarDuracaoMedia } from "@/lib/format";
import { RoleDashboard } from "./RoleDashboard";
import type { PeriodoId } from "@/lib/analytics/types";
import {
  queryAtivosCriticos,
  queryAtivosPorStatus,
  queryBacklogDemanda,
  queryBacklogOS,
  queryConsumoPorProduto,
  queryCustoTotal,
  queryDisponibilidade,
  queryEstoqueResumo,
  queryMTTR,
  queryMTBF,
  queryOSAbetas,
  querySLA,
  querySolicitacoesPendentes,
  queryTempoExecucao,
  queryTopAtivos,
  queryTopAtivosPorCusto,
  queryTopAtivosPorReincidencia,
  queryTotalAtivos,
} from "@/lib/analytics/queries";

export const metadata: Metadata = { title: "Dashboard · SGA-M" };

const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "90d", rotulo: "90 dias" },
  { id: "12m", rotulo: "12 meses" },
];

function BarList({
  titulo,
  itens,
  hrefBase,
}: {
  titulo: string;
  itens: [string, number][];
  hrefBase?: string;
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
        <p className="mt-2 text-sm text-zinc-500">Sem dados suficientes</p>
      </div>
    );
  }
  const max = Math.max(...itens.map(([, v]) => v), 1);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <ul className="mt-3 space-y-2">
        {itens.map(([id, qtd]) => (
          <li key={id} className="flex items-center gap-3">
            <span className="w-24 truncate font-mono text-xs font-bold" title={id}>
              {id.slice(0, 8)}
            </span>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-zinc-100">
                <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${(qtd / max) * 100}%` }} />
              </div>
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums">{qtd}</span>
            {hrefBase && (
              <Link href={`${hrefBase}?ativo=${id}`} className="text-xs font-bold text-zinc-600 underline-offset-2 hover:underline">
                Ver
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; inicio?: string; fim?: string }>;
}) {
  const sp = await searchParams;
  const periodo = (
    sp.periodo === "7d" || sp.periodo === "30d" || sp.periodo === "90d" || sp.periodo === "12m" || sp.periodo === "hoje"
      ? sp.periodo
      : "30d"
  ) as PeriodoId;
  const personalizado =
    sp.inicio && sp.fim ? { inicio: sp.inicio, fim: sp.fim } : undefined;

  const supabase = await createClient();
  const ctx = await requireOrg();

  const qctx = { supabase, orgId: ctx.orgId, periodo, personalizado };
  const isSolicitante = ctx.role === "SOLICITANTE";
  const isAdmin = ctx.role === "ADMIN";

  const [
    totalAtivos,
    porStatus,
    criticos,
    disponibilidade,
    osAbertas,
    backlogOS,
    backlogDemanda,
    sla,
    mttr,
    texec,
    mtbf,
    estoque,
    solicitacoes,
    topOS,
    topCusto,
    topReinc,
    consumo,
    custoTotal,
  ] = await Promise.all([
    queryTotalAtivos(qctx),
    queryAtivosPorStatus(qctx),
    queryAtivosCriticos(qctx),
    queryDisponibilidade(qctx),
    queryOSAbetas(qctx),
    queryBacklogOS(qctx),
    queryBacklogDemanda(qctx),
    querySLA(qctx),
    queryMTTR(qctx),
    queryTempoExecucao(qctx),
    queryMTBF(qctx),
    queryEstoqueResumo(qctx),
    querySolicitacoesPendentes(qctx),
    queryTopAtivos(qctx, 10),
    queryTopAtivosPorCusto(qctx, 10),
    queryTopAtivosPorReincidencia(qctx, 10),
    queryConsumoPorProduto(qctx, 10),
    queryCustoTotal(qctx),
  ]);

  const porStatusEntries = Object.entries(porStatus) as [string, number][];
  const slaDentro = sla.taxaDentro !== null ? `${sla.taxaDentro.toFixed(1)}%` : "—";

  // Role-specific scope (least privilege, não inventar equipe)
  let minhasOS = 0, osAtrasadas = 0, osConcluidas = 0, meusChamados = 0, minhasSolicitacoes = 0;
  if (ctx.role === "TECNICO") {
    const { count } = await supabase.from("chamados").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).eq("responsavel", ctx.email).in("os_status", ["aberta","planejada","atribuida","em_execucao","aguardando_peca","aguardando_terceiro","em_validacao"]);
    minhasOS = count ?? 0;
    const { count: atras } = await supabase.from("chamados").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).eq("responsavel", ctx.email).lt("prazo", new Date().toISOString().slice(0,10)).not("os_status","in",'("concluida","encerrada")');
    osAtrasadas = atras ?? 0;
    const { count: concl } = await supabase.from("chamados").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).eq("responsavel", ctx.email).in("os_status",["concluida","encerrada"]);
    osConcluidas = concl ?? 0;
  } else if (ctx.role === "SOLICITANTE") {
    const { count: c1 } = await supabase.from("chamados").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).eq("solicitante", ctx.email);
    meusChamados = c1 ?? 0;
    const { count: c2 } = await supabase.from("solicitacoes_compra").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).or(`created_by.eq.${ctx.userId},solicitante.eq.${ctx.email}`);
    minhasSolicitacoes = c2 ?? 0;
  }

  // Se não é ADMIN, usa RoleDashboard (experiência por perfil)
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader titulo={ctx.role === "GESTOR" ? "Minha Gestão" : ctx.role === "TECNICO" ? "Minha Operação" : ctx.role === "COMPRAS" ? "Suprimentos" : ctx.role === "AUDITOR" ? "Conformidade" : "Minhas Solicitações"} descricao={`${ctx.orgNome} · ${ctx.role} · Período: ${periodo}`} />
        <RoleDashboard role={ctx.role} periodo={periodo} data={{ totalAtivos, porStatus, criticos, disponibilidade, osAbertas, backlogOS, backlogDemanda, sla, mttr, texec, mtbf, estoque, solicitacoes, topOS, topCusto, topReinc, consumo, custoTotal, minhasOS, osAtrasadas, osConcluidas, meusChamados, minhasSolicitacoes }} />
        <p className="text-xs text-zinc-400">Tenant: {ctx.orgId.slice(0,8)} · {ctx.email}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Dashboard"
        descricao={`${ctx.orgNome} · Período: ${periodo} · America/Sao_Paulo`}
        acoes={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1">
              {PERIODOS.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/dashboard?periodo=${p.id}`}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${periodo === p.id ? "bg-white shadow ring-1 ring-zinc-200" : "text-zinc-500 hover:text-zinc-800"}`}
                >
                  {p.rotulo}
                </Link>
              ))}
            </div>
            <span className="hidden text-xs text-zinc-400 sm:inline">
              {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </span>
          </div>
        }
      />

      {/* N1 — Saúde operacional */}
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">N1 — Saúde operacional</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Total de ativos" valor={totalAtivos} href="/admin/ativos" sub="Todos cadastrados" />
          <Card titulo="Ativos críticos" valor={criticos} href="/admin/ativos?critico=1" sub={`${totalAtivos > 0 ? ((criticos / totalAtivos) * 100).toFixed(1) : "0"}% do total`} />
          <Card
            titulo="Disponibilidade"
            valor={disponibilidade.value !== null ? `${(disponibilidade.value * 100).toFixed(1)}%` : "—"}
            estado={disponibilidade.state as "insufficient_data"}
            sub={disponibilidade.state === "insufficient_data" ? "É necessário histórico adicional" : undefined}
          />
          <Card titulo="Ativos por status" valor={`${porStatusEntries.length} categorias`} sub={porStatusEntries.map(([k, v]) => `${k}: ${v}`).join(" · ") || "Sem dados"} />
        </div>
        {porStatusEntries.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Ativos por status — distribuição</p>
            <div className="mt-3 flex h-4 overflow-hidden rounded-full">
              {porStatusEntries.map(([status, qtd]) => {
                const total = porStatusEntries.reduce((s, [, v]) => s + v, 0);
                const pct = (qtd / total) * 100;
                const color =
                  status === "operacional" ? "bg-emerald-500" : status === "parado" ? "bg-red-500" : status === "em_manutencao" ? "bg-amber-500" : "bg-zinc-300";
                return <div key={status} className={color} style={{ width: `${pct}%` }} title={`${status}: ${qtd}`} />;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {porStatusEntries.map(([k, v]) => (
                <span key={k} className="rounded-full bg-zinc-100 px-2 py-1 font-medium">
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* N2 — Eficiência */}
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">N2 — Eficiência operacional</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="O.S. abertas" valor={osAbertas} href="/admin/chamados?os_status=aberta" sub={`Backlog O.S.: ${backlogOS} · Demanda: ${backlogDemanda}`} />
          <Card titulo="Backlog" valor={`${backlogOS}`} sub={`Demanda: ${backlogDemanda} · Atrasado depende de prazo`} />
          <Card
            titulo="Tempo médio de resolução"
            valor={mttr.value !== null ? formatarDuracaoMedia(mttr.value) : "—"}
            estado={mttr.state as "insufficient_data"}
            sub="MTTR: created_at â†’ concluido_em"
          />
          <Card
            titulo="Tempo médio de execução"
            valor={texec.value !== null ? formatarDuracaoMedia(texec.value) : "—"}
            estado={texec.state as "insufficient_data"}
            sub="data_inicio â†’ data_fim"
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">SLA — dentro/próximo/atrasado/sem prazo</p>
            <div className="mt-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
                <div className="bg-emerald-500" style={{ width: `${sla.totalComPrazo ? (sla.dentro / sla.totalComPrazo) * 100 : 0}%` }} title={`Dentro: ${sla.dentro}`} />
                <div className="bg-amber-400" style={{ width: `${sla.totalComPrazo ? (sla.proximo / sla.totalComPrazo) * 100 : 0}%` }} title={`Próximo: ${sla.proximo}`} />
                <div className="bg-red-500" style={{ width: `${sla.totalComPrazo ? (sla.atrasado / sla.totalComPrazo) * 100 : 0}%` }} title={`Atrasado: ${sla.atrasado}`} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-2 py-1 font-bold text-emerald-800">Dentro: {sla.dentro} ({slaDentro})</span>
                <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-800">Próximo (2d): {sla.proximo}</span>
                <span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-800">Atrasado: {sla.atrasado}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-1">Sem prazo: {sla.semPrazo}</span>
              </div>
            </div>
          </div>
          <Card
            titulo="MTBF"
            valor={mtbf.value !== null ? formatarDuracaoMedia(mtbf.value) : "—"}
            estado={mtbf.state as "insufficient_data"}
            sub={mtbf.state === "insufficient_data" ? "â‰¥3 falhas corretiva com ativo_id" : "Média de intervalos entre falhas"}
          />
        </div>
      </section>

      {/* N3 — Recursos */}
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">N3 — Recursos e demanda</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Estoque — disponível" valor={estoque.disponivel} href="/admin/estoque" sub={`Críticos: ${estoque.criticos} · Abaixo reposição: ${estoque.abaixoReposicao}`} />
          {!isSolicitante && <Card titulo="Estoque — valor físico" valor={formatarMoeda(estoque.valorFisico)} sub={`${estoque.total} produtos · físico × custo_médio`} />}
          <Card titulo="Solicitações pendentes" valor={solicitacoes} href="/admin/compras/solicitacoes" sub="rascunho/enviada/em_analise/em_cotacao" />
          <Card titulo="Consumo por produto" valor={`${consumo.porQuantidade.length} produtos`} sub="Top consumo no período" />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <BarList titulo="Top ativos por O.S. (Top 10)" itens={topOS} hrefBase="/admin/chamados" />
          <BarList titulo="Top ativos por custo (Top 10)" itens={topCusto.map(([id, v]) => [id, Math.round(v)] as [string, number])} hrefBase="/admin/chamados" />
          <BarList titulo="Top ativos por reincidência (Top 10)" itens={topReinc} hrefBase="/admin/chamados" />
        </div>
        {consumo.porQuantidade.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            <BarList titulo="Top consumo — quantidade" itens={consumo.porQuantidade.slice(0, 10)} />
            <BarList titulo="Top consumo — valor" itens={consumo.porValor.slice(0, 10).map(([id, v]) => [id, Math.round(v)] as [string, number])} />
          </div>
        )}
      </section>

      {/* N4 — Custos — oculto para SOLICITANTE */}
      {!isSolicitante && (
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">N4 — Custos</h2>
          <Card
            titulo="Custo total das O.S."
            valor={formatarMoeda(custoTotal)}
            href="/admin/relatorios?aba=custos"
            sub="Materiais consumidos + mão de obra + serviços + outros (período)"
          />
        <p className="text-xs text-zinc-500">
          Custo não inclui compras de aquisição não consumidas. Teste de regressão: Compra R$1.000 + Consumo R$100 = Custo R$100.
        </p>
        </section>
      )}

      <p className="text-xs text-zinc-400">
        Período padrão: 30 dias · Timezone: America/Sao_Paulo (UTC no banco) · Tenant: {ctx.orgId.slice(0, 8)} · Cache: org+filtros+role+período
      </p>
    </div>
  );
}


