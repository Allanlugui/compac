import type { createClient } from "@/lib/supabase/server";
import type { AuditoriaAcao } from "@/lib/types";

export interface LogAuditoria {
  tabela: string;
  registro_id: string;
  acao: AuditoriaAcao;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  executado_por: string;
  organization_id?: string;
  user_id?: string;
}

/**
 * Helper compartilhado da trilha de auditoria (SGA-M v2.0 · Fase 4).
 * Best-effort por decisão: falha de log nunca quebra a operação principal.
 */
export async function registrarLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  log: LogAuditoria,
): Promise<void> {
  try {
    await supabase.from("auditoria_logs").insert(log);
  } catch {
    // Silencioso: auditoria é observabilidade, não regra de negócio.
  }
}
