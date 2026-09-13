"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import type {
  AtributoCategoria,
  TipoAtributo,
  TipoCategoria,
  TipoLocalidade,
} from "@/lib/types";

export type EstruturaResult = { ok: true } | { ok: false; error: string };

const TIPOS_LOC: TipoLocalidade[] = ["unidade", "predio", "bloco", "andar", "area", "sala"];
const TIPOS_CAT: TipoCategoria[] = ["ativo", "produto"];
const TIPOS_ATR: TipoAtributo[] = ["texto", "numero", "selecao", "data"];
const MAX_PROFUNDIDADE = 6;

function revalidar() {
  revalidatePath("/admin/estrutura");
}

interface NoLoc {
  id: string;
  nome: string;
  tipo: string;
  parent_id: string | null;
}

/** Profundidade do nó (raiz = 1). Retorna -1 se ciclo (não deve ocorrer). */
function profundidade(nos: NoLoc[], id: string): number {
  let d = 1;
  let atual = nos.find((n) => n.id === id);
  const vistos = new Set<string>();
  while (atual?.parent_id) {
    if (vistos.has(atual.id)) return -1;
    vistos.add(atual.id);
    d += 1;
    if (d > MAX_PROFUNDIDADE + 1) return d;
    atual = nos.find((n) => n.id === atual!.parent_id);
  }
  return d;
}

/** true se `candidato` é descendente de `ancestral`. */
function ehDescendente(nos: NoLoc[], candidato: string, ancestral: string): boolean {
  let atual = nos.find((n) => n.id === candidato);
  const vistos = new Set<string>();
  while (atual?.parent_id) {
    if (vistos.has(atual.id)) return false;
    vistos.add(atual.id);
    if (atual.parent_id === ancestral) return true;
    atual = nos.find((n) => n.id === atual!.parent_id);
  }
  return false;
}

/** Cria nó da hierarquia (unidade→…→sala). Níveis opcionais. */
export async function criarLocalidade(input: {
  nome: string;
  tipo: TipoLocalidade;
  parentId: string | null;
}): Promise<EstruturaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estrutura.escrever");

  const nome = input.nome.trim().slice(0, 120);
  if (nome.length < 1) return { ok: false, error: "Nome inválido." };
  if (!TIPOS_LOC.includes(input.tipo)) return { ok: false, error: "Tipo inválido." };

  const supabase = await createClient();
  const { data: nos } = await supabase
    .from("localidades")
    .select("id, nome, tipo, parent_id")
    .eq("organization_id", ctx.orgId);
  const lista = (nos ?? []) as NoLoc[];

  if (input.parentId) {
    const pai = lista.find((n) => n.id === input.parentId);
    if (!pai) return { ok: false, error: "Local superior não encontrado." };
    if (profundidade(lista, pai.id) + 1 > MAX_PROFUNDIDADE) {
      return { ok: false, error: `Máximo de ${MAX_PROFUNDIDADE} níveis.` };
    }
  }

  const { data, error } = await supabase
    .from("localidades")
    .insert({
      organization_id: ctx.orgId,
      nome,
      tipo: input.tipo,
      parent_id: input.parentId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Nome já existe neste nível ou falha ao salvar." };
  }
  await registrarLog(supabase, {
    tabela: "localidades",
    registro_id: data.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { nome, tipo: input.tipo, parent_id: input.parentId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Renomeia / move nó (sem ciclos, sem exceder profundidade). */
export async function editarLocalidade(input: {
  id: string;
  nome: string;
  parentId: string | null;
}): Promise<EstruturaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estrutura.escrever");

  const nome = input.nome.trim().slice(0, 120);
  if (!input.id || nome.length < 1) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: nos } = await supabase
    .from("localidades")
    .select("id, nome, tipo, parent_id")
    .eq("organization_id", ctx.orgId);
  const lista = (nos ?? []) as NoLoc[];
  const atual = lista.find((n) => n.id === input.id);
  if (!atual) return { ok: false, error: "Local não encontrado." };

  if (input.parentId) {
    if (input.parentId === input.id) return { ok: false, error: "Local não pode conter a si mesmo." };
    const pai = lista.find((n) => n.id === input.parentId);
    if (!pai) return { ok: false, error: "Local superior não encontrado." };
    if (ehDescendente(lista, input.parentId, input.id)) {
      return { ok: false, error: "Movimento criaria ciclo na hierarquia." };
    }
    // Profundidade resultante: profundidade do pai + altura da subárvore.
    const altura = (raiz: string): number => {
      const filhos = lista.filter((n) => n.parent_id === raiz);
      if (filhos.length === 0) return 1;
      return 1 + Math.max(...filhos.map((f) => altura(f.id)));
    };
    if (profundidade(lista, pai.id) + altura(input.id) > MAX_PROFUNDIDADE) {
      return { ok: false, error: `Máximo de ${MAX_PROFUNDIDADE} níveis.` };
    }
  }

  const { error } = await supabase
    .from("localidades")
    .update({ nome, parent_id: input.parentId })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Nome já existe neste nível." };

  await registrarLog(supabase, {
    tabela: "localidades",
    registro_id: input.id,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { nome, parent_id: input.parentId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Exclui nó somente se sem filhos e sem ativos vinculados. */
export async function excluirLocalidade(input: { id: string }): Promise<EstruturaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estrutura.escrever");
  if (!input.id) return { ok: false, error: "Local inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("localidades")
    .select("nome, tipo")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Local não encontrado." };

  const [{ count: filhos }, { count: ativos }] = await Promise.all([
    supabase.from("localidades").select("id", { count: "exact", head: true }).eq("parent_id", input.id).eq("organization_id", ctx.orgId),
    supabase.from("ativos").select("id", { count: "exact", head: true }).eq("localidade_id", input.id).eq("organization_id", ctx.orgId),
  ]);
  if ((filhos ?? 0) > 0) return { ok: false, error: "Não é possível excluir: existem sublocalidades vinculadas. Mova ou exclua os filhos primeiro." };
  if ((ativos ?? 0) > 0) return { ok: false, error: "Não é possível excluir: existem ativos vinculados a esta localidade." };

  const { error } = await supabase
    .from("localidades")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await registrarLog(supabase, {
    tabela: "localidades",
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

function validarAtributos(raw: unknown): AtributoCategoria[] | null {
  if (!Array.isArray(raw) || raw.length > 30) return null;
  const out: AtributoCategoria[] = [];
  for (const a of raw as Record<string, unknown>[]) {
    const nome = typeof a.nome === "string" ? a.nome.trim().slice(0, 60) : "";
    const tipo = a.tipo as TipoAtributo;
    if (nome.length < 1 || !TIPOS_ATR.includes(tipo)) return null;
    const obrigatorio = a.obrigatorio === true;
    const unidade = typeof a.unidade === "string" ? a.unidade.trim().slice(0, 20) || undefined : undefined;
    let opcoes: string[] | undefined;
    if (tipo === "selecao") {
      if (!Array.isArray(a.opcoes)) return null;
      opcoes = (a.opcoes as unknown[])
        .map((o) => String(o).trim().slice(0, 40))
        .filter((o) => o.length > 0)
        .slice(0, 20);
      if (opcoes.length < 2) return null;
    }
    out.push({ nome, tipo, obrigatorio, unidade, opcoes });
  }
  const nomes = out.map((a) => a.nome.toLowerCase());
  if (new Set(nomes).size !== nomes.length) return null;
  return out;
}

/** Cria categoria (ativo/produto) com schema de dados técnicos. */
export async function criarCategoria(input: {
  nome: string;
  tipo: TipoCategoria;
  atributos: unknown;
}): Promise<EstruturaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estrutura.escrever");

  const nome = input.nome.trim().slice(0, 80);
  if (nome.length < 1) return { ok: false, error: "Nome inválido." };
  if (!TIPOS_CAT.includes(input.tipo)) return { ok: false, error: "Tipo inválido." };
  const atributos = validarAtributos(input.atributos);
  if (!atributos) return { ok: false, error: "Atributos inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias")
    .insert({ organization_id: ctx.orgId, nome, tipo: input.tipo, atributos })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Categoria já existe ou falha ao salvar." };

  await registrarLog(supabase, {
    tabela: "categorias",
    registro_id: data.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { nome, tipo: input.tipo, atributos: atributos.length },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Atualiza categoria (histórico de execuções preservado — FASE 3 lê snapshot). */
export async function editarCategoria(input: {
  id: string;
  nome: string;
  atributos: unknown;
  ativa: boolean;
}): Promise<EstruturaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estrutura.escrever");

  const nome = input.nome.trim().slice(0, 80);
  if (!input.id || nome.length < 1) return { ok: false, error: "Dados inválidos." };
  const atributos = validarAtributos(input.atributos);
  if (!atributos) return { ok: false, error: "Atributos inválidos." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("categorias")
    .select("nome, tipo, atributos, ativa")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Categoria não encontrada." };

  const { error } = await supabase
    .from("categorias")
    .update({ nome, atributos, ativa: input.ativa })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Nome já existe ou falha ao salvar." };

  await registrarLog(supabase, {
    tabela: "categorias",
    registro_id: input.id,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { nome, atributos, ativa: input.ativa },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

/** Exclui categoria (ativos/produtos perdem o vínculo, sem apagar dados). */
export async function excluirCategoria(input: { id: string }): Promise<EstruturaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "estrutura.escrever");
  if (!input.id) return { ok: false, error: "Categoria inválida." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("categorias")
    .select("nome, tipo")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Categoria não encontrada." };

  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await registrarLog(supabase, {
    tabela: "categorias",
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
