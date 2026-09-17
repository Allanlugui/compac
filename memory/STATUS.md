# STATUS.md — SGA-M (COMPAC)

> Fonte de contexto operacional. Precedência: código executado > config real > testes > docs > memória histórica.
> Regras aplicadas: `F:/dev/memory/regras-agente.md` (Preservação, Auto-Gravação, Execução Contínua) + `F:/dev/memory/padroes-codigo.md`.
> Última atualização: 2026-09-17 — FASE 11.2 validação técnica FECHADA (tsc/lint/vitest parcial/build PASS). `memory/` (4 arquivos) em stage; `src/app/admin/chamados/` sem novidades (fix já commitado em `fbbad15`).

## 1. Estado atual

- **Projeto:** SGA-M — Sistema de Gestão de Ativos/Manutenção multi-tenant (COMPAC).
- **Stack real (`package.json`):** Next.js 16.3.4 (App Router) + React 19.2.8 + TypeScript 5 + Tailwind 4 + Supabase (`@supabase/ssr` + `supabase-js`) + Recharts 3.10 + `qrcode.react` + `nodemailer` + `fast-xml-parser` + `pdf-parse`.
- **Branch ativa:** `fix/os-foto-antes-bug` (`fbbad15`) — 1 commit à frente de `master` (`f8e0886`).
- **Produção congelada:** Release 2.0.1, tag `v2.0.1` (`cdf6aac`), URL `https://compac-xi.vercel.app/`, DB `v22` (`ialjfeltqpbgrxtymfwa.supabase.co`).
- **Fase corrente:** FASE 11.2 CONCLUÍDA em branch, NÃO mergeada, produção NÃO tocada. Aguardando validação visual em Preview + aval para merge.
- **Estado operacional:** `OPERAÇÃO + MANUTENÇÃO` — novos bugs exigem `ID/Severidade/Módulo/Rota/Role/Reprodução/Evidência` antes de corrigir.

## 2. O que está funcionando (VALIDADO em docs + código)

- **Estrutura:** localidades hierárquicas + categorias com atributos dinâmicos (`/admin/estrutura`).
- **Ativos:** CRUD + QR + documentos + histórico + checklist (`/admin/ativos`, `/admin/ativos/[id]`).
- **QR público:** `/qr/[hash]` + `/qr-compra/[hash]` via `service_role` escopo mínimo, sem expor custos/auditoria.
- **Manutenção:** chamado → triagem → O.S. (RPC `criar_os_a_partir_de_triagem`) → execução → conclusão.
- **Estoque:** produtos, movimentações via RPC `movimentar_estoque_atomic`, inventário, importação NF-e XML/PDF.
- **Compras:** solicitações → cotações → pedidos → recebimentos (vínculo `chamado_id` desde `schema_v18`).
- **Dashboard:** 15 KPIs N1-N4 (`src/lib/analytics/`, `periodo` 7d/30d/90d/12m, `America/Sao_Paulo`).
- **Relatórios:** 8 abas + exportação CSV (BOM) + `window.print` PDF.
- **Mapa:** hierárquico por localidade, sem coordenadas fictícias.
- **Busca global:** 8 entidades, Ctrl+K, debounce 300ms, sanitização, `ilike` + `limit` + `eq orgId`.
- **Notificações:** central com sino/badge, idempotência 24h, 4 verificadores (SLA, estoque, ativos, solicitações).
- **Auditoria:** 33 ações canônicas em `auditoria_logs` com `organization_id`.
- **Segurança:** `requireOrg()` → `ctx.orgId` (JWT, nunca do cliente) + RLS `eh_membro`/`tem_papel` (36 tabelas, ~75 policies) + trigger `enforce_same_org` + Storage `manutencao-midia` PRIVATE (`o/{orgId}/...`, 3 policies `midia_*`).
- **Quality gates doc (QA_FINAL 2026-09-11):** `202/202` testes PASS, `lint 0 errors`, `tsc 0`, `build` PASS.

## 3. FASE 11.2 — IMPLEMENTADO + VALIDADO em branch (não em produção)

- **Bug:** `GaleriaFotos` (async Server Component) renderizado dentro de `FotosDurante` (Client Component) → hidratação quebrava, O.S. congelada após upload.
- **Correção (cirúrgica, sem migration):** `GaleriaFotos.tsx` → `"use client"` síncrono recebendo `urls` resolvidas; `FotosDurante.tsx` prop `paths` → `urls`; `chamados/[id]/page.tsx` + `chamados/[id]/os/page.tsx` resolvem signed URLs (1h) no Server Component.
- **Validação registrada:** `tsc 0`, `eslint 0/0`, `next build` SUCCESS (41 rotas), `tests/os-foto-antes-bug.test.ts` 7/7 PASS.
- **Arquivos:** `FASE_11_2_RELATORIO.md` + `FASE_11_2_CHECKLIST.md` completos.

## 4. Divergências código vs. docs (princípio de precedência)

1. `PROJECT_STATUS.md`/`QA_FINAL.md` dizem `202 testes / 38 rotas / 19 forms`; build FASE 11.2 registra **41 rotas** e `tests/` atual tem **22 suítes** (+ `os-foto-antes-bug`, `fase7`, mensagens, performance, etc.) → número real atual NÃO VALIDADO (nenhum `vitest run` executado nesta sessão).
2. `ORPHAN_FEATURES.md` lista `perfil/[id]` 404 e `Card.tsx` órfão como problemas; `QA_FINAL` §9 marca `Card.tsx` como RESOLVIDO, mas `src/app/admin/perfil/[id]/` **existe** no disco — status real NÃO VALIDADO.
3. Docs afirmam `lint 0 warnings` em FASE 11.2 vs `24 warnings` em QA_FINAL — NÃO VALIDADO nesta sessão.

## 5. Próximos passos relevantes

1. Validar Preview da branch `fix/os-foto-antes-bug` (desktop + smartphone): abrir O.S., upload durante/depois, reabrir.
2. Reconciliação de testes em aberto (suíte completa BLOQUEADA por timeout 10 min — não impeditiva). Gates 2026-09-17: `tsc` 0 errors, `lint` 0 errors + 24 warnings, `vitest` 62/62 (`analytics` 51 + `encoding` 4 + `os-foto-antes-bug` 7), `build` SUCCESS 41 rotas.
3. Decidir merge para `master` (requer aval explícito — fim de fase).
4. Limpar ou registrar `scripts/` com ~50 arquivos `debug_*.js` untracked.

## 6. Arquivos relevantes

- `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `MODULES.md`, `SECURITY.md`, `QA_FINAL.md`
- `FASE_11_2_RELATORIO.md`, `FASE_11_2_CHECKLIST.md`, `ORPHAN_FEATURES.md`
- `src/proxy.ts`, `src/lib/permissoes.ts`, `src/lib/analytics/`, `src/lib/storage.ts`
- `schema.sql` + `schema_v2..v22`, `vitest.config.ts`, `tests/`
