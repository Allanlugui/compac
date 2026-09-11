# SGA-M 2.0 — ROLE UX SPEC (FASE 9.0)

## 1. Shell comum

`RoleDashboard` (`src/app/admin/dashboard/page.tsx` como base) — `PageHeader` + `Card` + `BarList` + filtros `periodo` BRT. Todos os perfis usam mesmo shell, componentes específicos por `role`.

## 2. Proposta por perfil

### ADMIN — Dashboard Global
- Visão: todos KPIs 15, equipes, hierarquia, avaliações, auditoria, monitoramento.
- Acesso: todas rotas, `usuarios.administrar`, `auditoria.ver`, `estrutura.escrever`.
- Widgets: `Total Ativos`, `Backlog OS/Demanda`, `SLA`, `MTTR/MTBF`, `Custo Total`, `Top Ativos`, `Organograma` mini, `Avaliações pendentes`.

### GESTOR — Minha Gestão
- Visão: equipe (subordinados), `desempenho equipe` AVG score, `backlog`, `preventivas`.
- Acesso: `chamados/os/ativos/estoque/compras/fornecedores/relatórios/mapa/usuarios?` (não `usuarios.administrar`).
- Rota: `/admin/gestao` (nova) — `requireOrg` + `pode(GESTOR/ADMIN)`.

### TECNICO — Minha Operação (mobile first)
- Visão: `Minhas O.S.` (`os_status` atribuída/em_execucao), `O.S. concluídas`, `tempo execução`, `SLA`, `checklist`, `consumo`, `mensagens`.
- Acesso: `ativos.ver`, `chamados.ver/executar`, `os.ver/executar`, `estoque.ver/movimentar`, `checklists.escrever`.
- Rota: `/admin/operacao` — lista O.S. com `Camera`/`QR`/`FotoAnexoInput`, `GaleriaFotos`.

### COMPRAS — Suprimentos
- Visão: `solicitações` → `cotações` → `pedidos` → `recebimentos`, `fornecedores`, `volume`, `divergência`.
- Acesso: `compras.*`, `solicitacoes.*`, `estoque.*`, `fornecedores.*`.
- Rota: `/admin/suprimentos` — Kanban solicitações.

### AUDITOR — Conformidade
- Visão: `auditoria_logs`, `pendências`, `acessos`, `controles`, sem `os.executar`.
- Acesso: `auditoria.ver`, `compras.ver`, `estoque.ver`, `os.ver` (read-only).

### SOLICITANTE — Minhas Solicitações
- Visão: `minhas solicitações` (`created_by=auth.uid()`), `tempo resposta`, `cancelamentos`.
- Acesso: `chamados.ver`, `solicitacoes.ver/criar`, `ativos.ver?` (não).

### Perfil — Meu Perfil
- Rota: `/admin/perfil` — foto `avatar_url` (signed URL), `nome`, `telefone`, `cargo`, `matricula`, `setor/departamento` (memberships), `preferencias`, `senha`.

## 3. Menu → Role

| Rota | ADMIN | GESTOR | TECNICO | COMPRAS | AUDITOR | SOLICITANTE |
|---|---|---|---|---|---|---|
| Dashboard (global) | ✅ | ✅ | — | — | — | — |
| Minha Gestão | — | ✅ | — | — | — | — |
| Minha Operação | — | — | ✅ | — | — | — |
| Suprimentos | — | — | — | ✅ | — | — |
| Conformidade | — | — | — | — | ✅ | — |
| Minhas Solicitações | — | — | — | — | — | ✅ |
| Meu Perfil | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Organograma | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mensagens | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Deny-by-default: sem `role` → `/sem-acesso`.

## 4. Acessibilidade & Mobile

- Técnico: `BottomNav` com `Operação`, `Chamados`, `Camera`, `Mensagens` (320×568).
- Gestor/Admin: desktop `SidebarNav` com `Organograma` + `Mensagens`.
- Todos: `pode()` + `exigirPermissao()` + RLS.

