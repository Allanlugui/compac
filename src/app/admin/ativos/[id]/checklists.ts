"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";

export type ChecklistResult = { ok: true; id?: string } | { ok: false; error: string };

/** Cria modelo de checklist (do ativo ou avulso) com itens. */
export async function criarModelo(input: {
  ativoId: string;
  titulo: string;
  itens: string[];
}): Promise<ChecklistResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "checklists.escrever");

  const titulo = input.titulo.trim();
  const itens = input.itens.map((t) => t.trim()).filter((t) => t.length >= 2);
  if (titulo.length < 3 || titulo.length > 120) return { ok: false, error: "Título: 3 a 120 caracteres." };
  if (itens.length === 0 || itens.length > 30) return { ok: false, error: "Informe de 1 a 30 itens." };

  const supabase = await createClient();
  let ativoId: string | null = null;
  if (input.ativoId.trim() !== "") {
    const { data: at } = await supabase
      .from("ativos").select("id").eq("id", input.ativoId.trim())
      .eq("organization_id", ctx.orgId).maybeSingle();
    if (!at) return { ok: false, error: "Ativo não encontrado." };
    ativoId = input.ativoId.trim();
  }

  const { data: modelo, error } = await supabase
    .from("checklist_modelos")
    .insert({ organization_id: ctx.orgId, ativo_id: ativoId, titulo })
    .select("id")
    .single();
  if (error || !modelo) return { ok: false, error: "Falha ao criar modelo." };

  const { error: erroItens } = await supabase.from("checklist_itens").insert(
    itens.map((texto, ordem) => ({ modelo_id: modelo.id, texto, obrigatorio: true, ordem })),
  );
  if (erroItens) return { ok: false, error: "Modelo criado, mas itens falharam." };

  await registrarLog(supabase, {
    tabela: "checklist_modelos", registro_id: modelo.id as string, acao: "INSERT",
    dados_anteriores: null, dados_novos: { titulo, itens: itens.length },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidatePath("/admin/ativos", "layout");
  return { ok: true, id: modelo.id as string };
}

export interface RespostaItem {
  itemId: string;
  ok: boolean | null;
  observacao: string;
}

/** Salva execução de checklist vinculada a um chamado. */
export async function salvarExecucao(input: {
  modeloId: string;
  chamadoId: string;
  respostas: RespostaItem[];
}): Promise<ChecklistResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "checklists.escrever");

  const supabase = await createClient();
  const [{ data: modelo }, { data: chamado }] = await Promise.all([
    supabase.from("checklist_modelos").select("id, organization_id").eq("id", input.modeloId).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("chamados").select("id, ativo_id").eq("id", input.chamadoId).eq("organization_id", ctx.orgId).maybeSingle(),
  ]);
  if (!modelo) return { ok: false, error: "Modelo não encontrado." };
  if (!chamado) return { ok: false, error: "Chamado não encontrado." };

  const { data: exec, error } = await supabase
    .from("checklist_execucoes")
    .insert({
      organization_id: ctx.orgId, modelo_id: input.modeloId,
      chamado_id: input.chamadoId, ativo_id: chamado.ativo_id, executado_por: ctx.email,
    })
    .select("id")
    .single();
  if (error || !exec) return { ok: false, error: "Falha ao salvar execução." };

  const validas = input.respostas.filter((r) => r.itemId);
  if (validas.length > 0) {
    await supabase.from("checklist_respostas").insert(
      validas.map((r) => ({
        execucao_id: exec.id, item_id: r.itemId, ok: r.ok,
        observacao: r.observacao.trim() === "" ? null : r.observacao.trim().slice(0, 500),
      })),
    );
  }

  await registrarLog(supabase, {
    tabela: "checklist_execucoes", registro_id: exec.id as string, acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { modelo_id: input.modeloId, chamado_id: input.chamadoId, itens: validas.length },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidatePath(`/admin/chamados/${input.chamadoId}`);
  return { ok: true, id: exec.id as string };
}
