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
  /** FASE 1 (schema_v6): vínculo estrutural — FASE 2 consome. */
  localidade_id: string | null;
  categoria_id: string | null;
}

/** Nível de impacto operacional da ocorrência (5 níveis, schema_v5). */
export type ImpactoOperacional =
  | "baixo"
  | "medio"
  | "alto"
  | "critico"
  | "parada_total";

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
  /** O.S. completa (v3): execução operacional. */
  responsavel: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica" | null;
  prazo: string | null;
  diagnostico: string | null;
  solucao: string | null;
  horimetro: number | null;
  /** Impacto operacional (schema_v5, nullable p/ chamados legados). */
  impacto: ImpactoOperacional | null;
}

export interface Compra {
  id: string;
  chamado_id: string | null;
  fornecedor_id: string | null;
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

export type AuditoriaAcao =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "LOGIN"
  | "LOGOUT"
  | "APPROVAL"
  | "REJECTION"
  | "STOCK_ENTRY"
  | "STOCK_EXIT"
  | "STOCK_ADJUSTMENT"
  | "MEMBERSHIP_CHANGE"
  | "ROLE_CHANGE";

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

/**
 * SGA-M v3 (correção multi-tenant). Role pertence à MEMBERSHIP,
 * nunca global ao usuário. Tipos espelham `schema_v4.sql`.
 */

export type Role =
  | "ADMIN"
  | "GESTOR"
  | "TECNICO"
  | "COMPRAS"
  | "AUDITOR"
  | "SOLICITANTE";

export interface Organization {
  id: string;
  nome: string;
  slug: string;
  created_at: string;
}

export interface Membership {
  id: string;
  organization_id: string;
  user_id: string;
  role: Role;
  status: "ativo" | "inativo";
  /** Setor/departamento POR VÍNCULO (schema_v5, nullable). */
  setor: string | null;
  departamento: string | null;
  created_at: string;
}

export interface Fornecedor {
  id: string;
  organization_id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  categoria: string | null;
  avaliacao: number | null;
  ativo: boolean;
  created_at: string;
}

export interface Produto {
  id: string;
  organization_id: string;
  codigo: string;
  descricao: string;
  categoria: string | null;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
  estoque_maximo: number | null;
  localizacao: string | null;
  fornecedor_id: string | null;
  custo_medio: number;
  ativo: boolean;
  created_at: string;
  /** FASE 1 (schema_v6): categoria estruturada — convive com `categoria` texto. */
  categoria_id: string | null;
}

export type TipoMovimentacao = "entrada" | "saida" | "ajuste" | "reserva" | "consumo";

export interface Movimentacao {
  id: string;
  organization_id: string;
  produto_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  custo_unitario: number;
  chamado_id: string | null;
  compra_id: string | null;
  observacao: string | null;
  executado_por: string;
  created_at: string;
}

export interface ChecklistModelo {
  id: string;
  organization_id: string;
  ativo_id: string | null;
  titulo: string;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  modelo_id: string;
  texto: string;
  obrigatorio: boolean;
  ordem: number;
}

export interface Notificacao {
  id: string;
  organization_id: string;
  user_id: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

/**
 * FASE 1 — fundação de dados (espelha `schema_v6.sql`).
 * Localidades: hierarquia flexível (níveis opcionais).
 * Categorias: `atributos` define dados técnicos sem colunas fixas.
 */

export type TipoLocalidade =
  | "unidade"
  | "predio"
  | "bloco"
  | "andar"
  | "area"
  | "sala";

export interface Localidade {
  id: string;
  organization_id: string;
  nome: string;
  tipo: TipoLocalidade;
  parent_id: string | null;
  created_at: string;
}

export type TipoCategoria = "ativo" | "produto";

export type TipoAtributo = "texto" | "numero" | "selecao" | "data";

export interface AtributoCategoria {
  nome: string;
  tipo: TipoAtributo;
  obrigatorio: boolean;
  unidade?: string;
  opcoes?: string[];
}

export interface Categoria {
  id: string;
  organization_id: string;
  nome: string;
  tipo: TipoCategoria;
  atributos: AtributoCategoria[];
  ativa: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  nome: string | null;
  telefone: string | null;
  cargo: string | null;
  matricula: string | null;
  avatar_url: string | null;
  ultimo_acesso: string | null;
  created_at: string;
}
