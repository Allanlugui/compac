import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { gerarNotificacaoIdempotente } from "@/lib/notificacoes";
import { registrarLog } from "@/lib/auditoria";

const BUCKET = "manutencao-midia";
function convPath(orgId: string, convId: string) { return `o/${orgId}/mensagens/${convId}.json`; }
function listPath(orgId: string) { return `o/${orgId}/mensagens/index.json`; }

// DB oficial (schema_v22) com fallback Storage se tabela não existir (homologação ainda sem v22)
async function isDbAvailable(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("conversas").select("id").limit(1);
    if (error) {
      if (String(error.message).includes("Could not find the table")) return false;
      // Não mascarar permission/network error como fallback quando schema deveria existir
      throw error;
    }
    return true;
  } catch (e) {
    if (String((e as Error).message).includes("Could not find the table")) return false;
    throw e;
  }
}
async function loadIndex(orgId: string): Promise<Record<string, { participantes: string[]; created_at: string }>> {
  if (await isDbAvailable()) {
    const supabase = await createClient();
    const { data } = await supabase.from("conversas").select("id").eq("organization_id", orgId);
    const idx: Record<string, { participantes: string[]; created_at: string }> = {};
    for (const c of (data ?? []) as { id: string }[]) {
      const { data: parts } = await supabase.from("conversa_participantes").select("user_id").eq("conversa_id", c.id);
      // need membership ids, not user_ids, but for fallback we use user_ids
      idx[c.id] = { participantes: (parts ?? []).map(p=>(p as { user_id: string }).user_id), created_at: "" };
    }
    return idx;
  }
  const svc = createServiceClient();
  const { data } = await svc.storage.from(BUCKET).download(listPath(orgId));
  if (!data) return {};
  try { return JSON.parse(await data.text()); } catch { return {}; }
}
async function saveIndex(orgId: string, idx: Record<string, { participantes: string[]; created_at: string }>) {
  if (await isDbAvailable()) return; // DB é fonte oficial, não usa storage index
  const svc = createServiceClient();
  await svc.storage.from(BUCKET).upload(listPath(orgId), Buffer.from(JSON.stringify(idx)), { contentType: "application/json", upsert: true });
}

export async function criarOuObterConversa(destinatarioMembershipId: string): Promise<{ id: string; existente: boolean }> {
  const ctx = await requireOrg();
  const supabase = await createClient();
  const { data: dest } = await supabase.from("memberships").select("id, organization_id, status, user_id").eq("id", destinatarioMembershipId).eq("organization_id", ctx.orgId).eq("status","ativo").maybeSingle();
  if (!dest) throw new Error("Destinatário inválido ou outra organização");
  const { data: myMem } = await supabase.from("memberships").select("id, user_id").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).eq("status","ativo").maybeSingle();
  if (!myMem) throw new Error("Sua membership não encontrada");
  const myId = (myMem as { id: string }).id;
  if (myId === destinatarioMembershipId) throw new Error("Não pode conversar consigo mesmo");

  if (await isDbAvailable()) {
    const { data, error } = await supabase.rpc("criar_ou_obter_conversa", { p_destinatario: destinatarioMembershipId, p_organization_id: ctx.orgId });
    if (error) throw new Error(error.message);
    const convId = data as string;
    // Para determinar existente, verificar se conversa já tinha mensagens antes (ou se foi criada agora)
    // Simplificado: se a conversa já existia, ela já está em conversa_pares, mas não sabemos se era nova ou existente; vamos checar created_at
    const { data: conv } = await supabase.from("conversas").select("created_at").eq("id", convId).maybeSingle();
    const isNew = conv && new Date((conv as { created_at: string }).created_at).getTime() > Date.now() - 2000;
    return { id: convId, existente: !isNew };
  }

  const idx = await loadIndex(ctx.orgId);
  const pair = [myId, destinatarioMembershipId].sort().join("|");
  for (const [cid, v] of Object.entries(idx)) {
    if (v.participantes.sort().join("|") === pair) return { id: cid, existente: true };
  }
  const convId = crypto.randomUUID();
  idx[convId] = { participantes: [myId, destinatarioMembershipId], created_at: new Date().toISOString() };
  await saveIndex(ctx.orgId, idx);
  const svc = createServiceClient();
  await svc.storage.from(BUCKET).upload(convPath(ctx.orgId, convId), Buffer.from(JSON.stringify([])), { contentType: "application/json", upsert: true });
  await registrarLog(supabase as never, { tabela: "conversas", registro_id: convId, acao: "INSERT", dados_anteriores: null, dados_novos: { participantes: [myId, destinatarioMembershipId] }, executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId });
  return { id: convId, existente: false };
}

export async function enviarMensagem(conversaId: string, conteudo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  const supabase = await createClient();
  const texto = conteudo.trim();
  if (texto.length < 1) return { ok: false, error: "Mensagem vazia" };
  if (texto.length > 2000) return { ok: false, error: "Máx 2000 caracteres" };

  if (await isDbAvailable()) {
    const { data: conv } = await supabase.from("conversas").select("id, organization_id").eq("id", conversaId).eq("organization_id", ctx.orgId).maybeSingle();
    if (!conv) return { ok: false, error: "Conversa não encontrada" };
    const { data: myMem } = await supabase.from("memberships").select("id").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).maybeSingle();
    const myId = (myMem as { id: string } | null)?.id;
    if (!myId) return { ok: false, error: "Não participante" };
    const { data: part } = await supabase.from("conversa_participantes").select("membership_id").eq("conversa_id", conversaId).eq("membership_id", myId).maybeSingle();
    if (!part) return { ok: false, error: "Não participante" };
    const { data: myMem2 } = await supabase.from("memberships").select("id").eq("id", myId).maybeSingle();
    const senderMid = (myMem2 as { id: string }).id;
    const { error } = await supabase.from("mensagens").insert({ conversa_id: conversaId, organization_id: ctx.orgId, sender_membership_id: senderMid, conteudo: texto } as never);
    if (error) return { ok: false, error: error.message };
    // atualizar updated_at da conversa
    await supabase.from("conversas").update({ updated_at: new Date().toISOString() } as never).eq("id", conversaId);
    // notificação
    const { data: parts } = await supabase.from("conversa_participantes").select("membership_id, user_id").eq("conversa_id", conversaId);
    const outro = (parts as { membership_id: string; user_id: string }[] | null)?.find(p=>p.membership_id !== myId);
    if (outro) await gerarNotificacaoIdempotente({ tipo: "mensagem_recebida", titulo: "Nova mensagem", descricao: texto.slice(0,60), link: `/admin/mensagens/${conversaId}`, userId: outro.user_id, janelaHoras: 1 });
    await registrarLog(supabase as never, { tabela: "mensagens", registro_id: conversaId, acao: "INSERT", dados_anteriores: null, dados_novos: { conversaId }, executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId });
    return { ok: true };
  }

  const idx = await loadIndex(ctx.orgId);
  const conv = idx[conversaId];
  if (!conv) return { ok: false, error: "Conversa não encontrada" };
  const { data: myMem } = await supabase.from("memberships").select("id").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).maybeSingle();
  const myId = (myMem as { id: string } | null)?.id;
  if (!myId || !conv.participantes.includes(myId)) return { ok: false, error: "Não participante" };
  const svc = createServiceClient();
  const { data: file } = await svc.storage.from(BUCKET).download(convPath(ctx.orgId, conversaId));
  const msgs: { id: string; sender: string; conteudo: string; created_at: string }[] = file ? JSON.parse(await file.text()) : [];
  msgs.push({ id: crypto.randomUUID(), sender: myId, conteudo: texto, created_at: new Date().toISOString() });
  const toSave = msgs.slice(-200);
  await svc.storage.from(BUCKET).upload(convPath(ctx.orgId, conversaId), Buffer.from(JSON.stringify(toSave)), { contentType: "application/json", upsert: true });
  const outro = conv.participantes.find(p => p !== myId)!;
  const { data: outroMem } = await supabase.from("memberships").select("user_id").eq("id", outro).maybeSingle();
  const outroUserId = (outroMem as { user_id: string } | null)?.user_id;
  if (outroUserId) await gerarNotificacaoIdempotente({ tipo: "mensagem_recebida", titulo: "Nova mensagem", descricao: texto.slice(0,60), link: `/admin/mensagens/${conversaId}`, userId: outroUserId, janelaHoras: 1 });
  await registrarLog(supabase as never, { tabela: "mensagens", registro_id: conversaId, acao: "INSERT", dados_anteriores: null, dados_novos: { conversaId }, executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId });
  return { ok: true };
}

export async function listarConversas(): Promise<{ id: string; participantes: string[]; ultima: string | null; naoLidas: number }[]> {
  const ctx = await requireOrg();
  const supabase = await createClient();
  const { data: myMem } = await supabase.from("memberships").select("id").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).maybeSingle();
  const myId = (myMem as { id: string } | null)?.id;
  if (!myId) return [];
  if (await isDbAvailable()) {
    const { data: parts } = await supabase.from("conversa_participantes").select("conversa_id, last_read_at").eq("membership_id", myId);
    const convIds = (parts ?? []).map(p=>(p as { conversa_id: string }).conversa_id);
    if (convIds.length === 0) return [];
    // batch: participantes e mensagens
    const { data: allParts } = await supabase.from("conversa_participantes").select("conversa_id, membership_id").in("conversa_id", convIds);
    const { data: allMsgs } = await supabase.from("mensagens").select("conversa_id, conteudo, created_at, sender_membership_id").in("conversa_id", convIds).order("created_at", { ascending: false });
    const partMap = new Map<string, string[]>();
    for (const r of (allParts ?? []) as { conversa_id: string; membership_id: string }[]) {
      if (!partMap.has(r.conversa_id)) partMap.set(r.conversa_id, []);
      partMap.get(r.conversa_id)!.push(r.membership_id);
    }
    const msgMap = new Map<string, { conteudo: string; created_at: string; sender: string }[]>();
    for (const m of (allMsgs ?? []) as { conversa_id: string; conteudo: string; created_at: string; sender_membership_id: string }[]) {
      if (!msgMap.has(m.conversa_id)) msgMap.set(m.conversa_id, []);
      msgMap.get(m.conversa_id)!.push({ conteudo: m.conteudo, created_at: m.created_at, sender: m.sender_membership_id });
    }
    const out: { id: string; participantes: string[]; ultima: string | null; naoLidas: number }[] = [];
    for (const p of (parts ?? []) as { conversa_id: string; last_read_at: string | null }[]) {
      const participantes = partMap.get(p.conversa_id) ?? [];
      const msgs = msgMap.get(p.conversa_id) ?? [];
      const ultima = msgs[0]?.conteudo?.slice(0,40) ?? null;
      const lastRead = p.last_read_at ?? "1970-01-01";
      const naoLidas = msgs.filter(m => m.created_at > lastRead && m.sender !== myId).length;
      out.push({ id: p.conversa_id, participantes, ultima, naoLidas });
    }
    return out.sort((a,b)=>b.id.localeCompare(a.id));
  }
  const idx = await loadIndex(ctx.orgId);
  const minhas = Object.entries(idx).filter(([,v]) => v.participantes.includes(myId));
  const svc = createServiceClient();
  const out: { id: string; participantes: string[]; ultima: string | null; naoLidas: number }[] = [];
  for (const [cid, v] of minhas) {
    const { data: file } = await svc.storage.from(BUCKET).download(convPath(ctx.orgId, cid));
    const msgs: { conteudo: string; created_at: string }[] = file ? JSON.parse(await file.text()) : [];
    const ultima = msgs.length ? msgs[msgs.length-1].conteudo.slice(0,40) : null;
    out.push({ id: cid, participantes: v.participantes, ultima, naoLidas: 0 });
  }
  return out.sort((a,b)=>b.id.localeCompare(a.id));
}

export async function listarMensagens(conversaId: string, limit = 50): Promise<{ id: string; sender: string; conteudo: string; created_at: string }[]> {
  const ctx = await requireOrg();
  const supabase = await createClient();
  if (await isDbAvailable()) {
    const { data: conv } = await supabase.from("conversas").select("id").eq("id", conversaId).eq("organization_id", ctx.orgId).maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada");
    const { data: myMem } = await supabase.from("memberships").select("id").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).maybeSingle();
    const myId = (myMem as { id: string } | null)?.id;
    if (!myId) throw new Error("Não participante");
    const { data: part } = await supabase.from("conversa_participantes").select("membership_id").eq("conversa_id", conversaId).eq("membership_id", myId).maybeSingle();
    if (!part) throw new Error("Não participante");
    // marcar como lida via RPC (só próprio)
    await supabase.rpc("marcar_conversa_lida", { p_conversa_id: conversaId });
    const { data: msgs } = await supabase.from("mensagens").select("id, sender_membership_id, conteudo, created_at").eq("conversa_id", conversaId).order("created_at", { ascending: true }).limit(limit);
    return (msgs as { id: string; sender_membership_id: string; conteudo: string; created_at: string }[] | null)?.map(m=>({ id: m.id, sender: m.sender_membership_id, conteudo: m.conteudo, created_at: m.created_at })) ?? [];
  }
  const idx = await loadIndex(ctx.orgId);
  const conv = idx[conversaId];
  if (!conv) throw new Error("Conversa não encontrada");
  const { data: myMem } = await supabase.from("memberships").select("id").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).maybeSingle();
  const myId = (myMem as { id: string } | null)?.id;
  if (!myId || !conv.participantes.includes(myId)) throw new Error("Não participante");
  const svc = createServiceClient();
  const { data: file } = await svc.storage.from(BUCKET).download(convPath(ctx.orgId, conversaId));
  const msgs: { id: string; sender: string; conteudo: string; created_at: string }[] = file ? JSON.parse(await file.text()) : [];
  return msgs.slice(-limit);
}
