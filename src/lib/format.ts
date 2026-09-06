/** Utilidades de formatação pt-BR (reutilizadas no dashboard, chamado e OS). */

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formata datas `date` do Postgres ("YYYY-MM-DD") sem deslocamento de fuso:
 * meio-dia evita que o UTC-3 exiba o dia anterior.
 */
export function formatarData(iso: string): string {
  const normalizado = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return new Date(normalizado).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(valor: number): string {
  return formatoMoeda.format(Number.isFinite(valor) ? valor : 0);
}

/** Duração legível entre abertura e conclusão (ou agora, se em aberto). */
export function formatarDuracao(
  inicioIso: string,
  fimIso?: string | null,
): string {
  const ms = +new Date(fimIso ?? new Date().toISOString()) - +new Date(inicioIso);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutos = Math.floor(ms / 60000);
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const min = minutos % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${min}min`;
  return `${min}min`;
}

/** Número curto da OS a partir do UUID do chamado. */
export function numeroOS(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Média de milissegundos formatada (tempo médio de atendimento). */
export function formatarDuracaoMedia(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const horas = ms / 3600000;
  if (horas >= 48) return `${(horas / 24).toFixed(1).replace(".", ",")} dias`;
  if (horas >= 1) return `${horas.toFixed(1).replace(".", ",")} h`;
  return `${Math.max(1, Math.round(ms / 60000))} min`;
}

const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "2026-09" → "set/2026" (rótulos de gráficos e tabelas). */
export function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  if (!ano || !mes || mes < 1 || mes > 12) return chave;
  return `${MESES_PT[mes - 1]}/${ano}`;
}
