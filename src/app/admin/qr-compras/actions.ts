"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissaoEfetiva } from "@/lib/permissoes-custom-server";
import { gerarTokenPublico } from "@/lib/tokens";

export type QrCtxResult = { ok: true } | { ok: false; error: string };

function txt(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

type DbClient = Awaited<ReturnType<typeof createClient>>;

/** Nome de um vínculo (snapshot textual) + confirma mesma org. */
async function nomeVinculo(
  supabase: DbClient,
  tabela: "localidades" | "departamentos_setores" | "centros_custo" | "almoxarifados",
  id: string,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(tabela)
    .select("id, nome")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return (data as { nome: string }).nome;
}

/**
 * Cria contexto de QR (BLOCO 4: seletores relacionais + texto legado).
 * IDs vinculados geram snapshot textual (unidade/setor/centro) para
 * QRs impressos e formulários antigos seguirem legíveis.
 */
export async function criarContexto(input: {
  nome: string;
  unidade?: string;
  setor?: string;
  area?: string;
  almoxarifado?: string;
  centro_custo?: string;
  localidadeId?: string | null;
  departamentoId?: string | null;
  centroCustoId?: string | null;
  almoxarifadoId?: string | null;
}): Promise<QrCtxResult> {
  const ctx = await requireOrg();
  await exigirPermissaoEfetiva(ctx, "compras.criar");
  const nome = (input.nome ?? "").trim();
  if (nome.length < 2 || nome.length > 80) return { ok: false, error: "Nome: 2 a 80 caracteres." };

  const supabase = await createClient();
  const localidadeId = input.localidadeId || null;
  const departamentoId = input.departamentoId || null;
  const centroCustoId = input.centroCustoId || null;
  const almoxarifadoId = input.almoxarifadoId || null;

  // Resolve snapshots a partir dos vínculos (texto manual só quando sem vínculo).
  let unidade = txt(input.unidade, 80);
  let setor = txt(input.setor, 80);
  const area = txt(input.area, 80);
  let almoxarifado = txt(input.almoxarifado, 80);
  let centro_custo = txt(input.centro_custo, 80);
  if (localidadeId) {
    const n = await nomeVinculo(supabase, "localidades", localidadeId, ctx.orgId);
    if (!n) return { ok: false, error: "Localidade inválida." };
    unidade = n.slice(0, 80);
  }
  if (departamentoId) {
    const n = await nomeVinculo(supabase, "departamentos_setores", departamentoId, ctx.orgId);
    if (!n) return { ok: false, error: "Departamento inválido." };
    setor = n.slice(0, 80);
  }
  if (centroCustoId) {
    const { data: ccRow } = await supabase
      .from("centros_custo")
      .select("id, codigo, nome")
      .eq("id", centroCustoId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    const cc = ccRow as unknown as { codigo: string; nome: string } | null;
    if (!cc) return { ok: false, error: "Centro de custo inválido." };
    centro_custo = `${cc.codigo} — ${cc.nome}`.slice(0, 80);
  }
  if (almoxarifadoId) {
    const n = await nomeVinculo(supabase, "almoxarifados", almoxarifadoId, ctx.orgId);
    if (!n) return { ok: false, error: "Almoxarifado inválido." };
    almoxarifado = n.slice(0, 80);
  }

  for (let t = 0; t < 5; t++) {
    const token = gerarTokenPublico(24);
    const { error } = await supabase.from("qr_contextos").insert({
      organization_id: ctx.orgId,
      nome,
      unidade,
      setor,
      area,
      almoxarifado,
      centro_custo,
      token,
      // Omitidos quando null: insert válido pré-v26.
      ...(localidadeId ? { localidade_id: localidadeId } : {}),
      ...(departamentoId ? { departamento_id: departamentoId } : {}),
      ...(centroCustoId ? { centro_custo_id: centroCustoId } : {}),
      ...(almoxarifadoId ? { almoxarifado_id: almoxarifadoId } : {}),
    });
    if (!error) {
      revalidatePath("/admin/qr-compras");
      return { ok: true };
    }
    if (error.code !== "23505") return { ok: false, error: "Não foi possível criar." };
  }
  return { ok: false, error: "Tente novamente." };
}

/** Ativa/inativa contexto (etiquetas antigas deixam de abrir formulário). */
export async function alternarContexto(input: { id: string; ativo: boolean }): Promise<QrCtxResult> {
  const ctx = await requireOrg();
  await exigirPermissaoEfetiva(ctx, "compras.criar");
  if (!input.id) return { ok: false, error: "Contexto inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("qr_contextos")
    .update({ ativo: input.ativo })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível atualizar." };
  revalidatePath("/admin/qr-compras");
  return { ok: true };
}

/** Exclui contexto (etiquetas impressas deixam de funcionar). */
export async function excluirContexto(input: { id: string }): Promise<QrCtxResult> {
  const ctx = await requireOrg();
  await exigirPermissaoEfetiva(ctx, "compras.criar");
  if (!input.id) return { ok: false, error: "Contexto inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("qr_contextos")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };
  revalidatePath("/admin/qr-compras");
  return { ok: true };
}
