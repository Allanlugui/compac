import { describe, expect, it } from "vitest";
import { renderizar, templateDoEvento } from "../src/lib/email-pipeline";

/** FASE A — Pipeline de e-mail (puro, sem SMTP/DB). */
describe("FASE A — Pipeline de e-mail", () => {
  it("1. template convite tem versão e variáveis", () => {
    const t = templateDoEvento("convite_acesso");
    expect(t.versao).toBe(1);
    expect(t.assunto).toContain("{{orgNome}}");
    expect(t.corpo).toContain("{{senha}}");
  });

  it("2. render substitui variáveis e zera ausentes", () => {
    const t = templateDoEvento("convite_acesso");
    const r = renderizar(t, { nome: "Ana", orgNome: "Matriz", para: "a@x.com", senha: "abc123", siteUrl: "https://x" });
    expect(r.assunto).toBe("Seu acesso ao SGA-M · Matriz");
    expect(r.texto).toContain("Olá, Ana!");
    expect(r.texto).toContain("abc123");
    expect(r.texto).not.toMatch(/\{\{/);
  });

  it("3. sem HTML no corpo (texto puro)", () => {
    const t = templateDoEvento("convite_acesso");
    const r = renderizar(t, {});
    expect(r.texto).not.toMatch(/<[^>]+>/);
  });
});
