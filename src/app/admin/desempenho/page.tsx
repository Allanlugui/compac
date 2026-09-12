import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import PageHeader from "@/components/ui/PageHeader";
import { calcScoreAuto, calcScoreFinal } from "@/lib/performance";
import Link from "next/link";

export const metadata = { title: "Desempenho · SGA-M" };

export default async function DesempenhoPage() {
  const supabase = await createClient();
  const ctx = await requireOrg();

  // Métricas automáticas (exemplo técnico)
  const { data: evals } = await supabase.from("performance_evaluations").select("*").eq("organization_id", ctx.orgId).eq("avaliado_membership_id", (await supabase.from("memberships").select("id").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).maybeSingle()).data?.id ?? "").order("periodo_fim", { ascending: false }).limit(5);

  // Métricas reais via performance.ts (reutiliza analytics, não hardcoded)
  // eslint-disable-next-line react-hooks/purity
  const periodo = { inicio: new Date(Date.now() - 30*86400000).toISOString().slice(0,10), fim: new Date().toISOString().slice(0,10) };
  const { getMetricasTecnico } = await import("@/lib/performance");
  const { estado: metricEstado, metricas } = await getMetricasTecnico(ctx.userId, ctx.orgId, periodo).catch(()=>({ estado: "insufficient_data" as const, metricas: null }));
  const auto = metricas ?? { produtividade: null, prazo: null, tempo: null, qualidade: null, eficiencia: null };
  const { score, estado, detalhe } = metricas ? calcScoreAuto(auto as Parameters<typeof calcScoreAuto>[0]) : { score: null, estado: metricEstado, detalhe: "Dados insuficientes" };
  const final = calcScoreFinal(score, null);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Desempenho" descricao={`${ctx.role} · ${ctx.orgNome}`} />
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black">Meu Desempenho</h2>
        <p className="text-sm text-zinc-500">Período: mensal · America/Sao_Paulo</p>
        <div className="mt-4">
          {estado === "insufficient_data" ? (
            <p className="text-amber-700 font-bold">Dados insuficientes — mínimo 5 O.S. concluídas</p>
          ) : (
            <>
              <p className="text-3xl font-black">{score}/100</p>
              <p className="text-sm">Score automático: {score} · Final: {final ?? "—"}</p>
              <p className="text-xs text-zinc-400">{detalhe} · Pesos 25/25/20/20/10 · Métricas derivadas de O.S. reais</p>
              <details className="mt-2 rounded-xl border bg-zinc-50 p-3">
                <summary className="cursor-pointer text-sm font-bold">Como minha nota foi calculada?</summary>
                <p className="mt-1 text-xs text-zinc-600">Período mensal America/Sao_Paulo, métricas: produtividade (O.S. concluídas), prazo (SLA), tempo (TEXEC), qualidade (reincidência), eficiência (consumo). Mínimo 5 O.S.</p>
              </details>
            </>
          )}
        </div>
        <div className="mt-4">
          <h3 className="font-bold">Histórico</h3>
          {evals && evals.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {(evals as { id: string; periodo_inicio: string; score_final: number }[]).map(e => (
                <li key={e.id} className="text-sm">{e.periodo_inicio} — {e.score_final}/100</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Nenhuma avaliação anterior</p>
          )}
        </div>
      </div>
    </div>
  );
}
