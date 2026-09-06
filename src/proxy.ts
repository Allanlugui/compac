import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16: Proxy (ex-Middleware). Refresh de sessão + gate de rotas.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Server Actions (POST + header next-action) recebem JSON, nunca redirect
  // do proxy: redirecionar aqui quebra a action com "unexpected response".
  // A navegação client-side (router.push) aplica as regras no GET seguinte.
  if (request.headers.has("next-action") || request.method !== "GET") {
    return supabaseResponse;
  }

  const rotaAdmin = path.startsWith("/admin");
  const rotaAuth =
    path === "/login" ||
    path === "/recuperar-senha" ||
    path === "/atualizar-senha" ||
    path.startsWith("/auth/");

  // Expirada/ausente em área protegida → login com destino e aviso.
  if (!user && rotaAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    url.searchParams.set("expired", "1");
    return NextResponse.redirect(url);
  }

  // Senha provisória: só /primeiro-acesso até definir a permanente.
  if (
    user &&
    user.user_metadata?.must_change_password === true &&
    (rotaAdmin || path === "/login") &&
    path !== "/primeiro-acesso"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/primeiro-acesso";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Logado tentando abrir telas de auth → dashboard.
  if (user && rotaAuth && !path.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
