/**
 * Tipos das linhas do banco (espelham `schema.sql`).
 * Usados nas ETAPAs 3–5 (QR público, dashboard, compras e relatórios).
 */

export type ChamadoStatus = "aberto" | "em_andamento" | "concluido";

export interface Ativo {
  id: string;
  nome: string;
  localizacao: string | null;
  qr_code_hash: string;
  created_at: string;
}

export interface Chamado {
  id: string;
  ativo_id: string;
  solicitante: string;
  descricao: string;
  status: ChamadoStatus;
  fotos_antes: string[];
  fotos_depois: string[];
  created_at: string;
  concluido_em: string | null;
}

export interface Compra {
  id: string;
  chamado_id: string | null;
  item: string;
  quantidade: number;
  valor_unitario: number;
  /** Calculado automaticamente pelo banco (quantidade * valor_unitario). */
  valor_total: number;
  setor: string | null;
  data_compra: string;
  created_at: string;
}

/** Chamado com o ativo relacionado (detalhe da OS / dashboard). */
export interface ChamadoComAtivo extends Chamado {
  ativos: Ativo;
}

/**
 * SGA-M v2.0 (Fase 1) — tipos da expansão (espelham `schema_v2.sql`).
 * Fase 3 consome SolicitacaoCompra (aprovações); Fase 4 consome AuditoriaLog.
 */

export type SolicitacaoCompraStatus =
  | "pendente"
  | "aprovado"
  | "rejeitado"
  | "comprado";

export interface SolicitacaoCompra {
  id: string;
  setor: string;
  solicitante: string;
  item: string;
  justificativa: string;
  quantidade: number;
  valor_estimado: number;
  status: SolicitacaoCompraStatus;
  qr_code_hash: string;
  created_at: string;
  updated_at: string;
}

export type AuditoriaAcao = "INSERT" | "UPDATE" | "DELETE";

export interface AuditoriaLog {
  id: string;
  tabela: string;
  registro_id: string;
  acao: AuditoriaAcao;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  executado_por: string;
  created_at: string;
}
