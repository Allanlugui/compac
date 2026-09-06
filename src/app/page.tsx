import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChartColumn,
  LayoutDashboard,
  QrCode,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: "SGA-M · Gestão de Manutenção e Compras",
  description:
    "Hub imersivo do sistema unificado: chamados e solicitações via QR Code, ordens de serviço, compras e auditoria.",
};

const MODULOS = [
  {
    href: "/admin/dashboard",
    titulo: "Dashboard de Manutenção",
    descricao: "Acompanhamento de O.S. por status e execução.",
    Icone: LayoutDashboard,
    classes: "bg-amber-400 text-zinc-950",
  },
  {
    href: "/admin/ativos",
    titulo: "Ativos & QR Codes",
    descricao: "Cadastro de equipamentos e etiquetas.",
    Icone: QrCode,
    classes: "bg-sky-400 text-zinc-950",
  },
  {
    href: "/admin/compras",
    titulo: "Gestão de Compras & Pedidos",
    descricao: "Aprovação, verba e solicitações via QR.",
    Icone: ShoppingCart,
    classes: "bg-emerald-400 text-zinc-950",
    novidade: true,
  },
  {
    href: "/admin/relatorios",
    titulo: "Relatórios & Auditoria",
    descricao: "Métricas, gráficos e logs do sistema.",
    Icone: ChartColumn,
    classes: "bg-violet-400 text-zinc-950",
  },
  {
    href: "/admin/auditoria",
    titulo: "Auditoria & Homologação",
    descricao: "Trilha de logs e saúde do sistema.",
    Icone: ShieldCheck,
    classes: "bg-rose-400 text-zinc-950",
    novidade: true,
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white shadow-2xl sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-emerald-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-sky-500/20 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              Sistema operacional · v2.0
            </span>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="icon-3d flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 ring-1 ring-white/20">
                <Wrench className="size-7" />
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  SGA-M{" "}
                  <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
                    Hub
                  </span>
                </h1>
                <p className="mt-1 max-w-xl text-sm text-zinc-400 sm:text-base">
                  Manutenção e compras em um só lugar — do QR Code na parede à
                  ordem de serviço assinada.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/admin/dashboard"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200"
              >
                Abrir dashboard
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/qr-compra/nova"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
              >
                <ScanLine className="size-4" />
                Solicitar compra via QR
              </Link>
            </div>
          </div>
        </section>

        {/* Módulo de Leitura e Solicitação via QR Code */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card-3d rounded-3xl border border-zinc-200/70 p-6">
            <span className="icon-3d flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <Wrench className="size-5" />
            </span>
            <h2 className="mt-3 text-lg font-black">QR Manutenção</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Escaneie a etiqueta do ativo com o celular para abrir uma O.S. em
              segundos — sem login, com fotos do problema.
            </p>
            <ol className="mt-3 space-y-1.5 text-sm text-zinc-600">
              <li>
                <strong className="text-zinc-900">1.</strong> Cadastre o ativo e
                imprima a etiqueta.
              </li>
              <li>
                <strong className="text-zinc-900">2.</strong> Cole o QR no local
                do equipamento.
              </li>
              <li>
                <strong className="text-zinc-900">3.</strong> Gerencie tudo pelo
                dashboard.
              </li>
            </ol>
            <Link
              href="/admin/ativos"
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              Gerar etiquetas
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="card-3d rounded-3xl border border-emerald-300/70 p-6 ring-1 ring-emerald-200">
            <span className="icon-3d flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
              <ShoppingCart className="size-5" />
            </span>
            <h2 className="mt-3 flex items-center gap-2 text-lg font-black">
              QR Compras
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
                Novo
              </span>
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Qualquer colaborador solicita materiais em segundos pelo celular —
              com acompanhamento público do status do pedido.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600">
              <li className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                Sem login · mobile-first
              </li>
              <li className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                QR de acompanhamento por pedido
              </li>
              <li className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                Log de auditoria automático
              </li>
            </ul>
            <Link
              href="/qr-compra/nova"
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-500"
            >
              Abrir solicitação
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* Grid de Navegação Principal */}
        <h2 className="mt-8 text-sm font-bold tracking-widest text-zinc-500 uppercase">
          Navegação principal
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {MODULOS.map(({ href, titulo, descricao, Icone, classes, novidade }) => (
            <Link
              key={href}
              href={href}
              className="card-3d group flex items-center gap-4 rounded-3xl border border-zinc-200/70 p-5"
            >
              <span
                className={`icon-3d flex size-12 shrink-0 items-center justify-center rounded-2xl ${classes}`}
              >
                <Icone className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-base font-black">
                  {titulo}
                  {novidade && (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                      Novo
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-zinc-500">
                  {descricao}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-zinc-300 transition group-hover:translate-x-1 group-hover:text-zinc-700" />
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400">
          SGA-M v2.0 · Manutenção, Compras e Auditoria
        </p>
      </main>
    </div>
  );
}
