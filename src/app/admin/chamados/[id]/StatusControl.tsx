"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { ChamadoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { atualizarStatus } from "./actions";

const OPCOES: { id: ChamadoStatus; rotulo: string; classesAtivo: string }[] = [
  {
    id: "aberto",
    rotulo: "Aberto",
    classesAtivo: "bg-amber-500 text-white ring-amber-500",
  },
  {
    id: "em_andamento",
    rotulo: "Em andamento",
    classesAtivo: "bg-sky-600 text-white ring-sky-600",
  },
  {
    id: "concluido",
    rotulo: "Concluído",
    classesAtivo: "bg-emerald-600 text-white ring-emerald-600",
  },
];

export default function StatusControl({
  chamadoId,
  statusAtual,
}: {
  chamadoId: string;
  statusAtual: ChamadoStatus;
}) {
  const router = useRouter();
  const [pendente, setPendente] = useState<ChamadoStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function trocar(status: ChamadoStatus) {
    if (status === statusAtual || pendente) return;
    setErro(null);
    setPendente(status);
    try {
      const resultado = await atualizarStatus({ chamadoId, status });
      if (!resultado.ok) throw new Error(resultado.error);
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setPendente(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {OPCOES.map(({ id, rotulo, classesAtivo }) => {
          const ativo = statusAtual === id;
          const carregando = pendente === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => trocar(id)}
              disabled={pendente !== null}
              aria-pressed={ativo}
              className={cn(
                "inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold ring-2 transition active:scale-[0.99] disabled:opacity-70",
                ativo
                  ? classesAtivo
                  : "bg-zinc-100 text-zinc-600 ring-transparent hover:bg-zinc-200",
              )}
            >
              {carregando && <LoaderCircle className="size-4 animate-spin" />}
              {rotulo}
            </button>
          );
        })}
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
