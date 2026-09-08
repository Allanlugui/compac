# SGA-M — ARCHITECTURE

**Versão:** FASE FINAL
**Date:** 2026-09-07
**Stack:** Next.js 16.3.4 (App Router), React 19.2.8, Supabase (Postgres + Auth + Storage + RLS), Tailwind CSS 4, Recharts 3.10, TypeScript 5

---

## 1. Visão Geral

```
Browser (React Client)  ←→  Next.js Server (RSC + Server Actions)  ←→  Supabase (Postgres + Auth + Storage)
     │                              │                                      │
     │  BuscaGlobal (Ctrl+K)        │  requireOrg() → ctx.orgId            │  RLS eh_membro(organization_id)
     │  SinoNotificacoes            │  exigirPermissao(ctx, perm)           │  policies por role
     │  MapaClient (tree)           │  analytics/queries + calculations    │  triggers enforce_same_org
     └──────────────────────────────┴──────────────────────────────────────┘
```

- **AppShell multi-tenant:** `src/app/admin/layout.tsx` com `requireOrg()` (valida JWT + `memberships` + cookie `sga_org`), `SidebarNav` filtrada por `ctx.role`, `BottomNav` mobile, `BuscaGlobal` e `SinoLink` no header.
- **Proxy:** `src/proxy.ts` (Next 16 `proxy`, ex-`middleware`) com `createServerClient` (anon key) + refresh de cookies, `matcher: /((?!_next/static|...).*)`, delega auth a `requireOrg` nas actions (não bloqueia `next-action`).
- **Organização:** `Organization` → `Membership` (user + role + status) → `Profile`. `requireOrg` extrai `ctx.orgId` do JWT, nunca de `query string` ou `body`.

---

## 2. Next.js App Router

- **Server Components:** `page.tsx` em `/admin/*` são `async` com `await requireOrg()` + `await createClient()` + `Promise.all` para queries com `eq organization_id`.
- **Client Components:** `MapaClient`, `BuscaGlobal`, `SinoLink`, `EstoqueClient`, `EstruturaManager` com `"use client"`, `useState`/`useMemo`, `useRouter().refresh()`, `debounce 300ms` (busca).
- **Server Actions:** 18 arquivos em `src/app/**/actions.ts` com `"use server"`, `requireOrg()` + `exigirPermissao()` + `revalidatePath()`, `createClient()` (JWT) ou `createServiceClient()` (QR público, Storage).
- **Route Handlers:** `src/app/auth/callback/route.ts` (OAuth), `src/app/qr/[hash]/page.tsx` (público, `createServiceClient` por `qr_code_hash`).

---

## 3. React

- **Versão:** 19.2.8 com `react-dom` 19.2.8.
- **Padrões:** `useState` para filtros/abas, `useMemo` para `filtrados` (estoque) e `buildTree` (mapa), `useEffect` para `Ctrl+K` e `debounce`, `useRef` para `timer` e `inputRef`.
- **Componentes UI:** `PageHeader`, `StatCard`, `EmptyState`, `StatusBadge`, `ImpactoBadge`, `AdminNav`, `BuscaGlobal`, `SinoLink`, `MapaClient` — todos com `cn()` (`clsx` + `tailwind-merge`) e `lucide-react` ícones.

---

## 4. Supabase

### 4.1 Postgres

- **Tabelas:** 36 + `storage.objects` (ver `DATA_MODEL.md`). Todas com `organization_id` (exceto `organizations` root) e `enable row level security`.
- **Migrations:** `schema.sql` (v1) → `schema_v2` → `schema_v4` → `v5` → `v6` → `v7` → `v8` → `v9` → `v10` → `v11` → `v12` → `v13` → `v14` → `v15` + `fix_ativos_cols.sql`, `fix_rls_permissive.sql`. Todas `if not exists` / `on conflict do nothing` / `or replace` → idempotentes.
- **Triggers:** `enforce_same_org()` (via `to_jsonb(NEW)` no `v13` para fix `42703`), `set_concluido_em()` (preenche `concluido_em` em `resolvido`/`concluido`), `sga_touch_updated_at` (`updated_at`).

### 4.2 Auth

- **Supabase Auth** com `auth.users` + `public.profiles` (`id PK FK auth.users`) + `public.memberships` (`user_id` + `organization_id` + `role` + `status`).
- **Login:** `src/app/login/actions.ts` com `signInWithPassword`, `signOut`, `updateUser`, `createUser` (admin).
- **Sessão:** `createServerClient` com `cookies` + `proxy.ts` refresh, `requireOrg()` valida `auth.getUser()` + `memberships` a cada chamada.
- **Multi-org:** `getMemberships()` + `setActiveOrg` (cookie `sga_org`), `primeiro-acesso` com `must_change_password`.

### 4.3 Storage

- **Bucket:** `manutencao-midia` (privado, `public=false` desde `v4`).
- **Paths:** `o/{orgId}/ativos/...`, `o/{orgId}/chamados/...`, `o/{orgId}/produtos/...` (server-side via `storage.ts` com `orgId` derivado de `ctx.orgId`, nunca do cliente).
- **Policies:** `midia_org_leitura` (`foldername[1]='o' && foldername[2]=orgId && eh_membro`), `midia_org_escrita` (insert com `with check` idem), `midia_legado_leitura` (`chamados/...` para compatibilidade).
- **Upload:** `uploadFotoQR` (via `createServiceClient` para QR público, path `o/{org}/...` server-side) e `uploadFotoAdmin` (via `createClient` com JWT, path `o/{ctx.orgId}/...`).

### 4.4 RLS

- **Helpers:** `eh_membro(p_org uuid)` e `tem_papel(p_org uuid, papeis text[])` (`stable security definer set search_path=public`).
- **Policies:** `SELECT` com `eh_membro`, `INSERT`/`UPDATE`/`DELETE` com `eh_membro && tem_papel` por role (`ADMIN`, `GESTOR`, `TECNICO`, `COMPRAS`, `AUDITOR`, `SOLICITANTE`).
- **Exceções:** `chamados_insert_publico` (`anon` com `exists ativos.id=ativo_id`), `solicitacoes_compra` `solic_insert_publico` (`anon with check true` — see `SECURITY.md`), `storage` legado.

---

## 5. Organização Multi-tenant

- **Tenant root:** `organizations` (`id`, `nome`, `slug` unique, `entry_token`).
- **Vínculo:** `memberships` (`user_id` + `organization_id` unique, `role`, `status` ativo/inativo, `setor`, `departamento`).
- **Isolamento:** `organization_id` em todas as tabelas de domínio, `enforce_same_org` trigger bloqueia cross-tenant (`ativo de outra organização`), RLS `eh_membro` como segunda barreira, `requireOrg` deriva `ctx.orgId` do JWT (nunca do cliente).
- **Service role:** `createServiceClient` (`SUPABASE_SERVICE_ROLE_KEY` server-only) usado apenas para QR público (escopo mínimo `qr_code_hash` → `organization_id` server-side) e Storage/Admin (profiles/memberships). Nunca em Client Components.

---

## 6. Server Actions

- **Padrão:** `"use server"` + `const ctx = await requireOrg()` + `exigirPermissao(ctx, "permissao")` + `const supabase = await createClient()` + `supabase.from(...).eq("organization_id", ctx.orgId)` + `revalidatePath()` + `registrarLog()` (auditoria).
- **Exemplo:** `src/app/admin/estoque/actions.ts` (`criarProduto`, `movimentarEstoque` via `movimentar_estoque_atomic` RPC, `transferirEstoque`, `atualizarProduto`, `criarUnidade`, `processarNotaFiscal` com `fast-xml-parser`/`pdf-parse`).
- **Validação:** `norm()` para strings, `Number()` + `isFinite` para números, `zod` não usado (validação manual com `trim`/`slice`/`check`).

---

## 7. Analytics

- **Camada:** `src/lib/analytics/` (`types.ts`, `calculations.ts` — funções puras, `queries.ts` — I/O com `supabase` + `getPeriodoRangeBRT` com `America/Sao_Paulo` → UTC, `index.ts` re-exports).
- **KPIs:** 15 definidos em `ANALYTICS_SPEC.md` (13 implementáveis, 2 condicionais `MTBF`/`Disponibilidade` → `insufficient_data`).
- **Dashboard:** `src/app/admin/dashboard/page.tsx` consome `queries.ts` via `Promise.all` com `qctx` (`supabase`, `orgId`, `periodo`), renderiza N1-N4 com `Card` + `BarList` + `SinoLink`.
- **Relatórios:** `src/app/admin/relatorios/page.tsx` com 8 abas (`executivo`, `ativos`, `manutencao`, `sla`, `custos`, `estoque`, `solicitacoes`, `top`) + `ExportButtons` (CSV + `window.print` PDF).

---

## 8. Módulos

Ver `MODULES.md` para detalhes por módulo (Estrutura, Ativos, QR, Manutenção, Estoque, Compras, Fornecedores, Dashboard, Relatórios, Mapa, Busca, Notificações, Auditoria, Usuários).

---

## 9. Armazenamento

- **Bucket:** `manutencao-midia` (privado).
- **Paths:** `o/{orgId}/...` (server-side, nunca do cliente).
- **Signed URLs:** `resolverFoto` gera `createSignedUrl` 1h para `o/{orgId}/...` com `orgIdEsperado` validado; legado `chamados/...` e `object/public` ainda suportados mas com fallback.

---

## 10. QR

- **Ativo:** `qr_code_hash` unique em `ativos`, `qr/[hash]/page.tsx` público via `createServiceClient` por `hash` (escopo mínimo), `qr/[hash]/actions.ts` insere `chamados` via `service_role` com `ativo_id` derivado server-side.
- **Compra:** `qr_code_hash` em `solicitacoes_compra`, `qr-compra/[hash]` similar.

---

## 11. Fluxo Principal

```
Login → Selecionar Org → Dashboard (N1-N4) → Ativos (CRUD + QR) → Chamado (QR) → O.S. (triagem → execução → conclusão) → Estoque (consumo) → Compras (solicitação → cotação → pedido → recebimento) → Relatórios/MAPA → Busca/notificações → Auditoria
```

Cada transição registra `auditoria_logs` com `organization_id`, `tabela`, `registro_id`, `acao`, `dados_anteriores/novos`, `executado_por`, `user_id` (33 ações canônicas).
