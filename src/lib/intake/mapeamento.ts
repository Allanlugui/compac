import type {
  AnexoIntake,
  PayloadChamado,
  PayloadSolicitacao,
  SessaoIntake,
} from "./types";
import { prontaParaCriar } from "./engine";

/**
 * BLOCO 2 — Contratos de criação: sessão confirmada → payload de insert.
 * A camada de persistência (blocos seguintes) executa o insert com os
 * mesmos padrões do fluxo atual (tenant server-side, service role,
 * auditoria best-effort). Nenhum insert acontece aqui.
 */

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function emails(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

function anexos(v: unknown): AnexoIntake[] {
  return Array.isArray(v) ? (v as AnexoIntake[]) : [];
}

/** Monta payload de `chamados`. Exige sessão pronta (erro = contrato violado). */
export function mapearChamado(sessao: SessaoIntake): PayloadChamado {
  if (!prontaParaCriar(sessao)) throw new Error("Sessão não confirmada.");
  const r = sessao.respostas;
  const e = sessao.entrada;
  const partes = [
    str(r.tipo_problema) && `[${str(r.tipo_problema)}]`,
    str(r.descricao),
    str(r.urgencia) && `(urgência: ${str(r.urgencia)})`,
  ].filter(Boolean);

  return {
    organization_id: e.organizacaoId,
    ativo_id: e.ativoId ?? (str(r.ativo_id) || null),
    solicitante: str(r.solicitante_nome),
    descricao: partes.join(" "),
    // Contexto do QR/link tem precedência; resposta manual só quando visível.
    localidade_id: e.localidadeId ?? (str(r.localidade_id) || null),
    departamento_id: e.departamentoId ?? null,
    centro_custo_id: e.centroCustoId ?? null,
    almoxarifado_id: e.almoxarifadoId ?? null,
    contato_email: str(r.contato_email) || null,
    contato_telefone: str(r.contato_telefone) || null,
    urgencia: str(r.urgencia) || null,
    fotos: anexos(r.fotos),
    acompanhantes: emails(r.acompanhantes),
  };
}

/** Monta payload de `solicitacoes_compra` (+ item espelhado pela persistência). */
export function mapearSolicitacao(sessao: SessaoIntake): PayloadSolicitacao {
  if (!prontaParaCriar(sessao)) throw new Error("Sessão não confirmada.");
  const r = sessao.respostas;
  const e = sessao.entrada;

  return {
    organization_id: e.organizacaoId,
    solicitante: str(r.solicitante_nome),
    item: str(r.item),
    quantidade: typeof r.quantidade === "number" ? r.quantidade : 0,
    justificativa: str(r.justificativa),
    centro_custo_id: e.centroCustoId ?? null,
    almoxarifado_id: e.almoxarifadoId ?? null,
    qr_contexto_id: e.qrContextoId ?? null,
    contato_email: str(r.contato_email) || null,
    urgencia: str(r.urgencia) || null,
    acompanhantes: emails(r.acompanhantes),
  };
}
