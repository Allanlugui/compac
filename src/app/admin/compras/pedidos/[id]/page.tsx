import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao, pode } from "@/lib/permissoes";
import type { PedidoCompra, PedidoItem, Recebimento, RecebimentoItem } from "@/lib/types";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import RecebimentoForm from "./RecebimentoForm";
import PedidoWorkflow from "./PedidoWorkflow";

export const metadata: Metadata = { title: "Pedido · SGA-M" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PedidoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "compras.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Pedido" voltar={{ href: "/admin/compras", rotulo: "Compras" }} />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Sem acesso a compras</p>
        </div>
      </div>
    );
  }
  const podeAprovar = pode(ctx, "compras.aprovar");
  const podeReceber = pode(ctx, "compras.receber");

  const [
    { data: pedData },
    { data: itensData },
    { data: recsData },
    { data: fornData },
  ] = await Promise.all([
    supabase.from("pedidos_compra").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("pedido_itens").select("*").eq("pedido_id", id).eq("organization_id", ctx.orgId).order("created_at"),
    supabase.from("recebimentos").select("*, recebimento_itens(*)").eq("pedido_id", id).eq("organization_id", ctx.orgId).order("created_at"),
    supabase.from("fornecedores").select("id, nome").eq("organization_id", ctx.orgId).limit(500),
  ]);

  const ped = (pedData ?? null) as PedidoCompra | null;
  if (!ped) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Pedido" voltar={{ href: "/admin/compras", rotulo: "Compras" }} />
        <EmptyState Icone={SearchX} titulo="Não encontrado" descricao="Verifique o link ou a organização." />
      </div>
    );
  }

  const itens = (itensData ?? []) as PedidoItem[];
  const recs = (recsData ?? []) as (Recebimento & { recebimento_itens: RecebimentoItem[] })[];
  const mapaForn = new Map(((fornData ?? []) as { id: string; nome: string }[]).map((f) => [f.id, f.nome]));

  const recebidoPorItem = new Map<string, number>();
  for (const r of recs) {
    for (const li of r.recebimento_itens) {
      recebidoPorItem.set(li.pedido_item_id, (recebidoPorItem.get(li.pedido_item_id) ?? 0) + Number(li.qtd_recebida ?? 0));
    }
  }
  const totalItens = itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.preco_unitario), 0);
  const total = totalItens + Number(ped.frete ?? 0) - Number(ped.desconto ?? 0) + Number(ped.impostos ?? 0);
  const recebivel = ["aberto", "aprovado"].includes(ped.status);

  return (
    <div className="space-y-4">
      <PageHeader
        titulo={`Pedido ${ped.numero}`}
        descricao={`${mapaForn.get(ped.fornecedor_id) ?? "—"} · ${ped.status}`}
        voltar={{ href: "/admin/compras", rotulo: "Compras" }}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black">Situação</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Status</dt><dd className="font-bold">{ped.status}</dd></div>
          <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Prazo</dt><dd>{ped.prazo ?? "—"}</dd></div>
          <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Centro de custo</dt><dd>{ped.centro_custo ?? "—"}</dd></div>
          <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Comprador</dt><dd>{ped.comprador ?? "—"}</dd></div>
          {ped.solicitacao_id && (
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Solicitação</dt><dd><Link href={`/admin/compras/solicitacoes/${ped.solicitacao_id}`} className="font-bold underline-offset-2 hover:underline">Abrir solicitação</Link></dd></div>
          )}
        </dl>
        <div className="mt-3">
          <PedidoWorkflow pedidoId={ped.id} statusAtual={ped.status} podeAprovar={podeAprovar} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black">Itens e totais</h2>
        <ul className="mt-2 space-y-1.5">
          {itens.map((it) => (
            <li key={it.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200/70">
              <p className="font-bold">{it.descricao}</p>
              <p className="text-xs text-zinc-500">
                {String(it.quantidade)} {it.unidade} × {formatarMoeda(Number(it.preco_unitario))}
                {" = "}{formatarMoeda(Number(it.quantidade) * Number(it.preco_unitario))}
                {" · recebido "}{String(recebidoPorItem.get(it.id) ?? 0)}
              </p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between"><dt className="text-zinc-500">Itens</dt><dd className="font-bold">{formatarMoeda(totalItens)}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Frete</dt><dd className="font-bold">{formatarMoeda(Number(ped.frete ?? 0))}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Desconto</dt><dd className="font-bold">−{formatarMoeda(Number(ped.desconto ?? 0))}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Impostos</dt><dd className="font-bold">{formatarMoeda(Number(ped.impostos ?? 0))}</dd></div>
          <div className="flex justify-between sm:col-span-2 border-t border-zinc-200 pt-2 text-base"><dt className="font-black">Total</dt><dd className="font-black">{formatarMoeda(total)}</dd></div>
        </dl>
      </section>

      {recs.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">Recebimentos ({recs.length})</h2>
          <ul className="mt-2 space-y-2">
            {recs.map((r) => (
              <li key={r.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200/70">
                <p className="font-bold">
                  {r.status === "aceito" ? "Aceito" : "Com divergência"}
                  <span className="ml-2 text-xs font-medium text-zinc-500">
                    {formatarDataHora(r.created_at)} · {r.recebido_por ?? ""}
                  </span>
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
                  {r.recebimento_itens.map((li) => (
                    <li key={li.id}>
                      recebida {String(li.qtd_recebida)} · recusada {String(li.qtd_recusada)}
                      {li.motivo ? ` · ${li.motivo}` : ""}
                    </li>
                  ))}
                </ul>
                {r.motivo_divergencia && <p className="mt-1 text-xs text-red-700">Divergência: {r.motivo_divergencia}</p>}
                {r.lote && <p className="text-xs text-zinc-500">Lote {r.lote}{r.validade ? ` · val. ${r.validade}` : ""}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {podeReceber && recebivel && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">Registrar recebimento</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Só o aceito entra no estoque. Pedido original preservado.</p>
          <div className="mt-3">
            <RecebimentoForm
              pedidoId={ped.id}
              itens={itens.map((it) => ({ ...it, recebido_total: recebidoPorItem.get(it.id) ?? 0 }))}
            />
          </div>
        </section>
      )}
    </div>
  );
}
