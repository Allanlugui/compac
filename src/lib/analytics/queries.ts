/**
 * SGA-M — Analytics Queries (I/O layer)
 * BLOCO B: camada compartilhada para dashboard, relatórios, exportação.
 * Todas as queries filtram por organization_id (tenant) e período em UTC convertido de America/Sao_Paulo.
 * RLS: sempre via JWT do usuário (requireOrg), nunca service_role para indicadores de usuário normal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeriodoId } from "./types";
import { calcCustoOS, calcMTBFIntervalsMs, getPeriodoRangeBRT } from "./calculations";

export type QueryContext = {
  supabase: SupabaseClient;
  orgId: string;
  periodo: PeriodoId;
  hoje?: Date;
  personalizado?: { inicio: string; fim: string };
};

function getRange(ctx: QueryContext) {
  return getPeriodoRangeBRT(ctx.periodo, ctx.hoje, ctx.personalizado);
}

// ---------------------------------------------------------------------------
// N1 — Saúde
// ---------------------------------------------------------------------------

export async function queryTotalAtivos(ctx: QueryContext) {
  const { count, error } = await ctx.supabase
    .from("ativos")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId);
  if (error) throw error;
  return count ?? 0;
}

export async function queryAtivosPorStatus(ctx: QueryContext) {
  const { data, error } = await ctx.supabase
    .from("ativos")
    .select("status")
    .eq("organization_id", ctx.orgId);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const r of data as { status: string }[]) map.set(r.status, (map.get(r.status) ?? 0) + 1);
  return Object.fromEntries(map) as Record<string, number>;
}

export async function queryAtivosCriticos(ctx: QueryContext) {
  const { data, error } = await ctx.supabase
    .from("ativos")
    .select("criticidade, status")
    .eq("organization_id", ctx.orgId);
  if (error) throw error;
  let criticos = 0;
  for (const r of data as { criticidade: string | null; status: string }[]) {
    if (r.criticidade === "alta" || r.criticidade === "critica" || r.status === "parado") criticos++;
  }
  return criticos;
}

export async function queryDisponibilidade(ctx: QueryContext) {
  // BLOCO A: sem histórico contínuo suficiente → insufficient_data
  // Estrutura pronta, não calcular valor falso
  void ctx;
  return { value: null as number | null, state: "insufficient_data" as const };
}

// ---------------------------------------------------------------------------
// N2 — Eficiência
// ---------------------------------------------------------------------------

export async function queryOSAbetas(ctx: QueryContext) {
  const { inicio, fim } = getRange(ctx);
  const { count, error } = await ctx.supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .in("os_status", ["aberta", "planejada", "atribuida", "em_execucao", "aguardando_peca", "aguardando_terceiro", "em_validacao"])
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function queryBacklogOS(ctx: QueryContext) {
  const { count, error } = await ctx.supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .in("os_status", ["aberta", "planejada", "atribuida", "em_execucao", "aguardando_peca", "aguardando_terceiro", "em_validacao"]);
  if (error) throw error;
  return count ?? 0;
}

export async function queryBacklogDemanda(ctx: QueryContext) {
  const { count, error } = await ctx.supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .in("status", ["aberto", "em_triagem", "aguardando_informacao", "convertido_os", "em_andamento"]);
  if (error) throw error;
  return count ?? 0;
}

export async function querySLA(ctx: QueryContext) {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const { data, error } = await ctx.supabase
    .from("chamados")
    .select("prazo, concluido_em, os_status, status")
    .eq("organization_id", ctx.orgId)
    .not("prazo", "is", null);
  if (error) throw error;
  let dentro = 0;
  let proximo = 0;
  let atrasado = 0;
  let semPrazo = 0;
  for (const r of data as { prazo: string | null; concluido_em: string | null; os_status: string | null; status: string }[]) {
    if (r.status === "cancelado") continue;
    if (!r.prazo) {
      semPrazo++;
      continue;
    }
    if (r.concluido_em) {
      if (r.concluido_em.slice(0, 10) <= r.prazo) dentro++;
      else atrasado++;
    } else if (r.os_status === "concluida" || r.os_status === "encerrada") {
      dentro++;
    } else if (r.prazo < hojeISO) {
      atrasado++;
    } else {
      const diff = Math.floor((new Date(r.prazo).getTime() - new Date(hojeISO).getTime()) / 86400000);
      if (diff >= 0 && diff <= 2) proximo++;
      else dentro++;
    }
  }
  const totalComPrazo = dentro + proximo + atrasado;
  const taxaDentro = totalComPrazo > 0 ? (dentro / totalComPrazo) * 100 : null;
  return { dentro, proximo, atrasado, semPrazo, totalComPrazo, taxaDentro };
}

export async function queryMTTR(ctx: QueryContext) {
  const { inicio, fim } = getRange(ctx);
  const { data, error } = await ctx.supabase
    .from("chamados")
    .select("created_at, concluido_em")
    .eq("organization_id", ctx.orgId)
    .in("status", ["resolvido", "concluido"])
    .not("concluido_em", "is", null)
    .not("os_status", "is", null)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString());
  if (error) throw error;
  const durations = (data as { created_at: string; concluido_em: string }[])
    .map((r) => new Date(r.concluido_em).getTime() - new Date(r.created_at).getTime())
    .filter((d) => d >= 0);
  if (durations.length === 0) return { value: null, state: "insufficient_data" as const };
  const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
  return { value: avg, state: "ok" as const };
}

export async function queryTempoExecucao(ctx: QueryContext) {
  const { inicio, fim } = getRange(ctx);
  const { data, error } = await ctx.supabase
    .from("chamados")
    .select("data_inicio, data_fim")
    .eq("organization_id", ctx.orgId)
    .not("data_inicio", "is", null)
    .not("data_fim", "is", null)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString());
  if (error) throw error;
  const durations = (data as { data_inicio: string; data_fim: string }[])
    .map((r) => new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime())
    .filter((d) => d >= 0);
  if (durations.length === 0) return { value: null, state: "insufficient_data" as const };
  const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
  return { value: avg, state: "ok" as const };
}

export async function queryMTBF(ctx: QueryContext) {
  const { inicio, fim } = getRange(ctx);
  const { data, error } = await ctx.supabase
    .from("chamados")
    .select("ativo_id, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("os_tipo", "corretiva")
    .in("status", ["resolvido", "concluido"])
    .not("ativo_id", "is", null)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;
  const porAtivo = new Map<string, number[]>();
  for (const r of data as { ativo_id: string; created_at: string }[]) {
    const arr = porAtivo.get(r.ativo_id) ?? [];
    arr.push(new Date(r.created_at).getTime());
    porAtivo.set(r.ativo_id, arr);
  }
  const mtbfs: number[] = [];
  for (const times of porAtivo.values()) {
    if (times.length < 3) continue;
    const intervalos: number[] = [];
    for (let i = 1; i < times.length; i++) intervalos.push(times[i] - times[i - 1]);
    const mtbf = calcMTBFIntervalsMs(intervalos);
    if (mtbf !== null) mtbfs.push(mtbf);
  }
  if (mtbfs.length === 0) return { value: null, state: "insufficient_data" as const };
  const avg = mtbfs.reduce((s, v) => s + v, 0) / mtbfs.length;
  return { value: avg, state: "ok" as const };
}

// ---------------------------------------------------------------------------
// N3 — Recursos
// ---------------------------------------------------------------------------

export async function queryEstoqueResumo(ctx: QueryContext) {
  const { data, error } = await ctx.supabase
    .from("produtos")
    .select("estoque_atual, estoque_reservado, estoque_minimo, ponto_reposicao, custo_medio")
    .eq("organization_id", ctx.orgId);
  if (error) throw error;
  let disponivel = 0;
  let criticos = 0;
  let abaixoReposicao = 0;
  let valorFisico = 0;
  for (const p of data as { estoque_atual: number; estoque_reservado: number; estoque_minimo: number; ponto_reposicao: number; custo_medio: number }[]) {
    const disp = Number(p.estoque_atual) - Number(p.estoque_reservado);
    disponivel += disp;
    if (disp <= Number(p.estoque_minimo)) criticos++;
    if (disp <= Number(p.ponto_reposicao)) abaixoReposicao++;
    valorFisico += Number(p.estoque_atual) * Number(p.custo_medio ?? 0);
  }
  return { disponivel, criticos, abaixoReposicao, valorFisico, total: data.length };
}

export async function querySolicitacoesPendentes(ctx: QueryContext) {
  const { count, error } = await ctx.supabase
    .from("solicitacoes_compra")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .in("status", ["rascunho", "enviada", "em_analise", "em_cotacao"]);
  if (error) throw error;
  return count ?? 0;
}

export async function queryTopAtivos(ctx: QueryContext, limit = 10) {
  const { inicio, fim } = getRange(ctx);
  const { data, error } = await ctx.supabase
    .from("chamados")
    .select("ativo_id")
    .eq("organization_id", ctx.orgId)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .not("ativo_id", "is", null);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const r of data as { ativo_id: string }[]) map.set(r.ativo_id, (map.get(r.ativo_id) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit) as [string, number][];
}

export async function queryTopAtivosPorCusto(ctx: QueryContext, limit = 10) {
  const { inicio, fim } = getRange(ctx);
  const { data: chamados, error: e1 } = await ctx.supabase
    .from("chamados")
    .select("id, ativo_id, custo_mao_obra, custo_outros")
    .eq("organization_id", ctx.orgId)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .not("ativo_id", "is", null);
  if (e1) throw e1;
  const { data: servicos, error: e2 } = await ctx.supabase
    .from("os_servicos_externos")
    .select("chamado_id, valor")
    .eq("organization_id", ctx.orgId);
  if (e2) throw e2;
  const servMap = new Map<string, number>();
  for (const s of servicos as { chamado_id: string; valor: number }[]) servMap.set(s.chamado_id, (servMap.get(s.chamado_id) ?? 0) + Number(s.valor));
  const custoPorAtivo = new Map<string, number>();
  for (const c of chamados as { id: string; ativo_id: string; custo_mao_obra: number; custo_outros: number }[]) {
    const custo = calcCustoOS(Number(c.custo_mao_obra), Number(c.custo_outros), servMap.get(c.id) ?? 0, 0);
    custoPorAtivo.set(c.ativo_id, (custoPorAtivo.get(c.ativo_id) ?? 0) + custo);
  }
  return [...custoPorAtivo.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit) as [string, number][];
}

export async function queryTopAtivosPorReincidencia(ctx: QueryContext, limit = 10) {
  const { inicio, fim } = getRange(ctx);
  const { data, error } = await ctx.supabase
    .from("chamados")
    .select("ativo_id, categoria, created_at, concluido_em")
    .eq("organization_id", ctx.orgId)
    .eq("os_tipo", "corretiva")
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .not("ativo_id", "is", null);
  if (error) throw error;
  const porAtivo = new Map<string, { categoria: string | null; concluido_em: string | null; created_at: string }[]>();
  for (const r of data as { ativo_id: string; categoria: string | null; created_at: string; concluido_em: string | null }[]) {
    const arr = porAtivo.get(r.ativo_id) ?? [];
    arr.push({ categoria: r.categoria, concluido_em: r.concluido_em, created_at: r.created_at });
    porAtivo.set(r.ativo_id, arr);
  }
  const reincMap = new Map<string, number>();
  for (const [ativoId, lista] of porAtivo) {
    lista.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let reinc = 0;
    for (let i = 1; i < lista.length; i++) {
      const cur = lista[i];
      const prev = lista.slice(0, i);
      const hist = prev.map((p) => ({ ativo_id: ativoId, categoria: p.categoria, concluido_em: p.concluido_em }));
      // isReincidencia usa categoria da ocorrência
      const isReinc = hist.some((h) => {
        if (!h.concluido_em) return false;
        if (cur.categoria && h.categoria && cur.categoria !== h.categoria) return false;
        const diff = new Date(cur.created_at).getTime() - new Date(h.concluido_em).getTime();
        return diff > 0 && diff < 90 * 86400000;
      });
      if (isReinc) reinc++;
    }
    if (reinc > 0) reincMap.set(ativoId, reinc);
  }
  return [...reincMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit) as [string, number][];
}

export async function queryConsumoPorProduto(ctx: QueryContext, limit = 10) {
  const { inicio, fim } = getRange(ctx);
  const { data, error } = await ctx.supabase
    .from("movimentacoes_estoque")
    .select("produto_id, quantidade, custo_unitario")
    .eq("organization_id", ctx.orgId)
    .eq("tipo", "consumo")
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString());
  if (error) throw error;
  const mapQtd = new Map<string, number>();
  const mapValor = new Map<string, number>();
  for (const r of data as { produto_id: string; quantidade: number; custo_unitario: number }[]) {
    mapQtd.set(r.produto_id, (mapQtd.get(r.produto_id) ?? 0) + Number(r.quantidade));
    mapValor.set(r.produto_id, (mapValor.get(r.produto_id) ?? 0) + Number(r.quantidade) * Number(r.custo_unitario));
  }
  const qtdRanking = [...mapQtd.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const valorRanking = [...mapValor.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  return { porQuantidade: qtdRanking as [string, number][], porValor: valorRanking as [string, number][] };
}

// ---------------------------------------------------------------------------
// N4 — Custos
// ---------------------------------------------------------------------------

export async function queryCustoTotal(ctx: QueryContext) {
  const { inicio, fim } = getRange(ctx);
  const { data: chamados, error: e1 } = await ctx.supabase
    .from("chamados")
    .select("id, custo_mao_obra, custo_outros")
    .eq("organization_id", ctx.orgId)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .neq("status", "cancelado");
  if (e1) throw e1;
  const { data: servicos, error: e2 } = await ctx.supabase
    .from("os_servicos_externos")
    .select("chamado_id, valor")
    .eq("organization_id", ctx.orgId);
  if (e2) throw e2;
  const { data: movs, error: e3 } = await ctx.supabase
    .from("movimentacoes_estoque")
    .select("chamado_id, quantidade, custo_unitario")
    .eq("organization_id", ctx.orgId)
    .eq("tipo", "consumo")
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .not("chamado_id", "is", null);
  if (e3) throw e3;
  const servMap = new Map<string, number>();
  for (const s of servicos as { chamado_id: string; valor: number }[]) servMap.set(s.chamado_id, (servMap.get(s.chamado_id) ?? 0) + Number(s.valor));
  const movMap = new Map<string, number>();
  for (const m of movs as { chamado_id: string; quantidade: number; custo_unitario: number }[]) {
    movMap.set(m.chamado_id, (movMap.get(m.chamado_id) ?? 0) + Number(m.quantidade) * Number(m.custo_unitario));
  }
  let total = 0;
  for (const c of chamados as { id: string; custo_mao_obra: number; custo_outros: number }[]) {
    total += calcCustoOS(Number(c.custo_mao_obra), Number(c.custo_outros), servMap.get(c.id) ?? 0, movMap.get(c.id) ?? 0);
  }
  return total;
}
