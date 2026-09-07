# SGA-M — ANALYTICS SPEC

**Versão:** BLOCO A — FASE 5 — Contrato Analítico (complemento 2026-09-07)
**Data:** 2026-09-07
**Timezone:** `America/Sao_Paulo` (IANA) — Banco em `UTC` (`timestamptz`), apresentação em `America/Sao_Paulo` via `Intl.DateTimeFormat` / `toLocaleString`. Conversões de período usam `America/Sao_Paulo`, não offset hardcoded.
**Tenant:** `organization_id` via `requireOrg() → ctx.orgId` (JWT), validado por RLS `eh_membro()` / `tem_papel()`. Nunca `req.query.organization_id`.
**Períodos padrão:** `Hoje` (00:00–23:59 America/Sao_Paulo), `7d`, `30d`, `90d`, `12m`, `Personalizado` (inclusivo no início, exclusivo no fim: `[inicio, fim)`).

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

**Regra:** `status` e `os_status` **nunca** misturados sem explicitar. `BACKLOG_DEMANDA` usa `status`, `BACKLOG_OS` usa `os_status`. `O.S. aberta` ≠ `chamado aberto` — O.S. requer `os_status IS NOT NULL`.

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
    and prazo < current_date (America/Sao_Paulo)  -- vencido
    and os_status not in ('concluida','encerrada')

BACKLOG_EM_EXECUCAO = BACKLOG_OS where os_status='em_execucao'
BACKLOG_AGUARDANDO_PECA = where os_status='aguardando_peca'
BACKLOG_AGUARDANDO_TERCEIRO = where os_status='aguardando_terceiro'
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

- **Dentro do prazo:** `concluido_em::date <= prazo` (quando concluída)
- **Próximo do vencimento:** `prazo - current_date = 0..2` **E** `os_status not in ('concluida','encerrada')` — vence em 0,1,2 dias. **Limiar determinístico: 2 dias.** Alternativa proporcional (se SLA for duração): `tempo_restante <= 20% do SLA total`. **Escolha documentada: limiar fixo 2 dias** (simples, determinístico). Se houver SLA por prioridade com durações diferentes, usar proporcional e documentar.
- **Atrasado:** `current_date (America/Sao_Paulo) > prazo` **E** `os_status not in ('concluida','encerrada')`
- **Sem prazo:** `prazo IS NULL`

**Timestamps reais:** `concluido_em` (trigger em `resolvido`/`concluido`) é autoridade para `conclusão`; `data_fim` é autoridade para `fim execução` se preenchido, senão `concluido_em`. `prazo` é `date` (sem hora).

**Tratamento:**
- `prazo IS NULL` → `Sem prazo` (não entra em dentro/atrasado/próximo).
- `status='cancelado'` → excluído de SLA.
- `O.S. legada` sem `prazo` → `Sem prazo`.
- Mudança de `prazo`: usa valor atual (não histórico). Se precisar histórico, usar `os_status_historico` + `auditoria_logs`.

**Fórmula taxa SLA:**

```
taxa_dentro_prazo = count(concluídas onde concluido_em::date <= prazo) / count(concluídas com prazo not null) * 100
```

**Teste:**

- O.S. prazo `2026-09-10`, concluída `2026-09-09` → Dentro
- O.S. prazo `2026-09-10`, hoje `2026-09-12`, ainda `aberta` → Atrasada
- O.S. prazo `2026-09-12`, hoje `2026-09-10` → Próximo (2 dias)
- O.S. prazo `2026-09-15`, hoje `2026-09-10` → Dentro (5 dias >2)

---

## 4. Tempo de Resolução vs MTTR vs Tempo de Execução

### 4.1 Três conceitos distintos

| Nome exibido | Nome técnico | Fórmula | Semântica |
|---|---|---|---|
| **Tempo de Resolução** | `TTR` | `concluido_em - created_at` | Tempo total desde abertura da demanda até conclusão. É o que o SGA-M mede hoje como "MTTR" se `data_inicio` não preenchido. |
| **Tempo de Execução** | `TEXEC` | `data_fim - data_inicio` **ou** `min(os_status_historico para='concluida') - min(para='em_execucao')` | Tempo puro de execução, quando `data_inicio`/`data_fim` ou histórico de `os_status` existem. |
| **MTTR (exibido)** | `MTTR` | `AVG(TTR)` **ou** `AVG(TEXEC)` — **documentar qual está em uso** | Neste produto, **MTTR = AVG(TTR) = AVG(concluido_em - created_at)**. É o tempo médio de resolução. Se futuramente `TEXEC` tiver cobertura >80%, avaliar expor ambos. |

**Documentar no dashboard:** `MTTR (tempo médio de resolução: abertura → conclusão)`. Não chamar de "tempo de reparo" se incluir triagem.

### 4.2 Fórmula MTTR (TTR)

```
MTTR = SUM(tempo_valido) / COUNT(os_validas)
tempo_valido = concluido_em - created_at
onde:
  status in ('resolvido','concluido') AND concluido_em IS NOT NULL
  AND os_status IS NOT NULL
  AND created_at in [periodo)
  AND status != 'cancelado'
```

**Tempo de Execução (quando houver dados):**

```
TEXEC = data_fim - data_inicio
onde data_inicio IS NOT NULL AND data_fim IS NOT NULL
```

Se `TEXEC` for usado, excluir registros onde `data_inicio`/`data_fim` nulos (não transformar em `TTR` silenciosamente).

**Exclusões:** `cancelado`, `concluido_em IS NULL`, `tempo < 0`.

**Dados insuficientes:** se `COUNT = 0` → `Sem dados suficientes` (não `0`).

### 4.3 Exemplo

3 O.S.: 1h, 2h, 3h (TTR) → `MTTR = 2h`.

```sql
SELECT avg(extract(epoch from (concluido_em - created_at))/3600) as mttr_h
FROM chamados
WHERE organization_id = $1
  AND status IN ('resolvido','concluido')
  AND concluido_em IS NOT NULL
  AND os_status IS NOT NULL
  AND created_at >= $2 AND created_at < $3;
```

**Teste:** 3 O.S. com `created_at` = `now() - 3h, -2h, -1h` e `concluido_em = now()` → MTTR = 2h.

---

## 5. MTBF — Mean Time Between Failures

### 5.1 O que conta como falha?

**Falha = O.S. `corretiva` vinculada a `ativo_id` NOT NULL, onde `status in ('resolvido','concluido')` e `os_status in ('concluida','encerrada')`.**

**Não contam:** `preventiva`, `preditiva`, `inspecao`, `instalacao`, `melhoria`, `cancelado`, `ativo_id IS NULL`, `os_tipo IS NULL`.

**Timestamp da falha:** `created_at` (abertura/registro da ocorrência), **não** `concluido_em`. MTBF mede intervalo entre ocorrências, não entre conclusões.

### 5.2 Cálculo

```
Para um ativo, ordenar falhas por created_at ASC: f1, f2, f3, ..., fn
intervalos = [f2.created_at - f1.created_at, f3.created_at - f2.created_at, ...]  // n-1 intervalos
MTBF = média(intervalos)

Ex: 3 falhas → 2 intervalos → MTBF = (intervalo1 + intervalo2)/2
Ex: falhas D+0, D+10, D+30 → intervalos 10d, 20d → MTBF = 15d
```

**Requisitos:** ≥3 falhas válidas por ativo no período. Se `n_falhas < 3` → `Dados insuficientes`. Se `os_tipo` nulo ou `ativo_id` nulo → `Dados insuficientes`.

**Janela:** `[periodo)` (ex: 90d). `tempo_total_observado` não entra na fórmula (evita `tempo_total/n_falhas` simplificado).

**Teste:** 3 falhas D+0, D+10, D+30 → intervalos 10d, 20d → `MTBF esperado 15d`.

---

## 6. Disponibilidade do Ativo

```
disponibilidade = tempo_disponível / tempo_total_observável
tempo_indisponível = SUM(períodos onde ativo_status_historico.para in ('parado','em_manutencao') OR existe O.S. tipo corretiva em_execucao)
```

**Reconstrução dos intervalos:**

- Fonte: `ativo_status_historico` (append-only, `de`, `para`, `created_at`) — **ou** `os_status_historico` + `data_inicio/data_fim` se histórico de ativo incompleto.
- Para cada ativo, ordenar `ativo_status_historico` por `created_at` ASC.
- Intervalo `i` = `[created_at[i], created_at[i+1])` com `status = para[i]`.
- Limites do período: `inicio_periodo` (ex: `2026-09-01 00:00 America/Sao_Paulo`) e `fim_periodo` (`2026-09-30 00:00`).
- Se não houver estado conhecido no `inicio_periodo` (nenhum registro antes), **não assumir `Operacional`** → intervalo inicial = `Desconhecido` → `Dados insuficientes` para disponibilidade daquele ativo no período. Documentar requisito.

**Decisão:** **Não implementar** disponibilidade como KPI no BLOCO B se cobertura <80% dos ativos com histórico contínuo. Mostrar `Dados insuficientes` e documentar requisito.

---

## 7. Reincidência

```
reincidência = nova O.S. para mesmo ativo_id
               onde categoria_ocorrencia = mesma
               e created_at - max(concluido_em anterior com mesma categoria) < janela (90d)
```

**Categoria da ocorrência:** `chamados.categoria` (triagem) **ou** `causa`/`causa_raiz` quando preenchidos. **Não** usar `ativos.categoria_id` (categoria do ativo) como proxy de problema.

**Limitação atual:** Se `chamados.categoria`/`causa`/`causa_raiz` têm baixa cobertura (<50% preenchidos), marcar KPI como **heurística com limitação** e não como verdade absoluta. Documentar no SPEC: "Reincidência usa `chamados.categoria` quando disponível; se nula, considera só `ativo_id` com janela 90d e marca `* heurística`".

**Janela padrão:** 90 dias.

**Exemplo:** Bomba 14, O.S. `corretiva` categoria `hidráulica` D0 concluída, nova `corretiva` mesma categoria D30 → **reincidência**. Segunda categoria `elétrica` → **não**.

**Exclusões:** `preventiva`/`inspecao` não contam.

---

## 8. Custos

### 8.1 Fontes

| Custo | Fonte | Fórmula |
|---|---|---|
| **Aquisição** | `compras` | `compras.valor_total = quantidade * valor_unitario` — **não** é custo de manutenção |
| **Mão de obra** | `chamados.custo_mao_obra` | `SUM(custo_mao_obra)` |
| **Outros** | `chamados.custo_outros` | `SUM(custo_outros)` |
| **Serviços** | `os_servicos_externos.valor` | `SUM(valor) where chamado_id` |
| **Materiais consumidos** | `movimentacoes_estoque` | `SUM(quantidade * custo_unitario) where tipo='consumo' and chamado_id = O.S.` |

### 8.2 Custo da O.S. (congelado)

```
custo_os = custo_mao_obra + custo_outros + SUM(os_servicos_externos.valor) + SUM(movimentacoes where tipo='consumo' and chamado_id = O.S.)
```

**Congelado em BLOCO A.** Não incluir `compras` (aquisição) nem `reserva`.

**Teste de regressão:**

```
Compra = R$1.000 (aquisição, estoque)
Consumo = R$100 (saída para O.S. 123)
Custo da O.S. 123 = R$100 (não R$1.100)
```

Se `compra` 1000 e `consumo` 100 para mesma O.S., `custo_os = 100`.

### 8.3 Custo por ativo

```
custo_ativo = SUM(custo_os where ativo_id = ativo)
```

### 8.4 Custo por localização

```
custo_localidade = SUM(custo_os where ativos.localidade_id = localidade)
```

Via `chamados.ativo_id → ativos.localidade_id`. Texto livre `localizacao` **nunca** usado.

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
| **Físico** | `estoque_atual` | `produtos` |
| **Reservado** | `estoque_reservado` | `produtos` |
| **Crítico** | `disponível <= estoque_minimo` | `produtos` |
| **Abaixo reposição** | `disponível <= ponto_reposicao` | `produtos` — **não** confundir com `estoque_minimo` |
| **Valor estoque (físico)** | `SUM(estoque_atual * custo_medio)` (regra homologada) | `produtos` — usa `custo_medio`, fallback `ultimo_custo` se nulo. **Não** usar `disponível` para valuation. |
| **Valor disponível** | `SUM(disponível * custo_medio)` | Apenas se explicitamente solicitado como "valor disponível" |
| **Giro/consumo período** | `SUM(quantidade) where tipo='consumo' and created_at in [periodo)` | `movimentacoes_estoque` |
| **Sem movimentação** | `produtos where NOT EXISTS (movimentacoes where produto_id and created_at in [periodo))` | — |
| **Valor por produto** | `estoque_atual * custo_medio` | — |

**Estoque crítico — definição formal:**

```
crítico = disponível <= estoque_minimo  (quando estoque_minimo > 0)
se ponto_reposicao > estoque_minimo: crítico usa estoque_minimo, "abaixo reposição" usa ponto_reposicao (são métricas distintas)
se ponto_reposicao IS NULL ou 0: fallback documentado → considerar crítico = disponível <= estoque_minimo, e "abaixo reposição" = disponível <= estoque_minimo (mesma regra, mas documentar fallback)
```

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
| **Total comprado** | `SUM(pedidos_compra.valor total)` |
| **Qtd pedidos** | `COUNT(pedidos_compra)` |
| **Prazo médio** | `AVG(produto_fornecedores.prazo_medio_dias)` ou `AVG(cotacoes.prazo_dias where vencedora=true)` |
| **Divergências** | `COUNT(recebimentos where status='divergente' and pedido.fornecedor_id)` |
| **Atrasos** | `COUNT(pedidos where prazo < current_date and status != 'encerrado')` |

Sem "nota" arbitrária. Se houver score: `score = (1 - divergencias/pedidos)*0.5 + (1 - atrasos/pedidos)*0.5` (documentar).

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

**Métricas por nível:** Organização (todos), Unidade (ex: 47 ativos, 8 O.S., 3 críticos, R$ 4.820), Bloco, Andar, etc. Cada valor com origem analítica definida (não inventado).

---

## 14. Estoque Físico vs Valor — Dupla Contagem

| Par | Regra |
|---|---|
| `compras` vs `movimentacoes consumo` | **Separar** aquisição vs manutenção |
| `reserva` vs `consumo` | `reserva` não é custo, `disponível = físico - reservado` |
| `recebimento` vs `entrada` | Distinguir logística vs estoque |
| `chamado` vs `O.S.` | `status` (demanda) vs `os_status` (execução) |

---

## 15. Períodos e Timezone (America/Sao_Paulo)

| Período | Definição America/Sao_Paulo | Conversão UTC (banco) | Exemplo |
|---|---|---|---|
| Hoje | `[00:00 hoje, 00:00 amanhã)` | `[00:00 BRT→UTC, 00:00 BRT+1→UTC)` via `America/Sao_Paulo` | `gte 2026-09-07T03:00:00Z lt 2026-09-08T03:00:00Z` (quando BRT=UTC-3) |
| 7d | `[00:00 hoje-6, 00:00 amanhã)` | via IANA | 7 dias incluindo hoje |
| 30d, 90d, 12m | idem | via IANA | |
| Personalizado | `[inicio 00:00, fim 00:00 +1)` | via IANA | |

**Regra:** Banco `UTC`, apresentação `America/Sao_Paulo`. Conversões usam `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` ou `date-fns-tz`, **não** offset hardcoded `-03:00`.

```ts
// helper
function toZonedMidnightUTC(dateStr: string, tz = "America/Sao_Paulo"): string {
  // dateStr = "2026-09-07", tz = IANA
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  // construir 00:00 tz → UTC
}
```

**Query padrão:**

```sql
WHERE created_at >= $inicio_utc AND created_at < $fim_utc
  AND organization_id = $orgId
```

---

## 16. KPIs — Especificação Completa

### KPI-01 — Total Ativos

- **Nome exibido:** Total de ativos cadastrados
- **Nome técnico:** `total_ativos`
- **Descrição:** Quantidade de ativos cadastrados na organização, independente de status.
- **Fonte:** `ativos`
- **Campo:** `id`
- **Fórmula:** `COUNT(id) WHERE organization_id = ctx.orgId`
- **Filtro tenant:** `eq organization_id`
- **Temporal:** sem filtro (foto atual) ou `created_at <= fim` para evolução.
- **Inclusões:** todos os `status`: `operacional`, `em_manutencao`, `parado`, `em_instalacao`, `em_inspecao`, `inativo`, `desativado`.
- **Separação:** disponibilizar `Ativos ativos` (`ativo=true`), `Inativos` (`status='inativo'`), `Desativados` (`status='desativado'`) como KPIs derivados, não misturar com total.
- **Exclusões:** nenhuma (soft delete não existe).
- **Unidade:** unidade.
- **Dados ausentes:** 0 é válido (tenant novo). Mostrar `0`.
- **Exemplo:** 3 ativos → `3`.
- **Teste:** inserir 3 ativos, `SELECT count(*) → 3`.
- **Estado sem dados:** `{ value: 0, state: "ok" }`.

### KPI-02 — Ativos por Status

- **Fonte:** `ativos.status`
- **Fórmula:** `SELECT status, count(*) GROUP BY status WHERE orgId`
- **Valores:** `operacional, em_manutencao, parado, em_instalacao, em_inspecao, inativo, desativado`.
- **Teste:** 2 operacional, 1 parado → `{"operacional":2,"parado":1}`.
- **Estado sem dados:** `{ value: {}, state: "empty" }` → exibir "Sem dados".

### KPI-03 — Ativos Críticos

- **Fonte:** `ativos.criticidade` + `ativos.status`
- **Fórmula:** `count where criticidade in ('alta','critica') OR status='parado'`
- **Teste:** 1 crítico, 1 alta, 1 baixa → `2`.
- **Estado sem dados:** `0` se nenhum crítico (válido), `Sem dados` se 0 ativos totais.

### KPI-04 — O.S. Abertas

- **Nome exibido:** O.S. abertas
- **Nome técnico:** `os_abertas`
- **Fonte:** `chamados.os_status`
- **Fórmula:** `count where os_status in ('aberta','planejada','atribuida','em_execucao','aguardando_peca','aguardando_terceiro','em_validacao') and organization_id = orgId and created_at in [periodo)`
- **Inclusões:** apenas `os_status` ativos.
- **Exclusões:** `concluida`/`encerrada`/`NULL`/ `cancelado`. **Não** contar `chamados.status='aberto'` sem `os_status` como O.S. aberta.
- **Teste:** 3 abertas, 1 concluída, 1 encerrada → `3`.
- **Estado sem dados:** `0` é válido; `Sem dados suficientes` se período sem O.S. e sem histórico.

### KPI-05 — Backlog

- **Fórmula:** `BACKLOG_DEMANDA` (status) e `BACKLOG_OS` (os_status) **separados**. `Backlog` padrão = `BACKLOG_OS`.
- **Contagem canônica:** `O.S. aberta` ≠ `chamado aberto`. O.S. requer `os_status IS NOT NULL`.
- **Teste:** `os_status` ativas 3 → backlog 3.

### KPI-06 — SLA

- **Fonte:** `chamados.prazo`, `chamados.concluido_em`, `chamados.os_status`
- **Fórmula:** `dentro = concluido_em::date <= prazo`, `atrasado = prazo < current_date and os_status not in (concluida,encerrada)`, `próximo = prazo - current_date between 0 and 2`.
- **Limiar próximo:** **2 dias** (determinístico). Alternativa proporcional documentada mas não usada: `tempo_restante <= 20% SLA total`.
- **Taxa:** `dentro / (dentro+atrasado+próximo com prazo)`.
- **Exclusões:** `prazo IS NULL` → `Sem prazo`, `cancelado`.
- **Teste:** 2 dentro, 1 atrasada → `66.7%`.
- **Estado sem dados:** `Sem dados` se nenhuma concluída com prazo; `Sem prazo` se todas sem prazo.

### KPI-07 — MTTR (Tempo Médio de Resolução)

- **Nome exibido:** MTTR — Tempo médio de resolução (abertura → conclusão)
- **Nome técnico:** `mttr` (TTR)
- **Descrição:** Média do tempo total desde abertura da demanda até conclusão. **Não** é tempo de execução puro.
- **Fonte:** `chamados.created_at`, `chamados.concluido_em`
- **Fórmula:** `AVG(concluido_em - created_at) where status in (resolvido,concluido) and concluido_em not null and os_status not null and status != 'cancelado'`.
- **Tempo de Execução (separado):** `AVG(data_fim - data_inicio) where data_fim/data_inicio not null` — expor como `tempo_execucao_medio` quando houver cobertura >80% de `data_inicio` preenchido.
- **Teste:** 1h,2h,3h → `2h`. Excluir cancelados/sem concluido_em.
- **Estado sem dados:** `Sem dados suficientes` se `COUNT = 0`.

### KPI-08 — MTBF

- **Nome exibido:** MTBF — Tempo médio entre falhas
- **Fonte:** `chamados` where `os_tipo='corretiva'`, `ativo_id`, `created_at` (falha)
- **O que conta como falha:** O.S. `corretiva` com `ativo_id NOT NULL`, `status in (resolvido,concluido)`, `os_status in (concluida,encerrada)`, `created_at` como timestamp da falha (não `concluido_em`).
- **Não contam:** `preventiva`, `preditiva`, `inspecao`, `instalacao`, `melhoria`, `cancelado`, `ativo_id IS NULL`.
- **Fórmula:** `MTBF = média(intervalos entre falhas consecutivas)` — `intervalos = f2.created_at - f1.created_at`, `MTBF = avg(intervalos)`. Para `n=3 falhas`, `n-1=2 intervalos`.
- **Requisito:** ≥3 falhas válidas por ativo no período. Se <3 → `Dados insuficientes`.
- **Teste:** 3 falhas D+0, D+10, D+30 → intervalos 10d, 20d → `15d`.

### KPI-09 — Custo Total Manutenção (período)

- **Fonte:** `chamados.custo_mao_obra + custo_outros + os_servicos_externos.valor + movimentacoes consumo*unitario`
- **Fórmula:** `SUM(custo_os) where organization_id and created_at in [periodo) and status != 'cancelado'`.
- **Congelado:** `custo_os = custo_mao_obra + custo_outros + SUM(servicos) + SUM(consumo)`. **Exclui** `compras` (aquisição).
- **Teste:** 100+200+50 = 350.
- **Teste regressão dupla contagem:** `Compra R$1.000` + `Consumo R$100` para O.S. 123 → `custo_os 123 = 100` (não 1100).
- **Estado sem dados:** `0` se nenhuma O.S. no período (válido), `Sem dados` se período sem O.S. e sem custos (distinguir).

### KPI-10 — Estoque Disponível / Crítico / Valor

- **Disponível:** `SUM(estoque_atual - estoque_reservado)` — explicitar `disponível` vs `físico` vs `reservado`.
- **Crítico:** `count where (estoque_atual - estoque_reservado) <= estoque_minimo` — usar `estoque_minimo`, **não** `ponto_reposicao` para crítico.
- **Abaixo reposição:** `count where disponível <= ponto_reposicao` — métrica distinta de `crítico`.
- **Fallback:** se `ponto_reposicao IS NULL` ou `0`, documentar fallback → considerar `crítico` = `disponível <= estoque_minimo`, `abaixo reposição` = `disponível <= estoque_minimo` (mesma regra, mas marcar `* fallback`).
- **Valor:** `SUM(estoque_atual * custo_medio)` (usa `estoque_atual` físico, **não** disponível, para valuation — `estoque_atual` é físico). Fallback `ultimo_custo` se `custo_medio` nulo.
- **Teste:** 10 físicos, 3 reservados → disponível 7. Valor 10*2.5=25.

### KPI-11 — Solicitações Pendentes

- **Fonte:** `solicitacoes_compra.status`
- **Fórmula:** `count where status in ('rascunho','enviada','em_analise','em_cotacao')`.
- **Teste:** 2 rascunho, 1 enviada → 3.
- **Estado sem dados:** `0`.

### KPI-12 — Reincidência

- **Fonte:** `chamados.ativo_id`, `chamados.categoria` (ocorrência) — **não** `ativos.categoria_id` (categoria do ativo).
- **Fórmula:** `count where exists anterior com mesmo ativo_id and categoria_ocorrencia igual and created_at - anterior.concluido_em < 90d`.
- **Limitação:** se `chamados.categoria` cobertura <50%, marcar como heurística: "usa categoria da ocorrência quando disponível; se nula, considera só ativo_id com * heurística".
- **Janela:** 90d.
- **Exclusões:** `os_tipo != 'corretiva'` não conta.
- **Teste:** Bomba 14 hidráulica D0 e D30 → reincidência; elétrica → não.

### KPI-13 — Top Ativos por O.S.

- **Fonte:** `chamados.ativo_id`
- **Fórmula:** `SELECT ativo_id, count(*) as qtd GROUP BY ativo_id ORDER BY qtd DESC LIMIT 5`.
- **Teste:** A 5, B 3, C 1 → top A.

### KPI-14 — Consumo por Produto

- **Fonte:** `movimentacoes_estoque` where `tipo='consumo'`
- **Fórmula:** `SELECT produto_id, SUM(quantidade) GROUP BY produto_id`.

---

## 17. Queries Analíticas (camada compartilhada `src/lib/analytics/`)

**Todas com `eq organization_id` e `gte/lt` por período em UTC convertido de `America/Sao_Paulo`.**

```sql
-- MTTR (TTR)
SELECT avg(extract(epoch from (concluido_em - created_at))/3600) as mttr_h
FROM chamados
WHERE organization_id = $1
  AND status IN ('resolvido','concluido')
  AND concluido_em IS NOT NULL
  AND os_status IS NOT NULL
  AND created_at >= $2 AND created_at < $3;

-- Tempo de Execução (quando data_inicio/fim disponíveis)
SELECT avg(extract(epoch from (data_fim - data_inicio))/3600)
FROM chamados WHERE organization_id=$1 AND data_inicio IS NOT NULL AND data_fim IS NOT NULL;

-- Backlog OS
SELECT count(*) FROM chamados
WHERE organization_id = $1
  AND os_status IN ('aberta','planejada','atribuida','em_execucao','aguardando_peca','aguardando_terceiro','em_validacao');

-- Custo OS
SELECT sum(custo_mao_obra + custo_outros) + COALESCE((SELECT sum(valor) FROM os_servicos_externos WHERE chamado_id IN (SELECT id FROM chamados WHERE organization_id=$1)),0)
FROM chamados WHERE organization_id=$1;

-- Estoque crítico (usa disponível)
SELECT count(*) FROM produtos
WHERE organization_id=$1
  AND (estoque_atual - estoque_reservado) <= estoque_minimo;

-- Abaixo reposição (distinto de crítico)
SELECT count(*) FROM produtos
WHERE organization_id=$1
  AND (estoque_atual - estoque_reservado) <= ponto_reposicao;

-- Top ativos
SELECT ativo_id, count(*) as qtd FROM chamados
WHERE organization_id=$1 GROUP BY ativo_id ORDER BY qtd DESC LIMIT 5;
```

**Camada compartilhada:** `src/lib/analytics/` com:

```
src/lib/analytics/
  index.ts        — re-exports
  types.ts        — PeriodoId, SlaClass, OsStatus, etc.
  calculations.ts — funções puras (calcDisponivel, calcMTTR, classificarSLA, etc.)
  queries.ts      — builders Supabase (eq org, gte/lt, group) — I/O
  transforms.ts   — formatação (formatarMoeda, formatarDataHora)
```

Dashboard, relatório e exportação **consomem a mesma camada** (`import { getMTTR } from "@/lib/analytics/queries"`), não duplicam consultas.

**Views/RPCs:** Não criar no BLOCO A. Se no BLOCO B uma métrica for usada em 3+ lugares, criar `v_analytics_mttr` e documentar por que existe.

---

## 18. Performance

- **1.000 chamados / 1.000 O.S. / 1.000 ativos / 5.000 movimentações:** usar `count(*) exact` com índice `chamados_org_idx` e `mov_org_data_idx`, `GROUP BY` no banco, não `SELECT *` + JS count.
- **Índices existentes suficientes** (ver DATA_MAP §6). Não criar novos sem `EXPLAIN ANALYZE`.
- **Paginação:** relatórios com `range(0,49)` + `count`.
- **Queries críticas a monitorar:** dashboard (backlog, SLA), MTTR, custos (SUM com JOINs), estoque (SUM), top ativos (GROUP BY).

---

## 19. Métricas sem Dados — Tratamento

| Situação | Exibir | API |
|---|---|---|
| `COUNT = 0` (nenhuma O.S.) | `0` (válido) | `{ value: 0, state: "ok" }` |
| `AVG` com `COUNT = 0` (MTTR sem concluídas) | `Sem dados suficientes` | `{ value: null, state: "insufficient_data" }` |
| `MTBF` com <3 falhas | `Sem dados suficientes` | `{ value: null, state: "insufficient_data" }` |
| `Disponibilidade` sem histórico | `Sem dados suficientes` | `{ value: null, state: "insufficient_data" }` |
| `prazo IS NULL` para SLA | `Sem prazo` (categoria separada) | `{ value: null, state: "no_deadline" }` |
| `0` vs `null` | Distinguir: `0` é informação, `null` é ausência |  |

**Contrato API analítica:**

```ts
type AnalyticsResult<T> = {
  value: T | null;
  state: "ok" | "empty" | "insufficient_data" | "no_deadline";
  meta?: { periodo: string; tenant: string; calculatedAt: string };
}
```

Não devolver formatos diferentes para cada consumidor. Dashboard, relatório e exportação usam mesmo `state`.

---

## 20. Consistência

- **Mesma fórmula** em dashboard, relatório, exportação, mapa. Extrair para `src/lib/analytics/calculations.ts`.
- **Período idêntico** (`Hoje` = `[00:00,00:00+1)` America/Sao_Paulo) em todos os módulos.
- **Tenant idêntico** (`ctx.orgId`).
- **Teste matemático idêntico** para cada KPI.
- **Exportação** usa mesmos resultados filtrados da interface, não recalcula diferente.

---

## 21. Auditoria

Registrar `REPORT_EXPORTED` (com `filtros`, `periodo`, `tenant`) e `DASHBOARD_FILTERED` quando filtro muda e há valor operacional. Não logar cada hover.

---

## 22. Implementação BLOCO A — Entregáveis

- `ANALYTICS_SPEC.md` (este arquivo)
- `ANALYTICS_DATA_MAP.md` + `ANALYTICS_GLOSSARY.md` (seção 23)
- `src/lib/analytics/` — `calculations.ts` (já existe como `src/lib/analytics.ts`, mover para pasta no BLOCO B), `types.ts`, `queries.ts`
- `tests/analytics.test.ts` — 26 testes + novos para fronteira/dupla contagem/consistência (BLOCO A complemento)
- Nenhuma tela nova

---

## 23. Glossary

| Termo | Definição | Fonte |
|---|---|---|
| **Demanda** | Solicitação registrada em `chamados` com `status` | `chamados.status` |
| **O.S.** | Ordem de serviço, execução da demanda, `chamados` com `os_status NOT NULL` | `chamados.os_status` |
| **Backlog demanda** | Demandas não finais (`aberto`..`em_andamento`) | `chamados.status` |
| **Backlog O.S.** | O.S. com `os_status` ativo (aberta..em_validacao) | `chamados.os_status` |
| **TTR** | Tempo de Resolução: `created_at → concluido_em` | `chamados` |
| **MTTR** | Média de TTR: `AVG(TTR)` onde `TTR` válido | `chamados` |
| **Tempo de Execução** | `data_fim - data_inicio` ou `os_status_historico` | `chamados` |
| **MTBF** | Média de intervalos entre falhas `corretiva` por ativo | `chamados` |
| **SLA** | `prazo` vs `concluido_em`/`current_date` com faixas dentro/próximo/atrasado/sem prazo | `chamados.prazo` |
| **Falha** | O.S. `corretiva` com `ativo_id` e `status` final, `created_at` como ocorrência | `chamados` |
| **Reincidência** | Nova `corretiva` mesmo `ativo_id` + mesma `categoria` <90d | `chamados` |
| **Disponível** | `estoque_atual - estoque_reservado` | `produtos` |
| **Valor estoque (físico)** | `SUM(estoque_atual * custo_medio)` | `produtos` |
| **Valor disponível** | `SUM(disponível * custo_medio)` — só quando solicitado | `produtos` |
| **Custo O.S.** | `mao_obra + outros + servicos + consumo` | `chamados` + satélites |
| **Custo aquisição** | `compras.valor_total` | `compras` |
| **Estado sem dados** | `insufficient_data` vs `empty` vs `ok` | `AnalyticsResult` |

---

## 24. Decisões Analíticas

| Decisão | Justificativa |
|---|---|
| `MTTR = TTR = created_at → concluido_em` exibido como "Tempo médio de resolução" | `concluido_em` é trigger confiável; `data_inicio` nem sempre preenchido; documentar nome exibido vs técnico |
| `Tempo de Execução` separado | Quando `data_inicio/fim` >80% cobertura, expor como métrica distinta |
| `MTBF` exige ≥3 falhas, média de intervalos | Evita média com denominador 1; 3 falhas = 2 intervalos |
| `Disponibilidade` não implementada no BLOCO B | Sem histórico contínuo de status |
| `Custo` separa aquisição vs manutenção | Evita dupla contagem `compras`+`consumo`; teste regressão `Compra 1000 + Consumo 100 = Custo 100` |
| `Estoque` usa `custo_medio` para valor físico | Regra homologada `estoque/page.tsx:62`; disponível só para "valor disponível" |
| `Estoque crítico` = `disponível <= estoque_minimo`, `abaixo reposição` = `disponível <= ponto_reposicao` | Métricas distintas, fallback documentado se `ponto_reposicao` nulo |
| `Backlog` separado demanda vs O.S. | `status` vs `os_status` não misturados; `O.S. aberta` requer `os_status` |
| `SLA` 3 faixas + Sem prazo, limiar próximo 2 dias | Determinístico, simples; alternativa proporcional documentada |
| `Reincidência` = mesmo ativo + categoria ocorrência + 90d, com limitação se categoria nula | Não usar `ativos.categoria_id` como proxy; marcar heurística |
| `Timezone` = `America/Sao_Paulo` IANA | Não offset hardcoded; Banco UTC, apresentação BRT |
| `Período` = `[00:00, 00:00+1)` BRT | Inclusivo início, exclusivo fim |
| `Tenant` = `organization_id` via `requireOrg()` | Nunca `req.query` |
| `API` = `{ value, state }` | Mesmo formato para dashboard/relatório/exportação |

---

## 25. Testes

Cada KPI com pelo menos 1 teste determinístico. Exemplos nas seções 4–14. Fronteira: 0 registros, 1 registro, cancelados, sem data, sem custo, sem ativo, legados, tenant vazio, período sem dados, prazo nulo, O.S. cancelada, concluída fora do período, abertura antes e conclusão dentro/depois, ativo desativado/sem histórico, consumo sem custo.

Dupla contagem: `compra (1000) + recebimento + entrada + consumo (100)` → custo correto `100` (teste em §8.2).

Consistência: mesmo dataset, dashboard/relatório/exportação produzem mesmo `value` e `state` (teste compara `getMTTR(dashboardQuery)` vs `getMTTR(reportQuery)`).

---

## 26. Performance — Preparação

Queries críticas a monitorar (sem otimização prematura, mas identificadas):

- `dashboard` (backlog, SLA, contadores)
- `MTTR` (AVG com `concluido_em - created_at`)
- `custos` (SUM com JOINs `os_servicos_externos` + `movimentacoes`)
- `estoque` (SUM `estoque_atual*custo_medio`, `count where disponível <= minimo`)
- `top ativos` (GROUP BY `ativo_id`)
- `consumo` (GROUP BY `produto_id`)

Índices necessários já existentes (ver DATA_MAP §6). Confirmar via `EXPLAIN` no BLOCO F, não criar novos agora.

---

## 27. Próximos Passos

BLOCO B usará `src/lib/analytics/` como fonte única. Dashboard, relatório e exportação consumirão `queries.ts` + `calculations.ts`, não duplicarão consultas.
