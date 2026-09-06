import type { ImpactoOperacional } from "@/lib/types";
import { cn } from "@/lib/utils";

export const IMPACTOS: { id: ImpactoOperacional; rotulo: string }[] = [
  { id: "baixo", rotulo: "Baixo" },
  { id: "medio", rotulo: "Médio" },
  { id: "alto", rotulo: "Alto" },
  { id: "critico", rotulo: "Crítico" },
  { id: "parada_total", rotulo: "Parada total" },
];

const CLASSES: Record<ImpactoOperacional, string> = {
  baixo: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  medio: "bg-sky-100 text-sky-800 ring-sky-200",
  alto: "bg-amber-100 text-amber-800 ring-amber-200",
  critico: "bg-orange-100 text-orange-800 ring-orange-300",
  parada_total: "bg-red-100 text-red-800 ring-red-300",
};

export function rotuloImpacto(impacto: ImpactoOperacional | null | undefined): string {
  return IMPACTOS.find((i) => i.id === impacto)?.rotulo ?? "Sem impacto";
}

/** Selo colorido do nível de impacto operacional. */
export default function ImpactoBadge({
  impacto,
}: {
  impacto: ImpactoOperacional | null | undefined;
}) {
  if (!impacto) {
    return (
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-400 ring-1 ring-zinc-200">
        Sem impacto
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-black ring-1",
        CLASSES[impacto],
      )}
    >
      {rotuloImpacto(impacto)}
    </span>
  );
}
