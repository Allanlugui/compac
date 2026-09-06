# GATE FINAL FASE 4 — validação real (Supabase/Vercel)

> `PASS — código` ≠ `PASS — Supabase real`. Sem JWT/senhas/tokens aqui:
> só HTTP status + contagens. `LINT 0 · TSC 0 · BUILD 0 · AUDIT 0` (esta revisão).

## 0. Migrations (dono, nesta ordem, uma por vez)

`v6 → v7 → v8 → v9 → v10 → v11 → v12` (todos idempotentes).
Pule as já aplicadas (sem re-run destrutivo). Depois:

```sql
-- sanidade: tabelas novas existem e nada órfão
select count(*) from public.pedidos_compra;            -- 0, sem erro
select count(*) from public.recebimentos;              -- 0, sem erro
select count(*) from public.qr_contextos;              -- 0, sem erro
select count(*) from public.chamados where organization_id is null; -- 0
select count(*) from public.ativos where organization_id is null;   -- 0
-- legados intactos
select qr_code_hash from public.ativos limit 3;        -- hashes de 12 chars
select status, count(*) from public.solicitacoes_compra group by 1;
```

RPC: `select proname, prosecdef, proconfig from pg_proc where proname='movimentar_estoque_atomic';`
(`prosecdef=true`, `proconfig` com `search_path=public`; owner `postgres`).
Permissão: só `authenticated` executa (revogado de `public`).

## 1. Matriz (dono executa; app ou SQL Editor + REST com JWT local)

| # | Teste | Esperado | Status |
|---|---|---|---|
| 1 | §0 acima | sem perda/órfãos/QR quebrado | BLOCKED |
| 2 | Auditoria da RPC (§2–3 deste gate) | 9/9 checks | PASS — código |
| 3 | Concorrência: disp 5, A consome 4 + B consome 4 | A ok, B NEGADO, final 1 | BLOCKED — ver SQL abaixo |
| 4 | 10/0/10 → reserva 3 (10/3/7) | físico intacto | BLOCKED |
| 5 | Consome 2 (8/1/7) + estoque/mov/OS/custo/audit | ok | BLOCKED |
| 6 | Devolve 1 (8/0/8), sem entrada física | ok | BLOCKED |
| 7 | Transferência: par atômico, rede zero | nunca A−3/B+0 | BLOCKED |
| 8 | Recebimento 60+40 ok; +1 | NEGADO (cumulativo) | PASS — código / BLOCKED — vivo |
| 9 | 100 → 90+10; só 90 entra; pedido intacto | ok | BLOCKED |
| 10 | 10×10 + 10×20 → médio 15,00; +20×25 → 20,00 | exato | BLOCKED |
| 11 | Solicitação multi-item; aprovação segregada; cotação vencedora única; pedido sem baixar estoque | ok | BLOCKED |
| 12 | Cross-tenant RPC (produto B via user A; org forjada) | NEGADO | PASS — código (`eh_membro` na linha travada) / BLOCKED — vivo |
| 13 | Roles na RPC (AUDITOR/SOLICITANTE alterar; TECNICO ajustar) | NEGADO | PASS — código / BLOCKED — vivo |
| 14 | Sequência reserva→…→ajuste gera 7 ações individualizadas | nomes FASE 4 | PASS — código / BLOCKED — vivo |
| 15 | zeros/negativos/inexistentes/cross | NEGADO tudo | PASS — código / BLOCKED — vivo |
| 16–17 | Solicitação→pedido (estoque intacto); recebimento→entrada | ok | BLOCKED |
| 18 | O.S. reserva→consome→custo→audit consistente | ok | BLOCKED |
| 19 | Cross-tenant completo (9 entidades) | NEGADO tudo | BLOCKED |
| 20 | QR/legados (genérico, pedidos, chamados, produtos, fornecedores) | intactos | PASS — código / BLOCKED — vivo |

N/A com justificativa: **saldos por almoxarifado (A=7/B=8)** — sem entidade
`estoque_por_local`; transferência registra par auditado com origem/destino
(rede zero), sem saldos por local. **Localidade/tenant como parâmetro da RPC**
— inexistentes por desenho (org deriva da linha travada).

## 2. SQL do teste de concorrência (§3–4)

```sql
-- como ADMIN da org (service_role NUNCA no teste; usar JWT do login):
-- 1) produto com físico 5, reservado 0
-- 2) em duas abas, quase ao mesmo tempo:
select public.movimentar_estoque_atomic(
  '<PRODUTO_UUID>', 'consumo', 4, 0, null, 'teste A', null, null, 'teste');
-- esperado: uma retorna {"ok":true,...} e a outra {"ok":false,"error":...}
-- 3) conferir: físico final = 1
select estoque_atual, estoque_reservado from public.produtos where id = '<PRODUTO_UUID>';
```

Cross-tenant (§12): mesma chamada com produto da outra org →
`{"ok":false,"error":"Acesso negado."}` (trocar `organization_id` é impossível:
a função não recebe org).

## 3. Auditoria da RPC (revisão de código desta etapa)

- Sessão: `auth.uid()` via `eh_membro`/`tem_papel` (JWT, não parâmetro). OK.
- Tenant: `organization_id` lido da linha travada (`FOR UPDATE`); sem param org. OK.
- Roles: ajuste AG, transferência AGC, demais AGCT — espelha a matriz. OK.
- `search_path = public` fixo; sem `EXECUTE` dinâmico; `REVOKE public` +
  `GRANT authenticated`. OK. Owner deve ser `postgres` (ver §0).
- Ator: `auth.jwt()->>'email'` com fallback (forja de autoria eliminada). OK.
- Custo negativo: rejeitado com mensagem (antes estourava constraint). OK.

## 4. Liberação da FASE 5

Exige §0 + todos os BLOCKED acima virando `PASS — Supabase real`.
