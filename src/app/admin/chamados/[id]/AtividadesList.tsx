"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { registrarAtividade } from "./actions";

/** Linha do tempo operacional: atividades com usuário + data/hora. */
export default function AtividadesList({
  chamadoId,
  iniciais,
}: {
  chamadoId: string;
  iniciais: { id: string; descricao: string; executado_por: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await registrarAtividade({ chamadoId, descricao: texto });
      if (!r.ok) throw new Error(r.error);
      setTexto("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={salvar} className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={salvando}
          maxLength={500}
          placeholder="Ex.: 09:20 — Substituição e teste"
          aria-label="Nova atividade"
          className="min-h-[48px] flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={salvando || texto.trim().length < 2}
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Registrar
        </button>
      </form>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
      {iniciais.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma atividade registrada.</p>
      ) : (
        <ol className="space-y-0">
          {iniciais.map((a, i) => (
            <li key={a.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex size-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">
                  {iniciais.length - i}
                </span>
                {i < iniciais.length - 1 && <span className="w-0.5 flex-1 bg-zinc-200" />}
              </div>
              <div className="pb-4">
                <p className="text-sm font-semibold">{a.descricao}</p>
                <p className="text-xs text-zinc-400">
                  {a.executado_por ?? "—"} · {new Date(a.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
