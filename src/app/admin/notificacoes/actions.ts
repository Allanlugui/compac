"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";

/**
 * Central de notificações (SGA-M v3). Broadcast da org (user_id null)
 * ou direcionada. Best-effort: nunca quebra o fluxo principal.
 */
export async function notificar(input: {
  tipo: string;
  titulo: string;
  descricao?: string;
  link?: string;
  userId?: string;
  orgId?: string;
}): Promise<void> {
  try {
    let orgId = input.orgId;
    if (!orgId) {
      try {
        orgId = (await requireOrg()).orgId;
      } catch {
        return;
      }
    }
    const supabase = await createClient();
    await supabase.from("notificacoes").insert({
      organization_id: orgId,
      user_id: input.userId ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      link: input.link ?? null,
    });
  } catch {
    // Silencioso por decisão.
  }
}

/** Marca notificação como lida (dono ou broadcast da org). */
export async function marcarLida(id: string): Promise<void> {
  try {
    const ctx = await requireOrg();
    const supabase = await createClient();
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
  } catch {
    // Silencioso.
  }
}

/** Marca todas como lidas. */
export async function marcarTodasLidas(): Promise<void> {
  try {
    const ctx = await requireOrg();
    const supabase = await createClient();
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("organization_id", ctx.orgId)
      .eq("lida", false)
      .or(`user_id.is.null,user_id.eq.${ctx.userId}`);
  } catch {
    // Silencioso.
  }
}
