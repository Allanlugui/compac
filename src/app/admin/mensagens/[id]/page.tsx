import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { listarMensagens, enviarMensagem } from "@/lib/messages";
import PageHeader from "@/components/ui/PageHeader";

export default async function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  exigirPermissao(ctx, "organograma.ver");
  const msgs = await listarMensagens(id, 50).catch(()=>[]);
  return (
    <div className="space-y-4">
      <PageHeader titulo="Conversa" descricao={id} voltar={{ href: "/admin/mensagens", rotulo: "Mensagens" }} />
      <div className="space-y-2">
        {msgs.map(m=>(
          <div key={m.id} className="rounded-xl border bg-white p-3">
            <p className="text-sm">{m.conteudo}</p>
            <p className="text-xs text-zinc-400">{new Date(m.created_at).toLocaleString("pt-BR")} · {m.sender.slice(0,8)}</p>
          </div>
        ))}
        {msgs.length===0 && <p className="text-sm text-zinc-500">Nenhuma mensagem</p>}
      </div>
      <form action={async (fd: FormData)=>{ "use server"; const c=String(fd.get("conteudo")??""); await enviarMensagem(id,c); }} className="flex gap-2">
        <input name="conteudo" maxLength={2000} placeholder="Mensagem..." className="flex-1 rounded-xl border px-3 py-2" />
        <button type="submit" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Enviar</button>
      </form>
    </div>
  );
}
