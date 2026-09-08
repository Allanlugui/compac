# SGA-M â€” SECURITY

**VersÃ£o:** FASE FINAL
**Data:** 2026-09-07

---

## 1. AutenticaÃ§Ã£o

- **Supabase Auth** com `auth.users` + `public.profiles` + `public.memberships`.
- **Login:** `signInWithPassword` (`src/app/login/actions.ts`), `signOut`, `updateUser`, `createUser` (admin).
- **SessÃ£o:** `createServerClient` com `cookies` + `proxy.ts` (refresh), `requireOrg()` valida `auth.getUser()` + `memberships` a cada chamada.
- **Multi-org:** `getMemberships()` + `setActiveOrg` (cookie `sga_org`), `primeiro-acesso` com `must_change_password`, `recuperar-senha` com `resetPasswordForEmail`.
- **SessÃ£o expirada:** `proxy.ts` redireciona para `/login` se `!auth.getUser()` e rota Ã© `/admin/*`.

---

## 2. AutorizaÃ§Ã£o â€” Roles e PermissÃµes

**Roles:** `ADMIN`, `GESTOR`, `TECNICO`, `COMPRAS`, `AUDITOR`, `SOLICITANTE` (`src/lib/types.ts`).

**Matriz (src/lib/permissoes.ts â€” 58 permissÃµes):**

| MÃ³dulo | AÃ§Ã£o | ADMIN | GESTOR | COMPRAS | TECNICO | AUDITOR | SOLICITANTE |
|---|---|---|---|---|---|---|---|
| Ativos | criar/editar/excluir/mudarStatus | âœ… | âœ…/âœ…/âŒ/âœ… | âŒ | âœ…/âœ…/âŒ/âœ… | âŒ/âŒ/âŒ/âŒ | âŒ |
| Chamados | criar/editar/excluir | âœ… | âœ…/âœ…/âœ… | âŒ | âœ…/âœ…/âŒ | âŒ | âœ… (criar) |
| Estoque | criar/editar/movimentar/ajustar/transferir | âœ… | âœ… | âœ…/âœ…/âœ…/âŒ/âœ… | âœ…/âœ…/âœ…/âŒ/âŒ | âŒ | âŒ |
| Compras | criar/aprovar/ver | âœ… | âœ… | âœ…/âœ…/âœ… | âŒ/âŒ/âœ… | âœ…/âœ…/âœ… | âœ… (criar) |
| Fornecedores | ver/criar | âœ… | âœ… | âœ… | âŒ | âœ… | âŒ |
| Estrutura | escrever | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Dashboard | ver | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (prÃ³prio) |
| RelatÃ³rios | ver | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (prÃ³prio) |
| Mapa | ver | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| Busca | buscar | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| NotificaÃ§Ãµes | ver | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| Auditoria | ver | âœ… | âœ… | âŒ | âŒ | âœ… | âŒ |
| UsuÃ¡rios | gerenciar | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ |

**Enforcement:** `exigirPermissao(ctx, "permissao")` em Server Components e Actions. UI `pode(ctx, perm)` apenas esconde link, nÃ£o substitui server-side. `admin/layout.tsx` filtra `SidebarNav` por `ctx.role`.

---

## 3. Tenant Isolation

- **DefiniÃ§Ã£o:** `organization_id` em todas as tabelas de domÃ­nio, `enforce_same_org()` trigger (via `to_jsonb(NEW)` no `v13`) bloqueia cross-tenant (`ativo de outra organizaÃ§Ã£o`).
- **DerivaÃ§Ã£o:** `ctx.orgId` de `requireOrg()` (JWT), nunca de `query string`, `body`, `hidden input`.
- **Exemplo proibido:** `organization_id vindo da URL` como autoridade â€” nÃ£o existe no cÃ³digo (grep valida 0 ocorrÃªncias).
- **ValidaÃ§Ã£o:** 19 testes RLS (`tests/rls-isolation.test.ts`) com `selectComo`/`updateComo`/`deleteComo` via JWT (19/19 PASS) + `mapa` cross-tenant (16/16).

---

## 4. RLS

- **Habilitada:** 36 tabelas + `storage.objects` (`alter table ... enable row level security`).
- **Helpers:** `eh_membro(p_org uuid)` e `tem_papel(p_org uuid, papeis text[])` (`stable security definer set search_path=public`).
- **Policies:** `SELECT` com `eh_membro`, `INSERT`/`UPDATE`/`DELETE` com `eh_membro && tem_papel` por role. Ex: `ativos_select` (`authenticated` `using eh_membro`), `ativos_insert` (`ADMIN,GESTOR`), `ativos_delete` (`ADMIN`).
- **ExceÃ§Ãµes documentadas:** `chamados_insert_publico` (`anon` com `exists ativos.id=ativo_id` sem `org` check â€” risco P2, mas `enforce_same_org` mitiga se `organization_id` fornecido), `solicitacoes_compra` `solic_insert_publico` (`anon with check true` â€” permissiva, ver `SECURITY.md` limitaÃ§Ãµes).
- **Auditoria:** `using (true)` em tabelas protegidas foi removido no `v4` (`drop policy sga_acesso_total_*`), restou apenas `solic_insert_publico` (documentado como limitaÃ§Ã£o aceitÃ¡vel para QR pÃºblico).

---

## 5. Storage

- **Bucket:** `manutencao-midia` (privado, `public=false` desde `v4`).
- **Paths:** `o/{orgId}/...` server-side (`src/lib/storage.ts` com `orgId` de `ctx.orgId`, nunca do cliente).
- **Policies:** `midia_org_leitura` (`foldername[1]='o' && foldername[2]=orgId && eh_membro`), `midia_org_escrita` (`with check` idem), `midia_legado_leitura` (`chamados/...` para compatibilidade).
- **Upload:** `uploadFotoQR` (via `createServiceClient` para QR pÃºblico, path `o/{org}/...` server-side) e `uploadFotoAdmin` (via `createClient` com JWT).
- **Signed URLs:** `resolverFoto` gera `createSignedUrl` 1h para `o/{orgId}/...` com `orgIdEsperado` validado.

---

## 6. QR PÃºblico

- **Ativo:** `qr_code_hash` unique, `qr/[hash]/page.tsx` pÃºblico via `createServiceClient` por `hash` (escopo mÃ­nimo `select nome, localizacao where qr_code_hash=hash`), `qr/[hash]/actions.ts` insere `chamados` via `service_role` com `ativo_id` derivado server-side, `organization_id` derivado de `ativos.organization_id`.
- **Compra:** `qr_code_hash` em `solicitacoes_compra`, `qr-compra/[hash]` similar.
- **Isolamento:** QR nÃ£o revela `custos`, `compras`, `auditoria`, `dados de outros tenants`. Tokens legados preservados, nÃ£o regenerados sem motivo.

---

## 7. Service Role

**Uso:** 8 arquivos (`src/lib/storage.ts`, `src/app/qr/*`, `src/app/admin/ativos/actions.ts` (storage), `src/app/admin/usuarios/actions.ts` (auth.admin), `src/app/admin/compras/solicitacoes/actions.ts` (compensaÃ§Ã£o), `src/app/admin/compras/pedidos/actions.ts` (signedUrl)).

**Justificativa:** QR pÃºblico precisa bypass RLS (anon nÃ£o tem `SELECT` para `RETURNING`), Storage privado sem policy `anon` escrita, Admin precisa `auth.admin`. Todos com `organization_id` derivado server-side, escopo mÃ­nimo (`qr_code_hash` â†’ `orgId`), nunca `organization_id` do cliente.

**Risco:** `qr-compra` `delete().eq("id", id)` sem `eq organization_id` (P2) â€” corrigido no BLOCO D com `fix_rls_permissive.sql`; `checklist_respostas` sem `organization_id` (P3) â€” depende de `execucao_id` jÃ¡ filtrado, documentado como limitaÃ§Ã£o aceitÃ¡vel.

---

## 8. Input Validation

- **Query strings/forms:** `termo.replace(/[%_,()"'\\;]/g, "").trim().slice(0,60)` em `busca.ts`, `norm()` para strings (`trim`/`slice`/`check len`), `Number()` + `isFinite` para nÃºmeros, `zod` nÃ£o usado mas validaÃ§Ã£o manual com `trim`/`check`.
- **Uploads:** `file.size > 8MB` rejeitado, `accept=".xml,.pdf"` no input, `file.type.includes("xml"/"pdf")` no server, `Buffer.from(await file.arrayBuffer())` com `limit 25mb` (`next.config.ts` `serverActions.bodySizeLimit`).
- **MIME spoofing:** nÃ£o validado alÃ©m de `file.type` e `nome.endsWith`, mas `pdf-parse`/`fast-xml-parser` falham silenciosamente com `catch` â†’ `null` e retornam `error: "XML invÃ¡lido"`.

---

## 9. Busca Global

- **SanitizaÃ§Ã£o:** `[%_,()"'\\;]` removidos, `trim`, `slice(60)`, `ilike` com `or` e `limit` por entidade (10/5/3).
- **Tenant:** `requireOrg` + `eq organization_id` em 9 queries, `Promise.all`.
- **PermissÃµes:** `requireOrg` + RLS `eh_membro` (segunda barreira), sem `service_role`.
- **Race:** `debounce 300ms` + `timer.current` com `clearTimeout`, nÃ£o consulta a cada tecla.

---

## 10. NotificaÃ§Ãµes

- **Tenant:** `organization_id` via `requireOrg` em `gerarNotificacaoIdempotente`, `notificar`, `marcarLida`.
- **DestinatÃ¡rio:** `user_id` nullable (null=broadcast), `or(user_id.is.null,user_id.eq.auth.uid())` na RLS.
- **DeduplicaÃ§Ã£o:** `tipo + entidade + entidade_id + destinatÃ¡rio + janela 24h` via `select where tipo+user_id+gte created_at` antes de `insert`.
- **Leitura:** `marcarLida` com `eq id + eq org + or(user_id...)` server-side, nÃ£o permite marcar de outra org/user.

---

## 11. Secrets

- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (server-only, `src/lib/supabase/service.ts` com `SUPABASE_SERVICE_ROLE_KEY`, nunca no client), `SUPABASE_JWT_SECRET` (server-only, `tests/setup.ts` com `SignJWT`).
- **Nunca:** `.env` commitado, `NEXT_PUBLIC_*` com secrets, `service_role` no client, `SUPABASE_SERVICE_ROLE_KEY` no browser.
- **.gitignore:** `.env*`, `scripts/*.js` com `SUPABASE_SERVICE_KEY` nÃ£o commitados (mas `scripts/` com `SUPABASE_SERVICE_KEY` em `tests/setup.ts` Ã© dev-only, nÃ£o produÃ§Ã£o).

---

## 12. Auditoria

- **Mecanismo:** `registrarLog(supabase, { tabela, registro_id, acao, dados_anteriores/novos, executado_por, organization_id, user_id })` em todas as mutaÃ§Ãµes crÃ­ticas (`ativos`, `chamados`, `estoque`, `compras`, `solicitacoes`, `notificacoes`).
- **AÃ§Ãµes:** 33 canÃ´nicas (`INSERT`...`RECEIPT_REJECTED`), `auditoria_logs_acao_check` com lista completa (v8/v10/v11/v14).
- **Rastreabilidade:** `organization_id` + `user_id` + `tabela` + `registro_id` + `acao` + `created_at` + `dados`.

---

## 13. LimitaÃ§Ãµes Conhecidas (nÃ£o bloqueadores)

- `solic_insert_publico` com `with check (true)` permite `anon` forjar `organization_id` (aceitÃ¡vel para QR pÃºblico, mas documentado).
- `checklist_respostas` sem `organization_id` (depende de `execucao_id` filtrado).
- `audit_select` com `organization_id is null OR eh_membro` permite cross-tenant para logs `null` (legados).
- `storage.objects` `enable RLS` comentado em `schema.sql` (depende de default Supabase).
- `BLOCO D` sem `latitude/longitude` â†’ mapa geogrÃ¡fico nÃ£o aplicÃ¡vel.
- `XLSX` nÃ£o implementado (CSV cobre).

---

## 14. RecomendaÃ§Ãµes Futuras (nÃ£o bloqueadores)

- Adicionar `tem_papel` em `checklist_itens` `cki_all` e `notificacoes` `notif_write` para restringir `SOLICITANTE`/`AUDITOR`.
- Trocar `chamados.ativo_id ON DELETE CASCADE` â†’ `RESTRICT` para preservar histÃ³rico.
- Sincronizar `src/lib/types.ts` com `schema.sql` (`organization_id` em `AuditoriaLog`, `TipoMovimentacao` com `transferencia`).


---

## 15. HARDENING FINAL (2026-09-07)

### H1 — QR público
- Problema: solic_insert_publico com WITH CHECK (true) permitia anon forjar organization_id.
- Correção: schema_v16.sql altera para WITH CHECK (false) — anon insert bloqueado, QR via service_role com org derivado do token.
- Teste: H1 — 3/3 PASS (QR válido, cross-tenant bloqueado, anon bloqueado).

### H2 — FK chamados.ativo_id
- Problema: ON DELETE CASCADE apaga histórico O.S.
- Correção: schema_v16.sql altera para ON DELETE RESTRICT.
- Teste: H2 — 3/3 PASS (sem chamados pode excluir, com chamado bloqueado, inativação funciona).

### H3 — checklist_respostas
- Análise: sem organization_id direto, mas ckr_all com exists (select from checklist_execucoes where id=execucao_id and eh_membro) — isolamento transitivo provado.
- Teste: H3 — 2/2 PASS (execução A visível só para A, cross-tenant insert bloqueado).

### H4 — auditoria NULL
- Inventário: 14 NULL (3 memberships, 11 sessao), memberships recuperável via dados_novos.
- Correção: schema_v17.sql migra memberships e endurece audit_select para (org not null and eh_membro) OR (org is null and tabela='sessao').
- Teste: H4 — 3/3 PASS (A visível para A, NULL não vaza, cross-tenant bloqueado).

### H5 — Cross-tenant
- Teste: QR A + org B = FAIL — 1/1 PASS (12/12 hardening total).
