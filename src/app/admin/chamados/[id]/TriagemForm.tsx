"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ChamadoStatus, OsTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { atualizarStatus, triarChamado } from "./actions";

const PROXIMOS: Record<string, { id: string; rotulo: string }[]> = {
  aberto: [
    { id: "em_triagem", rotulo: "Iniciar triagem" },
    { id: "cancelado", rotulo: "Cancelar" },
  ],
  em_triagem: [
    { id: "aguardando_informacao", rotulo: "Pedir informações" },
    { id: "cancelado", rotulo: "Cancelar" },
  ],
  aguardando_informacao: [
    { id: "em_triagem", rotulo: "Retomar triagem" },
    { id: "cancelado", rotulo: "Cancelar" },
  ],
  em_andamento: [
    { id: "em_triagem", rotulo: "Enviar à triagem" },
    { id: "convertido_os", rotulo: "Converter em O.S." },
    { id: "resolvido", rotulo: "Resolver direto" },
    { id: "cancelado", rotulo: "Cancelar" },
  ],
};

const TIPOS_OS: { id: OsTipo; rotulo: string }[] = [
  { id: "corretiva", rotulo: "Corretiva" },
  { id: "preventiva", rotulo: "Preventiva" },
  { id: "preditiva", rotulo: "Preditiva" },
  { id: "inspecao", rotulo: "Inspeção" },
  { id: "instalacao", rotulo: "Instalação" },
  { id: "melhoria", rotulo: "Melhoria" },
];

/**
 * TRIAGEM: classifica (prioridade/impacto/criticidade/responsável/SLA)
 * e decide (criar O.S. / resolver / +info / cancelar). Tudo auditado.
 */
export default function TriagemForm({
  chamadoId,
  statusAtual,
  atual,
}: {
  chamadoId: string;
  statusAtual: string;
  atual: {
    prioridade: string | null;
    impacto: string | null;
    criticidade: string | null;
    categoria: string | null;
    subcategoria: string | null;
    departamento: string | null;
    responsavel: string | null;
    equipe: string | null;
    prazo: string | null;
  };
}) {
  const router = useRouter();
  const [f, setF] = useState({
    prioridade: atual.prioridade ?? "media",
    impacto: atual.impacto ?? "",
    criticidade: atual.criticidade ?? "",
    categoria: atual.categoria ?? "",
    subcategoria: atual.subcategoria ?? "",
    departamento: atual.departamento ?? "",
    responsavel: atual.responsavel ?? "",
    equipe: atual.equipe ?? "",
    prazo: atual.prazo ?? "",
    os_tipo: "corretiva" as OsTipo,
    motivo: "",
  });
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = PROXIMOS[statusAtual] ?? [];

  async function avancar(para: string) {
    if (salvando) return;
    // Conversão direta sem classificação vai pela decisão "os" com defaults.
    if (para === "convertido_os" && statusAtual === "em_andamento") {
      if (!confirm("Converter em O.S. corretiva com os dados atuais?")) return;
    }
    setErro(null);
    setSalvando(para);
    try {
      const r = await atualizarStatus({ chamadoId, status: para as ChamadoStatus });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(null);
    }
  }

  async function decidir(decisao: "os" | "resolver" | "info" | "cancelar") {
    if (salvando) return;
    if (decisao === "cancelar" && !confirm("Cancelar este chamado?")) return;
    setErro(null);
    setSalvando(`triagem-${decisao}`);
    try {
      const r = await triarChamado({ chamadoId, ...f, decisao });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(null);
    }
  }

  function set(campo: keyof typeof f, valor: string) {
    setF((a) => ({ ...a, [campo]: valor }));
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";
  const rotulo = "mb-1 block text-xs font-bold text-zinc-700";

  const podeTriar = statusAtual === "aberto" || statusAtual === "em_triagem" || statusAtual === "aguardando_informacao";

  return (
    <div className="space-y-4">
      {opcoes.length > 0 && !podeTriar && (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => avancar(o.id)}
              disabled={salvando !== null}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
            >
              {salvando === o.id && <LoaderCircle className="size-4 animate-spin" />}
              {o.rotulo}
            </button>
          ))}
        </div>
      )}

      {podeTriar && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <ClipboardCheck className="size-4" />
            Classificação + decisão
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="block"><span className={rotulo}>Prioridade</span>
              <select value={f.prioridade} onChange={(e) => set("prioridade", e.target.value)} disabled={!!salvando} className={campo}>
                <option value="baixa">Baixa</option><option value="media">Média</option>
                <option value="alta">Alta</option><option value="critica">Crítica</option>
              </select>
            </label>
            <label className="block"><span className={rotulo}>Impacto</span>
              <select value={f.impacto} onChange={(e) => set("impacto", e.target.value)} disabled={!!salvando} className={campo}>
                <option value="">—</option><option value="baixo">Baixo</option><option value="medio">Médio</option>
                <option value="alto">Alto</option><option value="critico">Crítico</option><option value="parada_total">Parada total</option>
              </select>
            </label>
            <label className="block"><span className={rotulo}>Criticidade</span>
              <select value={f.criticidade} onChange={(e) => set("criticidade", e.target.value)} disabled={!!salvando} className={campo}>
                <option value="">—</option><option value="baixa">Baixa</option><option value="media">Média</option>
                <option value="alta">Alta</option><option value="critica">Crítica</option>
              </select>
            </label>
            <label className="block"><span className={rotulo}>Categoria</span>
              <input value={f.categoria} onChange={(e) => set("categoria", e.target.value)} disabled={!!salvando} maxLength={80} placeholder="Ex.: Elétrica" className={campo} />
            </label>
            <label className="block"><span className={rotulo}>Subcategoria</span>
              <input value={f.subcategoria} onChange={(e) => set("subcategoria", e.target.value)} disabled={!!salvando} maxLength={80} placeholder="Ex.: Iluminação" className={campo} />
            </label>
            <label className="block"><span className={rotulo}>Departamento</span>
              <input value={f.departamento} onChange={(e) => set("departamento", e.target.value)} disabled={!!salvando} maxLength={80} className={campo} />
            </label>
            <label className="block"><span className={rotulo}>Responsável</span>
              <input value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} disabled={!!salvando} maxLength={120} className={campo} />
            </label>
            <label className="block"><span className={rotulo}>Equipe</span>
              <input value={f.equipe} onChange={(e) => set("equipe", e.target.value)} disabled={!!salvando} maxLength={120} className={campo} />
            </label>
            <label className="block"><span className={rotulo}>Prazo (SLA)</span>
              <input type="date" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} disabled={!!salvando} className={campo} />
            </label>
            <label className="block"><span className={rotulo}>Tipo de O.S. (se criar)</span>
              <select value={f.os_tipo} onChange={(e) => set("os_tipo", e.target.value)} disabled={!!salvando} className={campo}>
                {TIPOS_OS.map((t) => (
                  <option key={t.id} value={t.id}>{t.rotulo}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2"><span className={rotulo}>Motivo / observação</span>
              <input value={f.motivo} onChange={(e) => set("motivo", e.target.value)} disabled={!!salvando} maxLength={300} className={campo} />
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {(
              [
                { id: "os", rotulo: "Criar O.S.", escuro: true },
                { id: "resolver", rotulo: "Resolver direto", escuro: false },
                { id: "info", rotulo: "Pedir info", escuro: false },
                { id: "cancelar", rotulo: "Cancelar", escuro: false },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => decidir(d.id)}
                disabled={salvando !== null}
                className={cn(
                  "inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition disabled:opacity-60",
                  d.escuro ? "bg-zinc-900 text-white hover:bg-zinc-700" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                )}
              >
                {salvando === `triagem-${d.id}` && <LoaderCircle className="size-4 animate-spin" />}
                {d.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
