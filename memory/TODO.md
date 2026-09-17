# TODO.md — SGA-M (COMPAC)

> Atualizado: 2026-09-17 (inspeção, sem execução de testes/build nesta sessão).
> Regra: não manter como pendente o que já foi concluído; marcar estado real (PLANEJADO / IMPLEMENTADO / VALIDADO / BLOQUEADO / NÃO VALIDADO).

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
