import { describe, expect, it } from "vitest";
import { ADMIN_CLIENT, selectComo, setupOrg } from "./setup";

/**
 * TESTES DE ISOLAMENTO MULTI-TENANT (RLS)
 *
 * Cada teste cria 2 orgs com memberships distintas. A RPC exec_as_user
 * injeta o contexto JWT (auth.uid) para simular conexão autenticada
 * como aquele user. O RLS do Postgres filtra os dados baseado no
 * `eh_membro(organization_id)`.
 *
 * Esses testes validam que:
 * 1. Usuário da Org A NÃO VÊ dados da Org B (SELECT bloqueado)
 * 2. Usuário da Org A NÃO MODIFICA dados da Org B (UPDATE/DELETE)
 * 3. Cross-tenant INSERT via trigger enforce_same_org é bloqueado
 */

describe("RLS — Isolamento multi-tenant", () => {

  it("ativos: cliente da org B NÃO VÊ ativos da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Sigiloso", status: "operacional", tipo: "equipamento" })
      .select("id").single();
    expect(ativoA).not.toBeNull();

    const { data: visivel, error } = await selectComo(orgB.userId, "ativos", { id: ativoA!.id });
    expect(error).toBeNull();
    expect(visivel.length).toBe(0); // RLS filtrou
  });

  it("ativos: cliente da org B NÃO VÊ sua própria listagem misturada", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    await ADMIN_CLIENT.from("ativos").insert([
      { organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" },
      { organization_id: orgA.orgId, nome: "A2", status: "operacional", tipo: "equipamento" },
      { organization_id: orgA.orgId, nome: "A3", status: "operacional", tipo: "equipamento" },
    ]);
    await ADMIN_CLIENT.from("ativos").insert([
      { organization_id: orgB.orgId, nome: "B1", status: "operacional", tipo: "equipamento" },
      { organization_id: orgB.orgId, nome: "B2", status: "operacional", tipo: "equipamento" },
    ]);

    const { data: visiveisA } = await selectComo<{ nome: string }>(orgA.userId, "ativos");
    const { data: visiveisB } = await selectComo<{ nome: string }>(orgB.userId, "ativos");

    expect(visiveisA.length).toBe(3);
    expect(visiveisA.every((a) => a.nome.startsWith("A"))).toBe(true);
    expect(visiveisB.length).toBe(2);
    expect(visiveisB.every((a) => a.nome.startsWith("B"))).toBe(true);
  });

  it("chamados: cliente da org B NÃO VÊ chamados da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

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

    const { data: visivel } = await selectComo(orgB.userId, "chamados", { id: chamadoA!.id });
    expect(visivel.length).toBe(0);
  });

  it("produtos: cliente da org B NÃO VÊ produtos da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "SECRETO-1", descricao: "P1", estoque_atual: 50 })
      .select("id").single();

    const { data: visivel } = await selectComo(orgB.userId, "produtos", { id: produtoA!.id });
    expect(visivel.length).toBe(0);
  });

  it("fornecedores: cliente da org B NÃO VÊ fornecedores da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: fornA } = await ADMIN_CLIENT
      .from("fornecedores")
      .insert({ organization_id: orgA.orgId, nome: "Fornecedor Secreto" })
      .select("id").single();

    const { data: visivel } = await selectComo(orgB.userId, "fornecedores", { id: fornA!.id });
    expect(visivel.length).toBe(0);
  });

  it("auditoria_logs: cliente da org B NÃO VÊ logs da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

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

    const { data: visivel } = await selectComo(orgB.userId, "auditoria_logs", { id: logA!.id });
    expect(visivel.length).toBe(0);
  });

  it("memberships: cliente da org B NÃO VÊ membros da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: visiveisA } = await selectComo<{ user_id: string }>(orgA.userId, "memberships", {
      organization_id: orgA.orgId,
    });
    const { data: visiveisB } = await selectComo<{ user_id: string }>(orgB.userId, "memberships", {
      organization_id: orgA.orgId,
    });

    expect(visiveisA.length).toBeGreaterThanOrEqual(1);
    expect(visiveisB.length).toBe(0); // org B user não vê membros da org A
  });

  it("trigger enforce_same_org: cross-org INSERT em chamado BLOQUEADO", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id").single();

    // Tenta criar chamado da org B referenciando ativo da org A
    const { error } = await ADMIN_CLIENT.from("chamados").insert({
      organization_id: orgB.orgId,
      ativo_id: ativoA!.id, // ativo de OUTRA org
      solicitante: "B",
      descricao: "Cross-tenant",
      origem: "administrador",
      prioridade: "media",
      status: "aberto",
    });
    expect(error).not.toBeNull();
  });

  it("trigger enforce_same_org: cross-org INSERT em movimentacao_estoque BLOQUEADO", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id").single();
    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "P-A", descricao: "P", estoque_atual: 100 })
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

  it("contadores: cada org vê apenas os próprios chamados", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

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

    const { data: chamadosA } = await selectComo<unknown>(orgA.userId, "chamados");
    const { data: chamadosB } = await selectComo<unknown>(orgB.userId, "chamados");

    expect(chamadosA.length).toBe(5);
    expect(chamadosB.length).toBe(2);
  });

  it("atualização cross-tenant via RLS (authenticated) é bloqueada", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "Protegido", status: "operacional", tipo: "equipamento" })
      .select("id").single();

    // Tenta UPDATE via contexto da org B
    const { data, error } = await ADMIN_CLIENT.rpc("exec_as_user", {
      p_user_id: orgB.userId,
      p_sql: `UPDATE public.ativos SET nome = 'Invadido' WHERE id = '${ativoA!.id}' RETURNING nome`,
    });
    expect(error).not.toBeNull();

    // Confirma que o nome não mudou
    const { data: ainda } = await ADMIN_CLIENT
      .from("ativos")
      .select("nome")
      .eq("id", ativoA!.id)
      .single();
    expect(ainda?.nome).toBe("Protegido");
  });
});
