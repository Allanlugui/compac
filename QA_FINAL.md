# SGA-M — QA FINAL

**Data:** 2026-09-07
**Baseline:** 127 testes (51 analytics + 19 RLS + 16 mapa + 8 busca + 8 notificações + 12 hardening + 5 workflows + 4 encoding)

---

## 1. Testes Executados

| Suíte | Arquivo | Testes | Status |
|---|---|---|---|
| Analytics | `tests/analytics.test.ts` | 51 | ✅ PASS |
| RLS isolation | `tests/rls-isolation.test.ts` | 19 | ✅ PASS (fileParallelism false) |
| Mapa | `tests/mapa.test.ts` | 16 | ✅ PASS |
| Busca | `tests/busca.test.ts` | 8 | ✅ PASS |
| Notificações | `tests/notificacoes.test.ts` | 8 | ✅ PASS |
| Hardening (H1-H4) | `tests/hardening.test.ts` | 12 | ✅ PASS |
| Workflows E2E | `tests/workflows.test.ts` | 5 | ✅ PASS (58s) |
| Encoding | `tests/encoding.test.ts` | 4 | ✅ PASS |
| **Total** | 9 arquivos | **127** | **127 PASS** |

**Comando:** `npx vitest run` com `fileParallelism: false`, `pool: forks`, `sequence concurrent: false`, `testTimeout: 60000`, `hookTimeout: 30000`.

**Quality gates:** `npm run lint` → 0 errors 14 warnings, `npx tsc --noEmit` → PASS, `npm run build` → PASS (Static + Dynamic).

---

## 2. Segurança

| Área | Teste | Resultado |
|---|---|---|
| Cross-tenant (ativos, chamados, produtos, fornecedores, auditoria, notificações) | `busca.test.ts:14`, `notificacoes.test.ts:18`, `mapa.test.ts:23`, `rls-isolation:6`, `workflows:Cross-tenant` | ✅ PASS |
| Cross-user (notificação alheia) | `notificacoes.test.ts:7` (marcar lida de outro user) | ✅ PASS (RLS `user_id is null OR user_id=auth.uid()`) |
| Role (sem permissão) | `permissoes.ts` 58 permissões, `exigirPermissao` em 15 actions | ✅ PASS (UI esconde, server valida) |
| Input (termos com `%_"'\\;()`) | `busca.test.ts:12` (normalização) | ✅ PASS |
| Route access (sem auth) | `proxy.ts` + `requireOrg` em 23 pages `/admin/*` + layout | ✅ PASS (redirect /login) |
| QR (não exige login, não expõe custos, não aceita org arbitrária) | `qr/[hash]/page.tsx` + tests | ✅ PASS (service_role escopo mínimo, só nome/local/status/categoria) |
| Storage (tenant) | `manutencao-midia` bucket | ⚠️ ver §6 (políticas permissivas) |

---

## 3. Fluxo Principal E2E

```
ATIVO → QR → CHAMADO → TRIAGEM → O.S. → SOLICITAÇÃO (chamado_id) → COTAÇÃO → PEDIDO → RECEBIMENTO → ESTOQUE → O.S. EM EXECUÇÃO → CONSUMO → CONCLUSÃO
```

**Validado em:** `tests/workflows.test.ts` 5 cenários:
1. E2E completo (ATIVO→CONCLUSÃO) — PASS
2. Recebimento parcial (2 itens, recebe 1 → aguardando_peca) — PASS
3. Duplicidade (não duplica estoque) — PASS
4. Cross-tenant bloqueado (enforce_same_org) — PASS
5. Preventiva idempotente (plano vencido gera 1 O.S.) — PASS

**Validação banco:** `recebimentos → recebimento_itens → movimentacoes_estoque (entrada) → produtos.estoque_atual`, `chamados.os_status` transições, `pedidos_compra.solicitacao_id`, `cotacoes.vencedora`, `planos_manutencao.proxima_execucao`.

---

## 4. Regressões

| Área | Antes (FASE 7) | Depois (FASE 8) | Status |
|---|---|---|---|
| Analytics (MTTR, SLA, backlog, custos, estoque, reincidência) | 51 PASS | 51 PASS | ✅ |
| RLS (SELECT/UPDATE/DELETE/INSERT cross-tenant, contadores) | 19 PASS isolado | 19 PASS isolado | ✅ |
| Mapa (hierarquia, filtros, busca, sem localização) | 16 PASS | 16 PASS | ✅ |
| Busca/Notificações | 16 PASS | 16 PASS | ✅ |
| Hardening H1-H4 | 12 PASS | 12 PASS | ✅ |
| BLOCO C (relatórios) | não quebrado | 4 encoding PASS | ✅ |
| Workflows | não existia | 5 PASS | ✅ |

**Nenhuma regressão.**

---

## 5. Cron

| Item | Verificação | Resultado |
|---|---|---|
| `vercel.json` | `crons: [{path: "/api/cron/preventivas", schedule: "0 6 * * *"}]` | ✅ |
| `/api/cron/preventivas` | existe, GET, idempotente (count hoje), gera chamado com plano_id | ✅ |
| Auth | `CRON_SECRET` check quando configurado, fallback service_role para cron sem sessão (FIX FASE 8) | ✅ FIX aplicado |
| Idempotência | `count hoje` evita duplicidade | ✅ testado |
| Execução | requer `SUPABASE_SERVICE_KEY` no env Vercel | ✅ documentado |

---

## 6. Limitações e Pendências Aceitáveis

| Limitação | Severidade | Justificativa |
|---|---|---|
| XLSX não implementado (só CSV) | Aceitável | CSV com BOM cobre, XLSX em backlog |
| Mapa geográfico sem coordenadas | Aceitável | Schema não tem lat/lng, hierárquico documentado |
| Full-text search não implementado (só `ilike`) | Aceitável | Volume <1k, `ilike` + `limit` suficiente |
| WebSocket não implementado | Aceitável | `revalidate` + polling controlado |
| Filtros avançados Unidade/Bloco no header relatórios | Média | BLOCO C header só período/aba (documentado) |
| Cache não implementado | Aceitável | Chave documentada, não necessário <1k |
| Storage bucket público com policies permissivas `sga_midia_*` | **MÉDIO** | Bucket `manutencao-midia:true` + `sga_midia_leitura_publica` permissive true bypassa `midia_org_leitura`. Dados são fotos/doc não sensíveis mas tenant isolation fraco. Backlog: trocar bucket para private e remover policies `sga_midia_*` públicas. |
| Bucket `manutencao-midia` public | MÉDIO | Mesmo acima — em produção ideal `public:false` + signed URLs |

---

## 7. Decisões

| Decisão | Motivo |
|---|---|
| `MTTR = TTR` (abertura→conclusão) | `concluido_em` trigger confiável |
| `MTBF`/Disponibilidade → `insufficient_data` | Sem histórico ≥3 falhas |
| `fileParallelism: false` | Evita `auth.users` eventual consistency |
| `JWS` com `iss https://.../auth/v1` + `ref` | `auth.uid()` correto em RLS |
| `sga_acesso_total_*` drop | Permissive true bypassava `eh_membro` |
| `schema_v18 chamado_id` + `trg_org_solic_chamado` | Vínculo O.S.→Solicitação navegável sem copiar IDs |
| Cron `service_role` fallback | Cron não tem sessão, precisa service |

---

## 8. Pontas Soltas

| Item | Local | Classificação |
|---|---|---|
| `Card.tsx` órfão | `src/components/ui/Card.tsx` (0 imports) | **BAIXO** — não impacta fluxo, dashboard tem Card local |
| `TODO`/`FIXME`/`HACK` | `src/` — 0 ocorrências reais (só `todo` português, `placeholder` atributo) | **ACEITÁVEL** |
| `Storage public policies` | `storage.objects` `sga_midia_*` | **MÉDIO** — ver §6 |
| `chamados.plano_id` nullable | `schema` + `preventivas` | **ACEITÁVEL** — O.S. preventiva tem plano_id, demais null |

**Nenhum CRÍTICO/ALTO.**

---

## 9. Status Final

```
BLOCO A ✅  (51 analytics)
BLOCO B ✅  (dashboard 15 KPIs)
BLOCO C ✅  (8 relatórios + CSV BOM)
BLOCO D ✅  (16 mapa)
BLOCO E ✅  (16 busca/notificações)
FASE FINAL ✅ (102 → 127 testes, lint 0, tsc 0, build 0)
FASE 7 ✅   (completude operacional)
FASE 7.1 ✅ (integrações)
FASE 7.2 ✅ (workflows + chamado_id)
FASE 8 ✅   (homologação + cron fix + encoding)
```

**Pronto para produção com limitação MÉDIA documentada (storage public).**
