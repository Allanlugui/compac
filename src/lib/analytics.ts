/**
 * SGA-M — Camada analítica pura (BLOCO A).
 * Funções determinísticas, sem I/O, sem dados fictícios.
 * Todas as fórmulas documentadas em ANALYTICS_SPEC.md.
 * Usadas por dashboard, relatórios, exportação e testes.
 */

export type OsStatus =
  | "aberta"
  | "planejada"
  | "atribuida"
  | "em_execucao"
  | "aguardando_peca"
  | "aguardando_terceiro"
  | "em_validacao"
  | "concluida"
  | "encerrada";

export type ChamadoStatus =
  | "aberto"
  | "em_triagem"
  | "aguardando_informacao"
  | "convertido_os"
  | "em_andamento"
  | "concluido"
  | "resolvido"
  | "cancelado";

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
// Estoque
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

// ---------------------------------------------------------------------------
// SLA
// ---------------------------------------------------------------------------

export type SlaClass = "dentro" | "proximo" | "atrasado" | "sem_prazo" | "excluido";

export function classificarSLA(
  prazo: string | null, // YYYY-MM-DD
  concluidoEm: string | null, // ISO
  osStatus: string | null,
  hojeISO: string, // YYYY-MM-DD BRT
): SlaClass {
  if (!prazo) return "sem_prazo";
  // cancelado é excluído de SLA — caller deve filtrar, mas aqui tratamos
  // se já concluída/encerrada, classifica por concluidoEm vs prazo
  if (concluidoEm) {
    const concluidoDate = concluidoEm.slice(0, 10);
    return concluidoDate <= prazo ? "dentro" : "atrasado";
  }
  if (osStatus === "concluida" || osStatus === "encerrada") return "dentro";
  // ainda aberta
  if (prazo < hojeISO) return "atrasado";
  // próximo: vence em 0-2 dias
  const diffDays = Math.floor((new Date(prazo).getTime() - new Date(hojeISO).getTime()) / 86400000);
  if (diffDays >= 0 && diffDays <= 2) return "proximo";
  return "dentro";
}

// ---------------------------------------------------------------------------
// MTTR / MTBF
// ---------------------------------------------------------------------------

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
    if (!c.os_status) continue; // só O.S.
    if (c.status !== "resolvido" && c.status !== "concluido") continue;
    const d = new Date(c.concluido_em).getTime() - new Date(c.created_at).getTime();
    if (Number.isFinite(d) && d >= 0) durations.push(d);
  }
  return calcMTTRMs(durations);
}

export function calcMTBFIntervalsMs(intervalsMs: number[]): number | null {
  const valid = intervalsMs.filter((d) => Number.isFinite(d) && d >= 0);
  if (valid.length === 0) return null;
  if (valid.length < 2) return null; // precisa >=3 falhas para >=2 intervalos
  return valid.reduce((s, d) => s + d, 0) / valid.length;
}

// ---------------------------------------------------------------------------
// Custos
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
// Reincidência
// ---------------------------------------------------------------------------

export function isReincidencia(
  ativoId: string,
  categoria: string | null,
  createdAt: string,
  historico: { ativo_id: string; categoria: string | null; concluido_em: string | null }[],
  janelaDias = 90,
): boolean {
  const janelaMs = janelaDias * 86400000;
  const curMs = new Date(createdAt).getTime();
  for (const h of historico) {
    if (h.ativo_id !== ativoId) continue;
    if (!h.concluido_em) continue;
    // categoria igual quando ambas preenchidas; se categoria nula, considera só ativo (documentar heurística)
    if (categoria && h.categoria && categoria !== h.categoria) continue;
    const prevMs = new Date(h.concluido_em).getTime();
    if (curMs > prevMs && curMs - prevMs < janelaMs) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Períodos
// ---------------------------------------------------------------------------

export type PeriodoId = "hoje" | "7d" | "30d" | "90d" | "12m" | "personalizado";

export function getPeriodoRangeBRT(
  periodo: PeriodoId,
  hoje: Date = new Date(),
  personalizado?: { inicio: string; fim: string }, // YYYY-MM-DD
): { inicio: Date; fim: Date } {
  // BRT = UTC-3 (sem horário de verão desde 2019)
  const toBRTMidnightUTC = (d: Date) => {
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    // 00:00 BRT = 03:00 UTC
    return new Date(Date.UTC(y, m, day, 3, 0, 0, 0));
  };
  const hojeBRTMidnightUTC = toBRTMidnightUTC(hoje);
  const addDaysUTC = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

  if (periodo === "personalizado" && personalizado) {
    const inicio = new Date(personalizado.inicio + "T03:00:00.000Z");
    const fim = new Date(personalizado.fim + "T03:00:00.000Z");
    // fim exclusivo: +1 dia
    return { inicio, fim: addDaysUTC(fim, 1) };
  }

  const dias = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : periodo === "30d" ? 30 : periodo === "90d" ? 90 : 365;
  const inicio = addDaysUTC(hojeBRTMidnightUTC, -(dias - 1));
  const fim = addDaysUTC(hojeBRTMidnightUTC, 1);
  return { inicio, fim };
}
