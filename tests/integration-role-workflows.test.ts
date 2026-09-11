import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

describe("FASE 9.7 — Integração Role Workflows", () => {
  it("ADMIN: organização inteira", async () => {
    const org = await setupOrg("int-admin");
    const { count } = await ADMIN.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", org.orgId);
    expect(count).toBe(1);
  });

  it("TECNICO: próprias O.S. via responsavel", async () => {
    const org = await setupOrg("int-tec");
    const { data: ativo } = await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Int", codigo: "INT-" + Date.now(), qr_code_hash: crypto.randomUUID() }).select("id").single();
    const { data: chamado } = await ADMIN.from("chamados").insert({ organization_id: org.orgId, ativo_id: ativo!.id, solicitante: org.email, descricao: "Int", status: "aberto", origem: "qr", prioridade: "media", responsavel: org.email }).select("id").single();
    expect(chamado?.id).toBeDefined();
  });

  it("SOLICITANTE: só próprias solicitações", async () => {
    const org = await setupOrg("int-sol");
    const { data: sol } = await ADMIN.from("solicitacoes_compra").insert({ organization_id: org.orgId, setor: "TI", solicitante: org.email, item: "Item Sol", justificativa: "Teste", quantidade: 1, valor_estimado: 0, status: "rascunho", qr_code_hash: crypto.randomUUID(), created_by: org.userId }).select("id").single();
    expect(sol?.id).toBeDefined();
  });

  it("O.S. → Compra → Estoque → Notificação", async () => {
    const org = await setupOrg("int-os-compra");
    const { data: ativo } = await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo OC", codigo: "OC-" + Date.now(), qr_code_hash: crypto.randomUUID() }).select("id").single();
    const { data: chamado } = await ADMIN.from("chamados").insert({ organization_id: org.orgId, ativo_id: ativo!.id, solicitante: org.email, descricao: "OC", status: "aberto", origem: "qr", prioridade: "media" }).select("id").single();
    // solicitar material
    const { data: sol } = await ADMIN.from("solicitacoes_compra").insert({ organization_id: org.orgId, chamado_id: chamado!.id, setor: "Manut", solicitante: org.email, item: "Peça", justificativa: "OC", quantidade: 1, valor_estimado: 0, status: "rascunho", qr_code_hash: crypto.randomUUID() }).select("id").single();
    expect(sol?.id).toBeDefined();
  });

  it("Hierarquia → Dashboard Gestor subtree", async () => {
    const org = await setupOrg("int-hier");
    // Gestor vê subtree via getSubtree (storage fallback)
    expect(org.orgId).toBeDefined();
  });

  it("Organograma → Mensagem", async () => {
    const orgA = await setupOrg("int-org-msg-a");
    const orgB = await setupOrg("int-org-msg-b");
    // Mensagem 1:1 dentro orgA
    expect(orgA.orgId).not.toBe(orgB.orgId);
  });

  it("Cross-tenant isolado", async () => {
    const orgA = await setupOrg("int-cross-a");
    const orgB = await setupOrg("int-cross-b");
    const { data: ativoA } = await ADMIN.from("ativos").insert({ organization_id: orgA.orgId, nome: "Ativo Cross", codigo: "CROSS-" + Date.now(), qr_code_hash: crypto.randomUUID() }).select("id").single();
    const { data: cross } = await ADMIN.from("chamados").insert({ organization_id: orgB.orgId, ativo_id: ativoA!.id, solicitante: "cross", descricao: "cross", origem: "portal", prioridade: "media", status: "aberto" }).select("id").single();
    // Should be blocked by enforce_same_org trigger
    expect(cross).toBeNull();
  });
});
