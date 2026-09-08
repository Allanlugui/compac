# SGA-M — SECURITY

**Versão:** FASE FINAL
**Data:** 2026-09-07

---

## 1. Autenticação

- **Supabase Auth** com `auth.users` + `public.profiles` + `public.memberships`.
- **Login:** `signInWithPassword` (`src/app/login/actions.ts`), `signOut`, `updateUser`, `createUser` (admin).
- **Sessão:** `createServerClient` com `cookies` + `proxy.ts` (refresh), `requireOrg()` valida `auth.getUser()` + `memberships` a cada chamada.
- **Multi-org:** `getMemberships()` + `setActiveOrg` (cookie `sga_org`), `primeiro-acesso` com `must_change_password`, `recuperar-senha` com `resetPasswordForEmail`.
- **Sessão expirada:** `proxy.ts` redireciona para `/login` se `!auth.getUser()` e rota é `/admin/*`.

---

## 2. Autorização — Roles e Permissões

**Roles:** `ADMIN`, `GESTOR`, `TECNICO`, `COMPRAS`, `AUDITOR`, `SOLICITANTE` (`src/lib/types.ts`).

**Matriz (src/lib/permissoes.ts — 58 permissões):**

| Módulo | Ação | ADMIN | GESTOR | COMPRAS | TECNICO | AUDITOR | SOLICITANTE |
|---|---|---|---|---|---|---|---|
| Ativos | criar/editar/excluir/mudarStatus | ✅ | ✅/✅/❌/✅ | ❌ | ✅/✅/❌/✅ | ❌/❌/❌/❌ | ❌ |
| Chamados | criar/editar/excluir | ✅ | ✅/✅/✅ | ❌ | ✅/✅/❌ | ❌ | ✅ (criar) |
| Estoque | criar/editar/movimentar/ajustar/transferir | ✅ | ✅ | ✅/✅/✅/❌/✅ | ✅/✅/✅/❌/❌ | ❌ | ❌ |
| Compras | criar/aprovar/ver | ✅ | ✅ | ✅/✅/✅ | ❌/❌/✅ | ✅/✅/✅ | ✅ (criar) |
| Fornecedores | ver/criar | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Estrutura | escrever | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dashboard | ver | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (próprio) |
| Relatórios | ver | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (próprio) |
| Mapa | ver | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Busca | buscar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notificações | ver | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auditoria | ver | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Usuários | gerenciar | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Enforcement:** `exigirPermissao(ctx, "permissao")` em Server Components e Actions. UI `pode(ctx, perm)` apenas esconde link, não substitui server-side. `admin/layout.tsx` filtra `SidebarNav` por `ctx.role`.

---

## 3. Tenant Isolation

- **Definição:** `organization_id` em todas as tabelas de domínio, `enforce_same_org()` trigger (via `to_jsonb(NEW)` no `v13`) bloqueia cross-tenant (`ativo de outra organização`).
- **Derivação:** `ctx.orgId` de `requireOrg()` (JWT), nunca de `query string`, `body`, `hidden input`.
- **Exemplo proibido:** `organization_id vindo da URL` como autoridade — não existe no código (grep valida 0 ocorrências).
- **Validação:** 19 testes RLS (`tests/rls-isolation.test.ts`) com `selectComo`/`updateComo`/`deleteComo` via JWT (19/19 PASS) + `mapa` cross-tenant (16/16).

---

## 4. RLS

- **Habilitada:** 36 tabelas + `storage.objects` (`alter table ... enable row level security`).
- **Helpers:** `eh_membro(p_org uuid)` e `tem_papel(p_org uuid, papeis text[])` (`stable security definer set search_path=public`).
- **Policies:** `SELECT` com `eh_membro`, `INSERT`/`UPDATE`/`DELETE` com `eh_membro && tem_papel` por role. Ex: `ativos_select` (`authenticated` `using eh_membro`), `ativos_insert` (`ADMIN,GESTOR`), `ativos_delete` (`ADMIN`).
- **Exceções documentadas:** `chamados_insert_publico` (`anon` com `exists ativos.id=ativo_id` sem `org` check — risco P2, mas `enforce_same_org` mitiga se `organization_id` fornecido), `solicitacoes_compra` `solic_insert_publico` (`anon with check true` — permissiva, ver `SECURITY.md` limitações).
- **Auditoria:** `using (true)` em tabelas protegidas foi removido no `v4` (`drop policy sga_acesso_total_*`), restou apenas `solic_insert_publico` (documentado como limitação aceitável para QR público).

---

## 5. Storage

- **Bucket:** `manutencao-midia` (privado, `public=false` desde `v4`).
- **Paths:** `o/{orgId}/...` server-side (`src/lib/storage.ts` com `orgId` de `ctx.orgId`, nunca do cliente).
- **Policies:** `midia_org_leitura` (`foldername[1]='o' && foldername[2]=orgId && eh_membro`), `midia_org_escrita` (`with check` idem), `midia_legado_leitura` (`chamados/...` para compatibilidade).
- **Upload:** `uploadFotoQR` (via `createServiceClient` para QR público, path `o/{org}/...` server-side) e `uploadFotoAdmin` (via `createClient` com JWT).
- **Signed URLs:** `resolverFoto` gera `createSignedUrl` 1h para `o/{orgId}/...` com `orgIdEsperado` validado.

---

## 6. QR Público

- **Ativo:** `qr_code_hash` unique, `qr/[hash]/page.tsx` público via `createServiceClient` por `hash` (escopo mínimo `select nome, localizacao where qr_code_hash=hash`), `qr/[hash]/actions.ts` insere `chamados` via `service_role` com `ativo_id` derivado server-side, `organization_id` derivado de `ativos.organization_id`.
- **Compra:** `qr_code_hash` em `solicitacoes_compra`, `qr-compra/[hash]` similar.
- **Isolamento:** QR não revela `custos`, `compras`, `auditoria`, `dados de outros tenants`. Tokens legados preservados, não regenerados sem motivo.

---

## 7. Service Role

**Uso:** 8 arquivos (`src/lib/storage.ts`, `src/app/qr/*`, `src/app/admin/ativos/actions.ts` (storage), `src/app/admin/usuarios/actions.ts` (auth.admin), `src/app/admin/compras/solicitacoes/actions.ts` (compensação), `src/app/admin/compras/pedidos/actions.ts` (signedUrl)).

**Justificativa:** QR público precisa bypass RLS (anon não tem `SELECT` para `RETURNING`), Storage privado sem policy `anon` escrita, Admin precisa `auth.admin`. Todos com `organization_id` derivado server-side, escopo mínimo (`qr_code_hash` → `orgId`), nunca `organization_id` do cliente.

**Risco:** `qr-compra` `delete().eq("id", id)` sem `eq organization_id` (P2) — corrigido no BLOCO D com `fix_rls_permissive.sql`; `checklist_respostas` sem `organization_id` (P3) — depende de `execucao_id` já filtrado, documentado como limitação aceitável.

---

## 8. Input Validation

- **Query strings/forms:** `termo.replace(/[%_,()"'\\;]/g, "").trim().slice(0,60)` em `busca.ts`, `norm()` para strings (`trim`/`slice`/`check len`), `Number()` + `isFinite` para números, `zod` não usado mas validação manual com `trim`/`check`.
- **Uploads:** `file.size > 8MB` rejeitado, `accept=".xml,.pdf"` no input, `file.type.includes("xml"/"pdf")` no server, `Buffer.from(await file.arrayBuffer())` com `limit 25mb` (`next.config.ts` `serverActions.bodySizeLimit`).
- **MIME spoofing:** não validado além de `file.type` e `nome.endsWith`, mas `pdf-parse`/`fast-xml-parser` falham silenciosamente com `catch` → `null` e retornam `error: "XML inválido"`.

---

## 9. Busca Global

- **Sanitização:** `[%_,()"'\\;]` removidos, `trim`, `slice(60)`, `ilike` com `or` e `limit` por entidade (10/5/3).
- **Tenant:** `requireOrg` + `eq organization_id` em 9 queries, `Promise.all`.
- **Permissões:** `requireOrg` + RLS `eh_membro` (segunda barreira), sem `service_role`.
- **Race:** `debounce 300ms` + `timer.current` com `clearTimeout`, não consulta a cada tecla.

---

## 10. Notificações

- **Tenant:** `organization_id` via `requireOrg` em `gerarNotificacaoIdempotente`, `notificar`, `marcarLida`.
- **Destinatário:** `user_id` nullable (null=broadcast), `or(user_id.is.null,user_id.eq.auth.uid())` na RLS.
- **Deduplicação:** `tipo + entidade + entidade_id + destinatário + janela 24h` via `select where tipo+user_id+gte created_at` antes de `insert`.
- **Leitura:** `marcarLida` com `eq id + eq org + or(user_id...)` server-side, não permite marcar de outra org/user.

---

## 11. Secrets

- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (server-only, `src/lib/supabase/service.ts` com `SUPABASE_SERVICE_ROLE_KEY`, nunca no client), `SUPABASE_JWT_SECRET` (server-only, `tests/setup.ts` com `SignJWT`).
- **Nunca:** `.env` commitado, `NEXT_PUBLIC_*` com secrets, `service_role` no client, `SUPABASE_SERVICE_ROLE_KEY` no browser.
- **.gitignore:** `.env*`, `scripts/*.js` com `SUPABASE_SERVICE_KEY` não commitados (mas `scripts/` com `SUPABASE_SERVICE_KEY` em `tests/setup.ts` é dev-only, não produção).

---

## 12. Auditoria

- **Mecanismo:** `registrarLog(supabase, { tabela, registro_id, acao, dados_anteriores/novos, executado_por, organization_id, user_id })` em todas as mutações críticas (`ativos`, `chamados`, `estoque`, `compras`, `solicitacoes`, `notificacoes`).
- **Ações:** 33 canônicas (`INSERT`...`RECEIPT_REJECTED`), `auditoria_logs_acao_check` com lista completa (v8/v10/v11/v14).
- **Rastreabilidade:** `organization_id` + `user_id` + `tabela` + `registro_id` + `acao` + `created_at` + `dados`.

---

## 13. Limitações Conhecidas (não bloqueadores)

- `solic_insert_publico` com `with check (true)` permite `anon` forjar `organization_id` (aceitável para QR público, mas documentado).
- `checklist_respostas` sem `organization_id` (depende de `execucao_id` filtrado).
- `audit_select` com `organization_id is null OR eh_membro` permite cross-tenant para logs `null` (legados).
- `storage.objects` `enable RLS` comentado em `schema.sql` (depende de default Supabase).
- `BLOCO D` sem `latitude/longitude` → mapa geográfico não aplicável.
- `XLSX` não implementado (CSV cobre).

---

## 14. Recomendações Futuras (não bloqueadores)

- Adicionar `tem_papel` em `checklist_itens` `cki_all` e `notificacoes` `notif_write` para restringir `SOLICITANTE`/`AUDITOR`.
- Trocar `chamados.ativo_id ON DELETE CASCADE` → `RESTRICT` para preservar histórico.
- Sincronizar `src/lib/types.ts` com `schema.sql` (`organization_id` em `AuditoriaLog`, `TipoMovimentacao` com `transferencia`).
