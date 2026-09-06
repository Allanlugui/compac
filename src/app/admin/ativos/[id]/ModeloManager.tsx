"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { criarModelo } from "./checklists";

export interface ModeloComItens {
  id: string;
  titulo: string;
  checklist_itens: { id: string; texto: string; obrigatorio: boolean; ordem: number }[];
}

/** Gestão de modelos de checklist do ativo (aba Checklists). */
export default function ModeloManager({
  ativoId,
  modelos,
}: {
  ativoId: string;
  modelos: ModeloComItens[];
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [itensTexto, setItensTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const itens = itensTexto.split("\n");
      const r = await criarModelo({ ativoId, titulo, itens });
      if (!r.ok) throw new Error(r.error);
      setTitulo("");
      setItensTexto("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <form onSubmit={salvar} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-black">
          <ClipboardCheck className="size-4" /> Novo modelo para este ativo
        </h3>
        <div className="mt-3 grid gap-2">
          <input aria-label="Título do checklist" required minLength={3} maxLength={120} placeholder="Ex.: Inspeção semanal do compressor" value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={salvando} className={campo} />
          <textarea aria-label="Itens (um por linha)" required rows={4} placeholder={"Um item por linha:\nVerificar pressão\nVerificar temperatura\nVerificar vazamentos"} value={itensTexto} onChange={(e) => setItensTexto(e.target.value)} disabled={salvando} className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
          <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60 sm:w-fit">
            {salvando && <LoaderCircle className="size-4 animate-spin" />}
            Criar modelo
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </form>

      {modelos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Nenhum modelo. Crie o primeiro acima.
        </p>
      ) : (
        <ul className="space-y-2">
          {modelos.map((m) => (
            <li key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-black">{m.titulo}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
                {[...m.checklist_itens].sort((a, b) => a.ordem - b.ordem).map((it) => (
                  <li key={it.id}>{it.texto}{!it.obrigatorio && <span className="text-zinc-400"> (opc.)</span>}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
