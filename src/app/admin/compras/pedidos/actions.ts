"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";

export type PedResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidar(pedidoId?: string) {
  revalidatePath("/admin/compras");
  revalidatePath("/admin/compras/solicitacoes");
  if (pedidoId) revalidatePath(`/admin/compras/pedidos/${pedidoId}`);
}

export interface ItemPedidoInput {
  produto_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
}

/**
 * Cria PEDIDO a partir da solicitação aprovada/em_cotação.
 * NÃO baixa estoque (entrada só no recebimento efetivo, §22/§44).
 */
export async function criarPedido(input: {
  solicitacaoId: string;
  fornecedor_id: string;
  itens: ItemPedidoInput[];
  frete?: number;
  desconto?: number;
  impostos?: number;
  prazo?: string;
  centro_custo?: string;
  observacao?: string;
}): Promise<PedResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.criar");
  if (!input.solicitacaoId || !input.fornecedor_id) {
    return { ok: false, error: "Dados inválidos." };
  }

  const itens = (input.itens ?? []).slice(0, 50);
  if (itens.length === 0) return { ok: false, error: "Adicione itens." };
  for (const it of itens) {
    if ((it.descricao ?? "").trim().length < 2) return { ok: false, error: "Item sem descrição." };
    if (!Number.isFinite(Number(it.quantidade)) || Number(it.quantidade) <= 0) {
      return { ok: false, error: "Quantidade inválida." };
    }
    if (!Number.isFinite(Number(it.preco_unitario)) || Number(it.preco_unitario) < 0) {
      return { ok: false, error: "Preço inválido." };
    }
  }
  const frete = Number(input.frete ?? 0);
  const desconto = Number(input.desconto ?? 0);
  const impostos = Number(input.impostos ?? 0);
  if (![frete, desconto, impostos].every((v) => Number.isFinite(v) && v >= 0)) {
    return { ok: false, error: "Frete/desconto/impostos inválidos." };
  }

  const supabase = await createClient();
  const [{ data: sol }, { data: forn }] = await Promise.all([
    supabase.from("solicitacoes_compra").select("id, status").eq("id", input.solicitacaoId).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("fornecedores").select("id").eq("id", input.fornecedor_id).eq("organization_id", ctx.orgId).maybeSingle(),
  ]);
  if (!sol) return { ok: false, error: "Solicitação não encontrada." };
  if (!forn) return { ok: false, error: "Fornecedor inválido." };
  const st = (sol as { status: string }).status;
  if (!["aprovada", "aprovado", "em_cotacao"].includes(st)) {
    return { ok: false, error: "Solicitação precisa estar aprovada/em cotação." };
  }
  for (const it of itens) {
    if (it.produto_id) {
      const { data: p } = await supabase
        .from("produtos").select("id").eq("id", it.produto_id).eq("organization_id", ctx.orgId).maybeSingle();
      if (!p) return { ok: false, error: "Produto inválido." };
    }
  }

  // Número legível por org (PED-AAAA-NNNN), com retry em colisão.
  const ano = new Date().getFullYear();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { count } = await supabase
      .from("pedidos_compra")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId);
    const numero = `PED-${ano}-${String((count ?? 0) + 1 + tentativa).padStart(4, "0")}`;

    const { data: ped, error } = await supabase
      .from("pedidos_compra")
      .insert({
        organization_id: ctx.orgId,
        solicitacao_id: input.solicitacaoId,
        fornecedor_id: input.fornecedor_id,
        numero,
        status: "aberto",
        frete,
        desconto,
        impostos,
        prazo: input.prazo && /^\d{4}-\d{2}-\d{2}$/.test(input.prazo) ? input.prazo : null,
        centro_custo: (() => {
          const cc = (input.centro_custo ?? "").trim();
          return cc === "" ? null : cc.slice(0, 80);
        })(),
        comprador: ctx.email,
        observacao: (() => {
          const o = (input.observacao ?? "").trim();
          return o === "" ? null : o.slice(0, 1000);
        })(),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") continue;
      return { ok: false, error: "Não foi possível criar o pedido." };
    }
    if (!ped) return { ok: false, error: "Não foi possível criar o pedido." };
    const pedidoId = (ped as { id: string }).id;

    const { error: ei } = await supabase.from("pedido_itens").insert(
      itens.map((it) => ({
        organization_id: ctx.orgId,
        pedido_id: pedidoId,
        produto_id: it.produto_id || null,
        descricao: it.descricao.trim(),
        quantidade: Number(it.quantidade),
        unidade: (it.unidade || "UN").trim().toUpperCase().slice(0, 10),
        preco_unitario: Number(it.preco_unitario),
      })),
    );
    if (ei) {
      await supabase.from("pedidos_compra").delete().eq("id", pedidoId).eq("organization_id", ctx.orgId);
      return { ok: false, error: "Falha nos itens. Nada foi salvo." };
    }

    await supabase
      .from("solicitacoes_compra")
      .update({ status: "pedido_gerado" })
      .eq("id", input.solicitacaoId)
      .eq("organization_id", ctx.orgId);
    await supabase.from("solicitacao_historico").insert({
      organization_id: ctx.orgId,
      solicitacao_id: input.solicitacaoId,
      de: st,
      para: "pedido_gerado",
      motivo: `Pedido ${numero}`,
      user_id: ctx.userId,
      executado_por: ctx.email,
    });
    await registrarLog(supabase, {
      tabela: "pedidos_compra", registro_id: pedidoId, acao: "ORDER_CREATED",
      dados_anteriores: null, dados_novos: { numero, solicitacao_id: input.solicitacaoId, itens: itens.length },
      executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
    });
    revalidar(pedidoId);
    return { ok: true, id: pedidoId };
  }
  return { ok: false, error: "Tente novamente em instantes." };
}

/** Aprova pedido (AG). Não movimenta estoque. */
export async function aprovarPedido(input: { id: string }): Promise<PedResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.aprovar");

  const supabase = await createClient();
  const { data: ped } = await supabase
    .from("pedidos_compra").select("id, status").eq("id", input.id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!ped) return { ok: false, error: "Pedido não encontrado." };
  if ((ped as { status: string }).status !== "aberto") {
    return { ok: false, error: "Só pedidos abertos podem ser aprovados." };
  }
  const { error } = await supabase
    .from("pedidos_compra").update({ status: "aprovado" }).eq("id", input.id).eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível aprovar." };
  await registrarLog(supabase, {
    tabela: "pedidos_compra", registro_id: input.id, acao: "ORDER_APPROVED",
    dados_anteriores: { status: "aberto" }, dados_novos: { status: "aprovado" },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidar(input.id);
  return { ok: true };
}

/** Cancela pedido (AG). */
export async function cancelarPedido(input: { id: string; motivo?: string }): Promise<PedResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.aprovar");

  const supabase = await createClient();
  const { data: ped } = await supabase
    .from("pedidos_compra").select("id, status").eq("id", input.id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!ped) return { ok: false, error: "Pedido não encontrado." };
  if (!["aberto", "aprovado"].includes((ped as { status: string }).status)) {
    return { ok: false, error: "Pedido já recebido/encerrado." };
  }
  const { error } = await supabase
    .from("pedidos_compra").update({ status: "cancelado" }).eq("id", input.id).eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível cancelar." };
  revalidar(input.id);
  return { ok: true };
}

export interface LinhaRecebimento {
  pedido_item_id: string;
  qtd_recebida: number;
  qtd_recusada: number;
  motivo?: string;
}

/**
 * RECEBIMENTO + conferência (§21–23): registra linhas (aceito/divergente),
 * dá ENTRADA no estoque só do aceito, atualiza custos e vínculo
 * produto→pedido→fornecedor→solicitação. Pedido original intacto.
 */
export async function registrarRecebimento(input: {
  pedidoId: string;
  linhas: LinhaRecebimento[];
  lote?: string;
  validade?: string;
  motivo_divergencia?: string;
  foto?: File | null;
}): Promise<PedResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.receber");
  if (!input.pedidoId) return { ok: false, error: "Pedido inválido." };

  const linhas = (input.linhas ?? []).slice(0, 100);
  if (linhas.length === 0) return { ok: false, error: "Informe as quantidades." };

  const supabase = await createClient();
  const { data: ped } = await supabase
    .from("pedidos_compra")
    .select("id, status, fornecedor_id, solicitacao_id")
    .eq("id", input.pedidoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ped) return { ok: false, error: "Pedido não encontrado." };
  const pedido = ped as { status: string; fornecedor_id: string; solicitacao_id: string | null };
  if (!["aprovado", "aberto"].includes(pedido.status)) {
    return { ok: false, error: "Pedido precisa estar aprovado." };
  }

  const { data: itens } = await supabase
    .from("pedido_itens")
    .select("id, produto_id, descricao, quantidade, preco_unitario")
    .eq("pedido_id", input.pedidoId)
    .eq("organization_id", ctx.orgId);
  const mapa = new Map(((itens ?? []) as {
    id: string; produto_id: string | null; descricao: string; quantidade: number; preco_unitario: number;
  }[]).map((i) => [i.id, i]));
  if (mapa.size === 0) return { ok: false, error: "Pedido sem itens." };

  // Trava além do pendente (gate FASE 4 S11): soma o já recebido.
  const { data: jaRec } = await supabase
    .from("recebimento_itens")
    .select("pedido_item_id, qtd_recebida, qtd_recusada, recebimento_id, recebimentos!inner(pedido_id)")
    .eq("recebimentos.pedido_id", input.pedidoId)
    .eq("organization_id", ctx.orgId);
  const recebidoAntes = new Map<string, number>();
  const recusadoAntes = new Map<string, number>();
  for (const r of ((jaRec ?? []) as { pedido_item_id: string; qtd_recebida: number; qtd_recusada: number }[])) {
    recebidoAntes.set(r.pedido_item_id, (recebidoAntes.get(r.pedido_item_id) ?? 0) + Number(r.qtd_recebida ?? 0));
    recusadoAntes.set(r.pedido_item_id, (recusadoAntes.get(r.pedido_item_id) ?? 0) + Number(r.qtd_recusada ?? 0));
  }

  let totalRecusada = 0;
  for (const l of linhas) {
    const item = mapa.get(l.pedido_item_id);
    if (!item) return { ok: false, error: "Item inválido." };
    const rec = Number(l.qtd_recebida);
    const rej = Number(l.qtd_recusada ?? 0);
    if (!Number.isFinite(rec) || rec < 0 || !Number.isFinite(rej) || rej < 0) {
      return { ok: false, error: `Quantidades inválidas: ${item.descricao}.` };
    }
    if (rec + rej > Number(item.quantidade)) {
      return { ok: false, error: `Recebido+recusado excede o pedido: ${item.descricao}.` };
    }
    const pendenteItem = Number(item.quantidade)
      - (recebidoAntes.get(l.pedido_item_id) ?? 0)
      - (recusadoAntes.get(l.pedido_item_id) ?? 0);
    if (rec + rej > pendenteItem) {
      return { ok: false, error: `Além do pendente (${pendenteItem}): ${item.descricao}.` };
    }
    totalRecusada += rej;
  }

  // Foto do recebimento (avaria/divergência/comprovante).
  let foto_path: string | null = null;
  if (input.foto && input.foto.size > 0) {
    const permitidos = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
    if (!permitidos.has(input.foto.type)) return { ok: false, error: "Foto: apenas PDF ou imagens." };
    if (input.foto.size > 10 * 1024 * 1024) return { ok: false, error: "Foto excede 10 MB." };
    const svc = createServiceClient();
    foto_path = `o/${ctx.orgId}/recebimentos/${input.pedidoId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.bin`;
    const { error: up } = await svc.storage
      .from("manutencao-midia")
      .upload(foto_path, input.foto, { contentType: input.foto.type, upsert: false });
    if (up) return { ok: false, error: "Falha no envio da foto." };
  }

  const divergente = totalRecusada > 0;
  if (divergente && ((input.motivo_divergencia ?? "").trim() === "")) {
    return { ok: false, error: "Divergência exige motivo." };
  }

  const { data: rec, error: er } = await supabase
    .from("recebimentos")
    .insert({
      organization_id: ctx.orgId,
      pedido_id: input.pedidoId,
      status: divergente ? "divergente" : "aceito",
      lote: (() => {
        const lt = (input.lote ?? "").trim();
        return lt === "" ? null : lt.slice(0, 60);
      })(),
      validade: input.validade && /^\d{4}-\d{2}-\d{2}$/.test(input.validade) ? input.validade : null,
      motivo_divergencia: divergente ? (input.motivo_divergencia ?? "").trim().slice(0, 500) : null,
      foto_path,
      recebido_por: ctx.email,
    })
    .select("id")
    .single();
  if (er || !rec) return { ok: false, error: "Não foi possível registrar." };
  const recId = (rec as { id: string }).id;

  await supabase.from("recebimento_itens").insert(
    linhas.map((l) => ({
      organization_id: ctx.orgId,
      recebimento_id: recId,
      pedido_item_id: l.pedido_item_id,
      qtd_recebida: Number(l.qtd_recebida),
      qtd_recusada: Number(l.qtd_recusada ?? 0),
      motivo: (() => {
        const m = (l.motivo ?? "").trim();
        return m === "" ? null : m.slice(0, 300);
      })(),
    })),
  );

  // ENTRADA no estoque (só o aceito) + custos + vínculo fornecedor.
  for (const l of linhas) {
    const item = mapa.get(l.pedido_item_id)!;
    const qtd = Number(l.qtd_recebida);
    if (qtd <= 0 || !item.produto_id) continue;
    const { data: prod } = await supabase
      .from("produtos")
      .select("estoque_atual, custo_medio")
      .eq("id", item.produto_id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!prod) continue;
    const p = prod as { estoque_atual: number; custo_medio: number };
    const fisico = Number(p.estoque_atual ?? 0);
    const novoFisico = fisico + qtd;
    const preco = Number(item.preco_unitario ?? 0);
    const medioAntigo = Number(p.custo_medio ?? 0);
    const novoMedio = novoFisico > 0 ? (fisico * medioAntigo + qtd * preco) / novoFisico : preco;
    await supabase
      .from("produtos")
      .update({ estoque_atual: novoFisico, custo_medio: novoMedio, ultimo_custo: preco })
      .eq("id", item.produto_id)
      .eq("organization_id", ctx.orgId);
    await supabase.from("movimentacoes_estoque").insert({
      organization_id: ctx.orgId,
      produto_id: item.produto_id,
      tipo: "entrada",
      quantidade: qtd,
      custo_unitario: preco,
      observacao: `Recebimento pedido ${input.pedidoId.slice(0, 8)}`,
      executado_por: ctx.email,
    });
    await supabase.from("produto_fornecedores").upsert(
      {
        organization_id: ctx.orgId,
        produto_id: item.produto_id,
        fornecedor_id: pedido.fornecedor_id,
        preco_ref: preco,
      },
      { onConflict: "produto_id,fornecedor_id" },
    );
  }

  await supabase
    .from("pedidos_compra")
    .update({ status: "recebido" })
    .eq("id", input.pedidoId)
    .eq("organization_id", ctx.orgId);
  if (pedido.solicitacao_id) {
    await supabase
      .from("solicitacoes_compra")
      .update({ status: "recebida" })
      .eq("id", pedido.solicitacao_id)
      .eq("organization_id", ctx.orgId);
    await supabase.from("solicitacao_historico").insert({
      organization_id: ctx.orgId,
      solicitacao_id: pedido.solicitacao_id,
      de: "pedido_gerado",
      para: "recebida",
      motivo: divergente ? "Recebimento com divergência" : "Recebimento aceito",
      user_id: ctx.userId,
      executado_por: ctx.email,
    });
  }

  await registrarLog(supabase, {
    tabela: "recebimentos", registro_id: recId,
    acao: divergente ? "RECEIPT_REJECTED" : "RECEIPT_ACCEPTED",
    dados_anteriores: null,
    dados_novos: { pedido_id: input.pedidoId, divergente, motivo: input.motivo_divergencia ?? null },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidar(input.pedidoId);
  return { ok: true, id: recId };
}

/** Encerra pedido recebido. */
export async function encerrarPedido(input: { id: string }): Promise<PedResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.aprovar");

  const supabase = await createClient();
  const { data: ped } = await supabase
    .from("pedidos_compra").select("id, status, solicitacao_id").eq("id", input.id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!ped) return { ok: false, error: "Pedido não encontrado." };
  if ((ped as { status: string }).status !== "recebido") {
    return { ok: false, error: "Só pedidos recebidos podem ser encerrados." };
  }
  await supabase
    .from("pedidos_compra").update({ status: "encerrado" }).eq("id", input.id).eq("organization_id", ctx.orgId);
  const solId = (ped as { solicitacao_id: string | null }).solicitacao_id;
  if (solId) {
    await supabase
      .from("solicitacoes_compra").update({ status: "encerrada" }).eq("id", solId).eq("organization_id", ctx.orgId);
    await supabase.from("solicitacao_historico").insert({
      organization_id: ctx.orgId, solicitacao_id: solId, de: "recebida", para: "encerrada",
      user_id: ctx.userId, executado_por: ctx.email,
    });
  }
  revalidar(input.id);
  return { ok: true };
}
