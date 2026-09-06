import Link from "next/link";
import { BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { Notificacao } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { marcarLida, marcarTodasLidas } from "./actions";

export const metadata = { title: "Notificações · SGA-M" };

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const ctx = await requireOrg();

  const { data } = await supabase
    .from("notificacoes")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .or(`user_id.is.null,user_id.eq.${ctx.userId}`)
    .order("created_at", { ascending: false })
    .limit(100);

  const itens = (data ?? []) as Notificacao[];
  const naoLidas = itens.filter((n) => !n.lida).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notificações"
        descricao={`${naoLidas} não lidas · ${ctx.orgNome}`}
        acoes={
          naoLidas > 0 ? (
            <form action={marcarTodasLidas}>
              <button type="submit" className="inline-flex min-h-[40px] items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50">
                Marcar todas como lidas
              </button>
            </form>
          ) : undefined
        }
      />
      {itens.length === 0 ? (
        <EmptyState Icone={BellOff} titulo="Nada por aqui" descricao="Alertas de O.S., aprovações e estoque aparecem neste centro." />
      ) : (
        <ul className="space-y-2">
          {itens.map((n) => (
            <li key={n.id} className={`rounded-2xl border p-4 shadow-sm ${n.lida ? "border-zinc-200 bg-white" : "border-zinc-900 bg-white ring-1 ring-zinc-900"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black">{n.titulo}</p>
                  {n.descricao && <p className="mt-0.5 text-sm text-zinc-600">{n.descricao}</p>}
                  <p className="mt-1 text-xs text-zinc-400">{formatarDataHora(n.created_at)}</p>
                </div>
                {!n.lida && (
                  <form action={marcarLida.bind(null, n.id)}>
                    <button type="submit" className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700">
                      Lida
                    </button>
                  </form>
                )}
              </div>
              {n.link && (
                <Link href={n.link} className="mt-2 inline-block text-xs font-bold text-zinc-700 underline-offset-2 hover:underline">
                  Abrir →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
