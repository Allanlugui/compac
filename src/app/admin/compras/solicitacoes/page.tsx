import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao, pode } from "@/lib/permissoes";
import type { StatusSolicitacao } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import StatusSolicBadge from "./StatusSolicBadge";

export const metadata: Metadata = { title: "Solicitações · SGA-M" };

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const FILTROS: { id: string; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "abertas", rotulo: "Em aberto" },
  { id: "aprovada", rotulo: "Aprovadas" },
  { id: "encerradas", rotulo: "Encerradas" },
];

export default async function SolicitacoesPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "solicitacoes.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Solicitações" descricao="Solicitações de compra." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Sem acesso às solicitações</p>
        </div>
      </div>
    );
  }
  const podeCriar = pode(ctx, "solicitacoes.criar");

  let q = supabase
    .from("solicitacoes_compra")
    .select("id, setor, solicitante, item, status, created_at, origem, prioridade, created_by")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  // Record scope: SOLICITANTE vê apenas próprias solicitações (created_by ou solicitante)
  if (ctx.role === "SOLICITANTE") {
    q = q.or(`created_by.eq.${ctx.userId},solicitante.eq.${ctx.email}`);
  }
  const { data } = await q;

  const ABERTAS = ["rascunho", "enviada", "em_analise", "pendente", "em_cotacao", "pedido_gerado"];
  const FIM = ["recebida", "encerrada", "comprado"];
  let lista = (data ?? []) as {
    id: string; setor: string; solicitante: string; item: string;
    status: StatusSolicitacao; created_at: string; origem: string | null; prioridade: string | null;
  }[];
  if (status === "abertas") lista = lista.filter((s) => ABERTAS.includes(s.status));
  else if (status === "aprovada") lista = lista.filter((s) => ["aprovada", "aprovado"].includes(s.status));
  else if (status === "encerradas") lista = lista.filter((s) => FIM.includes(s.status));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Solicitações"
        descricao={`${ctx.orgNome} · necessidade → aprovação → compra.`}
        acoes={
          podeCriar ? (
            <Link
              href="/admin/compras/solicitacoes/nova"
              className="inline-flex min-h-[40px] items-center rounded-full bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-700"
            >
              + Nova solicitação
            </Link>
          ) : undefined
        }
      />
      <nav aria-label="Filtrar" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5 shadow-inner">
        {FILTROS.map(({ id, rotulo }) => {
          const ativo = (status ?? "todas") === id;
          return (
            <Link
              key={id}
              href={id === "todas" ? "/admin/compras/solicitacoes" : `/admin/compras/solicitacoes?status=${id}`}
              aria-current={ativo ? "page" : undefined}
              className={`flex flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold whitespace-nowrap transition-all ${ativo ? "scale-[1.02] bg-white text-zinc-900 shadow-md ring-1 ring-zinc-200" : "text-zinc-500 hover:bg-white/50 hover:text-zinc-800"}`}
            >
              {rotulo}
            </Link>
          );
        })}
      </nav>
      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Nenhuma solicitação aqui.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200/80 overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm">
          {lista.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/compras/solicitacoes/${s.id}`} className="flex items-center justify-between gap-3 p-4 transition hover:bg-zinc-50 sm:p-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{s.item}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {s.setor} · {s.solicitante}
                    {s.origem ? ` · via ${s.origem}` : ""}
                    {s.prioridade ? ` · ${s.prioridade}` : ""}
                  </p>
                </div>
                <StatusSolicBadge status={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
