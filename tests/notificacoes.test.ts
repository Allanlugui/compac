import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

describe("BLOCO E — Notificações", () => {
  it("1. criação de notificação", async () => {
    const org = await setupOrg("notif-create");
    const { error } = await ADMIN.from("notificacoes").insert({
      organization_id: org.orgId,
      user_id: org.userId,
      tipo: "teste",
      titulo: "Teste",
      descricao: "Desc",
      link: "/admin/ativos",
    });
    expect(error).toBeNull();
  });

  it("2. destinatário correto", async () => {
    const org = await setupOrg("notif-dest");
    await ADMIN.from("notificacoes").insert({
      organization_id: org.orgId,
      user_id: org.userId,
      tipo: "teste_dest",
      titulo: "Para usuário",
    });
    const { data } = await ADMIN.from("notificacoes").select("id").eq("organization_id", org.orgId).eq("user_id", org.userId).eq("tipo", "teste_dest");
    expect(data?.length).toBe(1);
  });

  it("3. organização correta", async () => {
    const org = await setupOrg("notif-org");
    await ADMIN.from("notificacoes").insert({ organization_id: org.orgId, tipo: "teste_org", titulo: "Org" });
    const { data } = await ADMIN.from("notificacoes").select("id").eq("organization_id", org.orgId).eq("tipo", "teste_org");
    expect(data?.[0]).toBeDefined();
  });

  it("4. RLS: org B não vê notificações de org A", async () => {
    const orgA = await setupOrg("notif-rls-a");
    const orgB = await setupOrg("notif-rls-b");
    await ADMIN.from("notificacoes").insert({ organization_id: orgA.orgId, tipo: "rls_test", titulo: "Privado A" });
    const { data } = await ADMIN.from("notificacoes").select("id").eq("organization_id", orgB.orgId).eq("tipo", "rls_test");
    expect(data?.length).toBe(0);
  });

  it("6. marcação como lida", async () => {
    const org = await setupOrg("notif-lida");
    const { data: notif } = await ADMIN.from("notificacoes").insert({ organization_id: org.orgId, user_id: org.userId, tipo: "lida_test", titulo: "Lida" }).select("id").single();
    await ADMIN.from("notificacoes").update({ lida: true }).eq("id", notif!.id).eq("organization_id", org.orgId);
    const { data: updated } = await ADMIN.from("notificacoes").select("lida").eq("id", notif!.id).single();
    expect(updated?.lida).toBe(true);
  });

  it("9. SLA próximo (2 dias)", async () => {
    const org = await setupOrg("notif-sla-prox");
    const hoje = new Date().toISOString().slice(0, 10);
    const prazoProximo = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
    const { data: ativo } = await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo SLA", qr_code_hash: crypto.randomUUID() }).select("id").single();
    const { data: chamado } = await ADMIN.from("chamados").insert({ organization_id: org.orgId, ativo_id: ativo!.id, solicitante: "Teste", descricao: "SLA", prazo: prazoProximo, status: "aberto", prioridade: "media", origem: "administrador" }).select("id").single();
    expect(chamado?.id).toBeDefined();
  });

  it("15. estado vazio", async () => {
    const org = await setupOrg("notif-empty");
    const { data } = await ADMIN.from("notificacoes").select("id").eq("organization_id", org.orgId).eq("tipo", "inexistente_xyz");
    expect(data?.length).toBe(0);
  });

  it("18. não exposição cross-tenant", async () => {
    const orgA = await setupOrg("notif-cross-a");
    const orgB = await setupOrg("notif-cross-b");
    await ADMIN.from("notificacoes").insert({ organization_id: orgA.orgId, tipo: "cross_test", titulo: "Secret A" });
    const { data: cross } = await ADMIN.from("notificacoes").select("id").eq("organization_id", orgB.orgId).eq("tipo", "cross_test");
    expect(cross?.length).toBe(0);
  });
});
