"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, type ContextoOrg } from "@/lib/org";
import { exigirPermissaoEfetiva } from "@/lib/permissoes-custom-server";
import { registrarLog } from "@/lib/auditoria";

export type CadastrosResult = { ok: true } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/admin/cadastros");
}

/** BLOCO 3: escrita com overlay customizado (escopo = localidade vinculada, quando há). */
async function exigirEscrita(ctx: ContextoOrg, localidadeId?: string | null): Promise<void> {
  await exigirPermissaoEfetiva(
    ctx,
    "estrutura.escrever",
    localidadeId ? { tipo: "localidade", id: localidadeId } : null,
  );
}

function nome80(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, 80) : "";
  return s.length >= 1 ? s : null;
}

/** Confirma que o registro vinculado pertence à org (segunda barreira além do trigger). */
async function vinculoDaOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tabela: "localidades" | "departamentos_setores",
  id: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(tabela)
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  return !!data;
}

/** Cria departamento/setor, opcionalmente vinculado a um nó da árvore física. */
export async function criarDepartamento(input: {
  nome: string;
  sigla?: string;
  localidadeId?: string | null;
}): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx, input.localidadeId || null);

  const nome = nome80(input.nome);
  if (!nome) return { ok: false, error: "Nome inválido." };
  const sigla = (input.sigla ?? "").trim().slice(0, 10) || null;
  const localidadeId = input.localidadeId || null;

  const supabase = await createClient();
  if (localidadeId && !(await vinculoDaOrg(supabase, "localidades", localidadeId, ctx.orgId))) {
    return { ok: false, error: "Localidade não encontrada." };
  }

  const { data, error } = await supabase
    .from("departamentos_setores")
    .insert({ organization_id: ctx.orgId, nome, sigla, localidade_id: localidadeId })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Nome já existe ou falha ao salvar." };
  }
  await registrarLog(supabase, {
    tabela: "departamentos_setores",
    registro_id: data.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { nome, sigla, localidade_id: localidadeId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Renomeia / move / ativa-inativa departamento. */
export async function editarDepartamento(input: {
  id: string;
  nome: string;
  sigla?: string;
  localidadeId?: string | null;
  ativo: boolean;
}): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx, input.localidadeId || null);

  const nome = nome80(input.nome);
  if (!input.id || !nome) return { ok: false, error: "Dados inválidos." };
  const sigla = (input.sigla ?? "").trim().slice(0, 10) || null;
  const localidadeId = input.localidadeId || null;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("departamentos_setores")
    .select("nome, sigla, localidade_id, ativo")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Departamento não encontrado." };
  if (localidadeId && !(await vinculoDaOrg(supabase, "localidades", localidadeId, ctx.orgId))) {
    return { ok: false, error: "Localidade não encontrada." };
  }

  const { error } = await supabase
    .from("departamentos_setores")
    .update({ nome, sigla, localidade_id: localidadeId, ativo: input.ativo })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Nome já existe ou falha ao salvar." };

  await registrarLog(supabase, {
    tabela: "departamentos_setores",
    registro_id: input.id,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { nome, sigla, localidade_id: localidadeId, ativo: input.ativo },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Exclui departamento (bloqueado se houver centro de custo vinculado). */
export async function excluirDepartamento(input: { id: string }): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx);
  if (!input.id) return { ok: false, error: "Departamento inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("departamentos_setores")
    .select("nome")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Departamento não encontrado." };

  const { count } = await supabase
    .from("centros_custo")
    .select("id", { count: "exact", head: true })
    .eq("departamento_id", input.id)
    .eq("organization_id", ctx.orgId);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Há centros de custo vinculados. Remova o vínculo antes." };
  }

  const { error } = await supabase
    .from("departamentos_setores")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await registrarLog(supabase, {
    tabela: "departamentos_setores",
    registro_id: input.id,
    acao: "DELETE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: null,
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Cria centro de custo (código único por org). */
export async function criarCentroCusto(input: {
  codigo: string;
  nome: string;
  departamentoId?: string | null;
  localidadeId?: string | null;
}): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx, input.localidadeId || null);

  const codigo = (input.codigo ?? "").trim().slice(0, 20);
  const nome = nome80(input.nome);
  if (codigo.length < 1 || !nome) return { ok: false, error: "Código e nome são obrigatórios." };
  const departamentoId = input.departamentoId || null;
  const localidadeId = input.localidadeId || null;

  const supabase = await createClient();
  if (departamentoId && !(await vinculoDaOrg(supabase, "departamentos_setores", departamentoId, ctx.orgId))) {
    return { ok: false, error: "Departamento não encontrado." };
  }
  if (localidadeId && !(await vinculoDaOrg(supabase, "localidades", localidadeId, ctx.orgId))) {
    return { ok: false, error: "Localidade não encontrada." };
  }

  const { data, error } = await supabase
    .from("centros_custo")
    .insert({
      organization_id: ctx.orgId,
      codigo,
      nome,
      departamento_id: departamentoId,
      localidade_id: localidadeId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Código já existe ou falha ao salvar." };
  }
  await registrarLog(supabase, {
    tabela: "centros_custo",
    registro_id: data.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { codigo, nome, departamento_id: departamentoId, localidade_id: localidadeId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Atualiza centro de custo. */
export async function editarCentroCusto(input: {
  id: string;
  codigo: string;
  nome: string;
  departamentoId?: string | null;
  localidadeId?: string | null;
  ativo: boolean;
}): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx, input.localidadeId || null);

  const codigo = (input.codigo ?? "").trim().slice(0, 20);
  const nome = nome80(input.nome);
  if (!input.id || codigo.length < 1 || !nome) return { ok: false, error: "Dados inválidos." };
  const departamentoId = input.departamentoId || null;
  const localidadeId = input.localidadeId || null;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("centros_custo")
    .select("codigo, nome, departamento_id, localidade_id, ativo")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Centro de custo não encontrado." };
  if (departamentoId && !(await vinculoDaOrg(supabase, "departamentos_setores", departamentoId, ctx.orgId))) {
    return { ok: false, error: "Departamento não encontrado." };
  }
  if (localidadeId && !(await vinculoDaOrg(supabase, "localidades", localidadeId, ctx.orgId))) {
    return { ok: false, error: "Localidade não encontrada." };
  }

  const { error } = await supabase
    .from("centros_custo")
    .update({
      codigo,
      nome,
      departamento_id: departamentoId,
      localidade_id: localidadeId,
      ativo: input.ativo,
    })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Código já existe ou falha ao salvar." };

  await registrarLog(supabase, {
    tabela: "centros_custo",
    registro_id: input.id,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { codigo, nome, departamento_id: departamentoId, localidade_id: localidadeId, ativo: input.ativo },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Exclui centro de custo (auditoria preservada em log). */
export async function excluirCentroCusto(input: { id: string }): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx);
  if (!input.id) return { ok: false, error: "Centro de custo inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("centros_custo")
    .select("codigo, nome")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Centro de custo não encontrado." };

  const { error } = await supabase
    .from("centros_custo")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await registrarLog(supabase, {
    tabela: "centros_custo",
    registro_id: input.id,
    acao: "DELETE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: null,
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Cria almoxarifado físico, opcionalmente vinculado à árvore física. */
export async function criarAlmoxarifado(input: {
  nome: string;
  codigo?: string;
  localidadeId?: string | null;
}): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx, input.localidadeId || null);

  const nome = nome80(input.nome);
  if (!nome) return { ok: false, error: "Nome inválido." };
  const codigo = (input.codigo ?? "").trim().slice(0, 20) || null;
  const localidadeId = input.localidadeId || null;

  const supabase = await createClient();
  if (localidadeId && !(await vinculoDaOrg(supabase, "localidades", localidadeId, ctx.orgId))) {
    return { ok: false, error: "Localidade não encontrada." };
  }

  const { data, error } = await supabase
    .from("almoxarifados")
    .insert({ organization_id: ctx.orgId, nome, codigo, localidade_id: localidadeId })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Nome já existe ou falha ao salvar." };
  }
  await registrarLog(supabase, {
    tabela: "almoxarifados",
    registro_id: data.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { nome, codigo, localidade_id: localidadeId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Renomeia / move / ativa-inativa almoxarifado. */
export async function editarAlmoxarifado(input: {
  id: string;
  nome: string;
  codigo?: string;
  localidadeId?: string | null;
  ativo: boolean;
}): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx, input.localidadeId || null);

  const nome = nome80(input.nome);
  if (!input.id || !nome) return { ok: false, error: "Dados inválidos." };
  const codigo = (input.codigo ?? "").trim().slice(0, 20) || null;
  const localidadeId = input.localidadeId || null;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("almoxarifados")
    .select("nome, codigo, localidade_id, ativo")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Almoxarifado não encontrado." };
  if (localidadeId && !(await vinculoDaOrg(supabase, "localidades", localidadeId, ctx.orgId))) {
    return { ok: false, error: "Localidade não encontrada." };
  }

  const { error } = await supabase
    .from("almoxarifados")
    .update({ nome, codigo, localidade_id: localidadeId, ativo: input.ativo })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Nome já existe ou falha ao salvar." };

  await registrarLog(supabase, {
    tabela: "almoxarifados",
    registro_id: input.id,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { nome, codigo, localidade_id: localidadeId, ativo: input.ativo },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Exclui almoxarifado (bloqueado se houver produto ou movimentação vinculada). */
export async function excluirAlmoxarifado(input: { id: string }): Promise<CadastrosResult> {
  const ctx = await requireOrg();
  await exigirEscrita(ctx);
  if (!input.id) return { ok: false, error: "Almoxarifado inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("almoxarifados")
    .select("nome")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Almoxarifado não encontrado." };

  const [{ count: prods }, { count: movs }] = await Promise.all([
    supabase.from("produtos").select("id", { count: "exact", head: true }).eq("almoxarifado_id", input.id).eq("organization_id", ctx.orgId),
    supabase.from("movimentacoes_estoque").select("id", { count: "exact", head: true }).eq("almoxarifado_id", input.id).eq("organization_id", ctx.orgId),
  ]);
  if ((prods ?? 0) > 0 || (movs ?? 0) > 0) {
    return { ok: false, error: "Há produtos ou movimentações vinculados. Remova os vínculos antes." };
  }

  const { error } = await supabase
    .from("almoxarifados")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await registrarLog(supabase, {
    tabela: "almoxarifados",
    registro_id: input.id,
    acao: "DELETE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: null,
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}
