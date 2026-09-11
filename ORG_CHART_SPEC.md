# SGA-M 2.0 — ORG CHART SPEC (FASE 9.0)

**Fonte:** `profiles` + `memberships` (sem hierarquia), `localidades` (física, não pessoas)

## 1. Modelo recomendado

**Relação superior/subordinado pertence à organização (tenant-scoped), não ao usuário global.**

```sql
-- FASE 9.1
alter table memberships add column if not exists manager_id uuid references memberships(id) on delete set null;
create index if not exists memberships_manager_idx on memberships(manager_id);
-- Prevenir ciclo: trigger check
```

- `memberships.manager_id` aponta para `memberships.id` do superior **na mesma `organization_id`** (validado via `enforce_same_org` estendido).
- `profiles` não guarda hierarquia (evita vazamento cross-tenant via `auth.users`).
- `setor`/`departamento` em `memberships` já existem, usados para agrupar organograma.

**Exemplo:**
```
ADMIN (org1) ──> GESTOR Manutenção ──> TECNICO A, TECNICO B
              └─> GESTOR Compras ──> COMPRAS A
```

## 2. Validação

- **Ciclo:** `A→B→C→A` proibido via trigger `check_manager_cycle` (recursive CTE `WITH RECURSIVE`).
- **Tenant:** `manager_id` deve ter `organization_id = NEW.organization_id` (enforce_same_org).
- **Self:** `manager_id != id`.
- **Role:** qualquer role pode ser manager (ADMIN pode gerir GESTOR, GESTOR pode gerir TECNICO), mas UI filtra por `setor`.

## 3. UI Organograma

**Rota:** `/admin/organograma` (nova) — `requireOrg` + `pode(ADMIN/GESTOR)` para ver todos, `TECNICO/COMPRAS` veem apenas sua cadeia (subordinados + superior).

**Componente `OrgChartClient.tsx`:**
- Biblioteca: `reactflow` ou `d3-hierarchy` + `pan/zoom` (viewBox, `transform: translate/scale`, `wheel` + `drag`).
- Nós: `avatar_url` (signed URL), `nome`, `cargo`, `role` badge, `setor` cor.
- Filtros: `setor`, `departamento`, `role`, `busca nome`.
- Ações: click nó → `/admin/perfil/[id]` (ou modal `Meu Perfil`), `Enviar mensagem` (DM), `Ver equipe`.
- Permissões: `ADMIN` vê tudo, `GESTOR` vê sua subtree, `TECNICO` vê apenas superior + pares.

## 4. Queries

```sql
select m.id, m.role, m.manager_id, p.nome, p.avatar_url, p.cargo
from memberships m join profiles p on p.id=m.user_id
where m.organization_id = $1 and m.status='ativo';
```

Construir árvore JS: `Map<manager_id, Membership[]>` + `coletarDescendentes` (igual `MapaClient`).

## 5. Integração operação

- Organograma filtra `chamados`/`ativos` por `responsavel`/`equipe` (ex: GESTOR vê O.S. da sua equipe).
- `Mapa` já usa `localidades` física — organograma usa `memberships` hierarquia pessoas, não confundir.

## 6. RLS

- `memberships` já tem `eh_membro(organization_id)` — organograma reusa. `manager_id` validado via trigger, não via RLS adicional.

## 7. Riscos

- Ciclo se trigger falhar → travar UI. Mitigar com `MAX_DEPTH 10` e `visited Set`.
- `ADMIN` com muitos subordinados → paginação `limit 100` + `virtualized`.

## 8. Dependências

- `src/app/admin/usuarios/*`, `src/lib/permissoes.ts`, `src/app/admin/_components/AdminNav.tsx`
