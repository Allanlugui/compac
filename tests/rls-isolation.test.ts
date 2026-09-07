import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";

/**
 * TESTES DE ISOLAMENTO MULTI-TENANT (RLS)
 *
 * Valida que um usuário da Org A não consegue ler, escrever ou
 * modificar dados da Org B, mesmo manipulando IDs diretamente via
 * Supabase client com role AUTHENTICATED.
 *
 * Cada teste cria dados reais no banco (service role), depois usa
 * o client AUTHENTICATED da org "atacante" para tentar acessar dados
 * da org "vítima". O RLS do PostgreSQL deve bloquear tudo.
 */

describe("RLS — Isolamento multi-tenant", () => {

  it("ativos: org B não vê ativos da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    expect(ativoA.error).toBeNull();
    expect(ativoA.data).not.toBeNull();

    // Org B tenta ler ativo da Org A
    const { data: ativoVisivel, error: erroRead } = await orgB.client
      .from("ativos")
      .select("id")
      .eq("id", ativoA.data!.id)
      .maybeSingle();

    expect(erroRead).toBeNull();
    expect(ativoVisivel).toBeNull(); // RLS filtra
  });

  it("ativos: org B não consegue atualizar ativo da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    // Org B tenta forçar update via client
    const { error: erroUpdate } = await orgB.client
      .from("ativos")
      .update({ nome: "Invadido por Org B" })
      .eq("id", ativoA.data!.id);

    // RLS com check(organization_id) → rejeita
    expect(erroUpdate).not.toBeNull();
  });

  it("ativos: org B não consegue deletar ativo da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    const { error: erroDelete } = await orgB.client
      .from("ativos")
      .delete()
      .eq("id", ativoA.data!.id);

    // RLS blocking delete
    expect(erroDelete).not.toBeNull();
  });

  it("chamados: org B não vê chamados da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    const chamadoA = await orgA.client.from("chamados").insert({
      organization_id: orgA.orgId,
      ativo_id: ativoA.data!.id,
      solicitante: "User A",
      descricao: "Chamado da Org A",
      origem: "administrador",
      prioridade: "media",
      status: "aberto",
    }).select("id").single();

    const { data: chamadoVisivel, error: erroRead } = await orgB.client
      .from("chamados")
      .select("id")
      .eq("id", chamadoA.data!.id)
      .maybeSingle();

    expect(erroRead).toBeNull();
    expect(chamadoVisivel).toBeNull();
  });

  it("chamados: org B não consegue criar chamado na org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    // Org B tenta criar chamado com organization_id da Org A
    const { data, error: erroInsert } = await orgB.client
      .from("chamados")
      .insert({
        organization_id: orgA.orgId, // forçando org A
        ativo_id: ativoA.data!.id,
        solicitante: "User B",
        descricao: "Tentativa invasão",
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      })
      .select("id")
      .maybeSingle();

    // RLS with check(organization_id) → inserting into org A's namespace should fail
    // OR the trigger enforce_same_org should block it
    expect(erroInsert).not.toBeNull();
  });

  it("produtos: org B não vê produtos da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const produtoA = await orgA.client.from("produtos").insert({
      organization_id: orgA.orgId,
      codigo: "PROD-A-001",
      descricao: "Produto Org A",
      estoque_atual: 100,
    }).select("id").single();

    const { data: produtoVisivel, error: erroRead } = await orgB.client
      .from("produtos")
      .select("id")
      .eq("id", produtoA.data!.id)
      .maybeSingle();

    expect(erroRead).toBeNull();
    expect(produtoVisivel).toBeNull();
  });

  it("produtos: org B não consegue dar baixa em produto da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    const chamadoA = await orgA.client.from("chamados").insert({
      organization_id: orgA.orgId,
      ativo_id: ativoA.data!.id,
      solicitante: "User A",
      descricao: "Chamado Org A",
      origem: "administrador",
      prioridade: "media",
      status: "aberto",
    }).select("id").single();

    const produtoA = await orgA.client.from("produtos").insert({
      organization_id: orgA.orgId,
      codigo: "PROD-A-002",
      descricao: "Produto Org A",
      estoque_atual: 100,
    }).select("id").single();

    // Org B tenta consumir estoque da Org A
    const { error: erroConsumo } = await orgB.client
      .from("movimentacoes_estoque")
      .insert({
        organization_id: orgA.orgId, // forçando org A
        produto_id: produtoA.data!.id,
        chamado_id: chamadoA.data!.id,
        tipo: "consumo",
        quantidade: 5,
        custo_unitario: 10,
      });

    // RLS ou trigger deve bloquear
    expect(erroConsumo).not.toBeNull();
  });

  it("fornecedores: org B não vê fornecedores da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const fornA = await orgA.client.from("fornecedores").insert({
      organization_id: orgA.orgId,
      nome: "Fornecedor Org A",
    }).select("id").single();

    const { data: fornVisivel, error: erroRead } = await orgB.client
      .from("fornecedores")
      .select("id")
      .eq("id", fornA.data!.id)
      .maybeSingle();

    expect(erroRead).toBeNull();
    expect(fornVisivel).toBeNull();
  });

  it("auditoria_logs: org B não vê logs da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    const logA = await orgA.client.from("auditoria_logs").insert({
      organization_id: orgA.orgId,
      tabela: "ativos",
      registro_id: ativoA.data!.id,
      acao: "INSERT",
      executado_por: "user-a@teste.com",
    }).select("id").single();

    const { data: logVisivel, error: erroRead } = await orgB.client
      .from("auditoria_logs")
      .select("id")
      .eq("id", logA.data!.id)
      .maybeSingle();

    expect(erroRead).toBeNull();
    expect(logVisivel).toBeNull();
  });

  it("org A e org B veem SOMENTE seus próprios dados após operações mistas", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    // Org A cria 3 ativos
    for (let i = 0; i < 3; i++) {
      await orgA.client.from("ativos").insert({
        organization_id: orgA.orgId,
        nome: `Ativo Org A ${i}`,
        status: "operacional",
        tipo: "equipamento",
      });
    }

    // Org B cria 2 ativos
    for (let i = 0; i < 2; i++) {
      await orgB.client.from("ativos").insert({
        organization_id: orgB.orgId,
        nome: `Ativo Org B ${i}`,
        status: "operacional",
        tipo: "equipamento",
      });
    }

    const { data: ativosA } = await orgA.client
      .from("ativos")
      .select("nome")
      .order("created_at", { ascending: true });

    const { data: ativosB } = await orgB.client
      .from("ativos")
      .select("nome")
      .order("created_at", { ascending: true });

    expect(ativosA?.every((a: { nome: string }) => a.nome.startsWith("Ativo Org A"))).toBe(true);
    expect(ativosA?.length).toBe(3);
    expect(ativosB?.every((a: { nome: string }) => a.nome.startsWith("Ativo Org B"))).toBe(true);
    expect(ativosB?.length).toBe(2);
  });

  it("trigger enforce_same_org: cross-org insert bloqueado", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    // Org B tenta criar chamado usando ativo de outra org
    const { error: erroChamado } = await orgB.client
      .from("chamados")
      .insert({
        organization_id: orgB.orgId,
        ativo_id: ativoA.data!.id, // ativo é da Org A
        solicitante: "User B",
        descricao: "Tentativa cross-tenant",
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      });

    // Trigger enforce_same_org ou RLS bloqueia
    expect(erroChamado).not.toBeNull();
  });

  it("dashboard: org A não vê totais da org B", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    // Org A cria 5 chamados
    const ativoA = await orgA.client.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo Org A",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    for (let i = 0; i < 5; i++) {
      await orgA.client.from("chamados").insert({
        organization_id: orgA.orgId,
        ativo_id: ativoA.data!.id,
        solicitante: "User A",
        descricao: `Chamado A ${i}`,
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      });
    }

    // Org B cria 2 chamados
    const ativoB = await orgB.client.from("ativos").insert({
      organization_id: orgB.orgId,
      nome: "Ativo Org B",
      status: "operacional",
      tipo: "equipamento",
    }).select("id").single();

    for (let i = 0; i < 2; i++) {
      await orgB.client.from("chamados").insert({
        organization_id: orgB.orgId,
        ativo_id: ativoB.data!.id,
        solicitante: "User B",
        descricao: `Chamado B ${i}`,
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      });
    }

    const { count: totalA } = await orgA.client
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgA.orgId);

    const { count: totalB } = await orgB.client
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgB.orgId);

    expect(totalA).toBe(5);
    expect(totalB).toBe(2);
  });
});
