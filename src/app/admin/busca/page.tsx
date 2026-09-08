import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { buscarGlobal, type ResultadoBusca } from "@/app/admin/_actions/busca";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Busca · SGA-M" };

const GRUPOS: { tipo: ResultadoBusca["tipo"]; titulo: string }[] = [
  { tipo: "ativo", titulo: "Ativos" },
  { tipo: "chamado", titulo: "O.S. / Chamados" },
  { tipo: "produto", titulo: "Produtos" },
  { tipo: "fornecedor", titulo: "Fornecedores" },
  { tipo: "localidade", titulo: "Localidades" },
  { tipo: "solicitacao", titulo: "Solicitações" },
  { tipo: "compra", titulo: "Compras" },
];

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const termo = (q ?? "").trim().slice(0, 60);
  const ctx = await requireOrg();
  let resultados: ResultadoBusca[] = [];
  if (termo.length >= 2) {
    resultados = await buscarGlobal(termo);
  }

  // Agrupar
  const porTipo = new Map<string, ResultadoBusca[]>();
  for (const r of resultados) {
    const arr = porTipo.get(r.tipo) ?? [];
    arr.push(r);
    porTipo.set(r.tipo, arr);
  }

  return (
    <div className="space-y-6">
      <PageHeader titulo="Busca Global" descricao={`${ctx.orgNome} · buscar ativos, O.S., produtos, fornecedores, localidades`} />
      <form action="/admin/busca" method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={termo}
          placeholder="Buscar ativos, O.S., chamados, produtos, fornecedores, localidades… (mín. 2 letras)"
          autoFocus
          className="min-h-[44px] flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          aria-label="Termo da busca"
        />
        <button type="submit" className="rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-800">
          Buscar
        </button>
      </form>

      {termo.length < 2 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold">Digite pelo menos 2 caracteres para buscar.</p>
          <p className="mt-1 text-xs text-zinc-500">Ex: “bomba 14”, “AC-001”, “filtro de ar”, “Fornecedor A”.</p>
        </div>
      ) : resultados.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold">Nenhum resultado para “{termo}”.</p>
          <p className="mt-1 text-xs text-zinc-500">Tente outro termo. A busca respeita organização e permissões.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">{resultados.length} resultados para “{termo}” — até 10 por categoria.</p>
          {GRUPOS.map(({ tipo, titulo }) => {
            const itens = porTipo.get(tipo);
            if (!itens || itens.length === 0) return null;
            return (
              <section key={tipo} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  {titulo} — {itens.length}
                </h2>
                <ul className="mt-3 space-y-1">
                  {itens.map((r) => (
                    <li key={`${r.tipo}-${r.id}`}>
                      <Link href={r.href} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-zinc-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{r.titulo}</p>
                          <p className="truncate text-xs text-zinc-500">{r.detalhe}</p>
                        </div>
                        <span className="ml-2 shrink-0 text-xs font-bold text-zinc-900">Abrir →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <p className="text-xs text-zinc-400">Tenant: {ctx.orgId.slice(0, 8)} · Limite 10 por categoria · Total máx 80 · RLS via requireOrg</p>
    </div>
  );
}
