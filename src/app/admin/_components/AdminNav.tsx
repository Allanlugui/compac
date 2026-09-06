"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  LayoutDashboard,
  QrCode,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITENS = [
  {
    href: "/admin/dashboard",
    rotulo: "Dashboard",
    Icone: LayoutDashboard,
    ativoEm: (path: string) =>
      path.startsWith("/admin/dashboard") || path.startsWith("/admin/chamados"),
  },
  {
    href: "/admin/ativos",
    rotulo: "Ativos & QR Codes",
    Icone: QrCode,
    ativoEm: (path: string) => path.startsWith("/admin/ativos"),
  },
  {
    href: "/admin/compras",
    rotulo: "Compras",
    Icone: ShoppingCart,
    ativoEm: (path: string) => path.startsWith("/admin/compras"),
  },
  {
    href: "/admin/relatorios",
    rotulo: "Relatórios",
    Icone: ChartColumn,
    ativoEm: (path: string) => path.startsWith("/admin/relatorios"),
  },
];

/** Menu do painel admin (oculto na impressão via header do layout). */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação administrativa"
      className="mx-auto w-full max-w-6xl px-4"
    >
      <ul className="flex gap-1 overflow-x-auto pb-3">
        {ITENS.map(({ href, rotulo, Icone, ativoEm }) => {
          const ativo = ativoEm(pathname);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition",
                  ativo
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-400 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icone className="size-4" />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
