"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert, ClipboardList } from "lucide-react";
import { atualizarPlanejamento } from "./actions";

export interface PlanejamentoAtual {
  planejamento: string | null;
  ferramentas: string | null;
  previsao_horas: number | null;
  riscos: string | null;
  responsavel: string | null;
  equipe: string | null;
  supervisor: string | null;
  prazo: string | null;
  prioridade: string | null;
}

/** Seção 5 · Planejamento: técnico, recursos, previsão, riscos. */
export default function PlanejamentoForm({
  chamadoId,
  atual,
}: {
  chamadoId: string;
  atual: PlanejamentoAtual;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    planejamento: atual.planejamento ?? "",
    ferramentas: atual.ferramentas ?? "",
    previsao_horas: atual.previsao_horas !== null ? String(atual.previsao_horas) : "",
    riscos: atual.riscos ?? "",
    responsavel: atual.responsavel ?? "",
    equipe: atual.equipe ?? "",
    supervisor: atual.supervisor ?? "",
    prazo: atual.prazo ?? "",
    prioridade: atual.prioridade ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function set(campo: keyof typeof f, valor: string) {
    setF((a) => ({ ...a, [campo]: valor }));
    setOk(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const r = await atualizarPlanejamento({
        chamadoId,
        ...f,
        previsao_horas: f.previsao_horas.trim() === "" ? null : Number(f.previsao_horas),
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
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";
  const rotulo = "mb-1 block text-xs font-bold text-zinc-700";

  return (
    <form onSubmit={salvar} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className={rotulo}>Técnico responsável</span>
          <input value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} disabled={salvando} maxLength={120} className={campo} />
        </label>
        <label className="block"><span className={rotulo}>Equipe</span>
          <input value={f.equipe} onChange={(e) => set("equipe", e.target.value)} disabled={salvando} maxLength={120} className={campo} />
        </label>
        <label className="block"><span className={rotulo}>Supervisor</span>
          <input value={f.supervisor} onChange={(e) => set("supervisor", e.target.value)} disabled={salvando} maxLength={120} className={campo} />
        </label>
        <label className="block"><span className={rotulo}>Prioridade</span>
          <select value={f.prioridade} onChange={(e) => set("prioridade", e.target.value)} disabled={salvando} className={campo}>
            <option value="">—</option><option value="baixa">Baixa</option><option value="media">Média</option>
            <option value="alta">Alta</option><option value="critica">Crítica</option>
          </select>
        </label>
        <label className="block"><span className={rotulo}>Prazo</span>
          <input type="date" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block"><span className={rotulo}>Previsão (horas)</span>
          <input type="number" min="0" step="0.5" inputMode="decimal" value={f.previsao_horas} onChange={(e) => set("previsao_horas", e.target.value)} disabled={salvando} className={campo} />
        </label>
      </div>
      <label className="block"><span className={rotulo}>Descrição técnica do trabalho</span>
        <textarea rows={3} value={f.planejamento} onChange={(e) => set("planejamento", e.target.value)} disabled={salvando} maxLength={2000} className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={rotulo}>Ferramentas / recursos</span>
          <textarea rows={2} value={f.ferramentas} onChange={(e) => set("ferramentas", e.target.value)} disabled={salvando} maxLength={500} className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
        </label>
        <label className="block"><span className={rotulo}>Riscos</span>
          <textarea rows={2} value={f.riscos} onChange={(e) => set("riscos", e.target.value)} disabled={salvando} maxLength={1000} className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
          {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
          Salvar planejamento
        </button>
        {ok && <span className="text-xs font-bold text-emerald-700">Salvo!</span>}
      </div>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
