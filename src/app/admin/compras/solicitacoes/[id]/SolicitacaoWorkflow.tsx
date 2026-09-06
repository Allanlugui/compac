"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { decidirSolicitacao, enviarSolicitacao, transicaoSolicitacao } from "../actions";
import type { StatusSolicitacao } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROXIMOS: Record<string, { id: string; rotulo: string; escuro?: boolean }[]> = {
  rascunho: [{ id: "__enviar", rotulo: "Enviar para análise", escuro: true }],
  enviada: [
    { id: "em_analise", rotulo: "Iniciar análise" },
    { id: "cancelada", rotulo: "Cancelar" },
  ],
  em_analise: [
    { id: "__aprovar", rotulo: "Aprovar", escuro: true },
    { id: "__rejeitar", rotulo: "Rejeitar" },
    { id: "cancelada", rotulo: "Cancelar" },
  ],
  aprovada: [{ id: "em_cotacao", rotulo: "Iniciar cotação", escuro: true }],
  em_cotacao: [{ id: "cancelada", rotulo: "Cancelar" }],
  pedido_gerado: [],
  recebida: [{ id: "encerrada", rotulo: "Encerrar", escuro: true }],
  pendente: [
    { id: "em_analise", rotulo: "Iniciar análise" },
    { id: "__aprovar", rotulo: "Aprovar", escuro: true },
    { id: "__rejeitar", rotulo: "Rejeitar" },
  ],
  aprovado: [{ id: "em_cotacao", rotulo: "Iniciar cotação", escuro: true }],
};

/**
 * Workflow da solicitação: enviar, aprovar (segregado), rejeitar,
 * transições. Quem solicitou não aprova a própria (salvo ADMIN).
 */
export default function SolicitacaoWorkflow({
  solicitacaoId,
  statusAtual,
  podeAprovar,
}: {
  solicitacaoId: string;
  statusAtual: StatusSolicitacao;
  podeAprovar: boolean;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = (PROXIMOS[statusAtual] ?? []).filter(
    (o) => o.id === "__enviar" || podeAprovar,
  );

  async function executar(id: string) {
    if (ocupado) return;
    if ((id === "__rejeitar" || id === "cancelada") && motivo.trim() === "" && id === "__rejeitar") {
      setErro("Rejeição exige motivo.");
      return;
    }
    if (id === "cancelada" && !confirm("Cancelar esta solicitação?")) return;
    setErro(null);
    setOcupado(id);
    try {
      let r;
      if (id === "__enviar") r = await enviarSolicitacao({ id: solicitacaoId });
      else if (id === "__aprovar") r = await decidirSolicitacao({ id: solicitacaoId, decisao: "aprovada", motivo });
      else if (id === "__rejeitar") r = await decidirSolicitacao({ id: solicitacaoId, decisao: "rejeitada", motivo });
      else r = await transicaoSolicitacao({ id: solicitacaoId, para: id as StatusSolicitacao, motivo });
      if (!r.ok) throw new Error(r.error);
      setMotivo("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  if (opcoes.length === 0) {
    return <p className="text-sm text-zinc-500">Estado final — sem transições.</p>;
  }

  return (
    <div className="space-y-3">
      {(opcoes.some((o) => o.id === "__rejeitar" || o.id === "cancelada")) && (
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          disabled={ocupado !== null}
          maxLength={500}
          placeholder="Motivo (obrigatório p/ rejeitar)"
          aria-label="Motivo"
          className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => executar(o.id)}
            disabled={ocupado !== null}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition disabled:opacity-60",
              o.escuro ? "bg-zinc-900 text-white hover:bg-zinc-700" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {ocupado === o.id && <LoaderCircle className="size-4 animate-spin" />}
            {o.rotulo}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-400">Aprovação segregada: quem solicitou não aprova a própria (salvo ADMIN).</p>
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
