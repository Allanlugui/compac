"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import type { OsTipo } from "@/lib/types";
import { criarPlano } from "./actions";

const TIPOS: { id: OsTipo; rotulo: string }[] = [
  { id: "preventiva", rotulo: "Preventiva" },
  { id: "preditiva", rotulo: "Preditiva" },
  { id: "inspecao", rotulo: "Inspeção" },
  { id: "instalacao", rotulo: "Instalação" },
  { id: "melhoria", rotulo: "Melhoria" },
  { id: "corretiva", rotulo: "Corretiva" },
];

const UNIDADES = [
  { id: "dias", rotulo: "Dias" },
  { id: "semanas", rotulo: "Semanas" },
  { id: "meses", rotulo: "Meses" },
  { id: "horas", rotulo: "Horas" },
  { id: "ciclos", rotulo: "Ciclos" },
];

/** Novo plano de manutenção (frequência + tolerância + checklist). */
export default function PlanoForm({
  ativos,
  checklists,
}: {
  ativos: { id: string; nome: string; codigo: string | null }[];
  checklists: { id: string; titulo: string }[];
}) {
  const router = useRouter();
  const [ativoId, setAtivoId] = useState("");
  const [tipo, setTipo] = useState<OsTipo>("preventiva");
  const [atividade, setAtividade] = useState("");
  const [frequencia, setFrequencia] = useState("30");
  const [unidade, setUnidade] = useState("dias");
  const [responsavel, setResponsavel] = useState("");
  const [checklistId, setChecklistId] = useState("");
  const [tolerancia, setTolerancia] = useState("3");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await criarPlano({
        ativoId,
        tipo,
        atividade,
        frequencia: Number(frequencia),
        unidade,
        responsavel,
        checklistModeloId: checklistId || null,
        toleranciaDias: Number(tolerancia),
      });
      if (!r.ok) throw new Error(r.error);
      setAtivoId("");
      setAtividade("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";
  const rotulo = "mb-1 block text-xs font-bold text-zinc-700";

  return (
    <form onSubmit={salvar} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-black">
        <Plus className="size-5 text-zinc-500" />
        Novo plano
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className={rotulo}>Ativo *</span>
          <select value={ativoId} onChange={(e) => setAtivoId(e.target.value)} disabled={salvando} required className={campo}>
            <option value="">Selecionar…</option>
            {ativos.map((a) => (
              <option key={a.id} value={a.id}>{a.codigo ? `${a.codigo} · ` : ""}{a.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={rotulo}>Tipo *</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as OsTipo)} disabled={salvando} className={campo}>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>{t.rotulo}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={rotulo}>Checklist</span>
          <select value={checklistId} onChange={(e) => setChecklistId(e.target.value)} disabled={salvando} className={campo}>
            <option value="">—</option>
            {checklists.map((c) => (
              <option key={c.id} value={c.id}>{c.titulo}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className={rotulo}>Atividade *</span>
          <input value={atividade} onChange={(e) => setAtividade(e.target.value)} disabled={salvando} required minLength={3} maxLength={500} placeholder="Ex.: Lubrificação e inspeção geral" className={campo} />
        </label>
        <label className="block">
          <span className={rotulo}>A cada *</span>
          <div className="flex gap-2">
            <input type="number" min="1" max="1200" step="1" inputMode="numeric" value={frequencia} onChange={(e) => setFrequencia(e.target.value)} disabled={salvando} required className={campo} />
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={salvando} className={campo} aria-label="Unidade">
              {UNIDADES.map((u) => (
                <option key={u.id} value={u.id}>{u.rotulo}</option>
              ))}
            </select>
          </div>
        </label>
        <label className="block">
          <span className={rotulo}>Tolerância (dias)</span>
          <input type="number" min="0" max="365" step="1" inputMode="numeric" value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} disabled={salvando} className={campo} />
        </label>
        <label className="block">
          <span className={rotulo}>Responsável</span>
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} disabled={salvando} maxLength={120} className={campo} />
        </label>
      </div>
      <button type="submit" disabled={salvando} className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
        {salvando && <LoaderCircle className="size-4 animate-spin" />}
        Criar plano
      </button>
      {erro && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
