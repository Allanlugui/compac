"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import { gerarTokenPublico } from "@/lib/tokens";
import type { StatusSolicitacao } from "@/lib/types";

export type SolResult = { ok: true; id?: string } | { ok: false; error: string };

const TRANSICOES: Record<string, string[]> = {
  rascunho: ["enviada", "cancelada"],
  enviada: ["em_analise", "cancelada"],
  em_analise: ["aprovada", "rejeitada", "cancelada"],
  aprovada: ["em_cotacao", "cancelada"],
  em_cotacao: ["pedido_gerado", "cancelada"],
  pedido_gerado: ["recebida", "cancelada"],
  recebida: ["encerrada"],
  rejeitada: [],
  encerrada: [],
  cancelada: [],
  // Legados (fluxo antigo) → ponte para o novo.
  pendente: ["em_analise", "aprovada", "rejeitada", "cancelada"],
  aprovado: ["em_cotacao", "cancelada"],
  rejeitado: [],
  comprado: ["encerrada"],
};

const PRIORIDADES = ["baixa", "media", "alta", "critica"];
const URGENCIAS = ["baixa", "normal", "alta", "critica"];

function revalidar(id?: string) {
  revalidatePath("/admin/compras/solicitacoes");
  if (id) revalidatePath(`/admin/compras/solicitacoes/${id}`);
  revalidatePath("/admin/compras");
}

async function historico(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  ctx: { orgId: string; userId: string; email: string },
  solicitacaoId: string,
  de: string | null,
  para: string,
  motivo: string | null,
): Promise<void> {
  await supabase.from("solicitacao_historico").insert({
    organization_id: ctx.orgId,
    solicitacao_id: solicitacaoId,
    de,
    para,
    motivo,
    user_id: ctx.userId,
    executado_por: ctx.email,
  });
}

export interface NovoItemInput {
  produto_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  justificativa?: string;
  urgencia?: string;
}

function validarItem(it: NovoItemInput): string | null {
  const desc = (it.descricao ?? "").trim();
  if (desc.length < 2 || desc.length > 200) return "Item: 2 a 200 caracteres.";
  const q = Number(it.quantidade);
  if (!Number.isFinite(q) || q <= 0 || q > 1_000_000) return "Quantidade inválida.";
  if ((it.unidade ?? "").trim().length > 10 || (it.unidade ?? "").trim() === "") return "Unidade inválida.";
  if (it.urgencia && !URGENCIAS.includes(it.urgencia)) return "Urgência inválida.";
  return null;
}

/**
 * Cria solicitação interna (portal/manual/estoque) com itens.
 * Origem estoque = reposição (pré-preenchida pela UI, validada aqui).
 */
export async function criarSolicitacaoInterna(input: {
  solicitante: string;
  setor: string;
  departamento?: string;
  origem: "portal" | "manual" | "estoque";
  prioridade: string;
  centro_custo?: string;
  prazo?: string;
  justificativa: string;
  itens: NovoItemInput[];
}): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "solicitacoes.criar");

  const solicitante = input.solicitante.trim();
  const setor = input.setor.trim();
  if (solicitante.length < 2 || solicitante.length > 120) return { ok: false, error: "Solicitante inválido." };
  if (setor.length < 2 || setor.length > 80) return { ok: false, error: "Setor: 2 a 80 caracteres." };
  if (!["portal", "manual", "estoque"].includes(input.origem)) return { ok: false, error: "Origem inválida." };
  if (!PRIORIDADES.includes(input.prioridade)) return { ok: false, error: "Prioridade inválida." };
  const just = (input.justificativa ?? "").trim();
  if (just.length < 5 || just.length > 2000) return { ok: false, error: "Justificativa: 5 a 2000 caracteres." };
  const itens = (input.itens ?? []).slice(0, 30);
  if (itens.length === 0) return { ok: false, error: "Adicione ao menos 1 item." };
  for (const it of itens) {
    const e = validarItem(it);
    if (e) return { ok: false, error: e };
  }

  const supabase = await createClient();
  // Produtos citados precisam ser da org (snapshot de estoque na leitura).
  for (const it of itens) {
    if (it.produto_id) {
      const { data } = await supabase
        .from("produtos")
        .select("id")
        .eq("id", it.produto_id)
        .eq("organization_id", ctx.orgId)
        .maybeSingle();
      if (!data) return { ok: false, error: "Produto inválido." };
    }
  }

  const prim = itens[0];
  const { data: sol, error } = await supabase
    .from("solicitacoes_compra")
    .insert({
      organization_id: ctx.orgId,
      setor,
      solicitante,
      item: prim.descricao.trim(),
      justificativa: just,
      quantidade: Number(prim.quantidade),
      valor_estimado: 0,
      status: "rascunho",
      qr_code_hash: gerarTokenPublico(24),
      origem: input.origem,
      prioridade: input.prioridade,
      centro_custo: (() => {
        const cc = (input.centro_custo ?? "").trim();
        return cc === "" ? null : cc.slice(0, 80);
      })(),
      prazo: input.prazo && /^\d{4}-\d{2}-\d{2}$/.test(input.prazo) ? input.prazo : null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !sol) return { ok: false, error: "Não foi possível criar." };
  const id = (sol as { id: string }).id;

  const { error: erroItens } = await supabase.from("solicitacao_itens").insert(
    itens.map((it) => ({
      organization_id: ctx.orgId,
      solicitacao_id: id,
      produto_id: it.produto_id || null,
      descricao: it.descricao.trim(),
      quantidade: Number(it.quantidade),
      unidade: (it.unidade || "UN").trim().toUpperCase().slice(0, 10),
      justificativa: (() => {
        const j = (it.justificativa ?? "").trim();
        return j === "" ? null : j.slice(0, 500);
      })(),
      urgencia: it.urgencia && URGENCIAS.includes(it.urgencia) ? it.urgencia : "normal",
    })),
  );
  if (erroItens) {
    await supabase.from("solicitacoes_compra").delete().eq("id", id).eq("organization_id", ctx.orgId);
    return { ok: false, error: "Falha nos itens. Nada foi salvo." };
  }

  await historico(supabase, ctx, id, null, "rascunho", `Criada via ${input.origem}`);
  await registrarLog(supabase, {
    tabela: "solicitacoes_compra", registro_id: id, acao: "REQUEST_CREATED",
    dados_anteriores: null, dados_novos: { setor, itens: itens.length, origem: input.origem },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidar();
  return { ok: true, id };
}

/** Transição do workflow (mapa fechado + histórico append-only). */
export async function transicaoSolicitacao(input: {
  id: string;
  para: StatusSolicitacao;
  motivo?: string;
}): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "solicitacoes.aprovar");
  if (!input.id) return { ok: false, error: "Solicitação inválida." };
  const motivo = (input.motivo ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("solicitacoes_compra")
    .select("status")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Solicitação não encontrada." };
  const de = (atual as { status: string }).status;
  if (!(TRANSICOES[de] ?? []).includes(input.para)) {
    return { ok: false, error: `Transição inválida: ${de} → ${input.para}.` };
  }
  // Aprovar/rejeitar exigem motivo? Rejeitar sim.
  if ((input.para === "rejeitada" || input.para === "rejeitado") && !motivo) {
    return { ok: false, error: "Rejeição exige motivo." };
  }

  const patch: Record<string, unknown> = { status: input.para };
  if (input.para === "aprovada" || input.para === "aprovado") {
    patch.aprovado_por = ctx.email;
    patch.aprovado_em = new Date().toISOString();
    patch.decisao_obs = motivo;
  }
  if (input.para === "rejeitada" || input.para === "rejeitado") {
    patch.decisao_obs = motivo;
  }

  const { error } = await supabase
    .from("solicitacoes_compra")
    .update(patch)
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível avançar." };

  await historico(supabase, ctx, input.id, de, input.para, motivo);
  const acao =
    input.para === "aprovada" || input.para === "aprovado" ? "REQUEST_APPROVED"
    : input.para === "rejeitada" || input.para === "rejeitado" ? "REQUEST_REJECTED"
    : "STATUS_CHANGE";
  await registrarLog(supabase, {
    tabela: "solicitacoes_compra", registro_id: input.id, acao: acao as "REQUEST_APPROVED",
    dados_anteriores: { status: de }, dados_novos: { status: input.para, motivo },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidar(input.id);
  return { ok: true };
}

/**
 * APROVAÇÃO com segregação (§18): quem solicitou não aprova a própria
 * (salvo ADMIN). Aplica-se a aprovada/rejeitada.
 */
export async function decidirSolicitacao(input: {
  id: string;
  decisao: "aprovada" | "rejeitada";
  motivo?: string;
}): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "solicitacoes.aprovar");

  const supabase = await createClient();
  const { data: sol } = await supabase
    .from("solicitacoes_compra")
    .select("created_by")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitação não encontrada." };
  if ((sol as { created_by: string | null }).created_by === ctx.userId && ctx.role !== "ADMIN") {
    return { ok: false, error: "Segregação: quem solicitou não aprova a própria solicitação." };
  }
  return transicaoSolicitacao({ id: input.id, para: input.decisao, motivo: input.motivo });
}

/** Envia rascunho para análise (solicitante/produtor). */
export async function enviarSolicitacao(input: { id: string }): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "solicitacoes.criar");

  const supabase = await createClient();
  const { data: sol } = await supabase
    .from("solicitacoes_compra")
    .select("status")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitação não encontrada." };
  const st = (sol as { status: string }).status;
  if (st !== "rascunho") return { ok: false, error: "Só rascunho pode ser enviado." };

  const { count } = await supabase
    .from("solicitacao_itens")
    .select("id", { count: "exact", head: true })
    .eq("solicitacao_id", input.id)
    .eq("organization_id", ctx.orgId);
  if (!count) return { ok: false, error: "Adicione itens antes de enviar." };

  const { error } = await supabase
    .from("solicitacoes_compra")
    .update({ status: "enviada" })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível enviar." };
  await historico(supabase, ctx, input.id, st, "enviada", null);
  revalidar(input.id);
  return { ok: true };
}

/** Adiciona item (só antes da aprovação). */
export async function adicionarItem(input: { solicitacaoId: string } & NovoItemInput): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "solicitacoes.criar");
  const e = validarItem(input);
  if (e) return { ok: false, error: e };

  const supabase = await createClient();
  const { data: sol } = await supabase
    .from("solicitacoes_compra")
    .select("status")
    .eq("id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitação não encontrada." };
  if (!["rascunho", "enviada", "em_analise", "pendente"].includes((sol as { status: string }).status)) {
    return { ok: false, error: "Itens só antes da aprovação." };
  }
  if (input.produto_id) {
    const { data: p } = await supabase
      .from("produtos")
      .select("id")
      .eq("id", input.produto_id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!p) return { ok: false, error: "Produto inválido." };
  }

  const { error } = await supabase.from("solicitacao_itens").insert({
    organization_id: ctx.orgId,
    solicitacao_id: input.solicitacaoId,
    produto_id: input.produto_id || null,
    descricao: input.descricao.trim(),
    quantidade: Number(input.quantidade),
    unidade: (input.unidade || "UN").trim().toUpperCase().slice(0, 10),
    justificativa: (() => {
      const j = (input.justificativa ?? "").trim();
      return j === "" ? null : j.slice(0, 500);
    })(),
    urgencia: input.urgencia && URGENCIAS.includes(input.urgencia) ? input.urgencia : "normal",
  });
  if (error) return { ok: false, error: "Não foi possível adicionar." };
  revalidar(input.solicitacaoId);
  return { ok: true };
}

/** Remove item (só antes da aprovação). */
export async function removerItem(input: { id: string; solicitacaoId: string }): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "solicitacoes.criar");

  const supabase = await createClient();
  const { data: sol } = await supabase
    .from("solicitacoes_compra")
    .select("status")
    .eq("id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitação não encontrada." };
  if (!["rascunho", "enviada", "em_analise", "pendente"].includes((sol as { status: string }).status)) {
    return { ok: false, error: "Itens só antes da aprovação." };
  }
  const { error } = await supabase
    .from("solicitacao_itens")
    .delete()
    .eq("id", input.id)
    .eq("solicitacao_id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível remover." };
  revalidar(input.solicitacaoId);
  return { ok: true };
}

/** Registra cotação de fornecedor (da org) para a solicitação. */
export async function registrarCotacao(input: {
  solicitacaoId: string;
  fornecedor_id: string;
  valor: number;
  prazo_dias?: number | null;
  condicoes?: string;
  observacoes?: string;
}): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.cotar");
  if (!input.solicitacaoId || !input.fornecedor_id) {
    return { ok: false, error: "Dados inválidos." };
  }
  const valor = Number(input.valor);
  if (!Number.isFinite(valor) || valor < 0 || valor > 100_000_000) {
    return { ok: false, error: "Valor inválido." };
  }

  const supabase = await createClient();
  const [{ data: sol }, { data: forn }] = await Promise.all([
    supabase.from("solicitacoes_compra").select("id").eq("id", input.solicitacaoId).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("fornecedores").select("id").eq("id", input.fornecedor_id).eq("organization_id", ctx.orgId).maybeSingle(),
  ]);
  if (!sol) return { ok: false, error: "Solicitação não encontrada." };
  if (!forn) return { ok: false, error: "Fornecedor inválido." };

  const { data, error } = await supabase
    .from("cotacoes")
    .insert({
      organization_id: ctx.orgId,
      solicitacao_id: input.solicitacaoId,
      fornecedor_id: input.fornecedor_id,
      valor,
      prazo_dias: input.prazo_dias ?? null,
      condicoes: (() => {
        const c = (input.condicoes ?? "").trim();
        return c === "" ? null : c.slice(0, 500);
      })(),
      observacoes: (() => {
        const o = (input.observacoes ?? "").trim();
        return o === "" ? null : o.slice(0, 500);
      })(),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível registrar." };

  await registrarLog(supabase, {
    tabela: "cotacoes", registro_id: (data as { id: string }).id, acao: "QUOTE_CREATED",
    dados_anteriores: null, dados_novos: { solicitacao_id: input.solicitacaoId, valor },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidar(input.solicitacaoId);
  return { ok: true, id: (data as { id: string }).id };
}

/** Marca cotação vencedora (uma por solicitação). */
export async function definirVencedora(input: { cotacaoId: string; solicitacaoId: string }): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.cotar");

  const supabase = await createClient();
  const { data: cot } = await supabase
    .from("cotacoes")
    .select("id")
    .eq("id", input.cotacaoId)
    .eq("solicitacao_id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!cot) return { ok: false, error: "Cotação não encontrada." };

  await supabase
    .from("cotacoes")
    .update({ vencedora: false })
    .eq("solicitacao_id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId);
  const { error } = await supabase
    .from("cotacoes")
    .update({ vencedora: true })
    .eq("id", input.cotacaoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível definir." };
  revalidar(input.solicitacaoId);
  return { ok: true };
}

/** Anexo da solicitação (PDF/foto, Storage privado). */
export async function uploadAnexoSolicitacao(input: {
  solicitacaoId: string;
  file: File;
  nome?: string;
}): Promise<SolResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "solicitacoes.criar");

  const permitidos = new Set([
    "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif",
  ]);
  if (!permitidos.has(input.file.type)) return { ok: false, error: "Apenas PDF ou fotos." };
  if (input.file.size <= 0 || input.file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Arquivo excede 10 MB." };
  }

  const supabase = await createClient();
  const { data: sol } = await supabase
    .from("solicitacoes_compra")
    .select("id")
    .eq("id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitação não encontrada." };

  const nome = ((input.nome ?? input.file.name).trim() || "anexo").slice(0, 160);
  const path = `o/${ctx.orgId}/solicitacoes/${input.solicitacaoId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}-${nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60)}`;

  const svc = createServiceClient();
  const { error: up } = await svc.storage
    .from("manutencao-midia")
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (up) return { ok: false, error: "Falha no envio." };

  const { error } = await supabase.from("solicitacao_anexos").insert({
    organization_id: ctx.orgId,
    solicitacao_id: input.solicitacaoId,
    nome,
    path,
    tamanho_bytes: input.file.size,
    mime: input.file.type,
  });
  if (error) {
    await svc.storage.from("manutencao-midia").remove([path]);
    return { ok: false, error: "Não foi possível registrar." };
  }
  revalidar(input.solicitacaoId);
  return { ok: true };
}
