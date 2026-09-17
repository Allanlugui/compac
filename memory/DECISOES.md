# DECISOES.md — SGA-M (COMPAC)

> Registro cronológico, preservador (Antes → Motivo → Depois). Base: código + `ARCHITECTURE.md` + `SECURITY.md` + `QA_FINAL.md`.
> Atualizado: 2026-09-17 (inspeção).

## 1. Multi-tenancy via JWT server-side (base do sistema)

- **Decisão:** `requireOrg()` deriva `ctx.orgId` do JWT (`auth.getUser()` + `memberships` + cookie `sga_org`); nunca de query/body/hidden input.
- **Contexto:** SaaS multi-org com 6 roles; isolamento é requisito de segurança P0.
- **Alternativas:** passar `orgId` pelo cliente (rejeitado — forjável); schema por tenant (rejeitado — complexidade operacional).
- **Impacto:** padrão repetido em 26/26 pages `/admin/*` (via layout) + 15+ actions + `eq organization_id` em todas as queries; segunda barreira via RLS.
- **Ref:** `ARCHITECTURE.md` §5, `SECURITY.md` §3.

## 2. RLS `eh_membro` + `tem_papel` + trigger `enforce_same_org`

- **Decisão:** 36 tabelas com RLS; `SELECT` = `eh_membro`, writes = `eh_membro && tem_papel`; trigger `enforce_same_org()` (via `to_jsonb(NEW)`, fix `42703` no v13) bloqueia cross-tenant.
- **Contexto:** `sga_acesso_total_*` (`using true`) bypassava tudo — removido no v4 (`fix_rls_permissive.sql`).
- **Impacto:** 19 testes `rls-isolation` + cross-tenant em mapa/busca/workflows; `chamados.ativo_id` migrado CASCADE → RESTRICT (H2, `schema_v16`) para preservar histórico O.S.
- **Exceções conscientes:** `solic_insert_publico` endurecido para `WITH CHECK (false)` (H1, `schema_v16`) — QR público só via `service_role`; `checklist_respostas` sem `organization_id` com isolamento transitivo via `execucao_id` (H3); `audit_select` permite `(org IS NULL AND tabela='sessao')` para 11 logs legítimos (H4, `schema_v17`).
- **Ref:** `SECURITY.md` §§4/15, `QA_FINAL.md` §6.

## 3. `service_role` escopo mínimo, server-only

- **Decisão:** `createServiceClient()` só no servidor, em 8 pontos (QR público, Storage privado, `auth.admin` em usuários); sempre com `organization_id` derivado server-side (`qr_code_hash` → org).
- **Contexto:** anon não tem `SELECT` para `RETURNING` no QR; Storage privado sem policy de escrita anon.
- **Impacto:** QR não expõe custos/compras/auditoria; uploads usam path `o/{orgId}/...` server-side + signed URL 1h (`resolverFoto`).
- **Ref:** `SECURITY.md` §§5–7.

## 4. Analytics como camada pura + I/O separada

- **Decisão:** `src/lib/analytics/` com `calculations.ts` (funções puras) + `queries.ts` (I/O, `getPeriodoRangeBRT` com `America/Sao_Paulo` → UTC) + `types.ts`.
- **Contexto:** 15 KPIs (13 implementáveis, 2 condicionais `MTBF`/Disponibilidade → `insufficient_data` sem ≥3 falhas); `MTTR = abertura→conclusão` via trigger `concluido_em`.
- **Impacto:** 51 testes analytics preservados em todas as fases; dashboard e relatórios consomem a mesma camada.
- **Ref:** `ANALYTICS_SPEC.md`, `QA_FINAL.md` §8.

## 5. FASE 11.2 — GaleriaFotos Server→Client (2026-09, branch `fix/os-foto-antes-bug`)

- **Decisão:** `GaleriaFotos.tsx` deixou de ser `async` Server Component; virou `"use client"` síncrono recebendo `urls: string[]` já resolvidas; `FotosDurante.tsx` prop `paths` → `urls`; resolução (`resolverFoto`) movida para o Server Component pai.
- **Contexto:** Client Components não podem importar/renderizar Server Components async — causava hidratação quebrada e O.S. inacessível quando `podeExecutar=true`.
- **Alternativas:** `dynamic()`/suspense boundary (rejeitado — manter menor mudança segura); reescrever fluxo de upload (rejeitado — fora do escopo).
- **Impacto:** mudança só frontend, sem migration; `os_fotos` consultado separado da query principal (falha de foto não trava O.S.); órfão de Storage retorna `""` e é filtrado.
- **Ref:** `FASE_11_2_RELATORIO.md` §§4–9.

## 6. Storage privado + 3 policies tenant-aware (H6, 2026-09-09)

- **Decisão:** `storage.updateBucket(public=false)` + DROP das 4 policies `sga_midia_*` (anon/authenticated por `bucket_id` only, vazavam cross-tenant) via `scripts/hardening_storage_audit.sql`; restaram `midia_legado_leitura` + `midia_org_leitura/escrita` (`authenticated` + `foldername[2]=orgId` + `eh_membro`).
- **Contexto:** B listava/deletava dava upload em `o/A/` antes do fix.
- **Impacto:** 8/8 `hardening-storage-audit` PASS; `resolverFoto` com `createSignedUrl(path,3600)` + `orgIdEsperado` validado.
- **Ref:** `SECURITY.md` §15 (H6).

## 7. Convenções mantidas (padrões-código do ecossistema)

- TypeScript explícito, sem `any`; validação runtime manual (`norm()`, `Number()+isFinite`, sanitização `[%_,()"'\\;]` na busca) — `zod` avaliado, não adotado.
- App Router: pages `/admin/*` async Server Components + Client Components só com `"use client"` justificado (`MapaClient`, `BuscaGlobal`, `EstoqueClient`).
- Commits pequenos (`feat/fix/refactor/docs/test`); migrations idempotentes (`if not exists`/`or replace`); `vitest` com `fileParallelism:false` (evita `auth.users` eventual consistency).
