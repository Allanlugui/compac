"use server";

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
  // Token pode ser da org (genérico) ou de um contexto (unidade/setor).
  let orgId: string | null = null;
  let contextoId: string | null = null;
  let ctxSetor: string | null = null;
  let ctxCentro: string | null = null;
  let ctxLoc: string | null = null;
  let ctxDepto: string | null = null;
  let ctxCc: string | null = null;
  let ctxAlmox: string | null = null;
  const { data: org } = await svc
    .from("organizations")
    .select("id, nome")
    .eq("entry_token", input.tokenOrg)
    .maybeSingle();
  if (org) {
    orgId = org.id as string;
  } else {
    // Select completo (pós-v26) com recuo legado (pré-v26: colunas inexistentes).
    const colunas = "id, organization_id, setor, centro_custo, localidade_id, departamento_id, centro_custo_id, almoxarifado_id, organizations!inner(nome)";
    let context: unknown = null;
    const tentativa = await svc
      .from("qr_contextos")
      .select(colunas)
      .eq("token", input.tokenOrg)
      .eq("ativo", true)
      .maybeSingle();
    if (!tentativa.error) {
      context = tentativa.data;
    } else {
      const legado = await svc
        .from("qr_contextos")
        .select("id, organization_id, setor, centro_custo, organizations!inner(nome)")
        .eq("token", input.tokenOrg)
        .eq("ativo", true)
        .maybeSingle();
      context = legado.data ?? null;
    }
    const c = context as unknown as {
      id: string;
      organization_id: string;
      setor: string | null;
      centro_custo: string | null;
      localidade_id: string | null;
      departamento_id: string | null;
      centro_custo_id: string | null;
      almoxarifado_id: string | null;
      organizations: { nome: string };
    } | null;
    if (c) {
      orgId = c.organization_id;
      contextoId = c.id ?? null;
      ctxSetor = c.setor;
      ctxCentro = c.centro_custo;
      // Pré-v26: colunas inexistentes retornam undefined → null (legado).
      ctxLoc = c.localidade_id ?? null;
      ctxDepto = c.departamento_id ?? null;
      ctxCc = c.centro_custo_id ?? null;
      ctxAlmox = c.almoxarifado_id ?? null;
    }
  }
  if (!orgId) {
    return { ok: false, error: "Código de entrada inválido. Use o QR da sua unidade." };
  }

  // INSERT principal via SERVICE (server-side): o driver JS pede RETURNING
  // por padrão e o RETURNING exige policy de SELECT, que anon não tem
  // (nem deve ter). Tenant já resolvido do token; sem SELECT envolvido.
  // UUID + hash gerados no servidor ANTES do insert.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = crypto.randomUUID();
    const qr_code_hash = gerarTokenPublico(24);
    const { error } = await svc
      .from("solicitacoes_compra")
      .insert({
        id,
        organization_id: orgId,
        setor: contextoId && ctxSetor ? ctxSetor : setor,
        solicitante,
        item,
        quantidade,
        justificativa,
        valor_estimado: valorEstimado,
        qr_code_hash,
        centro_custo: ctxCentro,
        // Omitidos quando null: insert válido pré-v26.
        ...(contextoId ? { qr_contexto_id: contextoId } : {}),
        ...(ctxLoc ? { localidade_id: ctxLoc } : {}),
        ...(ctxDepto ? { departamento_id: ctxDepto } : {}),
        ...(ctxCc ? { centro_custo_id: ctxCc } : {}),
        ...(ctxAlmox ? { almoxarifado_id: ctxAlmox } : {}),
      });

    if (error) {
      // Log server-side controlado (sem segredos); usuário vê msg genérica.
      console.error(
        "[qr-compra] insert solicitacao:",
        error.code ?? "?",
        (error.message ?? "").slice(0, 200),
      );
      if (error.code !== "23505") {
        return { ok: false, error: "Não foi possível registrar. Tente novamente." };
      }
      continue;
    }

    // Item espelhado (detalhe interno lista itens). Falha aqui compensa:
    // apaga a solicitação para não afirmar sucesso parcial.
    const { error: itemError } = await svc.from("solicitacao_itens").insert({
      organization_id: orgId,
      solicitacao_id: id,
      produto_id: null,
      descricao: item,
      quantidade,
      unidade: "UN",
      justificativa,
      urgencia: "normal",
    });
    if (itemError) {
      console.error(
        "[qr-compra] insert item:",
        itemError.code ?? "?",
        (itemError.message ?? "").slice(0, 200),
      );
      await svc.from("solicitacoes_compra").delete().eq("id", id);
      return { ok: false, error: "Não foi possível registrar. Tente novamente." };
    }

    // Auditoria best-effort documentada: falha não desfaz a operação,
    // só registra no log do servidor (sem detalhes ao usuário).
    const { error: auditError } = await svc.from("auditoria_logs").insert({
      tabela: "solicitacoes_compra",
      registro_id: id,
      acao: "INSERT",
      dados_anteriores: null,
      dados_novos: { setor, solicitante, item, quantidade, status: "pendente", qr_contexto_id: contextoId, centro_custo: ctxCentro },
      executado_por: solicitante,
      organization_id: orgId,
    });
    if (auditError) {
      console.error(
        "[qr-compra] insert audit:",
        auditError.code ?? "?",
        (auditError.message ?? "").slice(0, 200),
      );
    }

    return { ok: true, id, hash: qr_code_hash };
  }

  return { ok: false, error: "Tente novamente em instantes." };
}

/** Nome público da org + contexto (sem listar tenants). */
export async function resolverOrgToken(
  token: string,
): Promise<
  | { ok: true; nome: string; contexto: null }
  | { ok: true; nome: string; contexto: { nome: string; setor: string | null; centro_custo: string | null } }
  | { ok: false }
> {
  if (!token || token.length < 16) return { ok: false };
  const svc = createServiceClient();
  const { data: org } = await svc
    .from("organizations")
    .select("nome")
    .eq("entry_token", token)
    .maybeSingle();
  if (org) return { ok: true, nome: org.nome as string, contexto: null };
  const { data: context } = await svc
    .from("qr_contextos")
    .select("nome, setor, centro_custo, organization_id, organizations!inner(nome)")
    .eq("token", token)
    .eq("ativo", true)
    .maybeSingle();
  const c = context as unknown as {
    nome: string; setor: string | null; centro_custo: string | null;
    organizations: { nome: string };
  } | null;
  if (!c) return { ok: false };
  return {
    ok: true,
    nome: c.organizations.nome,
    contexto: { nome: c.nome, setor: c.setor, centro_custo: c.centro_custo },
  };
}
