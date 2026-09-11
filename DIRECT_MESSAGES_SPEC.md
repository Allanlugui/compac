# SGA-M 2.0 — DIRECT MESSAGES SPEC (FASE 9.0)

**Fonte:** Nenhum chat existe. `notificacoes` é 1-way (sistema→usuário), não 1:1.

## 1. Arquitetura

**Tabelas novas (FASE 9.5):**

```sql
create table conversas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table conversa_participantes (
  conversa_id uuid references conversas(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  organization_id uuid not null, -- denormalizado para RLS
  last_read_at timestamptz,
  primary key (conversa_id, user_id)
);
create table mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas(id) on delete cascade,
  organization_id uuid not null,
  sender_id uuid not null references profiles(id),
  conteudo text not null check (char_length(conteudo) between 1 and 2000),
  created_at timestamptz default now()
);
-- RLS tenant-scoped + participante
alter table conversas enable row level security;
alter table conversa_participantes enable row level security;
alter table mensagens enable row level security;
-- Policies: eh_membro(organization_id) AND exists (select 1 from conversa_participantes where conversa_id=... and user_id=auth.uid())
```

- **1:1 apenas** (FASE 9.5): `conversa_participantes` exatamente 2 linhas por `conversa_id`. Grupo não nesta fase.
- **Tenant-scoped:** `organization_id` denormalizado, RLS `eh_membro` + `participante`.

## 2. Fluxo

1. `A` clica `Enviar mensagem` no organograma/perfil de `B` → `POST /admin/mensagens/actions.ts` `criarOuObterConversa(A,B,orgId)` → `select` se já existe conversa com ambos, senão `insert conversas` + 2 `participantes`.
2. `A` envia `conteudo` → `insert mensagens` + `update conversas.updated_at` + `gerarNotificacaoIdempotente` para `B` (`tipo: mensagem_recebida`, `link: /admin/mensagens/[id]`).
3. `B` abre `/admin/mensagens` → lista `conversas` onde `user_id=auth.uid()` order `updated_at desc`, badge `unread = count mensagens where created_at > last_read_at`.
4. `B` abre conversa → `update conversa_participantes last_read_at = now()` + `notificacoes` `marcarLida`.

## 3. RLS

- `conversas` SELECT: `eh_membro(organization_id) AND exists participante`.
- `mensagens` SELECT/INSERT: `eh_membro(organization_id) AND exists participante do conversa_id`.
- Cross-tenant: `A` de `org1` não vê `conversa` de `org2` (orgId diferente).

## 4. UI

**Rota:** `/admin/mensagens` (lista) + `/admin/mensagens/[id]` (chat) — `requireOrg`, sem `exigirPermissao` (todos podem conversar).

**Componentes:**
- `MensagensList.tsx` (conversas com avatar, nome, last message, unread, `updated_at`).
- `ChatWindow.tsx` (mensagens paginadas `limit 50`, `created_at asc`, `conteudo`, `sender_id` → bubble left/right, `read` check).
- `SinoNotificacoes` já existe — adicionar `tipo mensagem_recebida` com `link`.

## 5. Integração notificações/auditoria

- Reusa `src/lib/notificacoes.ts` `gerarNotificacaoIdempotente` (janela 5min para mensagens).
- Auditoria: `registrarLog` `tabela='mensagens'`, `acao='INSERT'`, `organization_id`, `user_id` (não logar conteúdo, apenas `mensagem enviada`).

## 6. Storage

- Sem anexo nesta fase (1:1 texto). Futuro: `o/{orgId}/mensagens/{conversaId}/...` com `midia_org_*`.

## 7. Dependências

- `profiles` + `memberships` (organograma), `notificacoes`, `auditoria_logs`, `storage` (avatar).
