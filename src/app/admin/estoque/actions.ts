"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import { notificar } from "@/app/admin/notificacoes/actions";
import type { TipoMovimentacao } from "@/lib/types";

export type EstoqueResult = { ok: true } | { ok: false; error: string };

function norm(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

function revalidar() {
  revalidatePath("/admin/estoque");
  revalidatePath("/admin/dashboard");
}

/** Cadastra produto no estoque da org. */
export async function criarProduto(input: {
  codigo: string;
  descricao: string;
  categoria: string;
  unidade: string;
  minimo: number;
  maximo: number | null;
  localizacao: string;
  custo: number;
  sku?: string;
  subcategoria?: string;
  pontoReposicao?: number;
  categoriaId?: string | null;
  fornecedorId?: string | null;
}): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estoque.criar");

  const codigo = input.codigo.trim().toUpperCase();
  const descricao = input.descricao.trim();
  if (codigo.length < 2 || codigo.length > 40) return { ok: false, error: "Código: 2 a 40 caracteres." };
  if (descricao.length < 2 || descricao.length > 160) return { ok: false, error: "Descrição: 2 a 160 caracteres." };
  const minimo = Number(input.minimo);
  if (!Number.isFinite(minimo) || minimo < 0) return { ok: false, error: "Mínimo inválido." };

  const supabase = await createClient();

  let categoria_id: string | null = null;
  if (input.categoriaId) {
    const { data: c } = await supabase
      .from("categorias").select("id").eq("id", input.categoriaId)
      .eq("organization_id", ctx.orgId).eq("tipo", "produto").maybeSingle();
    if (!c) return { ok: false, error: "Categoria inválida." };
    categoria_id = input.categoriaId;
  }
  let fornecedor_id: string | null = null;
  if (input.fornecedorId) {
    const { data: f } = await supabase
      .from("fornecedores").select("id").eq("id", input.fornecedorId)
      .eq("organization_id", ctx.orgId).maybeSingle();
    if (!f) return { ok: false, error: "Fornecedor inválido." };
    fornecedor_id = input.fornecedorId;
  }

  const { data, error } = await supabase
    .from("produtos")
    .insert({
      organization_id: ctx.orgId,
      codigo,
      descricao,
      sku: (() => {
        const s = (input.sku ?? "").trim();
        return s === "" ? null : s.toUpperCase().slice(0, 40);
      })(),
      subcategoria: (() => {
        const s = (input.subcategoria ?? "").trim();
        return s === "" ? null : s.slice(0, 80);
      })(),
      categoria: input.categoria.trim() === "" ? null : input.categoria.trim(),
      categoria_id,
      unidade: input.unidade.trim() === "" ? "un" : input.unidade.trim(),
      estoque_minimo: minimo,
      estoque_maximo: input.maximo,
      ponto_reposicao: Number(input.pontoReposicao) >= 0 ? Number(input.pontoReposicao) : 0,
      localizacao: input.localizacao.trim() === "" ? null : input.localizacao.trim(),
      custo_medio: Number(input.custo) >= 0 ? Number(input.custo) : 0,
      ultimo_custo: Number(input.custo) >= 0 ? Number(input.custo) : 0,
      fornecedor_id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Código ou SKU já existe." };
    return { ok: false, error: "Código já existe ou falha ao salvar." };
  }
  await registrarLog(supabase, {
    tabela: "produtos", registro_id: data.id as string, acao: "INSERT",
    dados_anteriores: null, dados_novos: { codigo, descricao },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

export interface MovimentarInput {
  produtoId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  custoUnitario: number;
  chamadoId: string;
  observacao: string;
}

/**
 * Movimenta estoque em DOIS baldes (gate FASE 3 §7):
 *  - entrada: físico += q
 *  - saida: exige disponível ≥ q; físico −= q
 *  - reserva: exige disponível ≥ q; reservado += q (físico intacto)
 *  - consumo: exige físico ≥ q; físico −= q e abate reserva até zerar
 *  - devolucao: retorna reserva ao disponível (físico intacto)
 *  - ajuste: redefine o FÍSICO para `quantidade` (reservado intacto)
 * Teste-guia: 10 → reserva 3 (fís 10/res 3) → consome 2 (fís 8/res 1).
 */
export async function movimentarEstoque(input: MovimentarInput): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  // Ajuste exige permissão própria (define saldo); demais usam movimentar.
  exigirPermissao(ctx, input.tipo === "ajuste" ? "estoque.ajustar" : "estoque.movimentar");

  const quantidade = Number(input.quantidade);
  if (!input.produtoId) return { ok: false, error: "Produto inválido." };
  if (!["entrada", "saida", "ajuste", "reserva", "consumo", "devolucao"].includes(input.tipo)) {
    return { ok: false, error: "Tipo inválido." };
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { ok: false, error: "Quantidade deve ser maior que zero." };
  }

  const supabase = await createClient();
  const { data: produto } = await supabase
    .from("produtos")
    .select("id, estoque_atual, estoque_reservado, estoque_minimo, codigo")
    .eq("id", input.produtoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!produto) return { ok: false, error: "Produto não encontrado." };

  const fisico = Number((produto as { estoque_atual: number }).estoque_atual ?? 0);
  const reservado = Number((produto as { estoque_reservado: number }).estoque_reservado ?? 0);
  const disponivel = fisico - reservado;
  let novoFisico = fisico;
  let novoReservado = reservado;

  if (input.tipo === "entrada") {
    novoFisico = fisico + quantidade;
  } else if (input.tipo === "ajuste") {
    if (quantidade < reservado) {
      return { ok: false, error: `Ajuste abaixo da reserva (${reservado}). Devolva antes.` };
    }
    novoFisico = quantidade;
  } else if (input.tipo === "saida") {
    if (quantidade > disponivel) {
      return { ok: false, error: `Disponível insuficiente (disp: ${disponivel}).` };
    }
    novoFisico = fisico - quantidade;
  } else if (input.tipo === "reserva") {
    if (quantidade > disponivel) {
      return { ok: false, error: `Disponível insuficiente (disp: ${disponivel}).` };
    }
    novoReservado = reservado + quantidade;
  } else if (input.tipo === "consumo") {
    if (quantidade > fisico) {
      return { ok: false, error: `Saldo físico insuficiente (físico: ${fisico}).` };
    }
    novoFisico = fisico - quantidade;
    novoReservado = Math.max(0, reservado - quantidade);
  } else {
    // devolucao: libera reserva (nunca abaixo de zero, nunca acima do físico).
    novoReservado = Math.max(0, reservado - quantidade);
  }

  let chamadoId: string | null = null;
  if (input.chamadoId.trim() !== "") {
    const { data: ch } = await supabase
      .from("chamados")
      .select("id")
      .eq("id", input.chamadoId.trim())
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!ch) return { ok: false, error: "Chamado vinculado não encontrado." };
    chamadoId = input.chamadoId.trim();
  }

  const { error: erroMov } = await supabase.from("movimentacoes_estoque").insert({
    organization_id: ctx.orgId,
    produto_id: input.produtoId,
    tipo: input.tipo,
    quantidade,
    custo_unitario: Number(input.custoUnitario) >= 0 ? Number(input.custoUnitario) : 0,
    chamado_id: chamadoId,
    observacao: input.observacao.trim() === "" ? null : input.observacao.trim(),
    executado_por: ctx.email,
  });
  if (erroMov) return { ok: false, error: "Falha ao registrar movimentação." };

  await supabase
    .from("produtos")
    .update({ estoque_atual: novoFisico, estoque_reservado: novoReservado })
    .eq("id", input.produtoId)
    .eq("organization_id", ctx.orgId);

  await registrarLog(supabase, {
    tabela: "movimentacoes_estoque",
    registro_id: input.produtoId,
    acao:
      input.tipo === "entrada" || input.tipo === "devolucao" ? "STOCK_ENTRY"
      : input.tipo === "ajuste" ? "STOCK_ADJUSTMENT"
      : "STOCK_EXIT",
    dados_anteriores: { fisico, reservado },
    dados_novos: { tipo: input.tipo, quantidade, novo_fisico: novoFisico, novo_reservado: novoReservado, chamado_id: chamadoId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });

  revalidar();
  if (chamadoId) revalidatePath(`/admin/chamados/${chamadoId}`);
  const novoDisponivel = novoFisico - novoReservado;
  if (novoDisponivel <= Number((produto as { estoque_minimo: number }).estoque_minimo ?? 0)) {
    await notificar({
      tipo: "estoque",
      titulo: `Estoque crítico: ${(produto as { codigo: string }).codigo}`,
      descricao: `Disponível ${novoDisponivel} atingiu o mínimo.`,
      link: "/admin/estoque",
    });
  }
  return { ok: true };
}

/**
 * TRANSFERÊNCIA entre locais (§10): par auditado saída+entrada com
 * origem/destino em texto. Rede líquida zero (sem estoque por local).
 */
export async function transferirEstoque(input: {
  produtoId: string;
  quantidade: number;
  origem: string;
  destino: string;
  motivo?: string;
}): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estoque.transferir");
  if (!input.produtoId) return { ok: false, error: "Produto inválido." };
  const qtd = Number(input.quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) return { ok: false, error: "Quantidade inválida." };
  const origem = input.origem.trim().slice(0, 80);
  const destino = input.destino.trim().slice(0, 80);
  if (origem === "" || destino === "" || origem === destino) {
    return { ok: false, error: "Origem e destino distintos." };
  }

  const supabase = await createClient();
  const { data: produto } = await supabase
    .from("produtos")
    .select("id, estoque_atual, estoque_reservado")
    .eq("id", input.produtoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!produto) return { ok: false, error: "Produto não encontrado." };
  const p = produto as { estoque_atual: number; estoque_reservado: number };
  if (qtd > Number(p.estoque_atual ?? 0) - Number(p.estoque_reservado ?? 0)) {
    return { ok: false, error: "Disponível insuficiente para transferir." };
  }

  const motivo = (input.motivo ?? "").trim().slice(0, 200) || null;
  const marca = `Transferência ${origem} → ${destino}`;
  const { error } = await supabase.from("movimentacoes_estoque").insert([
    {
      organization_id: ctx.orgId, produto_id: input.produtoId, tipo: "saida",
      quantidade: qtd, custo_unitario: 0, origem, destino,
      observacao: motivo ?? marca, executado_por: ctx.email,
    },
    {
      organization_id: ctx.orgId, produto_id: input.produtoId, tipo: "entrada",
      quantidade: qtd, custo_unitario: 0, origem, destino,
      observacao: motivo ?? marca, executado_por: ctx.email,
    },
  ]);
  if (error) return { ok: false, error: "Não foi possível transferir." };

  await registrarLog(supabase, {
    tabela: "movimentacoes_estoque", registro_id: input.produtoId, acao: "STOCK_TRANSFERRED",
    dados_anteriores: null, dados_novos: { origem, destino, quantidade: qtd, motivo },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Atualiza cadastro do produto (editar). */
export async function atualizarProduto(input: {
  id: string;
  descricao: string;
  sku?: string;
  subcategoria?: string;
  categoria?: string;
  categoria_id?: string | null;
  unidade: string;
  minimo: number;
  maximo: number | null;
  pontoReposicao: number;
  localizacao?: string;
  fornecedorId?: string | null;
  codigoFornecedor?: string;
  lote?: string;
  ativo: boolean;
}): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estoque.editar");
  if (!input.id) return { ok: false, error: "Produto inválido." };
  const descricao = input.descricao.trim();
  if (descricao.length < 2 || descricao.length > 160) {
    return { ok: false, error: "Descrição: 2 a 160 caracteres." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("produtos").select("id").eq("id", input.id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!atual) return { ok: false, error: "Produto não encontrado." };

  let categoria_id: string | null = null;
  if (input.categoria_id) {
    const { data: c } = await supabase
      .from("categorias").select("id").eq("id", input.categoria_id)
      .eq("organization_id", ctx.orgId).eq("tipo", "produto").maybeSingle();
    if (!c) return { ok: false, error: "Categoria inválida." };
    categoria_id = input.categoria_id;
  }
  let fornecedorId: string | null = null;
  if (input.fornecedorId) {
    const { data: f } = await supabase
      .from("fornecedores").select("id").eq("id", input.fornecedorId)
      .eq("organization_id", ctx.orgId).maybeSingle();
    if (!f) return { ok: false, error: "Fornecedor inválido." };
    fornecedorId = input.fornecedorId;
  }

  const { error } = await supabase
    .from("produtos")
    .update({
      descricao,
      sku: norm(input.sku, 40)?.toUpperCase() ?? null,
      subcategoria: norm(input.subcategoria, 80),
      categoria: norm(input.categoria, 80),
      categoria_id,
      unidade: (input.unidade || "UN").trim().toUpperCase().slice(0, 10),
      estoque_minimo: Number(input.minimo) >= 0 ? Number(input.minimo) : 0,
      estoque_maximo: input.maximo,
      ponto_reposicao: Number(input.pontoReposicao) >= 0 ? Number(input.pontoReposicao) : 0,
      localizacao: norm(input.localizacao, 160),
      fornecedor_id: fornecedorId,
      codigo_fornecedor: norm(input.codigoFornecedor, 60),
      ativo: input.ativo,
    })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "SKU já existe." };
    return { ok: false, error: "Não foi possível salvar." };
  }
  revalidar();
  return { ok: true };
}

/** Vincula fornecedor ao produto (principal opcional, um por produto). */
export async function vincularFornecedor(input: {
  produtoId: string;
  fornecedorId: string;
  principal: boolean;
  precoRef?: number | null;
  prazoMedio?: number | null;
}): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estoque.editar");

  const supabase = await createClient();
  const [{ data: p }, { data: f }] = await Promise.all([
    supabase.from("produtos").select("id").eq("id", input.produtoId).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("fornecedores").select("id").eq("id", input.fornecedorId).eq("organization_id", ctx.orgId).maybeSingle(),
  ]);
  if (!p || !f) return { ok: false, error: "Produto ou fornecedor inválido." };

  if (input.principal) {
    await supabase
      .from("produto_fornecedores")
      .update({ principal: false })
      .eq("produto_id", input.produtoId)
      .eq("organization_id", ctx.orgId);
  }
  const { error } = await supabase.from("produto_fornecedores").upsert(
    {
      organization_id: ctx.orgId,
      produto_id: input.produtoId,
      fornecedor_id: input.fornecedorId,
      principal: input.principal,
      preco_ref: input.precoRef ?? null,
      prazo_medio_dias: input.prazoMedio ?? null,
    },
    { onConflict: "produto_id,fornecedor_id" },
  );
  if (error) return { ok: false, error: "Não foi possível vincular." };
  revalidar();
  return { ok: true };
}

/** Desvincula fornecedor do produto. */
export async function desvincularFornecedor(input: {
  produtoId: string;
  fornecedorId: string;
}): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estoque.editar");

  const supabase = await createClient();
  const { error } = await supabase
    .from("produto_fornecedores")
    .delete()
    .eq("produto_id", input.produtoId)
    .eq("fornecedor_id", input.fornecedorId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível desvincular." };
  revalidar();
  return { ok: true };
}

/** Cria unidade de medida da org. */
export async function criarUnidade(input: { sigla: string; nome: string }): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estoque.editar");
  const sigla = input.sigla.trim().toUpperCase().slice(0, 10);
  const nome = input.nome.trim().slice(0, 40);
  if (sigla === "" || nome === "") return { ok: false, error: "Sigla e nome." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("unidades_medida")
    .insert({ organization_id: ctx.orgId, sigla, nome });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Sigla já existe." };
    return { ok: false, error: "Não foi possível criar." };
  }
  revalidar();
  return { ok: true };
}
