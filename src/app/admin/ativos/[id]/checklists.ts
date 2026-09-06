"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";

export type ChecklistResult = { ok: true; id?: string } | { ok: false; error: string };

const TIPOS_ITEM = ["ok_nok", "sim_nao", "texto", "numero", "selecao", "data", "hora", "foto"] as const;

export interface NovoItem {
  texto: string;
  tipo: (typeof TIPOS_ITEM)[number];
  obrigatorio: boolean;
  foto_obrigatoria: boolean;
  obs_obrigatoria: boolean;
  opcoes: string[];
}

/** Cria modelo de checklist (do ativo ou avulso) com itens tipados. */
export async function criarModelo(input: {
  ativoId: string;
  titulo: string;
  itens: NovoItem[];
}): Promise<ChecklistResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "checklists.escrever");

  const titulo = input.titulo.trim();
  if (titulo.length < 3 || titulo.length > 120) return { ok: false, error: "Título: 3 a 120 caracteres." };
  const itens = (Array.isArray(input.itens) ? input.itens : []).slice(0, 30);
  if (itens.length === 0) return { ok: false, error: "Informe ao menos 1 item." };
  for (const it of itens) {
    const texto = (it.texto ?? "").trim();
    if (texto.length < 2 || texto.length > 300) return { ok: false, error: "Item: 2 a 300 caracteres." };
    if (!TIPOS_ITEM.includes(it.tipo)) return { ok: false, error: `Tipo inválido: ${texto}.` };
    if (it.tipo === "selecao") {
      const ops = (it.opcoes ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 20);
      if (ops.length < 2) return { ok: false, error: `Seleção exige 2+ opções: ${texto}.` };
    }
  }

  const supabase = await createClient();
  let ativoId: string | null = null;
  if (input.ativoId.trim() !== "") {
    const { data: at } = await supabase
      .from("ativos").select("id").eq("id", input.ativoId.trim())
      .eq("organization_id", ctx.orgId).maybeSingle();
    if (!at) return { ok: false, error: "Ativo não encontrado." };
    ativoId = input.ativoId.trim();
  }

  const { data: modelo, error } = await supabase
    .from("checklist_modelos")
    .insert({ organization_id: ctx.orgId, ativo_id: ativoId, titulo })
    .select("id")
    .single();
  if (error || !modelo) return { ok: false, error: "Falha ao criar modelo." };

  const { error: erroItens } = await supabase.from("checklist_itens").insert(
    itens.map((it, ordem) => ({
      modelo_id: modelo.id,
      texto: it.texto.trim(),
      tipo: it.tipo,
      obrigatorio: it.obrigatorio !== false,
      foto_obrigatoria: it.foto_obrigatoria === true,
      obs_obrigatoria: it.obs_obrigatoria === true,
      opcoes: it.tipo === "selecao" ? it.opcoes.map((o) => String(o).trim()).filter(Boolean).slice(0, 20) : [],
      ordem,
    })),
  );
  if (erroItens) return { ok: false, error: "Modelo criado, mas itens falharam." };

  await registrarLog(supabase, {
    tabela: "checklist_modelos", registro_id: modelo.id as string, acao: "INSERT",
    dados_anteriores: null, dados_novos: { titulo, itens: itens.length },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidatePath("/admin/ativos", "layout");
  return { ok: true, id: modelo.id as string };
}

export interface RespostaItem {
  itemId: string;
  /** Para ok_nok/sim_nao: true/false. Demais tipos: null + valor. */
  ok: boolean | null;
  valor: string;
  observacao: string;
  /** Paths `o/{org}/...` de fotos do item (upload server-side). */
  fotos: string[];
}

/**
 * Salva execução vinculada ao chamado, com snapshot dos itens, validação
 * por tipo e cálculo do resultado. Bloqueia item obrigatório pendente.
 */
export async function salvarExecucao(input: {
  modeloId: string;
  chamadoId: string;
  respostas: RespostaItem[];
}): Promise<ChecklistResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "checklists.escrever");

  const supabase = await createClient();
  const [{ data: modelo }, { data: chamado }] = await Promise.all([
    supabase.from("checklist_modelos").select("id, organization_id").eq("id", input.modeloId).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("chamados").select("id, ativo_id").eq("id", input.chamadoId).eq("organization_id", ctx.orgId).maybeSingle(),
  ]);
  if (!modelo) return { ok: false, error: "Modelo não encontrado." };
  if (!chamado) return { ok: false, error: "Chamado não encontrado." };

  const { data: itens } = await supabase
    .from("checklist_itens")
    .select("id, texto, tipo, obrigatorio, foto_obrigatoria, obs_obrigatoria, opcoes, ordem")
    .eq("modelo_id", input.modeloId)
    .order("ordem");
  const lista = (itens ?? []) as {
    id: string; texto: string; tipo: string; obrigatorio: boolean;
    foto_obrigatoria: boolean; obs_obrigatoria: boolean; opcoes: string[]; ordem: number;
  }[];
  if (lista.length === 0) return { ok: false, error: "Modelo sem itens." };

  const porItem = new Map((input.respostas ?? []).map((r) => [r.itemId, r]));
  let aprovados = 0;
  let reprovados = 0;
  let pendentes = 0;
  const linhas: { item_id: string; ok: boolean | null; valor: string | null; observacao: string | null; foto_url: string | null }[] = [];

  for (const it of lista) {
    const r = porItem.get(it.id);
    const valor = (r?.valor ?? "").trim().slice(0, 500);
    const obs = (r?.observacao ?? "").trim().slice(0, 500);
    const fotos = (r?.fotos ?? []).filter(
      (p) => typeof p === "string" && p.startsWith(`o/${ctx.orgId}/`) && !p.includes(".."),
    ).slice(0, 3);
    let ok: boolean | null = null;
    let avaliado = false;

    if (it.tipo === "ok_nok" || it.tipo === "sim_nao") {
      if (r?.ok === true || r?.ok === false) {
        ok = r.ok;
        avaliado = true;
      }
    } else if (it.tipo === "foto") {
      if (fotos.length > 0) {
        ok = true;
        avaliado = true;
      }
    } else {
      if (valor !== "") {
        if (it.tipo === "numero" && !Number.isFinite(Number(valor))) {
          return { ok: false, error: `Item "${it.texto}": número inválido.` };
        }
        if (it.tipo === "selecao" && !(it.opcoes ?? []).includes(valor)) {
          return { ok: false, error: `Item "${it.texto}": opção inválida.` };
        }
        if (it.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
          return { ok: false, error: `Item "${it.texto}": data inválida.` };
        }
        if (it.tipo === "hora" && !/^\d{2}:\d{2}$/.test(valor)) {
          return { ok: false, error: `Item "${it.texto}": hora inválida.` };
        }
        ok = true;
        avaliado = true;
      }
    }

    if (it.obrigatorio && !avaliado) {
      return { ok: false, error: `Item obrigatório pendente: "${it.texto}".` };
    }
    if (it.foto_obrigatoria && fotos.length === 0) {
      return { ok: false, error: `Foto obrigatória: "${it.texto}".` };
    }
    if (it.obs_obrigatoria && obs === "") {
      return { ok: false, error: `Observação obrigatória: "${it.texto}".` };
    }

    if (avaliado) {
      if (ok === false) reprovados += 1;
      else aprovados += 1;
    } else {
      pendentes += 1;
    }
    linhas.push({
      item_id: it.id,
      ok,
      valor: valor === "" ? null : valor,
      observacao: obs === "" ? null : obs,
      foto_url: fotos[0] ?? null,
    });
  }

  const resultado = reprovados > 0 ? "reprovado" : pendentes > 0 ? "ressalvas" : "aprovado";

  const { data: exec, error } = await supabase
    .from("checklist_execucoes")
    .insert({
      organization_id: ctx.orgId, modelo_id: input.modeloId,
      chamado_id: input.chamadoId, ativo_id: (chamado as { ativo_id: string }).ativo_id,
      executado_por: ctx.email, user_id: ctx.userId,
      status: "concluida", resultado,
      snapshot: lista.map((i) => ({
        id: i.id, texto: i.texto, tipo: i.tipo, obrigatorio: i.obrigatorio, ordem: i.ordem,
      })),
    })
    .select("id")
    .single();
  if (error || !exec) return { ok: false, error: "Falha ao salvar execução." };

  await supabase.from("checklist_respostas").insert(
    linhas.map((l) => ({ execucao_id: (exec as { id: string }).id, ...l })),
  );

  await registrarLog(supabase, {
    tabela: "checklist_execucoes", registro_id: (exec as { id: string }).id, acao: "CHECKLIST_CONCLUIDA",
    dados_anteriores: null,
    dados_novos: { modelo_id: input.modeloId, chamado_id: input.chamadoId, resultado, aprovados, reprovados, pendentes },
    executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
  });
  revalidatePath(`/admin/chamados/${input.chamadoId}`);
  return { ok: true, id: (exec as { id: string }).id };
}
