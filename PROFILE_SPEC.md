# SGA-M 2.0 — PROFILE SPEC (FASE 9.0)

**Fonte:** `src/lib/types.ts:687` `Profile`, `memberships` (FK `profiles.id → auth.users`), `src/app/admin/usuarios/*`, `src/lib/storage.ts`

## 1. Campos existentes

| Tabela | Coluna | Tipo | Nullable | Uso |
|---|---|---|---|---|
| `profiles` | `id` | uuid FK `auth.users` CASCADE | não | PK = `auth.users.id` |
| `profiles` | `nome` | text | sim | `MembrosManager.tsx` + `PageHeader` |
| `profiles` | `telefone` | text | sim | `usuarios` (não exibido em listagem) |
| `profiles` | `cargo` | text | sim | `MembrosManager` (ex: "Técnico Senior") |
| `profiles` | `matricula` | text | sim | `MembrosManager` |
| `profiles` | `avatar_url` | text | sim | `AdminNav` (inicial), `resolverFoto` com `manutencao-midia`? Atualmente `profiles.avatar_url` guarda `path` `o/{orgId}/...` ou URL legada |
| `profiles` | `ultimo_acesso` | timestamptz | sim | `usuarios` (não atualizado automaticamente) |
| `profiles` | `created_at` | timestamptz | não | — |
| `memberships` | `role` | text `ADMIN/GESTOR/TECNICO/COMPRAS/AUDITOR/SOLICITANTE` | não | `permissoes.ts` |
| `memberships` | `status` | text `ativo/inativo` | não | `eh_membro` check `status='ativo'` |
| `memberships` | `setor` | text | sim | `usuarios` (opcional, não usado em RLS) |
| `memberships` | `departamento` | text | sim | `usuarios` |
| `auth.users` | `email` | text | não | login, `inviteUserByEmail` |

**Não existe:** `manager_id`, `reports_to`, `parent_id`, `supervisor`, `bio`, `preferências`, `notificações`, `hierarquia`.

## 2. Hierarquia atual

**Não existe.** `memberships` não tem `manager_id`. `profiles` não tem `reports_to`. A única relação é `organizations → memberships → profiles → auth.users`. Estrutura física (`localidades`) é de ativos, não de pessoas.

## 3. Storage avatar

- Bucket `manutencao-midia` `PRIVATE` (hardening), `o/{orgId}/avatar/{userId}/...` não existe ainda; atualmente `avatar_url` é `path` qualquer `o/{orgId}/...` ou `null`.
- Upload via `src/lib/storage.ts` `uploadFotoAdmin(file,"geral",userId)` com `requireOrg` + `service_role`, `resolverFoto(path,orgId)` com `createSignedUrl 3600` + `orgIdEsperado` check — tenant isolation.
- Reuso: usar mesmo bucket `manutencao-midia` com prefixo `o/{orgId}/profiles/{userId}/avatar/` + policy `midia_org_*` (já cobre `o/`).

## 4. Proposta `Meu Perfil` (SGA-M 2.0)

**Rota:** `/admin/perfil` (nova) — `requireOrg` + sem `exigirPermissao` (próprio perfil)

**Seções:**
- Foto: `avatar_url` com `FotoAnexoInput` (max 1, 8MB, JPG/PNG/WebP), `resolverFoto`, `signed URL`.
- Dados profissionais: `nome`, `telefone`, `cargo`, `matricula`, `setor`, `departamento` (de `memberships`), `email` (read-only de `auth.users`).
- Preferências: `tema` (light/dark), `idioma` (pt-BR), `notificações` (email/push) — nova tabela `profile_prefs` ou coluna `profiles.preferencias jsonb`.
- Senha: `atualizar-senha` link.
- Hierarquia: `Superior` (manager) read-only, `Equipe` (subordinados) — vem de `memberships.manager_id` (futuro).

**Campos novos necessários (FASE 9.2):**
- `profiles.bio text`, `profiles.preferencias jsonb`, `profiles.avatar_url` já existe.
- `memberships.manager_id uuid FK memberships(id) ON DELETE SET NULL` — ver `ORG_CHART_SPEC.md`.

## 5. Migração

```sql
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists preferencias jsonb default '{}';
-- manager_id em ORG_CHART_SPEC
```

## 6. Dependências

- `src/app/admin/usuarios/MembrosManager.tsx` (edita `profiles` + `memberships`)
- `src/lib/storage.ts` (reuso)
- `src/app/admin/_components/AdminNav.tsx` (avatar)
