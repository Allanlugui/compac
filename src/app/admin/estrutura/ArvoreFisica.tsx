"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Building,
  Layers,
  Grid3X3,
  DoorOpen,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  TriangleAlert,
  Package,
  Users,
} from "lucide-react";
import type { Localidade, TipoLocalidade } from "@/lib/types";
import {
  criarLocalidade,
  editarLocalidade,
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

function iconeTipo(t: string) {
  switch (t) {
    case "unidade":
      return Building;
    case "predio":
      return Building2;
    case "bloco":
      return Layers;
    case "andar":
      return Layers;
    case "area":
      return Grid3X3;
    case "sala":
      return DoorOpen;
    default:
      return Building2;
  }
}

function rotuloTipo(t: string): string {
  return TIPOS_LOC.find((x) => x.id === t)?.rotulo ?? t;
}

export type AtivoMini = { id: string; nome: string; codigo: string | null; status: string; localidade_id: string | null };

interface Props {
  localidades: Localidade[];
  ativos: AtivoMini[];
}

export default function ArvoreFisica({ localidades, ativos }: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(localidades.map((l) => l.id)));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoLocalidade>("unidade");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editPai, setEditPai] = useState("");

  const termo = busca.trim().toLowerCase();

  const porId = useMemo(() => new Map(localidades.map((l) => [l.id, l])), [localidades]);

  const filhosMap = useMemo(() => {
    const m = new Map<string | null, Localidade[]>();
    for (const l of localidades) {
      const k = l.parent_id ?? null;
      const arr = m.get(k) ?? [];
      arr.push(l);
      m.set(k, arr);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return m;
  }, [localidades]);

  // Ativos por localidade (diretos)
  const diretosMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of ativos) if (a.localidade_id) m.set(a.localidade_id, (m.get(a.localidade_id) ?? 0) + 1);
    return m;
  }, [ativos]);

  // Subtree counts (bottom-up)
  const subtreeMap = useMemo(() => {
    const m = new Map<string, number>();
    function dfs(id: string): number {
      if (m.has(id)) return m.get(id)!;
      let total = diretosMap.get(id) ?? 0;
      for (const f of filhosMap.get(id) ?? []) total += dfs(f.id);
      m.set(id, total);
      return total;
    }
    for (const l of localidades) dfs(l.id);
    return m;
  }, [localidades, filhosMap, diretosMap]);

  const ativosPorLocal = useMemo(() => {
    const m = new Map<string, AtivoMini[]>();
    for (const a of ativos) if (a.localidade_id) {
      const arr = m.get(a.localidade_id) ?? [];
      arr.push(a);
      m.set(a.localidade_id, arr);
    }
    return m;
  }, [ativos]);

  function caminho(id: string): string {
    const partes: string[] = [];
    let cur: Localidade | undefined = porId.get(id);
    const vistos = new Set<string>();
    while (cur && !vistos.has(cur.id)) {
      vistos.add(cur.id);
      partes.unshift(cur.nome);
      cur = cur.parent_id ? porId.get(cur.parent_id) : undefined;
    }
    return partes.join(" › ");
  }

  // Search: ids matching + ancestors
  const visiveis = useMemo(() => {
    if (!termo) return null;
    const match = new Set<string>();
    for (const l of localidades) {
      if (l.nome.toLowerCase().includes(termo) || l.tipo.toLowerCase().includes(termo)) match.add(l.id);
    }
    const incluir = new Set<string>(match);
    for (const id of match) {
      let cur = porId.get(id);
      while (cur?.parent_id) {
        incluir.add(cur.parent_id);
        cur = porId.get(cur.parent_id);
      }
    }
    return incluir;
  }, [termo, localidades, porId]);

  function deveMostrar(id: string): boolean {
    if (!visiveis) return true;
    return visiveis.has(id);
  }

  // Auto-expand ancestors when searching
  const expandidosEfetivos = useMemo(() => {
    if (!termo || !visiveis) return expandidos;
    const s = new Set(expandidos);
    for (const id of visiveis) s.add(id);
    return s;
  }, [expandidos, visiveis, termo]);

  function toggle(id: string) {
    setExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function executar(chave: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (ocupado) return;
    setErro(null);
    setOcupado(chave);
    try {
      const r = await fn();
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  const selecionadoObj = selecionado ? porId.get(selecionado) : null;
  const filhosDoSelecionado = selecionado ? (filhosMap.get(selecionado) ?? []) : [];
  const ativosDoSelecionado = selecionado ? (ativosPorLocal.get(selecionado) ?? []) : [];

  // Create forms: when adding child, parent = selecionado
  const parentParaNovo = selecionadoObj ? selecionadoObj.id : null;

  function No({
    loc,
    nivel,
    ultimo,
  }: {
    loc: Localidade;
    nivel: number;
    ultimo: boolean;
  }) {
    const filhos = filhosMap.get(loc.id) ?? [];
    const visiveisFilhos = termo ? filhos.filter((f) => visiveis?.has(f.id)) : filhos;
    const temFilhos = visiveisFilhos.length > 0;
    const aberto = expandidosEfetivos.has(loc.id);
    const sel = selecionado === loc.id;
    const Icone = iconeTipo(loc.tipo);
    if (!deveMostrar(loc.id) && visiveisFilhos.length === 0) return null;
    return (
      <div>
        <div
          className={`group flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm transition ${sel ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
          style={{ marginLeft: nivel * 14 }}
        >
          {temFilhos ? (
            <button
              type="button"
              aria-label={aberto ? "Recolher" : "Expandir"}
              onClick={() => toggle(loc.id)}
              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${sel ? "bg-white/15 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}
            >
              {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="inline-flex size-7 shrink-0 items-center justify-center text-zinc-300" aria-hidden>
              {ultimo ? "└" : "├"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSelecionado(loc.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${sel ? "bg-white/15" : "bg-zinc-100"}`}>
              <Icone className={`size-4 ${sel ? "text-white" : "text-zinc-600"}`} />
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-sm font-bold leading-none ${sel ? "text-white" : "text-zinc-900"}`}>{loc.nome}</span>
              <span className={`block truncate text-[11px] font-bold uppercase tracking-wide ${sel ? "text-white/70" : "text-zinc-400"}`}>
                {rotuloTipo(loc.tipo)} · {filhos.length} filhos · {diretosMap.get(loc.id) ?? 0} diretos · {subtreeMap.get(loc.id) ?? 0} estrutura
              </span>
            </span>
          </button>
          <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black sm:inline-flex ${sel ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"}`}>
            {subtreeMap.get(loc.id) ?? 0}
          </span>
        </div>
        {temFilhos && aberto && (
          <div className="relative" style={{ marginLeft: nivel * 14 + 14 }}>
            <div className="pointer-events-none absolute inset-y-1 left-[13px] w-px bg-zinc-200" aria-hidden />
            <div className="space-y-0.5 py-0.5">
              {visiveisFilhos.map((f, idx) => (
                <No key={f.id} loc={f} nivel={nivel + 1} ultimo={idx === visiveisFilhos.length - 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const raizes = filhosMap.get(null) ?? [];
  const raizesVisiveis = termo ? raizes.filter((r) => visiveis?.has(r.id)) : raizes;

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        {/* Árvore */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome ou tipo…"
                className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setExpandidos(new Set(localidades.map((l) => l.id)))}
              className="hidden min-h-[44px] shrink-0 rounded-xl border border-zinc-300 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50 sm:inline-flex sm:items-center"
            >
              Expandir tudo
            </button>
            <button
              type="button"
              onClick={() => setExpandidos(new Set())}
              className="hidden min-h-[44px] shrink-0 rounded-xl border border-zinc-300 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50 sm:inline-flex sm:items-center"
            >
              Recolher
            </button>
          </div>

          <div className="mt-4 space-y-0.5 overflow-x-auto">
            {raizesVisiveis.length === 0 ? (
              <div className="rounded-2xl bg-zinc-50 px-6 py-10 text-center ring-1 ring-zinc-200/70">
                <p className="text-sm font-black">Nenhuma estrutura cadastrada</p>
                <p className="mx-auto mt-1 max-w-[28ch] text-xs text-zinc-500">Comece criando sua primeira unidade. Depois selecione a unidade para adicionar prédio, bloco, andar e sala.</p>
              </div>
            ) : (
              raizesVisiveis.map((r, idx) => <No key={r.id} loc={r} nivel={0} ultimo={idx === raizesVisiveis.length - 1} />)
            )}
          </div>

          {/* Criar raiz ou filho */}
          <div className="mt-4 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-600">
              {parentParaNovo ? `Adicionar filho em "${selecionadoObj?.nome}"` : "Adicionar unidade (raiz)"}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_0.9fr_auto]">
              <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} disabled={!!ocupado} maxLength={120} placeholder={parentParaNovo ? "Nome do filho…" : "Nome da unidade…"} className={campo} />
              <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoLocalidade)} disabled={!!ocupado} className={campo}>
                {TIPOS_LOC.map((t) => (
                  <option key={t.id} value={t.id}>{t.rotulo}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  executar("nova-loc", () =>
                    criarLocalidade({ nome: novoNome, tipo: novoTipo, parentId: parentParaNovo }).then((r) => {
                      if (r.ok) {
                        setNovoNome("");
                        if (parentParaNovo) setExpandidos((s) => new Set([...s, parentParaNovo]));
                      }
                      return r;
                    }),
                  )
                }
                disabled={!!ocupado || novoNome.trim() === ""}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
              >
                {ocupado === "nova-loc" ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Adicionar
              </button>
            </div>
            {selecionadoObj && (
              <p className="mt-2 text-xs text-zinc-500">Pai pré-preenchido: <strong>{caminho(selecionadoObj.id)}</strong> · para criar raiz, clique fora da árvore para desselecionar.</p>
            )}
            <button
              type="button"
              onClick={() => setSelecionado(null)}
              className="mt-2 text-xs font-bold text-zinc-600 underline-offset-2 hover:underline"
            >
              Limpar seleção (criar raiz)
            </button>
          </div>
        </section>

        {/* Painel contexto */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          {!selecionadoObj ? (
            <div className="py-6 text-center">
              <Users className="mx-auto size-8 text-zinc-300" />
              <p className="mt-2 text-sm font-black">Selecione um nó</p>
              <p className="mx-auto mt-1 max-w-[30ch] text-xs text-zinc-500">Clique em um item da árvore para ver caminho, filhos, ativos e ações.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{rotuloTipo(selecionadoObj.tipo)}</p>
                <h3 className="text-base font-black leading-tight">{selecionadoObj.nome}</h3>
                <p className="mt-1 break-words text-xs text-zinc-500">{caminho(selecionadoObj.id)}</p>
                <p className="mt-1 text-xs text-zinc-500">Pai: {selecionadoObj.parent_id ? (porId.get(selecionadoObj.parent_id)?.nome ?? "—") : "Raiz (sem superior)"}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-center ring-1 ring-zinc-200/70">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Filhos</p>
                  <p className="text-lg font-black">{filhosDoSelecionado.length}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-center ring-1 ring-zinc-200/70">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Neste local</p>
                  <p className="text-lg font-black">{diretosMap.get(selecionadoObj.id) ?? 0}</p>
                </div>
                <div className="rounded-xl bg-zinc-900 px-3 py-2.5 text-center text-white">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Na estrutura</p>
                  <p className="text-lg font-black">{subtreeMap.get(selecionadoObj.id) ?? 0}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditId(selecionadoObj.id);
                    setEditNome(selecionadoObj.nome);
                    setEditPai(selecionadoObj.parent_id ?? "");
                  }}
                  disabled={!!ocupado}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <Pencil className="size-4" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Excluir "${selecionadoObj.nome}"? Só é possível sem filhos e sem ativos vinculados.`))
                      executar(`del-${selecionadoObj.id}`, () => excluirLocalidade({ id: selecionadoObj.id }));
                  }}
                  disabled={!!ocupado}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="size-4" /> Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setSelecionado(selecionadoObj.id)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-xs font-bold text-white"
                >
                  <Plus className="size-4" /> Filho já pré-preenchido à esquerda
                </button>
              </div>

              {editId === selecionadoObj.id && (
                <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
                  <p className="text-xs font-black">Editar localidade</p>
                  <div className="mt-2 grid gap-2">
                    <input value={editNome} onChange={(e) => setEditNome(e.target.value)} disabled={!!ocupado} maxLength={120} className={campo} />
                    <select value={editPai} onChange={(e) => setEditPai(e.target.value)} disabled={!!ocupado} className={campo}>
                      <option value="">Raiz (sem superior)</option>
                      {localidades
                        .filter((x) => x.id !== selecionadoObj.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>{caminho(x.id)} · {rotuloTipo(x.tipo)}</option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          executar(`edit-${selecionadoObj.id}`, () =>
                            editarLocalidade({ id: selecionadoObj.id, nome: editNome, parentId: editPai || null }).then((r) => {
                              if (r.ok) setEditId(null);
                              return r;
                            }),
                          )
                        }
                        disabled={!!ocupado}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
                      >
                        Salvar
                      </button>
                      <button type="button" onClick={() => setEditId(null)} disabled={!!ocupado} className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-xs font-bold text-zinc-700 hover:bg-zinc-50">
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {filhosDoSelecionado.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-zinc-500">Filhos diretos</h4>
                  <ul className="mt-2 space-y-1">
                    {filhosDoSelecionado.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setSelecionado(f.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-left text-sm ring-1 ring-zinc-200/70 hover:bg-zinc-100"
                        >
                          <span className="truncate font-semibold">{f.nome}</span>
                          <span className="shrink-0 text-xs text-zinc-400">{rotuloTipo(f.tipo)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-zinc-500">
                  <Package className="size-4" /> Ativos desta localidade{" "}
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-black text-white">{ativosDoSelecionado.length}</span>
                  <span className="font-normal normal-case">· estrutura {subtreeMap.get(selecionadoObj.id) ?? 0}</span>
                </h4>
                {ativosDoSelecionado.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200/70">Nenhum ativo diretamente nesta localidade.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {ativosDoSelecionado.map((a) => (
                      <li key={a.id}>
                        <Link href={`/admin/ativos/${a.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200/70 hover:bg-zinc-100">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold">{a.codigo ? `${a.codigo} · ${a.nome}` : a.nome}</span>
                            <span className="block text-xs text-zinc-500">{a.status.replace(/_/g, " ")}</span>
                          </span>
                          <span className="shrink-0 text-xs font-bold text-zinc-600">Abrir →</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-zinc-400">
                  {subtreeMap.get(selecionadoObj.id) !== diretosMap.get(selecionadoObj.id) ? `Total na estrutura (inclui filhos): ${subtreeMap.get(selecionadoObj.id) ?? 0}` : ""}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
