/**
 * SGA-M — Analytics Queries (I/O layer)
 * BLOCO A: camada compartilhada para dashboard, relatórios, exportação.
 * Todas as queries filtram por organization_id (tenant) e período em UTC convertido de America/Sao_Paulo.
 * RLS: sempre via JWT do usuário (requireOrg), nunca service_role para indicadores de usuário normal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeriodoId } from "./types";
import { getPeriodoRangeBRT } from "./calculations";

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
// Ativos
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
  return Object.fromEntries(map);
}

// ---------------------------------------------------------------------------
// O.S. / Backlog / SLA / MTTR
// ---------------------------------------------------------------------------

export async function queryBacklogOS(ctx: QueryContext) {
  const { count, error } = await ctx.supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .in("os_status", ["aberta", "planejada", "atribuida", "em_execucao", "aguardando_peca", "aguardando_terceiro", "em_validacao"]);
  if (error) throw error;
  return count ?? 0;
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

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

export async function queryEstoqueCritico(ctx: QueryContext) {
  const { data, error } = await ctx.supabase
    .from("produtos")
    .select("estoque_atual, estoque_reservado, estoque_minimo")
    .eq("organization_id", ctx.orgId);
  if (error) throw error;
  let criticos = 0;
  for (const p of data as { estoque_atual: number; estoque_reservado: number; estoque_minimo: number }[]) {
    if (Number(p.estoque_atual) - Number(p.estoque_reservado) <= Number(p.estoque_minimo)) criticos++;
  }
  return criticos;
}

export async function queryValorEstoque(ctx: QueryContext) {
  const { data, error } = await ctx.supabase
    .from("produtos")
    .select("estoque_atual, custo_medio")
    .eq("organization_id", ctx.orgId);
  if (error) throw error;
  return (data as { estoque_atual: number; custo_medio: number }[]).reduce((s, p) => s + Number(p.estoque_atual) * Number(p.custo_medio), 0);
}

// ---------------------------------------------------------------------------
// Top ativos por O.S.
// ---------------------------------------------------------------------------

export async function queryTopAtivos(ctx: QueryContext, limit = 5) {
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
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
