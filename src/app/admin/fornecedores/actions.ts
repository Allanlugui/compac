"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";

export type FornecedorResult = { ok: true } | { ok: false; error: string };

export interface FornecedorInput {
  nome: string;
  razao_social: string;
  cnpj: string;
  ie: string;
  contato: string;
  telefone: string;
  email: string;
  site: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  categoria: string;
  observacoes: string;
}

function txt(v: string, max: number): string | null {
  const t = (v ?? "").trim().slice(0, max);
  return t === "" ? null : t;
}

function validar(input: FornecedorInput) {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 160) return null;
  if (input.email.trim() !== "" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) {
    return null;
  }
  return {
    nome,
    razao_social: txt(input.razao_social, 160),
    nome_fantasia: nome,
    cnpj: txt(input.cnpj, 20),
    ie: txt(input.ie, 20),
    contato: txt(input.contato, 120),
    telefone: txt(input.telefone, 30),
    email: txt(input.email, 160),
    site: txt(input.site, 160),
    endereco: txt(input.endereco, 200),
    cidade: txt(input.cidade, 80),
    estado: txt(input.estado, 2)?.toUpperCase() ?? null,
    cep: txt(input.cep, 10),
    categoria: txt(input.categoria, 80),
    observacoes: txt(input.observacoes, 1000),
  };
}

export async function criarFornecedor(input: FornecedorInput): Promise<FornecedorResult> {
  const dados = validar(input);
  if (!dados) return { ok: false, error: "Nome: 2 a 160 caracteres." };
  const ctx = await requireOrg();
  exigirPermissao(ctx, "fornecedores.criar");

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
  exigirPermissao(ctx, "fornecedores.editar");
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

/** Edita cadastro do fornecedor (editar). */
export async function editarFornecedor(
  input: { id: string } & FornecedorInput,
): Promise<FornecedorResult> {
  const dados = validar(input);
  if (!dados || !input.id) return { ok: false, error: "Dados inválidos." };
  const ctx = await requireOrg();
  exigirPermissao(ctx, "fornecedores.editar");

  const supabase = await createClient();
  const { error } = await supabase
    .from("fornecedores")
    .update(dados)
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Falha ao salvar." };
  await registrarLog(supabase, {
    tabela: "fornecedores", registro_id: input.id, acao: "UPDATE",
    dados_anteriores: null, dados_novos: { nome: dados.nome },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidatePath("/admin/fornecedores");
  return { ok: true };
}
