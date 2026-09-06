"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import { notificar } from "@/app/admin/notificacoes/actions";
import type { TipoMovimentacao } from "@/lib/types";

export type EstoqueResult = { ok: true } | { ok: false; error: string };

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
}): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estoque.escrever");

  const codigo = input.codigo.trim().toUpperCase();
  const descricao = input.descricao.trim();
  if (codigo.length < 2 || codigo.length > 40) return { ok: false, error: "Código: 2 a 40 caracteres." };
  if (descricao.length < 2 || descricao.length > 160) return { ok: false, error: "Descrição: 2 a 160 caracteres." };
  const minimo = Number(input.minimo);
  if (!Number.isFinite(minimo) || minimo < 0) return { ok: false, error: "Mínimo inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos")
    .insert({
      organization_id: ctx.orgId,
      codigo,
      descricao,
      categoria: input.categoria.trim() === "" ? null : input.categoria.trim(),
      unidade: input.unidade.trim() === "" ? "un" : input.unidade.trim(),
      estoque_minimo: minimo,
      estoque_maximo: input.maximo,
      localizacao: input.localizacao.trim() === "" ? null : input.localizacao.trim(),
      custo_medio: Number(input.custo) >= 0 ? Number(input.custo) : 0,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Código já existe ou falha ao salvar." };
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
  exigirPermissao(ctx, "estoque.movimentar");

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
