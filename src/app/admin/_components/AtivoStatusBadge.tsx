import type { AtivoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROTULOS: Record<AtivoStatus, string> = {
  operacional: "Operacional",
  em_manutencao: "Em manutenção",
  parado: "Parado",
  em_instalacao: "Em instalação",
  em_inspecao: "Em inspeção",
  inativo: "Inativo",
  desativado: "Desativado",
};

const CLASSES: Record<AtivoStatus, string> = {
  operacional: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  em_manutencao: "bg-amber-100 text-amber-800 ring-amber-200",
  parado: "bg-red-100 text-red-800 ring-red-200",
  em_instalacao: "bg-sky-100 text-sky-800 ring-sky-200",
  em_inspecao: "bg-violet-100 text-violet-800 ring-violet-200",
  inativo: "bg-zinc-200 text-zinc-500 ring-zinc-300",
  desativado: "bg-zinc-800 text-zinc-200 ring-zinc-700",
};

export function rotuloAtivoStatus(s: string | null | undefined): string {
  return (ROTULOS as Record<string, string>)[s ?? ""] ?? "—";
}

/** Selo do status operacional do ativo. */
export default function AtivoStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "operacional") as AtivoStatus;
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black ring-1", CLASSES[s] ?? CLASSES.operacional)}>
      {rotuloAtivoStatus(s)}
    </span>
  );
}
