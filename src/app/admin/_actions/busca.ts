"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";

export interface ResultadoBusca {
  tipo: "ativo" | "chamado" | "compra" | "pedido" | "produto" | "fornecedor" | "solicitacao" | "pedidocompra";
  id: string;
  titulo: string;
  detalhe: string;
  href: string;
}

/**
 * Busca global por termo, escopo da org ativa. Sem dados fictícios:
 * retorna apenas o que existe (limite 5 por categoria).
 *
 * HARDENING: o termo é sanitizado — `,`/`(`/`)` quebrariam a sintaxe
 * `or()` do PostgREST e `%`/`_` virariam curingas do ILIKE.
 */
export async function buscarGlobal(termo: string): Promise<ResultadoBusca[]> {
  const t = termo
    .replace(/[%_,()\"'\\;]/g, "")
    .trim()
    .slice(0, 60);
  if (t.length < 2) return [];
  const ctx = await requireOrg();
  const supabase = await createClient();
  const like = `%${t}%`;

  const [ativos, chamados, compras, pedidos, produtos, fornecedores, sols, peds] = await Promise.all([
    supabase.from("ativos").select("id, nome, localizacao").eq("organization_id", ctx.orgId).or(`nome.ilike.${like},localizacao.ilike.${like}`).limit(5),
    supabase.from("chamados").select("id, solicitante, descricao").eq("organization_id", ctx.orgId).or(`solicitante.ilike.${like},descricao.ilike.${like}`).limit(5),
    supabase.from("compras").select("id, item, setor").eq("organization_id", ctx.orgId).or(`item.ilike.${like},setor.ilike.${like}`).limit(5),
    supabase.from("solicitacoes_compra").select("id, item, setor, status").eq("organization_id", ctx.orgId).or(`item.ilike.${like},setor.ilike.${like}`).limit(5),
    supabase.from("produtos").select("id, codigo, descricao").eq("organization_id", ctx.orgId).or(`codigo.ilike.${like},descricao.ilike.${like}`).limit(5),
    supabase.from("fornecedores").select("id, nome").eq("organization_id", ctx.orgId).or(`nome.ilike.${like}`).limit(5),
    supabase.from("solicitacoes_compra").select("id, item, status").eq("organization_id", ctx.orgId).or(`item.ilike.${like}`).limit(3),
    supabase.from("pedidos_compra").select("id, numero").eq("organization_id", ctx.orgId).or(`numero.ilike.${like}`).limit(3),
  ]);

  const out: ResultadoBusca[] = [];
  for (const a of ((ativos.data ?? []) as { id: string; nome: string; localizacao: string | null }[])) {
    out.push({ tipo: "ativo", id: a.id, titulo: a.nome, detalhe: a.localizacao ?? "Ativo", href: `/admin/ativos/${a.id}` });
  }
  for (const c of ((chamados.data ?? []) as { id: string; solicitante: string; descricao: string }[])) {
    out.push({ tipo: "chamado", id: c.id, titulo: `OS · ${c.solicitante}`, detalhe: c.descricao.slice(0, 60), href: `/admin/chamados/${c.id}` });
  }
  for (const c of ((compras.data ?? []) as { id: string; item: string; setor: string | null }[])) {
    out.push({ tipo: "compra", id: c.id, titulo: c.item, detalhe: c.setor ?? "Compra", href: "/admin/compras" });
  }
  for (const p of ((pedidos.data ?? []) as { id: string; item: string; setor: string; status: string }[])) {
    out.push({ tipo: "pedido", id: p.id, titulo: p.item, detalhe: `${p.setor} · ${p.status}`, href: "/admin/compras" });
  }
  for (const p of ((produtos.data ?? []) as { id: string; codigo: string; descricao: string }[])) {
    out.push({ tipo: "produto", id: p.id, titulo: `${p.codigo} — ${p.descricao}`, detalhe: "Estoque", href: "/admin/estoque" });
  }
  for (const f of ((fornecedores.data ?? []) as { id: string; nome: string }[])) {
    out.push({ tipo: "fornecedor", id: f.id, titulo: f.nome, detalhe: "Fornecedor", href: "/admin/fornecedores" });
  }
  for (const s of ((sols.data ?? []) as { id: string; item: string; status: string }[])) {
    if (out.some((o) => o.tipo === "pedido" && o.id === s.id)) continue;
    out.push({ tipo: "solicitacao", id: s.id, titulo: s.item, detalhe: `Solicitação · ${s.status}`, href: `/admin/compras/solicitacoes/${s.id}` });
  }
  for (const p of ((peds.data ?? []) as { id: string; numero: string }[])) {
    out.push({ tipo: "pedidocompra", id: p.id, titulo: p.numero, detalhe: "Pedido de compra", href: `/admin/compras/pedidos/${p.id}` });
  }
  return out;
}
