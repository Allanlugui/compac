import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao, pode } from "@/lib/permissoes";
import { resolverFoto } from "@/lib/storage";
import type {
  AtivoCompleto,
  AtributoCategoria,
  AtivoDocumento,
  AtivoStatusHistorico,
  AuditoriaLog,
  Chamado,
  Compra,
} from "@/lib/types";
import { formatarDataHora, formatarMoeda, numeroOS } from "@/lib/format";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/app/admin/_components/StatusBadge";
import AtivoStatusBadge from "@/app/admin/_components/AtivoStatusBadge";
import ModeloManager from "./ModeloManager";
import AtivoForm from "./AtivoForm";
import DadosTecnicosForm from "./DadosTecnicosForm";
import DocumentosManager, { type DocComUrl } from "./DocumentosManager";
import StatusAtivoControl from "./StatusAtivoControl";
import QrAtivoPanel from "./QrAtivoPanel";

export const metadata: Metadata = { title: "Ativo · SGA-M" };

const ABAS = [
  { id: "visao", rotulo: "Visão geral" },
  { id: "dados", rotulo: "Dados" },
  { id: "tecnicos", rotulo: "Técnicos" },
  { id: "docs", rotulo: "Documentos" },
  { id: "manutencao", rotulo: "Manutenção" },
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

/** % de completude do cadastro (progressivo, sem bloquear operação). */
function completude(a: AtivoCompleto, nDocs: number): { pct: number; itens: { rotulo: string; ok: boolean }[] } {
  const itens = [
    { rotulo: "Identificação", ok: !!(a.nome && a.codigo) },
    { rotulo: "Localização", ok: !!(a.localidade_id || a.localizacao) },
    { rotulo: "Classificação", ok: !!(a.criticidade && a.responsavel) },
    { rotulo: "Técnicos", ok: Object.keys(a.dados_tecnicos ?? {}).length > 0 },
    { rotulo: "Aquisição", ok: !!(a.fornecedor_id || a.nota_fiscal || a.data_aquisicao) },
    { rotulo: "Documentos", ok: nDocs > 0 },
  ];
  const ok = itens.filter((i) => i.ok).length;
  return { pct: Math.round((ok / itens.length) * 100), itens };
}

export default async function AtivoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const aba: AbaId = ABAS.some((a) => a.id === tab) ? (tab as AbaId) : "visao";

  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "ativos.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Ativo" voltar={{ href: "/admin/ativos", rotulo: "Ativos" }} />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita à operação (ADMIN, GESTOR, TÉCNICO)</p>
        </div>
      </div>
    );
  }
  const podeEditar = pode(ctx, "ativos.editar");
  const podeAlterarStatus = pode(ctx, "ativos.alterar_status");
  const podeExcluir = pode(ctx, "ativos.excluir");

  const { data: ativoData } = await supabase
    .from("ativos")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  const ativo = (ativoData ?? null) as AtivoCompleto | null;

  if (!ativo) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Ativo" voltar={{ href: "/admin/ativos", rotulo: "Ativos" }} />
        <EmptyState Icone={SearchX} titulo="Ativo não encontrado" descricao="Verifique o link ou a organização ativa." />
      </div>
    );
  }

  const [
    { data: chamadosData },
    { data: modelosData },
    { data: catsData },
    { data: locsData },
    { data: fornsData },
    { data: docsData },
    { data: histData },
  ] = await Promise.all([
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
    supabase
      .from("categorias")
      .select("id, nome, atributos")
      .eq("organization_id", ctx.orgId)
      .eq("tipo", "ativo")
      .eq("ativa", true)
      .order("nome"),
    supabase
      .from("localidades")
      .select("id, nome, tipo, parent_id")
      .eq("organization_id", ctx.orgId)
      .order("nome"),
    supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .order("nome"),
    supabase
      .from("ativo_documentos")
      .select("*")
      .eq("ativo_id", ativo.id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ativo_status_historico")
      .select("*")
      .eq("ativo_id", ativo.id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const chamados = (chamadosData ?? []) as Chamado[];
  const chamadosIds = chamados.map((c) => c.id);
  const docs = (docsData ?? []) as AtivoDocumento[];
  const historico = (histData ?? []) as AtivoStatusHistorico[];

  const docsComUrl: DocComUrl[] = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      url: d.path.includes("/object/public/")
        ? d.path
        : await resolverFoto(d.path, ctx.orgId),
    })),
  );

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

  const categoriaAtual = ((catsData ?? []) as { id: string; nome: string; atributos: AtributoCategoria[] }[]).find(
    (c) => c.id === ativo.categoria_id,
  );
  const locs = ((locsData ?? []) as { id: string; nome: string; tipo: string; parent_id: string | null }[]);
  const locPorId = new Map(locs.map((l) => [l.id, l]));
  function caminhoLocalidade(id: string): string {
    const partes: string[] = [];
    let cur = locPorId.get(id);
    const vistos = new Set<string>();
    while (cur && !vistos.has(cur.id)) {
      vistos.add(cur.id);
      partes.unshift(cur.nome);
      cur = cur.parent_id ? locPorId.get(cur.parent_id) : undefined;
    }
    return partes.join(" › ");
  }
  const localidadeAtual = locs.find((l) => l.id === ativo.localidade_id);
  const caminhoAtivo = ativo.localidade_id ? caminhoLocalidade(ativo.localidade_id) : null;
  const comp = completude(ativo, docs.length);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const qrUrl = `${siteUrl !== "" ? siteUrl : ""}/qr/${ativo.qr_code_hash}`;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={ativo.codigo ? `${ativo.codigo} · ${ativo.nome}` : ativo.nome}
        descricao={`${caminhoAtivo || ativo.localizacao || "Sem localização"} · ${ctx.orgNome}`}
        voltar={{ href: "/admin/ativos", rotulo: "Ativos" }}
        acoes={<AtivoStatusBadge status={ativo.status} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Cadastro" valor={`${comp.pct}%`} Icone={SearchX} tom={comp.pct >= 80 ? "emerald" : "amber"} />
        <StatCard rotulo="O.S. abertas" valor={abertos} Icone={SearchX} tom={abertos > 0 ? "amber" : "emerald"} />
        <StatCard rotulo="Custo total" valor={formatarMoeda(totalCustos)} Icone={SearchX} tom="sky" />
        <StatCard rotulo="Documentos" valor={docs.length} Icone={SearchX} tom="violet" />
      </div>

      <nav aria-label="Abas do ativo" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5">
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
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">Completude do cadastro · {comp.pct}%</h3>
              <Link href={`/admin/ativos/${ativo.id}?tab=dados`} className="text-xs font-bold text-zinc-600 underline-offset-2 hover:underline">
                Completar dados
              </Link>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${comp.pct}%` }} />
            </div>
            <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
              {comp.itens.map((i) => (
                <li key={i.rotulo} className="flex items-center gap-2">
                  <span aria-hidden className={`flex size-5 items-center justify-center rounded-full text-[11px] font-black ${i.ok ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"}`}>
                    {i.ok ? "✓" : "·"}
                  </span>
                  {i.rotulo}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Status</dt><dd className="mt-0.5"><AtivoStatusBadge status={ativo.status} /></dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Categoria</dt><dd className="font-semibold">{categoriaAtual?.nome ?? "—"}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Localização</dt><dd className="font-semibold">{caminhoAtivo ? (<Link href="/admin/estrutura" className="underline-offset-2 hover:underline">{caminhoAtivo}</Link>) : (ativo.localizacao ?? "—")}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Responsável</dt><dd className="font-semibold">{ativo.responsavel || "—"}{ativo.equipe ? ` · ${ativo.equipe}` : ""}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Criticidade</dt><dd className="font-semibold">{ativo.criticidade ?? "—"}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Garantia até</dt><dd className="font-semibold">{ativo.garantia_ate ?? "—"}</dd></div>
            </dl>
            {ativo.descricao && (
              <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700 ring-1 ring-zinc-200/70">{ativo.descricao}</p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black">Últimas O.S.</h3>
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
          </div>
        </section>
      )}

      {aba === "dados" && (
        podeEditar ? (
          <AtivoForm
            ativo={ativo}
            categorias={(catsData ?? []) as { id: string; nome: string }[]}
            localidades={locs as { id: string; nome: string; tipo: string; parent_id: string | null }[]}
            fornecedores={(fornsData ?? []) as { id: string; nome: string }[]}
            podeExcluir={podeExcluir}
          />
        ) : (
          <p className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
            Edição restrita a ADMIN e GESTOR. Você pode visualizar e alterar o status na aba Manutenção.
          </p>
        )
      )}

      {aba === "tecnicos" && (
        podeEditar ? (
          <DadosTecnicosForm
            ativoId={ativo.id}
            categoriaNome={categoriaAtual?.nome ?? null}
            atributos={categoriaAtual?.atributos ?? []}
            valores={ativo.dados_tecnicos ?? {}}
          />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(ativo.dados_tecnicos ?? {}).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200/70">
                  <dt className="text-xs font-bold text-zinc-500">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
              {Object.keys(ativo.dados_tecnicos ?? {}).length === 0 && (
                <p className="text-zinc-500">Sem dados técnicos registrados.</p>
              )}
            </dl>
          </div>
        )
      )}

      {aba === "docs" && (
        podeEditar ? (
          <DocumentosManager ativoId={ativo.id} docs={docsComUrl} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {docsComUrl.map((d) => (
              <li key={d.id} className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
                <p className="truncate font-bold">{d.nome}</p>
                {d.url !== "" && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-zinc-700 underline-offset-2 hover:underline">
                    Abrir original
                  </a>
                )}
              </li>
            ))}
            {docsComUrl.length === 0 && (
              <li className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
                Nenhum documento.
              </li>
            )}
          </ul>
        )
      )}

      {aba === "manutencao" && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black">Estado operacional</h3>
          <div className="mt-3">
            <StatusAtivoControl
              ativoId={ativo.id}
              statusAtual={ativo.status}
              historico={historico}
              podeAlterar={podeAlterarStatus}
            />
          </div>
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
          {ativo.valor_aquisicao !== null && (
            <p className="mt-1 text-sm text-zinc-500">Aquisição: <strong className="text-zinc-900">{formatarMoeda(Number(ativo.valor_aquisicao))}</strong></p>
          )}
          {compras.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Nenhum custo vinculado.</p>
          ) : (
            <div className="no-scrollbar mt-3 overflow-x-auto rounded-xl ring-1 ring-zinc-200">
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
        <div className="space-y-2">
          {historico.length > 0 && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-black">Mudanças de status</h3>
              <ul className="mt-2 space-y-1.5">
                {historico.map((h) => (
                  <li key={h.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200/70">
                    <span className="font-bold">{h.de ?? "—"} → {h.para}</span>
                    {h.motivo && <span className="text-zinc-600"> · {h.motivo}</span>}
                    <span className="block text-xs text-zinc-400">{formatarDataHora(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {logs.length === 0 && historico.length === 0 ? (
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
          )}
        </div>
      )}

      {aba === "qr" && (
        <QrAtivoPanel
          ativo={{
            id: ativo.id,
            nome: ativo.nome,
            codigo: ativo.codigo,
            localizacao: localidadeAtual?.nome || ativo.localizacao,
            hash: ativo.qr_code_hash,
            impressoEm: ativo.qr_impresso_em,
          }}
          url={qrUrl}
          orgNome={ctx.orgNome}
          podeEditar={podeEditar}
        />
      )}
    </div>
  );
}
