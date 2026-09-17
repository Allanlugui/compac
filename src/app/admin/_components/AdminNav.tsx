"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ChartColumn,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Package,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { sair } from "@/app/login/actions";
import BuscaGlobal from "./BuscaGlobal";
import SinoLink from "./SinoNotificacoes";

type Icone = (p: { className?: string }) => React.ReactNode;

export interface ItemNav {
  href: string;
  rotulo: string;
  Icone: Icone;
  ativoEm: (path: string) => boolean;
  papeis: Role[];
}

export interface SecaoNav {
  titulo: string;
  itens: ItemNav[];
}

const TODOS: Role[] = ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR", "SOLICITANTE"];
const OPERACIONAL: Role[] = ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR"];
const SUPRIMENTOS: Role[] = ["ADMIN", "GESTOR", "COMPRAS"];

/** Fonte única de verdade da navegação, filtrada por papel. */
export const SECOES_NAV: SecaoNav[] = [
  {
    titulo: "Operação",
    itens: [
      {
        href: "/admin/dashboard",
        rotulo: "Dashboard",
        Icone: LayoutDashboard,
        ativoEm: (p) => p.startsWith("/admin/dashboard"),
        papeis: TODOS,
      },
      {
        href: "/admin/ativos",
        rotulo: "Ativos",
        Icone: QrCode,
        ativoEm: (p) => p.startsWith("/admin/ativos"),
        papeis: ["ADMIN", "GESTOR", "TECNICO"],
      },
      {
        href: "/admin/chamados",
        rotulo: "Chamados",
        Icone: ClipboardCheck,
        ativoEm: (p) => p.startsWith("/admin/chamados"),
        papeis: TODOS,
      },
      {
        href: "/admin/ordens-servico",
        rotulo: "Ordens de Serviço",
        Icone: Wrench,
        ativoEm: (p) => p.startsWith("/admin/ordens-servico"),
        papeis: ["ADMIN", "GESTOR", "TECNICO", "AUDITOR"],
      },
      {
        href: "/admin/preventivas",
        rotulo: "Preventivas",
        Icone: ClipboardCheck,
        ativoEm: (p) => p.startsWith("/admin/preventivas"),
        papeis: ["ADMIN", "GESTOR", "TECNICO"],
      },
      {
        href: "/admin/calendario",
        rotulo: "Calendário",
        Icone: CalendarClock,
        ativoEm: (p) => p.startsWith("/admin/calendario"),
        papeis: TODOS,
      },
    ],
  },
  {
    titulo: "Suprimentos",
    itens: [
      {
        href: "/admin/estoque",
        rotulo: "Estoque",
        Icone: Package,
        ativoEm: (p) => p.startsWith("/admin/estoque"),
        papeis: OPERACIONAL,
      },
      {
        href: "/admin/compras/solicitacoes",
        rotulo: "Solicitações",
        Icone: ClipboardCheck,
        ativoEm: (p) => p.startsWith("/admin/compras/solicitacoes"),
        papeis: TODOS,
      },
      {
        href: "/admin/compras",
        rotulo: "Compras",
        Icone: ShoppingCart,
        ativoEm: (p) => p.startsWith("/admin/compras") && !p.startsWith("/admin/compras/solicitacoes") && !p.startsWith("/admin/compras/pedidos"),
        papeis: SUPRIMENTOS,
      },
      {
        href: "/admin/fornecedores",
        rotulo: "Fornecedores",
        Icone: Truck,
        ativoEm: (p) => p.startsWith("/admin/fornecedores"),
        papeis: SUPRIMENTOS,
      },
    ],
  },
  {
    titulo: "Inteligência",
    itens: [
      {
        href: "/admin/relatorios",
        rotulo: "Relatórios",
        Icone: ChartColumn,
        ativoEm: (p) => p.startsWith("/admin/relatorios"),
        papeis: ["ADMIN", "GESTOR", "COMPRAS", "AUDITOR"],
      },
      {
        href: "/admin/mapa",
        rotulo: "Mapa",
        Icone: Building2,
        ativoEm: (p) => p.startsWith("/admin/mapa") || p.startsWith("/admin/estrutura"),
        papeis: TODOS,
      },
      {
        href: "/admin/busca",
        rotulo: "Busca",
        Icone: Building2,
        ativoEm: (p) => p.startsWith("/admin/busca"),
        papeis: TODOS,
      },
      {
        href: "/admin/organograma",
        rotulo: "Organograma",
        Icone: Users,
        ativoEm: (p) => p.startsWith("/admin/organograma"),
        papeis: TODOS,
      },
      {
        href: "/admin/mensagens",
        rotulo: "Mensagens",
        Icone: Users,
        ativoEm: (p) => p.startsWith("/admin/mensagens"),
        papeis: TODOS,
      },
      {
        href: "/admin/desempenho",
        rotulo: "Desempenho",
        Icone: ChartColumn,
        ativoEm: (p) => p.startsWith("/admin/desempenho"),
        papeis: TODOS,
      },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      {
        href: "/admin/estrutura",
        rotulo: "Estrutura",
        Icone: Building2,
        ativoEm: (p) => p.startsWith("/admin/estrutura"),
        papeis: ["ADMIN", "GESTOR"],
      },
      {
        href: "/admin/cadastros",
        rotulo: "Cadastros",
        Icone: ClipboardCheck,
        ativoEm: (p) => p.startsWith("/admin/cadastros"),
        papeis: ["ADMIN", "GESTOR"],
      },
      {
        href: "/admin/usuarios",
        rotulo: "Usuários",
        Icone: Users,
        ativoEm: (p) => p.startsWith("/admin/usuarios"),
        papeis: ["ADMIN"],
      },
      {
        href: "/admin/auditoria",
        rotulo: "Auditoria",
        Icone: ShieldCheck,
        ativoEm: (p) => p.startsWith("/admin/auditoria"),
        papeis: ["ADMIN", "GESTOR", "AUDITOR"],
      },
      {
        href: "/admin/monitoramento",
        rotulo: "Monitoramento",
        Icone: Building2,
        ativoEm: (p) => p.startsWith("/admin/monitoramento"),
        papeis: ["ADMIN", "GESTOR", "AUDITOR"],
      },
      {
        href: "/admin/perfil",
        rotulo: "Meu Perfil",
        Icone: Users,
        ativoEm: (p) => p.startsWith("/admin/perfil"),
        papeis: TODOS,
      },
    ],
  },
];

/** Bottom mobile: 6 destinos principais, filtrados por papel. */
const ITENS_BOTTOM: ItemNav[] = [
  {
    href: "/admin/dashboard",
    rotulo: "Painel",
    Icone: LayoutDashboard,
    ativoEm: (p) => p.startsWith("/admin/dashboard"),
    papeis: TODOS,
  },
  {
    href: "/admin/chamados",
    rotulo: "Chamados",
    Icone: ClipboardCheck,
    ativoEm: (p) => p.startsWith("/admin/chamados") || p.startsWith("/admin/ordens-servico"),
    papeis: TODOS,
  },
  {
    href: "/admin/ativos",
    rotulo: "Ativos",
    Icone: QrCode,
    ativoEm: (p) => p.startsWith("/admin/ativos"),
    papeis: ["ADMIN", "GESTOR", "TECNICO"],
  },
  {
    href: "/admin/estoque",
    rotulo: "Estoque",
    Icone: Package,
    ativoEm: (p) => p.startsWith("/admin/estoque"),
    papeis: OPERACIONAL,
  },
  {
    href: "/admin/compras/solicitacoes",
    rotulo: "Solicit.",
    Icone: ShoppingCart,
    ativoEm: (p) => p.startsWith("/admin/compras"),
    papeis: TODOS,
  },
  {
    href: "/admin/mapa",
    rotulo: "Mapa",
    Icone: Building2,
    ativoEm: (p) => p.startsWith("/admin/mapa") || p.startsWith("/admin/busca"),
    papeis: TODOS,
  },
];

function BotaoSair({ compacto }: { compacto?: boolean }) {
  return (
    <form action={sair}>
      <button
        type="submit"
        title="Sair"
        className={
          compacto
            ? "inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
            : "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-white"
        }
      >
        <LogOut className="size-4 shrink-0" />
        {compacto ? "Sair" : <span className="hidden lg:inline">Sair</span>}
      </button>
    </form>
  );
}

export interface ShellProps {
  papel: Role;
  orgNome: string;
  multiOrg: boolean;
  naoLidas: number;
}

/**
 * Sidebar fixa: rail no tablet, expandida no desktop. Filtra por papel,
 * exibe a org ativa com troca, busca, sino e sair. Oculta na impressão.
 */
export function SidebarNav({ papel, orgNome, multiOrg, naoLidas }: ShellProps) {
  const pathname = usePathname();
  const visivel = (papeis: Role[]) => papeis.includes(papel);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col bg-zinc-950 text-white md:flex lg:w-64 print:hidden">
      <Link
        href="/"
        className="flex items-center gap-2.5 px-4 py-4 lg:px-5"
        aria-label="SGA-M — voltar ao início"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Wrench className="size-4.5" />
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block text-sm leading-tight font-extrabold">SGA-M</span>
          <span className="block truncate text-[11px] text-zinc-400">{orgNome}</span>
        </span>
      </Link>

      <div className="px-2.5 pt-1 lg:px-3">
        <div className="flex justify-center lg:hidden">
          <BuscaGlobal mobile />
        </div>
        <div className="hidden lg:block">
          <BuscaGlobal />
        </div>
      </div>

      {multiOrg && (
        <div className="px-2.5 lg:px-3">
          <Link
            href="/selecionar-org"
            title={`Trocar organização (atual: ${orgNome})`}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-white/5 px-2 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <Building2 className="size-4 shrink-0" />
            <span className="hidden truncate lg:inline">Trocar empresa</span>
          </Link>
        </div>
      )}

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2.5 py-2 lg:px-3">
        {SECOES_NAV.map((secao) => {
          const itens = secao.itens.filter((i) => visivel(i.papeis));
          if (itens.length === 0) return null;
          return (
            <div key={secao.titulo} className="mb-4">
              <p className="hidden px-2 pb-1.5 text-[11px] font-bold tracking-widest text-zinc-500 uppercase lg:block">
                {secao.titulo}
              </p>
              <ul className="space-y-1">
                {itens.map(({ href, rotulo, Icone, ativoEm }) => {
                  const ativo = ativoEm(pathname);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={ativo ? "page" : undefined}
                        title={rotulo}
                        className={cn(
                          "flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl px-2 text-sm font-semibold transition lg:justify-start lg:px-3",
                          ativo
                            ? "bg-white/10 text-white shadow-inner"
                            : "text-zinc-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icone className="size-5 shrink-0" />
                        <span className="hidden truncate lg:inline">{rotulo}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center justify-center gap-1 lg:justify-start">
          <SinoLink total={naoLidas} />
          <div className="hidden lg:block">
            <BotaoSair />
          </div>
          <div className="lg:hidden">
            <BotaoSair compacto />
          </div>
        </div>
        <p className="mt-1 hidden px-3 text-[11px] text-zinc-600 lg:block">
          {papel} · v3.0
        </p>
      </div>
    </aside>
  );
}

/**
 * Navegação inferior mobile, filtrada por papel. Respeita a safe-area.
 */
export function BottomNav({ papel }: { papel: Role }) {
  const pathname = usePathname();
  const itens = ITENS_BOTTOM.filter((i) => i.papeis.includes(papel));

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur md:hidden print:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(itens.length, 1)}, minmax(0, 1fr))` }}>
        {itens.map(({ href, rotulo, Icone, ativoEm }) => {
          const ativo = ativoEm(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-[10px] font-bold transition",
                  ativo ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-700",
                )}
              >
                <Icone className="size-5" />
                {rotulo}
                <span
                  aria-hidden
                  className={cn(
                    "h-1 w-1 rounded-full",
                    ativo ? "bg-zinc-900" : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
