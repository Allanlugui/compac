"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { definirVencedora, registrarCotacao } from "../actions";
import type { Cotacao } from "@/lib/types";

/** Cotações por fornecedor + vencedora (base do pedido). */
export default function CotacoesManager({
  solicitacaoId,
  cotacoes,
  fornecedores,
  podeCotar,
}: {
  solicitacaoId: string;
  cotacoes: (Cotacao & { fornecedor_nome: string | null })[];
  fornecedores: { id: string; nome: string }[];
  podeCotar: boolean;
}) {
  const router = useRouter();
  const [fornecedorId, setFornecedorId] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await registrarCotacao({
        solicitacaoId,
        fornecedor_id: fornecedorId,
        valor: Number(valor),
        prazo_dias: prazo.trim() === "" ? null : Number(prazo),
        condicoes,
      });
      if (!r.ok) throw new Error(r.error);
      setFornecedorId("");
      setValor("");
      setPrazo("");
      setCondicoes("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  async function vencer(cotacaoId: string) {
    if (marcando) return;
    setErro(null);
    setMarcando(cotacaoId);
    try {
      const r = await definirVencedora({ cotacaoId, solicitacaoId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setMarcando(null);
    }
  }

  return (
    <div className="space-y-3">
      {cotacoes.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma cotação. Compare fornecedores abaixo.</p>
      ) : (
        <ul className="space-y-2">
          {cotacoes.map((c) => (
            <li key={c.id} className={cn("rounded-xl px-3 py-2.5 ring-1", c.vencedora ? "bg-emerald-50 ring-emerald-300" : "bg-zinc-50 ring-zinc-200/70")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {c.fornecedor_nome ?? "—"} · {formatarMoeda(Number(c.valor))}
                    {c.vencedora && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] text-white">vencedora</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {c.prazo_dias !== null ? `prazo ${c.prazo_dias}d` : "sem prazo"}
                    {c.condicoes ? ` · ${c.condicoes}` : ""}
                  </p>
                </div>
                {podeCotar && !c.vencedora && (
                  <button
                    type="button"
                    onClick={() => vencer(c.id)}
                    disabled={marcando !== null}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {marcando === c.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Vencedora
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {podeCotar && (
        <form onSubmit={salvar} className="grid gap-2 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-4">
          <select aria-label="Fornecedor" required value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} disabled={salvando} className={campo}>
            <option value="">Fornecedor…</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
          <input aria-label="Valor total" type="number" required min="0" step="0.01" placeholder="Valor R$ *" value={valor} onChange={(e) => setValor(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Prazo em dias" type="number" min="0" step="1" placeholder="Prazo (dias)" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={salvando} className={campo} />
          <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
            {salvando && <LoaderCircle className="size-4 animate-spin" />}
            Cotar
          </button>
          <input aria-label="Condições" maxLength={500} placeholder="Condições/pagamento" value={condicoes} onChange={(e) => setCondicoes(e.target.value)} disabled={salvando} className={`${campo} sm:col-span-4`} />
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
