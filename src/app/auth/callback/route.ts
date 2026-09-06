import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Troca `code` por sessão (login, convite, recovery) e redireciona. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin/dashboard";

  if (code) {
    const jar = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => jar.getAll(),
          setAll: (lista) => {
            lista.forEach(({ name, value, options }) => {
              try {
                jar.set(name, value, options);
              } catch {
                // Route Handler permite escrita; fallback silencioso.
              }
            });
          },
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?expired=1", request.url));
}
