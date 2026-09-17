import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextoOrg } from "./org";
import type { Permissao } from "./permissoes";
import {
  carregarCustom,
  temPermissaoEfetiva,
  type EscopoRef,
} from "./permissoes-custom";

type DbClient = SupabaseClient;

/**
 * Barreira servidor com overlay customizado (BLOCO 3, schema_v25).
 * Lança a mesma mensagem de `exigirPermissao` quando negado.
 * Cria client próprio quando não informado (evita reorder nas actions).
 *
 * Módulo SERVIDOR (importa `next/headers` via supabase/server):
 * nunca importar de Client Components — usar `./permissoes-custom`.
 */
export async function exigirPermissaoEfetiva(
  ctx: ContextoOrg,
  permissao: Permissao,
  escopo: EscopoRef = null,
  supabase?: DbClient,
): Promise<void> {
  const db = supabase ?? (await createClient());
  const customs = await carregarCustom(db, ctx.orgId, ctx.userId);
  if (!temPermissaoEfetiva(ctx.role, customs, permissao, escopo)) {
    throw new Error("Sem permissão para esta operação.");
  }
}
