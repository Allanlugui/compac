import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import { formatarDataHora, formatarMoeda } from "@/lib/format";

export const metadata = { title: "Ordens de Serviço · SGA-M" };

export default async function OrdensServicoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const termo = (q ?? "").trim().toLowerCase();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "os.ver");

  const supabase = await createClient();
  let query = supabase
    .from("chamados")
    .select("id, solicitante, descricao, status, os_status, os_tipo, prioridade, created_at, prazo, custo_mao_obra, custo_outros, ativo_id, ativos(nome)")
    .eq("organization_id", ctx.orgId)
    .not("os_status", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (status) query = query.eq("os_status", status);

  const { data } = await query;
  let os = (data ?? []) as unknown as {
    id: string;
    solicitante: string;
    descricao: string;
    status: string;
    os_status: string;
    os_tipo: string | null;
    prioridade: string | null;
    created_at: string;
    prazo: string | null;
    custo_mao_obra: number;
    custo_outros: number;
    ativos: { nome: string } | null;
  }[];

  if (termo) {
    os = os.filter((o) => o.solicitante.toLowerCase().includes(termo) || o.descricao.toLowerCase().includes(termo) || (o.ativos?.nome ?? "").toLowerCase().includes(termo));
  }

  return (
    <div className="space-y-6">
      <PageHeader titulo="Ordens de Serviço" descricao={`${ctx.orgNome} · ${os.length} O.S. em exibição`} />

      <form method="get" className="flex gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar O.S., ativo, solicitante…" className="flex-1 rounded-xl border px-3 py-2 text-sm" />
        <select name="status" defaultValue={status ?? ""} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">Todos os_status</option>
          <option value="aberta">Aberta</option>
          <option value="em_execucao">Em execução</option>
          <option value="aguardando_peca">Aguardando peça</option>
          <option value="concluida">Concluída</option>
          <option value="encerrada">Encerrada</option>
        </select>
        <button type="submit" className="rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white">Filtrar</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">O.S.</th>
                <th className="px-3 py-2">Ativo</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Criação</th>
                <th className="px-3 py-2">Custo</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {os.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-3 py-2">{o.ativos?.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{o.os_tipo ?? "—"}</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold">{o.os_status}</span></td>
                  <td className="px-3 py-2 text-xs">{o.prioridade ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{formatarDataHora(o.created_at)}</td>
                  <td className="px-3 py-2 text-xs">{formatarMoeda(Number(o.custo_mao_obra ?? 0) + Number(o.custo_outros ?? 0))}</td>
                  <td className="px-3 py-2 text-right"><Link href={`/admin/chamados/${o.id}`} className="text-xs font-bold hover:underline">Abrir →</Link></td>
                </tr>
              ))}
              {os.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">Nenhuma O.S. encontrada. Crie via triagem de chamados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
