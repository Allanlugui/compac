# DECISOES.md — SGA-M (COMPAC)

> Registro cronológico, preservador (Antes → Motivo → Depois). Base: código + `ARCHITECTURE.md` + `SECURITY.md` + `QA_FINAL.md`.
> Atualizado: 2026-09-24 — FASE 0 RESET (`D-RESET-CLIENTE-01`).

## 0. D-RESET-CLIENTE-01 — Reset arquitetural pós-feedback (2026-09-24, FASE 0)

- **Decisão:** roadmap anterior SUSPENSO (vira histórico); feedback do cliente = nova fonte de verdade; produzir `REARQUITETURA-V2.md` antes de qualquer alteração estrutural; produção congelada; nenhum código nesta sessão.
- **Contexto:** cliente rejeitou mensagens globais, organograma, busca-rota e formulário público como principal; exige atendimento conversacional, portal, Cadastros ampliado, Configurações, mobile por contexto.
- **Mantido:** multi-tenant, RLS, auditoria, matriz+overlay de permissões, RPC estoque, QRs, todos os módulos §7 do protocolo.
- **Removido (navegação, código/dados preservados):** mensagens global, organograma, rota de busca.
- **Impacto:** TODO antigo arquivado por item; novas fases A–F em `REARQUITETURA-V2.md` §H; próxima fase exige decisão/aval antes de codar.
- **Ref:** `memory/REARQUITETURA-V2.md`, protocolo FASE 0.

## 00b. D-RESET-CLIENTE-02 — FASE 1 a partir do trabalho bom (2026-09-24)

- **Decisão:** branch `refactor/sgam-rearquitetura-cliente` criada de `a9cb2bc` (base com Blocos 1–4 + FASE A testados); FASE A reprovada como aprovação funcional, código bom reaproveitado; BLOCO 1 (navegação + hub) sem novas tabelas, rotas legadas preservadas.
- **Deferidos (sem botão/placeholder):** E-mail templates UI, Atendimento/Agente config e Gerais → blocos próprios.
- **Ref:** FASE 1, BLOCO 1.

## 00c. D-BLOCO2-INTAKE — Motor puro + contratos (2026-09-24, FASE 1 BLOCO 2)

- **Decisão:** `src/lib/intake/` 100% puro (tipos, slots com `quando` contextual, engine validar→avançar→confirmar, mapeamentos para payload); sem DB/IA/UI/rotas; persistência e chat nos blocos seguintes.
- **Auditoria (§22):** REUSAR token→tenant server-side, validação de fotos (MIME/8MB/rate/paths), inserts service + audit, tabelas chamados/solicitacoes, RLS, Storage privado. SUBSTITUIR (futuro): formulário público como porta principal, QR-compra form, mensagens global.
- **Bug pego por teste:** `validarSlot` retornava string tanto p/ texto válido quanto p/ erro → contrato refeito p/ `{ok,valor,error}` discriminado.
- **NÃO VALIDADO:** persistência de sessão (`intake_sessoes` — pesquisar duplicidade antes de criar tabela no BLOCO 3/4).
- **Ref:** `src/lib/intake/`, `tests/intake-engine.test.ts` 7/7.

## 00d. D-BLOCO3-ENTRADA — Contexto reutilizado + sessão sem tabela (2026-09-24, FASE 1 BLOCO 3)

- **Decisão:** 4 entradas via tokens existentes (`ativos.qr_code_hash`, `qr_contextos.token` ×2 fluxos, `organizations.entry_token`); paths `/atendimento/a|l|u|c/[ref]` (não `[ref]` único — evita ambiguidade semântica); sessão = estado client + revalidação integral server-side (sem `intake_sessoes`).
- **Auditoria persistência (§4/§7):** nenhum mecanismo de sessão existe (fluxos single-shot); tabela julgada DESNECESSÁRIA nesta fase (refresh perde progresso — limitação documentada).
- **Achado:** orgs pós-v4 sem `entry_token` (só backfill) + `chamados.ativo_id` NOT NULL bloqueava universal → `schema_v27.sql` CRIADA NÃO aplicada.
- **Ref:** `src/lib/intake/contexto.ts`, `src/app/atendimento/`, `tests/atendimento-contexto.test.ts` 6/6, E2E 10/10.

## 00. D-FASEA-01 — Branch a partir da base real (2026-09-24, FASE A)

- **Decisão:** `refactor/fundacao-arquitetura` criada de `a1eac3c` (não de master), pois master (`f8e0886` local; `efa6df6` remoto) não contém Blocos 1–4 nem `memory/`.
- **Divergência corrigida:** `origin/master` = `efa6df6` (PR #1 mergeou FASE 11.2) — memória dizia "não mergeada". Produção segue NÃO VALIDADA.
- **Ref:** ETAPA 1 FASE A.

## 000. D-FASEA-02 — Fundação sem tabelas novas (2026-09-24, FASE A) + GATE FINAL

- **Gate final:** suíte 216/216 (23 arquivos, 5 blocos), tsc 0, lint 0+24, build 43 rotas, push p/ Preview; ancestry documentada (sem rebase/merge); E2E local 15/15; commit `feat(FASE A): ...` AUTORIZADO e executado (sem merge/PR/deploy); FASE B bloqueada.

- **Decisão:** dedup via helper testável (`.is()` p/ NULL) + `revalidatePath`; pipeline e-mail em código (log no recibo, `email_logs` fica p/ Fase B); hub Configurações só com links reais; Permissões seguem em `/admin/usuarios` (movimento conceitual via hub); Cadastros linka Usuários sem duplicar entidade.
- **Auditoria permissões:** visibilidade tudo-ou-nada por página; custos visíveis a todo `estoque.ver`; escopo de registro = org (exceto overlay).
- **Ref:** `src/lib/notificacoes.ts`, `src/lib/email-pipeline.ts`, `src/app/admin/configuracoes/`.

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

## 8. BLOCO 1 — Cadastros mestres relacionais (2026-09-17)

- **Decisão:** criar `departamentos_setores` + `centros_custo` como tabelas próprias vinculadas a `localidades` (FK nullable SET NULL); manter colunas texto legadas intactas, sem migração de dados.
- **Contexto:** departamento/centro de custo/setor eram texto livre (max 80) espalhados em 8+ pontos — sem unicidade, sem vínculo físico, sem RLS.
- **Alternativas:** migrar colunas texto para FK imediatamente (rejeitado — risco de perda/quebra, viola Preservação); permissões novas `cadastros.*` (rejeitado — reutilizar `estrutura.*` reduz superfície); duas rotas separadas (rejeitado — uma rota com abas segue o padrão `EstruturaManager`).
- **Impacto:** `schema_v23.sql` idempotente (tabelas + RLS + `enforce_same_org` estendido com corpo integral do v18 + 3 blocos); exclusão de departamento com CC vinculado é bloqueada com erro amigável; rota `/admin/cadastros` (ADMIN/GESTOR).
- **Ref:** `schema_v23.sql`, `src/app/admin/cadastros/`.

## 9. BLOCO 2 — Estoque dual + shim de compatibilidade RPC (2026-09-17)

- **Decisão:** saldo GLOBAL permanece em `produtos.estoque_atual` (Visão Unificada = telas/relatórios atuais, zero quebra); segmentação via `almoxarifado_id` nullable (Visão Segmentada = filtro + stats do segmento). RPC estendida com 2 params DEFAULT NULL; código recua ao legado (PGRST202) pré-v24.
- **Contexto:** transferência era par texto origem/destino ("rede zero, sem estoque por local"); px por almoxarifado exigiria saldos por par — fora do escopo. Dual nullable entrega o controle sem reescrever o motor.
- **Alternativas:** saldos por almoxarifado (`estoque_saldos`) + RPC transacional nova (rejeitado — reescreve caminho crítico, invalida 5 testes workflows + RLS); assinatura RPC quebrada sem default (rejeitado — quebra testes e pré-v24); rota nova de almoxarifados (rejeitado — 3ª aba em `/admin/cadastros` segue o padrão).
- **Impacto:** `schema_v24.sql` (DROP+CREATE da RPC corpo idêntico + 2 params); `transferirEstoque` usa selects quando há almox, texto senão; inserts omitem coluna quando null (válidos pré-v24). Remover o shim quando v24 aplicada em todos os ambientes.
- **Ref:** `schema_v24.sql`, `src/app/admin/estoque/`.

## 10. BLOCO 3 — Overlay granular sem reescrever a matriz (2026-09-17)

- **Decisão:** `permissoes_custom` como OVERLAY (base perfil + conceder − negar; negar global vence tudo), aplicado primeiro em estoque (escopo almox) e cadastros (escopo localidade); `exigirPermissao` original intocado nos demais módulos (rollout gradual).
- **Contexto:** trocar toda checagem de uma vez = reescrever caminho de segurança crítico com risco de lockout/bypass. `exigirPermissao` não podia virar async (call sites sem await = bypass silencioso).
- **Alternativas:** reescrever todas as 18+ actions de uma vez (rejeitado — blast radius); `exigirPermissao` async (rejeitado — quebra silenciosa de segurança); escopos em tabela separada por tipo (rejeitado — uma tabela com check cobre); `usuarios.administrar` customizável (rejeitado — vetor de escalada).
- **Impacto:** `schema_v25.sql`; `permissoes-custom.ts` client-safe + `permissoes-custom-server.ts` (split exigido pelo Turbopack: `next/headers` fora do bundle client); editor em `/admin/usuarios`; pré-v25 tudo degrada para legado (queries retornam []).
- **Ref:** `schema_v25.sql`, `src/lib/permissoes-custom*.ts`, `src/app/admin/usuarios/PermissoesEditor.tsx`.

## 11. BLOCO 4 — QR relacional com snapshot textual (2026-09-17)

- **Decisão:** FKs novas convivem com textos (snapshot derivado dos vínculos no ato da criação); selects com fallback texto quando cadastros vazios; fluxo público copia IDs + `qr_contexto_id` com recuo legado.
- **Contexto:** QRs já impressos e contextos antigos usam texto; quebrar o fluxo público seria P0. Snapshots mantêm etiquetas e auditoria legíveis sem join.
- **Alternativas:** remover colunas texto (rejeitado — quebra QRs impressos e formulário antigo); exigir vínculos obrigatórios (rejeitado — orgs sem cadastros ficariam bloqueadas); migration de dados texto→FK por similaridade de nome (rejeitado — ambíguo, risco de vínculo errado).
- **Impacto:** `schema_v26.sql`; `criarContexto` + fluxo público com spreads condicionais (válidos pré-v26); lista admin resolve nomes.
- **Ref:** `schema_v26.sql`, `src/app/admin/qr-compras/`, `src/app/qr-compra/[hash]/actions.ts`.
