# SGA-M — OPERATIONAL WORKFLOWS

**Versão:** FASE 7
**Data:** 2026-09-07

---

## 1. Ativo → QR → Chamado → Triagem → O.S.

```
Ativo (localidade_id, qr_code_hash)
  ↓ (QR scan /admin/qr/[hash] via createServiceClient por qr_code_hash)
Chamado (ativo_id, solicitante, descricao, origem=qr, status=aberto)
  ↓ (TriagemForm → triagemECriarOS RPC criar_os_a_partir_de_triagem)
O.S. (os_status=aberta, os_tipo, prazo, equipe)
  ↓ (OsWorkflowControl → planejamento, execução, fotos, checklist, custos)
Conclusão (status=resolvido, os_status=concluida, concluido_em)
```

**Status:** ✅ Completo (existe, funciona, testado)

---

## 2. O.S. → Material → Compra → Recebimento → Estoque → Retorno O.S.

```
O.S. (em_execucao, precisa de peça)
  ↓ (ConsumoEstoque → Solicitar material → /admin/compras/solicitacoes/nova?os=ID)
Solicitação (solicitacoes_compra, origem=portal, status=rascunho, com solicitacao_itens)
  ↓ (Enviar → em_analise → aprovada → em_cotacao → pedido_gerado)
Cotação (cotacoes, fornecedor, valor, vencedora)
  ↓ (Pedido → pedidos_compra, status=aberto → aprovado)
Pedido (pedidos_compra, fornecedor, itens)
  ↓ (Recebimento → recebimentos, status=aceito → movimentar_estoque_atomic entrada)
Entrada Estoque (movimentacoes_estoque tipo=entrada, produto, quantidade, custo)
  ↓ (Material disponível → O.S. volta para em_execucao)
Consumo (movimentacoes tipo=consumo, chamado_id, custo → os_servicos_externos + custo_os)
  ↓ (Conclusão → custo atualizado → relatório)
```

**Status:** ⚠️ Parcial (solicitação via O.S. existe como link para /admin/compras/solicitacoes/nova?os=ID, mas vínculo O.S.→solicitação não é automático, requer seleção manual do produto e quantidade)

---

## 3. Compra sem O.S. (Suprimento direto)

```
Solicitação (origem=estoque/manual, sem chamado_id)
  → Cotação → Pedido → Recebimento → Entrada estoque
```

**Status:** ✅ Completo (via /admin/compras/solicitacoes/nova sem O.S.)

---

## 4. Preventiva → Calendário → O.S.

```
Plano (planos_manutencao, ativo_id, frequencia, unidade, proxima_execucao)
  → Calendário (/admin/calendario, mostra planos + O.S. + prazos)
  → Execução manual (Gerar O.S. → /admin/chamados/novo?plano=ID)
  → Checklist (execucao com snapshot)
```

**Status:** ⚠️ Parcial (calendário mostra preventivas e O.S., mas geração automática de O.S. por vencimento não é automática, é manual)

---

## 5. Estoque

```
Produto (codigo, descricao, estoque_atual, reservado, mínimo, ponto_reposicao)
  → Entrada (tipo=entrada) → Físico ↑
  → Reserva (reserva) → Reservado ↑ (disponível = físico - reservado)
  → Consumo (consumo, chamado_id) → Físico ↓, Reservado ↓, Custo O.S. ↑
  → Ajuste (ajuste, define físico) → Inventário
  → Transferência (transferencia, par saída+entrada, rede zero)
  → Desativar (ativo=false, preserva histórico)
```

**Status:** ✅ Completo (via /admin/estoque, 4 abas, NF-e import)

---

## 6. Auditoria → Monitoramento

```
Operação (criação O.S., mudança status, estoque, compra, permissão)
  → auditoria_logs (tabela, registro_id, acao, dados, organization_id, user_id)
  → /admin/auditoria (filtros, controle acesso)
  → /admin/monitoramento (health checks: app, banco, auth, storage, utilização)
```

**Status:** ⚠️ Parcial (auditoria existe e é útil, monitoramento com health checks de banco/storage/auth ainda não implementado, existe apenas placeholder)

---

## 7. Integração Geral

```
Estrutura (localidade) → Ativo (localidade_id) → O.S. (ativo_id) → Estoque (consumo) → Compra (solicitação) → Recebimento → Estoque (entrada) → Auditoria (tudo)
```

Cada conexão auditável via `organization_id` + `ativo_id`/`chamado_id`/`produto_id`.
