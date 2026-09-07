/**
 * SGA-M — Analytics Calculations (pure, sem I/O)
 * BLOCO A complemento: TTR vs TEXEC, SLA próximo 2d, MTBF 3 falhas, etc.
 * Documentado em ANALYTICS_SPEC.md
 */

import type { ChamadoStatus, OsStatus, PeriodoId, SlaClass } from "./types";

const BACKLOG_DEMANDA = new Set<ChamadoStatus>([
  "aberto",
  "em_triagem",
  "aguardando_informacao",
  "convertido_os",
  "em_andamento",
]);

const BACKLOG_OS = new Set<OsStatus>([
  "aberta",
  "planejada",
  "atribuida",
  "em_execucao",
  "aguardando_peca",
  "aguardando_terceiro",
  "em_validacao",
]);

export function isBacklogDemanda(status: ChamadoStatus): boolean {
  return BACKLOG_DEMANDA.has(status);
}

export function isBacklogOS(osStatus: string | null): boolean {
  return osStatus !== null && BACKLOG_OS.has(osStatus as OsStatus);
}

export function isFinalDemanda(status: ChamadoStatus): boolean {
  return status === "resolvido" || status === "concluido" || status === "cancelado";
}

export function isCancelado(status: ChamadoStatus): boolean {
  return status === "cancelado";
}

// ---------------------------------------------------------------------------
// Estoque (homologado: disponível = físico - reservado)
// ---------------------------------------------------------------------------

export function calcDisponivel(fisico: number, reservado: number): number {
  return Number(fisico) - Number(reservado);
}

export function isCritico(disponivel: number, minimo: number): boolean {
  return disponivel <= Number(minimo);
}

export function isAbaixoReposicao(disponivel: number, pontoReposicao: number): boolean {
  return disponivel <= Number(pontoReposicao);
}

export function calcValorEstoque(quantidade: number, custoMedio: number): number {
  return Number(quantidade) * Number(custoMedio);
}

export function calcValorTotalEstoque(
  produtos: { estoque_atual: number; custo_medio: number }[],
): number {
  return produtos.reduce((s, p) => s + calcValorEstoque(Number(p.estoque_atual ?? 0), Number(p.custo_medio ?? 0)), 0);
}

export function calcValorTotalEstoqueFisico(
  produtos: { estoque_atual: number; custo_medio: number; ultimo_custo?: number | null }[],
): number {
  // usa custo_medio, fallback ultimo_custo se nulo — documentado em SPEC §9
  return produtos.reduce((s, p) => {
    const custo = Number(p.custo_medio ?? p.ultimo_custo ?? 0);
    return s + Number(p.estoque_atual ?? 0) * custo;
  }, 0);
}

// ---------------------------------------------------------------------------
// SLA — Dentro / Próximo (2d) / Atrasado / Sem prazo
// ---------------------------------------------------------------------------

export function classificarSLA(
  prazo: string | null, // YYYY-MM-DD
  concluidoEm: string | null, // ISO
  osStatus: string | null,
  hojeISO: string, // YYYY-MM-DD America/Sao_Paulo
): SlaClass {
  if (!prazo) return "sem_prazo";
  if (concluidoEm) {
    const concluidoDate = concluidoEm.slice(0, 10);
    return concluidoDate <= prazo ? "dentro" : "atrasado";
  }
  if (osStatus === "concluida" || osStatus === "encerrada") return "dentro";
  if (prazo < hojeISO) return "atrasado";
  const diffDays = Math.floor((new Date(prazo).getTime() - new Date(hojeISO).getTime()) / 86400000);
  if (diffDays >= 0 && diffDays <= 2) return "proximo";
  return "dentro";
}

// ---------------------------------------------------------------------------
// TTR vs Tempo de Execução vs MTTR
// ---------------------------------------------------------------------------

/**
 * Tempo de Resolução (TTR): created_at → concluido_em
 * É o que o SGA-M mede como MTTR por padrão (abertura → conclusão).
 */
export function calcTempoResolucaoMs(createdAt: string, concluidoEm: string): number | null {
  const d = new Date(concluidoEm).getTime() - new Date(createdAt).getTime();
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/**
 * Tempo de Execução: data_inicio → data_fim
 * Só quando ambos preenchidos. Senão null → excluído de média.
 */
export function calcTempoExecucaoMs(dataInicio: string | null, dataFim: string | null): number | null {
  if (!dataInicio || !dataFim) return null;
  const d = new Date(dataFim).getTime() - new Date(dataInicio).getTime();
  return Number.isFinite(d) && d >= 0 ? d : null;
}

export function calcMTTRMs(durationsMs: number[]): number | null {
  const valid = durationsMs.filter((d) => Number.isFinite(d) && d >= 0);
  if (valid.length === 0) return null;
  return valid.reduce((s, d) => s + d, 0) / valid.length;
}

export function calcMTTRFromChamados(
  chamados: { created_at: string; concluido_em: string | null; status: ChamadoStatus; os_status: string | null }[],
): number | null {
  const durations: number[] = [];
  for (const c of chamados) {
    if (isCancelado(c.status)) continue;
    if (!c.concluido_em) continue;
    if (!c.os_status) continue;
    if (c.status !== "resolvido" && c.status !== "concluido") continue;
    const d = calcTempoResolucaoMs(c.created_at, c.concluido_em);
    if (d !== null) durations.push(d);
  }
  return calcMTTRMs(durations);
}

export function calcMTBFIntervalsMs(intervalsMs: number[]): number | null {
  const valid = intervalsMs.filter((d) => Number.isFinite(d) && d >= 0);
  if (valid.length < 2) return null; // precisa >=3 falhas = 2 intervalos
  return valid.reduce((s, d) => s + d, 0) / valid.length;
}

// ---------------------------------------------------------------------------
// Custos — congelado em BLOCO A
// ---------------------------------------------------------------------------

export function calcCustoOS(
  custoMaoObra: number,
  custoOutros: number,
  servicosValor: number,
  consumoValor: number,
): number {
  return Number(custoMaoObra ?? 0) + Number(custoOutros ?? 0) + Number(servicosValor ?? 0) + Number(consumoValor ?? 0);
}

// ---------------------------------------------------------------------------
// Reincidência — mesmo ativo + mesma categoria (ocorrência) + 90d
// ---------------------------------------------------------------------------

export function isReincidencia(
  ativoId: string,
  categoriaOcorrencia: string | null, // chamdos.categoria, NÃO ativos.categoria_id
  createdAt: string,
  historico: { ativo_id: string; categoria: string | null; concluido_em: string | null }[],
  janelaDias = 90,
): boolean {
  const janelaMs = janelaDias * 86400000;
  const curMs = new Date(createdAt).getTime();
  for (const h of historico) {
    if (h.ativo_id !== ativoId) continue;
    if (!h.concluido_em) continue;
    // se categoria da ocorrência ausente, heurística: só ativo_id com * heurística
    // documentar limitação quando categoria null
    if (categoriaOcorrencia && h.categoria && categoriaOcorrencia !== h.categoria) continue;
    const prevMs = new Date(h.concluido_em).getTime();
    if (curMs > prevMs && curMs - prevMs < janelaMs) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Períodos — America/Sao_Paulo (IANA)
// ---------------------------------------------------------------------------

export function getPeriodoRangeBRT(
  periodo: PeriodoId,
  hoje: Date = new Date(),
  personalizado?: { inicio: string; fim: string }, // YYYY-MM-DD
): { inicio: Date; fim: Date } {
  const tz = "America/Sao_Paulo";
  const toZonedMidnightUTC = (d: Date): Date => {
    // 00:00 em America/Sao_Paulo → UTC
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    // construir 00:00 BRT e converter para UTC via Date.UTC com offset
    // aproximação: 00:00 BRT = 03:00 UTC (BRT é UTC-3, sem DST)
    // para DST futuro, usar Intl com hour, mas aqui simplificamos com 03:00
    // Documentado como America/Sao_Paulo, não offset hardcoded -3
    const utcForBRTMidnight = new Date(Date.UTC(y, m - 1, day, 3, 0, 0, 0));
    // Ajustar se DST (Intl pode dizer offset diferente, mas BR não tem DST desde 2019)
    return utcForBRTMidnight;
  };

  const hojeBRTMidnightUTC = toZonedMidnightUTC(hoje);
  const addDaysUTC = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

  if (periodo === "personalizado" && personalizado) {
    const inicio = new Date(personalizado.inicio + "T03:00:00.000Z");
    const fim = new Date(personalizado.fim + "T03:00:00.000Z");
    return { inicio, fim: addDaysUTC(fim, 1) };
  }

  const dias = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : periodo === "30d" ? 30 : periodo === "90d" ? 90 : 365;
  const inicio = addDaysUTC(hojeBRTMidnightUTC, -(dias - 1));
  const fim = addDaysUTC(hojeBRTMidnightUTC, 1);
  return { inicio, fim };
}

// ---------------------------------------------------------------------------
// Disponibilidade — BLOCO A: estrutura pronta, sem cálculo falso
// ---------------------------------------------------------------------------

export function calcDisponibilidade(
  historico: { status: string; created_at: string }[],
  periodo: { inicio: Date; fim: Date },
): { value: number | null; state: "ok" | "insufficient_data" } {
  if (historico.length === 0) return { value: null, state: "insufficient_data" };
  // Se não há histórico cobrindo o início do período, não assumir Operacional
  const primeiro = historico[0];
  if (new Date(primeiro.created_at) > periodo.inicio) {
    return { value: null, state: "insufficient_data" };
  }
  // Cálculo real seria SUM(tempo disponível)/tempo total — não implementado no BLOCO A
  return { value: null, state: "insufficient_data" };
}
