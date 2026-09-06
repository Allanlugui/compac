import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Hourglass,
  Ticket,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { ChamadoStatus, ImpactoOperacional, OsStatus } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import StatusBadge, { OsStatusBadge } from "@/app/admin/_components/StatusBadge";
import ImpactoBadge, { IMPACTOS } from "@/app/admin/_components/ImpactoBadge";
import PageHeader from "@/components/ui/PageHeader";
import StatCard, { type Tom } from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Dashboard · SGA-M",
  description: "Painel de chamados de manutenção por status.",
};

const ABAS = [
  { id: "todos", rotulo: "Todos" },
  { id: "novos", rotulo: "Novos" },
  { id: "em_os", rotulo: "Em O.S." },
  { id: "concluidos", rotulo: "Concluídos" },
  { id: "cancelados", rotulo: "Cancelados" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

const STATUS_NOVOS: ChamadoStatus[] = ["aberto", "em_triagem", "aguardando_informacao"];
const STATUS_OS: ChamadoStatus[] = ["convertido_os", "em_andamento"];
const STATUS_OK: ChamadoStatus[] = ["resolvido", "concluido"];

/** Acento lateral do card por grupo de status. */
const ACENTO_STATUS: Record<ChamadoStatus, string> = {
  aberto: "bg-amber-400",
  em_triagem: "bg-yellow-400",
  aguardando_informacao: "bg-orange-400",
  convertido_os: "bg-sky-400",
  resolvido: "bg-emerald-400",
  cancelado: "bg-zinc-300",
  em_andamento: "bg-sky-400",
  concluido: "bg-emerald-400",
};

interface DashboardProps {
  searchParams: Promise<{ status?: string; impacto?: string }>;
}

/** Linha resumida do dashboard (subset do SELECT + join com ativos). */
interface ChamadoResumo {
  id: string;
  solicitante: string;
  descricao: string;
  status: ChamadoStatus;
  impacto: ImpactoOperacional | null;
  os_status: OsStatus | null;
  created_at: string;
  ativos: { nome: string } | { nome: string }[] | null;
}

/** O join pode vir como objeto (to-one) — normaliza com segurança. */
function nomeDoAtivo(ativos: ChamadoResumo["ativos"]): string {
  if (!ativos) return "Ativo removido";
  if (Array.isArray(ativos)) return ativos[0]?.nome ?? "Ativo removido";
  return ativos.nome;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const { status, impacto } = await searchParams;
  const aba: AbaId =
    status === "novos" || status === "em_os" || status === "concluidos" || status === "cancelados"
      ? status
      : "todos";
  const filtroImpacto: ImpactoOperacional | null =
    impacto === "baixo" ||
    impacto === "medio" ||
    impacto === "alto" ||
    impacto === "critico" ||
    impacto === "parada_total"
      ? impacto
      : null;

  const supabase = await createClient();
  const ctx = await requireOrg();
  const { data } = await supabase
    .from("chamados")
    .select("id, solicitante, descricao, status, impacto, os_status, created_at, ativo_id, ativos(id, nome, localizacao)")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false });

  const chamados = (data ?? []) as unknown as ChamadoResumo[];

  const emGrupo = (c: ChamadoResumo, grupo: AbaId): boolean => {
    if (grupo === "todos") return true;
    if (grupo === "novos") return STATUS_NOVOS.includes(c.status);
    if (grupo === "em_os") return STATUS_OS.includes(c.status);
    if (grupo === "concluidos") return STATUS_OK.includes(c.status);
    return c.status === "cancelado";
  };

  const contagem: Record<Exclude<AbaId, "todos">, number> = {
    novos: chamados.filter((c) => STATUS_NOVOS.includes(c.status)).length,
    em_os: chamados.filter((c) => STATUS_OS.includes(c.status)).length,
    concluidos: chamados.filter((c) => STATUS_OK.includes(c.status)).length,
    cancelados: chamados.filter((c) => c.status === "cancelado").length,
  };

  const visiveis = chamados.filter(
    (c) =>
      emGrupo(c, aba) &&
      (!filtroImpacto || c.impacto === filtroImpacto),
  );

  function hrefComFiltros(proxStatus: string, proxImpacto: ImpactoOperacional | null) {
    const p = new URLSearchParams();
    if (proxStatus !== "todos") p.set("status", proxStatus);
    if (proxImpacto) p.set("impacto", proxImpacto);
    const q = p.toString();
    return q === "" ? "/admin/dashboard" : `/admin/dashboard?${q}`;
  }

  const kpis: { rotulo: string; valor: number; Icone: (p: { className?: string }) => React.ReactNode; tom: Tom }[] = [
    { rotulo: "Novos", valor: contagem.novos, Icone: Ticket, tom: "amber" },
    { rotulo: "Em O.S.", valor: contagem.em_os, Icone: Hourglass, tom: "sky" },
    { rotulo: "Concluídos", valor: contagem.concluidos, Icone: CircleCheck, tom: "emerald" },
    { rotulo: "Total", valor: chamados.length, Icone: ClipboardList, tom: "zinc" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Dashboard"
        descricao="Demandas, triagem e O.S. por estágio."
        acoes={
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white tabular-nums">
              {visiveis.length} em exibição
            </span>
            <Link
              href="/admin/chamados/novo"
              className="inline-flex min-h-[40px] items-center rounded-full bg-white px-4 text-xs font-bold text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-100"
            >
              + Novo chamado
            </Link>
          </span>
        }
      />

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ rotulo, valor, Icone, tom }) => (
          <StatCard key={rotulo} rotulo={rotulo} valor={valor} Icone={Icone} tom={tom} />
        ))}
      </div>

      {/* Abas por status */}
      <nav
        aria-label="Filtrar por status"
        className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5 shadow-inner"
      >
        {ABAS.map(({ id, rotulo }) => {
          const total =
            id === "todos"
              ? chamados.filter((c) => !filtroImpacto || c.impacto === filtroImpacto).length
              : contagem[id];
          const ativo = aba === id;
          return (
            <Link
              key={id}
              href={hrefComFiltros(id, filtroImpacto)}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold whitespace-nowrap transition-all",
                ativo
                  ? "scale-[1.02] bg-white text-zinc-900 shadow-md ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:bg-white/50 hover:text-zinc-800",
              )}
            >
              {rotulo}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  ativo ? "bg-zinc-900 text-white" : "bg-zinc-300/60 text-zinc-600",
                )}
              >
                {total}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Filtro por impacto operacional */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
          Impacto:
        </span>
        <Link
          href={hrefComFiltros(aba, null)}
          aria-current={!filtroImpacto ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition",
            !filtroImpacto
              ? "bg-zinc-900 text-white ring-zinc-900"
              : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-100",
          )}
        >
          Todos
        </Link>
        {IMPACTOS.map(({ id, rotulo }) => {
          const ativo = filtroImpacto === id;
          return (
            <Link
              key={id}
              href={hrefComFiltros(aba, ativo ? null : id)}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition",
                ativo
                  ? "bg-zinc-900 text-white ring-zinc-900"
                  : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-100",
              )}
            >
              {rotulo}
            </Link>
          );
        })}
      </div>

      {/* Lista de chamados — linhas detalhadas, sem grid */}
      {visiveis.length === 0 ? (
        <EmptyState
          Icone={ClipboardList}
          titulo="Nenhum chamado aqui"
          descricao="Novos chamados abertos via QR Code aparecem neste painel. Tente alterar os filtros ou aguarde novas solicitações."
        />
      ) : (
        <ul className="divide-y divide-zinc-200/80 overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm">
          {visiveis.map((chamado) => (
            <li
              key={chamado.id}
              className="group relative flex gap-3 p-4 transition hover:bg-zinc-50 sm:items-center sm:gap-4 sm:p-5"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 bottom-4 left-0 w-1.5 rounded-r-full",
                  ACENTO_STATUS[chamado.status],
                )}
              />
              <div className="min-w-0 flex-1 pl-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="truncate text-base font-black text-zinc-900">
                    {nomeDoAtivo(chamado.ativos)}
                  </h2>
                  <StatusBadge status={chamado.status} />
                  {chamado.os_status && <OsStatusBadge status={chamado.os_status} />}
                  <ImpactoBadge impacto={chamado.impacto} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-zinc-600">
                  {chamado.descricao}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3.5 shrink-0" />
                    {chamado.solicitante}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5 shrink-0" />
                    {formatarDataHora(chamado.created_at)}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    #{chamado.id.slice(0, 8).toUpperCase()}
                  </span>
                </p>
              </div>
              <Link
                href={`/admin/chamados/${chamado.id}`}
                aria-label={`Abrir detalhes do chamado de ${nomeDoAtivo(chamado.ativos)}`}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 self-center rounded-2xl bg-zinc-900 px-4 text-sm font-bold whitespace-nowrap text-white shadow-lg transition hover:bg-zinc-700"
              >
                Detalhes
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
