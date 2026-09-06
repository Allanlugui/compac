"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { aprovarPedido, cancelarPedido, encerrarPedido } from "../actions";
import type { StatusPedido } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Workflow do pedido: aprovar → receber → encerrar (+cancelar). */
export default function PedidoWorkflow({
  pedidoId,
  statusAtual,
  podeAprovar,
}: {
  pedidoId: string;
  statusAtual: StatusPedido;
  podeAprovar: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: "aprovar" | "cancelar" | "encerrar") {
    if (ocupado) return;
    if (acao !== "aprovar" && !confirm(`Confirmar ${acao} do pedido?`)) return;
    setErro(null);
    setOcupado(acao);
    try {
      const r =
        acao === "aprovar"
          ? await aprovarPedido({ id: pedidoId })
          : acao === "cancelar"
            ? await cancelarPedido({ id: pedidoId })
            : await encerrarPedido({ id: pedidoId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  if (!podeAprovar) {
    return <p className="text-sm text-zinc-500">Aprovação restrita (ADMIN, GESTOR).</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {statusAtual === "aberto" && (
          <button
            type="button"
            onClick={() => executar("aprovar")}
            disabled={ocupado !== null}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {ocupado === "aprovar" && <LoaderCircle className="size-4 animate-spin" />}
            Aprovar pedido
          </button>
        )}
        {statusAtual === "recebido" && (
          <button
            type="button"
            onClick={() => executar("encerrar")}
            disabled={ocupado !== null}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60",
            )}
          >
            {ocupado === "encerrar" && <LoaderCircle className="size-4 animate-spin" />}
            Encerrar pedido
          </button>
        )}
        {(statusAtual === "aberto" || statusAtual === "aprovado") && (
          <button
            type="button"
            onClick={() => executar("cancelar")}
            disabled={ocupado !== null}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {ocupado === "cancelar" && <LoaderCircle className="size-4 animate-spin" />}
            Cancelar
          </button>
        )}
        {(statusAtual === "encerrado" || statusAtual === "cancelado") && (
          <p className="text-sm text-zinc-500">Estado final.</p>
        )}
      </div>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
