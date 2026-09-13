"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Tags, Trash2, TriangleAlert, Pencil } from "lucide-react";
import type {
  AtributoCategoria,
  Categoria,
  TipoAtributo,
  TipoCategoria,
} from "@/lib/types";
import {
  criarCategoria,
  editarCategoria,
  excluirCategoria,
} from "./actions";

const TIPOS_CAT: { id: TipoCategoria; rotulo: string }[] = [
  { id: "ativo", rotulo: "Categoria de ativo" },
  { id: "produto", rotulo: "Categoria de produto" },
];

const TIPOS_ATR: { id: TipoAtributo; rotulo: string }[] = [
  { id: "texto", rotulo: "Texto" },
  { id: "numero", rotulo: "Número" },
  { id: "selecao", rotulo: "Seleção" },
  { id: "data", rotulo: "Data" },
];

interface LinhaAtr {
  nome: string;
  tipo: TipoAtributo;
  obrigatorio: boolean;
  unidade: string;
  opcoes: string;
}

const LINHA_VAZIA: LinhaAtr = { nome: "", tipo: "texto", obrigatorio: false, unidade: "", opcoes: "" };

function paraLinhas(atrs: AtributoCategoria[]): LinhaAtr[] {
  if (atrs.length === 0) return [{ ...LINHA_VAZIA }];
  return atrs.map((a) => ({
    nome: a.nome,
    tipo: a.tipo,
    obrigatorio: a.obrigatorio,
    unidade: a.unidade ?? "",
    opcoes: (a.opcoes ?? []).join(", "),
  }));
}

function deLinhas(linhas: LinhaAtr[]): unknown[] {
  return linhas
    .filter((l) => l.nome.trim() !== "")
    .map((l) => ({
      nome: l.nome.trim(),
      tipo: l.tipo,
      obrigatorio: l.obrigatorio,
      unidade: l.unidade.trim() || undefined,
      opcoes: l.tipo === "selecao" ? l.opcoes.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
    }));
}

function EditorAtributos({
  linhas,
  setLinhas,
  desabilitado,
}: {
  linhas: LinhaAtr[];
  setLinhas: (l: LinhaAtr[]) => void;
  desabilitado: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
        Dados técnicos da categoria
      </p>
      {linhas.map((l, i) => (
        <div key={i} className="grid gap-2 rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-200/70 sm:grid-cols-5">
          <input
            value={l.nome}
            onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
            disabled={desabilitado}
            placeholder="Ex.: Potência"
            className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
          />
          <select
            value={l.tipo}
            onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoAtributo } : x)))}
            disabled={desabilitado}
            className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
          >
            {TIPOS_ATR.map((t) => (
              <option key={t.id} value={t.id}>{t.rotulo}</option>
            ))}
          </select>
          <input
            value={l.unidade}
            onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, unidade: e.target.value } : x)))}
            disabled={desabilitado}
            placeholder="Unid. (kW…)"
            className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
          />
          <textarea
            value={l.opcoes}
            onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, opcoes: e.target.value } : x)))}
            disabled={desabilitado || l.tipo !== "selecao"}
            placeholder={l.tipo === "selecao" ? "Opções, separadas, por, vírgula" : "—"}
            className="min-h-[80px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60 resize-none"
          />
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-1.5 text-xs font-bold text-zinc-600">
              <input
                type="checkbox"
                checked={l.obrigatorio}
                onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, obrigatorio: e.target.checked } : x)))}
                disabled={desabilitado}
                className="size-4 accent-zinc-900"
              />
              Obrig.
            </label>
            <button
              type="button"
              aria-label="Remover atributo"
              onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
              disabled={desabilitado || linhas.length <= 1}
              className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLinhas([...linhas, { ...LINHA_VAZIA }])}
        disabled={desabilitado || linhas.length >= 30}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60"
      >
        <Plus className="size-4" /> Adicionar atributo
      </button>
    </div>
  );
}

export default function CategoriasManager({
  iniciaisCats,
}: {
  iniciaisCats: Categoria[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // ---- Categorias: form novo ----
  const [catNome, setCatNome] = useState("");
  const [catTipo, setCatTipo] = useState<TipoCategoria>("ativo");
  const [catAtrs, setCatAtrs] = useState<LinhaAtr[]>([{ ...LINHA_VAZIA }]);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editCatNome, setEditCatNome] = useState("");
  const [editCatAtrs, setEditCatAtrs] = useState<LinhaAtr[]>([{ ...LINHA_VAZIA }]);
  const [editCatAtiva, setEditCatAtiva] = useState(true);

  function rotuloTipo(t: string): string {
    return TIPOS_CAT.find((x) => x.id === t)?.rotulo ?? t;
  }

  async function executar(chave: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (ocupado) return;
    setErro(null);
    setOcupado(chave);
    try {
      const r = await fn();
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-black">
        <Tags className="size-5 text-zinc-500" />
        Categorias de ativos e produtos
      </h2>

      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-black">Nova categoria</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            value={catNome}
            onChange={(e) => setCatNome(e.target.value)}
            disabled={!!ocupado}
            maxLength={80}
            placeholder="Nome (Ar-condicionado…)"
            className={campo}
          />
          <select
            value={catTipo}
            onChange={(e) => setCatTipo(e.target.value as TipoCategoria)}
            disabled={!!ocupado}
            className={campo}
          >
            {TIPOS_CAT.map((t) => (
              <option key={t.id} value={t.id}>{t.rotulo}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              executar("nova-cat", () =>
                criarCategoria({ nome: catNome, tipo: catTipo, atributos: deLinhas(catAtrs) }).then((r) => {
                  if (r.ok) {
                    setCatNome("");
                    setCatAtrs([{ ...LINHA_VAZIA }]);
                  }
                  return r;
                })
              )
            }
            disabled={!!ocupado || catNome.trim() === ""}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {ocupado === "nova-cat" ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Criar categoria
          </button>
        </div>
        <div className="mt-3">
          <EditorAtributos linhas={catAtrs} setLinhas={setCatAtrs} desabilitado={!!ocupado} />
        </div>
      </div>

      <ul className="space-y-2">
        {iniciaisCats.map((c) => (
          <li key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            {editCat === c.id ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    value={editCatNome}
                    onChange={(e) => setEditCatNome(e.target.value)}
                    disabled={!!ocupado}
                    maxLength={80}
                    className={campo}
                  />
                  <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                    <input
                      type="checkbox"
                      checked={editCatAtiva}
                      onChange={(e) => setEditCatAtiva(e.target.checked)}
                      disabled={!!ocupado}
                      className="size-4 accent-zinc-900"
                    />
                    Ativa
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        executar(`cedit-${c.id}`, () =>
                          editarCategoria({
                            id: c.id,
                            nome: editCatNome,
                            atributos: deLinhas(editCatAtrs),
                            ativa: editCatAtiva,
                          }).then((r) => {
                            if (r.ok) setEditCat(null);
                            return r;
                          })
                        )
                      }
                      disabled={!!ocupado}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCat(null)}
                      disabled={!!ocupado}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-zinc-200 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
                <EditorAtributos linhas={editCatAtrs} setLinhas={setEditCatAtrs} desabilitado={!!ocupado} />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {c.nome}
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">
                      {c.tipo === "ativo" ? "Ativo" : "Produto"}
                    </span>
                    {!c.ativa && (
                      <span className="ml-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-bold text-zinc-500">
                        inativa
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {c.atributos.length === 0
                      ? "Sem dados técnicos."
                      : c.atributos
                          .map(
                            (a) =>
                              `${a.nome}${a.unidade ? ` (${a.unidade})` : ""}${a.obrigatorio ? "*" : ""}`
                          )
                          .join(" · ")}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-label="Editar"
                    onClick={() => {
                      setEditCat(c.id);
                      setEditCatNome(c.nome);
                      setEditCatAtrs(paraLinhas(c.atributos));
                      setEditCatAtiva(c.ativa);
                    }}
                    disabled={!!ocupado}
                    className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Excluir"
                    onClick={() => {
                      if (confirm(`Excluir a categoria "${c.nome}"? Ativos/produtos perdem o vínculo.`))
                        executar(`cdel-${c.id}`, () => excluirCategoria({ id: c.id }));
                    }}
                    disabled={!!ocupado}
                    className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {iniciaisCats.length === 0 && (
          <li className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400 shadow-sm">
            Nenhuma categoria. Ex.: Ar-condicionado, Impressora, Bomba.
          </li>
        )}
      </ul>
    </div>
  );
}