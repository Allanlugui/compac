import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import { formatarDataHora } from "@/lib/format";

export const metadata: Metadata = { title: "Chamados · SGA-M" };

const STATUS_FILTRO = ["aberto", "em_triagem", "aguardando_informacao", "convertido_os", "resolvido", "cancelado"] as const;

export default async function ChamadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; origem?: string }>;
}) {
  const { q, status, origem } = await searchParams;
  const termo = (q ?? "").trim().toLowerCase();

  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "chamados.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Chamados" descricao="Central de demandas." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: chamadosData } = await supabase
    .from("chamados")
    .select("id, solicitante, descricao, status, origem, prioridade, created_at, ativo_id, ativos(nome)")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  let chamados = (chamadosData ?? []) as unknown as {
    id: string;
    solicitante: string;
    descricao: string;
    status: string;
    origem: string | null;
    prioridade: string | null;
    created_at: string;
    ativo_id: string;
    ativos: { nome: string } | null;
  }[];

  if (status && (STATUS_FILTRO as readonly string[]).includes(status)) {
    chamados = chamados.filter((c) => c.status === status);
  }
  if (origem) {
    chamados = chamados.filter((c) => c.origem === origem);
  }
  if (termo) {
    chamados = chamados.filter(
      (c) => c.solicitante.toLowerCase().includes(termo) || c.descricao.toLowerCase().includes(termo) || (c.ativos?.nome ?? "").toLowerCase().includes(termo),
    );
  }

  const campo = "min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Chamados"
        descricao={`${ctx.orgNome} · ${chamados.length} em exibição`}
        acoes={
          <Link href="/admin/chamados/novo" className="inline-flex min-h-[44px] items-center rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700">
            + Novo chamado
          </Link>
        }
      />

      <form method="get" className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar solicitante, descrição, ativo…" className={campo} />
        <select name="status" defaultValue={status ?? ""} className={campo}>
          <option value="">Todos status</option>
          {STATUS_FILTRO.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="origem" defaultValue={origem ?? ""} className={campo}>
          <option value="">Todas origens</option>
          <option value="qr">QR</option>
          <option value="portal">Portal</option>
          <option value="administrador">Interno</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white">Filtrar</button>
          <Link href="/admin/chamados" className="rounded-xl border px-4 py-2 text-sm font-bold">Limpar</Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Ativo</th>
                <th className="px-3 py-2">Solicitante</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {chamados.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono text-xs">#{c.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-3 py-2">{c.ativos?.nome ?? "—"}</td>
                  <td className="px-3 py-2">{c.solicitante}</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold">{c.status}</span></td>
                  <td className="px-3 py-2 text-xs">{c.origem === "qr" ? "QR" : c.origem === "portal" ? "Portal" : "Interno"}</td>
                  <td className="px-3 py-2 text-xs">{formatarDataHora(c.created_at)}</td>
                  <td className="px-3 py-2 text-right"><Link href={`/admin/chamados/${c.id}`} className="text-xs font-bold text-zinc-900 hover:underline">Abrir →</Link></td>
                </tr>
              ))}
              {chamados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">Nenhum chamado encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
