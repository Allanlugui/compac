"use client";

import { useMemo, useState } from "react";
import { Building, Building2, ChevronDown, ChevronRight, DoorOpen, Grid3X3, Layers, Search } from "lucide-react";
import { buildFilhosMap, caminhoLocalidade, visiveisComAncestrais, type NoLocalidade } from "@/lib/arvore-localidades";

export type LocalidadeOpcao = NoLocalidade;

function iconeTipo(t: string) {
  switch (t) {
    case "unidade": return Building;
    case "predio": return Building2;
    case "bloco": return Layers;
    case "andar": return Layers;
    case "area": return Grid3X3;
    case "sala": return DoorOpen;
    default: return Building2;
  }
}

/**
 * Seletor hierárquico de localidade (mesma fonte parent_id da página Estrutura).
 * Painel expansível com árvore, busca preservando ancestrais e caminho completo.
 * Não acessa banco — recebe `localidades` já filtradas por organization_id.
 */
export default function SeletorLocalidade({
  localidades,
  value,
  onChange,
  disabled,
}: {
  localidades: LocalidadeOpcao[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(localidades.map((l) => l.id)));

  const porId = useMemo(() => new Map(localidades.map((l) => [l.id, l])), [localidades]);
  const filhosMap = useMemo(() => buildFilhosMap(localidades), [localidades]);
  const visiveis = useMemo(() => visiveisComAncestrais(localidades, porId, busca), [localidades, porId, busca]);
  const termo = busca.trim();
  const expandidosEfetivos = useMemo(() => {
    if (!termo || !visiveis) return expandidos;
    const s = new Set(expandidos);
    for (const id of visiveis) s.add(id);
    return s;
  }, [expandidos, visiveis, termo]);

  const selecionada = value ? porId.get(value) : undefined;
  // Localidade atual indisponível (removida): não quebra, permite reselecionar.
  const indisponivel = value !== "" && !selecionada;

  function toggle(id: string) {
    setExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function escolher(id: string) {
    onChange(id);
    setAberto(false);
  }

  function No({ loc, nivel, ultimo }: { loc: LocalidadeOpcao; nivel: number; ultimo: boolean }) {
    const filhos = filhosMap.get(loc.id) ?? [];
    const filhosVis = termo ? filhos.filter((f) => visiveis?.has(f.id)) : filhos;
    const temFilhos = filhosVis.length > 0;
    const isAberto = expandidosEfetivos.has(loc.id);
    const sel = value === loc.id;
    const Icone = iconeTipo(loc.tipo);
    if (visiveis && !visiveis.has(loc.id) && filhosVis.length === 0) return null;
    return (
      <div>
        <div
          role="treeitem"
          aria-selected={sel}
          aria-expanded={temFilhos ? isAberto : undefined}
          className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm ${sel ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
          style={{ marginLeft: nivel * 12 }}
        >
          {temFilhos ? (
            <button
              type="button"
              aria-label={isAberto ? `Recolher ${loc.nome}` : `Expandir ${loc.nome}`}
              aria-expanded={isAberto}
              onClick={() => toggle(loc.id)}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-200"
            >
              {isAberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="inline-flex size-6 shrink-0 items-center justify-center text-zinc-300" aria-hidden>
              {ultimo ? "└" : "├"}
            </span>
          )}
          <button
            type="button"
            onClick={() => escolher(loc.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(loc.id); } }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Icone className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight">{loc.nome}</span>
              <span className={`block truncate text-[11px] ${sel ? "text-white/70" : "text-zinc-400"}`}>{caminhoLocalidade(porId, loc.id)}</span>
            </span>
          </button>
        </div>
        {temFilhos && isAberto && (
          <div role="group" className="relative" style={{ marginLeft: nivel * 12 + 12 }}>
            <div className="pointer-events-none absolute inset-y-1 left-[11px] w-px bg-zinc-200" aria-hidden />
            <div className="space-y-0.5 py-0.5">
              {filhosVis.map((f, idx) => (
                <No key={f.id} loc={f} nivel={nivel + 1} ultimo={idx === filhosVis.length - 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const raizes = filhosMap.get(null) ?? [];
  const raizesVis = termo ? raizes.filter((r) => visiveis?.has(r.id)) : raizes;

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="tree"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        disabled={disabled}
        className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-left text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60 sm:text-sm"
      >
        {selecionada ? (
          <span className="block truncate font-bold">{caminhoLocalidade(porId, selecionada.id)}</span>
        ) : indisponivel ? (
          <span className="block truncate font-bold text-amber-700">Localidade atual indisponível — selecione outra</span>
        ) : (
          <span className="text-zinc-400">Sem localização — selecionar…</span>
        )}
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
          {localidades.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm font-bold">Nenhuma localização cadastrada.</p>
              <p className="mt-1 text-xs text-zinc-500">Cadastre a estrutura antes de associar o ativo.</p>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite parte da localização…"
                  aria-label="Buscar localização"
                  className="min-h-[40px] w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-zinc-900 focus:outline-none"
                />
              </div>
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => escolher("")}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Sem localização
                </button>
              </div>
              <div role="tree" aria-label="Hierarquia de localidades">
                {raizesVis.length === 0 ? (
                  <p className="p-2 text-sm text-zinc-500">Nenhum resultado.</p>
                ) : (
                  raizesVis.map((r, idx) => <No key={r.id} loc={r} nivel={0} ultimo={idx === raizesVis.length - 1} />)
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
