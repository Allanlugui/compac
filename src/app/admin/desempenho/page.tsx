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

  const auto = { produtividade: 85, prazo: 90, tempo: 75, qualidade: 80, eficiencia: 90 };
  const { score, estado, detalhe } = calcScoreAuto(auto);
  const final = calcScoreFinal(score, 88);

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
              <p className="text-sm">Score automático: {score} · Score gerencial: 88 · Final: {final}</p>
              <p className="text-xs text-zinc-400">{detalhe} · Pesos 25/25/20/20/10</p>
              <Link href="#" className="text-sm font-bold underline">Como minha nota foi calculada?</Link>
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
