import { describe, expect, it } from "vitest";
import { pode, exigirPermissao } from "@/lib/permissoes";
import type { ContextoOrg } from "@/lib/org";

function ctx(role: ContextoOrg["role"]): ContextoOrg {
  return { orgId: "00000000-0000-0000-0000-000000000000", orgNome: "Test", userId: "00000000-0000-0000-0000-000000000001", email: "test@test.local", role } as unknown as ContextoOrg;
}

describe("FASE 9.2 — Role Experience", () => {
  it("menu role-aware: SOLICITANTE não vê Auditoria/Monitoramento/Estoque", () => {
    expect(pode(ctx("SOLICITANTE"), "auditoria.ver")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "estoque.ver")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "compras.ver")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "solicitacoes.ver")).toBe(true);
  });

  it("TECNICO Minha Operação: vê O.S. e pode criar, mas não aprovar", () => {
    expect(pode(ctx("TECNICO"), "os.ver")).toBe(true);
    expect(pode(ctx("TECNICO"), "os.criar")).toBe(true);
    expect(pode(ctx("TECNICO"), "os.aprovar")).toBe(false);
    expect(pode(ctx("TECNICO"), "chamados.ver")).toBe(true);
  });

  it("SOLICITANTE Minhas Solicitações: só próprias, não vê custos", () => {
    expect(pode(ctx("SOLICITANTE"), "solicitacoes.criar")).toBe(true);
    expect(pode(ctx("SOLICITANTE"), "solicitacoes.aprovar")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "estoque.ver")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "compras.ver")).toBe(false);
  });

  it("COMPRAS Suprimentos: workflow completo sem O.S. técnica", () => {
    expect(pode(ctx("COMPRAS"), "solicitacoes.ver")).toBe(true);
    expect(pode(ctx("COMPRAS"), "compras.criar")).toBe(true);
    expect(pode(ctx("COMPRAS"), "compras.receber")).toBe(true);
    expect(pode(ctx("COMPRAS"), "os.executar")).toBe(false);
  });

  it("AUDITOR Conformidade: lê mas não executa", () => {
    expect(pode(ctx("AUDITOR"), "auditoria.ver")).toBe(true);
    expect(pode(ctx("AUDITOR"), "os.executar")).toBe(false);
    expect(pode(ctx("AUDITOR"), "estoque.ver")).toBe(true);
  });

  it("ADMIN visão completa", () => {
    expect(pode(ctx("ADMIN"), "usuarios.administrar")).toBe(true);
    expect(pode(ctx("ADMIN"), "auditoria.ver")).toBe(true);
    expect(pode(ctx("ADMIN"), "os.ver")).toBe(true);
  });

  it("Meu Perfil: todos podem editar próprio, não role/org", () => {
    // Todos os 6 roles podem acessar /admin/perfil (requireOrg apenas, sem exigirPermissao específica)
    for (const r of ["ADMIN","GESTOR","TECNICO","COMPRAS","AUDITOR","SOLICITANTE"] as const) {
      expect(pode(ctx(r), "estrutura.ver")).toBe(true); // perfil usa estrutura.ver como proxy leitura
    }
    // Ninguém pode alterar role via perfil (não existe action que permita)
    expect(pode(ctx("TECNICO"), "usuarios.administrar")).toBe(false);
  });

  it("field visibility: custo só ADMIN/GESTOR/COMPRAS/AUDITOR", () => {
    expect(pode(ctx("SOLICITANTE"), "compras.ver")).toBe(false);
    expect(pode(ctx("TECNICO"), "compras.ver")).toBe(false);
    expect(pode(ctx("ADMIN"), "compras.ver")).toBe(true);
  });
});
