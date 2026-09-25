# STATUS.md — SGA-M (COMPAC)

> Fonte de contexto operacional. Precedência: código executado > config real > testes > docs > memória histórica.
> Regras aplicadas: `F:/dev/memory/regras-agente.md` (Preservação, Auto-Gravação, Execução Contínua) + `F:/dev/memory/padroes-codigo.md`.
> Última atualização: 2026-09-24 — FASE 1 BLOCO 3 concluído e PARADO p/ validação (4 entradas + chat + ticket real, 16 testes verdes, gates PASS, v27 NÃO aplicada, sem commit, sem BLOCO 4). Produção congelada.

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

## 3. BLOCO 4 — QR compras relacional (IMPLEMENTADO 2026-09-17, migration pendente)

- **Tabelas (schema_v26.sql, não aplicado):** `qr_contextos` + `solicitacoes_compra` com FKs (localidade/departamento/CC/almox) + `qr_contexto_id` na solicitação. Textos legados viram snapshot. Trigger novo `trg_org_qr_contextos`; blocos novos pegam carona em `trg_org_solic_chamado`.
- **Telas:** `/admin/qr-compras` com selects (localidade/depto/CC/almox) e fallback texto pré-v23/v24; lista resolve nomes; fluxo público copia vínculos + centro para a solicitação (com recuo legado pré-v26).
- **Permissões:** 3 actions com `compras.criar` efetiva (Bloco 3, global).
- **Gates:** `tsc` 0, `lint` 0 errors + 24 warnings pré-existentes, `build` SUCCESS 42 rotas.

## 4. BLOCO 3 — Permissões customizáveis (IMPLEMENTADO 2026-09-17, migration pendente)

- **Tabela (schema_v25.sql, não aplicado):** `permissoes_custom` (user + permissão + `conceder`/`negar` + escopo global/localidade/almoxarifado). RLS escrita só ADMIN; trigger valida membro ativo + escopo mesma org. Sem linhas = 100% comportamento atual.
- **Efetiva:** `temPermissaoEfetiva` pura (negar global vence tudo; negar escopado vence no escopo; conceder adiciona) + `exigirPermissaoEfetiva` servidor. Módulo dividido client-safe/server (Turbopack não aceita `next/headers` no bundle client).
- **Aplicado em:** 9 actions estoque (escopo almox; transferência exige origem+destino) + 9 actions cadastros (escopo localidade). Demais módulos seguem por perfil (rollout gradual).
- **Editor:** `/admin/usuarios` → expansível por membro (chips existentes + form por módulo). `usuarios.administrar` fora do modelo.
- **Gates:** `tsc` 0, `lint` 0 errors + 24 warnings pré-existentes, `build` SUCCESS 42 rotas.

## 4. BLOCO 2 — Almoxarifados + estoque dual (IMPLEMENTADO 2026-09-17, migration pendente)

- **Tabelas (schema_v24.sql, não aplicado):** `almoxarifados` (nome unique/org, código, `localidade_id` SET NULL, ativo) + `produtos.almoxarifado_id` + `movimentacoes_estoque.almoxarifado_id` (nullable = legado). RLS `eh_membro` + write ADMIN/GESTOR; `enforce_same_org` estendido; triggers `trg_org_almoxarifados` + `trg_org_produtos` (novo; `trg_org_mov` existente cobre movs).
- **RPC:** `movimentar_estoque_atomic` ganha `p_almoxarifado`/`p_almoxarifado_destino` DEFAULT NULL (DROP+CREATE corpo idêntico); par transferência carrega origem na saída e destino na entrada. Chamadas 9 args (testes) seguem válidas.
- **Telas:** aba "Almoxarifados" em `/admin/cadastros`; `/admin/estoque` com seletor Visão Unificada/Segmentada, stats do segmento, vínculo no produto/movimentação/transferência (selects quando há almox, texto legado senão).
- **Compatibilidade:** saldo global segue em `estoque_atual`; shim PGRST202 recua ao legado pré-v24; colunas omitidas quando null. Zero breaking change.
- **Gates:** `tsc` 0, `lint` 0 errors + 24 warnings pré-existentes, `build` SUCCESS 42 rotas.

## 4. BLOCO 1 — Cadastros mestres (IMPLEMENTADO 2026-09-17, migration pendente)

- **Tabelas (schema_v23.sql, não aplicado):** `departamentos_setores` (nome unique/org, sigla, `localidade_id` SET NULL, ativo) + `centros_custo` (código unique/org, nome, `departamento_id`/`localidade_id` SET NULL, ativo). RLS `eh_membro` + write ADMIN/GESTOR; `enforce_same_org` estendido (3 blocos).
- **Telas:** `/admin/cadastros` (Server + `CadastrosManager` abas Departamentos | Centros, CRUD completo, selects de localidade/departamento, bloqueio de exclusão com vínculo). Item "Cadastros" no sidebar Administração (ADMIN/GESTOR). Permissões reutilizadas `estrutura.ver/escrever`.
- **Compatibilidade:** colunas texto legadas (`centro_custo`, `departamento`, `setor`) intactas — zero breaking change.
- **Gates:** `tsc` 0, `lint` 0 errors + 24 warnings pré-existentes, `build` SUCCESS 42 rotas.

## 4. FASE 11.2 — IMPLEMENTADO + VALIDADO em branch (não em produção)

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
