"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { criarModelo, type NovoItem } from "./checklists";

export interface ModeloComItens {
  id: string;
  titulo: string;
  checklist_itens: { id: string; texto: string; obrigatorio: boolean; ordem: number; tipo?: string }[];
}

const TIPOS = [
  { id: "ok_nok", rotulo: "OK/NOK" },
  { id: "sim_nao", rotulo: "Sim/Não" },
  { id: "texto", rotulo: "Texto" },
  { id: "numero", rotulo: "Número" },
  { id: "selecao", rotulo: "Seleção" },
  { id: "data", rotulo: "Data" },
  { id: "hora", rotulo: "Hora" },
  { id: "foto", rotulo: "Foto" },
] as const;

interface Linha extends NovoItem {
  opcoesTexto: string;
}

/** Gestão de modelos de checklist do ativo (aba Checklists). */
export default function ModeloManager({
  ativoId,
  modelos,
}: {
  ativoId: string;
  modelos: ModeloComItens[];
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([
    { texto: "", tipo: "ok_nok", obrigatorio: true, foto_obrigatoria: false, obs_obrigatoria: false, opcoes: [], opcoesTexto: "" },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const itens: NovoItem[] = linhas
        .filter((l) => l.texto.trim().length >= 2)
        .map((l) => ({
          texto: l.texto.trim(),
          tipo: l.tipo,
          obrigatorio: l.obrigatorio,
          foto_obrigatoria: l.foto_obrigatoria,
          obs_obrigatoria: l.obs_obrigatoria,
          opcoes: l.opcoesTexto.split(",").map((o) => o.trim()).filter(Boolean),
        }));
      const r = await criarModelo({ ativoId, titulo, itens });
      if (!r.ok) throw new Error(r.error);
      setTitulo("");
      setLinhas([{ texto: "", tipo: "ok_nok", obrigatorio: true, foto_obrigatoria: false, obs_obrigatoria: false, opcoes: [], opcoesTexto: "" }]);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <form onSubmit={salvar} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-black">
          <ClipboardCheck className="size-4" /> Novo modelo para este ativo
        </h3>
        <input aria-label="Título do checklist" required minLength={3} maxLength={120} placeholder="Ex.: Inspeção semanal do compressor" value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={salvando} className={`${campo} mt-3`} />
        <div className="mt-2 space-y-2">
          {linhas.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-200/70 sm:grid-cols-2">
              <input aria-label={`Item ${i + 1}`} value={l.texto} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} disabled={salvando} maxLength={300} placeholder={`Item ${i + 1}`} className={`${campo} sm:col-span-2`} />
              <select aria-label="Tipo" value={l.tipo} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, tipo: e.target.value as Linha["tipo"] } : x)))} disabled={salvando} className={campo}>
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>{t.rotulo}</option>
                ))}
              </select>
              <input aria-label="Opções (seleção)" value={l.opcoesTexto} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, opcoesTexto: e.target.value } : x)))} disabled={salvando || l.tipo !== "selecao"} maxLength={200} placeholder={l.tipo === "selecao" ? "Opções separadas por vírgula" : "—"} className={campo} />
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-zinc-600 sm:col-span-2">
                <label className="flex items-center gap-1"><input type="checkbox" checked={l.obrigatorio} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, obrigatorio: e.target.checked } : x)))} disabled={salvando} className="size-4 accent-zinc-900" /> Obrigatório</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={l.foto_obrigatoria} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, foto_obrigatoria: e.target.checked } : x)))} disabled={salvando} className="size-4 accent-zinc-900" /> Foto obrigatória</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={l.obs_obrigatoria} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, obs_obrigatoria: e.target.checked } : x)))} disabled={salvando} className="size-4 accent-zinc-900" /> Obs. obrigatória</label>
                <span className="flex-1" />
                <button type="button" aria-label="Remover item" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} disabled={salvando || linhas.length <= 1} className="inline-flex size-8 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-40">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setLinhas([...linhas, { texto: "", tipo: "ok_nok", obrigatorio: true, foto_obrigatoria: false, obs_obrigatoria: false, opcoes: [], opcoesTexto: "" }])} disabled={salvando || linhas.length >= 30} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60">
            <Plus className="size-4" /> Item
          </button>
          <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
            {salvando && <LoaderCircle className="size-4 animate-spin" />}
            Criar modelo
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </form>

      {modelos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Nenhum modelo. Crie o primeiro acima.
        </p>
      ) : (
        <ul className="space-y-2">
          {modelos.map((m) => (
            <li key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-black">{m.titulo}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
                {[...m.checklist_itens].sort((a, b) => a.ordem - b.ordem).map((it) => (
                  <li key={it.id}>{it.texto}{!it.obrigatorio && <span className="text-zinc-400"> (opc.)</span>}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
