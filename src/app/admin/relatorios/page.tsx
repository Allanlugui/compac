import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { formatarData, formatarMoeda, formatarDuracaoMedia } from "@/lib/format";
import type { PeriodoId } from "@/lib/analytics/types";
import {
  queryAtivosCriticos,
  queryAtivosPorStatus,
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
import ExportButtons from "./ExportButtons";

export const metadata: Metadata = { title: "Relatórios · SGA-M" };

const ABAS = [
  { id: "executivo", rotulo: "Executivo" },
  { id: "ativos", rotulo: "Ativos" },
  { id: "manutencao", rotulo: "Manutenção" },
  { id: "sla", rotulo: "SLA" },
  { id: "custos", rotulo: "Custos" },
  { id: "estoque", rotulo: "Estoque" },
  { id: "solicitacoes", rotulo: "Solicitações" },
  { id: "top", rotulo: "Top Ativos" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "90d", rotulo: "90 dias" },
  { id: "12m", rotulo: "12 meses" },
];

function KpiCard({
  titulo,
  valor,
  sub,
  href,
  estado,
}: {
  titulo: string;
  valor: React.ReactNode;
  sub?: string;
  href?: string;
  estado?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className="mt-2 text-2xl font-black tabular-nums">
        {estado === "insufficient_data" ? <span className="text-sm font-medium text-amber-700">Dados insuficientes</span> : estado === "no_deadline" ? <span className="text-sm text-zinc-500">Sem prazo</span> : valor}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:shadow-md">
        {content}
      </Link>
    );
  }
  return content;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; aba?: string }>;
}) {
  const sp = await searchParams;
  const periodo = (["7d", "30d", "90d", "12m"].includes(sp.periodo ?? "") ? sp.periodo : "30d") as PeriodoId;
  const aba = (ABAS.some((a) => a.id === sp.aba) ? sp.aba : "executivo") as AbaId;

  const supabase = await createClient();
  const ctx = await requireOrg();
  const qctx = { supabase, orgId: ctx.orgId, periodo };

  const [
    totalAtivos,
    porStatus,
    criticos,
    disponibilidade,
    osAbertas,
    backlog,
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

  // Dados para exportação (mesma query, mesmo filtro)
  const exportData = {
    periodo,
    org: ctx.orgNome,
    totalAtivos,
    criticos,
    osAbertas,
    backlog,
    sla,
    mttr: mttr.value !== null ? formatarDuracaoMedia(mttr.value) : null,
    mttrState: mttr.state,
    texec: texec.value !== null ? formatarDuracaoMedia(texec.value) : null,
    mtbf: mtbf.value !== null ? formatarDuracaoMedia(mtbf.value) : null,
    estoque,
    solicitacoes,
    custoTotal: formatarMoeda(custoTotal),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Relatórios</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {ctx.orgNome} · Período: {periodo} · America/Sao_Paulo · {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1">
            {PERIODOS.map((p) => (
              <Link
                key={p.id}
                href={`/admin/relatorios?periodo=${p.id}&aba=${aba}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${periodo === p.id ? "bg-white shadow ring-1 ring-zinc-200" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {p.rotulo}
              </Link>
            ))}
          </div>
          <ExportButtons data={exportData} periodo={periodo} aba={aba} />
        </div>
      </div>

      <nav className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/admin/relatorios?periodo=${periodo}&aba=${a.id}`}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold ${aba === a.id ? "bg-white shadow ring-1 ring-zinc-200" : "text-zinc-500 hover:text-zinc-800"}`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      {aba === "executivo" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard titulo="Total Ativos" valor={totalAtivos} href="/admin/ativos" sub="Cadastrados" />
            <KpiCard titulo="Ativos Críticos" valor={criticos} href="/admin/ativos?critico=1" sub={`${totalAtivos ? ((criticos / totalAtivos) * 100).toFixed(1) : 0}% do total`} />
            <KpiCard titulo="O.S. Abertas" valor={osAbertas} href="/admin/chamados?os_status=aberta" sub={`Backlog: ${backlog}`} />
            <KpiCard titulo="Solicitações Pendentes" valor={solicitacoes} href="/admin/compras/solicitacoes" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <KpiCard titulo="SLA Dentro do Prazo" valor={sla.taxaDentro !== null ? `${sla.taxaDentro.toFixed(1)}%` : "—"} sub={`Dentro ${sla.dentro} · Próximo ${sla.proximo} · Atrasado ${sla.atrasado} · Sem prazo ${sla.semPrazo}`} />
            <KpiCard titulo="MTTR" valor={mttr.value !== null ? formatarDuracaoMedia(mttr.value) : "—"} estado={mttr.state} sub="Tempo médio de resolução" />
            <KpiCard titulo="Tempo Execução" valor={texec.value !== null ? formatarDuracaoMedia(texec.value) : "—"} estado={texec.state} sub="Média data_fim - data_inicio" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <KpiCard titulo="MTBF" valor={mtbf.value !== null ? formatarDuracaoMedia(mtbf.value) : "—"} estado={mtbf.state} sub="≥3 corretiva, média intervalos" />
            <KpiCard titulo="Disponibilidade" valor={disponibilidade.value !== null ? `${(disponibilidade.value * 100).toFixed(1)}%` : "—"} estado={disponibilidade.state} sub="Histórico contínuo" />
            <KpiCard titulo="Custo Total (período)" valor={formatarMoeda(custoTotal)} sub="Mão obra + outros + serviços + consumo" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard titulo="Estoque Disponível" valor={estoque.disponivel} sub={`Críticos ${estoque.criticos} · Abaixo reposição ${estoque.abaixoReposicao} · Valor ${formatarMoeda(estoque.valorFisico)}`} href="/admin/estoque" />
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Ativos por Status</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {Object.entries(porStatus).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-zinc-100 px-2 py-1 font-medium">
                    {k}: {v}
                  </span>
                ))}
                {Object.keys(porStatus).length === 0 && <span className="text-zinc-500">Sem dados</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {aba === "ativos" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard titulo="Total" valor={totalAtivos} />
            <KpiCard titulo="Críticos" valor={criticos} href="/admin/ativos?critico=1" />
            <KpiCard titulo="Disponibilidade" valor={disponibilidade.value !== null ? `${(disponibilidade.value * 100).toFixed(1)}%` : "—"} estado={disponibilidade.state} />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Ativos por Status</h3>
            <div className="mt-3 space-y-2">
              {Object.entries(porStatus).map(([status, qtd]) => (
                <div key={status} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <span className="text-sm font-bold">{status}</span>
                  <Link href={`/admin/ativos?status=${status}`} className="text-sm font-black tabular-nums underline-offset-2 hover:underline">
                    {qtd}
                  </Link>
                </div>
              ))}
              {Object.keys(porStatus).length === 0 && <p className="text-sm text-zinc-500">Sem dados</p>}
            </div>
          </div>
        </div>
      )}

      {aba === "manutencao" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard titulo="O.S. Abertas" valor={osAbertas} href="/admin/chamados?os_status=aberta" />
            <KpiCard titulo="Backlog O.S." valor={backlog} sub="os_status ativos" />
            <KpiCard titulo="MTTR" valor={mttr.value !== null ? formatarDuracaoMedia(mttr.value) : "—"} estado={mttr.state} />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">O.S. por Ativo (Top 10)</h3>
            <div className="mt-3 space-y-1">
              {topOS.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem dados</p>
              ) : (
                topOS.map(([id, qtd]) => (
                  <div key={id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                    <span className="font-mono text-xs">{id.slice(0, 8)}</span>
                    <Link href={`/admin/chamados?ativo=${id}`} className="text-sm font-bold hover:underline">
                      {qtd} O.S.
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {aba === "sla" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">SLA — Dentro / Próximo (2d) / Atrasado / Sem prazo</h3>
            <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-zinc-100">
              <div className="bg-emerald-500" style={{ width: `${sla.totalComPrazo ? (sla.dentro / sla.totalComPrazo) * 100 : 0}%` }} />
              <div className="bg-amber-400" style={{ width: `${sla.totalComPrazo ? (sla.proximo / sla.totalComPrazo) * 100 : 0}%` }} />
              <div className="bg-red-500" style={{ width: `${sla.totalComPrazo ? (sla.atrasado / sla.totalComPrazo) * 100 : 0}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2 py-1 font-bold text-emerald-800">Dentro: {sla.dentro}</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-800">Próximo: {sla.proximo}</span>
              <span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-800">Atrasado: {sla.atrasado}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-1">Sem prazo: {sla.semPrazo}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Taxa dentro do prazo: {sla.taxaDentro !== null ? `${sla.taxaDentro.toFixed(1)}%` : "Sem dados"}</p>
          </div>
        </div>
      )}

      {aba === "custos" && (
        <div className="space-y-4">
          <KpiCard titulo="Custo Total (período)" valor={formatarMoeda(custoTotal)} sub="Mão obra + outros + serviços + consumo (sem compra)" />
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Custo por Ativo (Top 10)</h3>
            <div className="mt-3 space-y-1">
              {topCusto.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem dados</p>
              ) : (
                topCusto.map(([id, v]) => (
                  <div key={id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                    <span className="font-mono text-xs">{id.slice(0, 8)}</span>
                    <span className="text-sm font-bold">{formatarMoeda(v)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500">Compra ≠ consumo. Teste: Compra 1000 + Consumo 100 = Custo 100.</p>
        </div>
      )}

      {aba === "estoque" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard titulo="Disponível" valor={estoque.disponivel} sub={`Físico - reservado`} />
            <KpiCard titulo="Críticos" valor={estoque.criticos} href="/admin/estoque?filtro=criticos" sub="disponível <= mínimo" />
            <KpiCard titulo="Valor físico" valor={formatarMoeda(estoque.valorFisico)} sub={`${estoque.total} produtos`} />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Top Consumo — Quantidade</h3>
            <div className="mt-2 space-y-1">
              {consumo.porQuantidade.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem consumo no período</p>
              ) : (
                consumo.porQuantidade.map(([id, qtd]) => (
                  <div key={id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{id.slice(0, 8)}</span>
                    <span className="font-bold">{qtd}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Top Consumo — Valor</h3>
            <div className="mt-2 space-y-1">
              {consumo.porValor.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem consumo</p>
              ) : (
                consumo.porValor.map(([id, v]) => (
                  <div key={id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{id.slice(0, 8)}</span>
                    <span className="font-bold">{formatarMoeda(v)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {aba === "solicitacoes" && (
        <div className="space-y-4">
          <KpiCard titulo="Solicitações Pendentes" valor={solicitacoes} href="/admin/compras/solicitacoes" sub="rascunho/enviada/em_analise/em_cotacao" />
          <p className="text-xs text-zinc-500">Filtros futuros: unidade, localidade, categoria, técnico — quando schema suportar.</p>
        </div>
      )}

      {aba === "top" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Top 10 por O.S.</h3>
            <div className="mt-2 space-y-1">
              {topOS.map(([id, qtd]) => (
                <div key={id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                  <Link href={`/admin/chamados?ativo=${id}`} className="font-mono text-xs hover:underline">
                    {id.slice(0, 8)}
                  </Link>
                  <span className="font-bold">{qtd}</span>
                </div>
              ))}
              {topOS.length === 0 && <p className="text-sm text-zinc-500">Sem dados</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Top 10 por Custo</h3>
            <div className="mt-2 space-y-1">
              {topCusto.map(([id, v]) => (
                <div key={id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{id.slice(0, 8)}</span>
                  <span className="font-bold">{formatarMoeda(v)}</span>
                </div>
              ))}
              {topCusto.length === 0 && <p className="text-sm text-zinc-500">Sem dados</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Top 10 por Reincidência</h3>
            <div className="mt-2 space-y-1">
              {topReinc.map(([id, qtd]) => (
                <div key={id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{id.slice(0, 8)}</span>
                  <span className="font-bold">{qtd} reinc.</span>
                </div>
              ))}
              {topReinc.length === 0 && <p className="text-sm text-zinc-500">Sem reincidências (mesmo ativo + mesma categoria &lt;90d)</p>}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-400">Tenant: {ctx.orgId.slice(0, 8)} · Período: {periodo} · America/Sao_Paulo · Dashboard e Relatórios consomem src/lib/analytics (mesma query)</p>
    </div>
  );
}
