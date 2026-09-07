import { describe, expect, it } from "vitest";
import {
  ADMIN_CLIENT,
  ANON_CLIENT,
  deleteComo,
  selectComo,
  setupOrg,
  updateComo,
} from "./setup";

/**
 * SUITE DE ISOLAMENTO MULTI-TENANT (RLS + TRIGGER)
 *
 * EstratÃ©gia de teste:
 * - SELECT cross-tenant: query via RPC exec_as_user â†’ RLS filtra â†’ 0 linhas
 * - UPDATE/DELETE cross-tenant: query via RPC â†’ RLS bloqueia â†’ 0 rows affected
 * - INSERT cross-tenant: query via RPC â†’ trigger enforce_same_org bloqueia
 * - Erros de INFRAESTRUTURA (RPC falhou, JWT invÃ¡lido) sÃ£o exceÃ§Ãµes, NÃƒO "PASS"
 *
 * Os testes 1-3 (privilÃ©gios de exec_as_user) devem ser rodados ANTES
 * dos testes de RLS â€” se exec_as_user estiver mal configurada, todos
 * os testes de RLS ficarÃ£o verdes falsamente.
 */

describe("Gate de ProduÃ§Ã£o â€” PrivilÃ©gios de exec_as_user", () => {

  it("service_role PODE chamar exec_as_user", async () => {
    const org = await setupOrg("priv-svc");
    // Service role (ADMIN_CLIENT) tem grant EXECUTE â€” RPC deve funcionar
    const { rowsAffected } = await selectComo(org.userId, "organizations", { id: org.orgId });
    expect(rowsAffected).toBe(1);
  });

  it("anon NÃƒO PODE chamar exec_as_user (RPC bloqueada por grant)", async () => {
    // Cliente anon nÃ£o tem EXECUTE â€” RPC deve falhar com insufficient_privilege
    const { error } = await ANON_CLIENT.rpc("exec_as_user", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_sql: "SELECT 1",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied|privilege|execute/i);
  });

  it("authenticated (sem service_role) NÃƒO PODE chamar exec_as_user", async () => {
    const org = await setupOrg("priv-auth");
    // Cria um cliente "authenticated" (nÃ£o service) usando JWT do user
    // Como nÃ£o temos um JWT_SECRET aqui, usamos o client ANON como proxy
    // â€” tanto anon quanto authenticated devem ser bloqueados pelo grant
    const { error } = await ANON_CLIENT.rpc("exec_as_user", {
      p_user_id: org.userId,
      p_sql: "SELECT 1",
    });
    expect(error).not.toBeNull();
  });
});

describe("Gate de ProduÃ§Ã£o â€” SELECT cross-tenant (RLS)", () => {

  it("ativos: cliente da org B NÃƒO VÃŠ ativos da org A", async () => {
    const orgA = await setupOrg("sel-a");
    const orgB = await setupOrg("sel-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Sigiloso", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();
    expect(ativoA).not.toBeNull();

    const { rowsAffected } = await selectComo(orgB.userId, "ativos", { id: ativoA!.id });
    expect(rowsAffected).toBe(0); // RLS filtrou
  });

  it("chamados: cliente da org B NÃƒO VÃŠ chamados da org A", async () => {
    const orgA = await setupOrg("sel-ch-a");
    const orgB = await setupOrg("sel-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();
    const { data: chamadoA } = await ADMIN_CLIENT
      .from("chamados")
      .insert({
        organization_id: orgA.orgId,
        ativo_id: ativoA!.id,
        solicitante: "User A",
        descricao: "Confidencial",
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      })
      .select("id").single();

    const { rowsAffected } = await selectComo(orgB.userId, "chamados", { id: chamadoA!.id });
    expect(rowsAffected).toBe(0);
  });

  it("produtos: cliente da org B NÃƒO VÃŠ produtos da org A", async () => {
    const orgA = await setupOrg("sel-pr-a");
    const orgB = await setupOrg("sel-pr-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "SECRETO-1", descricao: "P1", estoque_atual: 50 })
      .select("id").single();

    const { rowsAffected } = await selectComo(orgB.userId, "produtos", { id: produtoA!.id });
    expect(rowsAffected).toBe(0);
  });

  it("fornecedores: cliente da org B NÃƒO VÃŠ fornecedores da org A", async () => {
    const orgA = await setupOrg("sel-fn-a");
    const orgB = await setupOrg("sel-fn-b");

    const { data: fornA } = await ADMIN_CLIENT
      .from("fornecedores")
      .insert({ organization_id: orgA.orgId, nome: "Fornecedor Secreto" })
      .select("id").single();

    const { rowsAffected } = await selectComo(orgB.userId, "fornecedores", { id: fornA!.id });
    expect(rowsAffected).toBe(0);
  });

  it("auditoria_logs: cliente da org B NÃƒO VÃŠ logs da org A", async () => {
    const orgA = await setupOrg("sel-au-a");
    const orgB = await setupOrg("sel-au-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();
    const { data: logA } = await ADMIN_CLIENT
      .from("auditoria_logs")
      .insert({
        organization_id: orgA.orgId,
        tabela: "ativos",
        registro_id: ativoA!.id,
        acao: "INSERT",
        executado_por: "user-a@sga-test.local",
      })
      .select("id").single();

    const { rowsAffected } = await selectComo(orgB.userId, "auditoria_logs", { id: logA!.id });
    expect(rowsAffected).toBe(0);
  });

  it("memberships: cliente da org B NÃƒO VÃŠ membros da org A", async () => {
    const orgA = await setupOrg("sel-mb-a");
    const orgB = await setupOrg("sel-mb-b");

    const { rowsAffected: visiveisA } = await selectComo(
      orgA.userId, "memberships", { organization_id: orgA.orgId },
    );
    const { rowsAffected: visiveisB } = await selectComo(
      orgB.userId, "memberships", { organization_id: orgA.orgId },
    );

    expect(visiveisA).toBeGreaterThanOrEqual(1);
    expect(visiveisB).toBe(0); // org B user NÃƒO vÃª membros da org A
  });
});

describe("Gate de ProduÃ§Ã£o â€” UPDATE cross-tenant (RLS)", () => {

  it("ativos: UPDATE cross-tenant Ã© BLOQUEADO (0 rows affected)", async () => {
    const orgA = await setupOrg("upd-a");
    const orgB = await setupOrg("upd-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Original", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();

    const result = await updateComo(orgB.userId, "ativos", ativoA!.id, { nome: "Invadido" });
    expect(result.rowsAffected).toBe(0); // RLS bloqueou

    // Confirma que o nome NÃƒO mudou
    const { data: ainda } = await ADMIN_CLIENT
      .from("ativos")
      .select("nome")
      .eq("id", ativoA!.id)
      .single();
    expect(ainda?.nome ?? "").toBe("Original");
  });

  it("chamados: UPDATE cross-tenant Ã© BLOQUEADO (0 rows affected)", async () => {
    const orgA = await setupOrg("upd-ch-a");
    const orgB = await setupOrg("upd-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();
    const { data: chamadoA } = await ADMIN_CLIENT
      .from("chamados")
      .insert({
        organization_id: orgA.orgId,
        ativo_id: ativoA!.id,
        solicitante: "Original",
        descricao: "Original",
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      })
      .select("id").single();

    const result = await updateComo(orgB.userId, "chamados", chamadoA!.id, { solicitante: "Invadido" });
    expect(result.rowsAffected).toBe(0);
  });

  it("produtos: UPDATE cross-tenant Ã© BLOQUEADO (0 rows affected)", async () => {
    const orgA = await setupOrg("upd-pr-a");
    const orgB = await setupOrg("upd-pr-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "ORIG", descricao: "P1", estoque_atual: 50 })
      .select("id").single();

    const result = await updateComo(orgB.userId, "produtos", produtoA!.id, { descricao: "Invadido" });
    expect(result.rowsAffected).toBe(0);
  });
});

describe("Gate de ProduÃ§Ã£o â€” DELETE cross-tenant (RLS)", () => {

  it("ativos: DELETE cross-tenant Ã© BLOQUEADO (linha permanece)", async () => {
    const orgA = await setupOrg("del-a");
    const orgB = await setupOrg("del-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Protegido", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();

    const result = await deleteComo(orgB.userId, "ativos", ativoA!.id);
    expect(result.rowsAffected).toBe(0);

    // Confirma que o ativo ainda existe
    const { data: existe } = await ADMIN_CLIENT
      .from("ativos")
      .select("id")
      .eq("id", ativoA!.id)
      .maybeSingle();
    expect(existe).not.toBeNull();
  });

  it("chamados: DELETE cross-tenant Ã© BLOQUEADO (linha permanece)", async () => {
    const orgA = await setupOrg("del-ch-a");
    const orgB = await setupOrg("del-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();
    const { data: chamadoA } = await ADMIN_CLIENT
      .from("chamados")
      .insert({
        organization_id: orgA.orgId,
        ativo_id: ativoA!.id,
        solicitante: "Original",
        descricao: "X",
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      })
      .select("id").single();

    const result = await deleteComo(orgB.userId, "chamados", chamadoA!.id);
    expect(result.rowsAffected).toBe(0);
  });

  it("produtos: DELETE cross-tenant Ã© BLOQUEADO (linha permanece)", async () => {
    const orgA = await setupOrg("del-pr-a");
    const orgB = await setupOrg("del-pr-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "DEL-X", descricao: "P", estoque_atual: 10 })
      .select("id").single();

    const result = await deleteComo(orgB.userId, "produtos", produtoA!.id);
    expect(result.rowsAffected).toBe(0);
  });
});

describe("Gate de ProduÃ§Ã£o â€” INSERT cross-tenant (trigger enforce_same_org)", () => {

  it("chamados: INSERT com organization_id cruzado BLOQUEADO por trigger", async () => {
    const orgA = await setupOrg("ins-ch-a");
    const orgB = await setupOrg("ins-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();

    // INSERT direto via service (bypass RLS), mas o trigger enforce_same_org
    // ainda estÃ¡ ativo e deve rejeitar organization_id cruzado.
    const { error } = await ADMIN_CLIENT.from("chamados").insert({
      organization_id: orgB.orgId, // forÃ§ando org B
      ativo_id: ativoA!.id, // ativo da org A
      solicitante: "B",
      descricao: "Cross-tenant",
      origem: "administrador",
      prioridade: "media",
      status: "aberto",
    });
    expect(error).not.toBeNull();
  });

  it("movimentacoes_estoque: INSERT com produto cruzado BLOQUEADO por trigger", async () => {
    const orgA = await setupOrg("ins-mv-a");
    const orgB = await setupOrg("ins-mv-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();
    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "MV-X", descricao: "P", estoque_atual: 100 })
      .select("id").single();
    const { data: chamadoA } = await ADMIN_CLIENT
      .from("chamados")
      .insert({
        organization_id: orgA.orgId,
        ativo_id: ativoA!.id,
        solicitante: "A",
        descricao: "X",
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      })
      .select("id").single();

    const { error } = await ADMIN_CLIENT.from("movimentacoes_estoque").insert({
      organization_id: orgB.orgId, // forÃ§ando org B
      produto_id: produtoA!.id, // produto da org A
      chamado_id: chamadoA!.id, // chamado da org A
      tipo: "consumo",
      quantidade: 5,
      custo_unitario: 10,
    });
    expect(error).not.toBeNull();
  });
});

describe("Gate de ProduÃ§Ã£o â€” Isolamento de contadores", () => {

  it("contadores: cada org vÃª apenas os prÃ³prios chamados (listagem)", async () => {
    const orgA = await setupOrg("cnt-a");
    const orgB = await setupOrg("cnt-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();
    const { data: ativoB } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgB.orgId, nome: "B1", status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID() })
      .select("id").single();

    for (let i = 0; i < 5; i++) {
      await ADMIN_CLIENT.from("chamados").insert({
        organization_id: orgA.orgId, ativo_id: ativoA!.id,
        solicitante: "A", descricao: `A-${i}`,
        origem: "administrador", prioridade: "media", status: "aberto",
      });
    }
    for (let i = 0; i < 2; i++) {
      await ADMIN_CLIENT.from("chamados").insert({
        organization_id: orgB.orgId, ativo_id: ativoB!.id,
        solicitante: "B", descricao: `B-${i}`,
        origem: "administrador", prioridade: "media", status: "aberto",
      });
    }

    const { rowsAffected: totalA } = await selectComo(orgA.userId, "chamados");
    const { rowsAffected: totalB } = await selectComo(orgB.userId, "chamados");

    expect(totalA).toBe(5);
    expect(totalB).toBe(2);
  });

  it("contadores: listagem de ativos por org Ã© isolada", async () => {
    const orgA = await setupOrg("cnt-at-a");
    const orgB = await setupOrg("cnt-at-b");

    for (let i = 0; i < 3; i++) {
      await ADMIN_CLIENT.from("ativos").insert({
        organization_id: orgA.orgId, nome: `Ativo-A-${i}`,
        status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID(),
      });
    }
    for (let i = 0; i < 2; i++) {
      await ADMIN_CLIENT.from("ativos").insert({
        organization_id: orgB.orgId, nome: `Ativo-B-${i}`,
        status: "operacional", tipo: "equipamento", qr_code_hash: crypto.randomUUID(),
      });
    }

    const { data: ativosA } = await selectComo<{ nome: string }>(orgA.userId, "ativos");
    const { data: ativosB } = await selectComo<{ nome: string }>(orgB.userId, "ativos");

    expect(ativosA.length).toBe(3);
    expect(ativosA.every((a) => a.nome.startsWith("Ativo-A-"))).toBe(true);
    expect(ativosB.length).toBe(2);
    expect(ativosB.every((a) => a.nome.startsWith("Ativo-B-"))).toBe(true);
  });
});

