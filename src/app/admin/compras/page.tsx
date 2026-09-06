import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Receipt, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { pode } from "@/lib/permissoes";
import type { ChamadoStatus, Compra, SolicitacaoCompra } from "@/lib/types";
import { formatarMoeda, numeroOS } from "@/lib/format";
import { cn } from "@/lib/utils";
import NovaCompraForm from "./NovaCompraForm";
import TabelaCompras from "./TabelaCompras";
import PedidosCompra from "./PedidosCompra";

export const metadata: Metadata = {
  title: "Compras · SGA-M",
  description: "Gestão financeira de compras e insumos.",
};

const STATUS_VINCULAVEIS: ChamadoStatus[] = ["aberto", "em_andamento"];

export default async function ComprasPage() {
  const supabase = await createClient();
  const ctx = await requireOrg();

  const [{ data: comprasData }, { data: chamadosData }, { data: pedidosData }, { data: fornsData }, { data: pedsNovos }] =
    await Promise.all([
      supabase
        .from("compras")
        .select("*")
        .eq("organization_id", ctx.orgId)
        .order("data_compra", { ascending: false }),
      supabase
        .from("chamados")
        .select("id, status, ativos(id, nome)")
        .eq("organization_id", ctx.orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("solicitacoes_compra")
        .select("*")
        .eq("organization_id", ctx.orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("organization_id", ctx.orgId)
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("pedidos_compra")
        .select("id, numero, status, created_at")
        .eq("organization_id", ctx.orgId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const pedidos = ((pedidosData ?? []) as SolicitacaoCompra[]).slice().sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
  const pedidosPendentes = pedidos.filter((p) => p.status === "pendente").length;
  const solAbertas = pedidos.filter((p) =>
    ["rascunho", "enviada", "em_analise", "pendente", "em_cotacao"].includes(p.status),
  ).length;
  const pedidosNovos = ((pedsNovos ?? []) as { id: string; numero: string; status: string; created_at: string }[]);
  const pedsAbertos = pedidosNovos.filter((p) => ["aberto", "aprovado"].includes(p.status));

  const compras = ((comprasData ?? []) as Compra[]).slice().sort(
    (a, b) => +new Date(b.data_compra) - +new Date(a.data_compra),
  );

  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  const totalGeral = compras.reduce(
    (soma, c) => soma + Number(c.valor_total ?? 0),
    0,
  );
  const totalMes = compras
    .filter((c) => c.data_compra.slice(0, 7) === mesAtual)
    .reduce((soma, c) => soma + Number(c.valor_total ?? 0), 0);
  const mediaPorCompra = compras.length > 0 ? totalGeral / compras.length : 0;

  // Rótulos "OS XXXXXXXX · Ativo" para os vínculos exibidos na tabela.
  const vinculos: Record<string, string> = {};
  for (const ch of (chamadosData ?? []) as {
    id: string;
    ativos: { nome: string } | { nome: string }[] | null;
  }[]) {
    const ativos = ch.ativos;
    const nome = Array.isArray(ativos)
      ? (ativos[0]?.nome ?? "Ativo removido")
      : (ativos?.nome ?? "Ativo removido");
    vinculos[ch.id] = `OS ${numeroOS(ch.id)} · ${nome}`;
  }

  // Opções de vinculação: apenas chamados ainda não concluídos.
  const opcoesVinculo = ((chamadosData ?? []) as {
    id: string;
    status: ChamadoStatus;
  }[])
    .filter((ch) => STATUS_VINCULAVEIS.includes(ch.status))
    .map((ch) => ({
      id: ch.id,
      rotulo: `${vinculos[ch.id]} (${ch.status === "aberto" ? "aberto" : "em andamento"})`,
    }));

  const opcoesFornecedores = ((fornsData ?? []) as { id: string; nome: string }[]).map(
    (f) => ({ id: f.id, rotulo: f.nome }),
  );

  const kpis = [
    {
      rotulo: "Gasto no mês atual",
      valor: formatarMoeda(totalMes),
      Icone: Wallet,
      classes: "bg-emerald-100 text-emerald-700",
    },
    {
      rotulo: "Média por compra",
      valor: formatarMoeda(mediaPorCompra),
      Icone: TrendingUp,
      classes: "bg-sky-100 text-sky-700",
    },
    {
      rotulo: "Total geral",
      valor: formatarMoeda(totalGeral),
      Icone: Receipt,
      classes: "bg-zinc-900 text-white",
    },
    {
      rotulo: "Pedidos pendentes",
      valor: String(pedidosPendentes),
      Icone: ClipboardCheck,
      classes: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Compras</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Solicitações, cotações, pedidos, recebimentos e financeiro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/compras/solicitacoes"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700"
          >
            Solicitações ({solAbertas} abertas)
          </Link>
          {pode(ctx, "compras.criar") && (
            <Link
              href="/admin/qr-compras"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
            >
              QR de compras
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="min-w-0">
              <p className="truncate text-xl leading-none font-bold text-zinc-900">
                {valor}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500">{rotulo}</p>
            </div>
          </div>
        ))}
      </div>

      <NovaCompraForm chamados={opcoesVinculo} fornecedores={opcoesFornecedores} />
      <PedidosCompra pedidos={pedidos} />
      {pedsAbertos.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">Pedidos em andamento ({pedsAbertos.length})</h2>
          <ul className="mt-2 divide-y divide-zinc-100">
            {pedsAbertos.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/compras/pedidos/${p.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:underline">
                  <span className="font-bold">{p.numero}</span>
                  <span className="text-xs text-zinc-500">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <TabelaCompras compras={compras} vinculos={vinculos} />
    </div>
  );
}
