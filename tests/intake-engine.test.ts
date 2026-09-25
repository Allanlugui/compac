import { describe, expect, it } from "vitest";
import { novaSessao, proximaPergunta, prontaParaCriar, responder, resumo } from "../src/lib/intake/engine";
import { mapearChamado, mapearSolicitacao } from "../src/lib/intake/mapeamento";
import type { EntradaIntake, SessaoIntake } from "../src/lib/intake/types";

/** BLOCO 2 — Intake Engine (pura, sem DB/IA/UI). */
describe("BLOCO 2 — Intake Engine", () => {
  const ORG = "00000000-0000-0000-0000-000000000001";

  function resp(s: SessaoIntake, id: string, valor: unknown): SessaoIntake {
    const r = responder(s, id, valor);
    if (!r.ok) throw new Error(`responder(${id}): ${(r as { error: string }).error}`);
    return r.sessao;
  }

  it("1. QR de ativo pula ativo; universal pergunta localidade", () => {
    const ctx: EntradaIntake = { organizacaoId: ORG, tipo: "manutencao", ativoId: "a1", localidadeId: "l1" };
    let s = novaSessao("manutencao", ctx);
    s = resp(s, "solicitante_nome", "Maria");
    s = resp(s, "contato_email", "maria@x.com");
    s = resp(s, "contato_telefone", "");
    // localidade_id e ativo_id pulados pelo contexto
    expect(proximaPergunta(s)?.id).toBe("tipo_problema");
  });

  it("2. universal coleta localidade e ativo opcional", () => {
    const ctx: EntradaIntake = { organizacaoId: ORG, tipo: "manutencao" };
    let s = novaSessao("manutencao", ctx);
    s = resp(s, "solicitante_nome", "João");
    s = resp(s, "contato_email", "joao@x.com");
    s = resp(s, "contato_telefone", "");
    expect(proximaPergunta(s)?.id).toBe("localidade_id");
    s = resp(s, "localidade_id", "Bloco B");
    expect(proximaPergunta(s)?.id).toBe("ativo_id");
  });

  it("3. fluxo manutenção completo gera payload de chamado", () => {
    const ctx: EntradaIntake = {
      organizacaoId: ORG, tipo: "manutencao", ativoId: "a1", localidadeId: "l1",
      rotulos: { ativoNome: "Bomba 01" },
    };
    let s = novaSessao("manutencao", ctx);
    s = resp(s, "solicitante_nome", "Maria Silva");
    s = resp(s, "contato_email", "maria@empresa.com");
    s = resp(s, "contato_telefone", "(11) 99999-0000");
    s = resp(s, "tipo_problema", "vazamento");
    s = resp(s, "descricao", "Vaso sanitário vazando no banheiro");
    s = resp(s, "urgencia", "alta");
    s = resp(s, "fotos", [{ nome: "foto.jpg", mime: "image/jpeg", tamanhoBytes: 1000 }]);
    s = resp(s, "acompanhantes", "a@x.com; A@x.com, b@y.com");
    expect(prontaParaCriar(s)).toBe(false);
    s = resp(s, "confirmacao", true);
    expect(prontaParaCriar(s)).toBe(true);
    const p = mapearChamado(s);
    expect(p.organization_id).toBe(ORG);
    expect(p.ativo_id).toBe("a1");
    expect(p.localidade_id).toBe("l1");
    expect(p.solicitante).toBe("Maria Silva");
    expect(p.descricao).toContain("vazamento");
    expect(p.acompanhantes).toEqual(["a@x.com", "b@y.com"]);
    expect(p.fotos).toHaveLength(1);
    expect(resumo(s).length).toBeGreaterThan(5);
  });

  it("4. validações barram entrada ruim e fora de ordem", () => {
    const ctx: EntradaIntake = { organizacaoId: ORG, tipo: "manutencao" };
    const s = novaSessao("manutencao", ctx);
    expect(responder(s, "contato_email", "x")).toEqual({ ok: false, error: expect.any(String) });
    expect(responder(s, "descricao", "x")).toEqual({ ok: false, error: expect.stringContaining("solicitante_nome") });
    expect(responder(s, "solicitante_nome", "A")).toEqual({ ok: false, error: expect.any(String) });
    let s2 = resp(s, "solicitante_nome", "Ok Nome");
    expect(responder(s2, "contato_email", "sem-arroba")).toEqual({ ok: false, error: "E-mail inválido." });
    s2 = resp(s2, "contato_email", "ok@x.com");
    s2 = resp(s2, "contato_telefone", "");
    s2 = resp(s2, "localidade_id", "Sala 1");
    s2 = resp(s2, "ativo_id", "");
    expect(responder(s2, "tipo_problema", "alienigena")).toEqual({ ok: false, error: expect.any(String) });
  });

  it("5. anexo inválido e confirmação negada", () => {
    const ctx: EntradaIntake = { organizacaoId: ORG, tipo: "manutencao", ativoId: "a", localidadeId: "l" };
    let s = novaSessao("manutencao", ctx);
    s = resp(s, "solicitante_nome", "Ana");
    s = resp(s, "contato_email", "ana@x.com");
    s = resp(s, "contato_telefone", "");
    s = resp(s, "tipo_problema", "outro");
    s = resp(s, "descricao", "Descrição suficiente aqui");
    s = resp(s, "urgencia", "baixa");
    expect(responder(s, "fotos", [{ nome: "x.svg", mime: "image/svg+xml", tamanhoBytes: 10 }])).toEqual({
      ok: false, error: expect.stringContaining("JPG"),
    });
    expect(responder(s, "fotos", [{ nome: "x.jpg", mime: "image/jpeg", tamanhoBytes: 9 * 1024 * 1024 }])).toEqual({
      ok: false, error: expect.stringContaining("8 MB"),
    });
    s = resp(s, "fotos", []);
    s = resp(s, "acompanhantes", "");
    expect(responder(s, "confirmacao", false)).toEqual({ ok: false, error: expect.any(String) });
    expect(() => mapearChamado(s)).toThrow("não confirmada");
  });

  it("6. fluxo compra completo gera payload de solicitação", () => {
    const ctx: EntradaIntake = { organizacaoId: ORG, tipo: "compra", centroCustoId: "cc1", qrContextoId: "q1" };
    let s = novaSessao("compra", ctx);
    s = resp(s, "solicitante_nome", "Carlos");
    s = resp(s, "contato_email", "carlos@x.com");
    s = resp(s, "contato_telefone", "");
    s = resp(s, "item", "Lâmpada LED 12W");
    s = resp(s, "quantidade", 20);
    s = resp(s, "justificativa", "Reposição das queimadas do corredor");
    s = resp(s, "urgencia", "media");
    s = resp(s, "acompanhantes", "");
    s = resp(s, "confirmacao", "sim");
    expect(prontaParaCriar(s)).toBe(true);
    const p = mapearSolicitacao(s);
    expect(p.organization_id).toBe(ORG);
    expect(p.item).toBe("Lâmpada LED 12W");
    expect(p.quantidade).toBe(20);
    expect(p.centro_custo_id).toBe("cc1");
    expect(p.qr_contexto_id).toBe("q1");
  });

  it("7. quantidade inválida é barrada", () => {
    const ctx: EntradaIntake = { organizacaoId: ORG, tipo: "compra" };
    let s = novaSessao("compra", ctx);
    s = resp(s, "solicitante_nome", "Carlos");
    s = resp(s, "contato_email", "c@x.com");
    s = resp(s, "contato_telefone", "");
    s = resp(s, "item", "Parafuso");
    expect(responder(s, "quantidade", 0)).toEqual({ ok: false, error: expect.any(String) });
    expect(responder(s, "quantidade", -3)).toEqual({ ok: false, error: expect.any(String) });
  });
});
