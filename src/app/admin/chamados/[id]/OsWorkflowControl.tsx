"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Flag, LoaderCircle, TriangleAlert } from "lucide-react";
import type { OsStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { concluirOS, encerrarOS, transicaoOS } from "./actions";

const ROTULOS: Record<OsStatus, string> = {
  aberta: "Aberta",
  planejada: "Planejada",
  atribuida: "Atribuída",
  em_execucao: "Em execução",
  aguardando_peca: "Aguardando peça",
  aguardando_terceiro: "Aguardando terceiro",
  em_validacao: "Em validação",
  concluida: "Concluída",
  encerrada: "Encerrada",
};

const PROXIMOS: Record<OsStatus, OsStatus[]> = {
  aberta: ["planejada"],
  planejada: ["atribuida", "aberta"],
  atribuida: ["em_execucao", "planejada"],
  em_execucao: ["aguardando_peca", "aguardando_terceiro", "em_validacao"],
  aguardando_peca: ["em_execucao"],
  aguardando_terceiro: ["em_execucao"],
  em_validacao: ["em_execucao", "concluida"],
  concluida: ["encerrada", "em_validacao"],
  encerrada: [],
};

/**
 * Workflow da O.S.: transições válidas + motivo, concluir (validada) e
 * encerrar (resolve a demanda, sincroniza ativo e plano). Mobile-first.
 */
export default function OsWorkflowControl({
  chamadoId,
  osAtual,
  podeConcluir,
  podeEncerrar,
}: {
  chamadoId: string;
  osAtual: OsStatus;
  podeConcluir: boolean;
  podeEncerrar: boolean;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const proximos = PROXIMOS[osAtual] ?? [];

  async function avancar(para: OsStatus) {
    if (ocupado) return;
    setErro(null);
    setOcupado(para);
    try {
      const r = await transicaoOS({ chamadoId, para, motivo });
      if (!r.ok) throw new Error(r.error);
      setMotivo("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  async function concluir() {
    if (ocupado) return;
    if (!confirm("Concluir a O.S.? Diagnóstico, solução, responsável e checklists serão validados.")) return;
    setErro(null);
    setOcupado("concluir");
    try {
      const r = await concluirOS({ chamadoId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  async function encerrar() {
    if (ocupado) return;
    if (!confirm("Encerrar? A demanda será resolvida e o ativo volta a operacional.")) return;
    setErro(null);
    setOcupado("encerrar");
    try {
      const r = await encerrarOS({ chamadoId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-3">
      {proximos.length > 0 && (
        <>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={ocupado !== null}
            maxLength={300}
            placeholder="Motivo da transição (entra no histórico)"
            className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {proximos.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => avancar(p)}
                disabled={ocupado !== null}
                className={cn(
                  "inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition disabled:opacity-60",
                  p === "concluida" || p === "encerrada"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-zinc-900 text-white hover:bg-zinc-700",
                )}
              >
                {ocupado === p ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Ir para: {ROTULOS[p]}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {osAtual === "em_validacao" && podeConcluir && (
          <button
            type="button"
            onClick={concluir}
            disabled={ocupado !== null}
            className="inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {ocupado === "concluir" ? <LoaderCircle className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
            Concluir O.S.
          </button>
        )}
        {osAtual === "concluida" && podeEncerrar && (
          <button
            type="button"
            onClick={encerrar}
            disabled={ocupado !== null}
            className="inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {ocupado === "encerrar" ? <LoaderCircle className="size-5 animate-spin" /> : <Flag className="size-5" />}
            Encerrar O.S.
          </button>
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
