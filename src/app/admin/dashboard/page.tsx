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
import type { ChamadoStatus } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import StatusBadge from "@/app/admin/_components/StatusBadge";

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
  searchParams: Promise<{ status?: string }>;
}

/** Linha resumida do dashboard (subset do SELECT + join com ativos). */
interface ChamadoResumo {
  id: string;
  solicitante: string;
  descricao: string;
  status: ChamadoStatus;
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
  const { status } = await searchParams;
  const aba: AbaId =
    status === "aberto" || status === "em_andamento" || status === "concluido"
      ? status
      : "todos";

  const supabase = await createClient();
  const { data } = await supabase
    .from("chamados")
    .select("id, solicitante, descricao, status, created_at, ativo_id, ativos(id, nome, localizacao)")
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

  const visiveis =
    aba === "todos" ? chamados : chamados.filter((c) => c.status === aba);

  const kpis = [
    {
      rotulo: "Abertos",
      valor: contagem.aberto,
      Icone: Ticket,
      chip: "bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-950",
      brilho: "bg-amber-400/20",
    },
    {
      rotulo: "Em andamento",
      valor: contagem.em_andamento,
      Icone: Hourglass,
      chip: "bg-gradient-to-br from-sky-300 to-sky-500 text-zinc-950",
      brilho: "bg-sky-400/20",
    },
    {
      rotulo: "Concluídos",
      valor: contagem.concluido,
      Icone: CircleCheck,
      chip: "bg-gradient-to-br from-emerald-300 to-emerald-500 text-zinc-950",
      brilho: "bg-emerald-400/20",
    },
    {
      rotulo: "Total",
      valor: chamados.length,
      Icone: ClipboardList,
      chip: "bg-gradient-to-br from-zinc-600 to-zinc-900 text-white",
      brilho: "bg-zinc-400/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Acompanhe os chamados de manutenção por status.
          </p>
        </div>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white tabular-nums">
          {visiveis.length} em exibição
        </span>
      </div>

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ rotulo, valor, Icone, chip, brilho }) => (
          <div
            key={rotulo}
            className="card-3d relative flex items-center gap-3 overflow-hidden rounded-3xl border border-zinc-200/70 p-4"
          >
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute -top-8 -right-8 size-24 rounded-full blur-2xl",
                brilho,
              )}
            />
            <span
              className={cn(
                "icon-3d relative flex size-11 shrink-0 items-center justify-center rounded-2xl",
                chip,
              )}
            >
              <Icone className="size-5" />
            </span>
            <div className="relative">
              <p className="text-2xl leading-none font-black text-zinc-900 tabular-nums">
                {valor}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500">{rotulo}</p>
            </div>
          </div>
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
              ? chamados.length
              : contagem[id as ChamadoStatus];
          const ativo = aba === id;
          return (
            <Link
              key={id}
              href={id === "todos" ? "/admin/dashboard" : `/admin/dashboard?status=${id}`}
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

      {/* Lista de chamados */}
      {visiveis.length === 0 ? (
        <div className="card-3d rounded-3xl border border-dashed border-zinc-300 p-10 text-center">
          <ClipboardList className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold text-zinc-700">Nenhum chamado aqui</p>
          <p className="mt-1 text-sm text-zinc-500">
            Novos chamados abertos via QR Code aparecem neste painel.
          </p>
        </div>
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
                <StatusBadge status={chamado.status} />
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
