# SGA-M 2.0 — RELEASE RUNBOOK

**Versão:** 2.0.1 — PRODUCTION | **Data:** 2026-09-11 | **Commit:** `cdf6aac` | **Tag:** `v2.0.1` | **Database:** `v22` | **Production URL:** `https://compac-xi.vercel.app/`

## 1. Backup
- `node scripts/backup_inventario.js > backup_$(date +%F).txt`
- Supabase Dashboard → Database → Backups (PITR) ou `pg_dump --db-url`

## 2. Manutenção
- Vercel: `vercel.json` cron `0 6 * * *` permanece, mas não gera preventivas durante reset (sem `planos_manutencao` com `proxima_execucao` <= hoje)
- App: `/admin/monitoramento` deve mostrar `Manutenção` se necessário

## 3. Migrations — PRODUÇÃO (aplicadas 2026-09-11)
```bash
# Ordem idempotente — aplicadas em ialjfeltqpbgrxtymfwa.supabase.co via SQL Editor
psql $PROD_DB_URL -f schema_v19.sql # bio, preferencias — PASS
psql $PROD_DB_URL -f schema_v20.sql # reports_to + trigger — PASS
psql $PROD_DB_URL -f schema_v21.sql # performance_evaluations + is_subordinado — PASS
psql $PROD_DB_URL -f schema_v22.sql # conversas + participantes + mensagens — PASS
```
Verificado `scripts/verify_v19_22.js` `8/8 PASS` + `pg_policies` 7 + `triggers` 10

## 4. Validação
- `npx vitest run` 202/202
- `npm run lint` 0/23, `npx tsc --noEmit` 0, `npm run build` 0
- Cross-tenant: `tests/rls-isolation` 19 + `hierarchy` 3 + `messages` 4 + `integration-role-workflows` 7
- Field visibility: `role-access` 13 + `role-experience` 8 + `role-dashboards` 8
- Storage: `manutencao-midia` PRIVATE, 3 `midia_*`, `o/{org}/profiles/...` signed URL
- Mensagens: DB `conversas` fonte oficial após v22, fallback `o/{org}/mensagens/` documentado para remoção

## 5. Smoke
- Login `admin@sgam.producao` → `Meu Perfil` → `Organograma` → `Mensagens` → `Desempenho`
- Criar `ativo` → `chamado` → `triagem` → `O.S.` → `solicitar material` → `pedido` → `recebimento` → `estoque` → `desempenho` → `mensagem` (ver `scripts/smoke_producao.js`)

## 6. Rollback
- Se migration falhar: `DROP TABLE IF EXISTS performance_evaluations, conversas CASCADE` + `ALTER TABLE profiles DROP COLUMN IF EXISTS bio, preferencias` + `ALTER TABLE memberships DROP COLUMN IF EXISTS reports_to_membership_id`
- Se app quebrar: `git checkout d1b9c4a` (produção) + `vercel --prod`
- Se dados: restaurar PITR

## 7. Monitoramento
- `/admin/monitoramento` (Aplicação, Banco, Auth, Storage)
- Vercel Logs, Supabase Reports `pg_stat_statements`

## 8. Encerramento
- `PROJECT_STATUS.md` `SGA-M 2.0.1 — PRODUCTION` `https://compac-xi.vercel.app/` `cdf6aac` `v2.0.1` `v22`
- `v2.0.0` `dd0f2e4` preservada, `v2.0.1` `cdf6aac`
- Release freeze para desenvolvimento funcional
