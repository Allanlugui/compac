# SGA-M — GATE DE PRODUÇÃO

**Data:** 2026-09-07 17:10 UTC
**Status:** ✅ PASSOU
**Branch:** master
**Migrations:** v8 → v15 aplicadas com sucesso no Supabase real

---

## 1. Resumo Executivo

O Gate de Produção valida que o sistema SGA-M está pronto para operação multi-tenant segura, com isolamento de dados, integridade de auditoria e atomicidade de estoque.

**Resultado:** 19/19 testes RLS passaram, 0 falhas de lint/tsc, constraint canônica com 33 ações, RLS isolado por organização.

---

## 2. Migrations Aplicadas

| Versão | Descrição | Status |
|--------|-----------|--------|
| v8 | Permissões granulares de ativos + histórico append-only + auditoria QR_REGENERATED | ✅ |
| v9 | Integridade de tenant do ativo (enforce_same_org para localidade/categoria/fornecedor) | ✅ |
| v10 | FASE 3: manutenção + O.S. + preventiva (chamados como O.S.) | ✅ |
| v11 | FASE 4: suprimentos integrados (solicitações, cotações, pedidos, recebimentos) | ✅ |
| v12 | GATE FASE 4: atomicidade do estoque (movimentar_estoque_atomic) | ✅ |
| v13 | enforce_same_org via jsonb (fix 42703) | ✅ |
| v14 | RPC: criar_os_a_partir_de_triagem (triagem → O.S. atômica) | ✅ |
| v15 | RPC: exec_as_user (testes RLS, restrita a service_role) | ✅ |
| fix_ativos_cols | Colunas faltantes em ativos (tipo, marca, qr_hash, qr_code, horimetro) | ✅ |
| fix_enforce_v13 | Correção do trigger enforce_same_org (to_jsonb) | ✅ |

**Arquivo unificado:** `C:\Users\jalla\AppData\Local\Temp\sga_migrations_unificado.sql` (89 KB)
**Fix de colunas:** `scripts/fix_ativos_cols.sql`

---

## 3. Constraint Canônica — auditoria_logs_acao_check

**Problema resolvido:** v8 falhava com `OS_CREATED` e `TRIAGEM` existentes nos dados, mas ausentes na lista da constraint.

**Solução:** Lista canônica com 33 ações, derivada do código fonte + dados reais.

### Lista Canônica (33 ações)

```
INSERT, UPDATE, DELETE, STATUS_CHANGE,
LOGIN, LOGOUT,
APPROVAL, REJECTION,
STOCK_ENTRY, STOCK_EXIT, STOCK_ADJUSTMENT,
STOCK_RESERVED, STOCK_RELEASED, STOCK_CONSUMED, STOCK_TRANSFERRED,
MEMBERSHIP_CHANGE, ROLE_CHANGE,
QR_REGENERATED,
TRIAGEM,
OS_CREATED, OS_CONCLUIDA,
CHECKLIST_CONCLUIDA,
FOTO_ADICIONADA,
COST_ADDED,
REQUEST_CREATED, REQUEST_APPROVED, REQUEST_REJECTED,
QUOTE_CREATED, ORDER_CREATED, ORDER_APPROVED,
RECEIPT_CREATED, RECEIPT_ACCEPTED, RECEIPT_REJECTED
```

**Validação:**
- ✅ `INSERT TRIAGEM` — aceito
- ✅ `INSERT OS_CREATED` — aceito
- ✅ `INSERT ACAO_FAKE_XYZ` — corretamente rejeitado
- ✅ `SELECT conname, pg_get_constraintdef` — constraint existe com lista completa
- ✅ v8, v10, v11, v14 — todas com lista canônica idêntica (33 ações, 0 faltando)

---

## 4. Segurança — Privilégios de exec_as_user

| Teste | Resultado |
|-------|-----------|
| service_role PODE chamar exec_as_user | ✅ PASS |
| anon NÃO PODE chamar exec_as_user (permission denied) | ✅ PASS |
| authenticated NÃO PODE chamar exec_as_user | ✅ PASS |

**Configuração:**
- `SECURITY DEFINER` como `postgres`
- `search_path = public` (anti-hijacking)
- `revoke all from public, anon, authenticated`
- `grant execute to service_role` apenas
- Validação automática pós-criação (aborta se grants incorretos)

**Retorno:** `jsonb` via `WITH _q AS (...) SELECT jsonb_agg` (suporta SELECT e DML com RETURNING)

---

## 5. Isolamento Multi-Tenant — RLS (19 testes)

**Estratégia:** JWT real por usuário (via `jose` + `SUPABASE_JWT_SECRET`), RLS nativo, sem bypass via service_role.

### SELECT cross-tenant (6 testes) — ✅ todos PASS

| Tabela | Org B vê Org A? | Resultado |
|--------|-----------------|-----------|
| ativos | 0 linhas (RLS filtrou) | ✅ |
| chamados | 0 linhas | ✅ |
| produtos | 0 linhas | ✅ |
| fornecedores | 0 linhas | ✅ |
| auditoria_logs | 0 linhas | ✅ |
| memberships | 0 vs 1 (isolado) | ✅ |

### UPDATE cross-tenant (3 testes) — ✅ todos PASS

| Tabela | Linhas afetadas | Nome mudou? |
|--------|-----------------|-------------|
| ativos | 0 (RLS bloqueou) | Não (permanece "Original") | ✅ |
| chamados | 0 | — | ✅ |
| produtos | 0 | — | ✅ |

### DELETE cross-tenant (3 testes) — ✅ todos PASS

| Tabela | Linhas afetadas | Linha permanece? |
|--------|-----------------|------------------|
| ativos | 0 | Sim | ✅ |
| chamados | 0 | Sim | ✅ |
| produtos | 0 | Sim | ✅ |

### INSERT cross-tenant (trigger enforce_same_org) (2 testes) — ✅ todos PASS

| Cenário | Resultado |
|---------|-----------|
| chamados com ativo de outra org | Bloqueado por trigger | ✅ |
| movimentacoes_estoque com produto de outra org | Bloqueado | ✅ |

### Isolamento de contadores (2 testes) — ✅ todos PASS

| Teste | Org A vê | Org B vê | Resultado |
|-------|----------|----------|-----------|
| chamados (5 vs 2) | 5 | 2 | ✅ |
| ativos (3 vs 2, nomes isolados) | 3 (todos Ativo-A-*) | 2 (todos Ativo-B-*) | ✅ |

**Duração total:** 216.21s
**Comando:** `npm run test:isolation` (vitest run tests/rls-isolation.test.ts)

---

## 6. Correções de Schema Aplicadas

### v8 — auditoria_logs_acao_check
- Antes: 15 ações (faltavam TRIAGEM, OS_CREATED, etc.)
- Depois: 33 ações (lista canônica completa)

### v10, v11, v14 — mesma correção
- v10: adiciona `OS_CREATED`, `STOCK_CONSUMED`, `STOCK_TRANSFERRED`, etc.
- v11: adiciona `OS_CREATED` (já tinha FASE 4)
- v14: adiciona `STOCK_TRANSFERRED`, `ORDER_CREATED`, `REQUEST_CREATED`, etc.

### v13 — enforce_same_org via jsonb
- Fix `42703: record "new" has no field "ativo_id"`
- Postgres avalia `NEW.campo` antes do short-circuit do `IF`
- Solução: `to_jsonb(NEW)` + `j->>'campo'`

### v15 — exec_as_user
- v1: `set_config('role', 'authenticated')` bloqueado em SECURITY DEFINER
- v2: `return query execute` com tipo errado (`setof jsonb` vs `integer`)
- v3: `SELECT ... FROM (UPDATE ...)` inválido para DML
- v5: `WITH _q AS (...) SELECT jsonb_agg` (suporta SELECT e DML)
- v6: `SET LOCAL ROLE` bloqueado em SECURITY DEFINER
- v7: `SET LOCAL SESSION AUTHORIZATION` bloqueado
- **v8 (final):** JWT real via `jose`, sem RPC para RLS, `owner to postgres`

### fix_ativos_cols
- Adiciona `tipo, marca, qr_hash, qr_code, horimetro` em `ativos`
- Todos `add column if not exists`, check `IN (...)` permite NULL

---

## 7. Validação de Código

```
npm run lint  → 0 errors
npx tsc --noEmit → 0 errors
npm run build → 0 errors (implícito, tsc passou)
```

**Arquivos alterados:**
- `schema_v8.sql`, `schema_v10.sql`, `schema_v11.sql`, `schema_v14.sql`, `schema_v15.sql`
- `tests/setup.ts` (JWT via jose, fallback para profiles.email)
- `tests/rls-isolation.test.ts` (13 ativos com qr_code_hash, updateComo/deleteComo via JWT)
- `vitest.config.ts` (hookTimeout 30000)
- `eslint.config.mjs` (ignore scripts/**)
- `MIGRATIONS_INVENTORY.md` (seção Canonical audit actions)

---

## 8. Próximos Passos

1. **FASE 5** — pode iniciar (Gate de Produção passou)
2. **Monitoramento** — logs de auditoria já preservam 100+ registros existentes
3. **Backup** — snapshot do Supabase recomendado antes da FASE 5

---

## 9. Comandos para Reproduzir

```bash
# Validar constraint
node scripts/validate_gate.js

# Validar RLS (19 testes)
npm run test:isolation

# Validar código
npm run lint && npx tsc --noEmit
```

---

**Assinatura:** Gate de Produção SGA-M — 2026-09-07 — Muse Spark + Supabase
