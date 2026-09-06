import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChartColumn,
  Check,
  CircleX,
  FileText,
  LayoutDashboard,
  QrCode,
  ScanLine,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  Wrench,
} from "lucide-react";
import StatusBadge from "@/app/admin/_components/StatusBadge";

export const metadata: Metadata = {
  title: "SGA-M · Gestão de Ativos, Manutenção e Suprimentos",
  description:
    "Plataforma operacional: do QR Code na parede à ordem de serviço assinada. Chamados, ativos, compras, relatórios e auditoria em um só lugar.",
};

const PROBLEMAS = [
  { titulo: "Planilhas soltas", descricao: "Controle fragmentado em arquivos que ninguém versiona." },
  { titulo: "Papel e WhatsApp", descricao: "Pedidos se perdem no meio de mensagens e papéis." },
  { titulo: "Chamados perdidos", descricao: "Sem registro central, ninguém sabe o que está aberto." },
  { titulo: "Ausência de histórico", descricao: "Falhas se repetem porque o passado não foi registrado." },
  { titulo: "Falta de rastreabilidade", descricao: "Impossível dizer quem fez o quê e quando." },
  { titulo: "Compras descentralizadas", descricao: "Gastos sem aprovação, vínculo ou prestação de contas." },
];

const FLUXO = [
  { Icone: QrCode, titulo: "QR Code", descricao: "Etiqueta no ativo ou pedido pelo celular." },
  { Icone: Ticket, titulo: "Chamado", descricao: "Registro imediato, com fotos e solicitante." },
  { Icone: FileText, titulo: "Ordem de Serviço", descricao: "Execução formal, imprimível e assinável." },
  { Icone: ShoppingCart, titulo: "Compras", descricao: "Insumos vinculados, com aprovação e verba." },
  { Icone: ScrollText, titulo: "Histórico", descricao: "Tudo registrado por ativo e por período." },
  { Icone: ShieldCheck, titulo: "Auditoria", descricao: "Trilha de cada mutação, pronta para homologar." },
];

const MODULOS = [
  { href: "/admin/dashboard", titulo: "Dashboard", descricao: "Centro de comando das O.S. por status.", Icone: LayoutDashboard },
  { href: "/admin/ativos", titulo: "Ativos & QR Codes", descricao: "Cadastro, etiquetas e impressão.", Icone: QrCode },
  { href: "/qr-compra/nova", titulo: "Solicitações via QR", descricao: "Pedidos mobile com acompanhamento.", Icone: ScanLine },
  { href: "/admin/compras", titulo: "Compras", descricao: "Aprovação, financeiro e pedidos.", Icone: ShoppingCart },
  { href: "/admin/relatorios", titulo: "Relatórios", descricao: "Custos, SLA e ativos críticos.", Icone: ChartColumn },
  { href: "/admin/auditoria", titulo: "Auditoria", descricao: "Logs, diffs e homologação.", Icone: ShieldCheck },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-white text-zinc-900">
      {/* Navegação */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Wrench className="size-4.5" />
            </span>
            <span className="text-base font-extrabold tracking-tight">SGA-M</span>
          </span>
          <nav aria-label="Navegação da página" className="hidden items-center gap-6 text-sm font-semibold text-zinc-600 md:flex">
            <a href="#plataforma" className="transition hover:text-zinc-900">Plataforma</a>
            <a href="#problemas" className="transition hover:text-zinc-900">Problemas</a>
            <a href="#modulos" className="transition hover:text-zinc-900">Módulos</a>
          </nav>
          <Link
            href="/admin/dashboard"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white transition hover:bg-zinc-700"
          >
            Acessar sistema
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-10 sm:pt-20 sm:pb-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700 ring-1 ring-zinc-200">
                <span className="size-2 rounded-full bg-emerald-500" />
                Plataforma operacional · v2.0
              </span>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-5xl">
                Gestão inteligente de ativos, manutenção e suprimentos.
              </h1>
              <p className="mt-4 max-w-xl text-base text-zinc-600 sm:text-lg">
                Do QR Code colado no equipamento à ordem de serviço assinada:
                chamados, compras, custos, relatórios e auditoria em uma única
                aplicação — no desktop, no tablet e no celular.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/admin/dashboard"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-7 text-base font-bold text-white transition hover:bg-zinc-700"
                >
                  Acessar sistema
                  <ArrowRight className="size-5" />
                </Link>
                <a
                  href="#plataforma"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-zinc-300 px-7 text-base font-bold text-zinc-800 transition hover:bg-zinc-50"
                >
                  Conhecer a plataforma
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                {["QR Code", "Ordem de Serviço", "Compras", "Auditoria"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5">
                    <Check className="size-3.5 text-emerald-600" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pré-visualização com componentes reais */}
            <div aria-label="Pré-visualização ilustrativa da interface do dashboard">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
                <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                  <span className="size-2.5 rounded-full bg-zinc-300" />
                  <span className="size-2.5 rounded-full bg-zinc-300" />
                  <span className="size-2.5 rounded-full bg-zinc-300" />
                  <span className="ml-2 text-xs font-semibold text-zinc-500">
                    Dashboard · interface real
                  </span>
                </div>
                <ul className="space-y-2 p-4">
                  {(
                    [
                      { nome: "Ar-condicionado · Recepção", status: "aberto" },
                      { nome: "Bomba hidráulica · Subsolo", status: "em_andamento" },
                      { nome: "Iluminação · Corredor B", status: "concluido" },
                    ] as const
                  ).map(({ nome, status }) => (
                    <li
                      key={nome}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{nome}</p>
                        <div className="mt-1.5 h-2 w-32 rounded bg-zinc-100" />
                      </div>
                      <StatusBadge status={status} />
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 text-center text-xs text-zinc-400">
                Pré-visualização ilustrativa com componentes reais do sistema.
              </p>
            </div>
          </div>
        </section>

        {/* Problema */}
        <section id="problemas" className="border-y border-zinc-200 bg-zinc-50 scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
            <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
              O problema
            </p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-balance sm:text-3xl">
              Operações que dependem de improviso perdem dinheiro todos os dias.
            </h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROBLEMAS.map(({ titulo, descricao }) => (
                <li key={titulo} className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <CircleX className="size-5 text-red-500" />
                  <p className="mt-2 text-sm font-extrabold">{titulo}</p>
                  <p className="mt-1 text-sm text-zinc-600">{descricao}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Solução / fluxo */}
        <section id="plataforma" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-12 sm:py-16">
          <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
            A solução
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-balance sm:text-3xl">
            Um fluxo único, do problema à prestação de contas.
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FLUXO.map(({ Icone, titulo, descricao }, i) => (
              <li key={titulo} className="relative rounded-2xl border border-zinc-200 bg-white p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
                  <Icone className="size-5" />
                </span>
                <p className="mt-3 text-sm font-extrabold">
                  <span className="mr-1.5 font-mono text-xs text-zinc-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {titulo}
                </p>
                <p className="mt-1 text-sm text-zinc-600">{descricao}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Módulos */}
        <section id="modulos" className="border-t border-zinc-200 bg-zinc-950 text-white scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
            <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
              Módulos
            </p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-balance sm:text-3xl">
              Tudo o que a operação precisa, sem trocar de sistema.
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODULOS.map(({ href, titulo, descricao, Icone }) => (
                <Link
                  key={href + titulo}
                  href={href}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/25 hover:bg-white/10"
                >
                  <Icone className="size-6 text-zinc-300 transition group-hover:text-white" />
                  <p className="mt-3 flex items-center gap-1.5 text-base font-extrabold">
                    {titulo}
                    <ArrowRight className="size-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">{descricao}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 text-center sm:p-12">
            <h2 className="mx-auto max-w-xl text-2xl font-black tracking-tight text-balance sm:text-3xl">
              Centralize sua operação em uma única plataforma.
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-600 sm:text-base">
              Ativos, manutenção, compras, relatórios e auditoria — acessível do
              celular ao desktop.
            </p>
            <Link
              href="/admin/dashboard"
              className="mt-6 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 text-base font-bold text-white transition hover:bg-zinc-700"
            >
              Entrar no SGA-M
              <ArrowRight className="size-5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-zinc-700">SGA-M v2.0 · Gestão operacional</p>
          <p>Requer conexão com a internet · Dados no Supabase</p>
        </div>
      </footer>
    </div>
  );
}
