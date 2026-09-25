import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";
import { resolverEntrada } from "../src/lib/intake/contexto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

/**
 * BLOCO 3 — Resolução de contexto (DB real, sem mocks).
 * Prova: tokens existentes viram EntradaIntake com tenant da linha.
 */
describe("BLOCO 3 — Contexto de entrada", () => {
  it("1. QR de ativo → manutenção com ativo + tenant da linha", async () => {
    const org = await setupOrg("ctx-ativo");
    const hash = "h-" + crypto.randomUUID().slice(0, 12);
    const { data: loc } = await ADMIN.from("localidades")
      .insert({ organization_id: org.orgId, nome: "Sala ctx", tipo: "sala" })
      .select("id").single();
    const { data: ativo } = await ADMIN.from("ativos")
      .insert({ organization_id: org.orgId, nome: "Bomba ctx", qr_code_hash: hash, localidade_id: (loc as { id: string }).id })
      .select("id").single();
    const r = await resolverEntrada(ADMIN as never, "a", hash);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrada.organizacaoId).toBe(org.orgId);
    expect(r.entrada.tipo).toBe("manutencao");
    expect(r.entrada.ativoId).toBe((ativo as { id: string }).id);
    expect(r.entrada.localidadeId).toBe((loc as { id: string }).id);
  });

  it("2. link de área → vínculos do contexto", async () => {
    const org = await setupOrg("ctx-area");
    const token = "t-" + crypto.randomUUID().slice(0, 12);
    const { data: ctx } = await ADMIN.from("qr_contextos").insert({
      organization_id: org.orgId, nome: "Ctx área", setor: "Elétrica", token, ativo: true,
    }).select("id").single();
    const r = await resolverEntrada(ADMIN as never, "l", token);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrada.tipo).toBe("manutencao");
    expect(r.entrada.qrContextoId).toBe((ctx as { id: string }).id);
  });

  it("3. link universal → só org, sem ativo/localidade inventados", async () => {
    const org = await setupOrg("ctx-univ");
    // Orgs criadas após a v4 nascem sem entry_token (só backfill cobre);
    // o teste define o próprio (a v27 propõe default + backfill).
    const token = "u-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    const { error } = await ADMIN.from("organizations").update({ entry_token: token }).eq("id", org.orgId);
    expect(error).toBeNull();
    const r = await resolverEntrada(ADMIN as never, "u", token);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrada.organizacaoId).toBe(org.orgId);
    expect(r.entrada.ativoId ?? null).toBeNull();
    expect(r.entrada.localidadeId ?? null).toBeNull();
  });

  it("4. link de compras → tipo compra, sem misturar", async () => {
    const org = await setupOrg("ctx-compra");
    const token = "c-" + crypto.randomUUID().slice(0, 12);
    await ADMIN.from("qr_contextos").insert({
      organization_id: org.orgId, nome: "Ctx compra", token, ativo: true,
    });
    const r = await resolverEntrada(ADMIN as never, "c", token);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrada.tipo).toBe("compra");
  });

  it("5. inválido, inexistente e inativo", async () => {
    await setupOrg("ctx-neg");
    expect(await resolverEntrada(ADMIN as never, "a", "curto")).toEqual({ ok: false, error: "ref-invalida" });
    expect(await resolverEntrada(ADMIN as never, "a", "h-inexistente-xyz-123")).toEqual({ ok: false, error: "nao-encontrado" });
    const org = await setupOrg("ctx-inativo");
    await ADMIN.from("qr_contextos").insert({
      organization_id: org.orgId, nome: "Inativo", token: "t-inativo-xyz-123", ativo: false,
    });
    expect(await resolverEntrada(ADMIN as never, "l", "t-inativo-xyz-123")).toEqual({ ok: false, error: "nao-encontrado" });
  });

  it("6. token de outra org resolve para a org dona (sem travessia)", async () => {
    const orgA = await setupOrg("ctx-x-a");
    const orgB = await setupOrg("ctx-x-b");
    const hashB = "h-xb-" + crypto.randomUUID().slice(0, 10);
    await ADMIN.from("ativos").insert({ organization_id: orgB.orgId, nome: "Ativo B", qr_code_hash: hashB });
    const r = await resolverEntrada(ADMIN as never, "a", hashB);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrada.organizacaoId).toBe(orgB.orgId);
    expect(r.entrada.organizacaoId).not.toBe(orgA.orgId);
  });
});
