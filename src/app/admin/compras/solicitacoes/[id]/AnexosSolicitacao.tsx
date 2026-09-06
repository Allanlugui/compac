"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, TriangleAlert } from "lucide-react";
import { formatarDataHora } from "@/lib/format";
import { uploadAnexoSolicitacao } from "../actions";
import type { SolicitacaoAnexo } from "@/lib/types";

/** Anexos da solicitação (orçamento, PDF, foto — Storage privado). */
export default function AnexosSolicitacao({
  solicitacaoId,
  anexos,
}: {
  solicitacaoId: string;
  anexos: (SolicitacaoAnexo & { url: string })[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const r = await uploadAnexoSolicitacao({ solicitacaoId, file, nome });
      if (!r.ok) throw new Error(r.error);
      setNome("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          aria-label="Nome do anexo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={enviando}
          maxLength={160}
          placeholder="Nome (opcional)"
          className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60"
        />
        <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100">
          {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
          {enviando ? "Enviando…" : "Anexar PDF/foto (10 MB)"}
          <input type="file" accept="application/pdf,image/*" disabled={enviando} onChange={enviar} className="hidden" />
        </label>
      </div>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
      {anexos.length === 0 ? (
        <p className="text-sm text-zinc-500">Sem anexos.</p>
      ) : (
        <ul className="space-y-1.5">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200/70">
              <span className="min-w-0">
                <span className="block truncate font-bold">{a.nome}</span>
                <span className="text-xs text-zinc-400">{formatarDataHora(a.created_at)}</span>
              </span>
              {a.url !== "" && (
                <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-zinc-700 underline-offset-2 hover:underline">
                  Abrir
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
