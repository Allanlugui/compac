"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import { notificar } from "@/app/admin/notificacoes/actions";
import type {
  ChamadoStatus,
  ImpactoOperacional,
  OsStatus,
  OsTipo,
} from "@/lib/types";

export type AcaoResult = { ok: true } | { ok: false; error: string };

const STATUS_VALIDOS: ChamadoStatus[] = ["aberto", "em_andamento", "concluido"];

/** Transições permitidas da FASE DEMANDA (triagem). Legados migram por aqui. */
const TRANSICOES_CHAMADO: Record<string, string[]> = {
  aberto: ["em_triagem", "cancelado"],
  em_triagem: ["aguardando_informacao", "convertido_os", "resolvido", "cancelado"],
  aguardando_informacao: ["em_triagem", "cancelado"],
  convertido_os: [],
  resolvido: [],
  cancelado: [],
  em_andamento: ["em_triagem", "convertido_os", "resolvido", "cancelado"],
  concluido: [],
};

/** Máquina de estados da O.S. (retornos controlados incluídos). */
const TRANSICOES_OS: Record<OsStatus, OsStatus[]> = {
  aberta: ["planejada"],
  planejada: ["atribuida", "aberta"],
  atribuida: ["em_execucao", "planejada"],
  em_execucao: ["aguardando_peca", "aguardando_terceiro", "em_validacao"],
  aguardando_peca: ["em_execucao"],
  aguardando_terceiro: ["em_execucao"],
  em_validacao: ["em_execucao", "concluida"],
  concluida: ["encerrada", "em_validacao"],
  encerrada: [],
};

const OS_TIPOS: OsTipo[] = ["corretiva", "preventiva", "preditiva", "inspecao", "instalacao", "melhoria"];
const ORIGENS = ["qr", "portal", "administrador", "telefone", "email", "importacao"];
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

/** Transição da DEMANDA (triagem). Mapa fechado — sem saltos arbitrários. */
export async function atualizarStatus(input: {
  chamadoId: string;
  status: ChamadoStatus;
}): Promise<AcaoResult> {
  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
  if (!STATUS_VALIDOS.includes(input.status) && !(input.status in TRANSICOES_CHAMADO)) {
    return { ok: false, error: "Status inválido." };
  }

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "chamados.triagem");

  const { data: atual } = await supabase
    .from("chamados")
    .select("status")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (!atual) return { ok: false, error: "Chamado não encontrado." };
  const de = (atual as { status: string }).status;
  if (!(TRANSICOES_CHAMADO[de] ?? []).includes(input.status)) {
    return { ok: false, error: `Transição inválida: ${de} → ${input.status}.` };
  }

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
    dados_anteriores: { status: de },
    dados_novos: { status: input.status },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  await notificar({
    tipo: "os",
    titulo: `Chamado ${input.status.replace(/_/g, " ")}`,
    descricao: `Chamado atualizado por ${ctx.email}.`,
    link: `/admin/chamados/${input.chamadoId}`,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Define o nível de impacto operacional da ocorrência (triagem). */
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
  exigirPermissao(ctx, "chamados.triagem");

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
  // Metadados (usuário/data/O.S.) na tabela os_fotos; array preservado (legado).
  await supabase.from("os_fotos").insert(
    novas.map((path) => ({
      organization_id: ctx.orgId,
      chamado_id: input.chamadoId,
      path,
      categoria: "depois",
      user_id: ctx.userId,
    })),
  );
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
  exigirPermissao(ctx, "compras.criar");

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
  causa: string;
  causa_raiz: string;
  solucao: string;
  equipe: string;
  supervisor: string;
  horimetro: number | null;
  horimetro_ini: number | null;
  horimetro_fim: number | null;
  horimetro_unidade: string;
}

const PRIORIDADES = ["baixa", "media", "alta", "critica"];

/** Execução da O.S.: problema→diagnóstico→causa→causa raiz→solução. */
export async function atualizarExecucao(
  input: AtualizarExecucaoInput,
): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.executar");
  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
  if (input.prioridade !== "" && !PRIORIDADES.includes(input.prioridade)) {
    return { ok: false, error: "Prioridade inválida." };
  }
  if (input.horimetro_unidade !== "" && !["horas", "km", "ciclos", "unidades"].includes(input.horimetro_unidade)) {
    return { ok: false, error: "Unidade do contador inválida." };
  }
  for (const [rot, v] of [["horímetro", input.horimetro], ["leitura inicial", input.horimetro_ini], ["leitura final", input.horimetro_fim]] as const) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) return { ok: false, error: `${rot} inválido.` };
  }
  // Sem reset configurado: final menor que inicial é erro.
  if (input.horimetro_ini !== null && input.horimetro_fim !== null && input.horimetro_fim < input.horimetro_ini) {
    return { ok: false, error: "Leitura final menor que a inicial (sem reset configurado)." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("chamados")
    .select("responsavel, prioridade, prazo, diagnostico, causa, causa_raiz, solucao, horimetro")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Chamado não encontrado." };

  const patch = {
    responsavel: input.responsavel.trim() === "" ? null : input.responsavel.trim().slice(0, 120),
    equipe: input.equipe.trim() === "" ? null : input.equipe.trim().slice(0, 120),
    supervisor: input.supervisor.trim() === "" ? null : input.supervisor.trim().slice(0, 120),
    prioridade: input.prioridade === "" ? null : input.prioridade,
    prazo: /^\d{4}-\d{2}-\d{2}$/.test(input.prazo) ? input.prazo : null,
    diagnostico: input.diagnostico.trim() === "" ? null : input.diagnostico.trim().slice(0, 2000),
    causa: input.causa.trim() === "" ? null : input.causa.trim().slice(0, 2000),
    causa_raiz: input.causa_raiz.trim() === "" ? null : input.causa_raiz.trim().slice(0, 2000),
    solucao: input.solucao.trim() === "" ? null : input.solucao.trim().slice(0, 2000),
    horimetro: input.horimetro,
    horimetro_ini: input.horimetro_ini,
    horimetro_fim: input.horimetro_fim,
    horimetro_unidade: input.horimetro_unidade === "" ? null : input.horimetro_unidade,
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

/* ================= FASE 3 · O.S. ================= */

const PRIORIDADES_OS = ["baixa", "media", "alta", "critica"];
const CRITICIDADES = ["baixa", "media", "alta", "critica"];

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

/**
 * Sincroniza o status do ativo com a O.S. (§25 do plano):
 *  - em_execucao → em_manutencao (só se operacional)
 *  - concluida/encerrada → operacional (só se em_manutencao)
 *  - em_validacao → em_manutencao (retrabalho; só se operacional)
 * Desativado/inativo/parado/inspeção/instalação NUNCA mudam sozinhos.
 */
async function sincronizarAtivo(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  ctx: { orgId: string; email: string; userId: string },
  chamadoId: string,
  evento: "em_execucao" | "em_validacao" | "concluida" | "encerrada",
): Promise<void> {
  const { data: ch } = await supabase
    .from("chamados")
    .select("ativo_id")
    .eq("id", chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  const ativoId = (ch as { ativo_id: string } | null)?.ativo_id;
  if (!ativoId) return;
  const { data: at } = await supabase
    .from("ativos")
    .select("status")
    .eq("id", ativoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  const atual = (at as { status: string } | null)?.status;
  // (estado atual exigido → destino)
  const regra: Record<string, { de: string; para: string }> = {
    em_execucao: { de: "operacional", para: "em_manutencao" },
    em_validacao: { de: "operacional", para: "em_manutencao" },
    concluida: { de: "em_manutencao", para: "operacional" },
    encerrada: { de: "em_manutencao", para: "operacional" },
  };
  const r = regra[evento];
  if (!r || atual !== r.de) return;
  await supabase
    .from("ativos")
    .update({ status: r.para, updated_at: new Date().toISOString() })
    .eq("id", ativoId)
    .eq("organization_id", ctx.orgId);
  await supabase.from("ativo_status_historico").insert({
    organization_id: ctx.orgId,
    ativo_id: ativoId,
    de: atual,
    para: r.para,
    motivo: "Automático pela O.S.",
    user_id: ctx.userId,
  });
}

/**
 * TRIAGEM: classifica e decide o destino (O.S. / resolver / +info / cancelar).
 * Audita TRIAGEM. Converter cria a O.S. (os_status=aberta).
 */
export async function triarChamado(input: {
  chamadoId: string;
  prioridade: string;
  impacto: string | null;
  criticidade: string;
  categoria: string;
  subcategoria: string;
  departamento: string;
  responsavel: string;
  equipe: string;
  prazo: string;
  decisao: "os" | "resolver" | "info" | "cancelar";
  os_tipo?: OsTipo;
  motivo?: string;
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "chamados.triagem");
  if (!input.chamadoId) return { ok: false, error: "Chamado inválido." };
  if (!PRIORIDADES_OS.includes(input.prioridade)) return { ok: false, error: "Prioridade inválida." };
  if (input.impacto !== null && !(input.impacto === "" || ["baixo", "medio", "alto", "critico", "parada_total"].includes(input.impacto))) {
    return { ok: false, error: "Impacto inválido." };
  }
  if (input.criticidade !== "" && !CRITICIDADES.includes(input.criticidade)) {
    return { ok: false, error: "Criticidade inválida." };
  }
  if (!["os", "resolver", "info", "cancelar"].includes(input.decisao)) {
    return { ok: false, error: "Decisão inválida." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("chamados")
    .select("status, os_status")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Chamado não encontrado." };
  const st = atual as { status: string; os_status: string | null };
  if (st.os_status) return { ok: false, error: "Chamado já convertido em O.S." };

  const destinoStatus =
    input.decisao === "os" ? "convertido_os"
    : input.decisao === "resolver" ? "resolvido"
    : input.decisao === "info" ? "aguardando_informacao"
    : "cancelado";
  if (!(TRANSICOES_CHAMADO[st.status] ?? []).includes(destinoStatus)) {
    return { ok: false, error: `Transição inválida: ${st.status} → ${destinoStatus}.` };
  }

  const patch: Record<string, unknown> = {
    status: destinoStatus,
    prioridade: input.prioridade,
    impacto: input.impacto === "" ? null : input.impacto,
    criticidade: input.criticidade === "" ? null : input.criticidade,
    categoria: texto(input.categoria, 80),
    subcategoria: texto(input.subcategoria, 80),
    departamento: texto(input.departamento, 80),
    responsavel: texto(input.responsavel, 120),
    equipe: texto(input.equipe, 120),
    prazo: /^\d{4}-\d{2}-\d{2}$/.test(input.prazo) ? input.prazo : null,
  };
  if (input.decisao === "os") {
    if (!input.os_tipo || !OS_TIPOS.includes(input.os_tipo)) {
      return { ok: false, error: "Tipo de O.S. inválido." };
    }
    patch.os_tipo = input.os_tipo;
    patch.os_status = "aberta";
  }

  const { error } = await supabase
    .from("chamados")
    .update(patch)
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível registrar a triagem." };

  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "TRIAGEM",
    dados_anteriores: { status: st.status },
    dados_novos: { status: destinoStatus, ...patch, motivo: texto(input.motivo, 300) },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  await notificar({
    tipo: "os",
    titulo: input.decisao === "os" ? "O.S. criada" : `Chamado ${destinoStatus.replace(/_/g, " ")}`,
    descricao: `Triagem por ${ctx.email}.`,
    link: `/admin/chamados/${input.chamadoId}`,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Cria chamado manual (portal/admin/telefone/e-mail) com ativo da org. */
export async function criarChamadoManual(input: {
  ativoId: string;
  solicitante: string;
  contato?: string;
  departamento?: string;
  descricao: string;
  origem: string;
  prioridade: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "chamados.criar");
  if (!input.ativoId) return { ok: false, error: "Ativo inválido." };
  if (!ORIGENS.includes(input.origem) || input.origem === "qr") {
    return { ok: false, error: "Origem inválida." };
  }
  if (!PRIORIDADES_OS.includes(input.prioridade)) {
    return { ok: false, error: "Prioridade inválida." };
  }
  const solicitante = input.solicitante.trim();
  const descricao = input.descricao.trim();
  if (solicitante.length < 2 || solicitante.length > 120) {
    return { ok: false, error: "Solicitante: 2 a 120 caracteres." };
  }
  if (descricao.length < 5 || descricao.length > 2000) {
    return { ok: false, error: "Descrição: 5 a 2000 caracteres." };
  }

  const supabase = await createClient();
  const { data: ativo } = await supabase
    .from("ativos")
    .select("id")
    .eq("id", input.ativoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ativo) return { ok: false, error: "Ativo não encontrado." };

  const { data, error } = await supabase
    .from("chamados")
    .insert({
      organization_id: ctx.orgId,
      ativo_id: input.ativoId,
      solicitante,
      contato: texto(input.contato, 120),
      departamento: texto(input.departamento, 80),
      descricao,
      origem: input.origem,
      prioridade: input.prioridade,
      status: "aberto",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível criar." };

  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: (data as { id: string }).id,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { ativo_id: input.ativoId, origem: input.origem },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado((data as { id: string }).id);
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Transição da O.S. (máquina de estados). Registra histórico append-only,
 * sincroniza o ativo e notifica. `motivo` entra no histórico.
 */
export async function transicaoOS(input: {
  chamadoId: string;
  para: OsStatus;
  motivo?: string;
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.executar");
  if (!input.chamadoId) return { ok: false, error: "O.S. inválida." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("chamados")
    .select("os_status, status")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "O.S. não encontrada." };
  const st = atual as { os_status: OsStatus | null; status: string };
  if (!st.os_status) return { ok: false, error: "Chamado ainda não é O.S." };
  if (!(TRANSICOES_OS[st.os_status] ?? []).includes(input.para)) {
    return { ok: false, error: `Transição inválida: ${st.os_status} → ${input.para}.` };
  }
  const motivo = texto(input.motivo, 300);

  const patch: Record<string, unknown> = { os_status: input.para };
  if (input.para === "em_execucao" && !st) void 0;
  if (input.para === "em_execucao") {
    const { data: ch } = await supabase
      .from("chamados")
      .select("data_inicio")
      .eq("id", input.chamadoId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!(ch as { data_inicio: string | null } | null)?.data_inicio) {
      patch.data_inicio = new Date().toISOString();
    }
  }

  const { error } = await supabase
    .from("chamados")
    .update(patch)
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível avançar a O.S." };

  await supabase.from("os_status_historico").insert({
    organization_id: ctx.orgId,
    os_id: input.chamadoId,
    de: st.os_status,
    para: input.para,
    motivo,
    user_id: ctx.userId,
  });
  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "STATUS_CHANGE",
    dados_anteriores: { os_status: st.os_status },
    dados_novos: { os_status: input.para, motivo },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });

  if (input.para === "em_execucao" || input.para === "em_validacao") {
    await sincronizarAtivo(supabase, ctx, input.chamadoId, input.para);
  }
  await notificar({
    tipo: "os",
    titulo: `O.S. ${input.para.replace(/_/g, " ")}`,
    descricao: `Atualizada por ${ctx.email}.`,
    link: `/admin/chamados/${input.chamadoId}`,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Planejamento da O.S. (planejar). */
export async function atualizarPlanejamento(input: {
  chamadoId: string;
  planejamento: string;
  ferramentas: string;
  previsao_horas: number | null;
  riscos: string;
  responsavel: string;
  equipe: string;
  supervisor: string;
  prazo: string;
  prioridade: string;
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.planejar");
  if (!input.chamadoId) return { ok: false, error: "O.S. inválida." };
  if (input.prioridade !== "" && !PRIORIDADES_OS.includes(input.prioridade)) {
    return { ok: false, error: "Prioridade inválida." };
  }
  const prev = input.previsao_horas;
  if (prev !== null && (!Number.isFinite(prev) || prev <= 0 || prev > 10000)) {
    return { ok: false, error: "Previsão inválida." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("chamados")
    .select("id, os_status")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "O.S. não encontrada." };
  if (!(atual as { os_status: string | null }).os_status) {
    return { ok: false, error: "Chamado ainda não é O.S." };
  }

  const { error } = await supabase
    .from("chamados")
    .update({
      planejamento: texto(input.planejamento, 2000),
      ferramentas: texto(input.ferramentas, 500),
      previsao_horas: prev,
      riscos: texto(input.riscos, 1000),
      responsavel: texto(input.responsavel, 120),
      equipe: texto(input.equipe, 120),
      supervisor: texto(input.supervisor, 120),
      prazo: /^\d{4}-\d{2}-\d{2}$/.test(input.prazo) ? input.prazo : null,
      prioridade: input.prioridade === "" ? null : input.prioridade,
    })
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar." };

  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "UPDATE",
    dados_anteriores: null,
    dados_novos: { planejamento: true },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Registra atividade da execução (linha do tempo operacional). */
export async function registrarAtividade(input: {
  chamadoId: string;
  descricao: string;
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.executar");
  const descricao = input.descricao.trim().slice(0, 500);
  if (!input.chamadoId || descricao.length < 2) {
    return { ok: false, error: "Descreva a atividade (2 a 500 caracteres)." };
  }

  const supabase = await createClient();
  const { data: ch } = await supabase
    .from("chamados")
    .select("id")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ch) return { ok: false, error: "O.S. não encontrada." };

  const { error } = await supabase.from("os_atividades").insert({
    organization_id: ctx.orgId,
    chamado_id: input.chamadoId,
    descricao,
    user_id: ctx.userId,
    executado_por: ctx.email,
  });
  if (error) return { ok: false, error: "Não foi possível registrar." };
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Registra serviço externo (terceiro) — compõe o custo da O.S. */
export async function registrarServico(input: {
  chamadoId: string;
  fornecedor_id?: string | null;
  servico: string;
  valor: number;
  nota?: string;
  data_servico?: string;
  observacao?: string;
  }): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.criar");
  if (!input.chamadoId) return { ok: false, error: "O.S. inválida." };
  const servico = input.servico.trim();
  if (servico.length < 2 || servico.length > 200) {
    return { ok: false, error: "Serviço: 2 a 200 caracteres." };
  }
  const valor = Number(input.valor);
  if (!Number.isFinite(valor) || valor < 0 || valor > 100_000_000) {
    return { ok: false, error: "Valor inválido." };
  }

  const supabase = await createClient();
  const { data: ch } = await supabase
    .from("chamados")
    .select("id")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ch) return { ok: false, error: "O.S. não encontrada." };

  let fornecedor_id: string | null = null;
  if (input.fornecedor_id) {
    const { data: f } = await supabase
      .from("fornecedores")
      .select("id")
      .eq("id", input.fornecedor_id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!f) return { ok: false, error: "Fornecedor inválido." };
    fornecedor_id = input.fornecedor_id;
  }

  const { data, error } = await supabase
    .from("os_servicos_externos")
    .insert({
      organization_id: ctx.orgId,
      chamado_id: input.chamadoId,
      fornecedor_id,
      servico,
      valor,
      nota: texto(input.nota, 60),
      data_servico: input.data_servico && /^\d{4}-\d{2}-\d{2}$/.test(input.data_servico) ? input.data_servico : null,
      observacao: texto(input.observacao, 500),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível registrar." };

  await registrarLog(supabase, {
    tabela: "os_servicos_externos",
    registro_id: (data as { id: string }).id,
    acao: "COST_ADDED",
    dados_anteriores: null,
    dados_novos: { servico, valor, chamado_id: input.chamadoId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Exclui serviço externo (aprovação). */
export async function excluirServico(input: { id: string; chamadoId: string }): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.aprovar");
  if (!input.id || !input.chamadoId) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("os_servicos_externos")
    .delete()
    .eq("id", input.id)
    .eq("chamado_id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Custos diretos da O.S. (mão de obra + outros). Materiais/terceiros derivam. */
export async function atualizarCustosDiretos(input: {
  chamadoId: string;
  custo_mao_obra: number;
  custo_outros: number;
  custo_outros_desc: string;
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.aprovar");
  if (!input.chamadoId) return { ok: false, error: "O.S. inválida." };
  const mo = Number(input.custo_mao_obra);
  const outros = Number(input.custo_outros);
  if (!Number.isFinite(mo) || mo < 0 || mo > 100_000_000) return { ok: false, error: "Mão de obra inválida." };
  if (!Number.isFinite(outros) || outros < 0 || outros > 100_000_000) return { ok: false, error: "Outros inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("chamados")
    .update({
      custo_mao_obra: mo,
      custo_outros: outros,
      custo_outros_desc: texto(input.custo_outros_desc, 200),
    })
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar." };

  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "COST_ADDED",
    dados_anteriores: null,
    dados_novos: { custo_mao_obra: mo, custo_outros: outros },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Foto DURANTE (metadados: usuário, data, O.S.). */
export async function adicionarFotosDurante(input: {
  chamadoId: string;
  paths: string[];
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.executar");
  if (!input.chamadoId) return { ok: false, error: "O.S. inválida." };

  const prefixo = `o/${ctx.orgId}/os/${input.chamadoId}/`;
  const validos = (Array.isArray(input.paths) ? input.paths : [])
    .filter((p) => typeof p === "string" && p.startsWith(prefixo) && !p.includes(".."))
    .slice(0, 12);
  if (validos.length === 0) return { ok: false, error: "Nenhuma foto válida." };

  const supabase = await createClient();
  const { error } = await supabase.from("os_fotos").insert(
    validos.map((path) => ({
      organization_id: ctx.orgId,
      chamado_id: input.chamadoId,
      path,
      categoria: "durante",
      user_id: ctx.userId,
    })),
  );
  if (error) return { ok: false, error: "Não foi possível anexar." };

  await registrarLog(supabase, {
    tabela: "os_fotos",
    registro_id: input.chamadoId,
    acao: "FOTO_ADICIONADA",
    dados_anteriores: null,
    dados_novos: { categoria: "durante", total: validos.length },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/** Itens obrigatórios de checklist pendentes (bloqueiam conclusão). */
async function pendenciaChecklist(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  ctx: { orgId: string },
  chamadoId: string,
  ativoId: string,
): Promise<string | null> {
  const { data: modelos } = await supabase
    .from("checklist_modelos")
    .select("id, checklist_itens(id, texto, tipo, obrigatorio)")
    .eq("organization_id", ctx.orgId)
    .or(`ativo_id.eq.${ativoId},ativo_id.is.null`);
  const lista = (modelos ?? []) as {
    id: string;
    checklist_itens: { id: string; texto: string; tipo: string; obrigatorio: boolean }[];
  }[];
  const obrigatorios = lista.flatMap((m) =>
    m.checklist_itens.filter((i) => i.obrigatorio).map((i) => ({ ...i, modelo_id: m.id })),
  );
  if (obrigatorios.length === 0) return null;

  const { data: execs } = await supabase
    .from("checklist_execucoes")
    .select("id, modelo_id")
    .eq("chamado_id", chamadoId)
    .eq("organization_id", ctx.orgId)
    .eq("status", "concluida");
  if (!execs || execs.length === 0) {
    return `Checklist pendente: "${obrigatorios[0].texto}".`;
  }
  const execIds = (execs as { id: string }[]).map((e) => e.id);
  const { data: resps } = await supabase
    .from("checklist_respostas")
    .select("item_id, ok, valor")
    .in("execucao_id", execIds);
  const respondidos = new Set(
    ((resps ?? []) as { item_id: string; ok: boolean | null; valor: string | null }[])
      .filter((r) => r.ok !== null || (r.valor ?? "") !== "")
      .map((r) => r.item_id),
  );
  const pendente = obrigatorios.find((i) => !respondidos.has(i.id));
  return pendente ? `Checklist pendente: "${pendente.texto}".` : null;
}

/**
 * CONCLUIR O.S. (validação): exige diagnóstico, solução, responsável e
 * checklists obrigatórios completos. Move para `concluida`.
 */
export async function concluirOS(input: { chamadoId: string }): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.concluir");
  if (!input.chamadoId) return { ok: false, error: "O.S. inválida." };

  const supabase = await createClient();
  const { data: ch } = await supabase
    .from("chamados")
    .select("id, ativo_id, os_status, diagnostico, solucao, responsavel, data_fim")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ch) return { ok: false, error: "O.S. não encontrada." };
  const os = ch as {
    ativo_id: string; os_status: string | null; diagnostico: string | null;
    solucao: string | null; responsavel: string | null; data_fim: string | null;
  };
  if (os.os_status !== "em_validacao") {
    return { ok: false, error: "Leve a O.S. para validação antes de concluir." };
  }
  if (!os.diagnostico || !os.solucao || !os.responsavel) {
    return { ok: false, error: "Exigido: diagnóstico, solução e responsável." };
  }
  const pendencia = await pendenciaChecklist(supabase, ctx, input.chamadoId, os.ativo_id);
  if (pendencia) return { ok: false, error: pendencia };

  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("chamados")
    .update({ os_status: "concluida", data_fim: os.data_fim ?? agora })
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível concluir." };

  await supabase.from("os_status_historico").insert({
    organization_id: ctx.orgId,
    os_id: input.chamadoId,
    de: "em_validacao",
    para: "concluida",
    user_id: ctx.userId,
  });
  await sincronizarAtivo(supabase, ctx, input.chamadoId, "concluida");
  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "OS_CONCLUIDA",
    dados_anteriores: { os_status: "em_validacao" },
    dados_novos: { os_status: "concluida" },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  await notificar({
    tipo: "os",
    titulo: "O.S. concluída",
    descricao: `Validada por ${ctx.email}.`,
    link: `/admin/chamados/${input.chamadoId}`,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}

/**
 * ENCERRAR O.S.: `concluida` → `encerrada` + demanda `resolvido`
 * (preenche conclusão) + ativo volta a operacional + plano atualizado.
 */
export async function encerrarOS(input: { chamadoId: string }): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.encerrar");
  if (!input.chamadoId) return { ok: false, error: "O.S. inválida." };

  const supabase = await createClient();
  const { data: ch } = await supabase
    .from("chamados")
    .select("id, os_status, plano_id")
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ch) return { ok: false, error: "O.S. não encontrada." };
  const os = ch as { os_status: string | null; plano_id: string | null };
  if (os.os_status !== "concluida") {
    return { ok: false, error: "Só O.S. concluída pode ser encerrada." };
  }

  const { error } = await supabase
    .from("chamados")
    .update({ os_status: "encerrada", status: "resolvido" })
    .eq("id", input.chamadoId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível encerrar." };

  await supabase.from("os_status_historico").insert({
    organization_id: ctx.orgId,
    os_id: input.chamadoId,
    de: "concluida",
    para: "encerrada",
    user_id: ctx.userId,
  });
  await registrarLog(supabase, {
    tabela: "chamados",
    registro_id: input.chamadoId,
    acao: "OS_CONCLUIDA",
    dados_anteriores: { os_status: "concluida", status: null },
    dados_novos: { os_status: "encerrada", status: "resolvido" },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });

  await sincronizarAtivo(supabase, ctx, input.chamadoId, "encerrada");

  // Preventiva: última execução = hoje; próxima = hoje + frequência.
  if (os.plano_id) {
    const { data: plano } = await supabase
      .from("planos_manutencao")
      .select("frequencia, unidade, tolerancia_dias")
      .eq("id", os.plano_id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (plano) {
      const p = plano as { frequencia: number; unidade: string; tolerancia_dias: number };
      const hoje = new Date();
      const prox = new Date(hoje);
      if (p.unidade === "dias") prox.setDate(prox.getDate() + p.frequencia);
      else if (p.unidade === "semanas") prox.setDate(prox.getDate() + p.frequencia * 7);
      else if (p.unidade === "meses") prox.setMonth(prox.getMonth() + p.frequencia);
      else prox.setDate(prox.getDate() + p.frequencia); // horas/ciclos: sem conversão
      await supabase
        .from("planos_manutencao")
        .update({
          ultima_execucao: hoje.toISOString().slice(0, 10),
          proxima_execucao: prox.toISOString().slice(0, 10),
        })
        .eq("id", os.plano_id)
        .eq("organization_id", ctx.orgId);
    }
  }

  await notificar({
    tipo: "os",
    titulo: "O.S. encerrada",
    descricao: `Encerrada por ${ctx.email}.`,
    link: `/admin/chamados/${input.chamadoId}`,
  });
  revalidarChamado(input.chamadoId);
  return { ok: true };
}
