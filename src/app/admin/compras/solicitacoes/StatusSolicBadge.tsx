import type { StatusSolicitacao } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAPA: Record<StatusSolicitacao, { rotulo: string; classes: string }> = {
  rascunho: { rotulo: "Rascunho", classes: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  enviada: { rotulo: "Enviada", classes: "bg-sky-100 text-sky-800 ring-sky-200" },
  em_analise: { rotulo: "Em análise", classes: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  aprovada: { rotulo: "Aprovada", classes: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  rejeitada: { rotulo: "Rejeitada", classes: "bg-red-100 text-red-800 ring-red-200" },
  em_cotacao: { rotulo: "Em cotação", classes: "bg-violet-100 text-violet-800 ring-violet-200" },
  pedido_gerado: { rotulo: "Pedido gerado", classes: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  recebida: { rotulo: "Recebida", classes: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  encerrada: { rotulo: "Encerrada", classes: "bg-zinc-200 text-zinc-500 ring-zinc-300" },
  cancelada: { rotulo: "Cancelada", classes: "bg-zinc-200 text-zinc-500 ring-zinc-300" },
  pendente: { rotulo: "Pendente", classes: "bg-amber-100 text-amber-800 ring-amber-200" },
  aprovado: { rotulo: "Aprovado", classes: "bg-sky-100 text-sky-800 ring-sky-200" },
  rejeitado: { rotulo: "Rejeitado", classes: "bg-red-100 text-red-800 ring-red-200" },
  comprado: { rotulo: "Comprado", classes: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
};

/** Selo do workflow da solicitação (novo + legados). */
export default function StatusSolicBadge({ status }: { status: StatusSolicitacao }) {
  const m = MAPA[status] ?? MAPA.pendente;
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1", m.classes)}>
      {m.rotulo}
    </span>
  );
}
