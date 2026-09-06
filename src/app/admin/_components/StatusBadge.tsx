import { CircleCheck, Hourglass, Ticket } from "lucide-react";
import type { ChamadoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type IconeProps = { className?: string };

const MAPA: Record<
  ChamadoStatus,
  { rotulo: string; classes: string; Icone: (p: IconeProps) => React.ReactNode }
> = {
  aberto: {
    rotulo: "Aberto",
    classes: "bg-amber-100 text-amber-800 ring-amber-200",
    Icone: Ticket,
  },
  em_andamento: {
    rotulo: "Em andamento",
    classes: "bg-sky-100 text-sky-800 ring-sky-200",
    Icone: Hourglass,
  },
  concluido: {
    rotulo: "Concluído",
    classes: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    Icone: CircleCheck,
  },
};

export default function StatusBadge({ status }: { status: ChamadoStatus }) {
  const { rotulo, classes, Icone } = MAPA[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 shadow-sm",
        classes,
      )}
    >
      <Icone className="size-3.5" />
      {rotulo}
    </span>
  );
}
