# TODO.md — SGA-M (COMPAC)

> Atualizado: 2026-09-17 — BLOCO 4 implementado (migration v26 + QR relacional + gates PASS).
> Regra: não manter como pendente o que já foi concluído; marcar estado real (PLANEJADO / IMPLEMENTADO / VALIDADO / BLOQUEADO / NÃO VALIDADO).

## -3. BLOCO 4 — QR compras relacional (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v26.sql` — `qr_contextos` + `solicitacoes_compra` com FKs (localidade/depto/CC/almox) + `qr_contexto_id` + `enforce_same_org` estendido + `trg_org_qr_contextos`, idempotente
- [x] IMPLEMENTADO: tipos (`QrContexto` + IDs, `SolicitacaoCompleta` + IDs) + `criarContexto` com seletores (snapshot textual derivado) + permissão efetiva `compras.criar` nas 3 actions
- [x] IMPLEMENTADO: `/admin/qr-compras` com selects relacionais (fallback texto pré-v23/v24) + lista exibe vínculos resolvidos + fluxo público copia IDs + `qr_contexto_id` + `centro_custo` (com recuo legado pré-v26)
- [x] IMPLEMENTADO: linha v26 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes); `build` SUCCESS 42 rotas íntegras
- [x] APLICADO 2026-09-17: `schema_v23.sql` → `v24` → `v25` → `v26` no Supabase (usuário) + probe confirma tabelas/colunas/RPC
- [ ] PLANEJADO: Preview + validação manual fim a fim (cadastros → almox → QR → solicitação → permissões)

## -2. BLOCO 3 — Permissões customizáveis (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v25.sql` — `permissoes_custom` (conceder/negar + escopo global/localidade/almoxarifado) + RLS escrita só ADMIN + `enforce_same_org` estendido (membro ativo + escopo mesma org), idempotente
- [x] IMPLEMENTADO: `src/lib/permissoes-custom.ts` (client-safe: catálogo, escopo, `temPermissaoEfetiva` pura) + `permissoes-custom-server.ts` (`exigirPermissaoEfetiva`) + tipos em `types.ts`
- [x] IMPLEMENTADO: overlay aplicado em estoque (9 actions, escopo almox; transferência exige origem+destino) e cadastros (9 actions, escopo localidade); `usuarios.administrar` fora do modelo (anti-escalada)
- [x] IMPLEMENTADO: `PermissoesEditor` em `/admin/usuarios` (listar/definir/remover por membro, chips + form por módulo) + linha v25 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes); `build` SUCCESS 42 rotas íntegras (após split client-safe/server do helper — Turbopack não aceita `next/headers` no bundle client)
- [x] APLICADO 2026-09-17: `schema_v23.sql` + `v24` + `v25` via SQL Editor (usuário) — ver P-ABERTO-05
- [ ] PLANEJADO: Preview + validação manual (conceder estoque.movimentar a SOLICITANTE restrito a 1 almox → movimentar dentro/fora; negar global → bloqueio; remover → volta ao perfil)
- [ ] PLANEJADO (rollout gradual): demais módulos (ativos, chamados, compras, etc.) ainda usam `exigirPermissao` por perfil — migrar por módulo nas próximas fases

## -1. BLOCO 2 — Almoxarifados + estoque dual (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v24.sql` — `almoxarifados` (FK `localidades`) + `produtos.almoxarifado_id` + `movimentacoes_estoque.almoxarifado_id` (nullable) + RPC com `p_almoxarifado`/`p_almoxarifado_destino` opcionais + RLS + `enforce_same_org` estendido, idempotente
- [x] IMPLEMENTADO: `src/lib/types.ts` — `Almoxarifado` + `almoxarifado_id` em `Produto`/`Movimentacao`
- [x] IMPLEMENTADO: aba "Almoxarifados" em `/admin/cadastros` (CRUD + vínculo localidade + bloqueio de exclusão com vínculo)
- [x] IMPLEMENTADO: `/admin/estoque` dual — filtro Visão Unificada (todos) / Segmentada (por almox), stats do segmento, vínculo no cadastro/edição/movimentação, transferência por selects, coluna Local exibe almox
- [x] IMPLEMENTADO: shim PGRST202 em `movimentarEstoque`/`transferirEstoque` (recuo legado pré-v24) + linha v24 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes, nenhum em arquivo novo); `build` SUCCESS 42 rotas íntegras
- [x] APLICADO 2026-09-17: `schema_v23.sql` + `schema_v24.sql` via SQL Editor (usuário) — ver P-ABERTO-05
- [ ] PLANEJADO: Preview + validação manual (criar almox → vincular produto → movimentar segmentado → transferir entre almox → conferir par auditado)

## 0. BLOCO 1 — Cadastros mestres (branch `fix/os-foto-antes-bug`)

- [x] IMPLEMENTADO: `schema_v23.sql` — `departamentos_setores` + `centros_custo` (FK `localidades`), RLS, `enforce_same_org` estendido, idempotente
- [x] IMPLEMENTADO: `src/lib/types.ts` — `DepartamentoSetor` + `CentroCusto`
- [x] IMPLEMENTADO: `src/app/admin/cadastros/` (`actions.ts` CRUD + `page.tsx` + `CadastrosManager.tsx` abas) + item "Cadastros" no `SidebarNav` (ADMIN/GESTOR)
- [x] IMPLEMENTADO: linha v23 em `MIGRATIONS_INVENTORY.md`
- [x] VALIDADO 2026-09-17: `tsc` 0 errors; `lint` 0 errors + 24 warnings (pré-existentes, nenhum em arquivo novo); `build` SUCCESS 42 rotas (41 + `/admin/cadastros`)
- [x] APLICADO 2026-09-17: `schema_v23.sql` via SQL Editor (usuário) — ver P-ABERTO-05
- [ ] PLANEJADO: Preview + validação manual (criar depto → vincular localidade → criar CC → editar → excluir com vínculo bloqueado)

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
- [ ] PLANEJADO: reconciliar contagem de testes (docs dizem 202, disco tem 22 arquivos de teste) e rotas (38 vs 41)

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
