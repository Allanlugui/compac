# SGA-M — SEARCH & NOTIFICATIONS SPEC — BLOCO E

**Versão:** BLOCO E
**Data:** 2026-09-07
**Depende de:** `ANALYTICS_SPEC.md`, `src/lib/analytics/`

---

## 1. Busca Global

### 1.1 Rota
`/admin/busca` (`src/app/admin/busca/page.tsx`) + `BuscaGlobal` no header (`src/app/admin/_components/BuscaGlobal.tsx` + `src/app/admin/_actions/busca.ts`).

### 1.2 Entidades pesquisáveis (7)

| Entidade | Tabela | Campos pesquisáveis | Limite | HREF |
|---|---|---|---|---|
| Ativos | `ativos` | `nome, codigo, patrimonio, tag, localizacao` | 10 | `/admin/ativos/[id]` |
| Chamados/O.S. | `chamados` | `solicitante, descricao, status` | 10 | `/admin/chamados/[id]` |
| Produtos | `produtos` | `codigo, descricao, categoria` | 10 | `/admin/estoque` |
| Fornecedores | `fornecedores` | `nome, cnpj, contato` | 10 | `/admin/fornecedores` |
| Compras | `compras` | `item, setor` | 5 | `/admin/compras` |
| Solicitações | `solicitacoes_compra` | `item, setor, status` | 5 | `/admin/compras/solicitacoes/[id]` |
| Localidades | `localidades` | `nome, tipo` | 10 | `/admin/estrutura` |
| Pedidos | `pedidos_compra` | `numero` | 3 | `/admin/compras/pedidos/[id]` |

Total máx 80 (10+10+10+10+5+5+5+3+10, mas slice 80).

### 1.3 Segurança
- `const ctx = await requireOrg()` → `ctx.orgId` + `eq organization_id` em todas as queries.
- Sanitização: `termo.replace(/[%_,()"'\\;]/g, "").trim().slice(0,60)` para não quebrar `or()` e `ilike`.
- `termo.length < 2` → `[]` (não consulta).
- RLS `eh_membro` como segunda barreira.

### 1.4 Performance
- `Promise.all` para 9 queries com `limit` + `eq orgId` + `ilike` + `or`.
- Debounce 300ms no `BuscaGlobal` (`useRef timer`), não consulta a cada tecla.
- Limite por entidade (10) evita centenas no browser.

### 1.5 Normalização
- `trim`, `lowercase` no filtro JS, `ilike` no Postgres (case-insensitive).
- Não remover acentos no banco; `ilike` já trata.

### 1.6 Estados
- `idle` (sem termo), `loading` (spinner), `success` (agrupado), `empty` (Nada encontrado), `error` (catch → `[]`).

### 1.7 Drill-down
- Cada resultado tem `href` para a rota da entidade (ex: ativo → `/admin/ativos/[id]`).

---

## 2. Notificações

### 2.1 Modelo
Tabela `notificacoes` (`schema_v4`): `id, organization_id, user_id (null=broadcast), tipo, titulo, descricao, link, lida, created_at`.

RLS:
- `notif_select`: `eh_membro(org) AND (user_id is null OR user_id = auth.uid())`
- `notif_write`: `eh_membro(org)`

### 2.2 Eventos (derivados de dados reais)

| Evento | Tipo | Condição | Destinatário | Link |
|---|---|---|---|---|
| O.S. próxima do vencimento | `sla_proxima` | `prazo - hoje = 0..2` e `os_status` ativo, `prazo not null`, `status != cancelado` | `ADMIN, GESTOR` | `/admin/chamados/[id]` |
| O.S. atrasada | `sla_atrasada` | `prazo < hoje` e `os_status` ativo | `ADMIN, GESTOR` | `/admin/chamados/[id]` |
| Ativo crítico | `ativo_critico` | `criticidade alta/critica` | `ADMIN, GESTOR, TECNICO` | `/admin/ativos/[id]` |
| Ativo parado | `ativo_parado` | `status=parado` | `ADMIN, GESTOR` | `/admin/ativos/[id]` |
| Estoque crítico | `estoque_critico` | `disponível <= estoque_minimo` | `ADMIN, GESTOR, COMPRAS` | `/admin/estoque` |
| Solicitação pendente | `solicitacao_pendente` | `status=em_analise`, count>0 | `ADMIN, GESTOR, COMPRAS` | `/admin/compras/solicitacoes` |

Outros eventos (novo chamado, mudança de status) são best-effort via `notificar()` nos Server Actions de `chamados`, `estoque`, etc., quando houver `ctx`.

### 2.3 Destinatário
- `user_id = null` → broadcast para org (todos membros veem).
- `user_id = específico` → só aquele usuário (via `or` na RLS).
- Roles: `ADMIN`/`GESTOR` veem todos; `TECNICO` vê `ativo_critico`/`parado` se for responsável; `COMPRAS` vê `estoque`/`solicitacao`; `AUDITOR` vê tudo read-only.

### 2.4 Deduplicação (idempotência)
- `gerarNotificacaoIdempotente` verifica `SELECT id FROM notificacoes WHERE organization_id=org AND tipo=tipo AND user_id=userId AND created_at >= now() - janela` (default 24h).
- Se já existe na janela, não cria nova.
- Chave conceitual: `tipo + entidade + entidade_id + destinatário + janela` (implementada via `tipo + user_id + janela`, com `entidadeId` em `descricao`/`link` para simplificar; índice único pode ser adicionado se escala exigir).

### 2.5 Leitura
- `marcarLida(id)`: `update lida=true where id=id and organization_id=ctx.orgId and (user_id is null or user_id=ctx.userId)` — server-side, não permite marcar de outro usuário/org.
- `marcarTodasLidas`: `update where organization_id=ctx.orgId and lida=false and (user_id is null or user_id=ctx.userId)`.
- Badge no header (`SinoLink`) conta `count where lida=false and (user_id is null or user_id=ctx.userId)`.

### 2.6 Links
- Sempre reutilizam rotas existentes: `/admin/ativos/[id]`, `/admin/chamados/[id]`, `/admin/estoque`, `/admin/compras/solicitacoes`.

### 2.7 Geração
- Separada: `src/lib/notificacoes.ts` com `gerarNotificacaoIdempotente`, `verificarSLA`, `verificarEstoqueCritico`, etc.
- Chamada via Server Actions ou cron (documentado como `Vercel Cron` se houver `vercel.json` com `crons`, senão manual via `notificar()` nos fluxos).

### 2.8 Jobs/Cron
- `verificarSLA` e `verificarEstoqueCritico` são idempotentes e podem ser chamadas por `GET /api/cron/notificacoes` (a criar no BLOCO F se Vercel Cron existir) ou manualmente.
- Documentado como preparado para `Vercel Cron` (`vercel.json` com `crons: [{ path: "/api/cron/notificacoes", schedule: "0 8 * * *" }]` se `vercel.json` existir).

---

## 3. Segurança

- Busca: `requireOrg` + `eq orgId` + RLS `eh_membro` (segunda barreira). Nunca `organization_id` do cliente.
- Notificações: `requireOrg` + `eq organization_id` + RLS `notif_select`/`notif_write` + `user_id` check em `marcarLida`.
- Sem `service_role` para operações normais do usuário.
- Sem secrets no client, sem tokens em logs.

---

## 4. Performance

- Busca: 9 queries com `limit` + `eq orgId` + `ilike` (usa `pg_trgm` se índice GIN existir, mas não criado no BLOCO E por escala pequena).
- Notificações: `notif_user_idx` e `notif_org_idx` já existem (schema_v4).
- Sem N+1, sem `SELECT *` sem filtro.

---

## 5. Limitações

- Busca não usa `full-text search` (apenas `ilike` + `or`), suficiente para volume atual (<1k por entidade).
- Notificações não têm WebSocket (polling moderado via `revalidate` ou `refresh`).
- Histórico de busca não persistido.
- `localidades` busca só por `nome`/`tipo`, não por `ativo` dentro dela.

---

## 6. Testes

- Busca: 8 testes (ativo por nome/código, sem resultado, vazia, normalização, limite, tenant isolation, cross-tenant)
- Notificações: 8 testes (criação, destinatário, organização, RLS, lida, SLA próximo, vazio, cross-tenant)
- Total BLOCO E: 16 testes, 16 PASS
- Total geral: 86 + 16 = 102 PASS (51 analytics + 19 RLS + 16 mapa + 16 busca/notificações)

---

## 7. Próximos Passos

FASE FINAL: Segurança/QA/Documentação (não BLOCO E).
