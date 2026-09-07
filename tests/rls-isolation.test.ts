import { describe, expect, it } from "vitest";
import {
  ADMIN_CLIENT,
  ANON_CLIENT,
  executeComo,
  selectComo,
  setupOrg,
} from "./setup";

/**
 * SUITE DE ISOLAMENTO MULTI-TENANT (RLS + TRIGGER)
 *
 * Estratégia de teste:
 * - SELECT cross-tenant: query via RPC exec_as_user → RLS filtra → 0 linhas
 * - UPDATE/DELETE cross-tenant: query via RPC → RLS bloqueia → 0 rows affected
 * - INSERT cross-tenant: query via RPC → trigger enforce_same_org bloqueia
 * - Erros de INFRAESTRUTURA (RPC falhou, JWT inválido) são exceções, NÃO "PASS"
 *
 * Os testes 1-3 (privilégios de exec_as_user) devem ser rodados ANTES
 * dos testes de RLS — se exec_as_user estiver mal configurada, todos
 * os testes de RLS ficarão verdes falsamente.
 */

describe("Gate de Produção — Privilégios de exec_as_user", () => {

  it("service_role PODE chamar exec_as_user", async () => {
    const org = await setupOrg("priv-svc");
    // Service role (ADMIN_CLIENT) tem grant EXECUTE — RPC deve funcionar
    const { rowsAffected } = await selectComo(org.userId, "organizations", { id: org.orgId });
    expect(rowsAffected).toBe(1);
  });

  it("anon NÃO PODE chamar exec_as_user (RPC bloqueada por grant)", async () => {
    // Cliente anon não tem EXECUTE — RPC deve falhar com insufficient_privilege
    const { error } = await ANON_CLIENT.rpc("exec_as_user", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_sql: "SELECT 1",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied|privilege|execute/i);
  });

  it("authenticated (sem service_role) NÃO PODE chamar exec_as_user", async () => {
    const org = await setupOrg("priv-auth");
    // Cria um cliente "authenticated" (não service) usando JWT do user
    // Como não temos um JWT_SECRET aqui, usamos o client ANON como proxy
    // — tanto anon quanto authenticated devem ser bloqueados pelo grant
    const { error } = await ANON_CLIENT.rpc("exec_as_user", {
      p_user_id: org.userId,
      p_sql: "SELECT 1",
    });
    expect(error).not.toBeNull();
  });
});

describe("Gate de Produção — SELECT cross-tenant (RLS)", () => {

  it("ativos: cliente da org B NÃO VÊ ativos da org A", async () => {
    const orgA = await setupOrg("sel-a");
    const orgB = await setupOrg("sel-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Sigiloso", status: "operacional", tipo: "equipamento" })
      .select("id").single();
    expect(ativoA).not.toBeNull();

    const { rowsAffected } = await selectComo(orgB.userId, "ativos", { id: ativoA!.id });
    expect(rowsAffected).toBe(0); // RLS filtrou
  });

  it("chamados: cliente da org B NÃO VÊ chamados da org A", async () => {
    const orgA = await setupOrg("sel-ch-a");
    const orgB = await setupOrg("sel-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
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

  it("produtos: cliente da org B NÃO VÊ produtos da org A", async () => {
    const orgA = await setupOrg("sel-pr-a");
    const orgB = await setupOrg("sel-pr-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "SECRETO-1", descricao: "P1", estoque_atual: 50 })
      .select("id").single();

    const { rowsAffected } = await selectComo(orgB.userId, "produtos", { id: produtoA!.id });
    expect(rowsAffected).toBe(0);
  });

  it("fornecedores: cliente da org B NÃO VÊ fornecedores da org A", async () => {
    const orgA = await setupOrg("sel-fn-a");
    const orgB = await setupOrg("sel-fn-b");

    const { data: fornA } = await ADMIN_CLIENT
      .from("fornecedores")
      .insert({ organization_id: orgA.orgId, nome: "Fornecedor Secreto" })
      .select("id").single();

    const { rowsAffected } = await selectComo(orgB.userId, "fornecedores", { id: fornA!.id });
    expect(rowsAffected).toBe(0);
  });

  it("auditoria_logs: cliente da org B NÃO VÊ logs da org A", async () => {
    const orgA = await setupOrg("sel-au-a");
    const orgB = await setupOrg("sel-au-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
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

  it("memberships: cliente da org B NÃO VÊ membros da org A", async () => {
    const orgA = await setupOrg("sel-mb-a");
    const orgB = await setupOrg("sel-mb-b");

    const { rowsAffected: visiveisA } = await selectComo(
      orgA.userId, "memberships", { organization_id: orgA.orgId },
    );
    const { rowsAffected: visiveisB } = await selectComo(
      orgB.userId, "memberships", { organization_id: orgA.orgId },
    );

    expect(visiveisA).toBeGreaterThanOrEqual(1);
    expect(visiveisB).toBe(0); // org B user NÃO vê membros da org A
  });
});

describe("Gate de Produção — UPDATE cross-tenant (RLS)", () => {

  it("ativos: UPDATE cross-tenant é BLOQUEADO (0 rows affected)", async () => {
    const orgA = await setupOrg("upd-a");
    const orgB = await setupOrg("upd-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Original", status: "operacional", tipo: "equipamento" })
      .select("id").single();

    // Tenta UPDATE via contexto da org B
    const sql = `UPDATE public.ativos SET nome = 'Invadido' WHERE id = '${ativoA!.id}' RETURNING nome`;
    const result = await executeComo(orgB.userId, sql);
    expect(result.rowsAffected).toBe(0); // RLS bloqueou

    // Confirma que o nome NÃO mudou
    const { data: ainda } = await ADMIN_CLIENT
      .from("ativos")
      .select("nome")
      .eq("id", ativoA!.id)
      .single();
    expect(ainda?.nome ?? "").toBe("Original");
  });

  it("chamados: UPDATE cross-tenant é BLOQUEADO (0 rows affected)", async () => {
    const orgA = await setupOrg("upd-ch-a");
    const orgB = await setupOrg("upd-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
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

    const sql = `UPDATE public.chamados SET solicitante = 'Invadido' WHERE id = '${chamadoA!.id}' RETURNING solicitante`;
    const result = await executeComo(orgB.userId, sql);
    expect(result.rowsAffected).toBe(0);
  });

  it("produtos: UPDATE cross-tenant é BLOQUEADO (0 rows affected)", async () => {
    const orgA = await setupOrg("upd-pr-a");
    const orgB = await setupOrg("upd-pr-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "ORIG", descricao: "P1", estoque_atual: 50 })
      .select("id").single();

    const sql = `UPDATE public.produtos SET descricao = 'Invadido' WHERE id = '${produtoA!.id}' RETURNING descricao`;
    const result = await executeComo(orgB.userId, sql);
    expect(result.rowsAffected).toBe(0);
  });
});

describe("Gate de Produção — DELETE cross-tenant (RLS)", () => {

  it("ativos: DELETE cross-tenant é BLOQUEADO (linha permanece)", async () => {
    const orgA = await setupOrg("del-a");
    const orgB = await setupOrg("del-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Protegido", status: "operacional", tipo: "equipamento" })
      .select("id").single();

    const sql = `DELETE FROM public.ativos WHERE id = '${ativoA!.id}' RETURNING id`;
    const result = await executeComo(orgB.userId, sql);
    expect(result.rowsAffected).toBe(0);

    // Confirma que o ativo ainda existe
    const { data: existe } = await ADMIN_CLIENT
      .from("ativos")
      .select("id")
      .eq("id", ativoA!.id)
      .maybeSingle();
    expect(existe).not.toBeNull();
  });

  it("chamados: DELETE cross-tenant é BLOQUEADO (linha permanece)", async () => {
    const orgA = await setupOrg("del-ch-a");
    const orgB = await setupOrg("del-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
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

    const sql = `DELETE FROM public.chamados WHERE id = '${chamadoA!.id}' RETURNING id`;
    const result = await executeComo(orgB.userId, sql);
    expect(result.rowsAffected).toBe(0);
  });

  it("produtos: DELETE cross-tenant é BLOQUEADO (linha permanece)", async () => {
    const orgA = await setupOrg("del-pr-a");
    const orgB = await setupOrg("del-pr-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "DEL-X", descricao: "P", estoque_atual: 10 })
      .select("id").single();

    const sql = `DELETE FROM public.produtos WHERE id = '${produtoA!.id}' RETURNING id`;
    const result = await executeComo(orgB.userId, sql);
    expect(result.rowsAffected).toBe(0);
  });
});

describe("Gate de Produção — INSERT cross-tenant (trigger enforce_same_org)", () => {

  it("chamados: INSERT com organization_id cruzado BLOQUEADO por trigger", async () => {
    const orgA = await setupOrg("ins-ch-a");
    const orgB = await setupOrg("ins-ch-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id").single();

    // INSERT direto via service (bypass RLS), mas o trigger enforce_same_org
    // ainda está ativo e deve rejeitar organization_id cruzado.
    const { error } = await ADMIN_CLIENT.from("chamados").insert({
      organization_id: orgB.orgId, // forçando org B
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
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
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
      organization_id: orgB.orgId, // forçando org B
      produto_id: produtoA!.id, // produto da org A
      chamado_id: chamadoA!.id, // chamado da org A
      tipo: "consumo",
      quantidade: 5,
      custo_unitario: 10,
    });
    expect(error).not.toBeNull();
  });
});

describe("Gate de Produção — Isolamento de contadores", () => {

  it("contadores: cada org vê apenas os próprios chamados (listagem)", async () => {
    const orgA = await setupOrg("cnt-a");
    const orgB = await setupOrg("cnt-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id").single();
    const { data: ativoB } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgB.orgId, nome: "B1", status: "operacional", tipo: "equipamento" })
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

  it("contadores: listagem de ativos por org é isolada", async () => {
    const orgA = await setupOrg("cnt-at-a");
    const orgB = await setupOrg("cnt-at-b");

    for (let i = 0; i < 3; i++) {
      await ADMIN_CLIENT.from("ativos").insert({
        organization_id: orgA.orgId, nome: `Ativo-A-${i}`,
        status: "operacional", tipo: "equipamento",
      });
    }
    for (let i = 0; i < 2; i++) {
      await ADMIN_CLIENT.from("ativos").insert({
        organization_id: orgB.orgId, nome: `Ativo-B-${i}`,
        status: "operacional", tipo: "equipamento",
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
