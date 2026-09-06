"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";

export interface ResultadoBusca {
  tipo: "ativo" | "chamado" | "compra" | "pedido" | "produto";
  id: string;
  titulo: string;
  detalhe: string;
  href: string;
}

/**
 * Busca global por termo, escopo da org ativa. Sem dados fictícios:
 * retorna apenas o que existe (limite 5 por categoria).
 */
export async function buscarGlobal(termo: string): Promise<ResultadoBusca[]> {
  const t = termo.trim();
  if (t.length < 2) return [];
  const ctx = await requireOrg();
  const supabase = await createClient();
  const like = `%${t}%`;

  const [ativos, chamados, compras, pedidos, produtos] = await Promise.all([
    supabase.from("ativos").select("id, nome, localizacao").eq("organization_id", ctx.orgId).or(`nome.ilike.${like},localizacao.ilike.${like}`).limit(5),
    supabase.from("chamados").select("id, solicitante, descricao").eq("organization_id", ctx.orgId).or(`solicitante.ilike.${like},descricao.ilike.${like}`).limit(5),
    supabase.from("compras").select("id, item, setor").eq("organization_id", ctx.orgId).or(`item.ilike.${like},setor.ilike.${like}`).limit(5),
    supabase.from("solicitacoes_compra").select("id, item, setor, status").eq("organization_id", ctx.orgId).or(`item.ilike.${like},setor.ilike.${like}`).limit(5),
    supabase.from("produtos").select("id, codigo, descricao").eq("organization_id", ctx.orgId).or(`codigo.ilike.${like},descricao.ilike.${like}`).limit(5),
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
  return out;
}
