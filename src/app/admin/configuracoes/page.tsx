import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

export const metadata: Metadata = { title: "Configurações · SGA-M" };

interface Item {
  titulo: string;
  descricao: string;
  href: string;
}

interface Grupo {
  titulo: string;
  itens: Item[];
}

/**
 * BLOCO 3.6 — Centro administrativo por responsabilidade (não grade de cards).
 * Só destinos reais; E-mail templates, Atendimento/Agente e Gerais chegam
 * nos blocos próprios, sem botões falsos.
 */
const GRUPOS: Grupo[] = [
  {
    titulo: "Organização",
    itens: [
      { titulo: "Estrutura", descricao: "Árvore unidade → sala e categorias", href: "/admin/estrutura" },
      { titulo: "Cadastros", descricao: "Departamentos, centros de custo e almoxarifados", href: "/admin/cadastros" },
    ],
  },
  {
    titulo: "Pessoas e acesso",
    itens: [
      { titulo: "Usuários", descricao: "Membros, perfis e acesso", href: "/admin/usuarios" },
      { titulo: "Permissões", descricao: "Matriz por perfil + overrides por usuário", href: "/admin/usuarios" },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { titulo: "Links e QR Codes", descricao: "Contextos de QR e tokens de entrada", href: "/admin/qr-compras" },
      { titulo: "Notificações", descricao: "Central do sino e regras de envio", href: "/admin/notificacoes" },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { titulo: "Auditoria", descricao: "Trilha imutável de mutações", href: "/admin/auditoria" },
      { titulo: "Monitoramento", descricao: "Saúde operacional e preventivas", href: "/admin/monitoramento" },
    ],
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
        descricao={`${ctx.orgNome} · o que precisa configurar, agrupado por responsabilidade.`}
      />
      <div className="space-y-4">
        {GRUPOS.map((g) => (
          <section key={g.titulo} aria-label={g.titulo}>
            <h2 className="text-sm font-black uppercase tracking-wide text-zinc-700">{g.titulo}</h2>
            <ul className="mt-2 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm">
              {g.itens.map((item) => (
                <li key={item.titulo} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900">{item.titulo}</p>
                    <p className="truncate text-xs text-zinc-500">{item.descricao}</p>
                  </div>
                  <Button variante="secondary" tamanho="sm" href={item.href}>
                    Abrir →
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
