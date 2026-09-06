"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { salvarExecucao } from "@/app/admin/ativos/[id]/checklists";
import { uploadFotoAdmin } from "@/lib/storage";
import FotoAnexoInput from "@/app/admin/_components/FotoAnexoInput";
import { cn } from "@/lib/utils";

export interface ItemExec {
  id: string;
  texto: string;
  obrigatorio: boolean;
  tipo: "ok_nok" | "sim_nao" | "texto" | "numero" | "selecao" | "data" | "hora" | "foto";
  foto_obrigatoria: boolean;
  obs_obrigatoria: boolean;
  opcoes: string[];
}

export interface ModeloExec {
  id: string;
  titulo: string;
  itens: ItemExec[];
}

export interface ExecucaoPassada {
  id: string;
  resultado: string | null;
  created_at: string;
  executado_por: string;
}

/** Executa checklist vinculado ao chamado (mobile-first, por tipo). */
export default function ExecucaoChecklist({
  chamadoId,
  modelos,
  passadas,
}: {
  chamadoId: string;
  modelos: ModeloExec[];
  passadas: ExecucaoPassada[];
}) {
  const router = useRouter();
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [bool, setBool] = useState<Record<string, boolean | null>>({});
  const [val, setVal] = useState<Record<string, string>>({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<Record<string, string[]>>({});
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const modelo = modelos.find((m) => m.id === modeloId) ?? null;

  function marcar(itemId: string, valor: boolean) {
    setBool((a) => ({ ...a, [itemId]: a[itemId] === valor ? null : valor }));
  }

  async function anexarFoto(itemId: string, arquivos: File[]) {
    if (enviandoFoto || arquivos.length === 0) return;
    setErro(null);
    setEnviandoFoto(itemId);
    try {
      const paths: string[] = [];
      for (const file of arquivos.slice(0, 3)) {
        const up = await uploadFotoAdmin(file, "checklist", chamadoId);
        if (!up.ok) throw new Error(up.error);
        paths.push(up.path);
      }
      setFotos((a) => ({ ...a, [itemId]: [...(a[itemId] ?? []), ...paths].slice(0, 3) }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no envio da foto.");
    } finally {
      setEnviandoFoto(null);
    }
  }

  async function salvar() {
    if (!modelo || salvando) return;
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const r = await salvarExecucao({
        modeloId: modelo.id,
        chamadoId,
        respostas: modelo.itens.map((i) => ({
          itemId: i.id,
          ok: bool[i.id] ?? null,
          valor: val[i.id] ?? "",
          observacao: obs[i.id] ?? "",
          fotos: fotos[i.id] ?? [],
        })),
      });
      if (!r.ok) throw new Error(r.error);
      setOk(true);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none";

  if (modelos.length === 0) {
    return (
      <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200">
        Nenhum modelo disponível. Crie modelos na página do ativo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {passadas.length > 0 && (
        <ul className="space-y-1.5">
          {passadas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs ring-1 ring-zinc-200/70">
              <span className="font-bold">
                {p.resultado === "aprovado" ? "Aprovado" : p.resultado === "reprovado" ? "Reprovado" : "Com ressalvas"}
              </span>
              <span className="text-zinc-500">{p.executado_por} · {new Date(p.created_at).toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      )}

      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-bold text-zinc-700">Modelo</span>
        <select
          value={modeloId}
          onChange={(e) => { setModeloId(e.target.value); setBool({}); setVal({}); setObs({}); setFotos({}); setOk(false); }}
          className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none"
        >
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>{m.titulo}</option>
          ))}
        </select>
      </label>

      {modelo && (
        <ul className="space-y-2">
          {modelo.itens.map((item) => {
            const v = bool[item.id] ?? null;
            return (
              <li key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <p className="text-sm font-bold">
                  {item.texto}
                  {item.obrigatorio && <span className="text-red-500"> *</span>}
                  {item.foto_obrigatoria && <span className="ml-1 text-[11px] font-bold text-sky-700">[foto]</span>}
                  {item.obs_obrigatoria && <span className="ml-1 text-[11px] font-bold text-amber-700">[obs]</span>}
                </p>

                {(item.tipo === "ok_nok" || item.tipo === "sim_nao") && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => marcar(item.id, true)}
                      aria-pressed={v === true}
                      className={cn(
                        "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ring-2 transition",
                        v === true ? "bg-emerald-600 text-white ring-emerald-600" : "bg-zinc-100 text-zinc-600 ring-transparent hover:bg-zinc-200",
                      )}
                    >
                      <Check className="size-4" /> {item.tipo === "ok_nok" ? "OK" : "Sim"}
                    </button>
                    <button
                      type="button"
                      onClick={() => marcar(item.id, false)}
                      aria-pressed={v === false}
                      className={cn(
                        "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ring-2 transition",
                        v === false ? "bg-red-600 text-white ring-red-600" : "bg-zinc-100 text-zinc-600 ring-transparent hover:bg-zinc-200",
                      )}
                    >
                      <X className="size-4" /> {item.tipo === "ok_nok" ? "NOK" : "Não"}
                    </button>
                  </div>
                )}

                {(item.tipo === "texto" || item.tipo === "numero" || item.tipo === "data" || item.tipo === "hora") && (
                  <input
                    type={item.tipo === "numero" ? "number" : item.tipo === "data" ? "date" : item.tipo === "hora" ? "time" : "text"}
                    step={item.tipo === "numero" ? "any" : undefined}
                    value={val[item.id] ?? ""}
                    onChange={(e) => setVal((a) => ({ ...a, [item.id]: e.target.value }))}
                    className={`${campo} mt-2`}
                  />
                )}

                {item.tipo === "selecao" && (
                  <select
                    value={val[item.id] ?? ""}
                    onChange={(e) => setVal((a) => ({ ...a, [item.id]: e.target.value }))}
                    className={`${campo} mt-2`}
                  >
                    <option value="">Selecionar…</option>
                    {item.opcoes.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                )}

                {item.tipo === "foto" && (
                  <p className="mt-2 text-xs text-zinc-500">Anexe ao menos 1 foto abaixo.</p>
                )}

                <div className="mt-2">
                  <FotoAnexoInput
                    aoSelecionar={(fs) => anexarFoto(item.id, fs)}
                    desabilitado={enviandoFoto !== null}
                    maximo={3}
                  />
                  {(fotos[item.id] ?? []).length > 0 && (
                    <p className="mt-1 text-xs font-bold text-emerald-700">
                      {(fotos[item.id] ?? []).length} foto(s) anexada(s)
                    </p>
                  )}
                </div>

                {(v === false || item.obs_obrigatoria) && (
                  <input
                    aria-label={`Observação de ${item.texto}`}
                    placeholder={item.obs_obrigatoria ? "Observação (obrigatória)" : "Observação da falha"}
                    value={obs[item.id] ?? ""}
                    onChange={(e) => setObs((a) => ({ ...a, [item.id]: e.target.value }))}
                    maxLength={500}
                    className={`${campo} mt-2`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !modelo || enviandoFoto !== null}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          Salvar execução
        </button>
        {ok && <span className="text-xs font-bold text-emerald-700">Execução registrada!</span>}
      </div>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
