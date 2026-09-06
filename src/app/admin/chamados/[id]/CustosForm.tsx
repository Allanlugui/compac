"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { formatarMoeda } from "@/lib/format";
import { atualizarCustosDiretos } from "./actions";

/**
 * Custos da O.S.: Materiais (compras, derivado) + Terceiros (serviços,
 * derivado) + Mão de obra e Outros (lançamento direto, aprovação).
 */
export default function CustosForm({
  chamadoId,
  totalMateriais,
  totalTerceiros,
  atual,
}: {
  chamadoId: string;
  totalMateriais: number;
  totalTerceiros: number;
  atual: { custo_mao_obra: number; custo_outros: number; custo_outros_desc: string | null };
}) {
  const router = useRouter();
  const [mo, setMo] = useState(String(atual.custo_mao_obra ?? 0));
  const [outros, setOutros] = useState(String(atual.custo_outros ?? 0));
  const [desc, setDesc] = useState(atual.custo_outros_desc ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const total = totalMateriais + totalTerceiros + Number(mo || 0) + Number(outros || 0);
  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const r = await atualizarCustosDiretos({
        chamadoId,
        custo_mao_obra: Number(mo),
        custo_outros: Number(outros),
        custo_outros_desc: desc,
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

  return (
    <form onSubmit={salvar} className="space-y-3">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200/70">
          <dt className="text-xs font-bold text-zinc-500">Materiais (derivado)</dt>
          <dd className="font-black">{formatarMoeda(totalMateriais)}</dd>
        </div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200/70">
          <dt className="text-xs font-bold text-zinc-500">Terceiros (derivado)</dt>
          <dd className="font-black">{formatarMoeda(totalTerceiros)}</dd>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Mão de obra (R$)</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={mo} onChange={(e) => { setMo(e.target.value); setOk(false); }} disabled={salvando} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Outros (R$)</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={outros} onChange={(e) => { setOutros(e.target.value); setOk(false); }} disabled={salvando} className={campo} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Descrição de “outros”</span>
          <input value={desc} onChange={(e) => { setDesc(e.target.value); setOk(false); }} disabled={salvando} maxLength={200} className={campo} />
        </label>
      </dl>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
          {salvando && <LoaderCircle className="size-4 animate-spin" />}
          Salvar custos
        </button>
        {ok && <span className="text-xs font-bold text-emerald-700">Salvo!</span>}
        <span className="ml-auto text-sm font-black">Total: {formatarMoeda(total)}</span>
      </div>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
