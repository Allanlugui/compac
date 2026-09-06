"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle, PackagePlus, Pencil, TriangleAlert } from "lucide-react";
import type { Movimentacao, Produto, TipoMovimentacao } from "@/lib/types";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  atualizarProduto,
  criarProduto,
  criarUnidade,
  movimentarEstoque,
  transferirEstoque,
  vincularFornecedor,
} from "./actions";

const TIPOS: { id: TipoMovimentacao; rotulo: string }[] = [
  { id: "entrada", rotulo: "Entrada" },
  { id: "saida", rotulo: "Saída" },
  { id: "ajuste", rotulo: "Ajuste (define físico)" },
  { id: "reserva", rotulo: "Reserva p/ O.S." },
  { id: "consumo", rotulo: "Consumo em O.S." },
  { id: "devolucao", rotulo: "Devolução de reserva" },
];

function hojeISO(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export interface Opt {
  id: string;
  nome: string;
}

export default function EstoqueClient({
  produtos,
  movimentacoes,
  unidades,
  categorias,
  fornecedores,
}: {
  produtos: Produto[];
  movimentacoes: (Movimentacao & { produto_nome: string })[];
  unidades: { sigla: string; nome: string }[];
  categorias: Opt[];
  fornecedores: Opt[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"produtos" | "movs" | "inventario">("produtos");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Novo produto
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [sku, setSku] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [minimo, setMinimo] = useState("0");
  const [reposicao, setReposicao] = useState("0");
  const [categoriaId, setCategoriaId] = useState("");
  const [salvandoProd, setSalvandoProd] = useState(false);

  // Edição
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editMin, setEditMin] = useState("0");
  const [editMax, setEditMax] = useState("");
  const [editRep, setEditRep] = useState("0");
  const [editLoc, setEditLoc] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  // Movimentar
  const [movProduto, setMovProduto] = useState("");
  const [movTipo, setMovTipo] = useState<TipoMovimentacao>("entrada");
  const [movQtd, setMovQtd] = useState("1");
  const [movMotivo, setMovMotivo] = useState("");
  const [salvandoMov, setSalvandoMov] = useState(false);

  // Transferência
  const [trProduto, setTrProduto] = useState("");
  const [trQtd, setTrQtd] = useState("1");
  const [trOrigem, setTrOrigem] = useState("");
  const [trDestino, setTrDestino] = useState("");
  const [salvandoTr, setSalvandoTr] = useState(false);

  // Inventário (contagem → diferença → ajuste)
  const [invProduto, setInvProduto] = useState("");
  const [invContagem, setInvContagem] = useState("");
  const [invMotivo, setInvMotivo] = useState("");
  const [salvandoInv, setSalvandoInv] = useState(false);

  // Unidade nova
  const [uniSigla, setUniSigla] = useState("");
  const [uniNome, setUniNome] = useState("");

  // Vínculo fornecedor
  const [vincForn, setVincForn] = useState("");
  const [vincPrincipal, setVincPrincipal] = useState(false);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return produtos;
    return produtos.filter((p) =>
      `${p.codigo} ${p.descricao} ${p.categoria ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(t),
    );
  }, [produtos, busca]);

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoProd) return;
    setErro(null);
    setSalvandoProd(true);
    try {
      const r = await criarProduto({
        codigo, descricao, categoria: "", unidade,
        minimo: Number(minimo), maximo: null, localizacao: "", custo: 0,
        sku, pontoReposicao: Number(reposicao), categoriaId: categoriaId || null,
      });
      if (!r.ok) throw new Error(r.error);
      setCodigo(""); setDescricao(""); setSku(""); setMinimo("0"); setReposicao("0"); setCategoriaId("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvandoProd(false);
    }
  }

  function abrirEdicao(p: Produto) {
    setEditId(p.id);
    setEditDesc(p.descricao);
    setEditMin(String(p.estoque_minimo ?? 0));
    setEditMax(p.estoque_maximo !== null && p.estoque_maximo !== undefined ? String(p.estoque_maximo) : "");
    setEditRep(String(p.ponto_reposicao ?? 0));
    setEditLoc(p.localizacao ?? "");
    setEditAtivo(p.ativo);
    setVincForn(p.fornecedor_id ?? "");
  }

  async function salvarEdicao(produtoId: string) {
    if (salvandoEdit) return;
    setErro(null);
    setSalvandoEdit(true);
    try {
      const r = await atualizarProduto({
        id: produtoId, descricao: editDesc,
        minimo: Number(editMin), maximo: editMax.trim() === "" ? null : Number(editMax),
        pontoReposicao: Number(editRep), localizacao: editLoc,
        unidade: "UN", categoria: "", fornecedorId: vincForn || null, ativo: editAtivo,
      });
      if (!r.ok) throw new Error(r.error);
      if (vincForn !== "") {
        const v = await vincularFornecedor({ produtoId, fornecedorId: vincForn, principal: vincPrincipal });
        if (!v.ok) throw new Error(v.error);
      }
      setEditId(null);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvandoEdit(false);
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
        chamadoId: "", observacao: movMotivo,
      });
      if (!r.ok) throw new Error(r.error);
      setMovProduto(""); setMovQtd("1"); setMovMotivo("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvandoMov(false);
    }
  }

  async function salvarTransferencia(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoTr) return;
    setErro(null);
    setSalvandoTr(true);
    try {
      const r = await transferirEstoque({
        produtoId: trProduto, quantidade: Number(trQtd), origem: trOrigem, destino: trDestino,
      });
      if (!r.ok) throw new Error(r.error);
      setTrProduto(""); setTrQtd("1"); setTrOrigem(""); setTrDestino("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvandoTr(false);
    }
  }

  async function salvarInventario(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoInv) return;
    setErro(null);
    const prod = produtos.find((p) => p.id === invProduto);
    if (!prod) {
      setErro("Selecione o produto.");
      return;
    }
    const contagem = Number(invContagem);
    if (!Number.isFinite(contagem) || contagem < 0) {
      setErro("Contagem inválida.");
      return;
    }
    const fisico = Number(prod.estoque_atual ?? 0);
    if (contagem === fisico) {
      setErro("Sem diferença: contagem igual ao físico.");
      return;
    }
    if (invMotivo.trim() === "") {
      setErro("Inventário exige motivo do ajuste.");
      return;
    }
    if (!confirm(`Ajustar ${prod.codigo} de ${fisico} para ${contagem}?`)) return;
    setSalvandoInv(true);
    try {
      const r = await movimentarEstoque({
        produtoId: prod.id, tipo: "ajuste", quantidade: contagem,
        custoUnitario: 0, chamadoId: "", observacao: `Inventário: ${invMotivo.trim()}`,
      });
      if (!r.ok) throw new Error(r.error);
      setInvProduto(""); setInvContagem(""); setInvMotivo("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvandoInv(false);
    }
  }

  async function salvarUnidade(e: React.FormEvent) {
    e.preventDefault();
    if (uniSigla.trim() === "" || uniNome.trim() === "") return;
    setErro(null);
    try {
      const r = await criarUnidade({ sigla: uniSigla, nome: uniNome });
      if (!r.ok) throw new Error(r.error);
      setUniSigla(""); setUniNome("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5">
        {(["produtos", "movs", "inventario"] as const).map((id) => (
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
            {id === "produtos" ? `Produtos (${produtos.length})` : id === "movs" ? `Movimentações (${movimentacoes.length})` : "Inventário"}
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
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input aria-label="Código" required minLength={2} maxLength={40} placeholder="Código *" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} disabled={salvandoProd} className={campo} />
              <input aria-label="Descrição" required minLength={2} maxLength={160} placeholder="Descrição *" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={salvandoProd} className={`${campo} sm:col-span-2`} />
              <input aria-label="SKU" maxLength={40} placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} disabled={salvandoProd} className={campo} />
              <select aria-label="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={salvandoProd} className={campo}>
                {unidades.map((u) => (
                  <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>
                ))}
              </select>
              <select aria-label="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={salvandoProd} className={campo}>
                <option value="">Categoria…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <input aria-label="Estoque mínimo" type="number" min="0" step="0.01" placeholder="Mínimo" value={minimo} onChange={(e) => setMinimo(e.target.value)} disabled={salvandoProd} className={campo} />
              <input aria-label="Ponto de reposição" type="number" min="0" step="0.01" placeholder="Reposição" value={reposicao} onChange={(e) => setReposicao(e.target.value)} disabled={salvandoProd} className={campo} />
            </div>
            <button type="submit" disabled={salvandoProd} className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
              {salvandoProd && <LoaderCircle className="size-4 animate-spin" />}
              Cadastrar
            </button>
          </form>

          <form onSubmit={salvarUnidade} className="flex flex-wrap items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="w-full text-xs font-bold tracking-wide text-zinc-500 uppercase">Unidades de medida da org</p>
            <input aria-label="Sigla" maxLength={10} placeholder="Sigla" value={uniSigla} onChange={(e) => setUniSigla(e.target.value.toUpperCase())} className={`${campo} max-w-28`} />
            <input aria-label="Nome da unidade" maxLength={40} placeholder="Nome" value={uniNome} onChange={(e) => setUniNome(e.target.value)} className={`${campo} max-w-56`} />
            <button type="submit" className="inline-flex min-h-[44px] items-center rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700">
              Adicionar
            </button>
            <span className="text-xs text-zinc-400">{unidades.map((u) => u.sigla).join(" · ")}</span>
          </form>

          <label className="block">
            <span className="sr-only">Buscar produto</span>
            <input type="search" placeholder="Buscar por código, descrição, categoria ou SKU…" value={busca} onChange={(e) => setBusca(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none" />
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
                const disp = fisico - reservado;
                const critico = disp <= Number(p.estoque_minimo ?? 0);
                const reposicaoAtiva = disp <= Number(p.ponto_reposicao ?? 0);
                const editando = editId === p.id;
                return (
                  <li key={p.id} className={cn("rounded-2xl border bg-white p-4 shadow-sm", critico ? "border-red-300 ring-1 ring-red-200" : "border-zinc-200")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-xs font-black text-zinc-500">{p.codigo}{p.sku ? ` · ${p.sku}` : ""}</p>
                      {critico ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700 ring-1 ring-red-200">CRÍTICO</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">OK</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-bold" title={p.descricao}>{p.descricao}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums">
                      {String(disp)} <span className="text-xs font-medium text-zinc-400">{p.unidade} disp. · mín {String(p.estoque_minimo)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400 tabular-nums">
                      físico {String(fisico)} · reservado {String(reservado)}
                    </p>
                    {reposicaoAtiva && (
                      <a href={`/admin/compras/solicitacoes/nova?produto=${p.id}`} className="mt-2 inline-flex min-h-[40px] items-center rounded-lg bg-amber-100 px-3 text-xs font-black text-amber-800 ring-1 ring-amber-200 hover:bg-amber-200">
                        Repor: gerar solicitação
                      </a>
                    )}
                    <div className="mt-2">
                      <button type="button" onClick={() => (editando ? setEditId(null) : abrirEdicao(p))} className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600 underline-offset-2 hover:underline">
                        <Pencil className="size-3" /> {editando ? "fechar" : "editar"}
                      </button>
                    </div>
                    {editando && (
                      <div className="mt-2 grid gap-2 border-t border-zinc-100 pt-2">
                        <input aria-label="Descrição" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={160} className={campo} />
                        <div className="grid grid-cols-3 gap-2">
                          <input aria-label="Mínimo" type="number" min="0" step="0.01" value={editMin} onChange={(e) => setEditMin(e.target.value)} className={campo} />
                          <input aria-label="Máximo" type="number" min="0" step="0.01" placeholder="Máx" value={editMax} onChange={(e) => setEditMax(e.target.value)} className={campo} />
                          <input aria-label="Reposição" type="number" min="0" step="0.01" placeholder="Repos." value={editRep} onChange={(e) => setEditRep(e.target.value)} className={campo} />
                        </div>
                        <input aria-label="Localização" value={editLoc} onChange={(e) => setEditLoc(e.target.value)} maxLength={160} placeholder="Localização" className={campo} />
                        <select aria-label="Fornecedor principal" value={vincForn} onChange={(e) => setVincForn(e.target.value)} className={campo}>
                          <option value="">Fornecedor…</option>
                          {fornecedores.map((f) => (
                            <option key={f.id} value={f.id}>{f.nome}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                          <input type="checkbox" checked={vincPrincipal} onChange={(e) => setVincPrincipal(e.target.checked)} className="size-4 accent-zinc-900" />
                          Marcar como principal
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                          <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} className="size-4 accent-zinc-900" />
                          Produto ativo
                        </label>
                        <button type="button" onClick={() => salvarEdicao(p.id)} disabled={salvandoEdit} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                          {salvandoEdit && <LoaderCircle className="size-4 animate-spin" />}
                          Salvar
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : aba === "movs" ? (
        <div className="space-y-4">
          <form onSubmit={salvarMov} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Registrar movimentação</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
              <input aria-label="Motivo" maxLength={200} placeholder="Motivo" value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} disabled={salvandoMov} className={campo} />
              <button type="submit" disabled={salvandoMov} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                {salvandoMov && <LoaderCircle className="size-4 animate-spin" />}
                Movimentar
              </button>
            </div>
          </form>

          <form onSubmit={salvarTransferencia} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">Transferência entre locais (par auditado, rede zero)</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select aria-label="Produto" required value={trProduto} onChange={(e) => setTrProduto(e.target.value)} disabled={salvandoTr} className={campo}>
                <option value="">Produto…</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>
                ))}
              </select>
              <input aria-label="Quantidade" type="number" required min="0" step="0.01" value={trQtd} onChange={(e) => setTrQtd(e.target.value)} disabled={salvandoTr} className={campo} />
              <input aria-label="Origem" required maxLength={80} placeholder="Origem (Almox A)" value={trOrigem} onChange={(e) => setTrOrigem(e.target.value)} disabled={salvandoTr} className={campo} />
              <input aria-label="Destino" required maxLength={80} placeholder="Destino (Almox B)" value={trDestino} onChange={(e) => setTrDestino(e.target.value)} disabled={salvandoTr} className={campo} />
              <button type="submit" disabled={salvandoTr} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                {salvandoTr && <LoaderCircle className="size-4 animate-spin" />}
                Transferir
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
                  {["entrada", "devolucao"].includes(m.tipo) ? (
                    <ArrowDownToLine className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <ArrowUpFromLine className="size-4 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{m.produto_nome}</p>
                    <p className="text-xs text-zinc-500">
                      {m.tipo} · {formatarDataHora(m.created_at)} · {m.executado_por}
                      {(m as { origem?: string | null }).origem ? ` · ${(m as { origem?: string | null }).origem} → ${(m as { destino?: string | null }).destino}` : ""}
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
      ) : (
        <form onSubmit={salvarInventario} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Inventário: contagem → diferença → ajuste auditado</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select aria-label="Produto" required value={invProduto} onChange={(e) => setInvProduto(e.target.value)} disabled={salvandoInv} className={campo}>
              <option value="">Produto…</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.codigo} — fís {String(Number(p.estoque_atual ?? 0))}</option>
              ))}
            </select>
            <input aria-label="Contagem física" type="number" required min="0" step="0.01" placeholder="Contagem" value={invContagem} onChange={(e) => setInvContagem(e.target.value)} disabled={salvandoInv} className={campo} />
            <input aria-label="Motivo" required maxLength={200} placeholder="Motivo do ajuste *" value={invMotivo} onChange={(e) => setInvMotivo(e.target.value)} disabled={salvandoInv} className={campo} />
            <button type="submit" disabled={salvandoInv} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
              {salvandoInv && <LoaderCircle className="size-4 animate-spin" />}
              Confirmar ajuste
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-400">Ajuste exige permissão de ADMIN/GESTOR e motivo obrigatório. Reserva preservada.</p>
        </form>
      )}
      <p className="text-xs text-zinc-400">Movimentações de hoje: {movimentacoes.filter((m) => m.created_at.slice(0, 10) === hojeISO()).length} · Valor em estoque: {formatarMoeda(produtos.reduce((s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.custo_medio ?? 0), 0))}</p>
    </div>
  );
}
