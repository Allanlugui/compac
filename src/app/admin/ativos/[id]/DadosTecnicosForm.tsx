"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { AtributoCategoria } from "@/lib/types";
import { salvarDadosTecnicos } from "../actions";

/**
 * Seção 4 · Dados técnicos dinâmicos (schema da categoria, FASE 1).
 * Obrigatórios respeitados; persiste só os técnicos (resto intacto).
 */
export default function DadosTecnicosForm({
  ativoId,
  categoriaNome,
  atributos,
  valores,
}: {
  ativoId: string;
  categoriaNome: string | null;
  atributos: AtributoCategoria[];
  valores: Record<string, string>;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(valores);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    if (salvando) return;
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const r = await salvarDadosTecnicos({ id: ativoId, dados_tecnicos: vals });
      if (!r.ok) throw new Error(r.error);
      setOk(true);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  if (!categoriaNome) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
        Escolha uma categoria na aba Dados para liberar os atributos técnicos.
      </p>
    );
  }

  if (atributos.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
        A categoria <strong>{categoriaNome}</strong> não possui dados técnicos configurados.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-black">
        {categoriaNome} · {atributos.length} atributo(s)
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {atributos.map((a) => (
          <label key={a.nome} className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">
              {a.nome}
              {a.unidade ? ` (${a.unidade})` : ""}
              {a.obrigatorio && <span className="text-red-500"> *</span>}
            </span>
            {a.tipo === "selecao" ? (
              <select
                value={vals[a.nome] ?? ""}
                onChange={(e) => { setVals({ ...vals, [a.nome]: e.target.value }); setOk(false); }}
                disabled={salvando}
                required={a.obrigatorio}
                className={campo}
              >
                <option value="">Selecionar…</option>
                {(a.opcoes ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : a.tipo === "texto" ? (
              <textarea
                value={vals[a.nome] ?? ""}
                onChange={(e) => { setVals({ ...vals, [a.nome]: e.target.value }); setOk(false); }}
                disabled={salvando}
                required={a.obrigatorio}
                rows={4}
                className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60 resize-y"
                placeholder="Especificação técnica (sem limite de caracteres)"
              />
            ) : (
              <input
                type={a.tipo === "numero" ? "number" : "date"}
                step={a.tipo === "numero" ? "any" : undefined}
                value={vals[a.nome] ?? ""}
                onChange={(e) => { setVals({ ...vals, [a.nome]: e.target.value }); setOk(false); }}
                disabled={salvando}
                required={a.obrigatorio}
                className={campo}
              />
            )}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="mt-4 inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
      >
        {salvando && <LoaderCircle className="size-4 animate-spin" />}
        {salvando ? "Salvando…" : "Salvar dados técnicos"}
      </button>
      {ok && <p className="mt-2 text-xs font-bold text-emerald-700">Salvo!</p>}
      {erro && (
        <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
