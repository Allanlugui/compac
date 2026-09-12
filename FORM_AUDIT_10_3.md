# FORM AUDIT 10.3

| Formulário | UI | Validation | Action | DB | Success | Refresh | Audit | Status |
|---|---|---|---|---|---|---|---|---|
| Ativos: cadastro rápido | ✅ | ✅ (codigo 2-40) | `criarAtivo` `ativos.criar` | `ativos` | toast | `revalidatePath` | `INSERT` | **PASS** |
| Ativos: completo | ✅ | ✅ | `atualizarAtivo` | `ativos` | toast | `revalidate` | `UPDATE` | **PASS** |
| Ativos: QR regenerar | ✅ | ✅ | `regenerarQR` | `ativos` `qr_code_hash` | toast | `revalidate` | `QR_REGENERATED` | **PASS** |
| Chamados: novo | ✅ | ✅ | `criarChamadoManual` | `chamados` | redirect | `revalidate` | `INSERT` | **PASS** |
| Chamados: triagem | ✅ | ✅ | `triarChamado` `triagemECriarOS` RPC | `chamados` `os_status` | toast | `revalidate` | `TRIAGEM` | **PASS** |
| O.S.: execução | ✅ | ✅ | `atualizarExecucao` | `chamados` | toast | `revalidate` | `UPDATE` | **PASS** |
| O.S.: checklist | ✅ | ✅ | `salvarExecucao` | `checklist_execucoes` | toast | `revalidate` | `CHECKLIST_CONCLUIDA` | **PASS** |
| O.S.: material | ✅ | ✅ | `solicitarMaterialOS` | `solicitacoes_compra` | toast | `revalidate` | `REQUEST_CREATED` | **PASS** |
| Compras: solicitação | ✅ | ✅ | `criarSolicitacaoInterna` | `solicitacoes_compra` | redirect | `revalidate` | `REQUEST_CREATED` | **PASS** |
| Compras: cotação | ✅ | ✅ | `registrarCotacao` | `cotacoes` | toast | `revalidate` | `QUOTE_CREATED` | **PASS** |
| Compras: pedido | ✅ | ✅ | `criarPedido` | `pedidos_compra` | redirect | `revalidate` | `ORDER_CREATED` | **PASS** |
| Compras: recebimento | ✅ | ✅ | `registrarRecebimento` | `recebimentos` `movimentacoes` | toast | `revalidate` | `RECEIPT_ACCEPTED` | **PASS** |
| Estoque: produto | ✅ | ✅ | `criarProduto` | `produtos` | toast | `revalidate` | `INSERT` | **PASS** |
| Estoque: movimentação | ✅ | ✅ | `movimentarEstoque` RPC | `movimentacoes_estoque` | toast | `revalidate` | `STOCK_*` | **PASS** |
| Fornecedores: criar/editar | ✅ | ✅ | `criarFornecedor` `editarFornecedor` | `fornecedores` | toast | `revalidate` | `INSERT/UPDATE` | **PASS** |
| Preventivas: plano | ✅ | ✅ | `criarPlano` | `planos_manutencao` | toast | `revalidate` | `INSERT` | **PASS** |
| Perfil: Meu Perfil | ✅ | ✅ | `atualizarPerfil` `uploadAvatar` | `profiles` `manutencao-midia` | toast | `revalidate` | `UPDATE` | **PASS** |
| Perfil: avatar | ✅ | ✅ (8MB) | `uploadAvatar` | `manutencao-midia` `o/{org}/profiles/...` `signed URL` | toast | `revalidate` | `UPDATE` | **PASS** |
| Mensagens: enviar | ✅ | ✅ (1-2000) | `enviarMensagem` | `mensagens` | toast | `revalidate` | `MESSAGE_SENT` sem conteúdo | **PASS** |

**Botões:** 0 sem onClick, 0 disabled permanente, 0 href "#"
**Dados fictícios:** 0 (P04 `auto` removido)
**Error masking:** `catch { return [] }` em `auditoria.ts` é best-effort, não mascara erro crítico
