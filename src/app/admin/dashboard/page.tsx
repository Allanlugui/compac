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
import type { ChamadoStatus, ImpactoOperacional } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import StatusBadge from "@/app/admin/_components/StatusBadge";
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
  { id: "aberto", rotulo: "Abertos" },
  { id: "em_andamento", rotulo: "Em andamento" },
  { id: "concluido", rotulo: "Concluídos" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

const STATUS_VALIDOS: ChamadoStatus[] = ["aberto", "em_andamento", "concluido"];

/** Acento lateral do card por status. */
const ACENTO_STATUS: Record<ChamadoStatus, string> = {
  aberto: "bg-amber-400",
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
    status === "aberto" || status === "em_andamento" || status === "concluido"
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
    .select("id, solicitante, descricao, status, impacto, created_at, ativo_id, ativos(id, nome, localizacao)")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false });

  const chamados = (data ?? []) as unknown as ChamadoResumo[];

  const contagem: Record<ChamadoStatus, number> = {
    aberto: 0,
    em_andamento: 0,
    concluido: 0,
  };
  for (const c of chamados) {
    if (STATUS_VALIDOS.includes(c.status)) contagem[c.status] += 1;
  }

  const visiveis = chamados.filter(
    (c) =>
      (aba === "todos" || c.status === aba) &&
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
    { rotulo: "Abertos", valor: contagem.aberto, Icone: Ticket, tom: "amber" },
    { rotulo: "Em andamento", valor: contagem.em_andamento, Icone: Hourglass, tom: "sky" },
    { rotulo: "Concluídos", valor: contagem.concluido, Icone: CircleCheck, tom: "emerald" },
    { rotulo: "Total", valor: chamados.length, Icone: ClipboardList, tom: "zinc" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Dashboard"
        descricao="Acompanhe os chamados de manutenção por status."
        acoes={
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white tabular-nums">
            {visiveis.length} em exibição
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
        className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5 shadow-inner"
      >
        {ABAS.map(({ id, rotulo }) => {
          const total =
            id === "todos"
              ? chamados.filter((c) => !filtroImpacto || c.impacto === filtroImpacto).length
              : contagem[id as ChamadoStatus];
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

      {/* Lista de chamados */}
      {visiveis.length === 0 ? (
        <EmptyState
          Icone={ClipboardList}
          titulo="Nenhum chamado aqui"
          descricao="Novos chamados abertos via QR Code aparecem neste painel. Tente alterar os filtros ou aguarde novas solicitações."
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visiveis.map((chamado) => (
            <li
              key={chamado.id}
              className="card-3d group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200/70 p-5"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 bottom-4 left-0 w-1.5 rounded-r-full",
                  ACENTO_STATUS[chamado.status],
                )}
              />
              <div className="flex items-start justify-between gap-3 pl-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black text-zinc-900">
                    {nomeDoAtivo(chamado.ativos)}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-500">
                    <User className="size-3.5 shrink-0" />
                    {chamado.solicitante}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                    <CalendarDays className="size-3.5 shrink-0" />
                    {formatarDataHora(chamado.created_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={chamado.status} />
                  <ImpactoBadge impacto={chamado.impacto} />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 pl-2 text-sm text-zinc-600">
                {chamado.descricao}
              </p>
              <Link
                href={`/admin/chamados/${chamado.id}`}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-zinc-900 px-4 text-sm font-bold text-white shadow-lg transition hover:bg-zinc-700"
              >
                Gerenciar / Detalhes
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
