/**
 * SGA-M — Analytics Types (BLOCO A complemento)
 * Tipos compartilhados para dashboard, relatórios, exportação.
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

export type PeriodoId = "hoje" | "7d" | "30d" | "90d" | "12m" | "personalizado";

export type SlaClass = "dentro" | "proximo" | "atrasado" | "sem_prazo" | "excluido";

export type AnalyticsState = "ok" | "empty" | "insufficient_data" | "no_deadline";

export type AnalyticsResult<T> = {
  value: T | null;
  state: AnalyticsState;
  meta?: { periodo: string; tenant: string; calculatedAt: string };
};

export type ChamadoForAnalytics = {
  id: string;
  organization_id: string;
  ativo_id: string | null;
  status: ChamadoStatus;
  os_status: string | null;
  os_tipo: string | null;
  categoria: string | null;
  created_at: string;
  concluido_em: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  prazo: string | null;
  custo_mao_obra: number;
  custo_outros: number;
};

export type ProdutoForAnalytics = {
  id: string;
  estoque_atual: number;
  estoque_reservado: number;
  estoque_minimo: number;
  ponto_reposicao: number;
  custo_medio: number;
  ultimo_custo: number | null;
};
