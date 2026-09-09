# SGA-M — OPERATIONS

**Versão:** PRODUÇÃO (2026-09-09)
**Data:** 2026-09-09

---

## 1. Variáveis de Ambiente

| Nome | Onde | Exemplo | Secret? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env`, `.env.test`, Vercel | `https://xxx.supabase.co` | Não |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env`, Vercel | `eyJ...` | Não (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` (server-only), Vercel | `eyJ...` | **Sim** |
| `SUPABASE_JWT_SECRET` | `.env.test` | `qGjym...` | **Sim** (dev) |
| `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` | legado, não usar | — | — |

Nunca commitar `.env`, `.env.local`, `.env.test` com secrets reais (`.gitignore` cobre).

---

## 2. Deploy — Vercel

- **Framework:** Next.js 16.3.4
- **Build:** `npm run build` (`next build` com `experimental.serverActions.bodySizeLimit: "25mb"`)
- **Install:** `npm install` com `package-lock.json` (Vercel usa `npm ci` se `package-lock` existe)
- **Env Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Build cache:** `HNQ7VH55PSUgxamat6K3UMLBZagL` (Vercel)
- **Erro comum:** `vitest` peer ` @types/node ^22 || >=24` com `@types/node ^20` → `ERESOLVE` → fix `bump @types/node to ^24` (commit `722dfea`)

---

## 3. Supabase

- **Projeto:** `ialjfeltqpbgrxtymfwa.supabase.co` (ref `ialjfeltqpbgrxtymfwa`)
- **Auth:** `auth.users` + `public.profiles` + `public.memberships`
- **Storage:** bucket `manutencao-midia` (privado)
- **Realtime:** não usado (notificações são `polling` via `revalidate`/`refresh`)
- **Migrations:** `schema.sql` + `schema_v2`..`v15` + `fix_ativos_cols.sql`, `fix_rls_permissive.sql` (ver `MIGRATIONS_INVENTORY.md`)

---

## 4. Migrations — Ordem de Aplicação

```bash
# Supabase Dashboard → SQL Editor → New query → Run
schema.sql
schema_v2.sql
schema_v4.sql
schema_v5.sql
schema_v6.sql
schema_v7.sql
schema_v8.sql
schema_v9.sql
schema_v10.sql
schema_v11.sql
schema_v12.sql
schema_v13.sql
schema_v14.sql
schema_v15.sql
scripts/fix_ativos_cols.sql
scripts/fix_rls_permissive.sql
```

Todas `if not exists` / `on conflict do nothing` / `or replace` → re-executáveis. `schema_v4` faz `backfill organization_id` + `raise exception se órfão`.

---

## 5. Build / Testes

```bash
npm run lint          # eslint (0)
npx tsc --noEmit      # 0
npm run build         # next build (0)
npm test              # vitest run (102 tests)
npm run test:isolation # vitest run tests/rls-isolation.test.ts (19)
```

**Vitest config:** `fileParallelism: false`, `pool: forks`, `sequence concurrent: false`, `testTimeout: 30000`, `hookTimeout: 30000` (para `auth.users` eventual consistency).

**Testes:** `51` analytics + `19` RLS + `16` mapa + `16` busca/notificações = `102`.

---

## 6. Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| `ERESOLVE @types/node` no Vercel | `vitest@5` peer `^22\|>=24` com `@types/node@20` | `bump @types/node to ^24` |
| `profiles_id_fkey` em testes | `auth.users` eventual consistency | `await setTimeout 800` + retry + `uniqueEmail` com `randomUUID` |
| `auditoria_logs_acao_check` com `OS_CREATED` | `v8` sem `TRIAGEM`/`OS_CREATED` | `fix_ativos_cols.sql` com lista canônica 33 |
| `relrowsecurity false` mas RLS bypass | `sga_acesso_total_*` permissive `true` | `fix_rls_permissive.sql` drop |
| `NEXT_PUBLIC_SUPABASE_URL` undefined em testes | `.env.test` não carregado | `config({ path: ".env.test" })` em `tests/setup.ts` |

---

## 7. Procedimentos de Atualização

1. `git pull origin master`
2. `npm install`
3. Aplicar novas `schema_v*.sql` via Supabase SQL Editor na ordem
4. `npm run lint && npx tsc --noEmit && npm run build`
5. `npx vitest run`
6. `vercel --prod` ou push para `master` (Vercel auto-deploy)

---

## 8. Backup e Restore

- **Supabase:** Dashboard → Database → Backups (PITR) ou `pg_dump` via `supabase db dump`.
- **Storage:** `manutencao-midia` com `o/{orgId}/...` — backup via `supabase storage` ou `aws s3 sync` se usar S3 compatível.

---

## 9. Monitoramento

- **Vercel:** Analytics + Speed Insights + Logs (`vercel logs`)
- **Supabase:** Dashboard → Reports → Query Performance (`pg_stat_statements`), `EXPLAIN ANALYZE` para `dashboard` (18 queries) e `mapa` (4 queries).
- **Sentry:** não configurado (recomendado para BLOCO F).

---

## 10. Domínio e Proxy

- **Proxy:** `src/proxy.ts` com `matcher: /((?!_next/static|...).*)`, `createServerClient` + refresh de cookies.
- **Domínio:** Vercel `compac.vercel.app` (ou custom via `vercel.json`).
