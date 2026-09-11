# SGA-M 2.0 — PERFORMANCE SPEC (FASE 9.0)

**Fonte:** `src/lib/analytics` 15 KPIs (13 implementáveis, 2 condicionais `MTBF`/`Disponibilidade`)

## 1. Modelo score 0–100

**Período:** `7d|30d|90d|12m` (BRT, `getPeriodoRangeBRT`), default `30d`. Histórico permanente, avaliação finalizada não sobrescreve — nova linha `avaliacoes` com `versao`.

**Fórmula geral:**
```
score = sum(peso_i * normalizado(metrica_i)) + avaliacao_gerencial*0.2
onde normalizado = 0-100, pesos por perfil, avaliacao_gerencial 0-100 opcional
se eventos < mínimo → insufficient_data (não 0)
```

## 2. Métricas por perfil

### TECNICO — `Minha Operação` (mobile first)
| Métrica | Fonte | Peso | Mínimo |
|---|---|---|---|
| O.S. concluídas | `chamados.os_status=concluida/encerrada` com `data_fim` no período | 25 | 3 |
| Tempo execução | `AVG(data_fim-data_inicio)` (KPI-07b) | 15 | 3 |
| SLA (dentro) | `classificarSLA` prazo vs concluido (KPI-06) | 20 | 3 com prazo |
| Reincidência | `isReincidencia` 90d (KPI-12) inverso | 15 | — |
| Checklist | `checklist_respostas` completude | 10 | — |
| Avaliação gerencial | `avaliacoes.nota` 0-100 | 15 | — |

### GESTOR — `Minha Gestão`
| Métrica | Fonte | Peso |
|---|---|---|
| Desempenho equipe | AVG score técnicos subordinados | 30 |
| Backlog | `queryBacklogOS` tendência | 15 |
| SLA equipe | `querySLA` dentro% | 20 |
| Preventivas | `planos_manutencao` no prazo | 15 |
| Avaliação gerencial | — | 20 |

### COMPRAS — `Suprimentos`
| Métrica | Fonte |
|---|---|
| Solicitação→cotação tempo | `solicitacoes_compra.created_at → cotacoes.created_at` |
| Cotação→pedido | `cotacoes → pedidos_compra` |
| Pedido→recebimento | `pedidos_compra → recebimentos` |
| Divergência | `recebimentos.status=divergente` taxa |
| Fornecedores | `fornecedores.avaliacao` |

### AUDITOR — `Conformidade`
| Métrica | Fonte |
|---|---|
| Logs revisados | `auditoria_logs` count |
| Pendências | `solicitacoes_compra` `em_analise` |
| Acessos | `auditoria_logs` `acesso` |

### SOLICITANTE — `Minhas Solicitações`
| Métrica | Fonte |
|---|---|
| Solicitações criadas | `solicitacoes_compra` `created_by` |
| Tempo resposta | `created_at → aprovado_em` |
| Cancelamentos | `status=cancelada` |

## 3. Regra insufficient_data

Se `count < mínimo` (ex: TECNICO <3 O.S. no período) → `{value:null, state:'insufficient_data'}` (igual `MTBF`/`Disponibilidade` hoje), exibir "Dados insuficientes — mínimo 3 O.S." Não produzir 0.

## 4. Transparência

Cada score mostra breakdown: `82 = 25*concluídas(90) +15*execução(80) +... +15*avaliação(85)` com link para `src/lib/analytics/calculations.ts`.

## 5. Tabelas novas (FASE 9.4)

```sql
create table avaliacoes (
  id uuid primary key, organization_id uuid, avaliado_id uuid, avaliador_id uuid, periodo tstzrange, score int 0-100, nota_gerencial int, comentario text, versao int, created_at timestamptz
);
create table metricas_cache (
  organization_id uuid, user_id uuid, periodo text, metrica text, valor numeric, state text, updated_at timestamptz
);
```

## 6. Auditoria

`registrarLog` para `mudança de role`, `manager_id`, `avaliacao`, `perfil` — `auditoria_logs` com `organization_id`, `user_id`.

## 7. Reuso

- Não criar `technician_metrics.ts` — estender `src/lib/analytics/calculations.ts` e `queries.ts`.
- Reusar `notificacoes` para `avaliação pendente`, `mensagem recebida`.
- Reusar `storage` `manutencao-midia` para avatar.
