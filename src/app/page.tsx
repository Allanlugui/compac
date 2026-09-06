import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChartColumn,
  LayoutDashboard,
  QrCode,
  ScanLine,
  ShoppingCart,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: "SGA-M · Gestão de Manutenção e Compras",
  description:
    "Portal do sistema unificado de manutenção e compras: chamados via QR Code, ordens de serviço e controle financeiro.",
};

const MODULOS = [
  {
    href: "/admin/dashboard",
    titulo: "Dashboard",
    descricao: "Chamados por status, gerenciamento e execução da manutenção.",
    Icone: LayoutDashboard,
    classes: "bg-amber-100 text-amber-700",
  },
  {
    href: "/admin/ativos",
    titulo: "Ativos & QR Codes",
    descricao: "Cadastro de ativos e impressão das etiquetas de QR Code.",
    Icone: QrCode,
    classes: "bg-sky-100 text-sky-700",
  },
  {
    href: "/admin/compras",
    titulo: "Compras",
    descricao: "Registro de gastos, insumos e despesas gerais.",
    Icone: ShoppingCart,
    classes: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/admin/relatorios",
    titulo: "Relatórios",
    descricao: "Métricas, gráficos analíticos e relatório gerencial.",
    Icone: ChartColumn,
    classes: "bg-violet-100 text-violet-700",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-16">
        {/* Cabeçalho */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Wrench className="size-7" />
          </span>
          <div>
            <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
              Sistema de Gestão de Manutenção e Compras
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              SGA-M
            </h1>
          </div>
        </div>

        {/* Como funciona (fluxo do QR Code) */}
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ScanLine className="size-5 text-zinc-500" />
            Abertura de chamados via QR Code
          </h2>
          <ol className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
            <li className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <strong className="text-zinc-900">1.</strong> Cadastre o ativo e
              imprima a etiqueta em <strong>Ativos & QR Codes</strong>.
            </li>
            <li className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <strong className="text-zinc-900">2.</strong> Quem encontrar um
              problema escaneia o código com o celular.
            </li>
            <li className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <strong className="text-zinc-900">3.</strong> O chamado cai direto
              no <strong>Dashboard</strong> para execução e OS.
            </li>
          </ol>
        </section>

        {/* Módulos */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {MODULOS.map(({ href, titulo, descricao, Icone, classes }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow"
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${classes}`}
              >
                <Icone className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">{titulo}</span>
                <span className="mt-0.5 block truncate text-sm text-zinc-500 sm:whitespace-normal">
                  {descricao}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-600" />
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400">
          SGA-M · Manutenção e Compras · Uso do administrador
        </p>
      </main>
    </div>
  );
}
