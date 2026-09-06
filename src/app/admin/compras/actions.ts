"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CompraResult = { ok: true } | { ok: false; error: string };

export interface CompraInput {
  item: string;
  quantidade: number;
  valorUnitario: number;
  setor: string;
  dataCompra: string;
  /** Opcional: UUID do chamado ou "" para compra geral. */
  chamadoId: string;
}

interface CompraValidada {
  item: string;
  quantidade: number;
  valorUnitario: number;
  setor: string | null;
  dataCompra: string;
  chamadoId: string | null;
}

function validar(
  input: CompraInput,
): { ok: true; dados: CompraValidada } | { ok: false; error: string } {
  const item = input.item.trim();
  const setor = input.setor.trim();
  const quantidade = Number(input.quantidade);
  const valorUnitario = Number(input.valorUnitario);

  if (item.length < 2 || item.length > 160) {
    return { ok: false, error: "Item: 2 a 160 caracteres." };
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1_000_000) {
    return { ok: false, error: "Quantidade deve ser maior que zero." };
  }
  if (
    !Number.isFinite(valorUnitario) ||
    valorUnitario < 0 ||
    valorUnitario > 100_000_000
  ) {
    return { ok: false, error: "Valor unitário inválido." };
  }
  if (setor.length > 80) {
    return { ok: false, error: "Setor: máximo de 80 caracteres." };
  }
  const dataCompra = /^\d{4}-\d{2}-\d{2}$/.test(input.dataCompra)
    ? input.dataCompra
    : new Date().toISOString().slice(0, 10);
  const chamadoId = input.chamadoId.trim() === "" ? null : input.chamadoId.trim();

  return {
    ok: true,
    dados: {
      item,
      quantidade,
      valorUnitario,
      setor: setor === "" ? null : setor,
      dataCompra,
      chamadoId,
    },
  };
}

function revalidarCompras() {
  revalidatePath("/admin/compras");
  revalidatePath("/admin/relatorios");
  revalidatePath("/admin/dashboard");
}

async function chamadoExiste(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from("chamados")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return !!data;
}

/** Cadastra compra geral ou vinculada a um chamado. */
export async function criarCompra(input: CompraInput): Promise<CompraResult> {
  const validacao = validar(input);
  if (!validacao.ok) return validacao;
  const { dados } = validacao;

  const supabase = await createClient();
  if (dados.chamadoId && !(await chamadoExiste(supabase, dados.chamadoId))) {
    return { ok: false, error: "Chamado vinculado não encontrado." };
  }

  const { error } = await supabase.from("compras").insert({
    chamado_id: dados.chamadoId,
    item: dados.item,
    quantidade: dados.quantidade,
    valor_unitario: dados.valorUnitario,
    setor: dados.setor,
    data_compra: dados.dataCompra,
  });

  if (error) return { ok: false, error: "Não foi possível registrar a compra." };
  revalidarCompras();
  return { ok: true };
}

/** Edita item, quantidades, valores, setor e data (vínculo mantido). */
export async function atualizarCompra(
  input: CompraInput & { id: string },
): Promise<CompraResult> {
  if (!input.id) return { ok: false, error: "Compra inválida." };
  const validacao = validar(input);
  if (!validacao.ok) return validacao;
  const { dados } = validacao;

  const supabase = await createClient();
  const { error } = await supabase
    .from("compras")
    .update({
      item: dados.item,
      quantidade: dados.quantidade,
      valor_unitario: dados.valorUnitario,
      setor: dados.setor,
      data_compra: dados.dataCompra,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: "Não foi possível atualizar a compra." };
  revalidarCompras();
  return { ok: true };
}

/** Exclui uma compra (histórico do chamado preservado). */
export async function excluirCompra(input: { id: string }): Promise<CompraResult> {
  if (!input.id) return { ok: false, error: "Compra inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("compras").delete().eq("id", input.id);

  if (error) return { ok: false, error: "Não foi possível excluir a compra." };
  revalidarCompras();
  return { ok: true };
}
