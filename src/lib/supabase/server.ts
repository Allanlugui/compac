import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para uso no servidor (Server Components,
 * Server Actions e Route Handlers do App Router).
 *
 * Observação Next.js 16: `cookies()` é assíncrono — por isso
 * `createClient()` também é assíncrono (`await createClient()`).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` foi chamado a partir de um Server Component.
            // A escrita de cookies só é permitida em Server Actions
            // e Route Handlers — pode ser ignorada com segurança aqui.
          }
        },
      },
    },
  );
}
