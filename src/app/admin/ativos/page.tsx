import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao, pode } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import NovoAtivoForm from "./NovoAtivoForm";
import AtivosGrid, { type AtivoLista } from "./AtivosGrid";

export const metadata: Metadata = {
  title: "Ativos · SGA-M",
  description: "Cadastro de ativos e impressão de QR Codes.",
};

const STATUS_FILTRO = [
  "operacional",
  "em_manutencao",
  "parado",
  "em_instalacao",
  "em_inspecao",
  "inativo",
  "desativado",
] as const;

interface Props {
  searchParams: Promise<{ q?: string; status?: string; categoria?: string; localidade?: string }>;
}

export default async function AdminAtivosPage({ searchParams }: Props) {
  const { q, status, categoria, localidade } = await searchParams;
  const termo = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    exigirPermissao(ctx, "ativos.ver");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Ativos" descricao="Cadastro de ativos e QR Codes." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita à operação (ADMIN, GESTOR, TÉCNICO)</p>
        </div>
      </div>
    );
  }
  const podeCriar = pode(ctx, "ativos.criar");

  const [{ data: ativosData }, { data: cats }, { data: locs }] = await Promise.all([
    supabase
      .from("ativos")
      .select("id, nome, codigo, status, localizacao, qr_code_hash, created_at, categoria_id, localidade_id")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("categorias")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .eq("tipo", "ativo")
      .eq("ativa", true)
      .order("nome"),
    supabase
      .from("localidades")
      .select("id, nome, tipo")
      .eq("organization_id", ctx.orgId)
      .order("nome"),
  ]);

  const mapaCat = new Map(((cats ?? []) as { id: string; nome: string }[]).map((c) => [c.id, c.nome]));
  const mapaLoc = new Map(((locs ?? []) as { id: string; nome: string }[]).map((l) => [l.id, l.nome]));

  let ativos = ((ativosData ?? []) as (AtivoLista & { categoria_id: string | null; localidade_id: string | null })[]).map(
    (a) => ({
      ...a,
      categoria_nome: a.categoria_id ? (mapaCat.get(a.categoria_id) ?? null) : null,
      localidade_nome: a.localidade_id ? (mapaLoc.get(a.localidade_id) ?? null) : null,
    }),
  );

  if (status && (STATUS_FILTRO as readonly string[]).includes(status)) {
    ativos = ativos.filter((a) => a.status === status);
  }
  if (categoria) {
    ativos = ativos.filter((a) => (a as { categoria_id: string | null }).categoria_id === categoria);
  }
  if (localidade) {
    ativos = ativos.filter((a) => (a as { localidade_id: string | null }).localidade_id === localidade);
  }
  if (termo !== "") {
    ativos = ativos.filter(
      (a) =>
        a.nome.toLowerCase().includes(termo) ||
        (a.codigo ?? "").toLowerCase().includes(termo) ||
        (a.localizacao ?? "").toLowerCase().includes(termo),
    );
  }

  // Origem pública usada nos QR Codes. Se NEXT_PUBLIC_SITE_URL não estiver
  // definida, o grid usa a origem atual do navegador como fallback.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

  const campo =
    "min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          titulo="Ativos"
          descricao={`${ctx.orgNome} · ${ativos.length} em exibição · QR preservados.`}
        />
      </div>

      {podeCriar && (
        <NovoAtivoForm
          categorias={(cats ?? []) as { id: string; nome: string }[]}
          localidades={(locs ?? []) as { id: string; nome: string; tipo: string }[]}
        />
      )}

      <form method="get" className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5 print:hidden">
        <input name="q" defaultValue={q ?? ""} maxLength={60} placeholder="Buscar nome, código…" className={campo} />
        <select name="status" defaultValue={status ?? ""} className={campo}>
          <option value="">Todos os status</option>
          {STATUS_FILTRO.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select name="categoria" defaultValue={categoria ?? ""} className={campo}>
          <option value="">Todas as categorias</option>
          {((cats ?? []) as { id: string; nome: string }[]).map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select name="localidade" defaultValue={localidade ?? ""} className={campo}>
          <option value="">Todas as localidades</option>
          {((locs ?? []) as { id: string; nome: string }[]).map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700">
            Filtrar
          </button>
          <Link href="/admin/ativos" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-50">
            Limpar
          </Link>
        </div>
      </form>
      <AtivosGrid ativos={ativos} siteUrl={siteUrl} orgNome={ctx.orgNome} />
    </div>
  );
}
