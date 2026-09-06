"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle, PackagePlus, TriangleAlert } from "lucide-react";
import type { Movimentacao, Produto, TipoMovimentacao } from "@/lib/types";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { criarProduto, movimentarEstoque } from "./actions";

const TIPOS: { id: TipoMovimentacao; rotulo: string }[] = [
  { id: "entrada", rotulo: "Entrada" },
  { id: "saida", rotulo: "Saída" },
  { id: "ajuste", rotulo: "Ajuste (define físico)" },
  { id: "reserva", rotulo: "Reserva p/ O.S." },
  { id: "consumo", rotulo: "Consumo em O.S." },
  { id: "devolucao", rotulo: "Devolução de reserva" },
];

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function EstoqueClient({
  produtos,
  movimentacoes,
}: {
  produtos: Produto[];
  movimentacoes: (Movimentacao & { produto_nome: string })[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"produtos" | "movs">("produtos");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Novo produto
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [minimo, setMinimo] = useState("0");
  const [salvandoProd, setSalvandoProd] = useState(false);

  // Movimentar
  const [movProduto, setMovProduto] = useState("");
  const [movTipo, setMovTipo] = useState<TipoMovimentacao>("entrada");
  const [movQtd, setMovQtd] = useState("1");
  const [salvandoMov, setSalvandoMov] = useState(false);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return produtos;
    return produtos.filter((p) =>
      `${p.codigo} ${p.descricao} ${p.categoria ?? ""}`.toLowerCase().includes(t),
    );
  }, [produtos, busca]);

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoProd) return;
    setErro(null);
    setSalvandoProd(true);
    try {
      const r = await criarProduto({
        codigo, descricao, categoria: "", unidade: "un",
        minimo: Number(minimo), maximo: null, localizacao: "", custo: 0,
      });
      if (!r.ok) throw new Error(r.error);
      setCodigo(""); setDescricao(""); setMinimo("0");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvandoProd(false);
    }
  }

  async function salvarMov(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoMov) return;
    setErro(null);
    setSalvandoMov(true);
    try {
      const r = await movimentarEstoque({
        produtoId: movProduto, tipo: movTipo,
        quantidade: Number(movQtd), custoUnitario: 0,
        chamadoId: "", observacao: "",
      });
      if (!r.ok) throw new Error(r.error);
      setMovProduto(""); setMovQtd("1");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvandoMov(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5">
        {(["produtos", "movs"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-pressed={aba === id}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-bold transition",
              aba === id ? "bg-white shadow-md ring-1 ring-zinc-200" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {id === "produtos" ? `Produtos (${produtos.length})` : `Movimentações (${movimentacoes.length})`}
          </button>
        ))}
      </div>

      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      {aba === "produtos" ? (
        <div className="space-y-4">
          <form onSubmit={salvarProduto} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black">
              <PackagePlus className="size-4" /> Novo produto
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input aria-label="Código" required minLength={2} maxLength={40} placeholder="Código *" value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={salvandoProd} className={campo} />
              <input aria-label="Descrição" required minLength={2} maxLength={160} placeholder="Descrição *" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={salvandoProd} className={`${campo} sm:col-span-2`} />
              <input aria-label="Estoque mínimo" type="number" min="0" step="0.01" placeholder="Mínimo" value={minimo} onChange={(e) => setMinimo(e.target.value)} disabled={salvandoProd} className={campo} />
              <button type="submit" disabled={salvandoProd} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                {salvandoProd && <LoaderCircle className="size-4 animate-spin" />}
                Cadastrar
              </button>
            </div>
          </form>

          <label className="block">
            <span className="sr-only">Buscar produto</span>
            <input type="search" placeholder="Buscar por código, descrição ou categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none" />
          </label>

          {filtrados.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              Nenhum produto. Cadastre o primeiro acima.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((p) => {
                const fisico = Number(p.estoque_atual ?? 0);
                const reservado = Number(p.estoque_reservado ?? 0);
                const disponivel = fisico - reservado;
                const critico = disponivel <= Number(p.estoque_minimo ?? 0);
                return (
                  <li key={p.id} className={cn("rounded-2xl border bg-white p-4 shadow-sm", critico ? "border-red-300 ring-1 ring-red-200" : "border-zinc-200")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-xs font-black text-zinc-500">{p.codigo}</p>
                      {critico ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700 ring-1 ring-red-200">CRÍTICO</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">OK</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-bold" title={p.descricao}>{p.descricao}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums">
                      {String(disponivel)} <span className="text-xs font-medium text-zinc-400">{p.unidade} disp. · mín {String(p.estoque_minimo)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400 tabular-nums">
                      físico {String(fisico)} · reservado {String(reservado)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <form onSubmit={salvarMov} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Registrar movimentação</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select aria-label="Produto" required value={movProduto} onChange={(e) => setMovProduto(e.target.value)} disabled={salvandoMov} className={campo}>
                <option value="">Produto…</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>
                ))}
              </select>
              <select aria-label="Tipo" value={movTipo} onChange={(e) => setMovTipo(e.target.value as TipoMovimentacao)} disabled={salvandoMov} className={campo}>
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>{t.rotulo}</option>
                ))}
              </select>
              <input aria-label="Quantidade" type="number" required min="0" step="0.01" value={movQtd} onChange={(e) => setMovQtd(e.target.value)} disabled={salvandoMov} className={campo} />
              <button type="submit" disabled={salvandoMov} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                {salvandoMov && <LoaderCircle className="size-4 animate-spin" />}
                Movimentar
              </button>
            </div>
          </form>

          {movimentacoes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <ul className="space-y-2">
              {movimentacoes.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
                  {["entrada", "ajuste"].includes(m.tipo) ? (
                    <ArrowDownToLine className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <ArrowUpFromLine className="size-4 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{m.produto_nome}</p>
                    <p className="text-xs text-zinc-500">
                      {m.tipo} · {formatarDataHora(m.created_at)} · {m.executado_por}
                    </p>
                  </div>
                  <p className="font-black tabular-nums">
                    {m.tipo === "ajuste" ? "=" : ["entrada", "devolucao"].includes(m.tipo) ? "+" : "−"}{String(m.quantidade)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-xs text-zinc-400">Movimentações de hoje: {movimentacoes.filter((m) => m.created_at.slice(0, 10) === hojeISO()).length} · Valor em estoque: {formatarMoeda(produtos.reduce((s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.custo_medio ?? 0), 0))}</p>
    </div>
  );
}
