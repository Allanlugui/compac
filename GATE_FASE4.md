# GATE FASE 4 — Suprimentos (código pronto; vivo pendente de banco)

> Legenda: `PASS` = verificado no código · `BLOCKED` = exige Supabase real
> (rodar v6→v7→v8→v9→v10→**v11**→**v12** nesta ordem) + 2 usuários.
> Sem JWT/senhas/tokens aqui. `lint` 0 · `tsc` 0 · `build` 0 (esta revisão).

## 1. Banco (dono)

Aplicar v6..v12 em ordem, uma por vez no SQL Editor. Depois conferir:
sem perda, sem duplicação, sem órfãos, QRs intactos, legados funcionando.
Status: **BLOCKED** (aguarda execução; scripts são idempotentes).

## 2. Matriz

| # | Teste | Esperado | Status |
|---|---|---|---|
| 1 | Migrations v6–v12 em ordem | sem perda/órfãos/QR quebrado | BLOCKED — §1 |
| 2 | 10/10/10 → reserva 3 (10/3/7) → consome 2 (8/1/7) → devolve 1 (8/0/8) | exato, `disponível=físico−reservado` | PASS (dois baldes + RPC) / BLOCKED (ao vivo) |
| 3 | Disp 5; A consome 4 ok; B tenta 4 | NEGADO, sem inconsistência | PASS (`movimentar_estoque_atomic`, `SELECT … FOR UPDATE`) / BLOCKED (ao vivo) |
| 4 | Esperado 100, contado 97 → −3 com motivo | estoque+movimento+auditoria | PASS / BLOCKED (ao vivo) |
| 5 | Transferência 3 (A=10,B=5) → A=7,B=8, par atômico | nunca A−3/B+0 | PASS (par na mesma transação) / BLOCKED (ao vivo) |
| 6 | Solicitação A×3+B×5+C×2, snapshot, sem produto cross | ok / NEGADO cross | PASS / BLOCKED (ao vivo) |
| 7 | Solicitante aprova a própria | NEGADO; gestor aprova com registro | PASS (`decidirSolicitacao`) / BLOCKED (ao vivo) |
| 8 | 2 cotações, 1 vencedora, histórico | única vencedora | PASS / BLOCKED (ao vivo) |
| 9 | `PED-AAAA-NNNN` único; criar pedido não mexe no estoque | ok | PASS (unique + retry) / BLOCKED (ao vivo) |
| 10 | 100 → 97+3, motivo, pedido intacto | 97 estoque / 3 divergência | PASS / BLOCKED (ao vivo) |
| 11 | 40+35+25=100; além do pendente | NEGADO | PASS (trava cumulativa) / BLOCKED (ao vivo) |
| 12 | 10×10 + 10×20 → médio **15,00**; sem negativo | exato | PASS (ponderado) / BLOCKED (ao vivo) |
| 13 | Aquisição ≠ estoque ≠ consumo O.S.; sem dupla | separado | PASS (construção) / BLOCKED (ao vivo) |
| 14 | O.S. A + produto/fornecedor B | NEGADO (action+trigger) | PASS / BLOCKED (ao vivo) |
| 15 | Fornecedor CRUD+cotação+pedido+recebimento por tenant | ok | PASS / BLOCKED (ao vivo) |
| 16 | QR contexto → solicitação sem redigitar; sem token nada vaza | ok | PASS / BLOCKED (smartphone) |
| 17 | Token da org A forjado p/ contexto B | NEGADO (token→org no servidor) | PASS / BLOCKED (ao vivo) |
| 18 | Foto recebimento câmera+galeria, Storage privado | ok | PASS / BLOCKED (smartphone) |
| 19 | 15 ações de auditoria da FASE 4 | nomes `*_RESERVED/RELEASED/CONSUMED/TRANSFERRED/REQUEST_*/QUOTE_*/ORDER_*/RECEIPT_*` | PASS |
| 20 | Roles (SOLICITANTE cria/não aprova; COMPRAS cota/recebe; TECNICO consome; AUDITOR lê) | servidor+RLS | PASS / BLOCKED (ao vivo) |
| 21 | Matriz cross-tenant completa | NEGADO tudo | BLOCKED |
| 22 | QR genérico, pedidos/chamados/produtos/fornecedores antigos | intactos | PASS (código) / BLOCKED (ao vivo) |
| 23 | Ponta a ponta reposição→…→custo→auditoria | fluxo real | BLOCKED |

## 3. Liberação da FASE 5

Exige §1 executado + BLOCKED virando PASS na tabela acima.
Correções desta revisão (código): RPC atômica (`schema_v12.sql`),
mapeamento de auditoria FASE 4, trava além-do-pendente.
