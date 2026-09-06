"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { gerarTokenPublico } from "@/lib/tokens";

export type QrCtxResult = { ok: true } | { ok: false; error: string };

function txt(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

/** Cria contexto de QR (unidade/setor/área/almoxarifado/centro). */
export async function criarContexto(input: {
  nome: string;
  unidade?: string;
  setor?: string;
  area?: string;
  almoxarifado?: string;
  centro_custo?: string;
}): Promise<QrCtxResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "compras.criar");
  const nome = (input.nome ?? "").trim();
  if (nome.length < 2 || nome.length > 80) return { ok: false, error: "Nome: 2 a 80 caracteres." };

  const supabase = await createClient();
  for (let t = 0; t < 5; t++) {
    const token = gerarTokenPublico(24);
    const { error } = await supabase.from("qr_contextos").insert({
      organization_id: ctx.orgId,
      nome,
      unidade: txt(input.unidade, 80),
      setor: txt(input.setor, 80),
      area: txt(input.area, 80),
      almoxarifado: txt(input.almoxarifado, 80),
      centro_custo: txt(input.centro_custo, 80),
      token,
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
  exigirPermissao(ctx, "compras.criar");
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
  exigirPermissao(ctx, "compras.criar");
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
