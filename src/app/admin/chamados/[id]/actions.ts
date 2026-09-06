"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import { notificar } from "@/app/admin/notificacoes/actions";
import type { ChamadoStatus, ImpactoOperacional } from "@/lib/types";

export type AcaoResult = { ok: true } | { ok: false; error: string };

const STATUS_VALIDOS: ChamadoStatus[] = ["aberto", "em_andamento", "concluido"];
const IMPACTOS_VALIDOS: ImpactoOperacional[] = [
  "baixo",
  "medio",
  "alto",
  "critico",
  "parada_total",
];
const MAX_FOTOS_DEPOIS = 12;

function revalidarChamado(chamadoId: string) {
  revalidatePath(`/admin/chamados/${chamadoId}`);
  revalidatePath(`/admin/chamados/${chamadoId}/os`);
  revalidatePath("/admin/dashboard");
}

/** Transição de status. O trigger do banco preenche/limpa `concluido_em`. */
export async function atualizarStatus(input: {
  chamadoId: string;
  status: ChamadoStatus;
}): Promise<AcaoResult> {
  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
  if (!STATUS_VALIDOS.includes(input.status)) {
    return { ok: false, error: "Status inválido." };
  }

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "chamados.executar");

  const { data: atual } = await supabase
    .from("chamados")
    .select("status")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (!atual) return { ok: false, error: "Chamado não encontrado." };

  const { error } = await supabase
    .from("chamados")
    .update({ status: input.status })
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);

  if (error) return { ok: false, error: "Não foi possível atualizar o status." };
  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "STATUS_CHANGE",
    dados_anteriores: { status: atual.status },
    dados_novos: { status: input.status },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  await notificar({
    tipo: "os",
    titulo: `O.S. ${input.status === "concluido" ? "concluída" : input.status === "em_andamento" ? "em execução" : "reaberta"}`,
    descricao: `Chamado atualizado por ${ctx.email}.`,
    link: `/admin/chamados/${input.chamadoId}`,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Define o nível de impacto operacional da ocorrência. */
export async function atualizarImpacto(input: {
  chamadoId: string;
  impacto: ImpactoOperacional | null;
}): Promise<AcaoResult> {
  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
  if (input.impacto !== null && !IMPACTOS_VALIDOS.includes(input.impacto)) {
    return { ok: false, error: "Impacto inválido." };
  }

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "chamados.executar");

  const { data: atual } = await supabase
    .from("chamados")
    .select("impacto")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Chamado não encontrado." };

  const { error } = await supabase
    .from("chamados")
    .update({ impacto: input.impacto })
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar o impacto." };

  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { impacto: input.impacto },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Anexa URLs públicas (já enviadas ao Storage) ao array `fotos_depois`. */
export async function adicionarFotosDepois(input: {
  chamadoId: string;
  urls: string[];
}): Promise<AcaoResult> {
  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
  // Aceita paths do Storage privado (`o/{org}/...`) gerados pelo upload
  // server-side. URLs legadas já gravadas não passam por aqui.
  const novas = (Array.isArray(input.urls) ? input.urls : []).filter(
    (u) => typeof u === "string" && u.startsWith("o/") && !u.includes(".."),
  );
  if (novas.length === 0) {
    return { ok: false, error: "Nenhuma foto válida para anexar." };
  }

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "chamados.executar");

  const { data, error: erroLeitura } = await supabase
    .from("chamados")
    .select("fotos_depois")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (erroLeitura || !data) {
    return { ok: false, error: "Chamado não encontrado." };
  }

  const atuais = Array.isArray(data.fotos_depois) ? data.fotos_depois : [];
  const combinadas = [...atuais, ...novas].slice(0, MAX_FOTOS_DEPOIS);

  const { error } = await supabase
    .from("chamados")
    .update({ fotos_depois: combinadas })
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);

  if (error) return { ok: false, error: "Não foi possível salvar as fotos." };
  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "UPDATE",
    dados_anteriores: null,
    dados_novos: {
      fotos_depois_adicionadas: novas.length,
      total_fotos_depois: combinadas.length,
    },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

export interface RegistrarCompraInput {
  chamadoId: string;
  item: string;
  quantidade: number;
  valorUnitario: number;
  setor: string;
  dataCompra: string;
}

/** Registra insumo/compra vinculado ao chamado (`valor_total` calculado pelo banco). */
export async function registrarCompra(
  input: RegistrarCompraInput,
): Promise<AcaoResult> {
  const item = input.item.trim();
  const setor = input.setor.trim();
  const quantidade = Number(input.quantidade);
  const valorUnitario = Number(input.valorUnitario);

  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
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

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.escrever");

  const { data: chamado } = await supabase
    .from("chamados")
    .select("id")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!chamado) return { ok: false, error: "Chamado não encontrado." };

  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      organization_id: ctx.orgId,
      chamado_id: input.chamadoId,
      item,
      quantidade,
      valor_unitario: valorUnitario,
      setor: setor === "" ? null : setor,
      data_compra: dataCompra,
    })
    .select("id")
    .single();

  if (error || !compra) {
    return { ok: false, error: "Não foi possível registrar a compra." };
  }
  await registrarLog(supabase, {
    tabela: "compras",
    registro_id: compra.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { item, quantidade, chamado_id: input.chamadoId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

export interface AtualizarExecucaoInput {
  chamadoId: string;
  responsavel: string;
  prioridade: string;
  prazo: string;
  diagnostico: string;
  solucao: string;
  horimetro: number | null;
}

const PRIORIDADES = ["baixa", "media", "alta", "critica"];

/** Dados operacionais da O.S.: responsável, prioridade, prazo, diagnóstico. */
export async function atualizarExecucao(
  input: AtualizarExecucaoInput,
): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "chamados.executar");
  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
  if (input.prioridade !== "" && !PRIORIDADES.includes(input.prioridade)) {
    return { ok: false, error: "Prioridade inválida." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("chamados")
    .select("responsavel, prioridade, prazo, diagnostico, solucao, horimetro")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Chamado não encontrado." };

  const patch = {
    responsavel: input.responsavel.trim() === "" ? null : input.responsavel.trim().slice(0, 120),
    prioridade: input.prioridade === "" ? null : input.prioridade,
    prazo: /^\d{4}-\d{2}-\d{2}$/.test(input.prazo) ? input.prazo : null,
    diagnostico: input.diagnostico.trim() === "" ? null : input.diagnostico.trim().slice(0, 2000),
    solucao: input.solucao.trim() === "" ? null : input.solucao.trim().slice(0, 2000),
    horimetro: input.horimetro,
  };

  const { error } = await supabase
    .from("chamados")
    .update(patch)
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar." };

  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: patch as unknown as Record<string, unknown>,
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}
