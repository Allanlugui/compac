"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { AtivoStatus, AtivoStatusHistorico } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import AtivoStatusBadge, { rotuloAtivoStatus } from "@/app/admin/_components/AtivoStatusBadge";
import { atualizarStatusAtivo } from "../actions";

const STATUS: { id: AtivoStatus; rotulo: string }[] = [
  { id: "operacional", rotulo: "Operacional" },
  { id: "em_manutencao", rotulo: "Em manutenção" },
  { id: "parado", rotulo: "Parado" },
  { id: "em_instalacao", rotulo: "Em instalação" },
  { id: "em_inspecao", rotulo: "Em inspeção" },
  { id: "inativo", rotulo: "Inativo" },
  { id: "desativado", rotulo: "Desativado" },
];

/** Controle de status do ativo + histórico de mudanças. */
export default function StatusAtivoControl({
  ativoId,
  statusAtual,
  historico,
}: {
  ativoId: string;
  statusAtual: AtivoStatus;
  historico: AtivoStatusHistorico[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AtivoStatus>(statusAtual);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || status === statusAtual) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await atualizarStatusAtivo({ id: ativoId, status, motivo });
      if (!r.ok) throw new Error(r.error);
      setMotivo("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">Atual:</span>
        <AtivoStatusBadge status={statusAtual} />
      </div>
      <form onSubmit={salvar} className="grid gap-2 sm:grid-cols-3">
        <select value={status} onChange={(e) => setStatus(e.target.value as AtivoStatus)} disabled={salvando} className={campo} aria-label="Novo status">
          {STATUS.map((s) => (
            <option key={s.id} value={s.id}>{s.rotulo}</option>
          ))}
        </select>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={salvando} maxLength={300} placeholder="Motivo (opcional)" className={campo} />
        <button type="submit" disabled={salvando || status === statusAtual} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
          {salvando && <LoaderCircle className="size-4 animate-spin" />}
          Alterar status
        </button>
      </form>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
      {historico.length > 0 && (
        <ul className="space-y-1.5">
          {historico.map((h) => (
            <li key={h.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200/70">
              <span className="font-bold">{rotuloAtivoStatus(h.de) === "—" ? "Criação" : rotuloAtivoStatus(h.de)} → {rotuloAtivoStatus(h.para)}</span>
              {h.motivo && <span className="text-zinc-600"> · {h.motivo}</span>}
              <span className="block text-xs text-zinc-400">{formatarDataHora(h.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
