import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge, { OsStatusBadge } from "@/app/admin/_components/StatusBadge";
import type { ChamadoStatus, OsStatus } from "@/lib/types";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendário · SGA-M" };

interface Props {
  searchParams: Promise<{ tipo?: string }>;
}

export default async function CalendarioPage({ searchParams }: Props) {
  const { tipo } = await searchParams;
  const filtro = tipo === "preventiva" ? "preventiva" : tipo === "corretiva" ? "corretiva" : "todas";

  const supabase = await createClient();
  const ctx = await requireOrg();
  const hojeDt = new Date();
  const hoje = hojeDt.toISOString().slice(0, 10);
  const fimSemana = new Date(hojeDt.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const fimMes = new Date(hojeDt.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  let query = supabase
    .from("chamados")
    .select("id, solicitante, descricao, status, os_status, os_tipo, prazo, created_at, ativos(nome)")
    .eq("organization_id", ctx.orgId)
    .not("prazo", "is", null)
    .not("status", "in", "(resolvido,concluido,cancelado)")
    .order("prazo", { ascending: true })
    .limit(200);
  if (filtro !== "todas") query = query.eq("os_tipo", filtro);
  const { data: oss } = await query;

  const { data: planos } = await supabase
    .from("planos_manutencao")
    .select("id, atividade, proxima_execucao, tolerancia_dias, ativos(nome)")
    .eq("organization_id", ctx.orgId)
    .eq("ativo", true)
    .not("proxima_execucao", "is", null)
    .order("proxima_execucao", { ascending: true })
    .limit(100);

  const lista = ((oss ?? []) as {
    id: string; solicitante: string; descricao: string; status: string;
    os_status: string | null; os_tipo: string | null; prazo: string;
    ativos: { nome: string } | { nome: string }[] | null;
  }[]);

  const nomeAtivo = (a: { nome: string } | { nome: string }[] | null): string =>
    !a ? "—" : Array.isArray(a) ? (a[0]?.nome ?? "—") : a.nome;

  const grupos: { id: string; rotulo: string; itens: typeof lista }[] = [
    { id: "atrasadas", rotulo: "Atrasadas", itens: lista.filter((o) => o.prazo < hoje) },
    { id: "hoje", rotulo: "Hoje", itens: lista.filter((o) => o.prazo === hoje) },
    { id: "semana", rotulo: "Esta semana", itens: lista.filter((o) => o.prazo > hoje && o.prazo <= fimSemana) },
    { id: "mes", rotulo: "Este mês", itens: lista.filter((o) => o.prazo > fimSemana && o.prazo <= fimMes) },
    { id: "proximas", rotulo: "Próximas", itens: lista.filter((o) => o.prazo > fimMes) },
  ];

  const planosLista = ((planos ?? []) as unknown as {
    id: string; atividade: string; proxima_execucao: string;
    ativos: { nome: string } | null;
  }[]);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Calendário" descricao="SLAs, vencimentos e preventivas." />
      <nav aria-label="Filtrar por tipo" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5 shadow-inner">
        {(
          [
            { id: "todas", rotulo: "Todas" },
            { id: "corretiva", rotulo: "Corretivas" },
            { id: "preventiva", rotulo: "Preventivas" },
          ] as const
        ).map(({ id, rotulo }) => (
          <Link
            key={id}
            href={id === "todas" ? "/admin/calendario" : `/admin/calendario?tipo=${id}`}
            aria-current={(filtro === id ? "page" : undefined) as "page" | undefined}
            className={cn(
              "flex flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold whitespace-nowrap transition-all",
              filtro === id ? "scale-[1.02] bg-white text-zinc-900 shadow-md ring-1 ring-zinc-200" : "text-zinc-500 hover:bg-white/50 hover:text-zinc-800",
            )}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      {grupos.map((g) => (
        <section key={g.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <CalendarClock className="size-4 text-zinc-400" />
            {g.rotulo} ({g.itens.length})
          </h2>
          {g.itens.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">Nada aqui.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {g.itens.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{nomeAtivo(o.ativos)} · {o.solicitante}</p>
                    <p className="text-xs text-zinc-400">
                      Prazo {formatarData(o.prazo)}{o.os_tipo ? ` · ${o.os_tipo}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={o.status as ChamadoStatus} />
                    {o.os_status && <OsStatusBadge status={o.os_status as OsStatus} />}
                    <Link href={`/admin/chamados/${o.id}`} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700">
                      Abrir
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-black">Preventivas programadas ({planosLista.length})</h2>
        {planosLista.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Nenhum plano com data.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {planosLista.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.ativos?.nome ?? "—"}</p>
                  <p className="truncate text-xs text-zinc-500">{p.atividade}</p>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-black ring-1",
                  p.proxima_execucao < hoje ? "bg-red-100 text-red-800 ring-red-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200",
                )}>
                  {formatarData(p.proxima_execucao)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/preventivas" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-zinc-300 px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50">
          Gerenciar preventivas
        </Link>
      </section>
    </div>
  );
}
