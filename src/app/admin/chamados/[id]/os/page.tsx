import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { ChamadoComAtivo, Compra } from "@/lib/types";
import {
  formatarData,
  formatarDataHora,
  formatarDuracao,
  formatarMoeda,
  numeroOS,
} from "@/lib/format";
import { resolverFoto } from "@/lib/storage";
import StatusBadge from "@/app/admin/_components/StatusBadge";
import BotaoImprimir from "./BotaoImprimir";

export const metadata: Metadata = {
  title: "Ordem de Serviço · SGA-M",
};

interface OsPageProps {
  params: Promise<{ id: string }>;
}

const ROTULO_STATUS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const ROTULO_IMPACTO: Record<string, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
  parada_total: "Parada total",
};

function FotosOS({ titulo, fotos }: { titulo: string; fotos: string[] }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide text-zinc-900 uppercase">
        {titulo}
      </h2>
      {fotos.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Sem fotos registradas.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {fotos.map((url, i) => (
            <figure key={`${url}-${i}`} className="break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${titulo} ${i + 1}`}
                className="aspect-[4/3] w-full border border-zinc-300 object-cover"
              />
              <figcaption className="mt-1 text-center text-xs text-zinc-500">
                {titulo} {i + 1}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function OsPage({ params }: OsPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await requireOrg();

  const [
    { data: chamadoData },
    { data: comprasData },
    { data: ativData },
    { data: servData },
    { data: osHistData },
    { data: fotosDuranteData },
    { data: execsData },
  ] = await Promise.all([
    supabase
      .from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle(),
    supabase
      .from("compras")
      .select("*")
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .order("data_compra", { ascending: true }),
    supabase
      .from("os_atividades")
      .select("descricao, executado_por, created_at")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("os_servicos_externos")
      .select("servico, valor, nota, data_servico, fornecedores(nome)")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("os_status_historico")
      .select("de, para, motivo, created_at")
      .eq("os_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("os_fotos")
      .select("path")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .eq("categoria", "durante")
      .order("created_at", { ascending: true }),
    supabase
      .from("checklist_execucoes")
      .select("resultado, executado_por, created_at")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
  ]);

  const chamado = (chamadoData ?? null) as ChamadoComAtivo | null;
  const compras = ((comprasData ?? []) as Compra[]).slice().sort(
    (a, b) => +new Date(a.data_compra) - +new Date(b.data_compra),
  );
  const atividades = (ativData ?? []) as {
    descricao: string; executado_por: string | null; created_at: string;
  }[];
  const servicos = ((servData ?? []) as unknown as {
    servico: string; valor: number; nota: string | null; data_servico: string | null;
    fornecedores: { nome: string } | null;
  }[]);
  const osHist = (osHistData ?? []) as {
    de: string | null; para: string; motivo: string | null; created_at: string;
  }[];
  const fotosDurantePaths = ((fotosDuranteData ?? []) as { path: string }[]).map((f) => f.path);
  const fotosDuranteUrls = (
    await Promise.all(fotosDurantePaths.map((p) => resolverFoto(p, ctx.orgId)))
  ).filter((u) => u !== "");
  const execs = (execsData ?? []) as {
    resultado: string | null; executado_por: string; created_at: string;
  }[];

  if (!chamado) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <SearchX className="mx-auto size-12 text-zinc-400" />
        <h1 className="mt-3 text-lg font-bold text-zinc-900">
          Ordem de serviço não encontrada
        </h1>
        <Link
          href="/admin/dashboard"
          className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          <ArrowLeft className="size-4" />
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const fotosAntes = Array.isArray(chamado.fotos_antes) ? chamado.fotos_antes : [];
  const fotosDepois = Array.isArray(chamado.fotos_depois)
    ? chamado.fotos_depois
    : [];
  const totalMateriais = compras.reduce(
    (soma, c) => soma + Number(c.valor_total ?? 0),
    0,
  );
  const totalTerceiros = servicos.reduce((soma, x) => soma + Number(x.valor ?? 0), 0);
  const totalCustos =
    totalMateriais +
    totalTerceiros +
    Number(chamado.custo_mao_obra ?? 0) +
    Number(chamado.custo_outros ?? 0);
  const os = numeroOS(chamado.id);
  const emissao = new Date();

  return (
    <div>
      {/* Barra de navegação — oculta na impressão */}
      <div className="card-3d mb-4 flex flex-col gap-2 rounded-2xl border border-zinc-200/70 p-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/chamados/${chamado.id}`}
            className="inline-flex min-h-[40px] w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
          >
            <ArrowLeft className="size-4" />
            Voltar ao chamado
          </Link>
          <span className="hidden rounded-full bg-zinc-900 px-3 py-1 font-mono text-xs font-bold text-white sm:inline-block">
            OS Nº {os}
          </span>
        </div>
        <BotaoImprimir />
      </div>

      {/* Corpo da OS — é o que sai no papel/PDF */}
      <article className="bg-white p-6 text-black shadow-2xl ring-1 ring-zinc-200 sm:p-10 print:p-0 print:shadow-none print:ring-0">
        {/* Cabeçalho formal */}
        <header className="flex items-start justify-between gap-4 border-b-4 border-double border-zinc-900 pb-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-zinc-600 uppercase">
              SGA-M · Gestão de Manutenção e Compras
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              ORDEM DE SERVIÇO Nº {os}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Emitida em {formatarDataHora(emissao.toISOString())}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Status
            </p>
            <div className="mt-1">
              <StatusBadge status={chamado.status} />
            </div>
          </div>
        </header>

        {/* Dados do ativo */}
        <section className="mt-6">
          <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide uppercase">
            1 · Dados do ativo
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-zinc-600">Ativo:</dt>
              <dd>{chamado.ativos?.nome ?? "Ativo removido"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Localização:</dt>
              <dd>{chamado.ativos?.localizacao || "—"}</dd>
            </div>
          </dl>
        </section>

        {/* Solicitação */}
        <section className="mt-6">
          <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide uppercase">
            2 · Solicitação
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-zinc-600">Solicitante:</dt>
              <dd>{chamado.solicitante}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Data de abertura:</dt>
              <dd>{formatarDataHora(chamado.created_at)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-semibold text-zinc-600">Descrição:</p>
          <p className="mt-1 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm whitespace-pre-wrap print:bg-white">
            {chamado.descricao}
          </p>
        </section>

        {/* Triagem */}
        <section className="mt-6">
          <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide uppercase">
            3 · Triagem
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-zinc-600">Origem:</dt>
              <dd>{chamado.origem ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Tipo de O.S.:</dt>
              <dd>{chamado.os_tipo ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Categoria:</dt>
              <dd>{[chamado.categoria, chamado.subcategoria].filter(Boolean).join(" / ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Impacto / Criticidade:</dt>
              <dd>{[chamado.impacto, chamado.criticidade].filter(Boolean).join(" / ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Responsável / Equipe:</dt>
              <dd>{[chamado.responsavel, chamado.equipe].filter(Boolean).join(" · ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Prazo:</dt>
              <dd>{chamado.prazo ? formatarData(chamado.prazo) : "—"}</dd>
            </div>
          </dl>
          {osHist.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {osHist.map((h, i) => (
                <li key={i}>
                  {h.de ? `${h.de} → ` : ""}<strong>{h.para}</strong>
                  {h.motivo ? ` — ${h.motivo}` : ""} · {formatarDataHora(h.created_at)}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Planejamento */}
        {(chamado.planejamento || chamado.ferramentas || chamado.previsao_horas !== null || chamado.riscos) && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide uppercase">
              4 · Planejamento
            </h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {chamado.planejamento && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-zinc-600">Trabalho:</dt>
                  <dd className="whitespace-pre-wrap">{chamado.planejamento}</dd>
                </div>
              )}
              {chamado.ferramentas && (
                <div>
                  <dt className="font-semibold text-zinc-600">Ferramentas/recursos:</dt>
                  <dd className="whitespace-pre-wrap">{chamado.ferramentas}</dd>
                </div>
              )}
              {chamado.previsao_horas !== null && (
                <div>
                  <dt className="font-semibold text-zinc-600">Previsão:</dt>
                  <dd>{String(chamado.previsao_horas)} h</dd>
                </div>
              )}
              {chamado.riscos && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-zinc-600">Riscos:</dt>
                  <dd className="whitespace-pre-wrap">{chamado.riscos}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Fotos */}
        <FotosOS titulo="5 · Fotos — antes" fotos={fotosAntes} />
        <FotosOS titulo="6 · Fotos — durante" fotos={fotosDuranteUrls} />
        <FotosOS titulo="7 · Fotos — depois" fotos={fotosDepois} />

        {/* Custos */}
        <section className="mt-6 break-inside-avoid">
          <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide uppercase">
            8 · Peças, serviços e custos
          </h2>
          {compras.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              Nenhum material vinculado a este chamado.
            </p>
          ) : (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-zinc-900 text-left">
                  <th className="py-1.5 pr-2 font-bold">Item</th>
                  <th className="py-1.5 pr-2 font-bold">Qtd</th>
                  <th className="py-1.5 pr-2 font-bold">Valor unit.</th>
                  <th className="py-1.5 pr-2 font-bold">Total</th>
                  <th className="py-1.5 font-bold">Data</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-200">
                    <td className="py-1.5 pr-2">{c.item}</td>
                    <td className="py-1.5 pr-2">{String(c.quantidade)}</td>
                    <td className="py-1.5 pr-2">
                      {formatarMoeda(Number(c.valor_unitario))}
                    </td>
                    <td className="py-1.5 pr-2">
                      {formatarMoeda(Number(c.valor_total))}
                    </td>
                    <td className="py-1.5">{formatarData(c.data_compra)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="py-1.5 pr-2 text-right text-zinc-600">Materiais</td>
                  <td colSpan={2} className="py-1.5">{formatarMoeda(totalMateriais)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-1.5 pr-2 text-right text-zinc-600">
                    Terceiros ({servicos.length} serviço(s))
                  </td>
                  <td colSpan={2} className="py-1.5">{formatarMoeda(totalTerceiros)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-1.5 pr-2 text-right text-zinc-600">Mão de obra</td>
                  <td colSpan={2} className="py-1.5">{formatarMoeda(Number(chamado.custo_mao_obra ?? 0))}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-1.5 pr-2 text-right text-zinc-600">
                    Outros{chamado.custo_outros_desc ? ` (${chamado.custo_outros_desc})` : ""}
                  </td>
                  <td colSpan={2} className="py-1.5">{formatarMoeda(Number(chamado.custo_outros ?? 0))}</td>
                </tr>
                <tr className="font-black">
                  <td colSpan={3} className="py-2 pr-2 text-right uppercase">
                    Total geral
                  </td>
                  <td colSpan={2} className="py-2">
                    {formatarMoeda(totalCustos)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        {/* Execução e conclusão */}
        <section className="mt-6 break-inside-avoid">
          <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide uppercase">
            9 · Execução e conclusão
          </h2>
          {(chamado.diagnostico || chamado.causa || chamado.causa_raiz || chamado.solucao) && (
            <dl className="mt-3 grid gap-2 text-sm">
              {chamado.diagnostico && (
                <div>
                  <dt className="font-semibold text-zinc-600">Diagnóstico:</dt>
                  <dd className="whitespace-pre-wrap">{chamado.diagnostico}</dd>
                </div>
              )}
              {chamado.causa && (
                <div>
                  <dt className="font-semibold text-zinc-600">Causa:</dt>
                  <dd className="whitespace-pre-wrap">{chamado.causa}</dd>
                </div>
              )}
              {chamado.causa_raiz && (
                <div>
                  <dt className="font-semibold text-zinc-600">Causa raiz:</dt>
                  <dd className="whitespace-pre-wrap">{chamado.causa_raiz}</dd>
                </div>
              )}
              {chamado.solucao && (
                <div>
                  <dt className="font-semibold text-zinc-600">Solução:</dt>
                  <dd className="whitespace-pre-wrap">{chamado.solucao}</dd>
                </div>
              )}
            </dl>
          )}
          {atividades.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-zinc-600">Atividades:</p>
              <ul className="mt-1 space-y-1 text-sm">
                {atividades.map((a, i) => (
                  <li key={i}>
                    {formatarDataHora(a.created_at)} — {a.descricao}
                    {a.executado_por ? ` (${a.executado_por})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {execs.length > 0 && (
            <p className="mt-3 text-sm">
              <span className="font-semibold text-zinc-600">Checklists: </span>
              {execs.length} execução(ões) —{" "}
              {execs.map((e) => e.resultado ?? "?").join(", ")}
            </p>
          )}
          {(chamado.horimetro_ini !== null || chamado.horimetro_fim !== null) && (
            <p className="mt-2 text-sm">
              <span className="font-semibold text-zinc-600">Contador: </span>
              {chamado.horimetro_ini !== null ? String(chamado.horimetro_ini) : "—"}
              {" → "}
              {chamado.horimetro_fim !== null ? String(chamado.horimetro_fim) : "—"}
              {chamado.horimetro_unidade ? ` ${chamado.horimetro_unidade}` : ""}
            </p>
          )}
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-zinc-600">Status atual:</dt>
              <dd>{ROTULO_STATUS[chamado.status] ?? chamado.status}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Impacto operacional:</dt>
              <dd>{chamado.impacto ? (ROTULO_IMPACTO[chamado.impacto] ?? chamado.impacto) : "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">O.S.:</dt>
              <dd>{[chamado.os_tipo, chamado.os_status].filter(Boolean).join(" · ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Data de conclusão:</dt>
              <dd>
                {chamado.concluido_em
                  ? formatarDataHora(chamado.concluido_em)
                  : "Pendente"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-600">Tempo decorrido:</dt>
              <dd>
                {formatarDuracao(chamado.created_at, chamado.concluido_em)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Assinaturas */}
        <section className="mt-10 break-inside-avoid">
          <h2 className="border-b-2 border-zinc-900 pb-1 text-sm font-bold tracking-wide uppercase">
            10 · Responsáveis
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div className="text-center">
              <div className="border-t-2 border-zinc-900 pt-2">
                <p className="text-sm font-bold">Responsável pela Manutenção</p>
                <p className="mt-4 text-xs text-zinc-500">
                  Nome: ___________________________ Data: ____/____/________
                </p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-zinc-900 pt-2">
                <p className="text-sm font-bold">Supervisão</p>
                <p className="mt-4 text-xs text-zinc-500">
                  Nome: ___________________________ Data: ____/____/________
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-zinc-300 pt-2 text-center text-[11px] text-zinc-500">
          OS Nº {os} · Chamado {chamado.id} · Documento gerado pelo SGA-M em{" "}
          {formatarData(emissao.toISOString())}
        </footer>
      </article>
    </div>
  );
}
