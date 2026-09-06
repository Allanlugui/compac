"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, LoaderCircle, TriangleAlert, Wrench } from "lucide-react";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import { gerarOSPreventiva } from "./actions";
import type { PlanoManutencao } from "@/lib/types";

export interface PlanoLista extends PlanoManutencao {
  ativo_nome: string | null;
  ativo_codigo: string | null;
}

/** Lista de planos com estado (vencido/próximo/no prazo) + geração manual. */
export default function PlanosList({
  planos,
  podeExecutar,
}: {
  planos: PlanoLista[];
  podeExecutar: boolean;
}) {
  const router = useRouter();
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerada, setGerada] = useState<string | null>(null);

  const hoje = new Date().toISOString().slice(0, 10);

  function estado(p: PlanoLista): { rotulo: string; classes: string } {
    if (!p.ativo) return { rotulo: "Inativo", classes: "bg-zinc-200 text-zinc-500 ring-zinc-300" };
    if (!p.proxima_execucao) return { rotulo: "Sem data", classes: "bg-zinc-100 text-zinc-500 ring-zinc-200" };
    if (p.proxima_execucao < hoje) return { rotulo: "Vencido", classes: "bg-red-100 text-red-800 ring-red-200" };
    const limite = new Date(p.proxima_execucao);
    limite.setDate(limite.getDate() - (p.tolerancia_dias ?? 0));
    if (hoje >= limite.toISOString().slice(0, 10)) {
      return { rotulo: "Próximo", classes: "bg-amber-100 text-amber-800 ring-amber-200" };
    }
    return { rotulo: "No prazo", classes: "bg-emerald-100 text-emerald-800 ring-emerald-200" };
  }

  async function gerar(planoId: string) {
    if (gerando) return;
    if (!confirm("Gerar O.S. deste plano agora?")) return;
    setErro(null);
    setGerada(null);
    setGerando(planoId);
    try {
      const r = await gerarOSPreventiva({ planoId });
      if (!r.ok) throw new Error(r.error);
      setGerada(r.chamadoId);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setGerando(null);
    }
  }

  if (planos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Nenhum plano. Crie o primeiro acima.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
      {gerada && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
          O.S. gerada!{" "}
          <Link href={`/admin/chamados/${gerada}`} className="underline underline-offset-2">
            Abrir O.S.
          </Link>
        </p>
      )}
      <ul className="space-y-2">
        {planos.map((p) => {
          const e = estado(p);
          return (
            <li key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {p.ativo_codigo ? `${p.ativo_codigo} · ` : ""}{p.ativo_nome ?? "Ativo removido"}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-600">{p.atividade}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" />
                      a cada {p.frequencia} {p.unidade}
                      {p.proxima_execucao ? ` · próx. ${formatarData(p.proxima_execucao)}` : ""}
                    </span>
                    {p.responsavel && <span>{p.responsavel}</span>}
                  </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black ring-1", e.classes)}>
                  {e.rotulo}
                </span>
              </div>
              {podeExecutar && p.ativo && (
                <button
                  type="button"
                  onClick={() => gerar(p.id)}
                  disabled={gerando !== null}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  {gerando === p.id ? <LoaderCircle className="size-4 animate-spin" /> : <Wrench className="size-4" />}
                  Gerar O.S. agora
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
