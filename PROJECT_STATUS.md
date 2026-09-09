# SGA-M — PROJECT STATUS

**Data:** 2026-09-07 (FASE 8)
**Branch:** `master` (`0238929` + FASE 7/7.1/7.2 + FASE 8 cron fix)

---

## BLOCO A ✅ CONCLUÍDO / APROVADO
- `ANALYTICS_SPEC.md` (15 KPIs, 13 implementáveis, 2 condicionais)
- `ANALYTICS_DATA_MAP.md` (10 entidades, 30+ tabelas)
- `src/lib/analytics/` (`types.ts`, `calculations.ts`, `queries.ts`, `index.ts`)
- `tests/analytics.test.ts` (51 testes)

## BLOCO B ✅ CONCLUÍDO / APROVADO
- `src/app/admin/dashboard/page.tsx` (N1-N4, 15 KPIs, `periodo` 7d/30d/90d/12m, `America/Sao_Paulo`, `fileParallelism: false`)
- `src/lib/analytics/queries.ts` (18 queries)
- 51 analytics tests preservados

## BLOCO C ✅ CONCLUÍDO / APROVADO
- `src/app/admin/relatorios/page.tsx` (8 abas: executivo, ativos, manutenção, SLA, custos, estoque, solicitações, top)
- `src/app/admin/relatorios/ExportButtons.tsx` (CSV + `window.print` PDF)
- `REPORTS_SPEC.md` (13 seções)
- 51+19 tests preservados

## BLOCO D ✅ CONCLUÍDO / APROVADO
- `src/app/admin/mapa/page.tsx` + `MapaClient.tsx` (hierárquico, sem coordenadas fictícias)
- `MAP_SPEC.md` (19 seções)
- `tests/mapa.test.ts` (16 testes)

## BLOCO E ✅ CONCLUÍDO / APROVADO
- `src/app/admin/_actions/busca.ts` (8 entidades, 10 por categoria, sanitização, `ilike`, `limit`, `eq orgId`)
- `src/app/admin/_components/BuscaGlobal.tsx` (Ctrl+K, debounce 300ms, agrupado, `BuscaGlobal` + `SinoLink` no header)
- `src/app/admin/busca/page.tsx` (rota dedicada, agrupado, estados)
- `src/lib/notificacoes.ts` (geração idempotente 24h, 4 verificadores: SLA, estoque, ativos, solicitações)
- `src/app/admin/notificacoes/page.tsx` + `actions.ts` (existentes, com `requireOrg` + RLS)
- `SEARCH_NOTIFICATIONS_SPEC.md`
- `tests/busca.test.ts` (8), `tests/notificacoes.test.ts` (8) — total 102 (51+19+16+16)

## FASE FINAL ✅ CONCLUÍDA
- **Auditoria:** 37 rotas (35 page + 2 route), 15 actions, 36 tabelas com RLS, 75 policies, service_role escopo mínimo
- **Correções mínimas FASE 8:**
  - `fix_rls_permissive.sql` (drop `sga_acesso_total_*`)
  - `vercel.json` cron `0 6 * * *` + `src/app/api/cron/preventivas/route.ts` fix service_role fallback + CRON_SECRET
  - `schema_v18.sql` `chamado_id` + `enforce_same_org` + RESTRICT
  - `RELEASE_NOTES.md` v1.0.0 + `MIGRATIONS_INVENTORY.md` v16-18
  - `vitest.config.ts` `fileParallelism: false` + `tests/setup.ts` JWT correto
  - `tests/workflows.test.ts` 5 E2E + `tests/encoding.test.ts` 4
- **Quality gates:** `lint 0`, `tsc 0`, `build 0`, `135/135` tests PASS
- **Segurança:** `requireOrg` em 26/26 `/admin/*` pages (via layout), RLS `eh_membro` + `tem_papel`, `enforce_same_org` em 14 tabelas, cron service_role, storage `o/{orgId}/...`

---

## Funcionalidades

- **Estrutura:** localidades hierárquicas + categorias com atributos dinâmicos
- **Ativos:** CRUD + QR + documentos + histórico + checklist
- **QR:** público (`qr/[hash]`) + compra (`qr-compra/[hash]`) com `service_role` escopo mínimo
- **Manutenção:** chamado → triagem → O.S. (via `criar_os_a_partir_de_triagem` RPC) → execução → conclusão
- **Estoque:** produtos, movimentações (entrada/saída/reserva/consumo/devolução/transferência via `movimentar_estoque_atomic`), inventário, importação NF-e (XML/PDF)
- **Compras:** solicitações → cotações → pedidos → recebimentos
- **Fornecedores:** cadastro
- **Dashboard:** 15 KPIs N1-N4 com `src/lib/analytics`
- **Relatórios:** 8 abas com exportação CSV/PDF
- **Mapa:** hierárquico por localidade, sem coordenadas fictícias
- **Busca:** global 8 entidades, agrupada, debounce, RLS
- **Notificações:** central com sino, badge, idempotência 24h, 4 eventos
- **Auditoria:** 33 ações canônicas, `auditoria_logs` com `organization_id`

---

## Arquitetura

- **Next.js 16.3.4** App Router (RSC + Server Actions) + **React 19.2.8**
- **Supabase** Postgres + Auth + Storage + RLS
- **Tailwind 4** + **Recharts 3.10** + **TypeScript 5**
- **Proxy** `src/proxy.ts` com `createServerClient` + refresh

---

## Segurança

- **Tenant:** `requireOrg` → `ctx.orgId` (JWT) + `eq organization_id` + `enforce_same_org` trigger + RLS `eh_membro`
- **RLS:** 36 tabelas, policies por role, `audit_select` `((org IS NOT NULL AND eh_membro) OR (org IS NULL AND tabela='sessao'))` — 11 sessao legítimo, 1 memberships anômalo não exposto
- **Permissões:** 58 em `src/lib/permissoes.ts`, `exigirPermissao` em 15 actions, `pode` para UI
- **Storage:** `manutencao-midia` **PRIVATE** (`public=false` verificado 2026-09-09), `o/{orgId}/...` server-side, 3 policies tenant-aware `midia_legado_leitura`, `midia_org_leitura`, `midia_org_escrita` (authenticated + foldername[2]=orgId + eh_membro), 4 públicas `sga_midia_*` removidas via `scripts/hardening_storage_audit.sql`

---

## Testes

```
51 Analytics
19 RLS isolation
16 Mapa
8 Busca
8 Notificações
12 Hardening H1-H4
5 Workflows E2E (FASE 8)
4 Encoding
8 Hardening Storage/Auditoria (GATE FINAL)
---
135 Total (10 suítes) — 135/135 PASS
```

`vitest` com `fileParallelism: false`, `pool: forks`, `sequence concurrent: false`, `testTimeout: 60000`.

---

## Limitações (Aceitável)

- XLSX não implementado (CSV cobre)
- Mapa geográfico sem coordenadas (hierárquico apenas)
- Full-text search não implementado (ilike + limit)
- WebSocket não implementado (polling via revalidate)
- Filtros avançados Unidade/Bloco/Categoria/Técnico não no header de relatórios (só período/aba)
- Cache não implementado (chave documentada)

---

## FASE 8 ✅ HOMOLOGAÇÃO FINAL + HARDENING

- **Snapshot:** `dcbb45e`, Node 24.13, npm 11.6, Next 16.3.4, React 19.2.8, Supabase 2.115, `@supabase/ssr` 0.12.6
- **Ambiente:** Vercel (vercel.json cron), Supabase homologação `ialjfeltqpbgrxtymfwa` (verificado 2026-09-09), Auth + Storage `manutencao-midia` PRIVATE, RLS 36 tabelas, 75 policies → 3 storage tenant-aware
- **Migration v18:** APLICADA (verificado `chamado_id`, FK, índice `solicitacoes_chamado_idx`, trigger `trg_org_solic_chamado`, `chamados_ativo_fk RESTRICT`)
- **Cron:** `0 6 * * *` ativo (fix service_role fallback + CRON_SECRET check)
- **Fluxo principal:** PASS (workflows.test.ts 5/5: E2E completo, parcial, duplicidade, cross-tenant, preventiva idempotente)
- **Encoding:** PASS (0 mojibake, 4 testes, CSV BOM, dashboard fix 0238929)
- **Hardening:** PASS (bucket PRIVATE, 3 policies midia_*, cross-tenant list/delete/upload bloqueado, signed URL 3600s isolada, auditoria 11 sessao +1 anômalo, 135/135)
- **Pontas soltas:** 0 crítico/alto/médio, 1 baixo (Card.tsx órfão aceitável)

## Próximos Passos Operacionais

- Homologação com PO (fluxo sem copiar IDs, todos links navegáveis)
- Treinamento por role (ADMIN/GESTOR/TECNICO/COMPRAS/AUDITOR/SOLICITANTE)
- Backup Supabase PITR + Storage
- Monitoramento Vercel + Supabase `EXPLAIN ANALYZE` para 1k+
- Backlog: storage `public:false` + remover `sga_midia_*` públicas, `checklist_itens`/`notificacoes` `tem_papel`, `xlsx`, `full-text`, `WebSocket`
