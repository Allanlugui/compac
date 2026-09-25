/**
 * BLOCO 2 — Intake Engine: tipos e contratos.
 * Motor 100% puro (sem DB, sem IA, sem UI): opera sobre objetos explícitos,
 * testável em milissegundos. Persistência/rotas/LLM vivem nas camadas
 * externas (blocos seguintes). Nenhuma importação server-only aqui.
 */

export type IntencaoIntake = "manutencao" | "compra";

export type TipoEntrada = "manutencao" | "compra";

/**
 * Contexto de entrada — TUDO resolvido server-side antes do motor.
 * organization_id nunca vem do browser; IDs vêm de tokens/links válidos.
 */
export interface EntradaIntake {
  organizacaoId: string;
  tipo: TipoEntrada;
  /** QR de ativo (manutenção). Quando presente, o motor NÃO pergunta o ativo. */
  ativoId?: string | null;
  /** QR de área/contexto. Quando presente, NÃO pergunta localização. */
  localidadeId?: string | null;
  almoxarifadoId?: string | null;
  departamentoId?: string | null;
  centroCustoId?: string | null;
  qrContextoId?: string | null;
  /** Identidade autenticada, quando houver (não obrigatória — visitante anônimo). */
  usuarioId?: string | null;
  /** Rótulos para exibição (resolvidos server-side, nunca autoridade). */
  rotulos?: {
    ativoNome?: string;
    localidadeNome?: string;
  };
}

export type TipoSlot =
  | "texto"
  | "email"
  | "telefone"
  | "numero"
  | "opcao"
  | "confirmacao"
  | "anexo";

export interface SlotDef {
  id: string;
  rotulo: string;
  tipo: TipoSlot;
  obrigatorio: boolean;
  /** Para `opcao`: valores aceitos. Para `texto`: [min,max] chars. Para `numero`: [min,max]. */
  opcoes?: string[];
  min?: number;
  max?: number;
  /** Para `anexo`: quantidade máxima de arquivos. */
  maxAnexos?: number;
  /**
   * Visibilidade contextual: recebe entrada + respostas atuais.
   * Ex.: pular `ativo` quando o QR já identificou.
   */
  quando?: (entrada: EntradaIntake, respostas: Respostas) => boolean;
}

export type Respostas = Record<string, unknown>;

export interface SessaoIntake {
  intencao: IntencaoIntake;
  entrada: EntradaIntake;
  respostas: Respostas;
  /** IDs de slots já respondidos (ordem de coleta). */
  concluidos: string[];
  confirmada: boolean;
}

export interface AnexoIntake {
  nome: string;
  mime: string;
  tamanhoBytes: number;
  /** Path do Storage (`o/{org}/...`), preenchido pela camada de upload — nunca pelo visitante. */
  path?: string;
}

/** Payload pronto para `chamados` (camada de persistência executa o insert). */
export interface PayloadChamado {
  organization_id: string;
  ativo_id: string | null;
  solicitante: string;
  descricao: string;
  localidade_id: string | null;
  departamento_id: string | null;
  centro_custo_id: string | null;
  almoxarifado_id: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  urgencia: string | null;
  fotos: AnexoIntake[];
  acompanhantes: string[];
}

/** Payload pronto para `solicitacoes_compra` + `solicitacao_itens`. */
export interface PayloadSolicitacao {
  organization_id: string;
  solicitante: string;
  item: string;
  quantidade: number;
  justificativa: string;
  centro_custo_id: string | null;
  almoxarifado_id: string | null;
  qr_contexto_id: string | null;
  contato_email: string | null;
  urgencia: string | null;
  acompanhantes: string[];
}
