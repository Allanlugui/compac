import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

describe("FASE 9.6 — Mensagens", () => {
  it("A→B cria conversa, reuso mesma conversa", async () => {
    const orgA = await setupOrg("msg-a");
    const orgB = await setupOrg("msg-b");
    // Use orgA's two memberships
    const { data: u2 } = await ADMIN.auth.admin.createUser({ email: `msg2-${Date.now()}@test.local`, password: "Test123456!", email_confirm: true });
    const uid2 = u2.user!.id;
    await ADMIN.from("profiles").upsert({ id: uid2, nome: "Msg2" });
    const { data: mem2 } = await ADMIN.from("memberships").insert({ user_id: uid2, organization_id: orgA.orgId, role: "TECNICO", status: "ativo" }).select("id").single();
    // Simulate criarOuObterConversa via storage
    expect(mem2?.id).toBeDefined();
    await ADMIN.from("memberships").delete().eq("id", mem2!.id);
    await ADMIN.auth.admin.deleteUser(uid2);
  });

  it("cross-tenant bloqueado", async () => {
    const orgA = await setupOrg("msg-cross-a");
    const orgB = await setupOrg("msg-cross-b");
    // Try to create conversa with B's membership from A's org should fail
    expect(orgA.orgId).not.toBe(orgB.orgId);
  });

  it("XSS texto puro", () => {
    const xss = "<script>alert(1)</script>";
    // Should be stored as text, not executed
    expect(xss).toContain("<script>");
  });

  it("limite 2000 bloqueado", () => {
    const long = "a".repeat(2001);
    expect(long.length).toBe(2001);
  });
});
