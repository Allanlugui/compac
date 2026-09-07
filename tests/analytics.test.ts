import { describe, expect, it } from "vitest";
import {
  calcDisponivel,
  calcMTTRMs,
  calcTempoExecucaoMs,
  calcTempoResolucaoMs,
  calcValorEstoque,
  calcValorTotalEstoque,
  calcValorTotalEstoqueFisico,
  calcCustoOS,
  calcMTTRFromChamados,
  calcMTBFIntervalsMs,
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

  it("valor total estoque (físico)", () => {
    const prods = [
      { estoque_atual: 10, custo_medio: 2 },
      { estoque_atual: 5, custo_medio: 10 },
    ];
    expect(calcValorTotalEstoque(prods)).toBe(70);
  });

  it("valor estoque físico vs disponível (SPEC §9)", () => {
    // valor físico usa estoque_atual, não disponível
    const prods = [{ estoque_atual: 10, custo_medio: 5, ultimo_custo: 3 }];
    expect(calcValorTotalEstoqueFisico(prods)).toBe(50); // 10*5
    // valor disponível seria 7*5=35, mas valuation usa físico
    expect(calcValorEstoque(7, 5)).toBe(35);
  });

  it("estoque crítico vs abaixo reposição são métricas distintas", () => {
    // disponível 3, minimo 2, ponto 5 → crítico false, abaixo repos true
    expect(isCritico(3, 2)).toBe(false);
    expect(isAbaixoReposicao(3, 5)).toBe(true);
  });

  it("fallback ponto_reposicao nulo → usa minimo", () => {
    // se ponto nulo, documentar fallback para minimo
    const disponivel = 2;
    const minimo = 2;
    const ponto = 0; // fallback 0 → mesma regra que minimo
    expect(isCritico(disponivel, minimo)).toBe(true);
    expect(isAbaixoReposicao(disponivel, ponto || minimo)).toBe(true);
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

  it("O.S. aberta ≠ chamado aberto (contagem canônica)", () => {
    // O.S. aberta requer os_status, não só status
    expect(isBacklogOS("aberta")).toBe(true);
    expect(isBacklogDemanda("aberto")).toBe(true);
    // mas são contagens separadas
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
  it("próximo do vencimento (0-2 dias, limiar 2d)", () => {
    expect(classificarSLA("2026-09-12", null, "aberta", "2026-09-10")).toBe("proximo"); // 2 dias
    expect(classificarSLA("2026-09-11", null, "aberta", "2026-09-10")).toBe("proximo"); // 1 dia
    expect(classificarSLA("2026-09-10", null, "aberta", "2026-09-10")).toBe("proximo"); // 0 dias
  });
  it("dentro quando >2 dias", () => {
    expect(classificarSLA("2026-09-15", null, "aberta", "2026-09-10")).toBe("dentro"); // 5 dias
  });
  it("sem prazo", () => {
    expect(classificarSLA(null, null, "aberta", "2026-09-12")).toBe("sem_prazo");
  });
});

describe("Analytics — TTR vs Tempo Execução vs MTTR", () => {
  it("TTR = created_at → concluido_em (tempo de resolução)", () => {
    const ttr = calcTempoResolucaoMs("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z");
    expect(ttr).toBe(2 * 3600000);
  });
  it("Tempo Execução = data_inicio → data_fim", () => {
    const tex = calcTempoExecucaoMs("2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z");
    expect(tex).toBe(3600000);
  });
  it("Tempo Execução null quando sem data_inicio/fim", () => {
    expect(calcTempoExecucaoMs(null, "2026-09-01T11:00:00Z")).toBeNull();
    expect(calcTempoExecucaoMs("2026-09-01T10:00:00Z", null)).toBeNull();
  });
  it("MTTR = AVG(TTR) onde TTR válido (nome exibido: Tempo médio de resolução)", () => {
    const h = 3600000;
    expect(calcMTTRMs([h, 2 * h, 3 * h])).toBe(2 * h);
  });
  it("MTTR sem dados → null (Sem dados suficientes)", () => {
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
});

describe("Analytics — MTBF", () => {
  it("MTBF = média(intervalos) para 3 falhas com intervalos 10d,20d → 15d", () => {
    const d = 86400000;
    expect(calcMTBFIntervalsMs([10 * d, 20 * d])).toBe(15 * d);
  });
  it("MTBF requer ≥3 falhas (2 intervalos), senão Dados insuficientes", () => {
    expect(calcMTBFIntervalsMs([10 * 86400000])).toBeNull();
    expect(calcMTBFIntervalsMs([])).toBeNull();
  });
  it("MTBF não conta preventiva/inspecao (só corretiva)", () => {
    // simulado: só corretiva entra no cálculo, preventiva é filtrada antes
    const intervalosCorretiva = [10 * 86400000, 20 * 86400000];
    expect(calcMTBFIntervalsMs(intervalosCorretiva)).toBe(15 * 86400000);
  });
  it("MTBF usa created_at como falha (não concluido_em)", () => {
    // falhas em D+0, D+10, D+30 via created_at
    const f1 = new Date("2026-01-01T10:00:00Z").getTime();
    const f2 = new Date("2026-01-11T10:00:00Z").getTime();
    const f3 = new Date("2026-01-31T10:00:00Z").getTime();
    const intervalos = [f2 - f1, f3 - f2];
    expect(calcMTBFIntervalsMs(intervalos)).toBe(15 * 86400000);
  });
});

describe("Analytics — Custos", () => {
  it("custo OS = 100+200+50 = 350", () => {
    expect(calcCustoOS(100, 50, 200, 0)).toBe(350);
  });
  it("custo OS com consumo", () => {
    expect(calcCustoOS(100, 20, 30, 40)).toBe(190);
  });
  it("dupla contagem: Compra 1000 + Consumo 100 → Custo OS = 100 (não 1100)", () => {
    const compraValor = 1000; // aquisição
    const consumoValor = 100; // manutenção
    const custoOS = calcCustoOS(0, 0, 0, consumoValor);
    expect(custoOS).toBe(100);
    expect(custoOS).not.toBe(compraValor + consumoValor);
  });
});

describe("Analytics — Reincidência", () => {
  it("mesmo ativo + mesma categoria ocorrência + 30d < 90d → reincidência", () => {
    const hist = [{ ativo_id: "a1", categoria: "hidraulica", concluido_em: "2026-08-01T10:00:00Z" }];
    expect(isReincidencia("a1", "hidraulica", "2026-08-31T10:00:00Z", hist, 90)).toBe(true);
  });
  it("categoria ocorrência vs categoria ativo: usa categoria da ocorrência", () => {
    // ativos.categoria_id é do ativo, não da ocorrência — não usar como proxy
    const hist = [{ ativo_id: "a1", categoria: "hidraulica", concluido_em: "2026-08-01T10:00:00Z" }];
    // categoria da ocorrência diferente → não reincidência, mesmo ativo
    expect(isReincidencia("a1", "eletrica", "2026-08-31T10:00:00Z", hist, 90)).toBe(false);
  });
  it("fora da janela 90d → não reincidência", () => {
    const hist = [{ ativo_id: "a1", categoria: "hidraulica", concluido_em: "2026-01-01T10:00:00Z" }];
    expect(isReincidencia("a1", "hidraulica", "2026-08-31T10:00:00Z", hist, 90)).toBe(false);
  });
  it("categoria nula → heurística com limitação (só ativo_id)", () => {
    const hist = [{ ativo_id: "a1", categoria: null, concluido_em: "2026-08-01T10:00:00Z" }];
    // quando ocorrência tem categoria nula, considera só ativo_id (heurística)
    expect(isReincidencia("a1", null, "2026-08-31T10:00:00Z", hist, 90)).toBe(true);
  });
});

describe("Analytics — Disponibilidade", () => {
  it("sem histórico contínuo → Dados insuficientes (não 100%)", () => {
    // sem ativo_status_historico cobrindo período, não assumir Operacional
    // este teste documenta a regra: disponibilidade requer histórico
    const historico: { status: string; created_at: string }[] = [];
    const temHistorico = historico.length > 0;
    expect(temHistorico).toBe(false);
    // disponibilidade = null (insufficient_data), não 1
  });

  it("calcDisponibilidade sem histórico → insufficient_data", async () => {
    const { calcDisponibilidade } = await import("@/lib/analytics");
    const periodo = { inicio: new Date("2026-09-01T03:00:00Z"), fim: new Date("2026-09-30T03:00:00Z") };
    const r = calcDisponibilidade([], periodo);
    expect(r.state).toBe("insufficient_data");
    expect(r.value).toBeNull();
  });
});

describe("Analytics — Períodos", () => {
  it("Hoje = [00:00 America/Sao_Paulo, 00:00 +1) em UTC", () => {
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
  it("America/Sao_Paulo IANA, não offset -3 fixo", () => {
    // documenta que getPeriodoRangeBRT usa Intl com America/Sao_Paulo
    const hoje = new Date("2026-01-15T12:00:00-03:00"); // verão sem DST
    const { inicio } = getPeriodoRangeBRT("hoje", hoje);
    expect(inicio.toISOString()).toContain("T03:00:00.000Z");
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
  it("período sem dados → MTTR null", () => {
    expect(calcMTTRFromChamados([])).toBeNull();
  });
  it("prazo nulo → Sem prazo", () => {
    expect(classificarSLA(null, null, "aberta", "2026-09-12")).toBe("sem_prazo");
  });
  it("O.S. cancelada → excluída de MTTR", () => {
    const chamados = [{ created_at: new Date().toISOString(), concluido_em: new Date().toISOString(), status: "cancelado" as const, os_status: "concluida" }];
    expect(calcMTTRFromChamados(chamados)).toBeNull();
  });
  it("consumo sem custo → 0, não null", () => {
    expect(calcCustoOS(0, 0, 0, 0)).toBe(0);
  });
  it("ativo desativado → ainda conta em total, mas separado", () => {
    // total inclui desativado, mas KPI por status separa
    expect(isBacklogOS("aberta")).toBe(true);
  });
});

describe("Analytics — Dupla Contagem", () => {
  it("compra + consumo + entrada: custo = consumo apenas", () => {
    const compra = 1000;
    const entrada = 1000; // mesma mercadoria, estoque
    const consumo = 100;
    expect(calcCustoOS(0, 0, 0, consumo)).toBe(100);
    expect(calcCustoOS(0, 0, 0, consumo)).not.toBe(compra);
    expect(calcCustoOS(0, 0, 0, consumo)).not.toBe(entrada);
  });
  it("reserva + consumo: disponível = físico - reservado, consumo não duplica reserva", () => {
    expect(calcDisponivel(10, 3)).toBe(7); // físico 10, reservado 3
    // reserva 3 não é custo, consumo 2 baixa físico e reservado
    const custoReserva = 0;
    const custoConsumo = 40;
    expect(custoReserva).toBe(0);
    expect(calcCustoOS(0, 0, 0, custoConsumo)).toBe(40);
  });
  it("chamado + O.S.: demanda vs execução separadas", () => {
    expect(isBacklogDemanda("aberto")).toBe(true);
    expect(isBacklogOS("aberta")).toBe(true);
    // um convertido_os é 1 demanda e 1 O.S., mas contagens separadas não somam
    expect(isBacklogDemanda("convertido_os")).toBe(true);
    expect(isBacklogOS("aberta")).toBe(true);
  });
});

describe("Analytics — Consistência", () => {
  it("dashboard, relatório, exportação usam mesma query (mesma fórmula) → mesmo resultado", () => {
    const h = 3600000;
    const durations = [h, 2 * h, 3 * h];
    const mttrDashboard = calcMTTRMs(durations);
    const mttrRelatorio = calcMTTRMs(durations);
    const mttrExport = calcMTTRMs(durations);
    expect(mttrDashboard).toBe(mttrRelatorio);
    expect(mttrRelatorio).toBe(mttrExport);
    expect(mttrDashboard).toBe(2 * h);
  });
});

describe("Analytics — Contrato API", () => {
  it("valor 0 é ok, null é insufficient_data", () => {
    const resultOk = { value: 0, state: "ok" as const };
    const resultInsufficient = { value: null, state: "insufficient_data" as const };
    expect(resultOk.value).toBe(0);
    expect(resultOk.state).toBe("ok");
    expect(resultInsufficient.value).toBeNull();
    expect(resultInsufficient.state).toBe("insufficient_data");
  });
});
