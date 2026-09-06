"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import type { OsTipo } from "@/lib/types";

export type PreventivaResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const TIPOS: OsTipo[] = ["corretiva", "preventiva", "preditiva", "inspecao", "instalacao", "melhoria"];
const UNIDADES = ["dias", "semanas", "meses", "horas", "ciclos"];
const PRIORIDADES = ["baixa", "media", "alta", "critica"];

function revalidar() {
  revalidatePath("/admin/preventivas");
  revalidatePath("/admin/calendario");
}

function somarData(base: Date, freq: number, unidade: string): Date {
  const d = new Date(base);
  if (unidade === "dias" || unidade === "horas" || unidade === "ciclos") d.setDate(d.getDate() + freq);
  else if (unidade === "semanas") d.setDate(d.getDate() + freq * 7);
  else if (unidade === "meses") d.setMonth(d.getMonth() + freq);
  return d;
}

/** Cria plano de manutenção (preventiva real, sem geração fake). */
export async function criarPlano(input: {
  ativoId: string;
  tipo: OsTipo;
  atividade: string;
  frequencia: number;
  unidade: string;
  responsavel?: string;
  checklistModeloId?: string | null;
  ultimaExecucao?: string;
  toleranciaDias: number;
  prioridade?: string;
}): Promise<PreventivaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "preventiva.criar");
  if (!input.ativoId) return { ok: false, error: "Ativo inválido." };
  if (!TIPOS.includes(input.tipo)) return { ok: false, error: "Tipo inválido." };
  const atividade = input.atividade.trim();
  if (atividade.length < 3 || atividade.length > 500) {
    return { ok: false, error: "Atividade: 3 a 500 caracteres." };
  }
  const freq = Number(input.frequencia);
  if (!Number.isInteger(freq) || freq <= 0 || freq > 1200) {
    return { ok: false, error: "Frequência inválida." };
  }
  if (!UNIDADES.includes(input.unidade)) return { ok: false, error: "Unidade inválida." };
  const tol = Number(input.toleranciaDias);
  if (!Number.isInteger(tol) || tol < 0 || tol > 365) {
    return { ok: false, error: "Tolerância inválida." };
  }

  const supabase = await createClient();
  const { data: ativo } = await supabase
    .from("ativos")
    .select("id")
    .eq("id", input.ativoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ativo) return { ok: false, error: "Ativo não encontrado." };

  let checklistId: string | null = null;
  if (input.checklistModeloId) {
    const { data: mod } = await supabase
      .from("checklist_modelos")
      .select("id")
      .eq("id", input.checklistModeloId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!mod) return { ok: false, error: "Checklist inválido." };
    checklistId = input.checklistModeloId;
  }

  const ultima = input.ultimaExecucao && /^\d{4}-\d{2}-\d{2}$/.test(input.ultimaExecucao)
    ? input.ultimaExecucao
    : new Date().toISOString().slice(0, 10);
  const proxima = somarData(new Date(`${ultima}T12:00:00`), freq, input.unidade)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("planos_manutencao")
    .insert({
      organization_id: ctx.orgId,
      ativo_id: input.ativoId,
      tipo: input.tipo,
      atividade,
      frequencia: freq,
      unidade: input.unidade,
      responsavel: ((input.responsavel ?? "").trim() === "" ? null : (input.responsavel ?? "").trim().slice(0, 120)),
      checklist_modelo_id: checklistId,
      ultima_execucao: ultima,
      proxima_execucao: proxima,
      tolerancia_dias: tol,
      prioridade: input.prioridade && PRIORIDADES.includes(input.prioridade) ? input.prioridade : null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível criar o plano." };

  await registrarLog(supabase, {
    tabela: "planos_manutencao",
    registro_id: (data as { id: string }).id,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { ativo_id: input.ativoId, tipo: input.tipo, proxima_execucao: proxima },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true, id: (data as { id: string }).id };
}

/** Edita plano (sem reescrever histórico de execuções). */
export async function editarPlano(input: {
  id: string;
  atividade: string;
  frequencia: number;
  unidade: string;
  responsavel?: string;
  checklistModeloId?: string | null;
  toleranciaDias: number;
  prioridade?: string;
  ativo: boolean;
}): Promise<PreventivaResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "preventiva.editar");
  if (!input.id) return { ok: false, error: "Plano inválido." };

  const atividade = input.atividade.trim();
  if (atividade.length < 3 || atividade.length > 500) {
    return { ok: false, error: "Atividade: 3 a 500 caracteres." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("planos_manutencao")
    .select("id, ultima_execucao")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Plano não encontrado." };

  const freq = Number(input.frequencia);
  const ultima = (atual as { ultima_execucao: string | null }).ultima_execucao ?? new Date().toISOString().slice(0, 10);
  const proxima = somarData(new Date(`${ultima}T12:00:00`), freq, input.unidade).toISOString().slice(0, 10);

  const { error } = await supabase
    .from("planos_manutencao")
    .update({
      atividade,
      frequencia: freq,
      unidade: input.unidade,
      responsavel: ((input.responsavel ?? "").trim() === "" ? null : (input.responsavel ?? "").trim().slice(0, 120)),
      checklist_modelo_id: input.checklistModeloId || null,
      proxima_execucao: proxima,
      tolerancia_dias: Number(input.toleranciaDias) || 0,
      prioridade: input.prioridade && PRIORIDADES.includes(input.prioridade) ? input.prioridade : null,
      ativo: input.ativo,
    })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidar();
  return { ok: true };
}

/**
 * GERAÇÃO MANUAL de O.S. preventiva (explícita — sem scheduler fake).
 * Cria o chamado já convertido (os_status=aberta) vinculado ao plano.
 */
export async function gerarOSPreventiva(input: {
  planoId: string;
}): Promise<{ ok: true; chamadoId: string } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "preventiva.executar");
  if (!input.planoId) return { ok: false, error: "Plano inválido." };

  const supabase = await createClient();
  const { data: plano } = await supabase
    .from("planos_manutencao")
    .select("id, ativo_id, tipo, atividade, responsavel, prioridade")
    .eq("id", input.planoId)
    .eq("organization_id", ctx.orgId)
    .eq("ativo", true)
    .maybeSingle();
  if (!plano) return { ok: false, error: "Plano não encontrado ou inativo." };
  const p = plano as {
    ativo_id: string; tipo: OsTipo; atividade: string;
    responsavel: string | null; prioridade: string | null;
  };

  const { data: ch, error } = await supabase
    .from("chamados")
    .insert({
      organization_id: ctx.orgId,
      ativo_id: p.ativo_id,
      solicitante: "Plano preventivo",
      descricao: p.atividade,
      status: "convertido_os",
      origem: "administrador",
      prioridade: p.prioridade ?? "media",
      responsavel: p.responsavel,
      os_tipo: p.tipo,
      os_status: "aberta",
      plano_id: input.planoId,
      fotos_antes: [],
    })
    .select("id")
    .single();
  if (error || !ch) return { ok: false, error: "Não foi possível gerar a O.S." };

  const chamadoId = (ch as { id: string }).id;
  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: chamadoId,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { plano_id: input.planoId, os_tipo: p.tipo, geracao: "manual" },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  await supabase.from("os_status_historico").insert({
    organization_id: ctx.orgId,
    os_id: chamadoId,
    de: null,
    para: "aberta",
    motivo: "Gerada do plano preventivo",
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true, chamadoId };
}
