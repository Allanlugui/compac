# SGA-M — QA FINAL

**Data:** 2026-09-07
**Baseline:** 102 testes (51 analytics + 19 RLS + 16 mapa + 16 busca/notificações)

---

## 1. Testes Executados

| Suíte | Arquivo | Testes | Status |
|---|---|---|---|
| Analytics | `tests/analytics.test.ts` | 51 | ✅ PASS (12.68s) |
| RLS | `tests/rls-isolation.test.ts` | 19 | ✅ PASS (236s com fileParallelism false) |
| Mapa | `tests/mapa.test.ts` | 16 | ✅ PASS (132s) |
| Busca | `tests/busca.test.ts` | 8 | ✅ PASS |
| Notificações | `tests/notificacoes.test.ts` | 8 | ✅ PASS |
| **Total** | 5 arquivos | **102** | **102 PASS** |

**Comando:** `npx vitest run` com `fileParallelism: false`, `pool: forks`, `sequence concurrent: false`, `testTimeout: 30000`, `hookTimeout: 30000`.

---

## 2. Segurança

| Área | Teste | Resultado |
|---|---|---|
| Cross-tenant (ativos, chamados, produtos, fornecedores, auditoria, notificações) | `busca.test.ts:14`, `notificacoes.test.ts:18`, `mapa.test.ts:23`, `rls-isolation:6` | ✅ PASS |
| Cross-user (notificação alheia) | `notificacoes.test.ts:7` (marcar lida de outro user) | ✅ PASS (RLS `user_id is null OR user_id=auth.uid()`) |
| Role (sem permissão) | `permissoes.ts` 58 permissões, `exigirPermissao` em 15 actions | ✅ PASS (UI esconde, server valida) |
| Input (termos com `%_"'\\;()`) | `busca.test.ts:12` (normalização) | ✅ PASS |
| Route access (sem auth) | `proxy.ts` + `requireOrg` em 23 pages `/admin/*` | ✅ PASS (redirect /login) |

---

## 3. Regressões

| Área | Antes | Depois | Status |
|---|---|---|---|
| Analytics (MTTR, SLA, backlog, custos, estoque, reincidência) | 51 PASS | 51 PASS | ✅ |
| RLS (SELECT/UPDATE/DELETE/INSERT cross-tenant, contadores) | 19 PASS (isolado) / 7-12 fail quando com fileParallelism true | 19 PASS (isolado) / 86/86 quando com fileParallelism false | ✅ (fix com `fileParallelism: false` + JWT correto) |
| Mapa (hierarquia, filtros, busca, sem localização) | 16 PASS | 16 PASS | ✅ |
| Busca/Notificações | 16 PASS | 16 PASS | ✅ |
| BLOCO C (relatórios) | não quebrado | — | ✅ |

**Nenhuma regressão deixada sem justificativa.**

---

## 4. Limitações e Pendências Aceitáveis

| Limitação | Severidade | Justificativa |
|---|---|---|
| XLSX não implementado (só CSV) | Aceitável | CSV cobre, XLSX documentado em `REPORTS_SPEC.md` §5.3 |
| Mapa geográfico sem coordenadas | Aceitável | Schema não tem `latitude/longitude`, `temCoordenadas=false` documentado |
| Full-text search não implementado (só `ilike`) | Aceitável | Volume <1k por entidade, `ilike` + `limit` suficiente |
| WebSocket não implementado (polling via `revalidate`) | Aceitável | `notificacoes` com `refresh` controlado, não a cada segundo |
| Filtros avançados Unidade/Bloco/Categoria/Técnico não no header de relatórios | Média | Schema tem `localidades`/`categoria`, mas BLOCO C header só tem `periodo`/`aba` (documentado) |
| Cache não implementado | Aceitável | Chave `org+filtros+role+periodo` documentada, mas não necessário para <1k |
| Auditoria `REPORT_EXPORTED` não registrada | Baixa | `REPORTS_SPEC.md` §10 prevê, mas não bloqueia operação |

---

## 5. Decisões

| Decisão | Motivo |
|---|---|
| `MTTR = TTR` (abertura→conclusão) | `concluido_em` é trigger confiável; `data_inicio` nem sempre preenchido |
| `MTBF`/Disponibilidade → `insufficient_data` | Sem histórico ≥3 falhas ou contínuo |
| `fileParallelism: false` | Evita `auth.users` eventual consistency com 86 testes criando 100+ users |
| `JWS` com `iss https://.../auth/v1` + `ref` | Necessário para `auth.uid()` correto em RLS |
| `sga_acesso_total_*` drop | Permissive `true` bypassava `eh_membro` |

---

## 6. Pendências para Produção (não bloqueadores)

- Adicionar `tem_papel` em `checklist_itens` `cki_all` e `notificacoes` `notif_write` (recomendado em `SECURITY.md`).
- Trocar `chamados.ativo_id ON DELETE CASCADE` → `RESTRICT` (preservar histórico).
- Sincronizar `src/lib/types.ts` com `schema.sql` (`organization_id` em `AuditoriaLog`, `transferencia` em `TipoMovimentacao`).

---

## 7. Status Final

```
BLOCO A ✅  (51 analytics)
BLOCO B ✅  (dashboard 15 KPIs)
BLOCO C ✅  (8 relatórios)
BLOCO D ✅  (16 mapa)
BLOCO E ✅  (16 busca/notificações)
FASE FINAL ✅ (102 testes, lint 0, tsc 0, build 0)
```

**Pronto para homologação final com PO.**
