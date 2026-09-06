import { Ban, CircleCheck, ClipboardCheck, Hourglass, Search, Ticket, Wrench } from "lucide-react";
import type { ChamadoStatus, OsStatus } from "@/lib/types";
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
  em_triagem: {
    rotulo: "Em triagem",
    classes: "bg-yellow-100 text-yellow-800 ring-yellow-200",
    Icone: Search,
  },
  aguardando_informacao: {
    rotulo: "Aguard. info",
    classes: "bg-orange-100 text-orange-800 ring-orange-200",
    Icone: Hourglass,
  },
  convertido_os: {
    rotulo: "Virou O.S.",
    classes: "bg-sky-100 text-sky-800 ring-sky-200",
    Icone: Wrench,
  },
  resolvido: {
    rotulo: "Resolvido",
    classes: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    Icone: CircleCheck,
  },
  cancelado: {
    rotulo: "Cancelado",
    classes: "bg-zinc-200 text-zinc-500 ring-zinc-300",
    Icone: Ban,
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
  const { rotulo, classes, Icone } = MAPA[status] ?? MAPA.aberto;
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

const MAPA_OS: Record<OsStatus, { rotulo: string; classes: string }> = {
  aberta: { rotulo: "O.S. aberta", classes: "bg-sky-100 text-sky-800 ring-sky-200" },
  planejada: { rotulo: "Planejada", classes: "bg-violet-100 text-violet-800 ring-violet-200" },
  atribuida: { rotulo: "Atribuída", classes: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  em_execucao: { rotulo: "Em execução", classes: "bg-amber-100 text-amber-800 ring-amber-200" },
  aguardando_peca: { rotulo: "Ag. peça", classes: "bg-orange-100 text-orange-800 ring-orange-200" },
  aguardando_terceiro: { rotulo: "Ag. terceiro", classes: "bg-orange-100 text-orange-800 ring-orange-200" },
  em_validacao: { rotulo: "Em validação", classes: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  concluida: { rotulo: "Concluída", classes: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  encerrada: { rotulo: "Encerrada", classes: "bg-zinc-200 text-zinc-500 ring-zinc-300" },
};

/** Selo do ciclo de vida da O.S. */
export function OsStatusBadge({ status }: { status: OsStatus | null | undefined }) {
  if (!status) return null;
  const m = MAPA_OS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 shadow-sm", m.classes)}>
      <ClipboardCheck className="size-3.5" />
      {m.rotulo}
    </span>
  );
}
