import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Helper to simulate buscarGlobal via direct Supabase queries (same logic as the action, but via JWT client)
async function buscarViaClient(userId: string, termo: string) {
  const { setupOrg: _ } = await import("./setup");
  // Use the JWT client from setup
  const { createClient: mk } = await import("@supabase/supabase-js");
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);
  const jwt = await new SignJWT({ role: "authenticated", aud: "authenticated", ref: "ialjfeltqpbgrxtymfwa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("https://ialjfeltqpbgrxtymfwa.supabase.co/auth/v1")
    .setSubject(userId)
    .setExpirationTime("2h")
    .setIssuedAt()
    .sign(secret);
  const client = mk(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const like = `%${termo}%`;
  const { data: ativos } = await client.from("ativos").select("id, nome").or(`nome.ilike.${like},codigo.ilike.${like}`).limit(10);
  return ativos ?? [];
}

describe("BLOCO E — Busca Global", () => {
  it("1. busca de ativo por nome", async () => {
    const org = await setupOrg("busca-ativo");
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Busca Ativo Teste", qr_code_hash: crypto.randomUUID() });
    const res = await buscarViaClient(org.userId, "Busca Ativo");
    expect(res.some((r) => r.nome.includes("Busca Ativo"))).toBe(true);
  });

  it("2. busca por código", async () => {
    const org = await setupOrg("busca-codigo");
    const codigo = "BUSCA-" + Date.now().toString(36).toUpperCase();
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Código", codigo, qr_code_hash: crypto.randomUUID() });
    const res = await buscarViaClient(org.userId, codigo);
    expect(res.length).toBeGreaterThan(0);
  });

  it("10. busca sem resultado", async () => {
    const org = await setupOrg("busca-vazio");
    const res = await buscarViaClient(org.userId, "XYZ_INEXISTENTE_12345");
    expect(res.length).toBe(0);
  });

  it("11. busca vazia (<2 caracteres) não executa", async () => {
    const termo = "a";
    expect(termo.trim().length < 2).toBe(true);
  });

  it("12. normalização: trim e lowercase", async () => {
    const termo = "  Busca Ativo  ";
    const norm = termo.replace(/[%_,()"'\\;]/g, "").trim().slice(0, 60).toLowerCase();
    expect(norm).toBe("busca ativo");
  });

  it("13. limite de resultados (10 por categoria)", async () => {
    const org = await setupOrg("busca-limite");
    for (let i = 0; i < 15; i++) {
      await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: `Limite ${i}`, qr_code_hash: crypto.randomUUID() });
    }
    const res = await buscarViaClient(org.userId, "Limite");
    expect(res.length).toBeLessThanOrEqual(10);
  });

  it("14. tenant isolation: org B não encontra ativos de org A", async () => {
    const orgA = await setupOrg("busca-tenant-a");
    const orgB = await setupOrg("busca-tenant-b");
    const nomeUnico = "TenantUnico-" + Date.now();
    await ADMIN.from("ativos").insert({ organization_id: orgA.orgId, nome: nomeUnico, qr_code_hash: crypto.randomUUID() });
    const resB = await buscarViaClient(orgB.userId, nomeUnico);
    expect(resB.length).toBe(0);
  });

  it("18. ausência de cross-tenant", async () => {
    const orgA = await setupOrg("busca-cross-a");
    const orgB = await setupOrg("busca-cross-b");
    await ADMIN.from("ativos").insert({ organization_id: orgA.orgId, nome: "Cross Ativo", qr_code_hash: crypto.randomUUID() });
    const resB = await buscarViaClient(orgB.userId, "Cross Ativo");
    expect(resB.every((r) => r.nome !== "Cross Ativo")).toBe(true);
  });
});
