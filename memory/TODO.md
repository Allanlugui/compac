# TODO.md — SGA-M (COMPAC)

> Atualizado: 2026-09-24 — FASE 1 BLOCO 1 concluído (branch `refactor/sgam-rearquitetura-cliente`, PARADO p/ validação).
> Regra: não manter como pendente o que já foi concluído; marcar estado real (PLANEJADO / IMPLEMENTADO / VALIDADO / BLOQUEADO / NÃO VALIDADO).

## C. FASE 1 — Rearquitetura funcional (branch `refactor/sgam-rearquitetura-cliente`, base `a9cb2bc`, `D-RESET-CLIENTE-02`)

- [x] BLOCO 1 JA VALIDADO (navegação + hub; E2E 17/17) — aguardando validação formal p/ commit
- [x] BLOCO 2 IMPLEMENTADO: `src/lib/intake/` (types+slots+engine+mapeamento, 100% puro, sem DB/IA/UI) + `tests/intake-engine.test.ts` 7/7
- [x] BLOCO 2 VALIDADO: `tsc` 0; `lint` 0+24; `build` SUCCESS; auditoria fluxo atual registrada (reuso vs substituição)
- [ ] PARADO: aguardar validação dos BLOCOS 1–2 antes do BLOCO 3 (QR/link contextual). NÃO commitar sem ordem.

## B. FASE A — Fundação (branch `refactor/fundacao-arquitetura`)

- [x] ETAPA 1 VALIDADO: `origin/master` = `efa6df6` (PR #1, FASE 11.2 mergeada — divergência da memória corrigida); live com v23→v26 + dados; 21 suítes; produção NÃO VALIDADA (sem acesso Vercel)
- [x] ETAPA 2 IMPLEMENTADO+VALIDADO: dedup broadcast corrigido (`existeNaJanela` + `.is()`) + `revalidatePath` em marcar lida/todas + `tests/notificacoes-dedup.test.ts` 4/4 PASS
- [x] ETAPA 3 IMPLEMENTADO: `lib/email-pipeline.ts` (evento→template→provider→recibo) + convite migra para pipeline (mesmo texto) + SMTP no `.env.homolog.example` + `tests/email-pipeline.test.ts` 3/3
- [x] ETAPA 4 IMPLEMENTADO: `/admin/configuracoes` hub (ADMIN, só links reais) + item no sidebar
- [x] ETAPA 5 AUDITADO: visibilidade = tudo-ou-nada por página (`pode()` + server); custos visíveis a qualquer `estoque.ver`; escopo de registro = org (exceto overlay Bloco 3); gestão segue em `/admin/usuarios`, linkada do hub
- [x] ETAPA 6 IMPLEMENTADO: link Usuários → `/admin/usuarios` dentro de Cadastros (sem duplicar entidade, sem remover rota)
- [x] ETAPA 9 GATE FINAL 2026-09-24: suíte completa em 5 blocos — 23 arquivos, 216/216 PASS (58+36+27+41+54), 0 fail, 0 skipped; `tsc` 0; `lint` 0+24; `build` 43 rotas (`/admin/configuracoes` inclusa); push `refactor/fundacao-arquitetura` p/ Preview (sem produção)
- [x] DEPLOY Preview 2026-09-24: Vercel SUCCESS no commit `a1eac3c` (confirmado pelo usuário — deploy saudável, NÃO equivale a funcional); ancestry validada (2 à frente/1 atrás de `origin/master`, ancestral `fbbad15` — merge PR #1, não é problema)
- [x] E2E AUTOMATIZADO 2026-09-24 (Playwright headless, dev local, org temporária limpa após): 15/15 PASS — login, sino 1x, marcar lida atualiza+persistente, 37 links config sem 404, anon bloqueado, cadastros→usuários, convite erro+sucesso, estoque criar+consultar, zero secrets no browser; screenshots em temp (3ª execução verde; 2 falhas transitórias/artefato documentadas)
- [x] COMMIT+ PUSH FASE A 2026-09-24 (autorização explícita): `feat(FASE A): ...` em `refactor/fundacao-arquitetura` → origin; sem merge/PR/deploy; FASE B bloqueada
- [ ] PLANEJADO: validação manual no Preview da FASE A (6 fluxos); FASE B só com nova autorização

## A. NOVO ROADMAP — Rearquitetura V2 (nada implementado)
- [ ] PLANEJADO: Fase A — auditoria runtime notificações + `config_sistema`/`email_templates` + Permissões→Configurações + Cadastros>Usuários
- [ ] PLANEJADO: Fase B — Intake Engine + `/atendimento` + portal + thread + participantes + e-mails
- [ ] PLANEJADO: Fase C — compra conversacional + QR como link de atendimento
- [ ] PLANEJADO: Fase D — nova navegação + despublicar mensagens/organograma/busca-rota (código preservado)
- [ ] PLANEJADO: Fase E — estoque avançado + `/m/*` + modos operacionais
- [ ] PLANEJADO: Fase F — LLM opcional + endurecimento + QA + Preview + aprovação + produção
- [ ] DECISÃO PENDENTE: criar branch `refactor/rearquitetura-sgam` a partir de master (requer aval; working tree tem `M memory/*` + untracked — não apagar)
- [ ] DECISÃO PENDENTE: `setores`/`equipes` como tabelas, `ti.administrar`, reuso `conversas` vs `chamado_mensagens`, provider e-mail, realtime (ver R1–R8 em `REARQUITETURA-V2.md`)

## -3. BLOCO 4 — QR compras relacional (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v26.sql` — `qr_contextos` + `solicitacoes_compra` com FKs (localidade/depto/CC/almox) + `qr_contexto_id` + `enforce_same_org` estendido + `trg_org_qr_contextos`, idempotente
- [x] IMPLEMENTADO: tipos (`QrContexto` + IDs, `SolicitacaoCompleta` + IDs) + `criarContexto` com seletores (snapshot textual derivado) + permissão efetiva `compras.criar` nas 3 actions
- [x] IMPLEMENTADO: `/admin/qr-compras` com selects relacionais (fallback texto pré-v23/v24) + lista exibe vínculos resolvidos + fluxo público copia IDs + `qr_contexto_id` + `centro_custo` (com recuo legado pré-v26)
- [x] IMPLEMENTADO: linha v26 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes); `build` SUCCESS 42 rotas íntegras
- [x] APLICADO 2026-09-17: `schema_v23.sql` → `v24` → `v25` → `v26` no Supabase (usuário) + probe confirma tabelas/colunas/RPC
- [ ] [ARQUIVADO — FEEDBACK DO CLIENTE] Preview + validação manual fim a fim do fluxo antigo (cadastros → almox → QR → solicitação → permissões) — fluxo de solicitação será conversacional
- [ ] [ARQUIVADO — FEEDBACK DO CLIENTE] Rollout gradual do overlay por módulo no modelo antigo (será redesenhado sob Configurações > Permissões)

## -2. BLOCO 3 — Permissões customizáveis (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v25.sql` — `permissoes_custom` (conceder/negar + escopo global/localidade/almoxarifado) + RLS escrita só ADMIN + `enforce_same_org` estendido (membro ativo + escopo mesma org), idempotente
- [x] IMPLEMENTADO: `src/lib/permissoes-custom.ts` (client-safe: catálogo, escopo, `temPermissaoEfetiva` pura) + `permissoes-custom-server.ts` (`exigirPermissaoEfetiva`) + tipos em `types.ts`
- [x] IMPLEMENTADO: overlay aplicado em estoque (9 actions, escopo almox; transferência exige origem+destino) e cadastros (9 actions, escopo localidade); `usuarios.administrar` fora do modelo (anti-escalada)
- [x] IMPLEMENTADO: `PermissoesEditor` em `/admin/usuarios` (listar/definir/remover por membro, chips + form por módulo) + linha v25 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes); `build` SUCCESS 42 rotas íntegras (após split client-safe/server do helper — Turbopack não aceita `next/headers` no bundle client)
- [x] APLICADO 2026-09-17: `schema_v23.sql` + `v24` + `v25` via SQL Editor (usuário) — ver P-ABERTO-05
- [ ] [ARQUIVADO — FEEDBACK DO CLIENTE] Preview + validação do fluxo antigo de permissões por módulo isolado (será Configurações > Permissões)
- [ ] PLANEJADO (rollout gradual): demais módulos (ativos, chamados, compras, etc.) ainda usam `exigirPermissao` por perfil — migrar por módulo nas próximas fases

## -1. BLOCO 2 — Almoxarifados + estoque dual (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v24.sql` — `almoxarifados` (FK `localidades`) + `produtos.almoxarifado_id` + `movimentacoes_estoque.almoxarifado_id` (nullable) + RPC com `p_almoxarifado`/`p_almoxarifado_destino` opcionais + RLS + `enforce_same_org` estendido, idempotente
- [x] IMPLEMENTADO: `src/lib/types.ts` — `Almoxarifado` + `almoxarifado_id` em `Produto`/`Movimentacao`
- [x] IMPLEMENTADO: aba "Almoxarifados" em `/admin/cadastros` (CRUD + vínculo localidade + bloqueio de exclusão com vínculo)
- [x] IMPLEMENTADO: `/admin/estoque` dual — filtro Visão Unificada (todos) / Segmentada (por almox), stats do segmento, vínculo no cadastro/edição/movimentação, transferência por selects, coluna Local exibe almox
- [x] IMPLEMENTADO: shim PGRST202 em `movimentarEstoque`/`transferirEstoque` (recuo legado pré-v24) + linha v24 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes, nenhum em arquivo novo); `build` SUCCESS 42 rotas íntegras
- [x] APLICADO 2026-09-17: `schema_v23.sql` + `schema_v24.sql` via SQL Editor (usuário) — ver P-ABERTO-05
- [ ] [ARQUIVADO — FEEDBACK DO CLIENTE] Preview + validação manual do modelo antigo de estoque dual isolado (será revisto na Fase E)

## 0. BLOCO 1 — Cadastros mestres (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v23.sql` — `departamentos_setores` + `centros_custo` (FK `localidades`), RLS, `enforce_same_org` estendido, idempotente
- [x] IMPLEMENTADO: `src/lib/types.ts` — `DepartamentoSetor` + `CentroCusto`
- [x] IMPLEMENTADO: `src/app/admin/cadastros/` (`actions.ts` CRUD + `page.tsx` + `CadastrosManager.tsx` abas) + item "Cadastros" no `SidebarNav` (ADMIN/GESTOR)
- [x] IMPLEMENTADO: linha v23 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes, nenhum em arquivo novo); `build` SUCCESS 42 rotas (41 + `/admin/cadastros`)
- [x] APLICADO 2026-09-17: `schema_v23.sql` via SQL Editor (usuário) — ver P-ABERTO-05
- [ ] [ARQUIVADO — FEEDBACK DO CLIENTE] Preview + validação manual do Cadastros isolado (será centro de dados mestres na Fase A)

## 1. Fase atual — FASE 11.2 (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO + VALIDADO (em branch): converter `GaleriaFotos` em Client Component síncrono — `tsc 0`, `eslint 0/0`, `build 41 rotas`, `os-foto-antes-bug 7/7`
- [x] IMPLEMENTADO: resolver signed URLs no Server Component (`chamados/[id]/page.tsx`, `os/page.tsx`)
- [x] IMPLEMENTADO: documentar em `FASE_11_2_RELATORIO.md` + `FASE_11_2_CHECKLIST.md`
- [x] VALIDADO 2026-09-17: `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors + 24 warnings (só `no-unused-vars`, nenhum em arquivos FASE 11.2)
- [x] VALIDADO 2026-09-17 (parcial, relevante): `analytics` 51/51 + `encoding` 4/4 + `os-foto-antes-bug` 7/7 (regressão FASE 11.2, contra Supabase live) — 62/62 PASS
- [x] VALIDADO 2026-09-17: `npm run build` → SUCCESS, 41 rotas (validado pelo usuário; consistente com FASE_11_2_CHECKLIST)
- [x] FECHADO 2026-09-17: tarefa de validação técnica da FASE 11.2 — gates `tsc`/`lint`/`vitest parcial`/`build` todos PASS
- [ ] BLOQUEADO (não impeditivo p/ merge): suíte completa `npx vitest run` (20 arquivos) excede 10 min — exige Supabase live + setup sequencial por arquivo (`fileParallelism:false`); rodar em janela longa ou por blocos
- [ ] PLANEJADO: deploy Preview + validação visual desktop/smartphone (abrir O.S., upload durante/depois, reabrir, navegação)
- [ ] PLANEJADO (requer aval): merge `fix/os-foto-antes-bug` → `master` + re-aplicar `fundacao-cadastro.test.ts` e `seletor-localidade.test.ts` (estavam em `fix/cadastro-estrutura`)
- [x] VALIDADO 2026-09-21: reconciliação por blocos contra Supabase live — 21 suítes, 209/209 PASS (A 62 + B 43 + C 51 + D 53); inventário real: 42 `page.tsx` + 2 `route.ts`, 17 `*Form.tsx` (+ inline ≈ 19 funcionais). Docs com 202/38/19 defasados (era QA 2026-09-11).

## 2. Backlog aceito (não bloqueador, docs oficiais)

- [ ] `unidades_medida` sem UI (seed sem uso) — MELHORIA
- [ ] XLSX não implementado (CSV com BOM cobre) — backlog
- [ ] Mapa geográfico sem coordenadas (hierárquico apenas, schema sem lat/lng)
- [ ] Full-text search (`ilike` + `limit` suficiente para <1k registros)
- [ ] WebSocket (polling via `revalidate` cobre)
- [ ] Filtros avançados Unidade/Bloco/Categoria/Técnico no header de relatórios (só período/aba)
- [ ] Cache (chave documentada, não necessário no volume atual)

## 3. Higiene técnica (identificado nesta inspeção)

- [ ] Triar `scripts/` — ~50 arquivos `debug_*.js`, `fix_mojibake*`, `quick_test.js` untracked (`git status`): decidir o que é diagnóstico descartável vs. ferramenta útil; não commitar debug solto
- [ ] Verificar `src/app/admin/perfil/[id]/` existe no disco vs. `ORPHAN_FEATURES.md` que marcava 404 — confirmar se foi RESOLVIDO na auditoria-360
- [ ] Sincronizar `src/lib/types.ts` com `schema.sql` (`organization_id` em `AuditoriaLog`, `TipoMovimentacao` com `transferencia`) — recomendação `SECURITY.md` §14
- [ ] Avaliar `chamados.ativo_id ON DELETE RESTRICT` (H2 aplicado em `schema_v16`) — confirmar aplicado em prod `v22`

## 4. Concluído (histórico preservado, não reabrir sem motivo)

- [x] VALIDADO: Blocos A–E (analytics, dashboard, relatórios, mapa, busca/notificações)
- [x] VALIDADO: FASE FINAL + FASE 7/8 (135 testes) + FASE 9.1–9.7 (roles, mensagens, integração → 182)
- [x] VALIDADO: FASE 10 auditoria-360 (202/202) + Release 2.0.1 + hardening H1–H6 (storage PRIVATE, RLS)
