"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { registrarLog } from "@/lib/auditoria";
import { createServiceClient } from "@/lib/supabase/service";

export async function atualizarPerfil(input: { nome: string; telefone: string; cargo: string; matricula: string; bio: string; preferencias: Record<string, unknown> }): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  const supabase = await createClient();
  const nome = input.nome.trim().slice(0, 80);
  if (nome.length < 2) return { ok: false, error: "Nome: 2 a 80 caracteres." };
  const payload: Record<string, unknown> = {
    nome,
    telefone: input.telefone.trim().slice(0, 30) || null,
    cargo: input.cargo.trim().slice(0, 60) || null,
    matricula: input.matricula.trim().slice(0, 30) || null,
  };
  // bio/preferencias são FASE 9.2 (schema_v19) — tentar, se coluna não existir, ignorar
  try {
    const { error } = await supabase.from("profiles").update({ ...payload, bio: input.bio.slice(0, 500) || null, preferencias: input.preferencias ?? {} } as never).eq("id", ctx.userId);
    if (error && !String(error.message).includes("bio")) throw error;
    if (error && String(error.message).includes("bio")) {
      const { error: e2 } = await supabase.from("profiles").update(payload as never).eq("id", ctx.userId);
      if (e2) return { ok: false, error: e2.message };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("bio") || msg.includes("preferencias")) {
      const { error } = await supabase.from("profiles").update(payload as never).eq("id", ctx.userId);
      if (error) return { ok: false, error: error.message };
    } else return { ok: false, error: msg };
  }
  await supabase.from("profiles").update({ ultimo_acesso: new Date().toISOString() } as never).eq("id", ctx.userId);
  await registrarLog(supabase, { tabela: "profiles", registro_id: ctx.userId, acao: "UPDATE", dados_anteriores: null, dados_novos: { nome }, executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId });
  return { ok: true };
}

export async function uploadAvatar(formData: FormData): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Arquivo não enviado." };
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) return { ok: false, error: "Apenas JPG/PNG/WebP." };
  if (file.size > 8*1024*1024) return { ok: false, error: "Máx 8MB." };
  const svc = createServiceClient();
  const path = `o/${ctx.orgId}/profiles/${ctx.userId}/avatar/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-40)}`;
  const { error } = await svc.storage.from("manutencao-midia").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: error.message };
  const supabase = await createClient();
  await supabase.from("profiles").update({ avatar_url: path } as never).eq("id", ctx.userId);
  await registrarLog(supabase, { tabela: "profiles", registro_id: ctx.userId, acao: "UPDATE", dados_anteriores: null, dados_novos: { avatar_url: path }, executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId });
  return { ok: true, path };
}
