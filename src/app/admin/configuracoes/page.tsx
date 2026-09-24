import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Configurações · SGA-M" };

interface Secao {
  titulo: string;
  descricao: string;
  href: string;
  rotulo: string;
  futuro?: string;
}

/**
 * FASE A — Centro de configurações (fundação).
 * Só links reais; evoluções (chatbot/IA, templates, notificações)
 * chegam nas fases seguintes, sem controles falsos.
 */
const SECOES: Secao[] = [
  {
    titulo: "Usuários e permissões",
    descricao: "Membros, perfis e overrides granulares por usuário (matriz + escopo).",
    href: "/admin/usuarios",
    rotulo: "Abrir usuários",
    futuro: "Fase A+: matriz por papel editável aqui.",
  },
  {
    titulo: "Cadastros mestres",
    descricao: "Departamentos, centros de custo e almoxarifados.",
    href: "/admin/cadastros",
    rotulo: "Abrir cadastros",
  },
  {
    titulo: "Estrutura física",
    descricao: "Árvore unidade → sala e categorias.",
    href: "/admin/estrutura",
    rotulo: "Abrir estrutura",
  },
  {
    titulo: "QR e links públicos",
    descricao: "Contextos de QR e tokens de entrada.",
    href: "/admin/qr-compras",
    rotulo: "Abrir QR",
    futuro: "Fase C: links de atendimento configuráveis.",
  },
  {
    titulo: "E-mail",
    descricao: "Pipeline evento → template → provider SMTP (server-only).",
    href: "/admin/monitoramento",
    rotulo: "Ver monitoramento",
    futuro: "Fase B: templates editáveis + log de envios.",
  },
  {
    titulo: "Auditoria",
    descricao: "Trilha imutável de mutações.",
    href: "/admin/auditoria",
    rotulo: "Abrir auditoria",
  },
];

export default async function ConfiguracoesPage() {
  const ctx = await requireOrg();
  try {
    exigirPermissao(ctx, "usuarios.administrar");
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Configurações" descricao="Centro de configurações do sistema." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita a administradores de TI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configurações"
        descricao={`${ctx.orgNome} · centro de configurações do sistema (fundação FASE A).`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {SECOES.map((s) => (
          <section key={s.titulo} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-zinc-900">{s.titulo}</h2>
            <p className="mt-1 text-xs text-zinc-500">{s.descricao}</p>
            {s.futuro && (
              <p className="mt-1 text-[11px] font-bold text-amber-700">{s.futuro}</p>
            )}
            <Link
              href={s.href}
              className="mt-3 inline-flex min-h-[40px] items-center rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-700"
            >
              {s.rotulo}
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
