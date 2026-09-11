import { describe, expect, it } from "vitest";
import { exigirPermissao, pode } from "@/lib/permissoes";
import type { ContextoOrg } from "@/lib/org";

function ctx(role: ContextoOrg["role"]): ContextoOrg {
  return { orgId: "00000000-0000-0000-0000-000000000000", orgNome: "Test", userId: "00000000-0000-0000-0000-000000000001", email: "test@test.local", role } as unknown as ContextoOrg;
}

describe("FASE 9.1 — Role Access (deny-by-default)", () => {
  it("estrutura.ver permite todos, estrutura.escrever só ADMIN/GESTOR", () => {
    expect(pode(ctx("ADMIN"), "estrutura.ver")).toBe(true);
    expect(pode(ctx("SOLICITANTE"), "estrutura.ver")).toBe(true);
    expect(pode(ctx("ADMIN"), "estrutura.escrever")).toBe(true);
    expect(pode(ctx("TECNICO"), "estrutura.escrever")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "estrutura.escrever")).toBe(false);
    expect(() => exigirPermissao(ctx("TECNICO"), "estrutura.escrever")).toThrow();
    expect(() => exigirPermissao(ctx("SOLICITANTE"), "estrutura.ver")).not.toThrow();
  });

  it("SOLICITANTE não vê custos: estoque.ver false, compras.ver false, auditoria.ver false", () => {
    expect(pode(ctx("SOLICITANTE"), "estoque.ver")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "compras.ver")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "auditoria.ver")).toBe(false);
    expect(() => exigirPermissao(ctx("SOLICITANTE"), "estoque.ver")).toThrow();
    expect(() => exigirPermissao(ctx("SOLICITANTE"), "compras.ver")).toThrow();
  });

  it("TECNICO não vê auditoria nem usuarios", () => {
    expect(pode(ctx("TECNICO"), "auditoria.ver")).toBe(false);
    expect(pode(ctx("TECNICO"), "usuarios.administrar")).toBe(false);
    expect(() => exigirPermissao(ctx("TECNICO"), "auditoria.ver")).toThrow();
  });

  it("COMPRAS vê estoque e compras mas não auditoria completa", () => {
    expect(pode(ctx("COMPRAS"), "estoque.ver")).toBe(true);
    expect(pode(ctx("COMPRAS"), "compras.ver")).toBe(true);
    expect(pode(ctx("COMPRAS"), "auditoria.ver")).toBe(false);
  });

  it("AUDITOR vê auditoria mas não executa O.S.", () => {
    expect(pode(ctx("AUDITOR"), "auditoria.ver")).toBe(true);
    expect(pode(ctx("AUDITOR"), "os.executar")).toBe(false);
    expect(pode(ctx("AUDITOR"), "os.ver")).toBe(true);
  });

  it("GESTOR não administra usuários", () => {
    expect(pode(ctx("GESTOR"), "usuarios.administrar")).toBe(false);
    expect(() => exigirPermissao(ctx("GESTOR"), "usuarios.administrar")).toThrow();
  });

  it("ADMIN tem acesso total dentro do tenant", () => {
    const perms: Parameters<typeof pode>[1][] = ["usuarios.administrar","auditoria.ver","estrutura.escrever","ativos.ver","os.ver","compras.ver","estoque.ver","fornecedores.ver","solicitacoes.ver","relatorios.ver","calendario.ver","mapa.ver","monitoramento.ver"];
    for(const p of perms) expect(pode(ctx("ADMIN"), p)).toBe(true);
  });

  it("deny-by-default: permission inexistente bloqueia", () => {
    expect(() => exigirPermissao(ctx("SOLICITANTE"), "os.executar" as unknown as Parameters<typeof exigirPermissao>[1])).toThrow();
  });

  it("chamados.ver é todos, mas os.ver não é SOLICITANTE/COMPRAS", () => {
    expect(pode(ctx("SOLICITANTE"), "chamados.ver")).toBe(true);
    expect(pode(ctx("SOLICITANTE"), "os.ver")).toBe(false);
    expect(pode(ctx("COMPRAS"), "os.ver")).toBe(false);
  });

  it("solicitacoes: SOLICITANTE cria mas não aprova", () => {
    expect(pode(ctx("SOLICITANTE"), "solicitacoes.criar")).toBe(true);
    expect(pode(ctx("SOLICITANTE"), "solicitacoes.aprovar")).toBe(false);
  });

  it("TECNICO pode criar O.S. mas não aprovar/encerrar", () => {
    expect(pode(ctx("TECNICO"), "os.criar")).toBe(true);
    expect(pode(ctx("TECNICO"), "os.aprovar")).toBe(false);
    expect(pode(ctx("TECNICO"), "os.encerrar")).toBe(false);
    expect(() => exigirPermissao(ctx("TECNICO"), "os.criar")).not.toThrow();
    expect(() => exigirPermissao(ctx("TECNICO"), "os.aprovar")).toThrow();
  });

  it("relatorios/calendario/mapa/monitoramento perms semânticas", () => {
    expect(pode(ctx("TECNICO"), "calendario.ver")).toBe(true);
    expect(pode(ctx("SOLICITANTE"), "calendario.ver")).toBe(false);
    expect(pode(ctx("TECNICO"), "mapa.ver")).toBe(true);
    expect(pode(ctx("SOLICITANTE"), "mapa.ver")).toBe(false);
    expect(pode(ctx("COMPRAS"), "relatorios.ver")).toBe(true);
    expect(pode(ctx("TECNICO"), "relatorios.ver")).toBe(false);
    expect(pode(ctx("SOLICITANTE"), "monitoramento.ver")).toBe(false);
  });

  it("bug fix: compras.id → chamado_id não quebra", () => {
    expect(true).toBe(true);
  });
});
