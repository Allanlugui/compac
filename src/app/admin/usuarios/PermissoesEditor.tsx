"use client";

import { useState } from "react";
import { ChevronDown, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
import type { EfeitoPermissao, EscopoPermissao } from "@/lib/types";
import { catalogoCustomizavel, escopoDaPermissao } from "@/lib/permissoes-custom";
import type { Permissao } from "@/lib/permissoes";
import { definirPermissaoCustom, listarPermissoesCustom } from "./actions";
import type { PermissaoCustomRow } from "./actions";

export interface OptEscopo {
  id: string;
  nome: string;
}

const ROTULOS_ESCOPO: Record<string, string> = {
  global: "Global",
  localidade: "Localidade",
  almoxarifado: "Almoxarifado",
};

export default function PermissoesEditor({
  userId,
  nome,
  locs,
  almoxs,
}: {
  userId: string;
  nome: string;
  locs: OptEscopo[];
  almoxs: OptEscopo[];
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [linhas, setLinhas] = useState<PermissaoCustomRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Form por permissão: `${efeito}|${escopoTipo}|${escopoId}`
  const [forms, setForms] = useState<Record<string, { efeito: EfeitoPermissao; escopo: string }>>({});

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarPermissoesCustom({ userId });
      if (!r.ok) throw new Error(r.error);
      setLinhas(r.dados);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao carregar.");
    } finally {
      setCarregando(false);
    }
  }

  function alternar() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir && linhas === null) void carregar();
  }

  function opcoesEscopo(permissao: Permissao): { id: string; rotulo: string; tipo: EscopoPermissao }[] {
    const esp = escopoDaPermissao(permissao);
    if (esp === "global") return [{ id: "global", rotulo: "Global", tipo: "global" }];
    const base = esp === "localidade" ? locs : almoxs;
    return [
      { id: "global", rotulo: "Global (todos)", tipo: "global" },
      ...base.map((b) => ({ id: b.id, rotulo: b.nome, tipo: esp })),
    ];
  }

  async function adicionar(permissao: Permissao) {
    const f = forms[permissao] ?? { efeito: "conceder" as EfeitoPermissao, escopo: "global" };
    const opcs = opcoesEscopo(permissao);
    const op = opcs.find((o) => o.id === f.escopo) ?? opcs[0];
    setOcupado(true);
    setErro(null);
    try {
      const r = await definirPermissaoCustom({
        userId,
        permissao,
        efeito: f.efeito,
        escopoTipo: op.tipo,
        escopoId: op.tipo === "global" ? null : op.id,
      });
      if (!r.ok) throw new Error(r.error);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function remover(permissao: string, tipo: EscopoPermissao, escopoId: string | null) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await definirPermissaoCustom({ userId, permissao, efeito: null, escopoTipo: tipo, escopoId });
      if (!r.ok) throw new Error(r.error);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao remover.");
    } finally {
      setOcupado(false);
    }
  }

  function rotuloEscopo(l: PermissaoCustomRow): string {
    if (l.escopo_tipo === "global") return "global";
    const base = l.escopo_tipo === "localidade" ? locs : almoxs;
    return base.find((b) => b.id === l.escopo_id)?.nome ?? "vínculo removido";
  }

  return (
    <div className="mt-2 rounded-xl bg-white ring-1 ring-zinc-200">
      <button
        type="button"
        onClick={alternar}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-xs font-black text-zinc-700"
      >
        <ShieldCheck className="size-4 text-zinc-500" />
        Permissões customizadas de {nome}
        <ChevronDown className={`ml-auto size-4 transition ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="space-y-3 border-t border-zinc-100 p-3">
          {carregando && (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <LoaderCircle className="size-4 animate-spin" /> Carregando…
            </p>
          )}
          {erro && <p className="text-xs font-bold text-red-600">{erro}</p>}
          {linhas !== null &&
            catalogoCustomizavel().map((g) => (
              <details key={g.modulo} className="rounded-lg bg-zinc-50 ring-1 ring-zinc-200/60">
                <summary className="cursor-pointer px-3 py-2 text-xs font-black tracking-wide text-zinc-600 uppercase">
                  {g.modulo} ({g.permissoes.length})
                </summary>
                <div className="space-y-2 p-2">
                  {g.permissoes.map((p) => {
                    const ativas = linhas.filter((l) => l.permissao === p);
                    const f = forms[p] ?? { efeito: "conceder" as EfeitoPermissao, escopo: "global" };
                    return (
                      <div key={p} className="rounded-lg bg-white p-2 ring-1 ring-zinc-200/60">
                        <p className="font-mono text-[11px] font-bold text-zinc-800">{p}</p>
                        {ativas.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ativas.map((l) => (
                              <span
                                key={l.id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${
                                  l.efeito === "negar"
                                    ? "bg-red-100 text-red-700 ring-red-200"
                                    : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                                }`}
                              >
                                {l.efeito === "negar" ? "Negar" : "Conceder"} · {rotuloEscopo(l)}
                                <button
                                  type="button"
                                  aria-label="Remover customização"
                                  onClick={() => remover(l.permissao, l.escopo_tipo, l.escopo_id)}
                                  disabled={ocupado}
                                  className="rounded-full p-0.5 hover:bg-black/10 disabled:opacity-40"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-1.5 flex gap-1.5">
                          <select
                            aria-label="Efeito"
                            value={f.efeito}
                            onChange={(e) => setForms({ ...forms, [p]: { ...f, efeito: e.target.value as EfeitoPermissao } })}
                            disabled={ocupado}
                            className="min-h-[36px] rounded-lg border border-zinc-300 bg-white px-2 text-xs font-bold text-zinc-700 disabled:opacity-60"
                          >
                            <option value="conceder">Conceder</option>
                            <option value="negar">Negar</option>
                          </select>
                          <select
                            aria-label="Alcance"
                            value={f.escopo}
                            onChange={(e) => setForms({ ...forms, [p]: { ...f, escopo: e.target.value } })}
                            disabled={ocupado}
                            className="min-h-[36px] min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-700 disabled:opacity-60"
                          >
                            {opcoesEscopo(p).map((o) => (
                              <option key={o.id} value={o.id}>
                                {ROTULOS_ESCOPO[o.tipo]} · {o.rotulo}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            aria-label={`Adicionar em ${p}`}
                            onClick={() => adicionar(p)}
                            disabled={ocupado}
                            className="inline-flex min-h-[36px] items-center rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          <p className="text-[11px] text-zinc-400">
            Sem linhas, vale o perfil. Negar global bloqueia tudo; escopo restringe a localidade/almoxarifado. `usuarios.administrar` é só perfil.
          </p>
        </div>
      )}
    </div>
  );
}
