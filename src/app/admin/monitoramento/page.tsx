import { createClient } from "@/lib/supabase/server";
import { exigirPermissao } from "@/lib/permissoes";
import { requireOrg } from "@/lib/org";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Monitoramento · SGA-M" };

async function checkDb() {
  const supabase = await createClient();
  const start = Date.now();
  const { error } = await supabase.from("organizations").select("id").limit(1);
  const latency = Date.now() - start;
  return { status: error ? "Indisponível" : "Online", latency, error: error?.message };
}

async function checkStorage() {
  const supabase = await createClient();
  const start = Date.now();
  const { data, error } = await supabase.storage.from("manutencao-midia").list("", { limit: 1 });
  const latency = Date.now() - start;
  return { status: error ? "Degradado" : "Online", latency, error: error?.message, count: data?.length ?? 0 };
}

export default async function MonitoramentoPage() {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "monitoramento.ver");
  const checkAuth = async () => {
    const supabase = await createClient();
    // eslint-disable-next-line react-hooks/purity
    const start = Date.now();
    const { error } = await supabase.auth.getUser();
    // eslint-disable-next-line react-hooks/purity
    return { status: error ? "Degradado" : "Online", latency: Date.now() - start, error: error?.message };
  };
  const [db, storage, auth] = await Promise.all([
    checkDb(),
    checkStorage(),
    checkAuth(),
  ]);

  const utilizacao = await (async () => {
    const supabase = await createClient();
    const [{ count: ativos }, { count: chamados }, { count: movs }, { count: usuarios }] = await Promise.all([
      supabase.from("ativos").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId),
      supabase.from("chamados").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId),
      supabase.from("movimentacoes_estoque").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId),
    ]);
    return { ativos: ativos ?? 0, chamados: chamados ?? 0, movimentacoes: movs ?? 0, usuarios: usuarios ?? 0 };
  })();

  const checks = [
    { nome: "Aplicação", status: "Online", latency: 0, desc: "Next.js Server" },
    { nome: "Banco de dados", status: db.status, latency: db.latency, desc: db.error ?? "Postgres via Supabase" },
    { nome: "Autenticação", status: auth.status, latency: auth.latency, desc: "Supabase Auth" },
    { nome: "Storage", status: storage.status, latency: storage.latency, desc: storage.error ?? `Bucket manutencao-midia (${storage.count} itens)` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader titulo="Monitoramento" descricao={`${ctx.orgNome} · saúde da plataforma`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {checks.map((c) => (
          <div key={c.nome} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{c.nome}</p>
            <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-black ${c.status === "Online" ? "bg-emerald-100 text-emerald-800" : c.status === "Degradado" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
              {c.status}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{c.desc} · {c.latency} ms · {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black">Utilização (contagem real)</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs text-zinc-500">Usuários</p><p className="text-xl font-black">{utilizacao.usuarios}</p></div>
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs text-zinc-500">Ativos</p><p className="text-xl font-black">{utilizacao.ativos}</p></div>
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs text-zinc-500">O.S./Chamados</p><p className="text-xl font-black">{utilizacao.chamados}</p></div>
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs text-zinc-500">Movimentações</p><p className="text-xl font-black">{utilizacao.movimentacoes}</p></div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Fluxo: Usuário → Aplicação → Server Actions → Supabase → Banco → RLS → Auditoria</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black">Status de Integração</h3>
        <div className="mt-2 space-y-1 text-sm">
          <p>Ativo → Localização: {utilizacao.ativos > 0 ? "OK" : "Sem dados"}</p>
          <p>Ativo → Chamado: {utilizacao.chamados > 0 ? "OK" : "Sem chamados"}</p>
          <p>Chamado → O.S.: {utilizacao.chamados > 0 ? "OK" : "Sem O.S."}</p>
          <p>O.S. → Estoque (consumo): {utilizacao.movimentacoes > 0 ? "OK" : "Sem consumo"}</p>
          <p>Tudo → Auditoria: ver /admin/auditoria</p>
        </div>
      </div>
    </div>
  );
}
