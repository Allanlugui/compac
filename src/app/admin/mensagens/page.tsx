import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import { listarConversas } from "@/lib/messages";
import Link from "next/link";

export const metadata = { title: "Mensagens · SGA-M" };

export default async function MensagensPage() {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "organograma.ver");
  const conversas = await listarConversas();
  return (
    <div className="space-y-6">
      <PageHeader titulo="Mensagens" descricao={`${ctx.orgNome} · conversas 1:1`} />
      {conversas.length===0 ? <p className="text-sm text-zinc-500">Nenhuma conversa. Inicie via Organograma → pessoa → Enviar mensagem.</p> : (
        <ul className="space-y-2">
          {conversas.map(c=>(
            <li key={c.id}><Link href={`/admin/mensagens/${c.id}`} className="flex items-center justify-between rounded-xl border bg-white p-3 hover:bg-zinc-50"><span>{c.participantes.join(", ")}</span><span className="text-xs text-zinc-400">{c.ultima ?? "—"}</span></Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
