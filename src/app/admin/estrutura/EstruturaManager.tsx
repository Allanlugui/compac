"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  LoaderCircle,
  Pencil,
  Plus,
  Tags,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type {
  AtributoCategoria,
  Categoria,
  Localidade,
  TipoAtributo,
  TipoCategoria,
  TipoLocalidade,
} from "@/lib/types";
import {
  criarCategoria,
  criarLocalidade,
  editarCategoria,
  editarLocalidade,
  excluirCategoria,
  excluirLocalidade,
} from "./actions";

const TIPOS_LOC: { id: TipoLocalidade; rotulo: string }[] = [
  { id: "unidade", rotulo: "Unidade" },
  { id: "predio", rotulo: "Prédio" },
  { id: "bloco", rotulo: "Bloco" },
  { id: "andar", rotulo: "Andar" },
  { id: "area", rotulo: "Área" },
  { id: "sala", rotulo: "Sala" },
];

const TIPOS_ATR: { id: TipoAtributo; rotulo: string }[] = [
  { id: "texto", rotulo: "Texto" },
  { id: "numero", rotulo: "Número" },
  { id: "selecao", rotulo: "Seleção" },
  { id: "data", rotulo: "Data" },
];

interface Aba {
  id: "locs" | "cats";
}

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
          <input value={l.nome} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} disabled={desabilitado} maxLength={60} placeholder="Ex.: Potência" className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
          <select value={l.tipo} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoAtributo } : x)))} disabled={desabilitado} className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60">
            {TIPOS_ATR.map((t) => (
              <option key={t.id} value={t.id}>{t.rotulo}</option>
            ))}
          </select>
          <input value={l.unidade} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, unidade: e.target.value } : x)))} disabled={desabilitado} maxLength={20} placeholder="Unid. (kW…)" className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
          <input value={l.opcoes} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, opcoes: e.target.value } : x)))} disabled={desabilitado || l.tipo !== "selecao"} maxLength={200} placeholder={l.tipo === "selecao" ? "Opções, separadas, por, vírgula" : "—"} className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-1.5 text-xs font-bold text-zinc-600">
              <input type="checkbox" checked={l.obrigatorio} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, obrigatorio: e.target.checked } : x)))} disabled={desabilitado} className="size-4 accent-zinc-900" />
              Obrig.
            </label>
            <button type="button" aria-label="Remover atributo" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} disabled={desabilitado || linhas.length <= 1} className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-40">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setLinhas([...linhas, { ...LINHA_VAZIA }])} disabled={desabilitado || linhas.length >= 30} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60">
        <Plus className="size-4" /> Adicionar atributo
      </button>
    </div>
  );
}

export default function EstruturaManager({
  iniciaisLocs,
  iniciaisCats,
}: {
  iniciaisLocs: Localidade[];
  iniciaisCats: Categoria[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba["id"]>("locs");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // ---- Localidades: form novo ----
  const [locNome, setLocNome] = useState("");
  const [locTipo, setLocTipo] = useState<TipoLocalidade>("unidade");
  const [locPai, setLocPai] = useState("");
  const [editLoc, setEditLoc] = useState<string | null>(null);
  const [editLocNome, setEditLocNome] = useState("");
  const [editLocPai, setEditLocPai] = useState("");

  // ---- Categorias: form novo ----
  const [catNome, setCatNome] = useState("");
  const [catTipo, setCatTipo] = useState<TipoCategoria>("ativo");
  const [catAtrs, setCatAtrs] = useState<LinhaAtr[]>([{ ...LINHA_VAZIA }]);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editCatNome, setEditCatNome] = useState("");
  const [editCatAtrs, setEditCatAtrs] = useState<LinhaAtr[]>([{ ...LINHA_VAZIA }]);
  const [editCatAtiva, setEditCatAtiva] = useState(true);

  const porId = useMemo(() => new Map(iniciaisLocs.map((l) => [l.id, l])), [iniciaisLocs]);

  function caminho(l: Localidade): string {
    const partes = [l.nome];
    let atual = l.parent_id ? porId.get(l.parent_id) : undefined;
    const vistos = new Set<string>();
    while (atual && !vistos.has(atual.id)) {
      vistos.add(atual.id);
      partes.unshift(atual.nome);
      atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
    }
    return partes.join(" › ");
  }

  function rotuloTipo(t: string): string {
    return TIPOS_LOC.find((x) => x.id === t)?.rotulo ?? t;
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
    <div className="space-y-4">
      <nav aria-label="Seções da estrutura" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5 shadow-inner">
        {(
          [
            { id: "locs", rotulo: "Localidades", Icone: Building2 },
            { id: "cats", rotulo: "Categorias", Icone: Tags },
          ] as const
        ).map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-current={aba === id ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold whitespace-nowrap transition-all ${aba === id ? "scale-[1.02] bg-white text-zinc-900 shadow-md ring-1 ring-zinc-200" : "text-zinc-500 hover:bg-white/50 hover:text-zinc-800"}`}
          >
            <Icone className="size-4" />
            {rotulo}
          </button>
        ))}
      </nav>

      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      {aba === "locs" && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">Nova localidade</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Níveis opcionais: só Unidade basta para org pequena.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <input value={locNome} onChange={(e) => setLocNome(e.target.value)} disabled={!!ocupado} maxLength={120} placeholder="Nome (Bloco A…)" className={campo} />
            <select value={locTipo} onChange={(e) => setLocTipo(e.target.value as TipoLocalidade)} disabled={!!ocupado} className={campo}>
              {TIPOS_LOC.map((t) => (
                <option key={t.id} value={t.id}>{t.rotulo}</option>
              ))}
            </select>
            <select value={locPai} onChange={(e) => setLocPai(e.target.value)} disabled={!!ocupado} className={campo}>
              <option value="">Raiz (sem superior)</option>
              {iniciaisLocs.map((l) => (
                <option key={l.id} value={l.id}>{caminho(l)} · {rotuloTipo(l.tipo)}</option>
              ))}
            </select>
            <button type="button" onClick={() => executar("nova-loc", () => criarLocalidade({ nome: locNome, tipo: locTipo, parentId: locPai || null }).then((r) => { if (r.ok) { setLocNome(""); setLocPai(""); } return r; }))} disabled={!!ocupado || locNome.trim() === ""} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
              {ocupado === "nova-loc" ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Adicionar
            </button>
          </div>

          <ul className="mt-4 space-y-1.5">
            {iniciaisLocs.map((l) => (
              <li key={l.id} className="rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200/70">
                {editLoc === l.id ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input value={editLocNome} onChange={(e) => setEditLocNome(e.target.value)} disabled={!!ocupado} maxLength={120} className={campo} />
                    <select value={editLocPai} onChange={(e) => setEditLocPai(e.target.value)} disabled={!!ocupado} className={campo}>
                      <option value="">Raiz (sem superior)</option>
                      {iniciaisLocs.filter((x) => x.id !== l.id).map((x) => (
                        <option key={x.id} value={x.id}>{caminho(x)} · {rotuloTipo(x.tipo)}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => executar(`edit-${l.id}`, () => editarLocalidade({ id: l.id, nome: editLocNome, parentId: editLocPai || null }).then((r) => { if (r.ok) setEditLoc(null); return r; }))} disabled={!!ocupado} className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-60">Salvar</button>
                      <button type="button" onClick={() => setEditLoc(null)} disabled={!!ocupado} className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-zinc-200 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-300">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{caminho(l)}</p>
                      <p className="text-[11px] font-bold text-zinc-400 uppercase">{rotuloTipo(l.tipo)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" aria-label="Editar" onClick={() => { setEditLoc(l.id); setEditLocNome(l.nome); setEditLocPai(l.parent_id ?? ""); }} disabled={!!ocupado} className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60"><Pencil className="size-4" /></button>
                      <button type="button" aria-label="Excluir" onClick={() => { if (confirm(`Excluir "${l.nome}" e tudo abaixo dele? Ativos perdem o vínculo.`)) executar(`del-${l.id}`, () => excluirLocalidade({ id: l.id })); }} disabled={!!ocupado} className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-60"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {iniciaisLocs.length === 0 && (
              <li className="rounded-xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200/70">
                Nenhuma localidade. Comece pela Unidade da organização.
              </li>
            )}
          </ul>
        </section>
      )}

      {aba === "cats" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black">Nova categoria</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input value={catNome} onChange={(e) => setCatNome(e.target.value)} disabled={!!ocupado} maxLength={80} placeholder="Nome (Ar-condicionado…)" className={campo} />
              <select value={catTipo} onChange={(e) => setCatTipo(e.target.value as TipoCategoria)} disabled={!!ocupado} className={campo}>
                <option value="ativo">Categoria de ativo</option>
                <option value="produto">Categoria de produto</option>
              </select>
              <button type="button" onClick={() => executar("nova-cat", () => criarCategoria({ nome: catNome, tipo: catTipo, atributos: deLinhas(catAtrs) }).then((r) => { if (r.ok) { setCatNome(""); setCatAtrs([{ ...LINHA_VAZIA }]); } return r; }))} disabled={!!ocupado || catNome.trim() === ""} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
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
                      <input value={editCatNome} onChange={(e) => setEditCatNome(e.target.value)} disabled={!!ocupado} maxLength={80} className={campo} />
                      <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                        <input type="checkbox" checked={editCatAtiva} onChange={(e) => setEditCatAtiva(e.target.checked)} disabled={!!ocupado} className="size-4 accent-zinc-900" />
                        Ativa
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => executar(`cedit-${c.id}`, () => editarCategoria({ id: c.id, nome: editCatNome, atributos: deLinhas(editCatAtrs), ativa: editCatAtiva }).then((r) => { if (r.ok) setEditCat(null); return r; }))} disabled={!!ocupado} className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-60">Salvar</button>
                        <button type="button" onClick={() => setEditCat(null)} disabled={!!ocupado} className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-zinc-200 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-300">Cancelar</button>
                      </div>
                    </div>
                    <EditorAtributos linhas={editCatAtrs} setLinhas={setEditCatAtrs} desabilitado={!!ocupado} />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {c.nome}
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">{c.tipo === "ativo" ? "Ativo" : "Produto"}</span>
                        {!c.ativa && <span className="ml-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-bold text-zinc-500">inativa</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {c.atributos.length === 0 ? "Sem dados técnicos." : c.atributos.map((a) => `${a.nome}${a.unidade ? ` (${a.unidade})` : ""}${a.obrigatorio ? "*" : ""}`).join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" aria-label="Editar" onClick={() => { setEditCat(c.id); setEditCatNome(c.nome); setEditCatAtrs(paraLinhas(c.atributos)); setEditCatAtiva(c.ativa); }} disabled={!!ocupado} className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60"><Pencil className="size-4" /></button>
                      <button type="button" aria-label="Excluir" onClick={() => { if (confirm(`Excluir a categoria "${c.nome}"? Ativos/produtos perdem o vínculo.`)) executar(`cdel-${c.id}`, () => excluirCategoria({ id: c.id })); }} disabled={!!ocupado} className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-60"><Trash2 className="size-4" /></button>
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
        </section>
      )}
    </div>
  );
}
