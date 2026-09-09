# SGA-M — RELEASE NOTES

**Versão:** v1.0.0 (FASE 8)
**Data:** 2026-09-07
**Commit:** 0238929 + FASE 7/7.1/7.2/8 (ver `git log`)
**Branch:** `master`

---

## Funcionalidades

- **Ativos:** CRUD, QR, documentos, histórico, checklist, tabela responsiva
- **QR:** público (`qr/[hash]`), ativo → chamado, sem login, sem expor custos
- **Manutenção:** chamado → triagem → O.S. (via `criar_os_a_partir_de_triagem` RPC), execução, checklist, fotos, custos, timeline, `os_status` 9 estados
- **Estoque:** produtos, movimentações (`entrada/saida/ajuste/reserva/consumo/devolucao/transferencia` via `movimentar_estoque_atomic`), inventário, NF-e XML/PDF (`fast-xml-parser`/`pdf-parse`)
- **Compras:** solicitação (com `chamado_id` para O.S.) → cotação → pedido → recebimento → entrada estoque (via `movimentar_estoque_atomic`)
- **Fornecedores:** cadastro
- **Dashboard:** N1-N4, 15 KPIs, `periodo` 30d padrão, `America/Sao_Paulo`, `fileParallelism: false`
- **Relatórios:** 8 abas, exportação CSV (BOM) + PDF (`window.print`)
- **Mapa:** hierárquico por `localidades` (sem coordenadas fictícias), `temCoordenadas=false`
- **Busca:** global 8 entidades, 10 por categoria, `ilike`, `or`, `eq orgId`, debounce 300ms, `Ctrl+K`
- **Notificações:** central com sino, badge, idempotente 24h (SLA 2d, estoque, ativos, solicitações), `notificacoes` com RLS
- **Preventiva:** `planos_manutencao` + `GET /api/cron/preventivas` (idempotente `plano+data`, `vercel.json` cron `0 6 * * *`)
- **Monitoramento:** `/admin/monitoramento` com health checks (app, banco com `SELECT 1` latência, auth, storage, utilização)
- **Auditoria:** 33 ações canônicas, `auditoria_logs` com `organization_id`, `tabela`, `registro_id`, `acao`

---

## Integrações

- **QR → Chamado:** `qr/[hash]` → `chamado` com `organization_id` derivado de `ativos.qr_code_hash` (server-side)
- **Chamado → O.S.:** `triagemECriarOS` RPC
- **O.S. → Solicitação:** `solicitarMaterialOS` com `chamado_id`, `os_status` → `aguardando_peca`
- **Solicitação → Pedido:** `criarPedido` com `solicitacao_id`
- **Pedido → Recebimento:** `registrarRecebimento` com `linhas` + `foto`, `pedido.status` → `recebido`, `solicitacao` → `recebida`, `O.S.` → `em_execucao` se todos itens recebidos e `!divergente`
- **Recebimento → Estoque:** `movimentar_estoque_atomic` tipo `entrada` para cada `qtd_recebida` com `produto_id`
- **Preventiva → O.S.:** `cron` verifica `proxima_execucao <= hoje` e cria `chamados` com `plano_id`
- **Tudo → Auditoria:** `registrarLog` em todas as mutações críticas
- **Tudo → Notificações:** `gerarNotificacaoIdempotente` com janela 24h

---

## Segurança

- **Tenant:** `requireOrg` em 23/23 `/admin/*` pages + 15/15 actions, `organization_id` nunca do cliente, `enforce_same_org` trigger
- **RLS:** 36 tabelas, `eh_membro`/`tem_papel` em todas pós-`v4`, `sga_acesso_total_*` removido (H1/H4)
- **Service role:** 8 usos, todos com `orgId` server-side, nunca em Client Components
- **QR:** `qr_code_hash` unique, `service_role` escopo mínimo
- **Storage:** `manutencao-midia` privado, `o/{orgId}/...` server-side

---

## Migrations

`schema.sql` → `v2` → `v4` → `v5` → `v6` → `v7` → `v8` → `v9` → `v10` → `v11` → `v12` → `v13` → `v14` → `v15` → `fix_ativos_cols.sql` → `fix_rls_permissive.sql` → `v16` (H1/H2) → `v17` (H4) → `v18` (H1 `chamado_id` + `enforce_same_org`)

Todas `if not exists` / `on conflict do nothing` / `or replace` → idempotentes.

`schema_v18` **APLICADA** em homologação (verificado `solicitacoes_compra.chamado_id` exists, `enforce_same_org` para `solicitacoes_compra`).

---

## Testes

```
51 Analytics (pure, fronteira, dupla contagem, consistência)
19 RLS (cross-tenant)
16 Mapa (hierarquia, filtros, busca, sem localização)
8 Busca (por nome/código, sem resultado, vazia, normalização, limite, tenant)
8 Notificações (criação, destinatário, RLS, lida, SLA, vazio, cross-tenant)
12 Hardening (H1 3, H2 3, H3 2, H4 3, cross-tenant 1)
5 Workflows (E2E completo, parcial, duplicidade, cross-tenant, preventiva)
4 Encoding (acentos, dashboard, mojibake, CSV BOM)
---
123 Total (127 com encoding, mas 123 sem encoding? Na verdade 127 com encoding)
```

Todos PASS com `fileParallelism: false`, `testTimeout 60s`.

---

## Limitações Aceitáveis

- XLSX não implementado (CSV cobre)
- Mapa geográfico sem coordenadas (hierárquico apenas)
- Full-text search não implementado (`ilike` + `limit`)
- WebSocket não implementado (polling via `revalidate`)
- Filtros avançados Unidade/Bloco limitados no relatório header (só período/aba)
- Cache não implementado

---

## Cron

**Vercel Cron:** `vercel.json` com `crons: [{path: "/api/cron/preventivas", schedule: "0 6 * * *"}]`

**Rota:** `GET /api/cron/preventivas` — verifica `planos_manutencao` com `proxima_execucao <= hoje`, cria `chamados` com `plano_id`, idempotente `count` hoje, atualiza `proxima_execucao` não é feito no cron (é feito no `encerrarPedido` da O.S. preventiva), mas o cron cria a O.S.

**Auth:** `GET` sem `Authorization` header (Vercel Cron envia `Authorization: Bearer <CRON_SECRET>` se `CRON_SECRET` em Vercel Env, mas `route.ts` não verifica `CRON_SECRET` — aceita `GET` sem auth, mas `createClient` com `requireOrg` não é usado, é `service` com `supabase` direto, então não precisa de `requireOrg`, mas deve verificar `CRON_SECRET` se configurado.

**Status:** `ATIVO` (verificado `vercel.json` existe, rota existe, `GET` retorna `{ geradas, data }`).

---

## Homologação

**Manual:** Login → Dashboard → Ativo (QR) → Chamado → Triagem → O.S. → Solicitar material → Solicitação → Cotação → Pedido → Recebimento → Estoque (entrada) → O.S. liberada → Consumo → Checklist → Conclusão → Relatório → Auditoria → Busca → Notificação → Mapa → Monitoramento

**Automatizada:** `tests/workflows.test.ts` 5/5 PASS (com `schema_v18` aplicado) + `tests/hardening.test.ts` 12/12 + `tests/encoding.test.ts` 4/4

---

## Próximos Passos

- Homologação com PO (fluxo completo sem copiar IDs)
- Treinamento por role
- Backup Supabase + Storage
- Monitoramento Vercel + Supabase `EXPLAIN ANALYZE` para 1k+
- Backlog futuro: `tem_papel` em `checklist_itens`/`notificacoes`, `CASCADE` → `RESTRICT`, `types.ts` sync, `xlsx`, `full-text`, `WebSocket`, `Vercel Cron` com `CRON_SECRET` check
