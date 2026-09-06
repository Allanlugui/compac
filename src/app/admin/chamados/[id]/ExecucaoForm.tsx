"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert, Wrench } from "lucide-react";
import { atualizarExecucao } from "./actions";

export interface ExecucaoAtual {
  responsavel: string | null;
  prioridade: string | null;
  prazo: string | null;
  diagnostico: string | null;
  causa: string | null;
  causa_raiz: string | null;
  solucao: string | null;
  equipe: string | null;
  supervisor: string | null;
  horimetro: number | null;
  horimetro_ini: number | null;
  horimetro_fim: number | null;
  horimetro_unidade: string | null;
}

/** Execução: problema → diagnóstico → causa → causa raiz → solução. */
export default function ExecucaoForm({
  chamadoId,
  atual,
  descricaoProblema,
}: {
  chamadoId: string;
  atual: ExecucaoAtual;
  descricaoProblema: string;
}) {
  const router = useRouter();
  const [responsavel, setResponsavel] = useState(atual.responsavel ?? "");
  const [equipe, setEquipe] = useState(atual.equipe ?? "");
  const [supervisor, setSupervisor] = useState(atual.supervisor ?? "");
  const [prioridade, setPrioridade] = useState(atual.prioridade ?? "");
  const [prazo, setPrazo] = useState(atual.prazo ?? "");
  const [diagnostico, setDiagnostico] = useState(atual.diagnostico ?? "");
  const [causa, setCausa] = useState(atual.causa ?? "");
  const [causaRaiz, setCausaRaiz] = useState(atual.causa_raiz ?? "");
  const [solucao, setSolucao] = useState(atual.solucao ?? "");
  const [horimetro, setHorimetro] = useState(
    atual.horimetro !== null && atual.horimetro !== undefined ? String(atual.horimetro) : "",
  );
  const [horIni, setHorIni] = useState(
    atual.horimetro_ini !== null && atual.horimetro_ini !== undefined ? String(atual.horimetro_ini) : "",
  );
  const [horFim, setHorFim] = useState(
    atual.horimetro_fim !== null && atual.horimetro_fim !== undefined ? String(atual.horimetro_fim) : "",
  );
  const [horUni, setHorUni] = useState(atual.horimetro_unidade ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const r = await atualizarExecucao({
        chamadoId,
        responsavel,
        prioridade,
        prazo,
        diagnostico,
        causa,
        causa_raiz: causaRaiz,
        solucao,
        equipe,
        supervisor,
        horimetro: horimetro.trim() === "" ? null : Number(horimetro),
        horimetro_ini: horIni.trim() === "" ? null : Number(horIni),
        horimetro_fim: horFim.trim() === "" ? null : Number(horFim),
        horimetro_unidade: horUni,
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
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <form onSubmit={salvar} className="space-y-3">
      <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
        <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Problema informado</p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-800">{descricaoProblema}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Responsável (técnico)</span>
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} disabled={salvando} maxLength={120} placeholder="Quem executa" className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Equipe</span>
          <input value={equipe} onChange={(e) => setEquipe(e.target.value)} disabled={salvando} maxLength={120} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Supervisor</span>
          <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} disabled={salvando} maxLength={120} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Prioridade</span>
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} disabled={salvando} className={campo}>
            <option value="">Sem prioridade</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Prazo (SLA)</span>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={salvando} className={campo} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Diagnóstico</span>
          <textarea rows={3} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} disabled={salvando} maxLength={2000} placeholder="Causa identificada…" className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Causa</span>
          <textarea rows={3} value={causa} onChange={(e) => setCausa(e.target.value)} disabled={salvando} maxLength={2000} placeholder="Causa imediata…" className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Causa raiz</span>
          <textarea rows={3} value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} disabled={salvando} maxLength={2000} placeholder="Causa fundamental…" className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Solução aplicada</span>
          <textarea rows={3} value={solucao} onChange={(e) => setSolucao(e.target.value)} disabled={salvando} maxLength={2000} placeholder="O que foi feito…" className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Contador inicial</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={horIni} onChange={(e) => setHorIni(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Contador final</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={horFim} onChange={(e) => setHorFim(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Unidade</span>
          <select value={horUni} onChange={(e) => setHorUni(e.target.value)} disabled={salvando} className={campo}>
            <option value="">—</option>
            <option value="horas">Horas</option>
            <option value="km">Km</option>
            <option value="ciclos">Ciclos</option>
            <option value="unidades">Unidades</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Horímetro (legado)</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={horimetro} onChange={(e) => setHorimetro(e.target.value)} disabled={salvando} placeholder="0" className={campo} />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
            {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <Wrench className="size-4" />}
            Salvar execução
          </button>
          {ok && <span className="text-xs font-bold text-emerald-700">Salvo!</span>}
        </div>
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
