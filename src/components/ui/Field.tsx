import { CAMPO_BASE, TEXT_ROTULO } from "./tokens";
import { cn } from "@/lib/utils";

/**
 * BLOCO 3.6 — Campo com rótulo + dica + erro (consolida labels repetidos).
 * Envolve input/select/textarea nativos com a classe canônica.
 */
export default function Field({
  rotulo,
  dica,
  erro,
  children,
  className,
}: {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={TEXT_ROTULO}>{rotulo}</span>
      {children}
      {dica && !erro && <span className="mt-1 block text-[11px] text-zinc-400">{dica}</span>}
      {erro && <span className="mt-1 block text-[11px] font-bold text-red-600">{erro}</span>}
    </label>
  );
}

export { CAMPO_BASE };
export { TEXT_ROTULO };
