# SYSTEM FLOW AUDIT — SGA-M

## Fluxo 1: Ativo → QR → Chamado → O.S. → Compra → Recebimento → Estoque → Consumo → Conclusão → Desempenho → Auditoria

| Etapa | Rota/Action | Tabela | Status |
|---|---|---|---|
| Ativo | `/admin/ativos` `criarAtivo` | `ativos` `localidades` `categorias` | ✅ |
| QR | `/qr/[hash]` `qr_code_hash` | `ativos` | ✅ |
| Chamado | `criarChamado` (qr) `criarChamadoManual` | `chamados` `origem=qr` | ✅ |
| Triagem | `triarChamado` `triagemECriarOS` `criar_os_a_partir_de_triagem` RPC | `chamados` `os_status` | ✅ |
| O.S. | `/admin/chamados/[id]` `os.ver` `transicaoOS` | `chamados` `os_status_historico` | ✅ |
| Solicitação | `solicitarMaterialOS` | `solicitacoes_compra` `chamado_id` | ✅ |
| Cotação | `registrarCotacao` `definirVencedora` | `cotacoes` | ✅ |
| Pedido | `criarPedido` | `pedidos_compra` `pedido_itens` | ✅ |
| Recebimento | `registrarRecebimento` | `recebimentos` `recebimento_itens` `movimentacoes_estoque` `entrada` | ✅ |
| Estoque | `movimentarEstoque` `consumo` | `produtos` `estoque_atual` | ✅ |
| Consumo | `ConsumoEstoque` | `movimentacoes_estoque` `chamado_id` | ✅ |
| Conclusão | `concluirOS` `encerrarOS` | `chamados` `concluido_em` | ✅ |
| Desempenho | `getMetricasTecnico` `calcScoreAuto` | `chamados` `performance_evaluations` | ✅ (mas `desempenho/page` fixo) |
| Auditoria | `registrarLog` | `auditoria_logs` | ✅ |

**Navegável:** Ativo ↔ Chamado (`/admin/ativos/[id]` → `chamados` por `ativo_id`, Chamado → `ativos.nome`) ✅ | O.S. ↔ Solicitação (`chamado_id` link) ✅ | Solicitação ↔ Pedido (`solicitacao_id`) ✅ | Pedido ↔ Recebimento ✅ | Recebimento ↔ Estoque (`produto_id`) ✅ | O.S. ↔ Desempenho (via `ativo_id`) ✅ | Usuário ↔ Organograma (`memberships`) ✅ | Usuário ↔ Mensagem (`conversa_participantes`) ✅

**Gap:** `Desempenho` score fixo `85/90` (P04), `Organograma → Ver perfil` 404 (P01).

## Fluxo 2: Preventiva → O.S. → Calendário

`planos_manutencao` `proxima_execucao` → `api/cron/preventivas` `service_role` `idempotência` `count hoje` → `chamados` `plano_id` → `/admin/calendario` `prazo` + `planos` ✅

## Fluxo 3: Estoque

`produtos` `criarProduto` → `movimentarEstoque` `entrada/saida/reserva/consumo/devolucao/transferencia` `movimentar_estoque_atomic` `FOR UPDATE` → `disponível = físico - reservado` ✅ | `produto_fornecedores` `vincular` ✅ | `unidades_medida` seed sem UI (P12)

## Fluxo 4: Mensagens

`Organograma/Perfil` → `criarOuObterConversa` `pair_hash` `unique` + `advisory_lock` → `conversas` 1:1 `2 participantes` → `enviarMensagem` `2000` → `conversa_participantes.last_read_at` → `badge` ✅ (mas fallback Storage ativo até v22)

## Fluxo 5: Hierarquia

`memberships.reports_to_membership_id` (storage fallback) → `Organograma` `zoom/pan` → `getSubtree` → `Desempenho` `GESTOR` subtree ✅

## Fluxo 6: Perfil

`Meu Perfil` `avatar` `o/{org}/profiles/...` `signed URL` → `Meu Perfil` edit `nome/telefone/cargo/matricula/bio/preferencias` → `profiles` `update` + `registrarLog` ✅ | `Perfil/[id]` 404 (P01)

## Fluxo 7: Busca/Relatórios/Mapa

`Busca` `buscarGlobal` 9 tabelas `tenant` `role` `scope` `limit 10` → `href` dinâmico ✅ | `Relatórios` 8 abas `analytics` `periodo` BRT → `ExportButtons` CSV BOM ✅ | `Mapa` `localidades` árvore `temCoordenadas=false` ✅

## Fluxo 8: Auditoria/Monitoramento

`auditoria_logs` `300` `LogsAuditoria` ✅ | `monitoramento` `4` checks `Aplicação Online` `Banco` `Storage` `Auth` ✅ (mas `auth` fixo P10)

## Fluxo 9: Auth

`login` `signInWithPassword` → `proxy` `createServerClient` `requireOrg` → `dashboard` ✅ | `qr/[hash]` `service_role` `org derivado` ✅

## Fluxo 10: Tenant Isolation

`organization_id` em `100%` queries autenticadas + `enforce_same_org` `v13` + `RLS` `eh_membro` → `rls-isolation` 19 PASS ✅
