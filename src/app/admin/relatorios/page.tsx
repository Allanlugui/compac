import type { Metadata } from "next";
import { Clock, Ticket, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { ChamadoStatus, Compra } from "@/lib/types";
import {
  formatarData,
  formatarDuracaoMedia,
  formatarMoeda,
  rotuloMes,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import FiltrosPeriodo from "./FiltrosPeriodo";
import GraficosRelatorio, {
  type FatiaSetor,
  type LinhaRanking,
  type PontoMensal,
} from "./GraficosRelatorio";
import BotaoImprimirRelatorio from "./BotaoImprimirRelatorio";

export const metadata: Metadata = {
  title: "Relatórios · SGA-M",
  description: "Central de relatórios gerenciais de manutenção e compras.",
};

interface RelatoriosProps {
  searchParams: Promise<{ inicio?: string; fim?: string }>;
}

interface ChamadoRelatorio {
  id: string;
  status: ChamadoStatus;
  created_at: string;
  concluido_em: string | null;
  prazo: string | null;
  ativos: { nome: string } | { nome: string }[] | null;
}

function nomeDoAtivo(ativos: ChamadoRelatorio["ativos"]): string {
  if (!ativos) return "Ativo removido";
  if (Array.isArray(ativos)) return ativos[0]?.nome ?? "Ativo removido";
  return ativos.nome;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function paraISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Chaves "YYYY-MM" entre dois meses (inclusive). */
function mesesNoIntervalo(inicio: string, fim: string): string[] {
  const chaves: string[] = [];
  let ano = Number(inicio.slice(0, 4));
  let mes = Number(inicio.slice(5, 7));
  const anoFim = Number(fim.slice(0, 4));
  const mesFim = Number(fim.slice(5, 7));
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    chaves.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return chaves;
}

export default async function RelatoriosPage({ searchParams }: RelatoriosProps) {
  const params = await searchParams;

  const hoje = new Date();
  const padraoFim = paraISO(hoje);
  const padraoInicio = paraISO(
    new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1),
  );

  let inicio =
    params.inicio && DATA_ISO.test(params.inicio) ? params.inicio : padraoInicio;
  let fim = params.fim && DATA_ISO.test(params.fim) ? params.fim : padraoFim;
  if (fim < inicio) [inicio, fim] = [fim, inicio];

  const supabase = await createClient();
  const ctx = await requireOrg();
  const [{ data: chamadosData }, { data: comprasData }] = await Promise.all([
    supabase
      .from("chamados")
      .select("id, status, created_at, concluido_em, prazo, ativos(id, nome)")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("compras")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .order("data_compra", { ascending: true }),
  ]);

  const noPeriodo = (dataISO: string) => dataISO >= inicio && dataISO <= fim;

  const chamados = ((chamadosData ?? []) as unknown as ChamadoRelatorio[]).filter(
    (c) => noPeriodo(c.created_at.slice(0, 10)),
  );
  const compras = ((comprasData ?? []) as Compra[]).filter((c) =>
    noPeriodo(c.data_compra.slice(0, 10)),
  );

  // ---------- KPIs ----------
  const concluidos = chamados.filter(
    (c) => c.status === "concluido" && c.concluido_em,
  );
  const tempos = concluidos
    .map((c) => +new Date(c.concluido_em as string) - +new Date(c.created_at))
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  const tempoMedioMs =
    tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : NaN;
  const gastosTotais = compras.reduce(
    (soma, c) => soma + Number(c.valor_total ?? 0),
    0,
  );

  // ---------- SLA e distribuição por status (dados reais) ----------
  const porStatus = { aberto: 0, em_andamento: 0, concluido: 0 };
  for (const c of chamados) porStatus[c.status] += 1;
  const comPrazo = concluidos.filter((c) => c.prazo);
  const noPrazo = comPrazo.filter(
    (c) => (c.concluido_em as string).slice(0, 10) <= (c.prazo as string),
  );
  const sla = comPrazo.length > 0 ? Math.round((noPrazo.length / comPrazo.length) * 100) : NaN;

  // ---------- Evolução mensal dos gastos ----------
  const meses = mesesNoIntervalo(inicio, fim);
  const gastosPorMes = new Map<string, number>(meses.map((m) => [m, 0]));
  for (const c of compras) {
    const chave = c.data_compra.slice(0, 7);
    gastosPorMes.set(chave, (gastosPorMes.get(chave) ?? 0) + Number(c.valor_total ?? 0));
  }
  const gastosMes: PontoMensal[] = meses.map((m) => ({
    mes: rotuloMes(m),
    total: Math.round((gastosPorMes.get(m) ?? 0) * 100) / 100,
  }));

  // ---------- Despesas por setor ----------
  const porSetor = new Map<string, number>();
  for (const c of compras) {
    const setor = c.setor?.trim() || "Sem setor";
    porSetor.set(setor, (porSetor.get(setor) ?? 0) + Number(c.valor_total ?? 0));
  }
  const gastosSetor: FatiaSetor[] = [...porSetor.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ---------- Ranking de ativos problemáticos ----------
  const porAtivo = new Map<string, number>();
  for (const c of chamados) {
    const nome = nomeDoAtivo(c.ativos);
    porAtivo.set(nome, (porAtivo.get(nome) ?? 0) + 1);
  }
  const ranking: LinhaRanking[] = [...porAtivo.entries()]
    .map(([nome, total]) => ({
      name: nome.length > 24 ? `${nome.slice(0, 23)}…` : nome,
      chamados: total,
    }))
    .sort((a, b) => b.chamados - a.chamados)
    .slice(0, 8);

  // ---------- Tabela consolidada mensal (visão de supervisão) ----------
  const abertosPorMes = new Map<string, number>();
  const concluidosPorMes = new Map<string, number>();
  for (const c of chamados) {
    const chave = c.created_at.slice(0, 7);
    abertosPorMes.set(chave, (abertosPorMes.get(chave) ?? 0) + 1);
    if (c.status === "concluido" && c.concluido_em) {
      const chaveC = c.concluido_em.slice(0, 7);
      concluidosPorMes.set(chaveC, (concluidosPorMes.get(chaveC) ?? 0) + 1);
    }
  }

  const kpis = [
    {
      rotulo: "Chamados no período",
      valor: String(chamados.length),
      detalhe: `${concluidos.length} concluídos`,
      Icone: Ticket,
      classes: "bg-amber-100 text-amber-700",
    },
    {
      rotulo: "Tempo médio de conclusão",
      valor: formatarDuracaoMedia(tempoMedioMs),
      detalhe: `base: ${tempos.length} chamados`,
      Icone: Clock,
      classes: "bg-sky-100 text-sky-700",
    },
    {
      rotulo: "Gastos no período",
      valor: formatarMoeda(gastosTotais),
      detalhe: `${compras.length} compras`,
      Icone: Wallet,
      classes: "bg-emerald-100 text-emerald-700",
    },
    {
      rotulo: "SLA (no prazo)",
      valor: Number.isFinite(sla) ? `${sla}%` : "—",
      detalhe: `base: ${comPrazo.length} com prazo`,
      Icone: Clock,
      classes: "bg-violet-100 text-violet-700",
    },
  ];

  const totalStatus = porStatus.aberto + porStatus.em_andamento + porStatus.concluido;
  const barraStatus = [
    { rotulo: "Abertos", valor: porStatus.aberto, classes: "bg-amber-400" },
    { rotulo: "Em andamento", valor: porStatus.em_andamento, classes: "bg-sky-500" },
    { rotulo: "Concluídos", valor: porStatus.concluido, classes: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 print:text-2xl">
            Relatórios Gerenciais
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Período: {formatarData(inicio)} a {formatarData(fim)}
          </p>
        </div>
        <BotaoImprimirRelatorio />
      </div>

      <FiltrosPeriodo inicio={inicio} fim={fim} />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ rotulo, valor, detalhe, Icone, classes }) => (
          <div
            key={rotulo}
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:shadow-none"
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                classes,
              )}
            >
              <Icone className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl leading-none font-bold text-zinc-900">
                {valor}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                {rotulo} · {detalhe}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm break-inside-avoid print:shadow-none">
        <h2 className="text-base font-bold text-zinc-900">O.S. por status</h2>
        <p className="mt-0.5 text-sm text-zinc-500">Distribuição no período selecionado</p>
        {totalStatus === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Sem chamados no período.</p>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-100">
              {barraStatus.map((b) =>
                b.valor > 0 ? (
                  <span key={b.rotulo} style={{ width: `${(b.valor / totalStatus) * 100}%` }} className={b.classes} title={`${b.rotulo}: ${b.valor}`} />
                ) : null,
              )}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
              {barraStatus.map((b) => (
                <li key={b.rotulo} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${b.classes}`} />
                  {b.rotulo}: <strong className="tabular-nums">{b.valor}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <GraficosRelatorio
        gastosMes={gastosMes}
        gastosSetor={gastosSetor}
        ranking={ranking}
      />

      {/* Resumo consolidado */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm break-inside-avoid print:shadow-none">
        <h2 className="text-base font-bold text-zinc-900">
          Resumo consolidado mensal
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Visão de supervisão · {formatarData(inicio)} a {formatarData(fim)}
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-zinc-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                <th className="px-4 py-2.5 font-semibold">Mês</th>
                <th className="px-4 py-2.5 font-semibold">Chamados abertos</th>
                <th className="px-4 py-2.5 font-semibold">Chamados concluídos</th>
                <th className="px-4 py-2.5 font-semibold">Gastos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {meses.map((m) => (
                <tr key={m} className="text-zinc-800">
                  <td className="px-4 py-2.5 font-medium">{rotuloMes(m)}</td>
                  <td className="px-4 py-2.5">{abertosPorMes.get(m) ?? 0}</td>
                  <td className="px-4 py-2.5">{concluidosPorMes.get(m) ?? 0}</td>
                  <td className="px-4 py-2.5 font-semibold">
                    {formatarMoeda(gastosPorMes.get(m) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-900 font-bold text-white">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5">{chamados.length}</td>
                <td className="px-4 py-2.5">{concluidos.length}</td>
                <td className="px-4 py-2.5">{formatarMoeda(gastosTotais)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
