"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, LoaderCircle, TriangleAlert } from "lucide-react";
import { formatarMoeda } from "@/lib/format";
import { registrarRecebimento } from "../actions";
import type { PedidoItem } from "@/lib/types";

export interface LinhaPedido extends PedidoItem {
  recebido_total: number;
}

/**
 * Recebimento + conferência: quantidade pedida × recebida × recusada,
 * lote/validade, motivo da divergência, foto. Entrada só do aceito.
 */
export default function RecebimentoForm({
  pedidoId,
  itens,
}: {
  pedidoId: string;
  itens: LinhaPedido[];
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Record<string, { rec: string; rej: string; motivo: string }>>(
    Object.fromEntries(itens.map((it) => [it.id, { rec: String(it.quantidade), rej: "0", motivo: "" }])),
  );
  const [lote, setLote] = useState("");
  const [validade, setValidade] = useState("");
  const [motivoGeral, setMotivoGeral] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await registrarRecebimento({
        pedidoId,
        linhas: itens.map((it) => ({
          pedido_item_id: it.id,
          qtd_recebida: Number(linhas[it.id]?.rec ?? 0),
          qtd_recusada: Number(linhas[it.id]?.rej ?? 0),
          motivo: linhas[it.id]?.motivo ?? "",
        })),
        lote,
        validade,
        motivo_divergencia: motivoGeral,
        foto,
      });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <ul className="space-y-2">
        {itens.map((it) => {
          const L = linhas[it.id] ?? { rec: "0", rej: "0", motivo: "" };
          const set = (c: "rec" | "rej" | "motivo", v: string) =>
            setLinhas({ ...linhas, [it.id]: { ...L, [c]: v } });
          return (
            <li key={it.id} className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
              <p className="text-sm font-bold">
                {it.descricao} · pedidas {String(it.quantidade)} · já recebidas {String(it.recebido_total)}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-zinc-700">Recebida</span>
                  <input type="number" min="0" step="0.01" value={L.rec} onChange={(e) => set("rec", e.target.value)} disabled={salvando} className={campo} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-zinc-700">Recusada</span>
                  <input type="number" min="0" step="0.01" value={L.rej} onChange={(e) => set("rej", e.target.value)} disabled={salvando} className={campo} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-zinc-700">Motivo</span>
                  <input value={L.motivo} onChange={(e) => set("motivo", e.target.value)} disabled={salvando} maxLength={300} className={campo} />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Lote</span>
          <input value={lote} onChange={(e) => setLote(e.target.value)} disabled={salvando} maxLength={60} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Validade</span>
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Foto (avaria/divergência)</span>
          <span className="flex gap-2">
            <label className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 text-xs font-bold text-zinc-700 hover:border-zinc-400">
              <Camera className="size-4" /> Câmera
              <input type="file" accept="image/*" capture="environment" disabled={salvando} onChange={(e) => { setFoto(e.target.files?.[0] ?? null); e.target.value = ""; }} className="hidden" />
            </label>
            <label className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 text-xs font-bold text-zinc-700 hover:border-zinc-400">
              <ImagePlus className="size-4" /> Arquivo
              <input type="file" accept="image/*,application/pdf" disabled={salvando} onChange={(e) => { setFoto(e.target.files?.[0] ?? null); e.target.value = ""; }} className="hidden" />
            </label>
          </span>
        </label>
      </div>
      {foto && <p className="text-xs font-bold text-zinc-600">Anexo: {foto.name}</p>}
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-zinc-700">Motivo geral da divergência (obrigatório se houver recusa)</span>
        <input value={motivoGeral} onChange={(e) => setMotivoGeral(e.target.value)} disabled={salvando} maxLength={500} className={campo} />
      </label>
      <p className="text-xs text-zinc-400">
        Total do pedido: {formatarMoeda(itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.preco_unitario), 0))} (itens; frete/desconto/impostos no cabeçalho).
      </p>
      <button type="submit" disabled={salvando} className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
        {salvando && <LoaderCircle className="size-4 animate-spin" />}
        Registrar recebimento
      </button>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
