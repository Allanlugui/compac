import { describe, expect, it } from "vitest";
import {
  calcDisponivel,
  calcMTTRMs,
  calcValorEstoque,
  calcValorTotalEstoque,
  calcCustoOS,
  calcMTTRFromChamados,
  classificarSLA,
  getPeriodoRangeBRT,
  isAbaixoReposicao,
  isBacklogDemanda,
  isBacklogOS,
  isCritico,
  isReincidencia,
} from "@/lib/analytics";

describe("Analytics — Estoque", () => {
  it("disponível = físico - reservado", () => {
    expect(calcDisponivel(10, 3)).toBe(7);
    expect(calcDisponivel(5, 5)).toBe(0);
    expect(calcDisponivel(0, 0)).toBe(0);
  });

  it("crítico = disponível <= mínimo", () => {
    expect(isCritico(2, 2)).toBe(true);
    expect(isCritico(1, 2)).toBe(true);
    expect(isCritico(3, 2)).toBe(false);
  });

  it("abaixo reposição", () => {
    expect(isAbaixoReposicao(2, 2)).toBe(true);
    expect(isAbaixoReposicao(3, 2)).toBe(false);
  });

  it("valor estoque = qtd * custo médio", () => {
    expect(calcValorEstoque(10, 2.5)).toBe(25);
  });

  it("valor total estoque", () => {
    const prods = [
      { estoque_atual: 10, custo_medio: 2 },
      { estoque_atual: 5, custo_medio: 10 },
    ];
    expect(calcValorTotalEstoque(prods)).toBe(70);
  });
});

describe("Analytics — Backlog", () => {
  it("backlog demanda", () => {
    expect(isBacklogDemanda("aberto")).toBe(true);
    expect(isBacklogDemanda("em_triagem")).toBe(true);
    expect(isBacklogDemanda("resolvido")).toBe(false);
    expect(isBacklogDemanda("cancelado")).toBe(false);
  });

  it("backlog O.S.", () => {
    expect(isBacklogOS("aberta")).toBe(true);
    expect(isBacklogOS("em_execucao")).toBe(true);
    expect(isBacklogOS("concluida")).toBe(false);
    expect(isBacklogOS("encerrada")).toBe(false);
    expect(isBacklogOS(null)).toBe(false);
  });

  it("backlog exemplo: 3 abertas, 1 concluída, 1 encerrada → 3", () => {
    const os = ["aberta", "em_execucao", "aguardando_peca", "concluida", "encerrada"] as const;
    expect(os.filter((s) => isBacklogOS(s)).length).toBe(3);
  });
});

describe("Analytics — SLA", () => {
  it("dentro do prazo", () => {
    expect(classificarSLA("2026-09-10", "2026-09-09T10:00:00Z", "concluida", "2026-09-12")).toBe("dentro");
  });
  it("atrasado", () => {
    expect(classificarSLA("2026-09-10", null, "aberta", "2026-09-12")).toBe("atrasado");
  });
  it("próximo do vencimento (0-2 dias)", () => {
    expect(classificarSLA("2026-09-12", null, "aberta", "2026-09-10")).toBe("proximo");
  });
  it("sem prazo", () => {
    expect(classificarSLA(null, null, "aberta", "2026-09-12")).toBe("sem_prazo");
  });
});

describe("Analytics — MTTR", () => {
  it("MTTR = (1h+2h+3h)/3 = 2h", () => {
    const h = 3600000;
    expect(calcMTTRMs([h, 2 * h, 3 * h])).toBe(2 * h);
  });
  it("MTTR sem dados → null", () => {
    expect(calcMTTRMs([])).toBeNull();
  });
  it("MTTR exclui cancelados e sem concluido_em", () => {
    const now = new Date().toISOString();
    const antes = new Date(Date.now() - 3600000).toISOString();
    const chamados = [
      { created_at: antes, concluido_em: now, status: "resolvido" as const, os_status: "concluida" },
      { created_at: antes, concluido_em: null, status: "resolvido" as const, os_status: "concluida" },
      { created_at: antes, concluido_em: now, status: "cancelado" as const, os_status: "concluida" },
    ];
    const mttr = calcMTTRFromChamados(chamados);
    expect(mttr).not.toBeNull();
    expect(Math.abs((mttr as number) - 3600000)).toBeLessThan(10);
  });
  it("MTTR 0 registros → null (não 0)", () => {
    expect(calcMTTRFromChamados([])).toBeNull();
  });
});

describe("Analytics — Custos", () => {
  it("custo OS = 100+200+50 = 350", () => {
    expect(calcCustoOS(100, 50, 200, 0)).toBe(350);
  });
  it("custo OS com consumo", () => {
    expect(calcCustoOS(100, 20, 30, 40)).toBe(190);
  });
});

describe("Analytics — Reincidência", () => {
  it("mesmo ativo + mesma categoria + 30d < 90d → reincidência", () => {
    const hist = [{ ativo_id: "a1", categoria: "hidraulica", concluido_em: "2026-08-01T10:00:00Z" }];
    expect(isReincidencia("a1", "hidraulica", "2026-08-31T10:00:00Z", hist, 90)).toBe(true);
  });
  it("categoria diferente → não reincidência", () => {
    const hist = [{ ativo_id: "a1", categoria: "hidraulica", concluido_em: "2026-08-01T10:00:00Z" }];
    expect(isReincidencia("a1", "eletrica", "2026-08-31T10:00:00Z", hist, 90)).toBe(false);
  });
  it("fora da janela 90d → não reincidência", () => {
    const hist = [{ ativo_id: "a1", categoria: "hidraulica", concluido_em: "2026-01-01T10:00:00Z" }];
    expect(isReincidencia("a1", "hidraulica", "2026-08-31T10:00:00Z", hist, 90)).toBe(false);
  });
});

describe("Analytics — Períodos", () => {
  it("Hoje = [00:00 BRT, 00:00 BRT+1) em UTC", () => {
    const hoje = new Date("2026-09-07T12:00:00-03:00");
    const { inicio, fim } = getPeriodoRangeBRT("hoje", hoje);
    expect(inicio.toISOString()).toBe("2026-09-07T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-09-08T03:00:00.000Z");
  });
  it("7d = 7 dias incluindo hoje", () => {
    const hoje = new Date("2026-09-07T12:00:00-03:00");
    const { inicio, fim } = getPeriodoRangeBRT("7d", hoje);
    expect(inicio.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-09-08T03:00:00.000Z");
  });
});

describe("Analytics — Fronteira", () => {
  it("0 registros → backlog 0 é válido, MTTR null é Sem dados", () => {
    expect(isBacklogOS("aberta")).toBe(true);
    expect(calcMTTRMs([])).toBeNull();
  });
  it("1 registro", () => {
    expect(calcMTTRMs([3600000])).toBe(3600000);
  });
  it("tenant vazio → contadores 0", () => {
    expect(calcValorTotalEstoque([])).toBe(0);
  });
});
