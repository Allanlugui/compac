"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ChevronRight, MapPin, Search, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Localidade } from "@/lib/types";

interface AtivoMapa {
  id: string;
  nome: string;
  codigo: string | null;
  status: string;
  criticidade: string | null;
  categoria_id: string | null;
  localidade_id: string | null;
}

interface ChamadoMapa {
  id: string;
  ativo_id: string;
  os_status: string | null;
  status: string;
}

type FiltroStatus = "todos" | "operacional" | "em_manutencao" | "parado" | "inativo";
type FiltroCriticidade = "todos" | "baixa" | "media" | "alta" | "critica";

function buildTree(localidades: Localidade[]) {
  const porId = new Map(localidades.map((l) => [l.id, l]));
  const filhos = new Map<string | null, Localidade[]>();
  for (const l of localidades) {
    const key = l.parent_id ?? null;
    const arr = filhos.get(key) ?? [];
    arr.push(l);
    filhos.set(key, arr);
  }
  return { porId, filhos };
}

function coletarDescendentes(
  id: string,
  filhos: Map<string | null, Localidade[]>,
  acc: Set<string>,
) {
  acc.add(id);
  const ff = filhos.get(id) ?? [];
  for (const f of ff) coletarDescendentes(f.id, filhos, acc);
}

export default function MapaClient({
  localidades,
  ativos,
  chamados,
  categorias,
  temCoordenadas,
}: {
  localidades: Localidade[];
  ativos: AtivoMapa[];
  chamados: ChamadoMapa[];
  categorias: { id: string; nome: string }[];
  temCoordenadas: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroCriticidade, setFiltroCriticidade] = useState<FiltroCriticidade>("todos");
  const [somenteComOS, setSomenteComOS] = useState(false);
  const [somenteCriticos, setSomenteCriticos] = useState(false);
  const [somenteParados, setSomenteParados] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(localidades.filter((l) => !l.parent_id).map((l) => l.id)));

  const { porId, filhos } = useMemo(() => buildTree(localidades), [localidades]);

  const ativosFiltrados = useMemo(() => {
    let r = [...ativos];
    const t = busca.trim().toLowerCase();
    if (t) {
      r = r.filter((a) => `${a.nome} ${a.codigo ?? ""} ${a.criticidade ?? ""} ${a.status}`.toLowerCase().includes(t));
    }
    if (filtroCategoria) r = r.filter((a) => a.categoria_id === filtroCategoria);
    if (filtroStatus !== "todos") r = r.filter((a) => a.status === filtroStatus);
    if (filtroCriticidade !== "todos") r = r.filter((a) => a.criticidade === filtroCriticidade);
    if (somenteCriticos) r = r.filter((a) => a.criticidade === "alta" || a.criticidade === "critica");
    if (somenteParados) r = r.filter((a) => a.status === "parado");
    if (somenteComOS) {
      const ativosComOS = new Set(chamados.filter((c) => c.os_status && !["concluida", "encerrada"].includes(c.os_status)).map((c) => c.ativo_id));
      r = r.filter((a) => ativosComOS.has(a.id));
    }
    if (selecionada) {
      const ids = new Set<string>();
      coletarDescendentes(selecionada, filhos, ids);
      r = r.filter((a) => a.localidade_id && ids.has(a.localidade_id));
    }
    return r;
  }, [ativos, busca, filtroCategoria, filtroStatus, filtroCriticidade, somenteCriticos, somenteParados, somenteComOS, selecionada, filhos, chamados]);

  const ativosSemLocal = useMemo(() => ativosFiltrados.filter((a) => !a.localidade_id), [ativosFiltrados]);

  const contagemPorLocal = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of localidades) {
      const ids = new Set<string>();
      coletarDescendentes(l.id, filhos, ids);
      const qtd = ativos.filter((a) => a.localidade_id && ids.has(a.localidade_id)).length;
      map.set(l.id, qtd);
    }
    return map;
  }, [localidades, filhos, ativos]);

  const resumo = useMemo(() => {
    const total = ativos.length;
    const criticos = ativos.filter((a) => a.criticidade === "alta" || a.criticidade === "critica").length;
    const parados = ativos.filter((a) => a.status === "parado").length;
    const emManut = ativos.filter((a) => a.status === "em_manutencao").length;
    const semLoc = ativos.filter((a) => !a.localidade_id).length;
    const osAbertas = chamados.filter((c) => c.os_status && !["concluida", "encerrada"].includes(c.os_status)).length;
    return { total, criticos, parados, emManut, semLoc, osAbertas };
  }, [ativos, chamados]);

  const toggleExpand = (id: string) => {
    setExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  function renderNo(local: Localidade, nivel: number) {
    const isExp = expandidos.has(local.id);
    const isSel = selecionada === local.id;
    const qtd = contagemPorLocal.get(local.id) ?? 0;
    const filhosList = filhos.get(local.id) ?? [];
    const temFilhos = filhosList.length > 0;
    return (
      <div key={local.id} style={{ marginLeft: nivel * 12 }}>
        <button
          type="button"
          onClick={() => (temFilhos ? toggleExpand(local.id) : setSelecionada(local.id))}
          onDoubleClick={() => setSelecionada(local.id)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-100",
            isSel && "bg-zinc-900 text-white hover:bg-zinc-800",
          )}
          aria-label={`Selecionar ${local.nome}`}
        >
          {temFilhos ? (
            isExp ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />
          ) : (
            <Building2 className="size-4 shrink-0 text-zinc-400" />
          )}
          <span className="flex-1 truncate font-medium">{local.nome}</span>
          <span className={cn("rounded-full px-1.5 text-xs tabular-nums", isSel ? "bg-white/20" : "bg-zinc-100")}>{qtd}</span>
          <span className="text-xs text-zinc-400">{local.tipo}</span>
        </button>
        {isExp && temFilhos && <div className="mt-1 space-y-1">{filhosList.map((f) => renderNo(f, nivel + 1))}</div>}
      </div>
    );
  }

  const raizes = filhos.get(null) ?? [];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-12">
          <div className="relative sm:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Buscar por nome, código, patrimônio..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
              aria-label="Buscar ativo no mapa"
            />
          </div>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 text-sm sm:col-span-2">
            <option value="">Todas categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)} className="min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 text-sm sm:col-span-2">
            <option value="todos">Todos status</option>
            <option value="operacional">Operacional</option>
            <option value="em_manutencao">Em manutenção</option>
            <option value="parado">Parado</option>
            <option value="inativo">Inativo</option>
          </select>
          <select value={filtroCriticidade} onChange={(e) => setFiltroCriticidade(e.target.value as FiltroCriticidade)} className="min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 text-sm sm:col-span-2">
            <option value="todos">Todas criticidades</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-bold">
              <input type="checkbox" checked={somenteComOS} onChange={(e) => setSomenteComOS(e.target.checked)} className="size-4 accent-zinc-900" />
              Com O.S. aberta
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold">
              <input type="checkbox" checked={somenteCriticos} onChange={(e) => setSomenteCriticos(e.target.checked)} className="size-4 accent-zinc-900" />
              Críticos
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold">
              <input type="checkbox" checked={somenteParados} onChange={(e) => setSomenteParados(e.target.checked)} className="size-4 accent-zinc-900" />
              Parados
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelecionada(null)} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${!selecionada ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-600 ring-zinc-300"}`}>Todas localidades</button>
          <button type="button" onClick={() => { setBusca(""); setFiltroCategoria(""); setFiltroStatus("todos"); setFiltroCriticidade("todos"); setSomenteComOS(false); setSomenteCriticos(false); setSomenteParados(false); setSelecionada(null); }} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold hover:bg-zinc-200">Limpar filtros</button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Total ativos</p>
          <p className="mt-1 text-2xl font-black">{resumo.total}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Críticos</p>
          <p className="mt-1 text-2xl font-black text-red-600">{resumo.criticos}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Parados</p>
          <p className="mt-1 text-2xl font-black text-amber-600">{resumo.parados}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Em manutenção</p>
          <p className="mt-1 text-2xl font-black text-sky-600">{resumo.emManut}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">O.S. abertas</p>
          <p className="mt-1 text-2xl font-black">{resumo.osAbertas}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Sem localização</p>
          <p className="mt-1 text-2xl font-black">{resumo.semLoc}</p>
        </div>
      </div>

      {/* Mapa geográfico (se houver coordenadas) ou aviso */}
      {!temCoordenadas ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <MapPin className="size-4" />
            Mapa geográfico indisponível
          </p>
          <p className="mt-1 text-xs text-amber-700">Dados geográficos reais (latitude/longitude) não cadastrados. Exibindo mapa operacional por estrutura.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-500">Mapa cartográfico aqui (quando houver coordenadas)</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Árvore hierárquica */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-4">
          <h3 className="text-sm font-black">Estrutura hierárquica</h3>
          <p className="text-xs text-zinc-500">Clique para filtrar por localidade. Duplo clique expande.</p>
          <div className="mt-3 space-y-1">
            {raizes.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Nenhuma localidade cadastrada. Crie em /admin/estrutura.</p>
            ) : (
              raizes.map((r) => renderNo(r, 0))
            )}
          </div>
          {selecionada && (
            <div className="mt-3 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white">
              Filtrando: {porId.get(selecionada)?.nome ?? selecionada} ({ativosFiltrados.length} ativos)
            </div>
          )}
        </div>

        {/* Lista de ativos */}
        <div className="space-y-4 lg:col-span-8">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black">
              Ativos {selecionada ? `em ${porId.get(selecionada)?.nome}` : "— visão geral"} ({ativosFiltrados.length})
            </h3>
            {ativosFiltrados.length === 0 ? (
              <p className="mt-3 rounded-xl bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">Nenhum ativo encontrado com os filtros atuais.</p>
            ) : (
              <ul className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {ativosFiltrados.slice(0, 100).map((a) => {
                  const osCount = chamados.filter((c) => c.ativo_id === a.id && c.os_status && !["concluida", "encerrada"].includes(c.os_status)).length;
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{a.nome}</p>
                        <p className="truncate font-mono text-xs text-zinc-500">
                          {a.codigo ?? "—"} · {a.status} · {a.criticidade ?? "sem criticidade"}
                          {osCount > 0 && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">{osCount} O.S.</span>}
                        </p>
                      </div>
                      <Link href={`/admin/ativos/${a.id}`} className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800">
                        Ver ativo
                      </Link>
                    </li>
                  );
                })}
                {ativosFiltrados.length > 100 && <li className="text-center text-xs text-zinc-500">Mostrando 100 de {ativosFiltrados.length}. Refine os filtros.</li>}
              </ul>
            )}
          </div>

          {/* Ativos sem localização */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black text-amber-800">
              <TriangleAlert className="size-4" />
              Ativos sem localização ({ativosSemLocal.length})
            </h3>
            <p className="mt-1 text-xs text-amber-700">Qualidade cadastral: ativos sem vínculo com a estrutura física.</p>
            {ativosSemLocal.length > 0 && (
              <ul className="mt-3 space-y-1">
                {ativosSemLocal.slice(0, 20).map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                    <span className="truncate font-medium">{a.nome}</span>
                    <Link href={`/admin/ativos/${a.id}`} className="shrink-0 text-xs font-bold text-amber-800 hover:underline">
                      Ver ativo
                    </Link>
                  </li>
                ))}
                {ativosSemLocal.length > 20 && <li className="text-center text-xs text-amber-700">+{ativosSemLocal.length - 20} outros</li>}
              </ul>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-400">Tenant: localização → ativo → O.S. · Lista = Mapa = Contagem para o mesmo filtro · RLS via requireOrg</p>
    </div>
  );
}
