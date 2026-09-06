"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { formatarMoeda } from "@/lib/format";
import { criarPedido } from "@/app/admin/compras/pedidos/actions";
import type { Cotacao, SolicitacaoItem } from "@/lib/types";

/**
 * Gera PEDIDO da solicitação (cotação vencedora ou itens avulsos).
 * Não baixa estoque — entrada só no recebimento.
 */
export default function GerarPedidoForm({
  solicitacaoId,
  itens,
  cotacoes,
  fornecedores,
}: {
  solicitacaoId: string;
  itens: SolicitacaoItem[];
  cotacoes: (Cotacao & { fornecedor_nome: string | null })[];
  fornecedores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const vencedora = cotacoes.find((c) => c.vencedora) ?? null;
  const [fornecedorId, setFornecedorId] = useState(vencedora?.fornecedor_id ?? "");
  const [frete, setFrete] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [impostos, setImpostos] = useState("0");
  const [prazo, setPrazo] = useState("");
  const [precos, setPrecos] = useState<Record<string, string>>(
    Object.fromEntries(itens.map((it) => [it.id, ""])),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<string | null>(null);

  const totalItens = itens.reduce((s, it) => s + Number(it.quantidade) * Number(precos[it.id] || 0), 0);
  const total = totalItens + Number(frete || 0) - Number(desconto || 0) + Number(impostos || 0);

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setGerado(null);
    setSalvando(true);
    try {
      const r = await criarPedido({
        solicitacaoId,
        fornecedor_id: fornecedorId,
        itens: itens.map((it) => ({
          produto_id: it.produto_id,
          descricao: it.descricao,
          quantidade: Number(it.quantidade),
          unidade: it.unidade,
          preco_unitario: Number(precos[it.id] || 0),
        })),
        frete: Number(frete || 0),
        desconto: Number(desconto || 0),
        impostos: Number(impostos || 0),
        prazo,
      });
      if (!r.ok) throw new Error(r.error);
      setGerado(r.id ?? null);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  if (itens.length === 0) {
    return <p className="text-sm text-zinc-500">Sem itens para pedir.</p>;
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      {vencedora && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
          Cotação vencedora: {vencedora.fornecedor_nome} · {formatarMoeda(Number(vencedora.valor))}
        </p>
      )}
      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-bold text-zinc-700">Fornecedor *</span>
        <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} disabled={salvando} required className={campo}>
          <option value="">Selecionar…</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
      </label>
      <ul className="space-y-2">
        {itens.map((it) => (
          <li key={it.id} className="grid gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-3">
            <p className="text-sm font-bold sm:col-span-2">{it.descricao} · {String(it.quantidade)} {it.unidade}</p>
            <input
              aria-label={`Preço de ${it.descricao}`}
              type="number" min="0" step="0.01" inputMode="decimal"
              placeholder="Preço unit. R$"
              value={precos[it.id] ?? ""}
              onChange={(e) => setPrecos({ ...precos, [it.id]: e.target.value })}
              disabled={salvando}
              required
              className={campo}
            />
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block"><span className="mb-1 block text-xs font-bold text-zinc-700">Frete</span>
          <input type="number" min="0" step="0.01" value={frete} onChange={(e) => setFrete(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-bold text-zinc-700">Desconto</span>
          <input type="number" min="0" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-bold text-zinc-700">Impostos</span>
          <input type="number" min="0" step="0.01" value={impostos} onChange={(e) => setImpostos(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-bold text-zinc-700">Prazo</span>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={salvando} className={campo} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={salvando} className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
          {salvando && <LoaderCircle className="size-4 animate-spin" />}
          Gerar pedido · {formatarMoeda(total)}
        </button>
        {gerado && (
          <Link href={`/admin/compras/pedidos/${gerado}`} className="text-sm font-bold text-emerald-700 underline-offset-2 hover:underline">
            Abrir pedido
          </Link>
        )}
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
