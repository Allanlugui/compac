"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPapel } from "@/lib/roles";
import { registrarLog } from "@/lib/auditoria";
import { notificar } from "@/app/admin/notificacoes/actions";
import type { SolicitacaoCompraStatus } from "@/lib/types";

export type PedidoResult = { ok: true } | { ok: false; error: string };

const STATUS_VALIDOS: SolicitacaoCompraStatus[] = [
  "pendente",
  "aprovado",
  "rejeitado",
  "comprado",
];

function revalidar() {
  revalidatePath("/admin/compras");
  revalidatePath("/admin/relatorios");
}

/**
 * Transição de status do pedido (aprovar / rejeitar / reabrir).
 * Pedidos já efetivados (`comprado`) são terminais: viraram compra
 * no financeiro e não podem voltar atrás por aqui.
 */
export async function atualizarStatusPedido(input: {
  id: string;
  status: SolicitacaoCompraStatus;
}): Promise<PedidoResult> {
  if (!input.id) return { ok: false, error: "Solicitação inválida." };
  if (!STATUS_VALIDOS.includes(input.status)) {
    return { ok: false, error: "Status inválido." };
  }

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPapel(ctx, ["ADMIN", "GESTOR", "COMPRAS"]);

  const { data: atual } = await supabase
    .from("solicitacoes_compra")
    .select("id, status, item")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (!atual) return { ok: false, error: "Solicitação não encontrada." };
  if (atual.status === "comprado") {
    return { ok: false, error: "Pedido já efetivado como compra." };
  }
  if (atual.status === input.status) return { ok: true };

  const { error } = await supabase
    .from("solicitacoes_compra")
    .update({ status: input.status })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);

  if (error) {
    return { ok: false, error: "Não foi possível atualizar o pedido." };
  }

  await registrarLog(supabase, {
    tabela: "solicitacoes_compra",
    registro_id: input.id,
    acao: input.status === "aprovado" ? "APPROVAL" : input.status === "rejeitado" ? "REJECTION" : "UPDATE",
    dados_anteriores: { status: atual.status },
    dados_novos: { status: input.status },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  if (input.status === "aprovado" || input.status === "rejeitado") {
    await notificar({
      tipo: "pedido",
      titulo: `Pedido ${input.status === "aprovado" ? "aprovado" : "rejeitado"}: ${atual.item}`,
      link: "/admin/compras",
    });
  }

  revalidar();
  return { ok: true };
}

export interface EfetivarCompraInput {
  solicitacaoId: string;
  /** Valor unitário real pago (pode diferir da estimativa). */
  valorUnitario: number;
  setor: string;
  dataCompra: string;
}

/**
 * Efetiva um pedido APROVADO: cria a compra no financeiro
 * (compra geral, sem chamado) e marca a solicitação como `comprado`.
 */
export async function efetivarPedido(
  input: EfetivarCompraInput,
): Promise<PedidoResult> {
  const valorUnitario = Number(input.valorUnitario);
  const setor = input.setor.trim();

  if (!input.solicitacaoId) {
    return { ok: false, error: "Solicitação inválida." };
  }
  if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
    return { ok: false, error: "Valor unitário inválido." };
  }
  if (setor.length > 80) {
    return { ok: false, error: "Setor: máximo de 80 caracteres." };
  }
  const dataCompra = /^\d{4}-\d{2}-\d{2}$/.test(input.dataCompra)
    ? input.dataCompra
    : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPapel(ctx, ["ADMIN", "GESTOR", "COMPRAS"]);

  const { data: pedido } = await supabase
    .from("solicitacoes_compra")
    .select("*")
    .eq("id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (!pedido) return { ok: false, error: "Solicitação não encontrada." };
  if (pedido.status !== "aprovado") {
    return { ok: false, error: "Só pedidos aprovados podem ser efetivados." };
  }

  const { data: compra, error: erroCompra } = await supabase
    .from("compras")
    .insert({
      organization_id: ctx.orgId,
      chamado_id: null,
      item: pedido.item,
      quantidade: pedido.quantidade,
      valor_unitario: valorUnitario,
      setor: setor === "" ? pedido.setor : setor,
      data_compra: dataCompra,
    })
    .select("id")
    .single();

  if (erroCompra || !compra) {
    return { ok: false, error: "Não foi possível registrar a compra." };
  }

  const { error: erroStatus } = await supabase
    .from("solicitacoes_compra")
    .update({ status: "comprado" })
    .eq("id", input.solicitacaoId)
    .eq("organization_id", ctx.orgId);

  if (erroStatus) {
    return {
      ok: false,
      error: "Compra registrada, mas o pedido não foi marcado. Ajuste manual necessário.",
    };
  }

  await registrarLog(supabase, {
    tabela: "compras",
    registro_id: compra.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: {
      item: pedido.item,
      quantidade: pedido.quantidade,
      valor_unitario: valorUnitario,
      origem: `solicitacao:${input.solicitacaoId}`,
    },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  await registrarLog(supabase, {
    tabela: "solicitacoes_compra",
    registro_id: input.solicitacaoId,
    acao: "UPDATE",
    dados_anteriores: { status: "aprovado" },
    dados_novos: { status: "comprado", compra_id: compra.id },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  await notificar({
    tipo: "compra",
    titulo: `Compra registrada: ${pedido.item}`,
    link: "/admin/compras",
  });

  revalidar();
  return { ok: true };
}
