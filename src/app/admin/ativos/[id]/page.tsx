import type { Metadata } from "next";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { Ativo, AuditoriaLog, Chamado, Compra } from "@/lib/types";
import { formatarDataHora, formatarMoeda, numeroOS } from "@/lib/format";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/app/admin/_components/StatusBadge";
import ModeloManager from "./ModeloManager";

export const metadata: Metadata = { title: "Ativo · SGA-M" };

const ABAS = [
  { id: "visao", rotulo: "Visão geral" },
  { id: "os", rotulo: "O.S." },
  { id: "custos", rotulo: "Custos" },
  { id: "checklists", rotulo: "Checklists" },
  { id: "auditoria", rotulo: "Auditoria" },
  { id: "qr", rotulo: "QR Code" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AtivoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const aba: AbaId = ABAS.some((a) => a.id === tab) ? (tab as AbaId) : "visao";

  const supabase = await createClient();
  const ctx = await requireOrg();

  const { data: ativoData } = await supabase
    .from("ativos")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  const ativo = (ativoData ?? null) as Ativo | null;

  if (!ativo) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Ativo" voltar={{ href: "/admin/ativos", rotulo: "Ativos" }} />
        <EmptyState Icone={SearchX} titulo="Ativo não encontrado" descricao="Verifique o link ou a organização ativa." />
      </div>
    );
  }

  const [{ data: chamadosData }, { data: modelosData }] = await Promise.all([
    supabase
      .from("chamados")
      .select("id, solicitante, descricao, status, created_at, concluido_em")
      .eq("ativo_id", ativo.id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("checklist_modelos")
      .select("id, titulo, checklist_itens(id, texto, obrigatorio, ordem)")
      .eq("ativo_id", ativo.id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
  ]);

  const chamados = (chamadosData ?? []) as Chamado[];
  const chamadosIds = chamados.map((c) => c.id);

  const [{ data: comprasData }, { data: logsData }] = await Promise.all([
    chamadosIds.length > 0
      ? supabase.from("compras").select("*").in("chamado_id", chamadosIds).eq("organization_id", ctx.orgId)
      : Promise.resolve({ data: [] as Compra[] }),
    supabase
      .from("auditoria_logs")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .in("registro_id", [ativo.id, ...chamadosIds].slice(0, 100))
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const compras = ((comprasData ?? []) as Compra[]).slice().sort(
    (a, b) => +new Date(b.data_compra) - +new Date(a.data_compra),
  );
  const logs = (logsData ?? []) as AuditoriaLog[];
  const totalCustos = compras.reduce((s, c) => s + Number(c.valor_total ?? 0), 0);
  const abertos = chamados.filter((c) => c.status !== "concluido").length;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const qrUrl = `${siteUrl !== "" ? siteUrl : ""}/qr/${ativo.qr_code_hash}`;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={ativo.nome}
        descricao={`${ativo.localizacao || "Sem localização"} · ${ctx.orgNome}`}
        voltar={{ href: "/admin/ativos", rotulo: "Ativos" }}
        acoes={<StatusBadge status={chamados.length > 0 && abertos === 0 ? "concluido" : abertos > 0 ? "em_andamento" : "aberto"} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="O.S. abertas" valor={abertos} Icone={SearchX} tom={abertos > 0 ? "amber" : "emerald"} />
        <StatCard rotulo="Total de O.S." valor={chamados.length} Icone={SearchX} tom="zinc" />
        <StatCard rotulo="Custo total" valor={formatarMoeda(totalCustos)} Icone={SearchX} tom="sky" />
        <StatCard rotulo="Checklists" valor={(modelosData ?? []).length} Icone={SearchX} tom="violet" />
      </div>

      <nav aria-label="Abas do ativo" className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5">
        {ABAS.map(({ id: aid, rotulo }) => (
          <Link
            key={aid}
            href={`/admin/ativos/${ativo.id}?tab=${aid}`}
            aria-current={aba === aid ? "page" : undefined}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold whitespace-nowrap transition",
              aba === aid ? "bg-white shadow-md ring-1 ring-zinc-200" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      {aba === "visao" && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Localização</dt><dd className="font-semibold">{ativo.localizacao || "—"}</dd></div>
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Cadastrado em</dt><dd className="font-semibold">{formatarDataHora(ativo.created_at)}</dd></div>
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Código QR</dt><dd className="font-mono text-xs">{ativo.qr_code_hash}</dd></div>
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Última conclusão</dt><dd className="font-semibold">{(() => { const cs = chamados.filter((c) => c.concluido_em).map((c) => c.concluido_em as string).sort(); return cs.length > 0 ? formatarDataHora(cs[cs.length - 1]) : "—"; })()}</dd></div>
          </dl>
          <h3 className="mt-5 text-sm font-black">Últimas O.S.</h3>
          {chamados.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Nenhum chamado para este ativo.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {chamados.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/chamados/${c.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-4 py-2.5 text-sm ring-1 ring-zinc-200/70 transition hover:bg-zinc-100">
                    <span className="truncate font-semibold">OS {numeroOS(c.id)} · {c.solicitante}</span>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {aba === "os" && (
        chamados.length === 0 ? (
          <EmptyState Icone={SearchX} titulo="Sem O.S." descricao="Os chamados deste ativo aparecem aqui." />
        ) : (
          <ul className="space-y-2">
            {chamados.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/chamados/${c.id}`} className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:shadow">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">OS {numeroOS(c.id)} · {c.solicitante}</span>
                    <span className="block truncate text-xs text-zinc-500">{c.descricao}</span>
                  </span>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )
      )}

      {aba === "custos" && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total: <strong className="text-zinc-900">{formatarMoeda(totalCustos)}</strong> em {compras.length} itens.</p>
          {compras.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Nenhum custo vinculado.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-zinc-200">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="bg-zinc-50 text-xs uppercase text-zinc-500"><th className="px-4 py-2">Item</th><th className="px-4 py-2">Qtd</th><th className="px-4 py-2">Total</th><th className="px-4 py-2">OS</th></tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {compras.map((c) => (
                    <tr key={c.id}><td className="px-4 py-2 font-medium">{c.item}</td><td className="px-4 py-2">{String(c.quantidade)}</td><td className="px-4 py-2 font-bold">{formatarMoeda(Number(c.valor_total))}</td><td className="px-4 py-2 font-mono text-xs">{c.chamado_id ? numeroOS(c.chamado_id) : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {aba === "checklists" && (
        <ModeloManager
          ativoId={ativo.id}
          modelos={(modelosData ?? []) as unknown as { id: string; titulo: string; checklist_itens: { id: string; texto: string; obrigatorio: boolean; ordem: number }[] }[]}
        />
      )}

      {aba === "auditoria" && (
        logs.length === 0 ? (
          <EmptyState Icone={SearchX} titulo="Sem eventos" descricao="Mutações deste ativo e de suas O.S. aparecem aqui." />
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
                <p><strong className="font-mono text-xs">{l.tabela}</strong> · <strong>{l.acao}</strong> · {l.executado_por}</p>
                <p className="font-mono text-[11px] text-zinc-400">{l.registro_id.slice(0, 8)}… · {formatarDataHora(l.created_at)}</p>
              </li>
            ))}
          </ul>
        )
      )}

      {aba === "qr" && (
        <section className="mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto w-fit rounded-xl bg-white p-3 ring-1 ring-zinc-200">
            <QRCodeSVG value={qrUrl} size={220} level="M" />
          </div>
          <p className="mt-3 font-mono text-xs break-all text-zinc-500">{qrUrl}</p>
          <p className="mt-1 text-xs text-zinc-400">Imprima pela lista de ativos.</p>
        </section>
      )}
    </div>
  );
}
