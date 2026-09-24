"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";

/**
 * Central de notificações (SGA-M v3). Broadcast da org (user_id null)
 * ou direcionada. Best-effort: nunca quebra o fluxo principal.
 *
 * HARDENING: o tenant vem SEMPRE da sessão (requireOrg). O parâmetro
 * `orgId` foi removido — Server Actions exportadas são invocáveis pelo
 * browser, e aceitar org do cliente permitiria forjar avisos.
 */
export async function notificar(input: {
  tipo: string;
  titulo: string;
  descricao?: string;
  link?: string;
  userId?: string;
}): Promise<void> {
  try {
    let orgId: string;
    try {
      orgId = (await requireOrg()).orgId;
    } catch {
      return;
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

/** Marca notificação como lida (só as visíveis a este usuário). */
export async function marcarLida(id: string): Promise<void> {
  try {
    const ctx = await requireOrg();
    const supabase = await createClient();
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .or(`user_id.is.null,user_id.eq.${ctx.userId}`);
    // FASE A: sem revalidate a UI (lista + badge do sino no layout) ficava presa até reload manual.
    revalidatePath("/admin/notificacoes");
    revalidatePath("/admin", "layout");
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
    revalidatePath("/admin/notificacoes");
    revalidatePath("/admin", "layout");
  } catch {
    // Silencioso.
  }
}
