import { describe, expect, it } from "vitest";
import { calcScoreAuto, calcScoreFinal, MIN_OS_TECNICO } from "@/lib/performance";

describe("FASE 9.5 — Performance", () => {
  it("score automático com pesos 25/25/20/20/10", () => {
    const { score } = calcScoreAuto({ produtividade: 80, prazo: 90, tempo: 70, qualidade: 85, eficiencia: 95 });
    expect(score).toBe(Math.round((80*25+90*25+70*20+85*20+95*10)/100));
  });
  it("insufficient_data se <5 O.S.", () => {
    expect(MIN_OS_TECNICO).toBe(5);
    const { estado } = calcScoreAuto({ produtividade: null, prazo: 90, tempo: 70, qualidade: 85, eficiencia: 95 });
    expect(estado).toBe("insufficient_data");
  });
  it("score final = 0.8*auto + 0.2*gerencial", () => {
    expect(calcScoreFinal(80, 90)).toBe(82);
    expect(calcScoreFinal(null, 90)).toBe(90);
    expect(calcScoreFinal(80, null)).toBe(80);
  });
  it("transparência: detalhe mostra métricas", () => {
    const { detalhe } = calcScoreAuto({ produtividade: 85, prazo: 90, tempo: 75, qualidade: 80, eficiencia: 90 });
    expect(detalhe).toContain("produtividade");
  });
});
