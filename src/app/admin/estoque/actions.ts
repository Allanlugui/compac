"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPapel } from "@/lib/roles";
import { registrarLog } from "@/lib/auditoria";
import { notificar } from "@/app/admin/notificacoes/actions";
import type { TipoMovimentacao } from "@/lib/types";

export type EstoqueResult = { ok: true } | { ok: false; error: string };

const PAPEIS_MOV = ["ADMIN", "GESTOR", "COMPRAS", "TECNICO"] as const;

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
  exigirPapel(ctx, ["ADMIN", "GESTOR", "COMPRAS"]);

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
 * Movimenta estoque (entrada/saída/ajuste/reserva/consumo).
 * `ajuste` redefine o saldo para `quantidade`; demais somam/subtraem.
 * Bloqueia saída/consumo sem saldo (salvo reserva, que pode negativar
 * para sinalizar pendência — documentado na UI).
 */
export async function movimentarEstoque(input: MovimentarInput): Promise<EstoqueResult> {
  const ctx = await requireOrg();
  exigirPapel(ctx, [...PAPEIS_MOV]);

  const quantidade = Number(input.quantidade);
  if (!input.produtoId) return { ok: false, error: "Produto inválido." };
  if (!["entrada", "saida", "ajuste", "reserva", "consumo"].includes(input.tipo)) {
    return { ok: false, error: "Tipo inválido." };
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { ok: false, error: "Quantidade deve ser maior que zero." };
  }

  const supabase = await createClient();
  const { data: produto } = await supabase
    .from("produtos")
    .select("id, estoque_atual, estoque_minimo, codigo")
    .eq("id", input.produtoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!produto) return { ok: false, error: "Produto não encontrado." };

  const saldo = Number(produto.estoque_atual ?? 0);
  let novoSaldo = saldo;
  if (input.tipo === "entrada") novoSaldo = saldo + quantidade;
  else if (input.tipo === "ajuste") novoSaldo = quantidade;
  else novoSaldo = saldo - quantidade;

  if ((input.tipo === "saida" || input.tipo === "consumo") && novoSaldo < 0) {
    return { ok: false, error: `Saldo insuficiente (atual: ${saldo}).` };
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
    .update({ estoque_atual: novoSaldo })
    .eq("id", input.produtoId)
    .eq("organization_id", ctx.orgId);

  await registrarLog(supabase, {
    tabela: "movimentacoes_estoque",
    registro_id: input.produtoId,
    acao:
      input.tipo === "entrada" ? "STOCK_ENTRY"
      : input.tipo === "ajuste" ? "STOCK_ADJUSTMENT"
      : "STOCK_EXIT",
    dados_anteriores: { saldo },
    dados_novos: { tipo: input.tipo, quantidade, novo_saldo: novoSaldo, chamado_id: chamadoId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });

  revalidar();
  if (chamadoId) revalidatePath(`/admin/chamados/${chamadoId}`);
  if (novoSaldo <= Number(produto.estoque_minimo ?? 0)) {
    await notificar({
      tipo: "estoque",
      titulo: `Estoque crítico: ${produto.codigo}`,
      descricao: `Saldo ${novoSaldo} atingiu o mínimo.`,
      link: "/admin/estoque",
      orgId: ctx.orgId,
    });
  }
  return { ok: true };
}
