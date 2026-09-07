# SGA-M — REPORTS SPEC

**Versão:** BLOCO C — Relatórios
**Data:** 2026-09-07
**Depende de:** `ANALYTICS_SPEC.md`, `ANALYTICS_DATA_MAP.md`, `src/lib/analytics/`
**Rota:** `/admin/relatorios` (`src/app/admin/relatorios/page.tsx`)

---

## 1. Relatórios Disponíveis

| Aba | ID | Descrição | KPIs principais |
|---|---|---|---|
| Executivo | `executivo` | Visão consolidada do período | Todos os 15 KPIs (MTTR, MTBF, Disponibilidade com `insufficient_data` quando sem histórico) |
| Ativos | `ativos` | Ativos por status, críticos, disponibilidade | KPI-01,02,03,15 |
| Manutenção | `manutencao` | O.S., backlog, MTTR, Top O.S. | KPI-04,05,07,13 |
| SLA | `sla` | Dentro/próximo(2d)/atrasado/sem prazo, taxa | KPI-06 |
| Custos | `custos` | Custo total OS, por ativo | KPI-09,13 |
| Estoque | `estoque` | Disponível/crítico/valor, consumo por produto | KPI-10,14 |
| Solicitações | `solicitacoes` | Pendentes | KPI-11 |
| Top Ativos | `top` | 3 rankings Top 10 (O.S., custo, reincidência) | KPI-13 |

---

## 2. Filtros Globais

| Filtro | Valores | Implementado | Fonte |
|---|---|---|---|
| Período | `7d`, `30d` (padrão), `90d`, `12m` | ✅ | `PeriodoId` + `getPeriodoRangeBRT` (`America/Sao_Paulo` → UTC) |
| Aba | 8 abas acima | ✅ | `searchParams.aba` |
| Unidade/Bloco/Andar/Área | — | ⏳ Limitação: schema tem `localidades` hierarquia, mas filtros de localidade por nível não implementados no BLOCO C (documentado como limitação) | `localidades` |
| Categoria | — | ⏳ Limitação: `produtos.categoria_id` e `chamados.categoria` existem, mas filtro de categoria global não implementado no header do relatório (pode filtrar via tabela) | — |
| Técnico/Equipe | — | ⏳ Limitação: `chamados.responsavel/equipe` existem, mas filtro global não implementado | — |
| Status/Criticidade | — | ✅ Parcial: SLA e ativos por status filtram, mas não há filtro global único | — |

**Comportamento:** todos os filtros são `searchParams` (`?periodo=30d&aba=executivo`), compartilhados entre abas. Exportação respeita os mesmos `periodo` e `aba`.

---

## 3. Regras por Relatório

### 3.1 Executivo
- Todos os KPIs do período, com estados `ok/empty/insufficient_data/no_deadline`.
- MTBF e Disponibilidade mostram `Dados insuficientes` quando `state=insufficient_data`, nunca `0%`.
- Clicáveis: `Total Ativos → /admin/ativos`, `O.S. Abertas → /admin/chamados?os_status=aberta`, etc.

### 3.2 Ativos
- `Total`, `Críticos`, `Disponibilidade`, lista `Ativos por Status` com drill-down `?status=`.

### 3.3 Manutenção
- `O.S. Abertas`, `Backlog`, `MTTR`, `Top O.S.` (Top 10 por `ativo_id`).
- MTTR usa `TTR` (`created_at → concluido_em`), não `TEXEC`.

### 3.4 SLA
- Barra empilhada com 4 faixas: `Dentro`, `Próximo (2d)`, `Atrasado`, `Sem prazo`.
- Taxa `dentro/totalComPrazo`.
- `Sem prazo` ≠ `Atrasado`.

### 3.5 Custos
- `Custo Total` = `mao_obra + outros + serviços + consumo` (sem `compras`).
- `Top Custo` por ativo.
- Nota: `Compra 1000 + Consumo 100 = Custo 100` (teste regressão).

### 3.6 Estoque
- `Disponível`, `Críticos`, `Valor físico` (`SUM(estoque_atual * custo_medio)`).
- `Top Consumo` por quantidade e por valor (fonte `tipo='consumo'`).

### 3.7 Solicitações
- `Solicitações Pendentes` (`rascunho/enviada/em_analise/em_cotacao`).

### 3.8 Top Ativos
- 3 rankings independentes, cada `Top 10`, cada `Top 10` com drill-down para O.S. do ativo.

---

## 4. Estados

| Estado | Quando | Exibição |
|---|---|---|
| `loading` | Server Component suspende (não implementado skeleton no BLOCO C, mas preparado) | — |
| `ok` | Valor válido | Valor + sub |
| `empty` | `count=0` válido (ex: 0 O.S. abertas) | `0` |
| `insufficient_data` | `AVG` sem dados, MTBF <3 falhas, Disponibilidade sem histórico | `Dados insuficientes` |
| `no_deadline` | SLA sem prazo | `Sem prazo` |
| `error` | `supabase` error | `Erro ao carregar` (sem stack) |

---

## 5. Exportação

### 5.1 PDF
- Via `window.print()` (reutiliza `BotaoImprimirRelatorio` e `ExportButtons`).
- Cabeçalho: SGA-M, organização (`ctx.orgNome`), relatório (`aba`), período (`periodo`), filtros, data/hora geração.
- Corpo: mesmos KPIs e tabelas da tela (mesma query, mesmo filtro).
- Rodapé: página, período.
- Tenant: `ctx.orgId` validado no servidor (`requireOrg`), não `query string`.

### 5.2 CSV
- Gerado no client a partir de `exportData` (que veio do servidor com `orgId` já filtrado).
- Colunas: `Relatorio, Periodo, Gerado em, [KPI, Valor]` + detalhes do período.
- Nome: `relatorio-{aba}-{periodo}.csv`.
- Valores formatados com `formatarMoeda`/`formatarDuracaoMedia` quando aplicável.
- Filtros: respeita `periodo` e `aba` atuais (não exporta "todos os dados").

### 5.3 XLSX
- Não implementado no BLOCO C (limitação documentada). CSV é suficiente; XLSX pode ser adicionado no BLOCO F com `xlsx` se necessário. Por ora, CSV cobre o requisito.

### 5.4 Segurança
- Exportação usa dados já filtrados por `ctx.orgId` no servidor. Não confia em `organization_id` do frontend.
- Nome de arquivo sanitizado (`relatorio-${aba}-${periodo}.csv`, sem path traversal).
- Sem secrets no frontend.

---

## 6. Drill-down

| Origem | Destino |
|---|---|
| Total Ativos | `/admin/ativos` |
| Ativos Críticos | `/admin/ativos?critico=1` |
| O.S. Abertas | `/admin/chamados?os_status=aberta` |
| Backlog | `/admin/chamados?os_status=...` |
| SLA Dentro/Próximo/Atrasado | `/admin/chamados?prazo=...` (futuro, por ora `href` para lista) |
| Top Ativos (OS/custo/reincidência) | `/admin/chamados?ativo=ID` |
| Estoque Críticos | `/admin/estoque?filtro=criticos` |
| Solicitações | `/admin/compras/solicitacoes` |
| Custo | `/admin/relatorios?aba=custos` |

Filtros do drill-down derivados da definição do KPI (ex: `Ativos Críticos` = `criticidade alta/critica` ou `status parado`).

---

## 7. Multi-tenant e Permissões

- Toda query usa `requireOrg()` → `ctx.orgId` + `eq organization_id`.
- RLS `eh_membro` garante isolamento mesmo se `ctx` falhar.
- `exigirPermissao(ctx, "...")` não é usado em relatórios (são só leitura), mas `requireOrg` valida `membership` + `role`.
- `ADMIN`/`GESTOR`: todos os relatórios.
- `COMPRAS`: vê `Solicitações`, `Estoque`, `Custos` (quando aplicável). BLOCO C não esconde relatórios por role (limitação documentada, mas RLS ainda filtra dados).
- `TECNICO`/`AUDITOR`/`SOLICITANTE`: veem o que RLS permite; se `Top Ativos` exigir dados que role não pode ver, RLS retorna 0.

---

## 8. Performance

- Todas as queries usam `count exact` com `head: true` ou `select` com `eq org` + `gte/lt` (período) + índices `chamados_org_idx`, `mov_org_data_idx`.
- Nenhum `SELECT *` sem filtro.
- `Promise.all` para 18 queries em paralelo no `RelatoriosPage`.
- Paginação não necessária para contadores; para tabelas Top 10, `limit 10` no `GROUP BY`.

---

## 9. Limitações (BLOCO C)

- Filtros globais avançados (Unidade/Bloco/Categoria/Técnico) não implementados no header (só período e aba).
- XLSX não implementado (CSV cobre).
- Gráficos são barras/listas simples, não `recharts` complexos (evita decorativo).
- `Custo por localização` e `Preventiva` não têm relatório dedicado no BLOCO C (estão no SPEC mas não na rota; podem vir no BLOCO F).
- Auditoria de `REPORT_EXPORTED` não registrada (pode ser adicionada no BLOCO F).

---

## 10. Testes

- Preservados: `51` analytics + `19` RLS = `70`.
- Novos (BLOCO C): devem cobrir `relatório respeitando filtros/período/timezone/org/role`, `exportação com mesmo filtro`, `SLA sem prazo`, `MTBF/Disponibilidade insufficient_data`, `compra ≠ consumo`, `consistência Dashboard ↔ Relatório`, `drill-down`, `empty/error`, `cross-tenant`.

---

## 11. Validação

```bash
npm run lint  # 0
npx tsc --noEmit  # 0
npm run build  # 0
npx vitest run tests/analytics.test.ts  # 51 PASS
npx vitest run tests/rls-isolation.test.ts  # 19 PASS
```

---

## 12. Origem dos Dados

Todos os relatórios consomem `src/lib/analytics/queries.ts` + `calculations.ts` (mesma camada do Dashboard). Não há segunda camada analítica.

---

## 13. Próximos Passos

BLOCO D: Mapa operacional (hierarquia localidades + drill-down + métricas por nível)
BLOCO E: Busca global + notificações
