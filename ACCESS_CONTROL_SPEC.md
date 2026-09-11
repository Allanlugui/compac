# SGA-M 2.0 — ACCESS CONTROL SPEC (FASE 9.1)

**Data:** 2026-09-09 | **Estado:** `FASE 9.1 — CONCLUÍDA` (sem commit, sem produção)

## 1. Princípio

Deny-by-default: `ROLE → PERMISSION → ROUTE → ACTION → RECORD SCOPE → RLS` — UI + Server + RLS coerentes.

## 2. Roles

6 tenant-scoped `ADMIN/GESTOR/TECNICO/COMPRAS/AUDITOR/SOLICITANTE` (`src/lib/types.ts:445`), sem `SYSTEM_ROOT`.

## 3. Matriz Role → Permission → Route

| Rota | Permission exigida (server) | Roles | Tabelas | Links |
|---|---|---|---|---|
| `/admin/dashboard` | `requireOrg` (todos, custos ocultos para SOLICITANTE) | TODOS | 18 queries analytics | → ativos, chamados, estoque, etc. |
| `/admin/ativos` | `ativos.ver` | ADMIN,GESTOR,TECNICO | ativos, categorias, localidades | |
| `/admin/ativos/[id]` | `ativos.ver` | ADMIN,GESTOR,TECNICO | ativos, chamados, etc. | |
| `/admin/chamados` | `chamados.ver` | TODOS | chamados | |
| `/admin/chamados/novo` | `chamados.criar` | ADMIN,GESTOR,TECNICO | ativos | |
| `/admin/chamados/[id]` | `chamados.ver` (FIX 9.1) | TODOS | chamados, compras, etc. | |
| `/admin/chamados/[id]/os` | `os.ver` (FIX) + bug `compras.chamado_id` | ADMIN,GESTOR,TECNICO,AUDITOR | chamados, compras (fix) | |
| `/admin/ordens-servico` | `os.ver` | ADMIN,GESTOR,TECNICO,AUDITOR | chamados | |
| `/admin/preventivas` | `preventiva.ver` | ADMIN,GESTOR,TECNICO | planos | |
| `/admin/calendario` | `chamados.ver` (FIX) | TODOS (via chamados) | chamados, planos | |
| `/admin/estoque` | `estoque.ver` (FIX) | ADMIN,GESTOR,COMPRAS,TECNICO,AUDITOR | produtos, movimentacoes | |
| `/admin/compras` | `compras.ver` (FIX) | ADMIN,GESTOR,COMPRAS,AUDITOR | compras, pedidos | |
| `/admin/compras/solicitacoes` | `solicitacoes.ver` | TODOS | solicitacoes (SOLICITANTE scope) | |
| `/admin/compras/solicitacoes/nova` | `solicitacoes.criar` | ADMIN,GESTOR,COMPRAS,TECNICO,SOLICITANTE | produtos | |
| `/admin/compras/solicitacoes/[id]` | `solicitacoes.ver` (FIX) + scope SOLICITANTE | TODOS (scope) | solicitacoes, itens, etc. | |
| `/admin/compras/pedidos/[id]` | `compras.ver` | ADMIN,GESTOR,COMPRAS,AUDITOR | pedidos | |
| `/admin/fornecedores` | `fornecedores.ver` (FIX) | ADMIN,GESTOR,COMPRAS,TECNICO,AUDITOR | fornecedores | |
| `/admin/relatorios` | `auditoria.ver` (FIX) | ADMIN,GESTOR,AUDITOR | analytics 18 queries | |
| `/admin/mapa` | `ativos.ver` (FIX) | ADMIN,GESTOR,TECNICO | localidades, ativos | |
| `/admin/busca` | `chamados.ver` (FIX) | TODOS (filtrado) | busca 9 tabelas filtradas por role | |
| `/admin/estrutura` | `estrutura.ver` (FIX: antes `escrever` bloqueava leitura) | TODOS | localidades, categorias | |
| `/admin/usuarios` | `usuarios.administrar` | ADMIN | memberships, profiles | |
| `/admin/auditoria` | `auditoria.ver` | ADMIN,GESTOR,AUDITOR | auditoria_logs | |
| `/admin/monitoramento` | `auditoria.ver` (FIX) | ADMIN,GESTOR,AUDITOR | organizations, storage | |
| `/admin/notificacoes` | `requireOrg` (scoped user_id) | TODOS | notificacoes | |
| `/admin/qr-compras` | `compras.criar` | ADMIN,GESTOR,COMPRAS | qr_contextos | |

## 4. Record Scope

- `SOLICITANTE` `solicitacoes.ver`: `created_by = auth.uid() OR solicitante = email` (page `solicitacoes` e `solicitacoes/[id]`).
- `SOLICITANTE` `chamados.ver`: `solicitante = email` em busca, dashboard sem custos.
- `TECNICO` `os.ver`: `os_status` filtrado por `responsavel/equipe` (futuro, não implementado 9.1).
- `GESTOR`: subtree via `manager_id` (futuro 9.5).

## 5. Dados sensíveis

- `custo` (`produtos.custo_medio`, `chamados.custo_*`, `compras.valor_total`, `dashboard N4`, `estoque.valorFisico`, `relatorios`, `busca`) — bloqueado para `SOLICITANTE` (dashboard N4 oculto, busca não retorna `produtos`/`fornecedores`/`compras`/`pedidos`, estoque `ver` false).
- `email/telefone/matricula` — só `ADMIN` via `usuarios`.

## 6. Actions

83 actions, 42 com `exigirPermissao` → após 9.1: `+7` fixes (`vincularFornecedor`, `desvincularFornecedor`, `atualizarProduto`, `criarUnidade`, `marcarQrImpresso` com `registrarLog`; `estrutura.ver` nova). `atualizarStatus` não órfã (usada em `StatusControl` + `TriagemForm`). `processarNotaFiscal` validado (tenant + perm `estoque.movimentar`).

## 7. RLS

`eh_membro(organization_id)` + `tem_papel` em 36 tabelas, `storage` PRIVATE 3 `midia_*`, `audit_select` `((org AND eh_membro) OR (org IS NULL AND tabela='sessao'))`, `enforce_same_org` 14 triggers. UI+Server+RLS coerentes.

## 8. Testes

- `tests/role-access.test.ts` 11 (permission matrix, deny-by-default, estrutura.ver, custos, cross-role).
- Cross-tenant: `hardening.test.ts` 12 + `hardening-storage-audit` 8 + `rls-isolation` 19.
- Direct URL: `SOLICITANTE` tenta `/admin/auditoria` → `exigirPermissao` throw → 403 (testado via `role-access`).
- Direct Action: `SOLICITANTE` chama `exigirPermissao` `os.executar` → throw.
- Total: 135 → 146 (11 novos), lint 0, tsc 0, build 0.

## 9. Dependências 9.2+

`src/lib/permissoes.ts` (nova `estrutura.ver`), `src/app/admin/**` (10 gates), `src/lib/storage.ts` (reuso), `src/app/admin/_actions/busca.ts` (role filter), `src/app/admin/dashboard/page.tsx` (cost hide).

## 10. Produção

NÃO TOCADA (sem commit/push/migration, `git diff` mostra apenas 9.1).

