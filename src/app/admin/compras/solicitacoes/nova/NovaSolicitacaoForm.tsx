"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { criarSolicitacaoInterna, type NovoItemInput } from "../actions";

export interface ProdutoOpt {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  fisico: number;
  reservado: number;
  minimo: number;
}

/** Nova solicitação interna (com reposição pré-preenchida quando ?produto=). */
export default function NovaSolicitacaoForm({
  produtos,
  prefill,
}: {
  produtos: ProdutoOpt[];
  prefill: {
    produto_id: string | null;
    descricao: string;
    unidade: string;
    justificativa: string;
  } | null;
}) {
  const router = useRouter();
  const [solicitante, setSolicitante] = useState("");
  const [setor, setSetor] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [origem, setOrigem] = useState<"portal" | "manual" | "estoque">(prefill ? "estoque" : "portal");
  const [prioridade, setPrioridade] = useState("media");
  const [centroCusto, setCentroCusto] = useState("");
  const [prazo, setPrazo] = useState("");
  const [justificativa, setJustificativa] = useState(prefill?.justificativa ?? "");
  const [itens, setItens] = useState<NovoItemInput[]>(
    prefill
      ? [{ produto_id: prefill.produto_id, descricao: prefill.descricao, quantidade: 1, unidade: prefill.unidade, justificativa: "", urgencia: "normal" }]
      : [{ descricao: "", quantidade: 1, unidade: "UN", justificativa: "", urgencia: "normal" }],
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function setItem(i: number, campo: keyof NovoItemInput, valor: string | number) {
    setItens((lista) => lista.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  }

  function escolherProduto(i: number, produtoId: string) {
    const p = produtos.find((x) => x.id === produtoId);
    setItens((lista) =>
      lista.map((it, j) =>
        j === i
          ? {
              ...it,
              produto_id: produtoId || null,
              descricao: p ? `${p.codigo} — ${p.descricao}` : it.descricao,
              unidade: p ? p.unidade : it.unidade,
            }
          : it,
      ),
    );
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await criarSolicitacaoInterna({
        solicitante,
        setor,
        departamento,
        origem,
        prioridade,
        centro_custo: centroCusto,
        prazo,
        justificativa,
        itens: itens.map((it) => ({
          ...it,
          quantidade: Number(it.quantidade),
          produto_id: it.produto_id || null,
        })),
      });
      if (!r.ok) throw new Error(r.error);
      router.push(`/admin/compras/solicitacoes/${r.id}`);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";
  const rotulo = "mb-1 block text-xs font-bold text-zinc-700";

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black">Cabeçalho</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className={rotulo}>Solicitante *</span>
            <input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} disabled={salvando} required minLength={2} maxLength={120} className={campo} />
          </label>
          <label className="block"><span className={rotulo}>Setor *</span>
            <input value={setor} onChange={(e) => setSetor(e.target.value)} disabled={salvando} required minLength={2} maxLength={80} className={campo} />
          </label>
          <label className="block"><span className={rotulo}>Departamento</span>
            <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} disabled={salvando} maxLength={80} className={campo} />
          </label>
          <label className="block"><span className={rotulo}>Origem *</span>
            <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)} disabled={salvando} className={campo}>
              <option value="portal">Portal</option>
              <option value="manual">Manual</option>
              <option value="estoque">Reposição de estoque</option>
            </select>
          </label>
          <label className="block"><span className={rotulo}>Prioridade *</span>
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} disabled={salvando} className={campo}>
              <option value="baixa">Baixa</option><option value="media">Média</option>
              <option value="alta">Alta</option><option value="critica">Crítica</option>
            </select>
          </label>
          <label className="block"><span className={rotulo}>Centro de custo</span>
            <input value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} disabled={salvando} maxLength={80} className={campo} />
          </label>
          <label className="block"><span className={rotulo}>Prazo</span>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={salvando} className={campo} />
          </label>
          <label className="block sm:col-span-2 lg:col-span-1"><span className={rotulo}>Justificativa geral *</span>
            <input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} disabled={salvando} required minLength={5} maxLength={2000} className={campo} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black">Itens ({itens.length})</h2>
        <div className="mt-3 space-y-2">
          {itens.map((it, i) => {
            const p = produtos.find((x) => x.id === it.produto_id);
            return (
              <div key={i} className="grid gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-2 lg:grid-cols-6">
                <label className="block lg:col-span-2">
                  <span className={rotulo}>Produto (estoque)</span>
                  <select value={it.produto_id ?? ""} onChange={(e) => escolherProduto(i, e.target.value)} disabled={salvando} className={campo}>
                    <option value="">Avulso…</option>
                    {produtos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.codigo} (disp {x.fisico - x.reservado})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block lg:col-span-2">
                  <span className={rotulo}>Descrição *</span>
                  <input value={it.descricao} onChange={(e) => setItem(i, "descricao", e.target.value)} disabled={salvando} required minLength={2} maxLength={200} className={campo} />
                </label>
                <label className="block">
                  <span className={rotulo}>Qtd *</span>
                  <input type="number" min="0" step="0.01" value={String(it.quantidade)} onChange={(e) => setItem(i, "quantidade", e.target.value)} disabled={salvando} required className={campo} />
                </label>
                <label className="block">
                  <span className={rotulo}>Urgência</span>
                  <select value={it.urgencia ?? "normal"} onChange={(e) => setItem(i, "urgencia", e.target.value)} disabled={salvando} className={campo}>
                    <option value="baixa">Baixa</option><option value="normal">Normal</option>
                    <option value="alta">Alta</option><option value="critica">Crítica</option>
                  </select>
                </label>
                {p && (
                  <p className="text-xs text-zinc-500 lg:col-span-6">
                    Estoque: físico {p.fisico} · reservado {p.reservado} · disponível {p.fisico - p.reservado} · mín {p.minimo}
                  </p>
                )}
                <div className="lg:col-span-6">
                  <button type="button" onClick={() => setItens((l) => l.filter((_, j) => j !== i))} disabled={salvando || itens.length <= 1} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-60">
                    <Trash2 className="size-4" /> Remover item
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setItens([...itens, { descricao: "", quantidade: 1, unidade: "UN", justificativa: "", urgencia: "normal" }])} disabled={salvando || itens.length >= 30} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60">
          <Plus className="size-4" /> Adicionar item
        </button>
      </div>

      <button type="submit" disabled={salvando} className="inline-flex min-h-[52px] items-center gap-1.5 rounded-xl bg-zinc-900 px-8 font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
        {salvando && <LoaderCircle className="size-5 animate-spin" />}
        Criar rascunho
      </button>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
