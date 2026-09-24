import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";
import { existeNaJanela } from "../src/lib/notificacoes";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DESDE = new Date(Date.now() - 24 * 3600000).toISOString();

/**
 * FASE A — Regressão da deduplicação broadcast.
 * Bug: `gerarNotificacaoIdempotente` usava `.eq("user_id", null)`, que em
 * Postgres/PostgREST (`= NULL`) nunca casa — o sino duplicava a cada
 * verificação. Fix: `existeNaJanela` com `.is("user_id", null)`.
 */
describe("FASE A — Deduplicação de notificações", () => {
  it("1. PostgREST: .eq(user_id, null) nunca casa (documenta a causa)", async () => {
    const org = await setupOrg("dedup-eqnull");
    await ADMIN.from("notificacoes").insert({
      organization_id: org.orgId,
      user_id: null,
      tipo: "dedup_eqnull",
      titulo: "Broadcast",
    });
    const cego = await ADMIN.from("notificacoes")
      .select("id")
      .eq("organization_id", org.orgId)
      .eq("tipo", "dedup_eqnull")
      .eq("user_id", null as unknown as string)
      .gte("created_at", DESDE)
      .limit(1);
    expect((cego.data ?? []).length).toBe(0);
    const visivel = await ADMIN.from("notificacoes")
      .select("id")
      .eq("organization_id", org.orgId)
      .eq("tipo", "dedup_eqnull")
      .is("user_id", null)
      .gte("created_at", DESDE)
      .limit(1);
    expect((visivel.data ?? []).length).toBe(1);
  });

  it("2. existeNaJanela encontra broadcast", async () => {
    const org = await setupOrg("dedup-bc");
    await ADMIN.from("notificacoes").insert({
      organization_id: org.orgId,
      user_id: null,
      tipo: "dedup_bc",
      titulo: "Broadcast",
    });
    await expect(
      existeNaJanela(ADMIN as never, org.orgId, { tipo: "dedup_bc", userId: null, desdeISO: DESDE }),
    ).resolves.toBe(true);
  });

  it("3. existeNaJanela encontra direcionada e ignora outro usuário", async () => {
    const org = await setupOrg("dedup-dir");
    await ADMIN.from("notificacoes").insert({
      organization_id: org.orgId,
      user_id: org.userId,
      tipo: "dedup_dir",
      titulo: "Direcionada",
    });
    await expect(
      existeNaJanela(ADMIN as never, org.orgId, { tipo: "dedup_dir", userId: org.userId, desdeISO: DESDE }),
    ).resolves.toBe(true);
    await expect(
      existeNaJanela(ADMIN as never, org.orgId, { tipo: "dedup_dir", userId: "00000000-0000-0000-0000-000000000000", desdeISO: DESDE }),
    ).resolves.toBe(false);
  });

  it("4. existeNaJanela isola por tipo e por org", async () => {
    const orgA = await setupOrg("dedup-iso-a");
    const orgB = await setupOrg("dedup-iso-b");
    await ADMIN.from("notificacoes").insert({
      organization_id: orgA.orgId,
      user_id: null,
      tipo: "dedup_iso",
      titulo: "Só A",
    });
    await expect(
      existeNaJanela(ADMIN as never, orgA.orgId, { tipo: "outro_tipo", userId: null, desdeISO: DESDE }),
    ).resolves.toBe(false);
    await expect(
      existeNaJanela(ADMIN as never, orgB.orgId, { tipo: "dedup_iso", userId: null, desdeISO: DESDE }),
    ).resolves.toBe(false);
  });
});
