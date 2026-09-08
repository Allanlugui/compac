# SGA-M — PROJECT STATUS

**Data:** 2026-09-07
**Branch:** `master` (`2dbb7c6` → `bc0e43b` + BLOCO D/E + FASE FINAL)

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
- **Auditoria:** 34 rotas, 18 actions, 36 tabelas com RLS, 8 `service_role` usos (QR público + Storage/Admin)
- **Correções mínimas:**
  - `fix_rls_permissive.sql` (drop `sga_acesso_total_*` permissive `true`)
  - `fix_ativos_cols.sql` (add `tipo, marca, qr_hash, qr_code, horimetro` em `ativos`)
  - `vitest.config.ts` (`fileParallelism: false` para `auth.users` eventual consistency)
  - `tests/setup.ts` (JWT com `iss` + `ref`, `uniqueEmail` com `randomUUID`, retry com delay)
- **Documentação:** `ARCHITECTURE.md`, `DATA_MODEL.md`, `MODULES.md`, `SECURITY.md`, `OPERATIONS.md`, `QA_FINAL.md`, `PROJECT_STATUS.md` (este)
- **Quality gates:** `lint 0`, `tsc 0`, `build 0`, `102/102` tests PASS
- **Segurança:** `requireOrg` em 23/23 pages `/admin/*`, `organization_id` nunca do cliente, RLS `eh_membro` + `tem_papel`, `service_role` escopo mínimo, `storage` `o/{orgId}/...` server-side

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
- **RLS:** 36 tabelas, policies por role, `audit_select` com `org is null OR eh_membro` (legados)
- **Permissões:** 58 em `src/lib/permissoes.ts`, `exigirPermissao` em 15 actions, `pode` para UI
- **Storage:** `manutencao-midia` privado, `o/{orgId}/...` server-side, `midia_org_*` policies

---

## Testes

```
51 Analytics (src/lib/analytics/calculations)
19 RLS (cross-tenant, roles, RPC)
16 Mapa (hierarquia, filtros, busca, sem localização, drill-down, cross-tenant)
16 Busca/Notificações (busca 8, notificações 8)
---
102 Total
```

`vitest` com `fileParallelism: false`, `pool: forks`, `sequence concurrent: false`, `testTimeout: 30000`.

---

## Limitações (Aceitável)

- XLSX não implementado (CSV cobre)
- Mapa geográfico sem coordenadas (hierárquico apenas)
- Full-text search não implementado (ilike + limit)
- WebSocket não implementado (polling via revalidate)
- Filtros avançados Unidade/Bloco/Categoria/Técnico não no header de relatórios (só período/aba)
- Cache não implementado (chave documentada)

---

## Próximos Passos Operacionais

- Homologação com PO (fluxo completo: login → dashboard → ativos → QR → O.S. → estoque → relatórios → busca → notificações → mapa → auditoria)
- Treinamento de usuários por role
- Backup Supabase (PITR) + Storage (`o/{orgId}/...`)
- Monitoramento Vercel + Supabase Reports + `EXPLAIN ANALYZE` para dashboard com 1k+ registros
- Backlog futuro: `tem_papel` em `checklist_itens`/`notificacoes`, `CASCADE` → `RESTRICT` em `chamados.ativo_id`, `types.ts` sync, `xlsx` export, `full-text` search, `WebSocket` para notificações, `Vercel Cron` para `verificarSLA`/`verificarEstoqueCritico`
