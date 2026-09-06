import { cn } from "@/lib/utils";

type Tom = "amber" | "sky" | "emerald" | "violet" | "rose" | "zinc";

export type { Tom };

const CHIP: Record<Tom, string> = {
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  rose: "bg-rose-100 text-rose-700",
  zinc: "bg-zinc-900 text-white",
};

/**
 * Cartão de indicador do Design System.
 * Grade responsiva definida pelo consumidor (2 → 4 colunas).
 */
export default function StatCard({
  rotulo,
  valor,
  detalhe,
  Icone,
  tom = "zinc",
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  Icone: (p: { className?: string }) => React.ReactNode;
  tom?: Tom;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          CHIP[tom],
        )}
      >
        <Icone className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xl leading-none font-extrabold text-zinc-900 tabular-nums">
          {valor}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-zinc-500">
          {rotulo}
          {detalhe && <span className="text-zinc-400"> · {detalhe}</span>}
        </p>
      </div>
    </div>
  );
}
