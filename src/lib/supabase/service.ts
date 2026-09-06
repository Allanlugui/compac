import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com SERVICE_ROLE — SERVER-ONLY, SEMPRE.
 *
 * PROIBIDO importar em Client Components, páginas cliente ou qualquer
 * código executado no browser. Uso restrito a Server Actions/Routes que:
 *  1. derivam todos os parâmetros no servidor (nada vindo do cliente
 *     é confiável para tenant/path/recurso), e
 *  2. não têm alternativa viável via Auth + RLS.
 *
 * Usos aprovados: upload público do QR (path server-side) e convites
 * de membros (auth.admin). Leitura de fotos privadas usa signed URL
 * com a SESSÃO do usuário (sem service role).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente no servidor.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
