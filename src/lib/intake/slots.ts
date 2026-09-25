import type {
  EntradaIntake,
  IntencaoIntake,
  Respostas,
  SessaoIntake,
  SlotDef,
} from "./types";

/**
 * BLOCO 2 — Definições de slots por intenção.
 * Regra de contexto (§13 do briefing): nunca perguntar o que o QR/link
 * já identificou. `quando` implementa o pulo; o resto é declarativo.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const TIPOS_PROBLEMA = [
  "nao_liga",
  "vazamento",
  "quebrado",
  "ruido_anormal",
  "superaquecimento",
  "falta_material",
  "outro",
] as const;

const URGENCIAS = ["baixa", "media", "alta", "critica"] as const;

function baseComum(): SlotDef[] {
  return [
    { id: "solicitante_nome", rotulo: "Quem está solicitando? (nome)", tipo: "texto", obrigatorio: true, min: 2, max: 120 },
    { id: "contato_email", rotulo: "E-mail para acompanhamento", tipo: "email", obrigatorio: true },
    { id: "contato_telefone", rotulo: "Telefone (opcional)", tipo: "telefone", obrigatorio: false },
  ];
}

function slotConfirmacao(): SlotDef {
  return { id: "confirmacao", rotulo: "Confirmar envio", tipo: "confirmacao", obrigatorio: true };
}

const SLOTS_MANUTENCAO: SlotDef[] = [
  ...baseComum(),
  {
    id: "localidade_id",
    rotulo: "Onde aconteceu? (localidade)",
    tipo: "texto",
    obrigatorio: true,
    min: 1,
    max: 80,
    quando: (entrada) => !entrada.localidadeId,
  },
  {
    id: "ativo_id",
    rotulo: "Qual ativo/equipamento?",
    tipo: "texto",
    obrigatorio: false,
    min: 1,
    max: 80,
    quando: (entrada) => !entrada.ativoId,
  },
  { id: "tipo_problema", rotulo: "Tipo de problema", tipo: "opcao", obrigatorio: true, opcoes: [...TIPOS_PROBLEMA] },
  { id: "descricao", rotulo: "Descreva o problema", tipo: "texto", obrigatorio: true, min: 5, max: 2000 },
  { id: "urgencia", rotulo: "Urgência", tipo: "opcao", obrigatorio: true, opcoes: [...URGENCIAS] },
  { id: "fotos", rotulo: "Fotos do problema (opcional)", tipo: "anexo", obrigatorio: false, maxAnexos: 6 },
  { id: "acompanhantes", rotulo: "E-mails para acompanhar (opcional)", tipo: "texto", obrigatorio: false, max: 500 },
  slotConfirmacao(),
];

const SLOTS_COMPRA: SlotDef[] = [
  ...baseComum(),
  { id: "item", rotulo: "Qual item?", tipo: "texto", obrigatorio: true, min: 2, max: 160 },
  { id: "quantidade", rotulo: "Quantidade", tipo: "numero", obrigatorio: true, min: 0.01, max: 1000000 },
  { id: "justificativa", rotulo: "Justificativa", tipo: "texto", obrigatorio: true, min: 5, max: 2000 },
  { id: "urgencia", rotulo: "Urgência", tipo: "opcao", obrigatorio: true, opcoes: [...URGENCIAS] },
  { id: "acompanhantes", rotulo: "E-mails para acompanhar (opcional)", tipo: "texto", obrigatorio: false, max: 500 },
  slotConfirmacao(),
];

export function slotsDaIntencao(intencao: IntencaoIntake): SlotDef[] {
  return intencao === "compra" ? SLOTS_COMPRA : SLOTS_MANUTENCAO;
}

/** Slots visíveis para esta sessão (aplica `quando` com entrada + respostas). */
export function slotsVisiveis(sessao: SessaoIntake): SlotDef[] {
  return slotsDaIntencao(sessao.intencao).filter(
    (s) => !s.quando || s.quando(sessao.entrada, sessao.respostas),
  );
}

/** Próxima pergunta (primeiro slot visível não concluído) ou null. */
export function proximaPergunta(sessao: SessaoIntake): SlotDef | null {
  return slotsVisiveis(sessao).find((s) => !sessao.concluidos.includes(s.id)) ?? null;
}

export function novaSessao(intencao: IntencaoIntake, entrada: EntradaIntake): SessaoIntake {
  return { intencao, entrada, respostas: {}, concluidos: [], confirmada: false };
}

export { EMAIL_RE };
export type { Respostas };
export type { EntradaIntake };
