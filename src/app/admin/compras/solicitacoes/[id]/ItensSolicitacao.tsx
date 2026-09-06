"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { adicionarItem, removerItem } from "../actions";
import type { SolicitacaoItem } from "@/lib/types";

/** Itens da solicitação (editáveis só antes da aprovação). */
export default function ItensSolicitacao({
  solicitacaoId,
  itens,
  produtos,
  podeEditar,
}: {
  solicitacaoId: string;
  itens: (SolicitacaoItem & { estoque?: { fisico: number; reservado: number; minimo: number } | null })[];
  produtos: { id: string; codigo: string; fisico: number; reservado: number; minimo: number; unidade: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [produtoId, setProdutoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [urgencia, setUrgencia] = useState("normal");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const p = produtos.find((x) => x.id === produtoId);
      const r = await adicionarItem({
        solicitacaoId,
        produto_id: produtoId || null,
        descricao: p ? `${p.codigo} — ${descricao || ""}`.trim() : descricao,
        quantidade: Number(quantidade),
        unidade: p ? p.unidade : "UN",
        urgencia,
      });
      if (!r.ok) throw new Error(r.error);
      setProdutoId("");
      setDescricao("");
      setQuantidade("1");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (removendo) return;
    if (!confirm("Remover este item?")) return;
    setErro(null);
    setRemovendo(id);
    try {
      const r = await removerItem({ id, solicitacaoId });
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
      <ul className="space-y-2">
        {itens.map((it) => (
          <li key={it.id} className="rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200/70">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{it.descricao}</p>
                <p className="text-xs text-zinc-500">
                  {String(it.quantidade)} {it.unidade} · {it.urgencia}
                  {it.estoque ? ` · est. fís ${it.estoque.fisico} · res ${it.estoque.reservado} · mín ${it.estoque.minimo}` : ""}
                </p>
              </div>
              {podeEditar && (
                <button
                  type="button"
                  aria-label={`Remover ${it.descricao}`}
                  onClick={() => remover(it.id)}
                  disabled={removendo !== null}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-60"
                >
                  {removendo === it.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </div>
          </li>
        ))}
        {itens.length === 0 && <li className="text-sm text-zinc-500">Sem itens.</li>}
      </ul>

      {podeEditar && (
        <form onSubmit={adicionar} className="grid gap-2 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-4">
          <select aria-label="Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} disabled={salvando} className={campo}>
            <option value="">Avulso…</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>{p.codigo} (disp {p.fisico - p.reservado})</option>
            ))}
          </select>
          <input aria-label="Descrição" required minLength={2} maxLength={200} placeholder="Descrição *" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={salvando} className={campo} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Quantidade" type="number" required min="0" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} disabled={salvando} className={campo} />
            <select aria-label="Urgência" value={urgencia} onChange={(e) => setUrgencia(e.target.value)} disabled={salvando} className={campo}>
              <option value="baixa">Baixa</option><option value="normal">Normal</option>
              <option value="alta">Alta</option><option value="critica">Crítica</option>
            </select>
          </div>
          <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
            {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Adicionar
          </button>
        </form>
      )}
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
