"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { criarAtivo } from "./actions";

export default function NovoAtivoForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const resultado = await criarAtivo({ nome, localizacao });
      if (!resultado.ok) throw new Error(resultado.error);
      setNome("");
      setLocalizacao("");
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:hidden"
    >
      <h2 className="text-base font-bold text-zinc-900">Cadastrar ativo</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        O QR Code é gerado automaticamente ao salvar.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label
            htmlFor="ativo-nome"
            className="mb-1.5 block text-sm font-semibold text-zinc-800"
          >
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            id="ativo-nome"
            type="text"
            required
            minLength={2}
            maxLength={120}
            placeholder="Ex.: Ar-condicionado Recepção"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={salvando}
            className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
          />
        </div>
        <div>
          <label
            htmlFor="ativo-localizacao"
            className="mb-1.5 block text-sm font-semibold text-zinc-800"
          >
            Localização
          </label>
          <input
            id="ativo-localizacao"
            type="text"
            maxLength={160}
            placeholder="Ex.: Bloco A · 2º andar"
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            disabled={salvando}
            className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
          >
            {salvando ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <Plus className="size-5" />
            )}
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
