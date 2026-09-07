import { describe, expect, it } from "vitest";
import { ADMIN_CLIENT, clienteComo, setupOrg } from "./setup";

/**
 * TESTES DE ISOLAMENTO MULTI-TENANT (RLS)
 *
 * Valida que um usuário autenticado da Org A não consegue ler,
 * escrever ou modificar dados da Org B, mesmo manipulando IDs
 * diretamente. Cada teste usa `clienteComo(userId)` para criar
 * um client autenticado real (com JWT válido) e o `admin` para
 * criar os dados a serem atacados.
 */

describe("RLS — Isolamento multi-tenant", () => {

  it("ativos: cliente da org B NÃO VÊ ativos da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    // Cria ativo na org A via service role (bypass RLS)
    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({
        organization_id: orgA.orgId,
        nome: "Ativo Sigiloso",
        status: "operacional",
        tipo: "equipamento",
      })
      .select("id")
      .single();
    expect(ativoA).not.toBeNull();

    // Autentica como user da org B
    const clienteB = await clienteComo(orgB.userId);
    const { data: visivel } = await clienteB
      .from("ativos")
      .select("id")
      .eq("id", ativoA!.id)
      .maybeSingle();
    expect(visivel).toBeNull();
  });

  it("ativos: cliente da org B NÃO CONSEGUE ATUALIZAR ativo da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({
        organization_id: orgA.orgId,
        nome: "Ativo Protegido",
        status: "operacional",
        tipo: "equipamento",
      })
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { error } = await clienteB
      .from("ativos")
      .update({ nome: "Invadido" })
      .eq("id", ativoA!.id);
    expect(error).not.toBeNull();

    // Confirma que o nome NÃO mudou
    const { data: ainda } = await ADMIN_CLIENT
      .from("ativos")
      .select("nome")
      .eq("id", ativoA!.id)
      .single();
    expect(ainda?.nome).toBe("Ativo Protegido");
  });

  it("ativos: cliente da org B NÃO CONSEGUE DELETAR ativo da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({
        organization_id: orgA.orgId,
        nome: "Ativo Indelével",
        status: "operacional",
        tipo: "equipamento",
      })
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { error } = await clienteB.from("ativos").delete().eq("id", ativoA!.id);
    expect(error).not.toBeNull();

    const { data: existe } = await ADMIN_CLIENT
      .from("ativos")
      .select("id")
      .eq("id", ativoA!.id)
      .maybeSingle();
    expect(existe).not.toBeNull();
  });

  it("chamados: cliente da org B NÃO VÊ chamados da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id")
      .single();
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
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { data: visivel } = await clienteB
      .from("chamados")
      .select("id")
      .eq("id", chamadoA!.id)
      .maybeSingle();
    expect(visivel).toBeNull();
  });

  it("chamados: cliente da org B NÃO CONSEGUE CRIAR chamado na org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { error } = await clienteB.from("chamados").insert({
      organization_id: orgA.orgId, // forçando org A
      ativo_id: ativoA!.id,
      solicitante: "Atacante",
      descricao: "Tentativa de invasão",
      origem: "administrador",
      prioridade: "media",
      status: "aberto",
    });
    expect(error).not.toBeNull();
  });

  it("produtos: cliente da org B NÃO VÊ produtos da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "SECRETO-1", descricao: "P1", estoque_atual: 50 })
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { data: visivel } = await clienteB
      .from("produtos")
      .select("id")
      .eq("id", produtoA!.id)
      .maybeSingle();
    expect(visivel).toBeNull();
  });

  it("produtos: cliente da org B NÃO CONSEGUE DAR BAIXA em produto da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id")
      .single();
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
      .select("id")
      .single();
    const { data: produtoA } = await ADMIN_CLIENT
      .from("produtos")
      .insert({ organization_id: orgA.orgId, codigo: "X-1", descricao: "X", estoque_atual: 100 })
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { error } = await clienteB.from("movimentacoes_estoque").insert({
      organization_id: orgA.orgId, // forçando org A
      produto_id: produtoA!.id,
      chamado_id: chamadoA!.id,
      user_id: orgB.userId,
      tipo: "consumo",
      quantidade: 10,
      custo_unitario: 5,
    });
    expect(error).not.toBeNull();
  });

  it("fornecedores: cliente da org B NÃO VÊ fornecedores da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: fornA } = await ADMIN_CLIENT
      .from("fornecedores")
      .insert({ organization_id: orgA.orgId, nome: "Fornecedor Secreto" })
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { data: visivel } = await clienteB
      .from("fornecedores")
      .select("id")
      .eq("id", fornA!.id)
      .maybeSingle();
    expect(visivel).toBeNull();
  });

  it("auditoria_logs: cliente da org B NÃO VÊ logs da org A", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id")
      .single();
    const { data: logA } = await ADMIN_CLIENT
      .from("auditoria_logs")
      .insert({
        organization_id: orgA.orgId,
        tabela: "ativos",
        registro_id: ativoA!.id,
        acao: "INSERT",
        executado_por: "user-a@sga-test.local",
      })
      .select("id")
      .single();

    const clienteB = await clienteComo(orgB.userId);
    const { data: visivel } = await clienteB
      .from("auditoria_logs")
      .select("id")
      .eq("id", logA!.id)
      .maybeSingle();
    expect(visivel).toBeNull();
  });

  it("listagem: cada org vê APENAS seus próprios dados", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    for (let i = 0; i < 3; i++) {
      await ADMIN_CLIENT.from("ativos").insert({
        organization_id: orgA.orgId,
        nome: `Ativo-A-${i}`,
        status: "operacional",
        tipo: "equipamento",
      });
    }
    for (let i = 0; i < 2; i++) {
      await ADMIN_CLIENT.from("ativos").insert({
        organization_id: orgB.orgId,
        nome: `Ativo-B-${i}`,
        status: "operacional",
        tipo: "equipamento",
      });
    }

    const clienteA = await clienteComo(orgA.userId);
    const clienteB = await clienteComo(orgB.userId);

    const { data: ativosA } = await clienteA.from("ativos").select("nome");
    const { data: ativosB } = await clienteB.from("ativos").select("nome");

    expect(ativosA?.length).toBe(3);
    expect(ativosA?.every((a: { nome: string }) => a.nome.startsWith("Ativo-A-"))).toBe(true);
    expect(ativosB?.length).toBe(2);
    expect(ativosB?.every((a: { nome: string }) => a.nome.startsWith("Ativo-B-"))).toBe(true);
  });

  it("trigger enforce_same_org: cross-org insert em chamado BLOQUEADO", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id")
      .single();

    // Cliente da org B tenta criar chamado referenciando ativo da org A
    const clienteB = await clienteComo(orgB.userId);
    const { error } = await clienteB.from("chamados").insert({
      organization_id: orgB.orgId,
      ativo_id: ativoA!.id, // ativo de outra org
      solicitante: "B",
      descricao: "Cross-tenant",
      origem: "administrador",
      prioridade: "media",
      status: "aberto",
    });
    expect(error).not.toBeNull();
  });

  it("dashboard: contadores por org são isolados", async () => {
    const orgA = await setupOrg("org-a");
    const orgB = await setupOrg("org-b");

    const { data: ativoA } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgA.orgId, nome: "A1", status: "operacional", tipo: "equipamento" })
      .select("id")
      .single();
    const { data: ativoB } = await ADMIN_CLIENT
      .from("ativos")
      .insert({ organization_id: orgB.orgId, nome: "B1", status: "operacional", tipo: "equipamento" })
      .select("id")
      .single();

    for (let i = 0; i < 5; i++) {
      await ADMIN_CLIENT.from("chamados").insert({
        organization_id: orgA.orgId,
        ativo_id: ativoA!.id,
        solicitante: "A",
        descricao: `A-${i}`,
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      });
    }
    for (let i = 0; i < 2; i++) {
      await ADMIN_CLIENT.from("chamados").insert({
        organization_id: orgB.orgId,
        ativo_id: ativoB!.id,
        solicitante: "B",
        descricao: `B-${i}`,
        origem: "administrador",
        prioridade: "media",
        status: "aberto",
      });
    }

    const clienteA = await clienteComo(orgA.userId);
    const clienteB = await clienteComo(orgB.userId);

    const { count: totalA } = await clienteA
      .from("chamados")
      .select("id", { count: "exact", head: true });
    const { count: totalB } = await clienteB
      .from("chamados")
      .select("id", { count: "exact", head: true });

    expect(totalA).toBe(5);
    expect(totalB).toBe(2);
  });
});
