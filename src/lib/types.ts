/**
 * Tipos das linhas do banco (espelham `schema.sql`).
 * Usados nas ETAPAs 3–5 (QR público, dashboard, compras e relatórios).
 */

/** Status da demanda (chamado). Legados em_andamento/concluido mantidos. */
export type ChamadoStatus =
  | "aberto"
  | "em_andamento"
  | "concluido"
  | "em_triagem"
  | "aguardando_informacao"
  | "convertido_os"
  | "resolvido"
  | "cancelado";

/** Ciclo de vida da O.S. (nulo até a conversão na triagem). */
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

export type OsTipo =
  | "corretiva"
  | "preventiva"
  | "preditiva"
  | "inspecao"
  | "instalacao"
  | "melhoria";

export type OrigemChamado =
  | "qr"
  | "portal"
  | "administrador"
  | "telefone"
  | "email"
  | "importacao";

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

/** Status operacional do ativo (7 estados, schema_v7). */
export type AtivoStatus =
  | "operacional"
  | "em_manutencao"
  | "parado"
  | "em_instalacao"
  | "em_inspecao"
  | "inativo"
  | "desativado";

/** Cadastro completo do ativo (FASE 2, espelha `schema_v7.sql`). */
export interface AtivoCompleto extends Ativo {
  codigo: string | null;
  descricao: string | null;
  numero_serie: string | null;
  patrimonio: string | null;
  tag: string | null;
  fabricante: string | null;
  modelo: string | null;
  status: AtivoStatus;
  criticidade: "baixa" | "media" | "alta" | "critica" | null;
  prioridade_padrao: "baixa" | "media" | "alta" | "critica" | null;
  centro_custo: string | null;
  departamento: string | null;
  responsavel: string | null;
  equipe: string | null;
  fornecedor_id: string | null;
  nota_fiscal: string | null;
  data_aquisicao: string | null;
  valor_aquisicao: number | null;
  data_instalacao: string | null;
  garantia_ate: string | null;
  vida_util_meses: number | null;
  dados_tecnicos: Record<string, string>;
  qr_impresso_em: string | null;
  updated_at: string;
}

export interface AtivoStatusHistorico {
  id: string;
  organization_id: string;
  ativo_id: string;
  de: string | null;
  para: string;
  motivo: string | null;
  user_id: string | null;
  created_at: string;
}

export type CategoriaDocumento =
  | "manual"
  | "ficha_tecnica"
  | "nota_fiscal"
  | "certificado"
  | "laudo"
  | "garantia"
  | "contrato"
  | "desenho"
  | "procedimento"
  | "foto"
  | "outro";

export interface AtivoDocumento {
  id: string;
  organization_id: string;
  ativo_id: string;
  nome: string;
  categoria: CategoriaDocumento;
  path: string;
  tamanho_bytes: number;
  mime: string | null;
  created_at: string;
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
  impacto: ImpactoOperacional | null;
  /** FASE 3 (schema_v10): triagem + O.S. */
  origem: OrigemChamado | null;
  departamento: string | null;
  contato: string | null;
  categoria: string | null;
  subcategoria: string | null;
  criticidade: "baixa" | "media" | "alta" | "critica" | null;
  equipe: string | null;
  supervisor: string | null;
  os_tipo: OsTipo | null;
  os_status: OsStatus | null;
  plano_id: string | null;
  planejamento: string | null;
  ferramentas: string | null;
  previsao_horas: number | null;
  riscos: string | null;
  causa: string | null;
  causa_raiz: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  horimetro_ini: number | null;
  horimetro_fim: number | null;
  horimetro_unidade: "horas" | "km" | "ciclos" | "unidades" | null;
  custo_mao_obra: number;
  custo_outros: number;
  custo_outros_desc: string | null;
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
  | "ROLE_CHANGE"
  | "QR_REGENERATED"
  | "TRIAGEM"
  | "OS_CONCLUIDA"
  | "CHECKLIST_CONCLUIDA"
  | "FOTO_ADICIONADA"
  | "COST_ADDED";

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
  /** Físico. Reservado em `estoque_reservado`; disponível = físico − reservado. */
  estoque_reservado: number;
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

export type TipoMovimentacao = "entrada" | "saida" | "ajuste" | "reserva" | "consumo" | "devolucao";

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

/**
 * FASE 3 (schema_v10): O.S. — status, atividades, serviços, fotos,
 * preventiva. Todas com organization_id (multi-tenant + RLS).
 */

export interface ChecklistItem {
  id: string;
  modelo_id: string;
  texto: string;
  obrigatorio: boolean;
  ordem: number;
  /** FASE 3: tipo de resposta + regras. */
  tipo: "ok_nok" | "sim_nao" | "texto" | "numero" | "selecao" | "data" | "hora" | "foto";
  foto_obrigatoria: boolean;
  obs_obrigatoria: boolean;
  valor_esperado: string | null;
  opcoes: string[];
}

export interface OsStatusHistorico {
  id: string;
  organization_id: string;
  os_id: string;
  de: string | null;
  para: string;
  motivo: string | null;
  user_id: string | null;
  created_at: string;
}

export interface OsAtividade {
  id: string;
  organization_id: string;
  chamado_id: string;
  descricao: string;
  user_id: string | null;
  executado_por: string | null;
  created_at: string;
}

export interface OsServicoExterno {
  id: string;
  organization_id: string;
  chamado_id: string;
  fornecedor_id: string | null;
  servico: string;
  valor: number;
  nota: string | null;
  data_servico: string | null;
  observacao: string | null;
  created_at: string;
}

export interface OsFoto {
  id: string;
  organization_id: string;
  chamado_id: string;
  path: string;
  categoria: "antes" | "durante" | "depois";
  user_id: string | null;
  created_at: string;
}

export type FrequenciaPreventiva = "dias" | "semanas" | "meses" | "horas" | "ciclos";

export interface PlanoManutencao {
  id: string;
  organization_id: string;
  ativo_id: string;
  tipo: OsTipo;
  atividade: string;
  frequencia: number;
  unidade: FrequenciaPreventiva;
  responsavel: string | null;
  checklist_modelo_id: string | null;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  tolerancia_dias: number;
  prioridade: "baixa" | "media" | "alta" | "critica" | null;
  ativo: boolean;
  created_at: string;
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
