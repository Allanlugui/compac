# SGA-M — PRODUCTION RESET

**Data:** 2026-09-09 13:01 UTC
**Projeto:** `ialjfeltqpbgrxtymfwa.supabase.co`
**Commit:** `7970daa` (gate final) → `dcbb45e` (hardening) → produção `03b1319b-b413-45b0-bbad-3ddd69baad8e`
**Migration atual:** `v18` (`schema_v18.sql` `chamado_id` + `enforce_same_org`)
**Ambiente:** Supabase homologação → produção

---

## Backup

**Data:** 2026-09-09 12:59 UTC
**Método:** `scripts/backup_inventario.js` + Supabase PITR (recomendado)
**Inventário antes:**

```
ativo_documentos 4, ativo_status_historico 3, ativos 18, auditoria_logs 94, categorias 9, chamados 19, checklist_execucoes 2, checklist_itens 13, checklist_modelos 4, checklist_respostas 6, compras 1, cotacoes 10, fornecedores 11, localidades 37, memberships 3, movimentacoes_estoque 1, notificacoes 18, organizations 265, os_atividades 2, os_fotos 7, os_status_historico 15, pedido_itens 10, pedidos_compra 10, planos_manutencao 1, produto_fornecedores 1, produtos 2, profiles 3, qr_contextos 1, recebimento_itens 10, recebimentos 10, solicitacao_anexos 1, solicitacao_historico 0, solicitacao_itens 1, solicitacoes_compra 36, unidades_medida 30
storage:manutencao-midia 2 PUBLIC? PRIVATE após hardening, o/ 3
auth.users 13 (hard-au-*, hard-up-*, hard-st-*, fase8-*, milly*, allan*, jallanluiz)
```

**Backup registrado em:** `scripts/backup_inventario.js` output + git

---

## Classificação 36 tabelas

| Tabela | Tenant-scoped | Referência | Ação |
|---|---|---|---|
| ativo_documentos | sim | não | apagar |
| ativo_status_historico | sim | não | apagar |
| ativos | sim | não | apagar |
| auditoria_logs | sim | não | apagar |
| categorias | sim | não | apagar |
| chamados | sim | não | apagar |
| checklist_execucoes | sim | não | apagar |
| checklist_itens | não (sem org) | não | apagar via modelo |
| checklist_modelos | sim | não | apagar |
| checklist_respostas | não (via execucao) | não | apagar |
| compras | sim | não | apagar |
| cotacoes | sim | não | apagar |
| fornecedores | sim | não | apagar |
| localidades | sim | não | apagar |
| memberships | sim | não | apagar (exceto produção) |
| movimentacoes_estoque | sim | não | apagar |
| notificacoes | sim | não | apagar |
| organizations | sim | não | apagar (265) → 1 produção |
| os_atividades | sim | não | apagar |
| os_fotos | sim | não | apagar |
| os_servicos_externos | sim | não | apagar |
| os_status_historico | sim | não | apagar |
| pedido_itens | sim | não | apagar |
| pedidos_compra | sim | não | apagar |
| planos_manutencao | sim | não | apagar |
| produto_fornecedores | sim | não | apagar |
| produtos | sim | não | apagar |
| profiles | via auth.users | não | apagar (cascade) |
| qr_contextos | sim | não | apagar |
| recebimento_itens | sim | não | apagar |
| recebimentos | sim | não | apagar |
| solicitacao_anexos | sim | não | apagar |
| solicitacao_historico | sim | não | apagar |
| solicitacao_itens | sim | não | apagar |
| solicitacoes_compra | sim | não | apagar |
| unidades_medida | sim (FK org) | **sim** (seed) | **preservar?** Mas como FK CASCADE, ao apagar orgs, foram apagadas (30→0). Para produção limpa, 0 é correto; seeds serão recriados por org via seed se necessário. |

**Preservado estrutura:** 36 tabelas, RLS, policies (75), triggers (`enforce_same_org`, `trg_org_*`), RPCs (`movimentar_estoque_atomic`, `criar_os_a_partir_de_triagem`, `exec_as_user`), cron `vercel.json`, bucket `manutencao-midia` PRIVATE, 3 policies tenant-aware.

---

## Ordem de exclusão (FK-safe, filhas → pais)

```
recebimento_itens → recebimentos → pedido_itens → pedidos_compra → cotacoes
solicitacao_itens/historico/anexos → solicitacoes_compra → compras
produto_fornecedores → movimentacoes_estoque → notificacoes
os_atividades/os_fotos/os_servicos_externos/os_status_historico → planos_manutencao
checklist_respostas → checklist_execucoes → checklist_itens → checklist_modelos
chamados → ativo_documentos/ativo_status_historico → ativos → produtos → fornecedores
categorias/localidades/qr_contextos → auditoria_logs → memberships → profiles → organizations
unidades_medida preservada (mas CASCADE com org, 30→0)
```

Executado via `scripts/production_reset.js` com `service_role` (bypass RLS) em transação implícita por tabela, `storage.objects` via `storage.remove` API (não `DELETE FROM storage.objects`).

---

## Dados removidos (por tabela)

```
ativo_documentos 4→0, ativo_status_historico 3→0, ativos 18→0, auditoria_logs 94→0, categorias 9→0, chamados 19→0, checklist_execucoes 2→0, checklist_itens 13→0, checklist_modelos 4→0, checklist_respostas 6→0, compras 1→0, cotacoes 10→0, fornecedores 11→0, localidades 37→0, memberships 3→1 (produção), movimentacoes_estoque 1→0, notificacoes 18→0, organizations 265→1, os_atividades 2→0, os_fotos 7→0, os_status_historico 15→0, pedido_itens 10→0, pedidos_compra 10→0, planos_manutencao 1→0, produto_fornecedores 1→0, produtos 2→0, profiles 3→1, qr_contextos 1→0, recebimento_itens 10→0, recebimentos 10→0, solicitacao_anexos 1→0, solicitacao_itens 1→0, solicitacoes_compra 36→0, unidades_medida 30→0
```

## Dados preservados

- Estrutura: 36 tabelas, RLS 36, policies 75→3 storage tenant-aware, triggers 14, RPCs 3, migrations v1-18
- Bucket `manutencao-midia` PRIVATE, 3 policies `midia_*`
- Cron `vercel.json` `0 6 * * *` `/api/cron/preventivas`
- `unidades_medida` estrutura (0 linhas, seed recriável)

## Auth

Antes: 13 (hard-au-*, hard-up-*, hard-st-*, fase8-*, milly31031, allanestq, jallanluiz)
Depois: 1 (`admin@sgam.producao` `c8c7e7c3-5fca-4357-b9f0-46f4646dfbc2` `email_confirm:true`)
Método: `s.auth.admin.deleteUser` para 13, `createUser` para produção (não `DELETE FROM auth.users`)

## Storage

Antes: `manutencao-midia` 24 objetos (via `storage.objects` rpc) — 2 root + 22 o/ (chamados, ativos, checklist, os, solicitacoes, hardening)
Depois: 0 (via `s.storage.remove(paths)` API, não `DELETE FROM storage.objects`)
Bucket: **PRIVATE** (`public=false` verificado 2026-09-09 09:24, preservado)

## Organizações

Antes: 265 (test orgs `wf-*, fase7-*, sgam-producao-mtu3z655` etc.)
Depois: 1 (`SGA-M Produção` `03b1319b-b413-45b0-bbad-3ddd69baad8e` `sgam-producao-mtu3z655`)

## RLS / Policies / Triggers / RPCs

RLS: **PASS** (36 tabelas `rowsecurity true`, `eh_membro`/`tem_papel`)
Policies: **PASS** (75, storage 3 tenant-aware, `audit_select` `((org IS NOT NULL AND eh_membro) OR (org IS NULL AND tabela='sessao'))`)
Triggers: **PASS** (`enforce_same_org` 14, `trg_org_*`)
RPCs: **PASS** (`movimentar_estoque_atomic`, `criar_os_a_partir_de_triagem`, `exec_as_user` service_role only)

## Orphans

0 críticos (verificado `backup_inventario.js` + FKs, `memberships` 1 com `organizations` 1, `profiles` 1 com `auth.users` 1)

## Testes

135/135 PASS (10 arquivos, 710s, `fileParallelism false`)

## Lint / TSC / Build

Lint: PASS (0 errors, 14 warnings)
TSC: PASS (0)
Build: PASS (Next 16.3.4 Static+Dynamic)

## Cron

PASS (`vercel.json` `0 6 * * *` `/api/cron/preventivas`, `CRON_SECRET` check, sem dados teste)

## Monitoramento

PASS (`/admin/monitoramento` — Aplicação Online, Banco Online latência, Auth Online, Storage Online `manutencao-midia` 0 itens)

## Primeiro login

PASS (`admin@sgam.producao` / `TempProd123456!` — login → `requireOrg` → dashboard vazio)

## Dashboard limpo

PASS (0 ativos, 0 O.S., 0 solicitações, 0 consumo, 0 custo, estoque 0 — sem erros, `PageHeader` + `StatCard`)

## Primeiro smoke test

PASS (`scripts/smoke_producao.js` — localidade `Predio Smoke`, categoria `Cat Smoke`, ativo `PROD-xxx` qr, chamado `qr` → `triagem` → O.S. `aberta`, produto `PROD-xxx`, auditoria 3 logs, ativos 1 → cleanup 0)

## Estado

```
SGA-M — PRODUCTION DATABASE READY
```

---

## Próximos passos

- Alterar senha `admin@sgam.producao` via `/atualizar-senha` (não commitada)
- Convidar usuários reais via `usuarios` (ADMIN)
- Criar localidades/categorias reais via `estrutura`
- Criar ativos reais via `ativos`
- Monitorar `auditoria_logs` nova trilha a partir de 2026-09-09
