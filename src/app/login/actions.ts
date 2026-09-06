"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarLog } from "@/lib/auditoria";

/** Audita logins bem-sucedidos (chamado pelo cliente após signIn). */
export async function auditLogin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await registrarLog(supabase, {
    tabela: "sessao",
    registro_id: user.id,
    acao: "LOGIN",
    dados_anteriores: null,
    dados_novos: { email: user.email },
    executado_por: user.email ?? user.id,
  });
  // Último acesso do perfil (best-effort; RLS permite update próprio).
  try {
    await supabase
      .from("profiles")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", user.id);
  } catch {
    // Silencioso: observabilidade, não regra de negócio.
  }
}

/** Encerra a sessão com trilha de auditoria. */
export async function sair(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await registrarLog(supabase, {
      tabela: "sessao",
      registro_id: user.id,
      acao: "LOGOUT",
      dados_anteriores: null,
      dados_novos: null,
      executado_por: user.email ?? user.id,
    });
  }
  await supabase.auth.signOut();
  redirect("/login");
}
