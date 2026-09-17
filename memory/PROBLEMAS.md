# PROBLEMAS.md — SGA-M (COMPAC)

> Bugs, limitações, bloqueios, riscos, workarounds. Nunca apagar histórico — marcar RESOLVIDO e preservar contexto.
> Atualizado: 2026-09-17 (inspeção, sem validação executada nesta sessão).

## 1. Abertos / NÃO VALIDADO (verificar antes de agir)

### P-ABERTO-01 — Contagem real de testes/rotas diverge dos docs
- **Sintoma:** docs dizem `202 testes / 38 rotas / 19 forms`; disco tem 22 arquivos em `tests/` e build FASE 11.2 cita 41 rotas.
- **Impacto:** risco de afirmar cobertura sem evidência atual.
- **Evidência 2026-09-17:** `tsc` 0 errors, `lint` 0 errors + 24 warnings — bate com `QA_FINAL` (24 warnings), NÃO com `FASE_11_2_CHECKLIST` ("0 warnings"; o checklist cobria só arquivos alterados). Warnings são todos `no-unused-vars` em arquivos fora do escopo FASE 11.2. Testes: `analytics` 51/51 + `encoding` 4/4 + `os-foto-antes-bug` 7/7 = 62/62 PASS (Supabase live). **Build reconciliado: SUCCESS com 41 rotas (VALIDADO pelo usuário) — fecha a divergência 38 vs 41: número atual é 41.**
- **Ação restante:** suíte completa (20 arquivos) excede 10 min por exigir Supabase live sequencial — BLOQUEADO por janela de tempo, rodar por blocos (não impeditivo p/ merge). **VALIDADO (gates técnicos).**

### P-ABERTO-02 — `scripts/` com ~50 arquivos untracked
- **Sintoma (2026-09-17):** `git status` limpo exceto untracked: `memory/` (4 arquivos, novo), `.obsidian/` (novo), `scripts/` (~50 `debug_*.js`, `fix_mojibake*`, `quick_test.js` etc.).
- **Risco:** poluição, possível secret em script solto, ruído em `git add`.
- **Ação:** triar `scripts/` (manter ferramenta útil documentada vs. deletar diagnóstico descartável); decidir se `memory/` entra no git (recomendado: sim) e se `.obsidian/` vai para `.gitignore`. Preservar por padrão até triagem.

### P-ABERTO-03 — Branch à frente de `master`, produção congelada
- **Sintoma:** `fix/os-foto-antes-bug` (`fbbad15`) à frente de `master` (`f8e0886`); Preview pendente.
- **Risco:** merge acidental sem validação visual; `fundacao-cadastro`/`seletor-localidade` precisam re-aplicação no merge final (nota em `FASE_11_2_RELATORIO.md` §20).
- **Ação:** validar Preview → aval explícito → merge. Produção intocada até lá.

### P-ABERTO-04 — `perfil/[id]` 404 (divergência de docs)
- **Sintoma:** `ORPHAN_FEATURES.md` marcava `/admin/perfil/[id]` 404 CRÍTICO; `src/app/admin/perfil/[id]/` existe no disco; auditoria-360 alega P01 corrigido.
- **Ação:** testar rota real + links do organograma. **NÃO VALIDADO.**

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
