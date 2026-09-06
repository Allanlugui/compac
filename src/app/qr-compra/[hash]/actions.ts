"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { gerarTokenPublico } from "@/lib/tokens";

export interface CriarSolicitacaoInput {
  /** Token de entrada da org (`?t=`), resolvido no servidor. Nunca org_id. */
  tokenOrg: string;
  setor: string;
  solicitante: string;
  item: string;
  quantidade: number;
  justificativa: string;
  valorEstimado: number;
}

export type CriarSolicitacaoResult =
  | { ok: true; id: string; hash: string }
  | { ok: false; error: string };

/**
 * Solicitação pública de compra. A org é resolvida do `tokenOrg` no
 * servidor (service) — o cliente nunca escolhe tenant. Insert via anon
 * (RLS `solic_insert_publico`); audit via service (anon sem INSERT).
 * Hash de acompanhamento: 24 chars (~140 bits).
 */
export async function criarSolicitacao(
  input: CriarSolicitacaoInput,
): Promise<CriarSolicitacaoResult> {
  const setor = input.setor.trim();
  const solicitante = input.solicitante.trim();
  const item = input.item.trim();
  const justificativa = input.justificativa.trim();
  const quantidade = Number(input.quantidade);
  const valorEstimado = Number(input.valorEstimado);

  if (setor.length < 2 || setor.length > 80) {
    return { ok: false, error: "Setor/unidade: 2 a 80 caracteres." };
  }
  if (solicitante.length < 2 || solicitante.length > 120) {
    return { ok: false, error: "Informe seu nome (2 a 120 caracteres)." };
  }
  if (item.length < 2 || item.length > 160) {
    return { ok: false, error: "Item: 2 a 160 caracteres." };
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1_000_000) {
    return { ok: false, error: "Quantidade deve ser maior que zero." };
  }
  if (justificativa.length < 5 || justificativa.length > 2000) {
    return { ok: false, error: "Justifique o pedido (5 a 2000 caracteres)." };
  }
  if (!Number.isFinite(valorEstimado) || valorEstimado < 0) {
    return { ok: false, error: "Valor estimado inválido." };
  }
  if (!input.tokenOrg || input.tokenOrg.length < 16) {
    return { ok: false, error: "Código de entrada inválido. Use o QR da sua unidade." };
  }

  const svc = createServiceClient();
  const { data: org } = await svc
    .from("organizations")
    .select("id, nome")
    .eq("entry_token", input.tokenOrg)
    .maybeSingle();
  if (!org) {
    return { ok: false, error: "Código de entrada inválido. Use o QR da sua unidade." };
  }
  const orgId = org.id as string;

  const supabase = await createClient();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const qr_code_hash = gerarTokenPublico(24);
    const { data, error } = await supabase
      .from("solicitacoes_compra")
      .insert({
        organization_id: orgId,
        setor,
        solicitante,
        item,
        quantidade,
        justificativa,
        valor_estimado: valorEstimado,
        qr_code_hash,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code !== "23505") {
        return { ok: false, error: "Não foi possível registrar. Tente novamente." };
      }
      continue;
    }
    if (!data) {
      return { ok: false, error: "Não foi possível registrar. Tente novamente." };
    }

    const id = data.id as string;
    await svc.from("auditoria_logs").insert({
      tabela: "solicitacoes_compra",
      registro_id: id,
      acao: "INSERT",
      dados_anteriores: null,
      dados_novos: { setor, solicitante, item, quantidade, status: "pendente" },
      executado_por: solicitante,
      organization_id: orgId,
    });

    return { ok: true, id, hash: qr_code_hash };
  }

  return { ok: false, error: "Tente novamente em instantes." };
}

/** Nome público da org para exibir no formulário (sem listar tenants). */
export async function resolverOrgToken(
  token: string,
): Promise<{ ok: true; nome: string } | { ok: false }> {
  if (!token || token.length < 16) return { ok: false };
  const svc = createServiceClient();
  const { data } = await svc
    .from("organizations")
    .select("nome")
    .eq("entry_token", token)
    .maybeSingle();
  if (!data) return { ok: false };
  return { ok: true, nome: data.nome as string };
}
