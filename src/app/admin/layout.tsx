import Link from "next/link";
import { LogOut, Wrench } from "lucide-react";
import { getMemberships, requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/app/login/actions";
import { BottomNav, SidebarNav } from "./_components/AdminNav";
import BuscaGlobal from "./_components/BuscaGlobal";
import SinoLink from "./_components/SinoNotificacoes";

/**
 * AppShell multi-tenant: contexto de org resolvido no servidor,
 * navegação filtrada por papel, troca de empresa e sair.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireOrg();
  const memberships = await getMemberships();

  let naoLidas = 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("lida", false)
      .or(`user_id.is.null,user_id.eq.${ctx.userId}`);
    naoLidas = count ?? 0;
  } catch {
    naoLidas = 0;
  }

  return (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900 md:pl-20 lg:pl-64 print:pl-0">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-zinc-900 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>
      <SidebarNav papel={ctx.role} orgNome={ctx.orgNome} multiOrg={memberships.length > 1} naoLidas={naoLidas} />
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-100/90 backdrop-blur md:hidden print:hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <Wrench className="size-4" />
              </span>
              <span className="truncate text-sm font-extrabold">SGA-M</span>
            </span>
            <span className="flex items-center gap-1">
              <BuscaGlobal mobile />
              <SinoLink total={naoLidas} mobile />
              <Link
                href="/"
                className="inline-flex min-h-[40px] items-center rounded-lg px-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
              >
                Portal
              </Link>
              <form action={sair}>
                <button
                  type="submit"
                  aria-label="Sair"
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
                >
                  <LogOut className="size-4" />
                  Sair
                </button>
              </form>
            </span>
          </div>
        </header>
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-28 sm:px-6 md:pb-10"
        >
          {children}
        </main>
        <BottomNav papel={ctx.role} />
      </div>
    </div>
  );
}
