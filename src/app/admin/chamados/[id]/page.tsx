import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Clock,
  FileText,
  MapPin,
  Package,
  SearchX,
  Settings2,
  User,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { pode } from "@/lib/permissoes";
import { resolverFoto } from "@/lib/storage";
import type {
  ChamadoComAtivo,
  Compra,
  OsAtividade,
  OsFoto,
  OsServicoExterno,
  OsStatusHistorico,
} from "@/lib/types";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import StatusBadge, { OsStatusBadge } from "@/app/admin/_components/StatusBadge";
import GaleriaFotos from "@/app/admin/_components/GaleriaFotos";
import TriagemForm from "./TriagemForm";
import OsWorkflowControl from "./OsWorkflowControl";
import PlanejamentoForm from "./PlanejamentoForm";
import FotosDepoisUpload from "./FotosDepoisUpload";
import FotosDurante from "./FotosDurante";
import ComprasDoChamado from "./ComprasDoChamado";
import ExecucaoForm from "./ExecucaoForm";
import ConsumoEstoque from "./ConsumoEstoque";
import ExecucaoChecklist, { type ModeloExec, type ExecucaoPassada } from "./ExecucaoChecklist";
import AtividadesList from "./AtividadesList";
import ServicosList from "./ServicosList";
import CustosForm from "./CustosForm";
import TimelineOS, { type EventoOS } from "./TimelineOS";

export const metadata: Metadata = {
  title: "Detalhe do chamado · SGA-M",
};

interface ChamadoPageProps {
  params: Promise<{ id: string }>;
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-3d rounded-3xl border border-zinc-200/70 p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 text-base font-black text-zinc-900">
        <span className="icon-3d flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
          {icone}
        </span>
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** SLA a partir do prazo: no prazo / próximo (≤2d) / atrasado. */
function sla(hoje: string, prazo: string | null, fim: string | null): string | null {
  if (!prazo) return null;
  const ref = (fim ?? hoje).slice(0, 10);
  if (ref <= prazo) {
    const dias = Math.round((+new Date(prazo) - +new Date(ref)) / 86400000);
    return dias <= 2 ? "Próximo do vencimento" : "No prazo";
  }
  return "Atrasado";
}

export default async function ChamadoPage({ params }: ChamadoPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await requireOrg();

  const podeTriagem = pode(ctx, "chamados.triagem");
  const podeExecutar = pode(ctx, "os.executar");
  const podePlanejar = pode(ctx, "os.planejar");
  const podeConcluir = pode(ctx, "os.concluir");
  const podeEncerrar = pode(ctx, "os.encerrar");
  const podeAprovar = pode(ctx, "os.aprovar");

const [
  { data: chamadoData },
  { data: comprasData },
  { data: consumoData },
  { data: produtosData },
  { data: modelosData },
  { data: logsData },
  { data: osHistData },
  { data: ativData },
  { data: servData },
  { data: fotosData },
  { data: execsData },
  { data: fornsData },
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
    .eq("chamado_id", id)
    .eq("organization_id", ctx.orgId)
    .order("data_compra", { ascending: true }),
  supabase
    .from("movimentacoes_estoque")
    .select("*, produtos(id, codigo, descricao, unidade, custo_medio)")
    .eq("chamado_id", id)
    .eq("organization_id", ctx.orgId)
    .eq("tipo", "consumo")
    .order("created_at", { ascending: true }),
    supabase
      .from("movimentacoes_estoque")
      .select("*, produtos(id, codigo, descricao, unidade, custo_medio)")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .eq("tipo", "consumo")
      .order("created_at", { ascending: true }),
    supabase
      .from("produtos")
      .select("id, codigo, descricao, estoque_atual, estoque_reservado")
      .eq("organization_id", ctx.orgId)
      .eq("ativo", true)
      .order("codigo", { ascending: true }),
    supabase
      .from("checklist_modelos")
      .select("id, titulo, ativo_id, checklist_itens(id, texto, tipo, obrigatorio, foto_obrigatoria, obs_obrigatoria, opcoes, ordem)")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("auditoria_logs")
      .select("acao, dados_anteriores, dados_novos, executado_por, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("registro_id", id)
      .eq("tabela", "chamados")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("os_status_historico")
      .select("*")
      .eq("os_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("os_atividades")
      .select("*")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("os_servicos_externos")
      .select("*, fornecedores(nome)")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("os_fotos")
      .select("*")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("checklist_execucoes")
      .select("id, resultado, created_at, executado_por")
      .eq("chamado_id", id)
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .order("nome"),
  ]);

  const chamado = (chamadoData ?? null) as ChamadoComAtivo | null;
  const compras = ((comprasData ?? []) as Compra[]).slice().sort(
    (a, b) => +new Date(a.data_compra) - +new Date(b.data_compra),
  );

  if (!chamado) {
    return (
      <div className="card-3d mx-auto max-w-2xl rounded-3xl border border-zinc-200/70 p-8 text-center">
        <SearchX className="mx-auto size-12 text-zinc-400" />
        <h1 className="mt-3 text-lg font-black text-zinc-900">
          Chamado não encontrado
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          O chamado pode ter sido excluído ou o link está incorreto.
        </p>
        <Link
          href="/admin/dashboard"
          className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white shadow-lg transition hover:bg-zinc-700"
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
  const fotosOs = (fotosData ?? []) as OsFoto[];
  const fotosDurante = fotosOs.filter((f) => f.categoria === "durante").map((f) => f.path);
  const duranteUrls = await Promise.all(
    fotosDurante.map((p) => resolverFoto(p, ctx.orgId)),
  );

  const produtos = ((produtosData ?? []) as {
    id: string;
    codigo: string;
    descricao: string;
    estoque_atual: number;
    estoque_reservado: number;
  }[]).map((p) => {
    const fisico = Number(p.estoque_atual ?? 0);
    const reservado = Number(p.estoque_reservado ?? 0);
    return {
      id: p.id,
      codigo: p.codigo,
      descricao: p.descricao,
      saldo: fisico - reservado,
      fisico,
      reservado,
    };
  });

  const modelos = ((modelosData ?? []) as {
    id: string;
    titulo: string;
    ativo_id: string | null;
    checklist_itens: {
      id: string; texto: string; tipo: string; obrigatorio: boolean;
      foto_obrigatoria: boolean; obs_obrigatoria: boolean; opcoes: string[]; ordem: number;
    }[];
  }[])
    .filter((m) => !m.ativo_id || m.ativo_id === chamado.ativo_id)
    .map((m): ModeloExec => ({
      id: m.id,
      titulo: m.titulo,
      itens: [...m.checklist_itens]
        .sort((a, b) => a.ordem - b.ordem)
        .map((i) => ({
          id: i.id,
          texto: i.texto,
          obrigatorio: i.obrigatorio,
          tipo: (i.tipo ?? "ok_nok") as ModeloExec["itens"][number]["tipo"],
          foto_obrigatoria: i.foto_obrigatoria ?? false,
          obs_obrigatoria: i.obs_obrigatoria ?? false,
          opcoes: (i.opcoes ?? []) as string[],
        })),
    }));
  const passadas = (execsData ?? []) as ExecucaoPassada[];

  const osHist = (osHistData ?? []) as OsStatusHistorico[];
  const atividades = (ativData ?? []) as OsAtividade[];
const servicos = ((servData ?? []) as (OsServicoExterno & { fornecedores: { nome: string } | null })[]).map(
  (s) => ({ ...s, fornecedor_nome: s.fornecedores?.nome ?? null }),
);
const totalServicos = servicos.reduce((s, x) => s + Number(x.valor ?? 0), 0);

// Materiais consumidos = Σ(consumo.quantidade × custo_unitário)
const consumos = ((consumoData ?? []) as {
  id: string;
  quantidade: number;
  custo_unitario: number;
  created_at: string;
  executado_por: string | null;
  produtos: { id: string; codigo: string; descricao: string; unidade: string | null; custo_medio: number | null } | null;
}[]);
const totalMateriais = consumos.reduce(
  (s, c) => s + Number(c.quantidade) * Number(c.custo_unitario ?? 0),
  0,
);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const slaRotulo = sla(hojeISO, chamado.prazo, chamado.concluido_em);

  // Timeline unificada: abertura, auditoria, O.S., atividades, insumos, fotos, conclusão.
  const eventos: EventoOS[] = [
    {
      quando: chamado.created_at,
      titulo: "Chamado aberto",
      detalhe: `por ${chamado.solicitante}${chamado.origem ? ` · via ${chamado.origem}` : ""}`,
    },
    ...((logsData ?? []) as {
      acao: string;
      dados_anteriores: { status?: string } | null;
      dados_novos: { status?: string; os_status?: string } | null;
      executado_por: string;
      created_at: string;
    }[]).flatMap((l): EventoOS[] => {
      const antes = l.dados_anteriores?.status;
      const depois = l.dados_novos?.status;
      if (l.acao === "TRIAGEM") {
        return [{ quando: l.created_at, titulo: "Triagem", detalhe: `por ${l.executado_por}` }];
      }
      // Transições da O.S. já aparecem via os_status_historico — sem duplicar.
      if (l.acao === "STATUS_CHANGE" && l.dados_novos && "os_status" in l.dados_novos) {
        return [];
      }
      if ((l.acao === "STATUS_CHANGE" || l.acao === "UPDATE") && depois && depois !== antes) {
        return [{
          quando: l.created_at,
          titulo: antes ? `Status: ${antes} → ${depois}` : "Chamado atualizado",
          detalhe: `por ${l.executado_por}`,
        }];
      }
      if (l.acao === "OS_CONCLUIDA") {
        return [{ quando: l.created_at, titulo: "O.S. concluída/encerrada", detalhe: `por ${l.executado_por}` }];
      }
      if (l.acao === "CHECKLIST_CONCLUIDA") {
        return [{ quando: l.created_at, titulo: "Checklist executado", detalhe: `por ${l.executado_por}` }];
      }
      return [];
    }),
    ...osHist.map((h): EventoOS => ({
      quando: h.created_at,
      titulo: h.de ? `O.S.: ${h.de} → ${h.para}` : `O.S. ${h.para}`,
      detalhe: h.motivo ?? undefined,
    })),
    ...atividades.slice().reverse().map((a): EventoOS => ({
      quando: a.created_at,
      titulo: a.descricao,
      detalhe: a.executado_por ?? undefined,
    })),
    ...consumos.map((c): EventoOS => ({
      quando: c.created_at,
      titulo: `Material: ${c.produtos?.descricao ?? "item"}`,
      detalhe: `${String(c.quantidade)} ${c.produtos?.unidade ?? "un"} · ${formatarMoeda(Number(c.custo_unitario ?? 0) * c.quantidade)}`,
    })),
    ...servicos.map((s): EventoOS => ({
      quando: s.created_at,
      titulo: `Terceiro: ${s.servico}`,
      detalhe: formatarMoeda(Number(s.valor ?? 0)),
    })),
    ...(chamado.concluido_em
      ? [{ quando: chamado.concluido_em, titulo: "Serviço concluído" } as EventoOS]
      : []),
  ];

  const ehOS = !!chamado.os_status;

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/dashboard"
          className="inline-flex min-h-[40px] w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        {ehOS && (
          <Link
            href={`/admin/chamados/${chamado.id}/os`}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-950 px-5 text-sm font-bold text-white shadow-xl transition hover:brightness-125"
          >
            <FileText className="size-4" />
            Ordem de Serviço Imprimível
          </Link>
        )}
      </div>

      {/* Hero do chamado */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 text-white shadow-2xl sm:p-7">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-20 -right-20 size-64 rounded-full blur-3xl",
            (chamado.status === "concluido" || chamado.status === "resolvido") && "bg-emerald-500/20",
            (chamado.status === "em_andamento" || chamado.status === "convertido_os") && "bg-sky-500/20",
            (chamado.status === "aberto" || chamado.status === "em_triagem") && "bg-amber-500/20",
          )}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="icon-3d flex size-13 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Wrench className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">
              {chamado.ativos?.nome ?? "Ativo removido"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" />
                {chamado.solicitante}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatarDataHora(chamado.created_at)}
              </span>
              {slaRotulo && (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-black",
                  slaRotulo === "Atrasado" && "bg-red-500/20 text-red-300",
                  slaRotulo === "Próximo do vencimento" && "bg-amber-500/20 text-amber-300",
                  slaRotulo === "No prazo" && "bg-emerald-500/20 text-emerald-300",
                )}>
                  SLA: {slaRotulo}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={chamado.status} />
            {chamado.os_status && <OsStatusBadge status={chamado.os_status} />}
          </div>
        </div>
      </section>

      {/* Informações principais */}
      <Secao
        icone={<Settings2 className="size-4" />}
        titulo="Informações da solicitação"
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                Localização
              </dt>
              <dd className="font-semibold text-zinc-900">
                {chamado.ativos?.localizacao || "—"}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <User className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                Solicitante{chamado.contato ? ` · ${chamado.contato}` : ""}
              </dt>
              <dd className="font-semibold text-zinc-900">{chamado.solicitante}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                Abertura{chamado.origem ? ` · via ${chamado.origem}` : ""}
              </dt>
              <dd className="font-semibold text-zinc-900">
                {formatarDataHora(chamado.created_at)}
              </dd>
            </div>
          </div>
          {(chamado.departamento || chamado.categoria) && (
            <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
              <FileText className="mt-0.5 size-4 shrink-0 text-zinc-400" />
              <div>
                <dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                  Classificação
                </dt>
                <dd className="font-semibold text-zinc-900">
                  {[chamado.departamento, chamado.categoria, chamado.subcategoria].filter(Boolean).join(" · ")}
                </dd>
              </div>
            </div>
          )}
          {chamado.concluido_em && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200/70">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <dt className="text-xs font-bold tracking-wide text-emerald-700 uppercase">
                  Conclusão
                </dt>
                <dd className="font-semibold text-zinc-900">
                  {formatarDataHora(chamado.concluido_em)}
                </dd>
              </div>
            </div>
          )}
        </dl>
        <div className="mt-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
          <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
            Descrição do problema
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-800">
            {chamado.descricao}
          </p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">
            Fotos do problema (antes)
          </p>
          <GaleriaFotos
            fotos={fotosAntes}
            legenda="Antes"
            vazio="Nenhuma foto do problema enviada."
            orgId={ctx.orgId}
          />
        </div>
      </Secao>

      {/* Triagem / demanda */}
      {!ehOS && (
        <Secao
          icone={<ClipboardCheck className="size-4" />}
          titulo="Triagem"
        >
          {podeTriagem ? (
            <TriagemForm
              chamadoId={chamado.id}
              statusAtual={chamado.status}
              atual={{
                prioridade: chamado.prioridade,
                impacto: chamado.impacto,
                criticidade: chamado.criticidade,
                categoria: chamado.categoria,
                subcategoria: chamado.subcategoria,
                departamento: chamado.departamento,
                responsavel: chamado.responsavel,
                equipe: chamado.equipe,
                prazo: chamado.prazo,
              }}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Aguardando triagem pela gestão. Status atual: <strong>{chamado.status}</strong>.
            </p>
          )}
        </Secao>
      )}

      {/* Workflow da O.S. */}
      {ehOS && chamado.os_status && (
        <Secao
          icone={<Settings2 className="size-4" />}
          titulo={`O.S. ${chamado.os_tipo ?? ""} · workflow`}
        >
          <OsWorkflowControl
            chamadoId={chamado.id}
            osAtual={chamado.os_status}
            podeConcluir={podeConcluir}
            podeEncerrar={podeEncerrar}
          />
        </Secao>
      )}

      {/* Planejamento */}
      {ehOS && (
        <Secao
          icone={<ClipboardCheck className="size-4" />}
          titulo="Planejamento"
        >
          {podePlanejar ? (
            <PlanejamentoForm
              chamadoId={chamado.id}
              atual={{
                planejamento: chamado.planejamento,
                ferramentas: chamado.ferramentas,
                previsao_horas: chamado.previsao_horas,
                riscos: chamado.riscos,
                responsavel: chamado.responsavel,
                equipe: chamado.equipe,
                supervisor: chamado.supervisor,
                prazo: chamado.prazo,
                prioridade: chamado.prioridade,
              }}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Responsável</dt><dd className="font-semibold">{chamado.responsavel ?? "—"}{chamado.equipe ? ` · ${chamado.equipe}` : ""}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Previsão</dt><dd className="font-semibold">{chamado.previsao_horas !== null ? `${String(chamado.previsao_horas)} h` : "—"}</dd></div>
            </dl>
          )}
        </Secao>
      )}

      {/* Execução da O.S. */}
      <Secao
        icone={<Wrench className="size-4" />}
        titulo="Execução"
      >
        {podeExecutar ? (
          <ExecucaoForm
            chamadoId={chamado.id}
            descricaoProblema={chamado.descricao}
            atual={{
              responsavel: chamado.responsavel,
              prioridade: chamado.prioridade,
              prazo: chamado.prazo,
              diagnostico: chamado.diagnostico,
              causa: chamado.causa,
              causa_raiz: chamado.causa_raiz,
              solucao: chamado.solucao,
              equipe: chamado.equipe,
              supervisor: chamado.supervisor,
              horimetro: chamado.horimetro,
              horimetro_ini: chamado.horimetro_ini,
              horimetro_fim: chamado.horimetro_fim,
              horimetro_unidade: chamado.horimetro_unidade,
            }}
          />
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Diagnóstico</dt><dd>{chamado.diagnostico ?? "—"}</dd></div>
            <div><dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Solução</dt><dd>{chamado.solucao ?? "—"}</dd></div>
          </dl>
        )}
      </Secao>

      {/* Atividades */}
      {ehOS && (
        <Secao
          icone={<Clock className="size-4" />}
          titulo="Atividades"
        >
          {podeExecutar ? (
            <AtividadesList
              chamadoId={chamado.id}
              iniciais={atividades.map((a) => ({
                id: a.id,
                descricao: a.descricao,
                executado_por: a.executado_por,
                created_at: a.created_at,
              }))}
            />
          ) : (
            <p className="text-sm text-zinc-500">{atividades.length} atividade(s) registrada(s).</p>
          )}
        </Secao>
      )}

      {/* Linha do tempo */}
      <Secao
        icone={<Clock className="size-4" />}
        titulo="Linha do tempo"
      >
        <TimelineOS eventos={eventos} />
      </Secao>

      {/* Fotos */}
      <Secao
        icone={<Camera className="size-4" />}
        titulo="Fotos (antes / durante / depois)"
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">Durante</p>
            {podeExecutar ? (
              <FotosDurante chamadoId={chamado.id} paths={fotosDurante} orgId={ctx.orgId} />
            ) : (
              <GaleriaFotos
                fotos={fotosDurante}
                legenda="Durante"
                vazio="Nenhuma foto do durante ainda."
                orgId={ctx.orgId}
              />
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">Depois</p>
            <GaleriaFotos
              fotos={fotosDepois}
              legenda="Depois"
              vazio="Nenhuma foto de conclusão enviada ainda."
              orgId={ctx.orgId}
            />
            {podeExecutar && <FotosDepoisUpload chamadoId={chamado.id} />}
          </div>
          {duranteUrls.some((u) => u === "") && (
            <p className="text-xs text-zinc-400">Algumas fotos do durante não puderam ser resolvidas.</p>
          )}
        </div>
      </Secao>

      {/* Checklist */}
      <Secao
        icone={<ClipboardCheck className="size-4" />}
        titulo="Checklist de execução"
      >
        <ExecucaoChecklist chamadoId={chamado.id} modelos={modelos} passadas={passadas} />
      </Secao>

      {/* Insumos, serviços e custos */}
      <Secao
        icone={<Package className="size-4" />}
        titulo="Materiais, terceiros e custos"
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">
              Baixa do estoque
            </p>
            <ConsumoEstoque chamadoId={chamado.id} produtos={produtos} />
          </div>
          {/* Materiais consumidos */}
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">
              Materiais consumidos
            </p>
            {consumos.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum consumo registrado.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-zinc-200">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                      <th className="px-4 py-2.5 font-semibold">Produto</th>
                      <th className="px-4 py-2.5 font-semibold">Código</th>
                      <th className="px-4 py-2.5 font-semibold">Qtd</th>
                      <th className="px-4 py-2.5 font-semibold">Unid.</th>
                      <th className="px-4 py-2.5 font-semibold">Custo un.</th>
                      <th className="px-4 py-2.5 font-semibold">Total</th>
                      <th className="px-4 py-2.5 font-semibold">Responsável</th>
                      <th className="px-4 py-2.5 font-semibold">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {consumos.map((c) => (
                      <tr key={c.id} className="text-zinc-800">
                        <td className="px-4 py-2.5 font-medium">{c.produtos?.descricao ?? "—"}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{c.produtos?.codigo ?? "—"}</td>
                        <td className="px-4 py-2.5">{String(c.quantidade)}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{c.produtos?.unidade ?? "un"}</td>
                        <td className="px-4 py-2.5">{formatarMoeda(Number(c.custo_unitario ?? 0))}</td>
                        <td className="px-4 py-2.5 font-semibold">{formatarMoeda(Number(c.custo_unitario ?? 0) * c.quantidade)}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{c.executado_por ?? "—"}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{formatarDataHora(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-50 font-bold text-zinc-900">
                      <td colSpan={5} className="px-4 py-2.5">Total consumido</td>
                      <td colSpan={3} className="px-4 py-2.5">{formatarMoeda(totalMateriais)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          <ComprasDoChamado chamadoId={chamado.id} iniciais={compras} />
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">
              Serviços externos
            </p>
            <ServicosList
              chamadoId={chamado.id}
              iniciais={servicos}
              fornecedores={(fornsData ?? []) as { id: string; nome: string }[]}
              podeExcluir={podeAprovar}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">
              Custo total da O.S.
            </p>
            {podeAprovar ? (
              <CustosForm
                chamadoId={chamado.id}
                totalMateriais={totalMateriais}
                totalTerceiros={totalServicos}
                atual={{
                  custo_mao_obra: Number(chamado.custo_mao_obra ?? 0),
                  custo_outros: Number(chamado.custo_outros ?? 0),
                  custo_outros_desc: chamado.custo_outros_desc,
                }}
              />
            ) : (
              <p className="text-sm font-black">
                {formatarMoeda(totalMateriais + totalServicos + Number(chamado.custo_mao_obra ?? 0) + Number(chamado.custo_outros ?? 0))}
              </p>
            )}
          </div>
        </div>
      </Secao>
    </div>
  );
}
