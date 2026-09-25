# PROBLEMAS.md — SGA-M (COMPAC)

> Bugs, limitações, bloqueios, riscos, workarounds. Nunca apagar histórico — marcar RESOLVIDO e preservar contexto.
> Atualizado: 2026-09-24 — FASE 0 RESET (riscos R1–R8 + ausências registradas).

## 0. FASE 0 — Riscos e pendências do reset (NÃO VALIDADO onde indicado)

- **R1 — Notificações:** bugs relatados sem repro. HIPÓTESE técnica: dedup broadcast quebrado (`.eq("user_id", null)` nunca casa em Postgres) → duplicatas no sino. Auditar runtime antes de redesenhar.
- **R1 RESOLVIDO (FASE A, 2026-09-24):** confirmado em código + teste de semântica PostgREST; fix `existeNaJanela` (`.is()` p/ NULL) + `revalidatePath` em marcar lida/todas (UI presa até reload); `tests/notificacoes-dedup.test.ts` 4/4 PASS no live. Limitações mantidas: dedup por tipo+destinatário (entidade ignorada — sem coluna), actions silenciosas sem retorno de erro.
- **R9 RESOLVIDO (FASE 1 BLOCO 2, 2026-09-24):** `validarSlot` retornava `string` para texto válido E para erro → `responder()` tratava toda resposta texto como falha. Prova: 7/7 testes falhando com `responder(solicitante_nome): Maria`. Fix: contrato discriminado `{ok,valor,error}`; 7/7 PASS.
- **R10 RESOLVIDO (FASE 1 BLOCO 3, 2026-09-24):** `avancar` limpava `arquivos` (state) antes do `enviar` usar → fotos nunca chegavam ao servidor (ticket sem anexo, sem erro). Prova: E2E 8/10 com `fotos_antes: []`. Fix: `arquivosRef` persistente + limpeza só no sucesso; E2E 10/10.
- **P-ABERTO-06 — v27 NÃO aplicada (BLOQUEIA universal sem ativo):** orgs pós-v4 sem `entry_token` + `chamados.ativo_id` NOT NULL. `schema_v27.sql` criada (default + nullable, idempotente). **NÃO APLICADA — aguarda validação.** Fluxos a/l/c funcionam sem ela.
- **R2 — `conversas` vs thread do ticket:** reuso parcial possível (sender binding + imutabilidade) — auditar antes de criar `chamado_mensagens`.
- **R3 — Solicitante externo/LGPD:** retenção e consentimento a definir com TI.
- **R4 — SMTP:** deliverability atual desconhecida — avaliar provider na Fase A.
- **R5 — Dívida conhecida:** `TipoMovimentacao` sem `transferencia`, `AuditoriaLog` sem `organization_id`.
- **R6 — `ti.administrar`:** escopo para Configurações a propor.
- **R7 — Tokens legados (`qr_code_hash`) sem expiração/revogação.**
- **R8 — `setores`/`equipes` como tabelas:** confirmar com cliente antes de modelar.
- **Ausências (protocolo §3):** `memory/AGENTS.md`, `memory/APRENDIZADOS.md` NÃO EXISTEM (não inventado); `F:/dev/memory/sga-m/INDEX.md` NÃO EXISTE; `F:/dev/memory/sga-m/{SOLUCOES,PADROES,CODIGO_E_SCRIPT,UX_DESIGN,IDEIAS,DECISOES_REUTILIZAVEIS,PROBLEMAS_RESOLVIDOS,APRENDIZADOS_REUTILIZAVEIS}.md` NÃO CONSULTADOS (só INDEX/STATUS/rotas do SUBCONSCIENTE eram relevantes; resto NÃO VALIDADO).
- **P-ABERTO-04 [ARQUIVADO — FEEDBACK DO CLIENTE]:** link organograma→perfil perde objeto (organograma descontinuado); `perfil/[id]` vira leitura via Cadastros>Usuários na Fase A.

## 1. Abertos / NÃO VALIDADO (verificar antes de agir)

### P-ABERTO-01 — Contagem real de testes/rotas diverge dos docs
- **Sintoma:** docs dizem `202 testes / 38 rotas / 19 forms`; disco tem 22 arquivos em `tests/` e build FASE 11.2 cita 41 rotas.
- **Impacto:** risco de afirmar cobertura sem evidência atual.
- **Evidência 2026-09-17:** `tsc` 0 errors, `lint` 0 errors + 24 warnings — bate com `QA_FINAL` (24 warnings), NÃO com `FASE_11_2_CHECKLIST` ("0 warnings"; o checklist cobria só arquivos alterados). Warnings são todos `no-unused-vars` em arquivos fora do escopo FASE 11.2. Testes: `analytics` 51/51 + `encoding` 4/4 + `os-foto-antes-bug` 7/7 = 62/62 PASS (Supabase live). **Build reconciliado: SUCCESS com 41 rotas (VALIDADO pelo usuário) — fecha a divergência 38 vs 41: número atual é 41.**
- **Reconciliação 2026-09-21 (VALIDADO):** suíte rodada por blocos (A/B/C/D) contra Supabase live — 21 suítes, **209/209 PASS** (62+43+51+53). Inventário em disco: 42 `page.tsx` + 2 `route.ts`, 17 `*Form.tsx` (+ inline ≈ 19 funcionais). Docs com `202/38/19` defasados (foto QA 2026-09-11); número oficial atual: **209 testes / 42 páginas + 2 handlers**.
- **Ação restante:** suíte completa (20 arquivos) excede 10 min por exigir Supabase live sequencial — BLOQUEADO por janela de tempo, rodar por blocos (não impeditivo p/ merge). **VALIDADO (gates técnicos).**

### P-ABERTO-02 — `scripts/` com ~50 arquivos untracked
- **Sintoma (2026-09-17):** `git status` limpo exceto untracked: `memory/` (4 arquivos, novo), `.obsidian/` (novo), `memory/.obsidian/` (novo — metadados do Obsidian dentro de `memory/`), `scripts/` (~50 `debug_*.js`, `fix_mojibake*`, `quick_test.js` etc.).
- **Risco:** poluição, possível secret em script solto, ruído em `git add`.
- **Ação:** triar `scripts/` (manter ferramenta útil documentada vs. deletar diagnóstico descartável); decidir se `memory/` entra no git (recomendado: sim) e se `.obsidian/` vai para `.gitignore`. Preservar por padrão até triagem.

### P-ABERTO-03 — Branch à frente de `master`, produção congelada
- **Sintoma:** `fix/os-foto-antes-bug` (`fbbad15`) à frente de `master` (`f8e0886`); Preview pendente.
- **Risco:** merge acidental sem validação visual; `fundacao-cadastro`/`seletor-localidade` precisam re-aplicação no merge final (nota em `FASE_11_2_RELATORIO.md` §20).
- **Ação:** validar Preview → aval explícito → merge. Produção intocada até lá.

### P-ABERTO-04 — `perfil/[id]` 404 (divergência de docs)
- **Sintoma:** `ORPHAN_FEATURES.md` marcava `/admin/perfil/[id]` 404 CRÍTICO; `src/app/admin/perfil/[id]/` existe no disco; auditoria-360 alega P01 corrigido.
- **Evidência 2026-09-17:** build lista `/admin/perfil/[id]` como rota válida (também `/admin/cadastros` nova). Conteúdo/links ainda NÃO VALIDADOS.
- **Ação:** testar rota real + links do organograma. **PARCIALMENTE VALIDADO.**

### P-ABERTO-05 — Migrations v23→v26 NÃO aplicadas (BLOQUEANTE p/ uso das telas novas)
- **Sintoma:** `schema_v23.sql` + `v24` + `v25` + `v26` criados e versionados, mas tabelas/colunas não existem no Supabase até aplicação manual via SQL Editor (ordem: v23 → v24 → v25 → v26).
- **Evidência 2026-09-17:** usuário aplicou com sucesso; probe somente-leitura confirma no banco live: 4 tabelas novas existem (0 linhas), 6 colunas novas presentes, RPC aceita 11 args (`Produto não encontrado` = assinatura nova válida).
- **Ação restante:** validação manual das telas. **RESOLVIDO (schema).**

## 2. Limitações aceitas (não bloqueadores, com workaround)

- **L-01 `unidades_medida` sem UI** — seed sem uso; backlog MELHORIA (`QA_FINAL.md` §9).
- **L-02 XLSX ausente** — workaround: CSV com BOM.
- **L-03 Mapa sem lat/lng** — workaround: hierárquico documentado (`MAP_SPEC.md`).
- **L-04 Busca só `ilike`** — suficiente para <1k registros; sem full-text.
- **L-05 Sem WebSocket/cache** — `revalidate` + polling controlado cobre.
- **L-06 `checklist_respostas` sem `organization_id`** — isolamento transitivo via `execucao_id` + `eh_membro` (H3 provado, 2/2 PASS).
- **L-07 `audit_select` permite `org NULL + tabela='sessao'`** — 11 logs legítimos + 1 memberships anômalo não exposto (H4).
- **L-08 MIME spoofing além de `file.type`+extensão não validado** — `pdf-parse`/`fast-xml-parser` falham para `null` com erro tratado; upload limita 8MB + `bodySizeLimit 25mb`.

## 3. Resolvidos (histórico — não reabrir sem regressão)

- **R-01 O.S. inacessível após upload (FASE 11.2, CRÍTICO):** RESOLVIDO em branch — causa: `GaleriaFotos` async em Client Component; fix: Client síncrono + URLs resolvidas no pai; 7/7 PASS.
- **R-02 Storage cross-tenant (H6):** RESOLVIDO — bucket `public=false` + DROP `sga_midia_*`; 8/8 PASS.
- **R-03 `solic_insert_publico` forjável (H1):** RESOLVIDO via `schema_v16` (`WITH CHECK false`).
- **R-04 CASCADE apagava O.S. (H2):** RESOLVIDO via `schema_v16` (RESTRICT).
- **R-05 Auditoria NULL cross-tenant (H4):** RESOLVIDO via `schema_v17` + migração memberships.
- **R-06 `sga_acesso_total_*` permissivo:** RESOLVIDO (drop, `fix_rls_permissive.sql`).
- **R-07 Mojibake/encoding:** RESOLVIDO (`fix_all_mojibake*`, 4 testes encoding PASS).
- **R-08 N+1 / DB ONLY fallback / auth P08–P10 (auditoria-360):** RESOLVIDO (`8c13a28`).
- **R-09 Messaging RLS/sender binding (HOTFIX 2–4):** RESOLVIDO.
