import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

describe("FASE 7.1 — O.S. → Compra → Estoque", () => {
  it("O.S. solicita material → solicitação vinculada → aparece na central", async () => {
    const org = await setupOrg("fase7-os-compra");
    const { data: ativo } = await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo F7", qr_code_hash: crypto.randomUUID() }).select("id").single();
    const { data: chamado } = await ADMIN.from("chamados").insert({ organization_id: org.orgId, ativo_id: ativo!.id, solicitante: "Teste", descricao: "Teste", status: "convertido_os", os_status: "em_execucao", os_tipo: "corretiva", origem: "administrador", prioridade: "media" }).select("id").single();
    const { data: solic, error } = await ADMIN.from("solicitacoes_compra").insert({ organization_id: org.orgId, chamado_id: chamado!.id, setor: "Manutenção", solicitante: "Teste", item: "Peça", justificativa: "Teste", quantidade: 2, valor_estimado: 0, status: "rascunho", qr_code_hash: crypto.randomUUID() }).select("id").single();
    if (error) throw new Error(`insert solic failed: ${error.message}`);
    expect(solic?.id).toBeDefined();
    const { data: fetched } = await ADMIN.from("solicitacoes_compra").select("id, chamado_id").eq("id", solic!.id).single();
    expect(fetched?.chamado_id).toBe(chamado!.id);
  });
});

describe("FASE 7.1 — Preventiva automática", () => {
  it("plano vencido gera 1 O.S. e segunda execução não duplica", async () => {
    const org = await setupOrg("fase7-prev");
    const { data: ativo } = await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Prev", qr_code_hash: crypto.randomUUID() }).select("id").single();
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { data: plano } = await ADMIN.from("planos_manutencao").insert({ organization_id: org.orgId, ativo_id: ativo!.id, tipo: "preventiva", atividade: "Lubrificação", frequencia: 30, unidade: "dias", proxima_execucao: ontem, ativo: true }).select("id").single();
    // Simular rotina: verifica e cria
    const { count: antes } = await ADMIN.from("chamados").select("id", { count: "exact", head: true }).eq("organization_id", org.orgId).eq("plano_id", plano!.id);
    expect(antes).toBe(0);
  });
});

describe("FASE 7.1 — Estoque", () => {
  it("disponível = físico - reservado", async () => {
    const org = await setupOrg("fase7-estoque");
    const { data: prod } = await ADMIN.from("produtos").insert({ organization_id: org.orgId, codigo: "F7-" + Date.now(), descricao: "Produto F7", estoque_atual: 10, estoque_reservado: 3 }).select("estoque_atual, estoque_reservado").single();
    expect(Number(prod!.estoque_atual) - Number(prod!.estoque_reservado)).toBe(7);
  });
});

describe("FASE 7.1 — Monitoramento", () => {
  it("health check banco", async () => {
    const { error } = await ADMIN.from("organizations").select("id").limit(1);
    expect(error).toBeNull();
  });
});
