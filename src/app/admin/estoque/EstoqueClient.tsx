"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpDown,
  Eye,
  FileUp,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
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
  processarNotaFiscal,
  confirmarEntradaNotaFiscal,
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

type Ordenacao = "codigo_asc" | "codigo_desc" | "descricao_asc" | "descricao_desc" | "estoque_desc" | "estoque_asc" | "atualizado_desc";
type FiltroStatus = "todos" | "criticos" | "reposicao" | "inativos" | "ativos";

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
  const [aba, setAba] = useState<"produtos" | "movs" | "inventario" | "notas">("produtos");
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("codigo_asc");
  const [erro, setErro] = useState<string | null>(null);

  // Ficha detalhada
  const [fichaId, setFichaId] = useState<string | null>(null);
  const fichaProduto = useMemo(() => produtos.find((p) => p.id === fichaId) ?? null, [produtos, fichaId]);

  // Novo produto
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [sku, setSku] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [minimo, setMinimo] = useState("0");
  const [reposicao, setReposicao] = useState("0");
  const [categoriaId, setCategoriaId] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [localNovo, setLocalNovo] = useState("");
  const [fornecedorNovoId, setFornecedorNovoId] = useState("");
  const [custoNovo, setCustoNovo] = useState("0");
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
  const [vincForn, setVincForn] = useState("");
  const [vincPrincipal, setVincPrincipal] = useState(false);

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

  // Inventário
  const [invProduto, setInvProduto] = useState("");
  const [invContagem, setInvContagem] = useState("");
  const [invMotivo, setInvMotivo] = useState("");
  const [salvandoInv, setSalvandoInv] = useState(false);

  // Unidade nova
  const [uniSigla, setUniSigla] = useState("");
  const [uniNome, setUniNome] = useState("");

  // Nota Fiscal
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [nfPreview, setNfPreview] = useState<null | {
    numero: string;
    serie: string;
    chave: string;
    emitente: string;
    cnpj: string;
    dataEmissao: string;
    valorTotal: number;
    itens: { codigo: string; descricao: string; qtd: number; valorUnit: number; valorTotal: number; ncm?: string }[];
  }>(null);
  const [nfProcessando, setNfProcessando] = useState(false);
  const [nfConfirmando, setNfConfirmando] = useState(false);

  const categoriaNome = useMemo(() => {
    const m = new Map(categorias.map((c) => [c.id, c.nome]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [categorias]);

  const filtrados = useMemo(() => {
    let r = [...produtos];
    const t = busca.trim().toLowerCase();
    if (t) {
      r = r.filter((p) =>
        `${p.codigo} ${p.descricao} ${p.sku ?? ""} ${p.codigo_fornecedor ?? ""} ${p.categoria ?? ""} ${categoriaNome(p.categoria_id)}`.toLowerCase().includes(t),
      );
    }
    if (categoriaFiltro) r = r.filter((p) => p.categoria_id === categoriaFiltro);
    if (statusFiltro === "criticos") r = r.filter((p) => Number(p.estoque_atual ?? 0) - Number(p.estoque_reservado ?? 0) <= Number(p.estoque_minimo ?? 0));
    else if (statusFiltro === "reposicao") r = r.filter((p) => Number(p.estoque_atual ?? 0) - Number(p.estoque_reservado ?? 0) <= Number(p.ponto_reposicao ?? 0));
    else if (statusFiltro === "inativos") r = r.filter((p) => !p.ativo);
    else if (statusFiltro === "ativos") r = r.filter((p) => p.ativo);

    r.sort((a, b) => {
      if (ordenacao === "codigo_asc") return a.codigo.localeCompare(b.codigo);
      if (ordenacao === "codigo_desc") return b.codigo.localeCompare(a.codigo);
      if (ordenacao === "descricao_asc") return a.descricao.localeCompare(b.descricao);
      if (ordenacao === "descricao_desc") return b.descricao.localeCompare(a.descricao);
      if (ordenacao === "estoque_desc") return Number(b.estoque_atual ?? 0) - Number(a.estoque_atual ?? 0);
      if (ordenacao === "estoque_asc") return Number(a.estoque_atual ?? 0) - Number(b.estoque_atual ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return r;
  }, [produtos, busca, categoriaFiltro, statusFiltro, ordenacao, categoriaNome]);

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoProd) return;
    setErro(null);
    setSalvandoProd(true);
    try {
      const r = await criarProduto({
        codigo, descricao, categoria: "", unidade,
        minimo: Number(minimo), maximo: null, localizacao: localNovo, custo: Number(custoNovo),
        sku, subcategoria, pontoReposicao: Number(reposicao), categoriaId: categoriaId || null, fornecedorId: fornecedorNovoId || null,
      });
      if (!r.ok) throw new Error(r.error);
      setCodigo(""); setDescricao(""); setSku(""); setMinimo("0"); setReposicao("0"); setCategoriaId(""); setSubcategoria(""); setLocalNovo(""); setFornecedorNovoId(""); setCustoNovo("0");
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
    if (!prod) { setErro("Selecione o produto."); return; }
    const contagem = Number(invContagem);
    if (!Number.isFinite(contagem) || contagem < 0) { setErro("Contagem inválida."); return; }
    const fisico = Number(prod.estoque_atual ?? 0);
    if (contagem === fisico) { setErro("Sem diferença: contagem igual ao físico."); return; }
    if (invMotivo.trim() === "") { setErro("Inventário exige motivo do ajuste."); return; }
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

  async function handleNfProcessar() {
    if (!nfFile) { setErro("Selecione um arquivo XML ou PDF da NF-e."); return; }
    setErro(null);
    setNfProcessando(true);
    try {
      const fd = new FormData();
      fd.set("file", nfFile);
      const r = await processarNotaFiscal(fd);
      if (!r.ok) throw new Error(r.error);
      setNfPreview(r.data as typeof nfPreview);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao processar NF.");
    } finally {
      setNfProcessando(false);
    }
  }

  async function handleNfConfirmar() {
    if (!nfPreview) return;
    setNfConfirmando(true);
    setErro(null);
    try {
      const r = await confirmarEntradaNotaFiscal({ itens: nfPreview.itens, chave: nfPreview.chave, numero: nfPreview.numero });
      if (!r.ok) throw new Error(r.error);
      setNfPreview(null);
      setNfFile(null);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao confirmar entrada.");
    } finally {
      setNfConfirmando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5 overflow-x-auto">
        {(["produtos", "movs", "inventario", "notas"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-pressed={aba === id}
            className={cn(
              "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition",
              aba === id ? "bg-white shadow-md ring-1 ring-zinc-200" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {id === "produtos" ? `Produtos (${produtos.length})` : id === "movs" ? `Movimentações (${movimentacoes.length})` : id === "inventario" ? "Inventário" : "Notas Fiscais"}
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
              <input aria-label="Código" required minLength={2} maxLength={40} placeholder="Código * (ex: 884116412519)" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} disabled={salvandoProd} className={campo} />
              <input aria-label="Descrição" required minLength={2} maxLength={160} placeholder="Descrição * (ex: Dell Notebook Latitude 7000)" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={salvandoProd} className={`${campo} sm:col-span-2`} />
              <input aria-label="SKU" maxLength={40} placeholder="SKU (opcional)" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} disabled={salvandoProd} className={campo} />
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
              <input aria-label="Subcategoria" maxLength={80} placeholder="Subcategoria" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} disabled={salvandoProd} className={campo} />
              <input aria-label="Localização" maxLength={160} placeholder="Localização (ex: Almoxarifado principal)" value={localNovo} onChange={(e) => setLocalNovo(e.target.value)} disabled={salvandoProd} className={campo} />
              <select aria-label="Fornecedor" value={fornecedorNovoId} onChange={(e) => setFornecedorNovoId(e.target.value)} disabled={salvandoProd} className={campo}>
                <option value="">Fornecedor…</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
              <input aria-label="Custo unit." type="number" min="0" step="0.01" placeholder="Custo R$ (ex: 2250,00)" value={custoNovo} onChange={(e) => setCustoNovo(e.target.value)} disabled={salvandoProd} className={campo} />
              <input aria-label="Estoque mínimo" type="number" min="0" step="0.01" placeholder="Mínimo (ex: 1)" value={minimo} onChange={(e) => setMinimo(e.target.value)} disabled={salvandoProd} className={campo} />
              <input aria-label="Ponto de reposição" type="number" min="0" step="0.01" placeholder="Reposição (ex: 2)" value={reposicao} onChange={(e) => setReposicao(e.target.value)} disabled={salvandoProd} className={campo} />
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
            <button type="submit" className="inline-flex min-h-[44px] items-center rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700">Adicionar</button>
            <span className="text-xs text-zinc-400">{unidades.map((u) => u.sigla).join(" · ")}</span>
          </form>

          {/* Filtros e ordenação */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-12">
              <div className="relative sm:col-span-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <input type="search" placeholder="Buscar por código, descrição, SKU, cód. fornecedor…" value={busca} onChange={(e) => setBusca(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none" />
              </div>
              <select aria-label="Filtrar categoria" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className={`${campo} sm:col-span-3`}>
                <option value="">Todas categorias</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <select aria-label="Filtrar status" value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as FiltroStatus)} className={`${campo} sm:col-span-2`}>
                <option value="todos">Todos status</option>
                <option value="ativos">Ativos</option>
                <option value="criticos">Críticos</option>
                <option value="reposicao">Abaixo reposição</option>
                <option value="inativos">Inativos</option>
              </select>
              <div className="flex gap-1 sm:col-span-2">
                <select aria-label="Ordenação" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as Ordenacao)} className={`${campo} flex-1`}>
                  <option value="codigo_asc">Código A→Z</option>
                  <option value="codigo_desc">Código Z→A</option>
                  <option value="descricao_asc">Descrição A→Z</option>
                  <option value="descricao_desc">Descrição Z→A</option>
                  <option value="estoque_desc">Maior estoque</option>
                  <option value="estoque_asc">Menor estoque</option>
                  <option value="atualizado_desc">Mais recentes</option>
                </select>
                <button type="button" onClick={() => { setBusca(""); setCategoriaFiltro(""); setStatusFiltro("todos"); setOrdenacao("codigo_asc"); }} className="rounded-lg border border-zinc-300 bg-white px-3 text-xs font-bold text-zinc-600 hover:bg-zinc-50">Limpar</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">{filtrados.length} de {produtos.length} produtos · {filtrados.filter((p) => Number(p.estoque_atual ?? 0) - Number(p.estoque_reservado ?? 0) <= Number(p.estoque_minimo ?? 0)).length} críticos</p>
          </div>

          {filtrados.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">Nenhum produto encontrado.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2">Código</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="whitespace-nowrap px-3 py-2">Categoria</th>
                      <th className="whitespace-nowrap px-3 py-2">Códigos</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Disponível</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Físico / Reserv.</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Mín / Rep.</th>
                      <th className="px-3 py-2">Local</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Custo / Total</th>
                      <th className="whitespace-nowrap px-3 py-2">Status</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtrados.map((p) => {
                      const fisico = Number(p.estoque_atual ?? 0);
                      const reservado = Number(p.estoque_reservado ?? 0);
                      const disp = fisico - reservado;
                      const critico = disp <= Number(p.estoque_minimo ?? 0);
                      const reposicaoAtiva = disp <= Number(p.ponto_reposicao ?? 0);
                      const editando = editId === p.id;
                      return (
                        <tr key={p.id} className={cn("hover:bg-zinc-50", !p.ativo && "bg-zinc-50/60 opacity-60", critico && "bg-red-50/40")}>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold">{p.codigo}</td>
                          <td className="max-w-[260px] truncate px-3 py-2 font-medium" title={p.descricao}>{p.descricao}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs">
                            <div>{categoriaNome(p.categoria_id)}</div>
                            {p.subcategoria && <div className="text-[11px] text-zinc-400">{p.subcategoria}</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                            <div>{p.sku ?? "—"}</div>
                            {p.codigo_fornecedor && <div className="text-[11px] text-zinc-400">Forn: {p.codigo_fornecedor}</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-black tabular-nums">
                            <span className={cn(critico ? "text-red-600" : "text-zinc-900")}>{disp}</span>
                            <span className="ml-1 text-xs font-normal text-zinc-400">{p.unidade}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-zinc-500">{fisico} / {reservado}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">{String(p.estoque_minimo)} / {String(p.ponto_reposicao)}</td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-xs" title={p.localizacao ?? ""}>{p.localizacao ?? "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">
                            <div>{formatarMoeda(Number(p.custo_medio ?? 0))}</div>
                            <div className="text-[11px] text-zinc-400">{formatarMoeda(fisico * Number(p.custo_medio ?? 0))}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {!p.ativo ? (
                              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-black text-zinc-600">INATIVO</span>
                            ) : critico ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700 ring-1 ring-red-200">CRÍTICO</span>
                            ) : reposicaoAtiva ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">REPOSIÇÃO</span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700">OK</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => setFichaId(p.id)} className="inline-flex size-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" title="Ficha detalhada">
                                <Eye className="size-3.5" />
                              </button>
                              <button type="button" onClick={() => (editando ? setEditId(null) : abrirEdicao(p))} className={cn("inline-flex size-7 items-center justify-center rounded-lg border text-zinc-600 hover:bg-zinc-50", editando ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")} title="Editar">
                                <Pencil className="size-3.5" />
                              </button>
                              <button type="button" onClick={() => { setMovProduto(p.id); setAba("movs"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex size-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" title="Movimentar">
                                <ArrowUpDown className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Drawer de edição — substitui o inline expandido */}
              {editId && (() => {
                const p = produtos.find((x) => x.id === editId);
                if (!p) return null;
                return (
                  <div className="fixed inset-0 z-50 flex">
                    <button type="button" aria-label="Fechar edição" onClick={() => setEditId(null)} className="flex-1 bg-black/40 backdrop-blur-sm" />
                    <div className="ml-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-white shadow-2xl">
                      <div className="flex items-start justify-between border-b border-zinc-200 p-4">
                        <div>
                          <p className="font-mono text-xs font-black text-zinc-500">{p.codigo} {p.sku ? `· ${p.sku}` : ""}</p>
                          <h3 className="text-lg font-black">Editar produto</h3>
                          <p className="text-xs text-zinc-500">{p.descricao}</p>
                        </div>
                        <button type="button" onClick={() => setEditId(null)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"><X className="size-5" /></button>
                      </div>
                      <div className="flex-1 space-y-4 overflow-y-auto p-4">
                        <label className="block">
                          <span className="text-xs font-bold text-zinc-700">Descrição *</span>
                          <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={160} placeholder="Descrição" className={`${campo} mt-1`} />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-bold text-zinc-700">Estoque mínimo</span>
                            <input type="number" min="0" step="0.01" value={editMin} onChange={(e) => setEditMin(e.target.value)} className={`${campo} mt-1`} />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-zinc-700">Estoque máximo</span>
                            <input type="number" min="0" step="0.01" placeholder="Sem limite" value={editMax} onChange={(e) => setEditMax(e.target.value)} className={`${campo} mt-1`} />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-bold text-zinc-700">Ponto de reposição</span>
                            <input type="number" min="0" step="0.01" value={editRep} onChange={(e) => setEditRep(e.target.value)} className={`${campo} mt-1`} />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-zinc-700">Localização</span>
                            <input value={editLoc} onChange={(e) => setEditLoc(e.target.value)} maxLength={160} placeholder="Ex: Almox A — Prateleira 3" className={`${campo} mt-1`} />
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-xs font-bold text-zinc-700">Fornecedor</span>
                          <select value={vincForn} onChange={(e) => setVincForn(e.target.value)} className={`${campo} mt-1`}>
                            <option value="">— Nenhum —</option>
                            {fornecedores.map((f) => (
                              <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                            <input type="checkbox" checked={vincPrincipal} onChange={(e) => setVincPrincipal(e.target.checked)} className="size-4 accent-zinc-900" />
                            Definir como principal
                          </label>
                          <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                            <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} className="size-4 accent-zinc-900" />
                            Produto ativo
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2 border-t border-zinc-200 p-4">
                        <button type="button" onClick={() => setEditId(null)} className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50">Cancelar</button>
                        <button type="button" onClick={() => salvarEdicao(p.id)} disabled={salvandoEdit} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                          {salvandoEdit && <LoaderCircle className="size-4 animate-spin" />}
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : aba === "notas" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black"><FileUp className="size-4" /> Importar Nota Fiscal (DANFE / XML / PDF)</h3>
            <p className="mt-1 text-xs text-zinc-500">Envie o XML da NF-e ou o PDF da DANFE. Os itens serão extraídos automaticamente e você poderá confirmar a entrada no estoque.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="text-xs font-bold text-zinc-600">Arquivo</span>
                <input type="file" accept=".xml,.pdf" onChange={(e) => setNfFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1 file:text-sm file:font-bold file:text-white hover:file:bg-zinc-700" />
              </label>
              <button type="button" onClick={handleNfProcessar} disabled={!nfFile || nfProcessando} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                {nfProcessando && <LoaderCircle className="size-4 animate-spin" />}
                Extrair dados
              </button>
              {nfFile && <span className="text-xs text-zinc-500">{nfFile.name} · {(nfFile.size / 1024).toFixed(1)} KB</span>}
            </div>
          </div>

          {nfPreview && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black">NF-e {nfPreview.numero} · Série {nfPreview.serie}</h4>
                  <p className="text-xs text-zinc-500">{nfPreview.emitente} · {nfPreview.cnpj} · {nfPreview.dataEmissao ? new Date(nfPreview.dataEmissao).toLocaleDateString("pt-BR") : "—"} · Chave: <span className="font-mono">{nfPreview.chave}</span></p>
                  <p className="mt-1 text-sm font-bold">Total: {formatarMoeda(nfPreview.valorTotal)} · {nfPreview.itens.length} itens</p>
                </div>
                <button type="button" onClick={() => setNfPreview(null)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="size-4" /></button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-2 py-1">Código</th>
                      <th className="px-2 py-1">Descrição</th>
                      <th className="px-2 py-1 text-right">Qtd</th>
                      <th className="px-2 py-1 text-right">Unit.</th>
                      <th className="px-2 py-1 text-right">Total</th>
                      <th className="px-2 py-1">NCM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {nfPreview.itens.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1 font-mono text-xs">{it.codigo}</td>
                        <td className="px-2 py-1">{it.descricao}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{it.qtd}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatarMoeda(it.valorUnit)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatarMoeda(it.valorTotal)}</td>
                        <td className="px-2 py-1 font-mono text-xs">{it.ncm ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={handleNfConfirmar} disabled={nfConfirmando} className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                {nfConfirmando && <LoaderCircle className="size-4 animate-spin" />}
                Confirmar entrada no estoque ({nfPreview.itens.length} itens)
              </button>
              <p className="mt-1 text-xs text-zinc-400">Itens inexistentes serão criados automaticamente (código = cProd da NF). Quantidades entrarão como “entrada” auditada.</p>
            </div>
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
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">Nenhuma movimentação registrada.</p>
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

      {/* Ficha detalhada */}
      {fichaProduto && (
        <div className="fixed inset-0 z-50 flex">
          <button type="button" aria-label="Fechar ficha" onClick={() => setFichaId(null)} className="flex-1 bg-black/40 backdrop-blur-sm" />
          <div className="ml-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 p-4">
              <div>
                <p className="font-mono text-xs font-black text-zinc-500">{fichaProduto.codigo} {fichaProduto.sku ? `· ${fichaProduto.sku}` : ""}</p>
                <h3 className="text-lg font-black">{fichaProduto.descricao}</h3>
                <p className="text-xs text-zinc-500">{categoriaNome(fichaProduto.categoria_id)} · {fichaProduto.unidade} · {fichaProduto.ativo ? "Ativo" : "Inativo"}</p>
              </div>
              <button type="button" onClick={() => setFichaId(null)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"><X className="size-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Disponível</p>
                  <p className="text-2xl font-black tabular-nums">{Number(fichaProduto.estoque_atual ?? 0) - Number(fichaProduto.estoque_reservado ?? 0)} <span className="text-xs font-normal text-zinc-500">{fichaProduto.unidade}</span></p>
                  <p className="text-xs text-zinc-500">Físico {String(fichaProduto.estoque_atual)} · Reservado {String(fichaProduto.estoque_reservado)}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Financeiro</p>
                  <p className="text-sm font-bold">{formatarMoeda(Number(fichaProduto.custo_medio ?? 0))} <span className="text-xs font-normal text-zinc-500">médio</span></p>
                  <p className="text-xs text-zinc-500">Último {formatarMoeda(Number(fichaProduto.ultimo_custo ?? 0))} · Total {formatarMoeda(Number(fichaProduto.estoque_atual ?? 0) * Number(fichaProduto.custo_medio ?? 0))}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Mín / Máx / Reposição</p>
                  <p className="text-sm font-bold tabular-nums">{String(fichaProduto.estoque_minimo)} / {fichaProduto.estoque_maximo ?? "—"} / {String(fichaProduto.ponto_reposicao)}</p>
                  <p className="text-xs text-zinc-500">Local: {fichaProduto.localizacao ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Códigos</p>
                  <p className="font-mono text-xs">SKU: {fichaProduto.sku ?? "—"}</p>
                  <p className="font-mono text-xs">Forn: {fichaProduto.codigo_fornecedor ?? "—"}</p>
                  <p className="text-xs text-zinc-500">Subcat: {fichaProduto.subcategoria ?? "—"}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-zinc-500">Movimentações recentes</h4>
                <ul className="mt-2 space-y-1">
                  {movimentacoes.filter((m) => m.produto_id === fichaProduto.id).slice(0, 8).map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2 text-xs">
                      <span>{m.tipo} · {formatarDataHora(m.created_at)} · {m.quantidade} {fichaProduto.unidade}</span>
                      <span className="font-mono text-zinc-500">{m.observacao?.slice(0, 40) ?? ""}</span>
                    </li>
                  ))}
                  {movimentacoes.filter((m) => m.produto_id === fichaProduto.id).length === 0 && <li className="text-xs text-zinc-400">Nenhuma movimentação.</li>}
                </ul>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setFichaId(null); abrirEdicao(fichaProduto); }} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-bold hover:bg-zinc-50"><Pencil className="size-4" /> Editar</button>
                <button type="button" onClick={() => { setFichaId(null); setMovProduto(fichaProduto.id); setAba("movs"); }} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700"><ArrowUpDown className="size-4" /> Movimentar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-400">Movimentações de hoje: {movimentacoes.filter((m) => m.created_at.slice(0, 10) === hojeISO()).length} · Valor em estoque: {formatarMoeda(produtos.reduce((s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.custo_medio ?? 0), 0))}</p>
    </div>
  );
}
