import Link from "next/link";
import { formatarMoeda, formatarDuracaoMedia } from "@/lib/format";
import type { ContextoOrg } from "@/lib/org";

function Card({ titulo, valor, sub, href, estado }: { titulo: string; valor: React.ReactNode; sub?: React.ReactNode; href?: string; estado?: string }) {
  const inner = (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <div className="mt-2">
        {estado === "insufficient_data" ? <p className="text-sm font-medium text-amber-700">Dados insuficientes</p> : estado === "empty" ? <p className="text-sm text-zinc-500">Nenhum dado</p> : <p className="text-2xl font-black tabular-nums">{valor}</p>}
      </div>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
  if (href) return <Link href={href} className="block transition hover:shadow-md">{inner}</Link>;
  return inner;
}

export function RoleDashboard({ role, data, periodo }: { role: ContextoOrg["role"]; data: Record<string, unknown>; periodo: string }) {
  const d = data as {
    totalAtivos: number; porStatus: Record<string, number>; criticos: number; disponibilidade: { value: number | null; state: string };
    osAbertas: number; backlogOS: number; backlogDemanda: number; sla: { dentro: number; proximo: number; atrasado: number; semPrazo: number; totalComPrazo: number; taxaDentro: number | null };
    mttr: { value: number | null; state: string }; texec: { value: number | null; state: string }; mtbf: { value: number | null; state: string };
    estoque: { disponivel: number; criticos: number; abaixoReposicao: number; valorFisico: number; total: number };
    solicitacoes: number; topOS: [string, number][]; topCusto: [string, number][]; topReinc: [string, number][]; consumo: { porQuantidade: [string, number][]; porValor: [string, number][] }; custoTotal: number;
    // role-specific
    minhasOS: number; osAtrasadas: number; osConcluidas: number; meusChamados: number; minhasSolicitacoes: number;
  };

  const isAdmin = role === "ADMIN";
  const isGestor = role === "GESTOR";
  const isTecnico = role === "TECNICO";
  const isCompras = role === "COMPRAS";
  const isAuditor = role === "AUDITOR";
  const isSolicitante = role === "SOLICITANTE";

  // ADMIN: Visão Geral (todos KPIs)
  if (isAdmin) {
    return (
      <>
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">Visão Geral — Administração</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card titulo="Total de ativos" valor={d.totalAtivos} href="/admin/ativos" />
            <Card titulo="Ativos críticos" valor={d.criticos} href="/admin/ativos?critico=1" />
            <Card titulo="O.S. abertas" valor={d.osAbertas} href="/admin/chamados?os_status=aberta" sub={`Backlog: ${d.backlogOS}`} />
            <Card titulo="Solicitações pendentes" valor={d.solicitacoes} href="/admin/compras/solicitacoes" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card titulo="SLA dentro" valor={d.sla.taxaDentro !== null ? `${d.sla.taxaDentro.toFixed(1)}%` : "—"} sub={`Dentro ${d.sla.dentro} · Atrasado ${d.sla.atrasado}`} />
            <Card titulo="Custo total" valor={formatarMoeda(d.custoTotal)} href="/admin/relatorios?aba=custos" />
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">Recursos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card titulo="Estoque disponível" valor={d.estoque.disponivel} href="/admin/estoque" />
            <Card titulo="Valor físico" valor={formatarMoeda(d.estoque.valorFisico)} />
            <Card titulo="MTTR" valor={d.mttr.value !== null ? formatarDuracaoMedia(d.mttr.value) : "—"} estado={d.mttr.state} />
            <Card titulo="MTBF" valor={d.mtbf.value !== null ? formatarDuracaoMedia(d.mtbf.value) : "—"} estado={d.mtbf.state} />
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Desempenho — Visão Global</h3>
          <p className="text-sm text-zinc-500">Filtros por role, pessoa, equipe, período — em breve</p>
          <Link href="/admin/desempenho" className="text-sm font-bold underline">Ver desempenho</Link>
        </section>
      </>
    );
  }

  if (isGestor) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">Minha Gestão</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="O.S. abertas" valor={d.osAbertas} href="/admin/chamados?os_status=aberta" />
          <Card titulo="O.S. atrasadas" valor={d.sla.atrasado} href="/admin/chamados?os_status=aberta" sub="SLA atrasado" />
          <Card titulo="Backlog" valor={d.backlogOS} />
          <Card titulo="Solicitações pendentes" valor={d.solicitacoes} href="/admin/compras/solicitacoes" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card titulo="SLA" valor={d.sla.taxaDentro !== null ? `${d.sla.taxaDentro.toFixed(1)}%` : "—"} estado={d.sla.taxaDentro === null ? "insufficient_data" : "ok"} />
          <Card titulo="Preventivas" valor="—" estado="insufficient_data" sub="Sem dados suficientes" />
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Desempenho da Equipe</h3>
          <p className="text-sm text-zinc-500">Média da equipe: — (insufficient_data)</p>
          <Link href="/admin/desempenho" className="text-sm font-bold underline">Ver equipe</Link>
        </div>
      </section>
    );
  }

  if (isTecnico) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">Minha Operação</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Minhas O.S." valor={d.minhasOS ?? d.osAbertas} href="/admin/chamados?os_status=aberta" sub="Atribuídas" />
          <Card titulo="O.S. em execução" valor={d.osAbertas} />
          <Card titulo="O.S. atrasadas" valor={d.sla.atrasado} />
          <Card titulo="O.S. concluídas" valor={d.osConcluidas ?? 0} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card titulo="Tempo médio execução" valor={d.texec.value !== null ? formatarDuracaoMedia(d.texec.value) : "—"} estado={d.texec.state} />
          <Card titulo="Tempo médio resolução" valor={d.mttr.value !== null ? formatarDuracaoMedia(d.mttr.value) : "—"} estado={d.mttr.state} />
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Meu Desempenho</h3>
          <p className="text-sm text-zinc-500">Score: — (insufficient_data, mínimo 5 O.S.)</p>
          <p className="text-xs text-zinc-400">Métricas: produtividade, prazo, tempo, qualidade, eficiência — pesos 25/25/20/20/10</p>
          <Link href="/admin/desempenho" className="mt-2 inline-block text-sm font-bold text-zinc-900 underline">Ver detalhes</Link>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/chamados/novo" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Nova O.S.</Link>
          <Link href="/admin/ativos" className="rounded-xl border px-4 py-2 text-sm font-bold">Ver Ativos</Link>
        </div>
      </section>
    );
  }

  if (isCompras) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">Suprimentos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Solicitações pendentes" valor={d.solicitacoes} href="/admin/compras/solicitacoes" />
          <Card titulo="Pedidos em andamento" valor={d.osAbertas} href="/admin/compras" />
          <Card titulo="Estoque crítico" valor={d.estoque.criticos} href="/admin/estoque?filtro=criticos" />
          <Card titulo="Valor físico" valor={formatarMoeda(d.estoque.valorFisico)} />
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Meu Desempenho</h3>
          <p className="text-sm text-zinc-500">Prazo, pedidos, recebimentos — insufficient_data (mínimo 3 pedidos)</p>
          <Link href="/admin/desempenho" className="text-sm font-bold underline">Ver detalhes</Link>
        </div>
      </section>
    );
  }

  if (isAuditor) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">Conformidade</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Auditorias" valor="—" estado="insufficient_data" sub="Sem dados" href="/admin/auditoria" />
          <Card titulo="O.S. abertas (leitura)" valor={d.osAbertas} href="/admin/chamados?os_status=aberta" />
          <Card titulo="Solicitações" valor={d.solicitacoes} href="/admin/compras/solicitacoes" />
          <Card titulo="Estoque (leitura)" valor={d.estoque.disponivel} href="/admin/estoque" />
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Meu Desempenho</h3>
          <p className="text-sm text-zinc-500">Auditorias concluídas — insufficient_data</p>
          <Link href="/admin/desempenho" className="text-sm font-bold underline">Ver detalhes</Link>
        </div>
      </section>
    );
  }

  if (isSolicitante) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">Minhas Solicitações</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Meus chamados" valor={d.meusChamados ?? 0} href="/admin/chamados" />
          <Card titulo="Minhas solicitações" valor={d.minhasSolicitacoes ?? d.solicitacoes} href="/admin/compras/solicitacoes" />
          <Card titulo="O.S. relacionadas" valor={d.osAbertas} href="/admin/chamados?os_status=aberta" />
          <Card titulo="Notificações" valor="—" estado="insufficient_data" sub="Sem dados" href="/admin/notificacoes" />
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Meu Desempenho</h3>
          <p className="text-sm text-zinc-500">Qualidade das solicitações — insufficient_data</p>
          <Link href="/admin/desempenho" className="text-sm font-bold underline">Ver detalhes</Link>
        </div>
      </section>
    );
  }

  return null;
}
