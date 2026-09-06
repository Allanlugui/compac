"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { formatarMoeda } from "@/lib/format";
import { excluirServico, registrarServico } from "./actions";

export interface ServicoLista {
  id: string;
  servico: string;
  valor: number;
  nota: string | null;
  data_servico: string | null;
  fornecedor_id: string | null;
  fornecedor_nome?: string | null;
}

/** Serviços externos (terceiros) — compõem o custo da O.S. */
export default function ServicosList({
  chamadoId,
  iniciais,
  fornecedores,
  podeExcluir,
}: {
  chamadoId: string;
  iniciais: ServicoLista[];
  fornecedores: { id: string; nome: string }[];
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [servico, setServico] = useState("");
  const [valor, setValor] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [nota, setNota] = useState("");
  const [data, setData] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const total = iniciais.reduce((s, x) => s + Number(x.valor ?? 0), 0);
  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await registrarServico({
        chamadoId,
        fornecedor_id: fornecedorId || null,
        servico,
        valor: Number(valor),
        nota,
        data_servico: data,
      });
      if (!r.ok) throw new Error(r.error);
      setServico("");
      setValor("");
      setFornecedorId("");
      setNota("");
      setData("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (removendo) return;
    if (!confirm("Excluir este serviço do custo da O.S.?")) return;
    setErro(null);
    setRemovendo(id);
    try {
      const r = await excluirServico({ id, chamadoId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={salvar} className="grid gap-2 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Serviço *</span>
          <input value={servico} onChange={(e) => setServico(e.target.value)} disabled={salvando} required minLength={2} maxLength={200} placeholder="Ex.: Rebobinamento do motor" className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Valor (R$) *</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} disabled={salvando} required className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Fornecedor</span>
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} disabled={salvando} className={campo}>
            <option value="">—</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Nota</span>
          <input value={nota} onChange={(e) => setNota(e.target.value)} disabled={salvando} maxLength={60} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Data</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
            {salvando && <LoaderCircle className="size-4 animate-spin" />}
            Adicionar serviço
          </button>
        </div>
      </form>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
      {iniciais.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum serviço externo.</p>
      ) : (
        <ul className="space-y-2">
          {iniciais.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200/70">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{s.servico}</p>
                <p className="text-xs text-zinc-500">
                  {s.fornecedor_nome ?? "Terceiro"} · {formatarMoeda(Number(s.valor))}
                  {s.nota ? ` · NF ${s.nota}` : ""}
                </p>
              </div>
              {podeExcluir && (
                <button
                  type="button"
                  aria-label={`Excluir ${s.servico}`}
                  onClick={() => remover(s.id)}
                  disabled={removendo !== null}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-60"
                >
                  {removendo === s.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </li>
          ))}
          <li className="flex justify-between rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-black text-white">
            <span>Total terceiros</span>
            <span>{formatarMoeda(total)}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
