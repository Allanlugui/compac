# SGA-M 2.0 — UPGRADE AUDIT (FASE 9.0)

**Data:** 2026-09-09 | **Estado:** `FASE 9.0 — AUDITORIA CONCLUÍDA` | **Branch:** `master` `d1b9c4a` | **Produção:** `03b1319b...` 1 org

## 1. Perfis

6 roles (`ADMIN/GESTOR/TECNICO/COMPRAS/AUDITOR/SOLICITANTE`) em `types.ts:445`, sem `SYSTEM_ROOT`. Matriz 34 permissões `permissoes.ts:15`.

## 2. Rotas

27 rotas `src/app/admin/**` (26 pages + layout), `vercel.json` cron, 2 públicas `qr/[hash]`. 10 rotas sem `exigirPermissao` (alta: `chamados/[id]/os` bug `compras.id` vs `chamado_id`, `compras`, `relatorios`, `monitoramento`).

## 3. Permissões

`PERMISSOES` 34, `exigirPermissao` 42/83 actions, `pode` UI. Gap: `estrutura/page.tsx` bloqueia leitura.

## 4. Dashboards

15 KPIs `analytics` (KPI-01..15), `dashboard/page.tsx` 18 queries, estados `ok/empty/insufficient_data`. Proposta 6 dashboards específicos (ver `ROLE_UX_SPEC.md`).

## 5. Métricas

Existentes: 13/15 (MTBF/Disponibilidade `insufficient_data`). Faltantes: desempenho por perfil (ver `PERFORMANCE_SPEC.md`).

## 6. Hierarquia

Não existe `manager_id` (ver `PROFILE_SPEC.md` + `ORG_CHART_SPEC.md`). Modelo: `memberships.manager_id FK memberships` tenant-scoped + trigger anti-ciclo.

## 7. Organograma

Arquitetura `reactflow` + `pan/zoom`, nós avatar+nome+cargo, filtros setor, ver `ORG_CHART_SPEC.md`.

## 8. Perfil

`profiles` 8 cols (id,nome,telefone,cargo,matricula,avatar_url,ultimo_acesso,created_at) + `memberships.role/setor/departamento`. Proposta `Meu Perfil` `/admin/perfil`.

## 9. Mensagens

0 chat existe. Proposta 1:1 `conversas` + `conversa_participantes` + `mensagens` (ver `DIRECT_MESSAGES_SPEC.md`), tenant-scoped, RLS `eh_membro` + participante, `notificacoes` reuse.

## 10. Banco

36 tabelas, 75 policies, 14 triggers, 3 RPCs. Novas: `memberships.manager_id`, `avaliacoes`, `metricas_cache`, `conversas` etc. (ver specs).

## 11. Segurança

RLS `eh_membro`/`tem_papel`, `enforce_same_org`, `storage` PRIVATE 3 `midia_*`, `audit_select` `((org AND eh_membro) OR (org IS NULL AND tabela='sessao'))`.

## 12. Dependências (FASE 9.1+)

`src/lib/permissoes.ts`, `src/app/admin/_components/AdminNav.tsx`, `src/app/admin/dashboard/page.tsx`, `src/lib/analytics/*`, `src/lib/notificacoes.ts`, `src/lib/auditoria.ts`, `src/lib/storage.ts`, `src/app/admin/usuarios/*`, `src/app/admin/estrutura/*`, `src/app/admin/mapa/*`.

## 13. Riscos

- 10 rotas sem `exigirPermissao` (custo/SLA vazam para SOLICITANTE).
- `chamados/[id]/os` bug `compras.id`.
- `SOLICITANTE` vê `produtos` custo.
- MTBF/Disponibilidade sempre `insufficient_data` em tenant novo.

## 14. Pontas soltas

- `Card.tsx` órfão (BAIXO), `atualizarStatus` órfã (média), `monitoramento`/`qr-compras` sem menu (média), `estrutura` leitura bloqueada (média).

## 15. Próximos passos (9.1-9.8)

`9.1 Segurança + matriz` → `9.2 Perfis` → `9.3 Dashboards` → `9.4 Desempenho` → `9.5 Organograma` → `9.6 Mensagens` → `9.7 Integração` → `9.8 QA`

**Não implementar, não commitar, não migrar produção nesta fase.**
