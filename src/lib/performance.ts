import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { getSubtree } from "@/lib/hierarchy";

export type PeriodoPerf = "mensal" | "trimestral" | "personalizado";
export type EstadoPerf = "insufficient_data" | "active" | "completed" | "not_rated";

export const PESOS_TECNICO = { produtividade: 25, prazo: 25, tempo: 20, qualidade: 20, eficiencia: 10 };
export const MIN_OS_TECNICO = 5;

export function calcScoreAuto(metricas: { produtividade: number | null; prazo: number | null; tempo: number | null; qualidade: number | null; eficiencia: number | null }, pesos = PESOS_TECNICO): { score: number | null; estado: EstadoPerf; detalhe: string } {
  const vals = [metricas.produtividade, metricas.prazo, metricas.tempo, metricas.qualidade, metricas.eficiencia];
  if (vals.some(v => v === null)) return { score: null, estado: "insufficient_data", detalhe: "Dados insuficientes" };
  const score = Math.round(
    (metricas.produtividade! * pesos.produtividade +
      metricas.prazo! * pesos.prazo +
      metricas.tempo! * pesos.tempo +
      metricas.qualidade! * pesos.qualidade +
      metricas.eficiencia! * pesos.eficiencia) / 100
  );
  return { score, estado: "active", detalhe: `Baseado em ${metricas.produtividade} produtividade` };
}

export function calcScoreFinal(scoreAuto: number | null, scoreGerencial: number | null): number | null {
  if (scoreAuto === null && scoreGerencial === null) return null;
  if (scoreAuto === null) return scoreGerencial;
  if (scoreGerencial === null) return scoreAuto;
  return Math.round((scoreAuto * 0.8 + scoreGerencial * 0.2));
}

// Helpers de métricas reutilizando analytics
export async function getMetricasTecnico(userId: string, orgId: string, periodo: { inicio: string; fim: string }) {
  const supabase = await createClient();
  // O.S. concluídas no período onde responsavel = email (via join profiles)
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  // Simplificado: contar O.S. onde responsavel = email do user
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const email = authUser?.email ?? "";
  const { count: osConcluidas } = await supabase.from("chamados").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("responsavel", email).in("os_status", ["concluida","encerrada"]).gte("data_fim", periodo.inicio).lte("data_fim", periodo.fim);
  if ((osConcluidas ?? 0) < MIN_OS_TECNICO) return { estado: "insufficient_data" as const, metricas: null, count: osConcluidas ?? 0 };
  // SLA: taxa dentro
  const { data: slaData } = await supabase.from("chamados").select("prazo, concluido_em, os_status").eq("organization_id", orgId).eq("responsavel", email).not("prazo","is",null);
  const dentro = slaData?.filter(c => c.concluido_em && c.prazo && c.concluido_em.slice(0,10) <= c.prazo).length ?? 0;
  const prazo = slaData && slaData.length ? Math.round((dentro / slaData.length) * 100) : null;
  // Tempo: reusar analytics calcTempoExecucao
  const tempo = null;
  const qualidade = null;
  const eficiencia = null;
  const metricas = { produtividade: Math.min(100, (osConcluidas ?? 0) * 10), prazo, tempo, qualidade, eficiencia };
  return { estado: "active" as const, metricas, count: osConcluidas ?? 0 };
}

export async function getScopeGestor(gestorMembershipId: string, orgId: string): Promise<string[]> {
  const subtree = await getSubtree(gestorMembershipId, orgId);
  return [gestorMembershipId, ...subtree];
}
