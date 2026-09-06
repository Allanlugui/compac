"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPapel } from "@/lib/roles";
import { registrarLog } from "@/lib/auditoria";

export type FornecedorResult = { ok: true } | { ok: false; error: string };

export interface FornecedorInput {
  nome: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  categoria: string;
}

function validar(input: FornecedorInput) {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 160) return null;
  return {
    nome,
    cnpj: input.cnpj.trim() === "" ? null : input.cnpj.trim(),
    contato: input.contato.trim() === "" ? null : input.contato.trim(),
    telefone: input.telefone.trim() === "" ? null : input.telefone.trim(),
    email: input.email.trim() === "" ? null : input.email.trim(),
    categoria: input.categoria.trim() === "" ? null : input.categoria.trim(),
  };
}

export async function criarFornecedor(input: FornecedorInput): Promise<FornecedorResult> {
  const dados = validar(input);
  if (!dados) return { ok: false, error: "Nome: 2 a 160 caracteres." };
  const ctx = await requireOrg();
  exigirPapel(ctx, ["ADMIN", "GESTOR", "COMPRAS"]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornecedores")
    .insert({ organization_id: ctx.orgId, ...dados })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Falha ao salvar fornecedor." };
  await registrarLog(supabase, {
    tabela: "fornecedores", registro_id: data.id as string, acao: "INSERT",
    dados_anteriores: null, dados_novos: { nome: dados.nome },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidatePath("/admin/fornecedores");
  return { ok: true };
}

export async function alternarFornecedor(input: { id: string; ativo: boolean }): Promise<FornecedorResult> {
  const ctx = await requireOrg();
  exigirPapel(ctx, ["ADMIN", "GESTOR", "COMPRAS"]);
  if (!input.id) return { ok: false, error: "Fornecedor inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fornecedores")
    .update({ ativo: input.ativo })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Falha ao atualizar." };
  revalidatePath("/admin/fornecedores");
  return { ok: true };
}
