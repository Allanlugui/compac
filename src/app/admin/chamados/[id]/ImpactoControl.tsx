"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { ImpactoOperacional } from "@/lib/types";
import { cn } from "@/lib/utils";
import { atualizarImpacto } from "./actions";
import { IMPACTOS } from "@/app/admin/_components/ImpactoBadge";

const CLASSES_ATIVO: Record<ImpactoOperacional, string> = {
  baixo: "bg-zinc-600 text-white ring-zinc-600",
  medio: "bg-sky-600 text-white ring-sky-600",
  alto: "bg-amber-500 text-white ring-amber-500",
  critico: "bg-orange-600 text-white ring-orange-600",
  parada_total: "bg-red-600 text-white ring-red-600",
};

/** Seletor do nível de impacto operacional da ocorrência. */
export default function ImpactoControl({
  chamadoId,
  impactoAtual,
}: {
  chamadoId: string;
  impactoAtual: ImpactoOperacional | null;
}) {
  const router = useRouter();
  const [pendente, setPendente] = useState<ImpactoOperacional | "limpar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function definir(impacto: ImpactoOperacional | null) {
    if (pendente) return;
    if ((impactoAtual ?? null) === impacto) return;
    setErro(null);
    setPendente(impacto ?? "limpar");
    try {
      const r = await atualizarImpacto({ chamadoId, impacto });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setPendente(null);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">
        Impacto operacional
      </p>
      <div className="flex flex-wrap gap-2">
        {IMPACTOS.map(({ id, rotulo }) => {
          const ativo = impactoAtual === id;
          const carregando = pendente === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => definir(id)}
              disabled={pendente !== null}
              aria-pressed={ativo}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold ring-2 transition active:scale-[0.99] disabled:opacity-70",
                ativo
                  ? CLASSES_ATIVO[id]
                  : "bg-zinc-100 text-zinc-600 ring-transparent hover:bg-zinc-200",
              )}
            >
              {carregando && <LoaderCircle className="size-4 animate-spin" />}
              {rotulo}
            </button>
          );
        })}
        {impactoAtual && (
          <button
            type="button"
            onClick={() => definir(null)}
            disabled={pendente !== null}
            className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-bold text-zinc-400 underline-offset-2 hover:underline disabled:opacity-70"
          >
            {pendente === "limpar" ? "Limpando…" : "Limpar"}
          </button>
        )}
      </div>
      {erro && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
