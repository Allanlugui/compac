# ORPHAN FEATURES — SGA-M

## Páginas órfãs (existem mas sem menu/link principal)

| Rota | Arquivo | Categoria |
|---|---|---|
| `/admin/monitoramento` | `src/app/admin/monitoramento/page.tsx` | ORPHAN_ROUTE (só via URL) |
| `/admin/desempenho` | `src/app/admin/desempenho/page.tsx` | ORPHAN_ROUTE (só via RoleDashboard) |
| `/admin/qr-compras` | `src/app/admin/qr-compras/page.tsx` | ORPHAN_ROUTE (só via tab Compras) |
| `/admin/notificacoes` | `src/app/admin/notificacoes/page.tsx` | ORPHAN_ROUTE (só via sino) |

## Páginas 404 (link → rota inexistente)

| Link | Rota esperada | Status |
|---|---|---|
| `/qr/placeholder` | `/qr/[hash]` | 404 |
| `/qr-compra/nova` | `src/app/qr-compra/nova/page.tsx` | 404 |
| `/admin/perfil/[id]` | `src/app/admin/perfil/[id]/page.tsx` | 404 (CRÍTICO) |
| `#` em `desempenho/page.tsx:34` | — | placeholder |

## Actions órfãs

**0** — `Grep from "./actions"` 53 matches, todas importadas (ver 360 DB audit).

## Tabelas sem uso

| Tabela | RLS | Uso |
|---|---|---|
| `unidades_medida` | ✅ | 0 `supabase.from("unidades_medida")` em `src/` |
| `performance_evaluations` | ✅ | só leitura `desempenho/page.tsx:14` (insert nunca chamado) |

## Componentes órfãos

| Arquivo | Status |
|---|---|
| `src/components/ui/Card.tsx` | órfão (dashboard tem `function Card` local) |
| `src/app/admin/dashboard/RoleDashboard.tsx` `valor="—"` 3 cards | FAKE_DATA sem query |

## Libs mortas

- `src/lib/performance.ts:47` `qualidade=80` hardcoded
- `src/lib/hierarchy.ts` `getHierarchy` Storage JSON sem trigger (fora DB)

## Migrations não documentadas

- `schema_v19-22.sql` existem mas não em `MIGRATIONS_INVENTORY.md` original (atualizado em `7970daa`)

## Links bidirecionais faltantes

- `Ativo` → `Chamado` ✅, `Chamado` → `Ativo` ✅
- `Organograma` → `Perfil [id]` ❌ (404) → quebrado
- `Desempenho` → `O.S.` ✅ via `hrefBase`
