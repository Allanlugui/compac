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
      classes: "bg-amber-100 text-amber-700",
    },
    {
      rotulo: "Em andamento",
      valor: contagem.em_andamento,
      Icone: Hourglass,
      classes: "bg-sky-100 text-sky-700",
    },
    {
      rotulo: "Concluídos",
      valor: contagem.concluido,
      Icone: CircleCheck,
      classes: "bg-emerald-100 text-emerald-700",
    },
    {
      rotulo: "Total",
      valor: chamados.length,
      Icone: ClipboardList,
      classes: "bg-zinc-900 text-white",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Acompanhe os chamados de manutenção por status.
        </p>
      </div>

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ rotulo, valor, Icone, classes }) => (
          <div
            key={rotulo}
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                classes,
              )}
            >
              <Icone className="size-5" />
            </span>
            <div>
              <p className="text-2xl leading-none font-bold text-zinc-900">
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
        className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-200/70 p-1"
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
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition",
                ativo
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {rotulo}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
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
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <ClipboardList className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-semibold text-zinc-700">
            Nenhum chamado aqui
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Novos chamados abertos via QR Code aparecem neste painel.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visiveis.map((chamado) => (
            <li
              key={chamado.id}
              className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-zinc-900">
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
              <p className="mt-3 line-clamp-2 text-sm text-zinc-600">
                {chamado.descricao}
              </p>
              <Link
                href={`/admin/chamados/${chamado.id}`}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Gerenciar / Detalhes
                <ArrowRight className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
