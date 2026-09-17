# SGA-M · INVENTÁRIO DE MIGRATIONS (v6 → v18)

**Data:** 2026-09-07 (atualizado FASE 8)
**Status:** ✅ Aplicadas no Supabase homologação (`ialjfeltqpbgrxtymfwa.supabase.co`) — verificado `solicitacoes_compra.chamado_id` exists, `solicitacoes_chamado_idx`, `trg_org_solic_chamado`, `chamados_ativo_fk RESTRICT`
**Próximo passo:** Validar em produção com mesma sequência

---

## Sumário

| Versão | Fase | Conteúdo | Dependências | Risco | Status |
|--------|------|----------|--------------|-------|--------|
| v6 | FASE 1: fundação | localidades, categorias, profiles, FKs | v1–v5 | Baixo | Pendente |
| v7 | FASE 2: ativos | ativos completos, QR, histórico, docs, enforce_same_org | v1–v6 | Médio | Pendente |
| v8 | Correção §1–§3, §8 | Split INSERT/UPDATE/DELETE ativos, append-only ash, QR_REGENERATED | v1–v7 | Baixo | Pendente |
| v9 | Integridade ativo→local/cat/forn | Estende enforce_same_org + trigger em ativos | v1–v8 | Baixo | Pendente |
| v10 | FASE 3: manutenção + O.S. | estoque_reservado, status enum, OS, planos, checklist | v1–v9 | Alto | Pendente |
| v11 | FASE 4: suprimentos | produtos, fornecedores, solicitacoes, cotacoes, pedidos, recebimentos | v1–v10 | Alto | Pendente |
| v12 | GATE FASE 4: RPC estoque | movimentar_estoque_atomic (lock) | v1–v11 | Alto | Pendente |
| v13 | Fix 42703 | enforce_same_org via jsonb (corrige trigger quebrado) | v1–v12 | Baixo | Pendente |
| v14 | Triagem → O.S. atômico | CHECK constraint expandido + RPC criar_os_a_partir_de_triagem | v1–v13 | Médio | Pendente |
| v15 | Testes de RLS | RPC exec_as_user (test-only) | v1–v14 | Baixo | ✅ Aplicada |
| v16 | FASE 7 H1/H2 | Hardening RLS + índices | v1–v15 | Médio | ✅ Aplicada |
| v17 | FASE 7 H4 | Hardening adicional | v1–v16 | Médio | ✅ Aplicada |
| v18 | FASE 7.1 H1+H2 | `solicitacoes_compra.chamado_id` + `enforce_same_org` + `chamados.ativo_id RESTRICT` | v1–v17 | Médio | ✅ Aplicada |
| v23 | BLOCO 1: cadastros mestres | `departamentos_setores` + `centros_custo` (FK localidades) + RLS + `enforce_same_org` estendido | v1–v22 | Baixo | 🆕 Criada, pendente aplicação |
| v24 | BLOCO 2: almoxarifados + estoque dual | `almoxarifados` + `produtos.almoxarifado_id` + `movimentacoes_estoque.almoxarifado_id` + RPC com 2 params opcionais + `enforce_same_org` estendido | v1–v23 | Médio | 🆕 Criada, pendente aplicação |
| v25 | BLOCO 3: permissões customizáveis | `permissoes_custom` (overlay conceder/negar + escopo) + RLS ADMIN + `enforce_same_org` estendido | v1–v24 | Médio | 🆕 Criada, pendente aplicação |
| v26 | BLOCO 4: QR compras relacional | `qr_contextos` + `solicitacoes_compra` com FKs (localidade/depto/CC/almox) + `qr_contexto_id` + `enforce_same_org` estendido | v1–v25 | Baixo | 🆕 Criada, pendente aplicação |

---

## Detalhamento por migration

### v6 — FASE 1 fundação
**Objetivo:** Base organizacional + perfis + permissões

**Objetos criados:**
- `public.localidades` (unidade/predio/bloco/andar/area/sala)
- `public.categorias` (atributos JSONB)
- Colunas em `profiles` (telefone, cargo, matricula, avatar, ultimo_acesso)
- FKs em `ativos` e `produtos` → `localidades`, `categorias`

**Policies RLS:**
- `loc_select`, `loc_write` em `localidades`
- `cat_select`, `cat_write` em `categorias`

**Idempotência:** ✅ (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS)

**Pré-req:** v1–v5 aplicados
**Risco:** Baixo — só cria tabelas e policies novas

---

### v7 — FASE 2 ativos + QR
**Objetivo:** Cadastro profissional de ativos + QR + histórico

**Objetos criados:**
- Colunas em `ativos`: codigo, descricao, status, criticidade, etc.
- `public.ativo_status_historico`
- `public.ativo_documentos`
- Função `enforce_same_org()` (versão inicial)
- Triggers `trg_org_ativo_hist`, `trg_org_ativo_docs`

**Policies RLS:**
- `ash_select`, `ash_write` (depois substituída em v8)
- `adoc_select`, `adoc_write`

**Idempotência:** ✅

**Pré-req:** v1–v6
**Risco:** Médio — recria `enforce_same_org()` (sobrescreve se já existir)

---

### v8 — Correções pós-FASE 2
**Objetivo:** Granularidade de permissões + append-only

**Objetos alterados:**
- Policies `ativos_insert`, `ativos_update`, `ativos_delete` (split)
- `ash_insert` (substitui ash_write — append-only)
- CHECK `auditoria_logs_acao_check` expandido: adiciona `QR_REGENERATED` e `FOTO_ADICIONADA`

**Idempotência:** ✅ (DROP POLICY IF EXISTS, recria)

**Pré-req:** v1–v7
**Risco:** Baixo — só policies e CHECK

---

### v9 — Integridade de tenant do ativo
**Objetivo:** Estender `enforce_same_org()` para validar refs do ativo

**Objetos alterados:**
- `enforce_same_org()` reescrito (cobre `ativos.localidade_id`, `categoria_id`, `fornecedor_id`)
- Trigger `trg_org_ativos` criado

**Idempotência:** ✅

**Pré-req:** v1–v8
**Risco:** Baixo — reescreve função existente, idempotente

---

### v10 — FASE 3 manutenção + O.S.
**Objetivo:** O.S. + preventiva + checklist

**Objetos criados:**
- Coluna `produtos.estoque_reservado` (dois baldes)
- Novos valores enum `chamado_status`
- Função `set_concluido_em()` (atualizada)
- Colunas O.S. em `chamados` (os_tipo, os_status, plano_id, etc.)
- `public.os_status_historico`
- `public.os_atividades`
- `public.os_servicos_externos`
- `public.os_fotos`
- `public.planos_manutencao`
- Colunas em `checklist_itens` (tipo, foto_obrigatoria, etc.)
- Colunas em `checklist_respostas` (valor)
- Colunas em `checklist_execucoes` (status, resultado, snapshot)
- Triggers `trg_org_os_*` e `trg_org_planos`
- CHECK `auditoria_logs_acao_check` expandido: adiciona `TRIAGEM`, `OS_CONCLUIDA`, `CHECKLIST_CONCLUIDA`, `COST_ADDED`

**Policies RLS:**
- `osh_select`, `osh_insert` (append-only)
- `osa_select`, `osa_write`
- `oss_select`, `oss_write` (COMPRAS)
- `osf_select`, `osf_write`
- `plm_select`, `plm_write` (ADMIN/GESTOR)

**Idempotência:** ⚠️ Linha 203-204: `ADD COLUMN opcoes jsonb` está DUPLICADA (possível erro de copy-paste). Verificar antes de aplicar.

**Pré-req:** v1–v9
**Risco:** Alto — muitas tabelas novas + enum + CHECK + triggers. Linha duplicada em `opcoes` precisa ser removida antes de aplicar.

---

### v11 — FASE 4 suprimentos
**Objetivo:** Solicitações + cotações + pedidos + recebimentos

**Objetos criados:**
- Colunas em `produtos` (sku, subcategoria, ponto_reposicao, ultimo_custo)
- Colunas em `movimentacoes_estoque` (origem, destino)
- Colunas em `fornecedores` (razao_social, etc.)
- `public.unidades_medida` (com seed UN/KG/G/L/...)
- `public.solicitacoes_compra` (provável)
- `public.solicitacao_itens`, `solicitacao_historico`, `solicitacao_anexos`
- `public.cotacoes`
- `public.pedidos_compra`, `pedido_itens`
- `public.recebimentos`, `recebimento_itens`
- `public.produto_fornecedores`
- `enforce_same_org()` reescrito (cobre novas tabelas)
- Triggers adicionais

**Idempotência:** ⚠️ Parcial — grande, verificar duplicações

**Pré-req:** v1–v10
**Risco:** Alto — maior migration do projeto

**Observação:** Arquivo v11 tem 592 linhas. Precisa ser revisado em detalhe antes de aplicar.

---

### v12 — GATE FASE 4 atomicidade
**Objetivo:** RPC atômica de movimentação de estoque

**Objetos criados:**
- Função `public.movimentar_estoque_atomic()` — usa `FOR UPDATE` no SELECT para lock
- Permissões: `revoke all from public`, `grant to authenticated`

**Idempotência:** ✅ (CREATE OR REPLACE)

**Pré-req:** v1–v11
**Risco:** Alto — RPC crítica para concorrência. SECURITY DEFINER valida tenant/papel internamente.

---

### v13 — Fix 42703
**Objetivo:** Corrigir `enforce_same_org()` que quebrava em `42703` ao referenciar colunas de outras tabelas via `IF`.

**Solução:** Reescrever usando `to_jsonb(NEW)` + guards por `TG_TABLE_NAME`.

**Idempotência:** ✅ (CREATE OR REPLACE)

**Pré-req:** v1–v12
**Risco:** Baixo — corrigiu bug real, todos os ramos cobertos

**Importante:** APLICAR DEPOIS DE v10/v11 — se v10/v11 não foram aplicados, esta v13 reescreve a função com a versão "jsonb" mas a função original (v7/v9/v10/v11) pode ter regras adicionais que v13 não tem. **VERIFICAR cobertura.**

---

### v14 — Triagem → O.S. atômico
**Objetivo:** Corrigir inconsistência UX/máquina de estados (botão "Criar O.S." a partir de `aberto`)

**Objetos criados:**
- CHECK `auditoria_logs_acao_check` expandido: adiciona `TRIAGEM`, `OS_CREATED`, `OS_CONCLUIDA`, `CHECKLIST_CONCLUIDA`, `COST_ADDED`, `STOCK_CONSUMED`
- RPC `public.criar_os_a_partir_de_triagem()` — atômica, transacional

**Idempotência:** ✅

**Pré-req:** v1–v13
**Risco:** Médio — RPC nova + expansão de CHECK

---

### v15 — Testes de RLS
**Objetivo:** Habilitar testes automatizados de isolamento

**Objetos criados:**
- RPC `public.exec_as_user(p_user_id, p_sql)` — `security definer`, restrita a `service_role`

**Idempotência:** ✅

**Pré-req:** v1–v14
**Risco:** ⚠️ MÉDIO — se exposta incorretamente, permite escalonamento de privilégio

**SEGURANÇA CRÍTICA:**
```sql
revoke all on function public.exec_as_user(uuid, text) from public;
grant execute on function public.exec_as_user(uuid, text) to service_role;
```

NÃO permitir `anon` ou `authenticated` executar esta função. Apenas `service_role`.

---

## ⚠️ Problemas identificados antes de aplicar

### 1. v10 linha 203-204: coluna `opcoes` duplicada
```sql
alter table public.checklist_itens add column if not exists opcoes jsonb not null default '[]';
alter table public.checklist_itens add column if not exists opcoes jsonb not null default '[]';  -- duplicada
```

A 2ª linha é no-op (idempotente), mas é redundante. **Pode ser removida sem impacto.**

### 2. v13 assume v10/v11 aplicadas
A função `enforce_same_org()` da v13 é a versão "jsonb" completa, que cobre todas as tabelas (chamados, compras, produtos, ativos, OS, checklists, suprimentos, recebimentos). Se v10 ou v11 não tiverem sido aplicadas, faltam tabelas que a v13 nem sabe que existem.

**Recomendação:** Aplicar v6→v12 na ordem, depois v13 substitui a função. A v13 é a versão definitiva.

### 3. v14 e v15: ordem de aplicação
v14 expande CHECK e cria RPC. v15 cria `exec_as_user`. Ordem: v14 antes de v15.

### 4. v15 — proteger `exec_as_user`
Garantir revogação para `anon` e `authenticated`. Apenas `service_role` pode chamar.

---

## ✅ Sequência recomendada para aplicar

```
1. Aplicar v6  → localidades, categorias
2. Aplicar v7  → ativos, QR, enforce_same_org v1
3. Aplicar v8  → split policies, append-only
4. Aplicar v9  → integridade ativo
5. Aplicar v10 → O.S. + preventiva + checklist
6. Aplicar v11 → suprimentos
7. Aplicar v12 → RPC estoque atômica
8. Aplicar v13 → fix 42703 (substitui enforce_same_org pela versão jsonb)
9. Aplicar v14 → triagem→O.S. atômico
10. Aplicar v15 → exec_as_user (test-only)
11. Validar testes RLS:
    npm run test:isolation
```

**Após aplicação bem-sucedida, executar:**
```bash
-- Verificação final de RLS em todas as tabelas
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Verificar que exec_as_user só tem grant para service_role
select grantee, privilege_type
from information_schema.routine_privileges
where routine_name = 'exec_as_user';
```

---

## Canonical audit actions

Lista **canônica** de ações aceitas por `auditoria_logs_acao_check`.
Derivada do código fonte (`src/app/**/actions.ts`) + dados reais do banco.

```
INSERT
UPDATE
DELETE
STATUS_CHANGE
LOGIN
LOGOUT
APPROVAL
REJECTION
STOCK_ENTRY
STOCK_EXIT
STOCK_ADJUSTMENT
STOCK_RESERVED
STOCK_RELEASED
STOCK_CONSUMED
STOCK_TRANSFERRED
MEMBERSHIP_CHANGE
ROLE_CHANGE
QR_REGENERATED
TRIAGEM
OS_CREATED
OS_CONCLUIDA
CHECKLIST_CONCLUIDA
FOTO_ADICIONADA
COST_ADDED
REQUEST_CREATED
REQUEST_APPROVED
REQUEST_REJECTED
QUOTE_CREATED
ORDER_CREATED
ORDER_APPROVED
RECEIPT_CREATED
RECEIPT_ACCEPTED
RECEIPT_REJECTED
```

### Fontes confirmadas

| Ação | Código fonte | Dados DB |
|------|-------------|----------|
| `INSERT/UPDATE/DELETE/STATUS_CHANGE` | todas actions | ✅ |
| `LOGIN/LOGOUT` | `login/actions.ts` | ✅ |
| `QR_REGENERATED` | `ativos/actions.ts` | ✅ |
| `FOTO_ADICIONADA` | `chamados/[id]/actions.ts` | ✅ |
| `APPROVAL/REJECTION` | — | ✅ 2 linhas |
| `STOCK_ENTRY/EXIT/ADJUSTMENT` | — | ✅ |
| `STOCK_CONSUMED` | — | ✅ 1 linha |
| `MEMBERSHIP_CHANGE/ROLE_CHANGE` | `usuarios/actions.ts` | ✅ |
| `TRIAGEM` | `chamados/[id]/actions.ts` | ✅ 1 linha |
| `OS_CREATED` | `schema_v14.sql` (criar_os_a_partir_de_triagem) | ✅ 1 linha |
| `OS_CONCLUIDA` | `chamados/[id]/actions.ts` | — |
| `CHECKLIST_CONCLUIDA` | `checklists.ts` | — |
| `COST_ADDED` | `chamados/[id]/actions.ts` | — |
| `STOCK_TRANSFERRED` | `estoque/actions.ts` | — |
| `REQUEST_CREATED` | `solicitacoes/actions.ts` | — |
| `REQUEST_APPROVED/REJECTED` | código futuro | — |
| `QUOTE_CREATED` | `solicitacoes/actions.ts` | — |
| `ORDER_CREATED/APPROVED` | `pedidos/actions.ts` | — |
| `RECEIPT_CREATED/ACCEPTED/REJECTED` | código futuro | — |
| `STOCK_RESERVED/RELEASED` | código futuro | — |

### Regra

```
dados reais existentes ⊆ ações na constraint
```

Se uma ação existe nos dados do banco, ela **deve** estar na constraint.
Qualquer schema que recrie `auditoria_logs_acao_check` deve usar esta lista completa.
**Nunca** criar constraint sem uma ação já presente nos dados.

### v8/v10/v14 - história do bug

| Versão | Antes (bug) | Depois (fix) |
|--------|-------------|--------------|
| v8 | faltavam: TRIAGEM, OS_CREATED, STOCK_CONSUMED, e ações da FASE 4 | lista canônica completa |
| v10 | faltavam: STOCK_TRANSFERRED, CHECKLIST_CONCLUIDA, FASE 4 | lista canônica completa |
| v14 | faltavam: STOCK_TRANSFERRED, ORDER_CREATED, REQUEST_CREATED, QUOTE_CREATED, FASE 4 | lista canônica completa |

---

## 📋 Checklist de validação pós-aplicação

- [ ] Todas as 16+ tabelas com RLS ativa
- [ ] `exec_as_user` apenas com grant para `service_role`
- [ ] Nenhum `create policy` permitiu role `anon` (exceto QR público)
- [ ] 12 testes RLS passando (`npm run test:isolation`)
- [ ] Teste manual de QR público (anon) funcionando
- [ ] Teste manual de fluxo triagem→O.S. (UX corrigido)
- [ ] Teste manual de estoque concorrente (2 O.S. simultâneas)
- [ ] Teste manual cross-tenant (Org A não vê Org B)
