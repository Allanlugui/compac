import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import AdminNav from "./_components/AdminNav";

/**
 * Moldura das páginas administrativas com menu de navegação.
 * ETAPA 5: links para Dashboard, Ativos & QR Codes, Compras e Relatórios.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900">
      <header className="bg-zinc-900 text-white print:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/10">
              <Wrench className="size-4.5" />
            </span>
            <div>
              <p className="text-sm leading-tight font-bold">
                SGA-M · Administração
              </p>
              <p className="text-xs text-zinc-400">Manutenção e Compras</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Início
          </Link>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
