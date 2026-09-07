# SGA-M — ANALYTICS SPEC

**Versão:** BLOCO A — FASE 5 — Contrato Analítico
**Data:** 2026-09-07
**Timezone:** `America/Sao_Paulo` (apresentação) / `UTC` (armazenamento `timestamptz`)
**Tenant:** `organization_id` via `requireOrg() → ctx.orgId` (JWT), validado por RLS `eh_membro()` / `tem_papel()`. Nunca `req.query.organization_id`.
**Períodos padrão:** `Hoje` (00:00–23:59 BRT), `7d`, `30d`, `90d`, `12m`, `Personalizado` (inclusivo no início, exclusivo no fim: `[inicio, fim)`).

> **Dados fictícios proibidos.** Em ambiente vazio ou sem dados suficientes: `Sem dados suficientes` (não `0` quando `0` ≠ `NULL`).

---

## 1. Fonte de Verdade dos Status

### 1.1 `chamados.status` — estado da **demanda**

| Status | Significado | Inclui no backlog demanda? | É final? | É cancelado? |
|---|---|---|---|---|
| `aberto` | Demanda aberta, não triada | **SIM** | NÃO | NÃO |
| `em_triagem` | Em triagem | **SIM** | NÃO | NÃO |
| `aguardando_informacao` | Aguardando informação | **SIM** | NÃO | NÃO |
| `convertido_os` | Virou O.S. (tem `os_status`) | **SIM** (como O.S., ver 1.2) | NÃO | NÃO |
| `em_andamento` | Legado (usar `convertido_os` para novos) | **SIM** | NÃO | NÃO |
| `resolvido` | Demanda resolvida (trigger preenche `concluido_em`) | NÃO | **SIM** (final demanda) | NÃO |
| `concluido` | Legado, mesmo que `resolvido` | NÃO | **SIM** | NÃO |
| `cancelado` | Cancelada | NÃO | **SIM** | **SIM** |

### 1.2 `chamados.os_status` — estado da **execução** (NULL até triagem → O.S.)

| os_status | Significado | Inclui backlog O.S.? | Inclui O.S. abertas? | É final operacional? | É final administrativo? |
|---|---|---|---|---|---|
| `aberta` | O.S. criada, não planejada | **SIM** | **SIM** | NÃO | NÃO |
| `planejada` | Planejada | **SIM** | **SIM** | NÃO | NÃO |
| `atribuida` | Atribuída a técnico/equipe | **SIM** | **SIM** | NÃO | NÃO |
| `em_execucao` | Em execução (`data_inicio` preenchido) | **SIM** | **SIM** | NÃO | NÃO |
| `aguardando_peca` | Aguardando peça | **SIM** | **SIM** | NÃO | NÃO |
| `aguardando_terceiro` | Aguardando terceiro | **SIM** | **SIM** | NÃO | NÃO |
| `em_validacao` | Em validação | **SIM** | **SIM** | NÃO | NÃO |
| `concluida` | Concluída operacionalmente (`data_fim` ou `os_status_historico para=concluida`) | NÃO | NÃO | **SIM** | NÃO |
| `encerrada` | Encerrada administrativamente | NÃO | NÃO | **SIM** | **SIM** |
| `NULL` | Ainda é demanda, não O.S. | NÃO (é demanda) | NÃO | — | — |

**Regra:** `status` e `os_status` **nunca** misturados sem explicitar. `BACKLOG_DEMANDA` usa `status`, `BACKLOG_OS` usa `os_status`.

---

## 2. Backlog

### 2.1 Definições

```
BACKLOG_DEMANDA = count(chamados)
  where organization_id = ctx.orgId
    and status in ('aberto','em_triagem','aguardando_informacao','convertido_os','em_andamento')
    and created_at in [periodo)

BACKLOG_OS = count(chamados)
  where organization_id = ctx.orgId
    and os_status in ('aberta','planejada','atribuida','em_execucao','aguardando_peca','aguardando_terceiro','em_validacao')
    and created_at in [periodo)  -- ou sem filtro temporal para backlog total

BACKLOG_ATRASADO = BACKLOG_OS
  where prazo is not null
    and prazo < current_date (BRT)  -- vencido
    and os_status not in ('concluida','encerrada')
```

**Inclusões:** apenas `os_status` ativos (acima).  
**Exclusões:** `concluida`/`encerrada`/`cancelado`/`resolvido`/`concluido`. `prazo IS NULL` → excluído de ATRASADO, contado em `Sem prazo` separado.

### 2.2 Exemplo

5 O.S.: `aberta, em_execucao, aguardando_peca, concluida, encerrada` → `BACKLOG_OS = 3` (primeiras 3).

**Teste:**

```sql
-- 3 abertas, 1 concluída, 1 encerrada → backlog 3
SELECT count(*) FROM chamados WHERE os_status IN ('aberta','planejada','atribuida','em_execucao','aguardando_peca','aguardando_terceiro','em_validacao');
-- esperado: 3
```

---

## 3. SLA

### 3.1 Definição principal

**SLA = prazo (date) vs conclusão (concluido_em ou data_fim).**

```
Dentro do prazo:  concluido_em::date <= prazo
Próximo do vencimento: prazo - current_date BETWEEN 0 AND 2  (vence em 0-2 dias) AND os_status not in ('concluida','encerrada')
Atrasado:         prazo < current_date AND os_status not in ('concluida','encerrada')
Sem prazo:        prazo IS NULL
```

**Timestamps reais:** `concluido_em` (trigger em `resolvido`/`concluido`) é autoridade para `conclusão`; `data_fim` é autoridade para `fim execução` se preenchido, senão `concluido_em`. `prazo` é `date` (sem hora).

**Tratamento:**
- `prazo IS NULL` → `Sem prazo` (não entra em dentro/atrasado).
- `status='cancelado'` → excluído de SLA (não é falha nem sucesso).
- `O.S. legada` sem `prazo` → `Sem prazo`.
- Mudança de `prazo`: usa valor atual (não histórico). Se precisar histórico, usar `os_status_historico` + `auditoria_logs`.

**Fórmula taxa SLA:**

```
taxa_dentro_prazo = count(concluídas onde concluido_em::date <= prazo) / count(concluídas com prazo not null) * 100
```

**Teste:**

- O.S. prazo `2026-09-10`, concluída `2026-09-09` → Dentro
- O.S. prazo `2026-09-10`, hoje `2026-09-12`, ainda `aberta` → Atrasada

---

## 4. MTTR — Mean Time To Repair

### 4.1 Fórmula

```
MTTR = SUM(tempo_valido) / COUNT(os_validas)

tempo_valido = concluido_em - created_at
  -- se data_inicio preenchido, alternativa documentada: data_fim - data_inicio
  -- escolha padrão: created_at → concluido_em (abertura → conclusão)

onde:
  status in ('resolvido','concluido') AND concluido_em IS NOT NULL
  AND os_status IS NOT NULL  -- garante que foi O.S., não só demanda
  AND created_at in [periodo)
  AND status != 'cancelado'
```

**Início padrão:** `created_at` (abertura). **Fim padrão:** `concluido_em`.  
**Alternativa (se `data_inicio`/`data_fim` preenchidos):** `data_fim - data_inicio` (execução pura). Documentar qual usar; **padrão é `created_at → concluido_em`**.

**Exclusões:** `cancelado`, `concluido_em IS NULL`, `created_at IS NULL`, `tempo < 0` (inconsistente).

**Dados insuficientes:** se `COUNT(os_validas) = 0` → `Sem dados suficientes` (não `0`).

### 4.2 Exemplo

3 O.S.: 1h, 2h, 3h → `MTTR = (1+2+3)/3 = 2h`.

```sql
SELECT avg(extract(epoch from (concluido_em - created_at))/3600) as mttr_horas
FROM chamados
WHERE organization_id = $1
  AND status IN ('resolvido','concluido')
  AND concluido_em IS NOT NULL
  AND created_at BETWEEN $2 AND $3;
```

**Teste determinístico:**

- Criar 3 O.S. com `created_at` = `now() - 3h, -2h, -1h` e `concluido_em = now()` → MTTR = 2h.

---

## 5. MTBF — Mean Time Between Failures

### 5.1 Definição

**Falha = nova O.S. do tipo `corretiva` para um ativo que já teve O.S. `concluida`/`encerrada` anterior.**

```
MTBF = tempo_total_observado / (n_falhas - 1)   -- ou / n_falhas se janela fixa

tempo_total_observado = max(concluido_em) - min(created_at) no período, por ativo
n_falhas = count(O.S. where os_tipo='corretiva' and status in ('resolvido','concluido'))
janela = [periodo) (ex: 90d)
```

**Requisitos:** ≥3 O.S. `corretiva` válidas no período por ativo. Se <2 falhas → `Dados insuficientes`.

**Se dataset não tem `os_tipo` preenchido ou `ativo_id` nulo → `Dados insuficientes`.**

**Exemplo:** Ativo com falhas em `D+0, D+10, D+30` → intervalos `10d, 20d` → `MTBF = 15d` (média dos intervalos). Simplificação `tempo_total / n_falhas = 30d/3 = 10d` também aceita se documentada; **escolher média de intervalos**.

**Teste:** 3 falhas com intervalos 10d, 20d → `MTBF esperado 15d`.

---

## 6. Disponibilidade do Ativo

```
disponibilidade = tempo_disponível / tempo_total_observável

tempo_disponível = tempo_total - tempo_indisponível
tempo_indisponível = SUM(períodos onde ativo.status in ('parado','em_manutencao') OR existe O.S. em_execucao para o ativo)
```

**Status atual insuficiente** (só `ativos.status` é estado pontual, não histórico). **Requer** `ativo_status_historico` com cobertura contínua **ou** `os_status_historico` + `data_inicio/data_fim` confiáveis.

**Decisão:** **Não implementar** disponibilidade como KPI no BLOCO B se `ativo_status_historico` não tiver histórico completo. Mostrar `Dados insuficientes` e documentar requisito: precisa histórico de status com `created_at` cobrindo todo o período.

---

## 7. Reincidência

```
reincidência = nova O.S. para mesmo ativo_id
               onde categoria = mesma (ou causa_raiz igual)
               e created_at - max(concluido_em anterior) < janela (ex: 90d)
```

**Janela padrão:** 90 dias. **Categoria:** `chamados.categoria` (triagem). Se `categoria IS NULL` → usar `ativo_id` apenas (heurística mais fraca, documentar).

**Exemplo:** Ativo `Bomba 14`, O.S. `corretiva` categoria `hidráulica` em `D0` concluída, nova `corretiva` mesma categoria em `D30` → **reincidência** (30d < 90d). Segunda O.S. categoria `elétrica` → **não** reincidência.

**Exclusões:** `preventiva`/`inspecao` não contam como falha para reincidência (são programadas).

---

## 8. Custos

### 8.1 Fontes

| Custo | Fonte | Fórmula |
|---|---|---|
| **Aquisição** | `compras` | `compras.valor_total = quantidade * valor_unitario` (generated) — **não** é custo de manutenção |
| **Mão de obra** | `chamados.custo_mao_obra` | `SUM(custo_mao_obra)` |
| **Outros** | `chamados.custo_outros` | `SUM(custo_outros)` |
| **Serviços** | `os_servicos_externos.valor` | `SUM(valor) where chamado_id` |
| **Materiais consumidos** | `movimentacoes_estoque` | `SUM(quantidade * custo_unitario) where tipo='consumo' and chamado_id = O.S.` |

### 8.2 Custo da O.S.

```
custo_os = custo_mao_obra + custo_outros + SUM(os_servicos_externos.valor) + SUM(movimentacoes where tipo='consumo')
```

**Exclusões:** `compras` **nunca** somado como custo de O.S. (é estoque). `reserva` não é custo. `entrada` não é custo.

### 8.3 Custo por ativo

```
custo_ativo = SUM(custo_os where ativo_id = ativo)
```

**Relação:** `ativo → chamados/os → consumos/serviços/mão de obra`.

### 8.4 Custo por localização

```
custo_localidade = SUM(custo_os where ativos.localidade_id = localidade)
```

Via `chamados.ativo_id → ativos.localidade_id`. Texto livre `localizacao` **nunca** usado para agrupar.

**Exemplo:** 3 itens R$100+R$200+R$50 = R$350.

---

## 9. Estoque

### 9.1 Regra homologada

```
disponível = físico - reservado
físico = produtos.estoque_atual
reservado = produtos.estoque_reservado
```

### 9.2 Métricas

| Métrica | Fórmula | Fonte |
|---|---|---|
| **Disponível** | `estoque_atual - estoque_reservado` | `produtos` |
| **Crítico** | `disponível <= estoque_minimo` | `produtos` |
| **Abaixo reposição** | `disponível <= ponto_reposicao` | `produtos` |
| **Valor estoque** | `SUM(estoque_atual * custo_medio)` (regra `estoque/page.tsx:62`) | `produtos` — usa `custo_medio`, fallback `ultimo_custo` se nulo |
| **Giro/consumo período** | `SUM(quantidade) where tipo='consumo' and created_at in [periodo)` | `movimentacoes_estoque` |
| **Sem movimentação** | `produtos where NOT EXISTS (movimentacoes where produto_id and created_at in [periodo))` | — |
| **Valor por produto** | `estoque_atual * custo_medio` | — |

**Teste:** 10 físicos, 3 reservados → `disponível = 7`.

---

## 10. Compras / Suprimentos

| Métrica | Fonte | Fórmula |
|---|---|---|
| **Solicitações pendentes** | `solicitacoes_compra` | `count where status in ('rascunho','enviada','em_analise','em_cotacao')` |
| **Aprovações pendentes** | `solicitacoes_compra` | `count where status='em_analise'` |
| **Pedidos** | `pedidos_compra` | `count where status in ('aberto','aprovado')` |
| **Recebimentos divergentes** | `recebimentos` | `count where status='divergente'` |
| **Valor por fornecedor** | `cotacoes`/`pedidos_compra` | `SUM(valor) GROUP BY fornecedor_id` |
| **Prazo médio fornecedor** | `produto_fornecedores.prazo_medio_dias`, `cotacoes.prazo_dias` | `AVG(prazo_medio_dias)` |

---

## 11. Fornecedores

| Métrica | Fórmula |
|---|---|
| **Total comprado** | `SUM(pedidos_compra.valor total)` (frete+impostos considerados) |
| **Qtd pedidos** | `COUNT(pedidos_compra)` |
| **Prazo médio** | `AVG(produto_fornecedores.prazo_medio_dias)` ou `AVG(cotacoes.prazo_dias where vencedora=true)` |
| **Divergências** | `COUNT(recebimentos where status='divergente' and pedido.fornecedor_id)` |
| **Atrasos** | `COUNT(pedidos where prazo < current_date and status != 'encerrado')` |

Sem "nota" arbitrária. Se houver score, fórmula: `score = (1 - divergencias/pedidos)*0.5 + (1 - atrasos/pedidos)*0.5` (documentar).

---

## 12. Preventiva

| Métrica | Fórmula |
|---|---|
| **Em dia** | `proxima_execucao > current_date + tolerancia_dias` |
| **Próxima** | `proxima_execucao BETWEEN current_date AND current_date+7` |
| **Atrasada** | `proxima_execucao < current_date - tolerancia_dias` and `ativo=true` |

Fonte: `planos_manutencao` + `ativos`.

---

## 13. Mapa Operacional

Para cada nível (`localidades.tipo`): `unidade` → `predio` → `bloco` → `andar` → `area` → `sala`:

```
ativos = COUNT(ativos where localidade_id in subtree)
os_abertas = COUNT(chamados where ativo.localidade_id in subtree and os_status in (ativas))
criticos = COUNT(ativos where criticidade='critica' and localidade_id in subtree)
parados = COUNT(ativos where status='parado' and localidade_id in subtree)
custo = SUM(custo_os where ativo.localidade_id in subtree)
```

**Subtree:** `WITH RECURSIVE sub AS (SELECT id FROM localidades WHERE id=$1 UNION ALL SELECT l.id FROM localidades l JOIN sub ON l.parent_id=sub.id)`.

---

## 14. Estoque Físico vs Valor — Dupla Contagem

| Par | Regra |
|---|---|
| `compras` vs `movimentacoes consumo` | **Separar** aquisição vs manutenção |
| `reserva` vs `consumo` | `reserva` não é custo, `disponível = físico - reservado` |
| `recebimento` vs `entrada` | Distinguir logística vs estoque |
| `chamado` vs `O.S.` | `status` (demanda) vs `os_status` (execução) |

---

## 15. Períodos e Timezone

| Período | Definição BRT (America/Sao_Paulo) | UTC (banco) | Exemplo |
|---|---|---|---|
| Hoje | `[00:00 hoje, 00:00 amanhã)` | `[03:00 UTC hoje, 03:00 UTC amanhã)` (horário padrão -03) | `gte 2026-09-07T03:00:00Z lt 2026-09-08T03:00:00Z` |
| 7d | `[00:00 hoje-6, 00:00 amanhã)` | idem | 7 dias incluindo hoje |
| 30d, 90d, 12m | idem | idem | |
| Personalizado | `[inicio 00:00, fim 00:00 +1)` | convertido | |

**Query padrão:**

```sql
WHERE created_at >= $inicio_utc AND created_at < $fim_utc
  AND organization_id = $orgId
```

---

## 16. KPIs — Especificação Completa

### KPI-01 — Total Ativos

- **Descrição:** Quantidade de ativos cadastrados na organização.
- **Fonte:** `ativos`
- **Campo:** `id`
- **Fórmula:** `COUNT(id) WHERE organization_id = ctx.orgId`
- **Filtro tenant:** `eq organization_id`
- **Temporal:** sem filtro (estoque atual) ou `created_at <= fim` para evolução.
- **Inclusões:** todos, inclusive `inativo`/`desativado` (separar em KPIs por status quando detalhar).
- **Exclusões:** nenhuma (soft delete não existe; `ativo=false` ainda conta em total, mas separado em "Inativos").
- **Unidade:** unidade.
- **Dados ausentes:** 0 é válido (tenant novo). Mostrar `0`.
- **Exemplo:** 3 ativos → `3`.
- **Teste:** inserir 3 ativos, `SELECT count(*) → 3`.

### KPI-02 — Ativos por Status

- **Fonte:** `ativos.status`
- **Fórmula:** `SELECT status, count(*) GROUP BY status WHERE orgId`
- **Valores:** `operacional, em_manutencao, parado, em_instalacao, em_inspecao, inativo, desativado`.
- **Teste:** 2 operacional, 1 parado → `{"operacional":2,"parado":1}`.

### KPI-03 — Ativos Críticos

- **Fonte:** `ativos.criticidade` + `ativos.status`
- **Fórmula:** `count where criticidade in ('alta','critica') OR status='parado'`
- **Teste:** 1 crítico, 1 alta, 1 baixa → `2`.

### KPI-04 — O.S. Abertas

- **Fonte:** `chamados.os_status`
- **Fórmula:** `count where os_status in ('aberta','planejada','atribuida','em_execucao','aguardando_peca','aguardando_terceiro','em_validacao') and organization_id = orgId and created_at in [periodo)`
- **Exclusões:** `concluida`/`encerrada`/`NULL`/ `cancelado`.
- **Teste:** 3 abertas, 1 concluída, 1 encerrada → `3`.

### KPI-05 — Backlog Total

- **Fórmula:** `BACKLOG_DEMANDA + BACKLOG_OS`? **Não somar** — manter separados. `Backlog = BACKLOG_OS` (padrão para O.S.). Documentar.

### KPI-06 — SLA

- **Fonte:** `chamados.prazo`, `chamados.concluido_em`, `chamados.os_status`
- **Fórmula:** `dentro = concluido_em::date <= prazo`, `atrasado = prazo < current_date and os_status not in (concluida,encerrada)`, `próximo = prazo - current_date between 0 and 2`.
- **Taxa:** `dentro / (dentro+atrasado+próximo com prazo)` .
- **Exclusões:** `prazo IS NULL`, `cancelado`.
- **Teste:** 2 dentro, 1 atrasada → `66.7%`.

### KPI-07 — MTTR

- **Fonte:** `chamados.created_at`, `chamados.concluido_em`
- **Fórmula:** `AVG(concluido_em - created_at) where status in (resolvido,concluido) and concluido_em not null`.
- **Teste:** 1h,2h,3h → `2h`.

### KPI-08 — MTBF

- **Fonte:** `chamados` where `os_tipo='corretiva'`, `ativo_id`, `created_at`, `concluido_em`
- **Fórmula:** `AVG(intervalo entre falhas)` ou `tempo_total / n_falhas`.
- **Requisito:** ≥3 falhas por ativo. Se <3 → `Dados insuficientes`.

### KPI-09 — Custo Total Manutenção (período)

- **Fonte:** `chamados.custo_mao_obra + custo_outros + os_servicos_externos.valor + movimentacoes consumo*unitario`
- **Fórmula:** `SUM(custo_os) where organization_id and created_at in [periodo) and status != 'cancelado'`.
- **Teste:** 100+200+50 = 350.

### KPI-10 — Estoque Disponível / Crítico / Valor

- **Disponível:** `SUM(estoque_atual - estoque_reservado)`
- **Crítico:** `count where disponível <= estoque_minimo`
- **Valor:** `SUM(estoque_atual * custo_medio)`
- **Teste:** 10 físicos, 3 reservados → disponível 7.

### KPI-11 — Solicitações Pendentes

- **Fonte:** `solicitacoes_compra.status`
- **Fórmula:** `count where status in ('rascunho','enviada','em_analise','em_cotacao')`.
- **Teste:** 2 rascunho, 1 enviada → 3.

### KPI-12 — Reincidência

- **Fonte:** `chamados.ativo_id`, `categoria`, `created_at`
- **Fórmula:** `count where exists anterior com mesmo ativo_id and categoria and created_at - anterior.concluido_em < 90d`.
- **Janela:** 90d. **Exclusões:** `os_tipo != 'corretiva'` não conta como reincidência.

### KPI-13 — Top Ativos por O.S.

- **Fonte:** `chamados.ativo_id`
- **Fórmula:** `SELECT ativo_id, count(*) as qtd GROUP BY ativo_id ORDER BY qtd DESC LIMIT 5`.
- **Teste:** ativo A 5 O.S., B 3, C 1 → top A.

### KPI-14 — Consumo por Produto

- **Fonte:** `movimentacoes_estoque` where `tipo='consumo'`
- **Fórmula:** `SELECT produto_id, SUM(quantidade) GROUP BY produto_id`.

---

## 17. Queries Analíticas (camada compartilhada)

**Todas com `eq organization_id` e `gte/lt` por período em UTC. Usar `date_trunc` no banco.**

```sql
-- MTTR
SELECT avg(extract(epoch from (concluido_em - created_at))/3600) as mttr_h
FROM chamados
WHERE organization_id = $1
  AND status IN ('resolvido','concluido')
  AND concluido_em IS NOT NULL
  AND created_at >= $2 AND created_at < $3;

-- Backlog OS
SELECT count(*) FROM chamados
WHERE organization_id = $1
  AND os_status IN ('aberta','planejada','atribuida','em_execucao','aguardando_peca','aguardando_terceiro','em_validacao');

-- Custo OS
SELECT sum(custo_mao_obra + custo_outros) + COALESCE((SELECT sum(valor) FROM os_servicos_externos WHERE chamado_id IN (SELECT id FROM chamados WHERE organization_id=$1)),0)
FROM chamados WHERE organization_id=$1;

-- Estoque crítico
SELECT count(*) FROM produtos
WHERE organization_id=$1
  AND (estoque_atual - estoque_reservado) <= estoque_minimo;

-- Top ativos
SELECT ativo_id, count(*) as qtd FROM chamados
WHERE organization_id=$1 GROUP BY ativo_id ORDER BY qtd DESC LIMIT 5;
```

**Views/RPCs:** Não criar novas views no BLOCO A. Usar query builder (`supabase.from(...).select(..., {count:'exact'}).eq(...).gte(...).group(...)`) ou SQL agregado via `rpc` quando `GROUP BY` necessário. Documentar por que cada view existiria no BLOCO B (ex: `v_analytics_mttr` se cálculo for repetido em dashboard e relatório).

---

## 18. Performance

- **1.000 chamados / 1.000 O.S. / 1.000 ativos / 5.000 movimentações:** usar `count(*) exact` com índice `chamados_org_idx` e `mov_org_data_idx`, `GROUP BY` no banco, não `SELECT *` + JS count.
- **Índices existentes suficientes** (ver DATA_MAP §6). Não criar novos sem `EXPLAIN ANALYZE`.
- **Paginação:** relatórios com `range(0,49)` + `count`.

---

## 19. Métricas sem Dados — Tratamento

| Situação | Exibir |
|---|---|
| `COUNT = 0` (nenhuma O.S.) | `0` (válido) |
| `AVG` com `COUNT = 0` (MTTR sem concluídas) | `Sem dados suficientes` |
| `MTBF` com <3 falhas | `Sem dados suficientes` |
| `Disponibilidade` sem histórico | `Sem dados suficientes` |
| `prazo IS NULL` para SLA | `Sem prazo` (categoria separada) |

---

## 20. Consistência

- **Mesma fórmula** em dashboard, relatório, exportação, mapa. Extrair para `src/lib/analytics.ts` (BLOCO B).
- **Período idêntico** (`Hoje` = `[00:00,00:00+1)` BRT) em todos os módulos.
- **Tenant idêntico** (`ctx.orgId`).
- **Teste matemático idêntico** para cada KPI.

---

## 21. Auditoria

Registrar `REPORT_EXPORTED` (com `filtros`, `periodo`, `tenant`) e `DASHBOARD_FILTERED` quando filtro muda e há valor operacional. Não logar cada hover.

---

## 22. Implementação BLOCO A — Entregáveis

- `ANALYTICS_SPEC.md` (este arquivo)
- `ANALYTICS_DATA_MAP.md`
- `src/lib/analytics.ts` — funções puras (ex: `calcDisponivel`, `calcMTTR`, `isCritic`, `classificarSLA`) + testes unitários (BLOCO F, mas tipos já)
- Nenhuma tela nova

---

## 23. Decisões Analíticas

| Decisão | Justificativa |
|---|---|
| `MTTR = created_at → concluido_em` | `concluido_em` é trigger confiável em `resolvido`/`concluido`; `data_inicio`/`data_fim` nem sempre preenchidos |
| `MTBF` exige ≥3 falhas | Evita média com denominador 1 |
| `Disponibilidade` não implementada no BLOCO B | Sem histórico contínuo de status |
| `Custo` separa aquisição vs manutenção | Evita dupla contagem `compras`+`consumo` |
| `Estoque` usa `custo_medio` | Regra já homologada em `estoque/page.tsx:62` |
| `Backlog` separado demanda vs O.S. | `status` vs `os_status` não misturados |
| `SLA` com 3 faixas (dentro/próximo/atrasado) + Sem prazo | Cobre todos os casos, prazo nulo não é falha |
| `Reincidência` = mesmo ativo + mesma categoria + 90d | Heurística documentada, não automática |

---

## 24. Testes

Cada KPI com pelo menos 1 teste determinístico (BLOCO F). Exemplos na seção 4–14. Fronteira: 0 registros, 1 registro, cancelados, sem data, sem custo, sem ativo, legados, tenant vazio.
