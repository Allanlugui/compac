"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { salvarExecucao } from "@/app/admin/ativos/[id]/checklists";
import { cn } from "@/lib/utils";

export interface ModeloExec {
  id: string;
  titulo: string;
  itens: { id: string; texto: string; obrigatorio: boolean }[];
}

/** Executa um checklist vinculado ao chamado (mobile-first). */
export default function ExecucaoChecklist({
  chamadoId,
  modelos,
}: {
  chamadoId: string;
  modelos: ModeloExec[];
}) {
  const router = useRouter();
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [respostas, setRespostas] = useState<Record<string, boolean | null>>({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const modelo = modelos.find((m) => m.id === modeloId) ?? null;

  function marcar(itemId: string, valor: boolean) {
    setRespostas((a) => ({ ...a, [itemId]: a[itemId] === valor ? null : valor }));
  }

  async function salvar() {
    if (!modelo || salvando) return;
    setErro(null);
    setOk(false);
    const obrigatorios = modelo.itens.filter((i) => i.obrigatorio && respostas[i.id] == null);
    if (obrigatorios.length > 0) {
      setErro(`Responda os ${obrigatorios.length} itens obrigatórios.`);
      return;
    }
    setSalvando(true);
    try {
      const r = await salvarExecucao({
        modeloId: modelo.id,
        chamadoId,
        respostas: modelo.itens.map((i) => ({
          itemId: i.id,
          ok: respostas[i.id] ?? null,
          observacao: obs[i.id] ?? "",
        })),
      });
      if (!r.ok) throw new Error(r.error);
      setOk(true);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  if (modelos.length === 0) {
    return (
      <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200">
        Nenhum modelo disponível. Crie modelos na página do ativo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-bold text-zinc-700">Modelo</span>
        <select
          value={modeloId}
          onChange={(e) => { setModeloId(e.target.value); setRespostas({}); setObs({}); setOk(false); }}
          className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none"
        >
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>{m.titulo}</option>
          ))}
        </select>
      </label>

      {modelo && (
        <ul className="space-y-2">
          {modelo.itens.map((item) => {
            const v = respostas[item.id] ?? null;
            return (
              <li key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <p className="text-sm font-bold">
                  {item.texto}
                  {item.obrigatorio && <span className="text-red-500"> *</span>}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => marcar(item.id, true)}
                    aria-pressed={v === true}
                    className={cn(
                      "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ring-2 transition",
                      v === true ? "bg-emerald-600 text-white ring-emerald-600" : "bg-zinc-100 text-zinc-600 ring-transparent hover:bg-zinc-200",
                    )}
                  >
                    <Check className="size-4" /> OK
                  </button>
                  <button
                    type="button"
                    onClick={() => marcar(item.id, false)}
                    aria-pressed={v === false}
                    className={cn(
                      "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ring-2 transition",
                      v === false ? "bg-red-600 text-white ring-red-600" : "bg-zinc-100 text-zinc-600 ring-transparent hover:bg-zinc-200",
                    )}
                  >
                    <X className="size-4" /> Falha
                  </button>
                </div>
                {v === false && (
                  <input
                    aria-label={`Observação de ${item.texto}`}
                    placeholder="Observação da falha (opcional)"
                    value={obs[item.id] ?? ""}
                    onChange={(e) => setObs((a) => ({ ...a, [item.id]: e.target.value }))}
                    className="mt-2 min-h-[40px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !modelo}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          Salvar execução
        </button>
        {ok && <span className="text-xs font-bold text-emerald-700">Execução registrada!</span>}
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
