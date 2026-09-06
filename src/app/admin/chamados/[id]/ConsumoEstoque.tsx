"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PackageMinus, TriangleAlert } from "lucide-react";
import { movimentarEstoque } from "@/app/admin/estoque/actions";
import type { TipoMovimentacao } from "@/lib/types";

export interface ProdutoOpcao {
  id: string;
  codigo: string;
  descricao: string;
  /** Disponível = físico − reservado. */
  saldo: number;
  fisico: number;
  reservado: number;
}

/** Reserva ou baixa de peça vinculada à O.S. (dois baldes, sem dupla contagem). */
export default function ConsumoEstoque({
  chamadoId,
  produtos,
}: {
  chamadoId: string;
  produtos: ProdutoOpcao[];
}) {
  const router = useRouter();
  const [produtoId, setProdutoId] = useState("");
  const [tipo, setTipo] = useState<TipoMovimentacao>("reserva");
  const [quantidade, setQuantidade] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function consumir(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await movimentarEstoque({
        produtoId,
        tipo,
        quantidade: Number(quantidade),
        custoUnitario: 0,
        chamadoId,
        observacao: tipo === "reserva" ? "Reserva via O.S." : "Consumo via O.S.",
      });
      if (!r.ok) throw new Error(r.error);
      setProdutoId("");
      setQuantidade("1");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  if (produtos.length === 0) {
    return (
      <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200">
        Cadastre produtos no <strong>Estoque</strong> para dar baixa nesta O.S.
      </p>
    );
  }

  return (
    <form onSubmit={consumir} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="block sm:w-32">
        <span className="mb-1 block text-xs font-bold text-zinc-700">Operação</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoMovimentacao)}
          disabled={salvando}
          className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none disabled:opacity-60"
        >
          <option value="reserva">Reservar</option>
          <option value="consumo">Consumir</option>
        </select>
      </label>
      <label className="block flex-1">
        <span className="mb-1 block text-xs font-bold text-zinc-700">Peça do estoque</span>
        <select
          required
          value={produtoId}
          onChange={(e) => setProdutoId(e.target.value)}
          disabled={salvando}
          className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none disabled:opacity-60"
        >
          <option value="">Selecionar…</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} — {p.descricao} (disp {String(p.saldo)} · fís {String(p.fisico)})
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:w-28">
        <span className="mb-1 block text-xs font-bold text-zinc-700">Qtd</span>
        <input
          type="number" required min="0" step="0.01" inputMode="decimal"
          value={quantidade} onChange={(e) => setQuantidade(e.target.value)} disabled={salvando}
          className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none disabled:opacity-60"
        />
      </label>
      <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
        {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <PackageMinus className="size-4" />}
        {tipo === "reserva" ? "Reservar" : "Dar baixa"}
      </button>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 sm:basis-full">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
