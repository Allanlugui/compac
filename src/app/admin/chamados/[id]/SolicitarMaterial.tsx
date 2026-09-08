"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PackagePlus } from "lucide-react";
import { solicitarMaterialOS } from "./actions";

export default function SolicitarMaterial({ chamadoId, produtos }: { chamadoId: string; produtos: { id: string; codigo: string; descricao: string }[] }) {
  const router = useRouter();
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [produtoId, setProdutoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setMsg(null);
    setEnviando(true);
    try {
      const r = await solicitarMaterialOS({ chamadoId, produtoId: produtoId || null, descricao, quantidade: Number(quantidade) });
      if (!r.ok) throw new Error(r.error);
      setDescricao("");
      setQuantidade("1");
      setProdutoId("");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falha");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm">
          <option value="">Produto do estoque (opcional)</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>
          ))}
        </select>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do material *" required maxLength={160} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm" />
        <input type="number" min="0" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Qtd" required className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={enviando} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
        {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
        Solicitar material
      </button>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </form>
  );
}
