"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ScrollText, Search } from "lucide-react";
import type { AuditoriaAcao, AuditoriaLog } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACOES: { id: "todas" | AuditoriaAcao; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "INSERT", rotulo: "Criação" },
  { id: "UPDATE", rotulo: "Alteração" },
  { id: "DELETE", rotulo: "Exclusão" },
];

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 0, rotulo: "Tudo" },
];

const CLASSE_ACAO: Record<AuditoriaAcao, string> = {
  INSERT: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  UPDATE: "bg-sky-100 text-sky-800 ring-sky-200",
  DELETE: "bg-red-100 text-red-800 ring-red-200",
  STATUS_CHANGE: "bg-amber-100 text-amber-800 ring-amber-200",
  LOGIN: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  LOGOUT: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  APPROVAL: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTION: "bg-red-100 text-red-800 ring-red-200",
  STOCK_ENTRY: "bg-sky-100 text-sky-800 ring-sky-200",
  STOCK_EXIT: "bg-amber-100 text-amber-800 ring-amber-200",
  STOCK_ADJUSTMENT: "bg-violet-100 text-violet-800 ring-violet-200",
  MEMBERSHIP_CHANGE: "bg-violet-100 text-violet-800 ring-violet-200",
  ROLE_CHANGE: "bg-violet-100 text-violet-800 ring-violet-200",
  QR_REGENERATED: "bg-orange-100 text-orange-800 ring-orange-200",
};

const ROTULO_ACAO: Record<AuditoriaAcao, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
  STATUS_CHANGE: "Status",
  LOGIN: "Login",
  LOGOUT: "Logout",
  APPROVAL: "Aprovação",
  REJECTION: "Rejeição",
  STOCK_ENTRY: "Entrada est.",
  STOCK_EXIT: "Saída est.",
  STOCK_ADJUSTMENT: "Ajuste est.",
  MEMBERSHIP_CHANGE: "Membro",
  ROLE_CHANGE: "Perfil",
  QR_REGENERATED: "QR novo",
};

/** Link contextual para o registro afetado, quando houver tela correspondente. */
function destino(tabela: string, registroId: string): string | null {
  switch (tabela) {
    case "chamados":
      return `/admin/chamados/${registroId}`;
    case "compras":
    case "solicitacoes_compra":
      return "/admin/compras";
    case "ativos":
      return "/admin/ativos";
    default:
      return null;
  }
}

function resumir(valor: unknown): string {
  const texto =
    typeof valor === "string" ? valor : (JSON.stringify(valor) ?? "—");
  return texto.length > 90 ? `${texto.slice(0, 89)}…` : texto;
}

function Diff({
  antes,
  depois,
}: {
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}) {
  const chaves = [
    ...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]),
  ];
  if (chaves.length === 0) {
    return <p className="text-xs text-zinc-500">Sem detalhes registrados.</p>;
  }
  return (
    <dl className="space-y-1.5">
      {chaves.map((chave) => {
        const tinhaAntes = antes !== null && chave in antes;
        const temDepois = depois !== null && chave in depois;
        const mudou =
          tinhaAntes && temDepois && JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave]);
        return (
          <div
            key={chave}
            className={cn(
              "grid gap-1 rounded-lg px-2.5 py-1.5 font-mono text-xs sm:grid-cols-[140px_1fr] sm:gap-3",
              mudou ? "bg-amber-50 ring-1 ring-amber-200" : "bg-zinc-50 ring-1 ring-zinc-200/70",
            )}
          >
            <dt className="font-bold text-zinc-600">{chave}</dt>
            <dd className="break-all text-zinc-800">
              {tinhaAntes ? (
                <span className={cn(mudou && "text-red-700 line-through")}>
                  {resumir(antes[chave])}
                </span>
              ) : (
                <span className="text-zinc-400">—</span>
              )}
              {mudou && <span className="mx-1 text-zinc-400">→</span>}
              {temDepois && (mudou || !tinhaAntes) && (
                <span className={cn(mudou && "font-bold text-emerald-700")}>
                  {resumir(depois[chave])}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function LogsAuditoria({ logs }: { logs: AuditoriaLog[] }) {
  const [filtroTabela, setFiltroTabela] = useState("todas");
  const [filtroAcao, setFiltroAcao] = useState<"todas" | AuditoriaAcao>("todas");
  const [periodoDias, setPeriodoDias] = useState(30);
  const [busca, setBusca] = useState("");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const tabelas = useMemo(() => {
    const unicas = new Set(logs.map((l) => l.tabela));
    return [...unicas].sort();
  }, [logs]);

  const limite = useMemo(() => {
    if (periodoDias === 0) return null;
    return +new Date() - periodoDias * 86400000;
  }, [periodoDias]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return logs.filter((log) => {
      if (filtroTabela !== "todas" && log.tabela !== filtroTabela) return false;
      if (filtroAcao !== "todas" && log.acao !== filtroAcao) return false;
      if (limite !== null && +new Date(log.created_at) < limite) return false;
      if (termo !== "") {
        const alvo = `${log.tabela} ${log.registro_id} ${log.executado_por}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [logs, filtroTabela, filtroAcao, limite, busca]);

  const campo =
    "min-h-[40px] rounded-lg border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none";

  return (
    <section className="card-3d rounded-3xl border border-zinc-200/70 p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 text-base font-black text-zinc-900">
        <span className="icon-3d flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <ScrollText className="size-4" />
        </span>
        Histórico de logs
      </h2>

      {/* Filtros */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 font-bold text-zinc-600">Tabela</span>
          <select
            value={filtroTabela}
            onChange={(e) => setFiltroTabela(e.target.value)}
            className={`${campo} w-full`}
          >
            <option value="todas">Todas</option>
            {tabelas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 rounded-lg bg-zinc-200/60 p-1">
          {ACOES.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltroAcao(id)}
              aria-pressed={filtroAcao === id}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition",
                filtroAcao === id
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-zinc-200/60 p-1">
          {PERIODOS.map(({ dias, rotulo }) => (
            <button
              key={rotulo}
              type="button"
              onClick={() => setPeriodoDias(dias)}
              aria-pressed={periodoDias === dias}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition",
                periodoDias === dias
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            placeholder="Buscar registro ou autor…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${campo} w-full pl-9`}
          />
        </label>
      </div>

      {/* Linha do tempo */}
      {visiveis.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Nenhum evento para os filtros atuais.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {visiveis.map((log) => {
            const expandido = expandidoId === log.id;
            const link = destino(log.tabela, log.registro_id);
            return (
              <li
                key={log.id}
                className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setExpandidoId(expandido ? null : log.id)}
                  aria-expanded={expandido}
                  className="flex w-full flex-wrap items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black ring-1",
                      CLASSE_ACAO[log.acao],
                    )}
                  >
                    {ROTULO_ACAO[log.acao]}
                  </span>
                  <span className="font-mono text-xs font-bold text-zinc-900">
                    {log.tabela}
                  </span>
                  <span className="truncate font-mono text-[11px] text-zinc-400">
                    {log.registro_id.slice(0, 8)}…
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">
                    {log.executado_por} · {formatarDataHora(log.created_at)}
                  </span>
                </button>
                {expandido && (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <Diff
                      antes={log.dados_anteriores}
                      depois={log.dados_novos}
                    />
                    {link && (
                      <Link
                        href={link}
                        className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-zinc-700 underline-offset-2 hover:underline"
                      >
                        Abrir registro
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-xs text-zinc-400">
        Exibindo {visiveis.length} de {logs.length} eventos carregados.
      </p>
    </section>
  );
}
