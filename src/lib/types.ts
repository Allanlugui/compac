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
