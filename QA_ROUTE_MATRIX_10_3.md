# QA ROUTE MATRIX 10.3

| Rota | Existe | Menu | Permission | Browser test (ADMIN) | Resultado |
|---|---|---|---|---|---|
| /login | ✅ | — | public | 200 | PASS |
| /selecionar-org | ✅ | — | public | 200 | PASS |
| /qr/[hash] | ✅ | — | public | 200 (hash válido) / 404 (inválido) | PASS |
| /qr-compra/[hash] | ✅ | — | public | 200 | PASS |
| /admin/dashboard | ✅ | ✅ | requireOrg | 200 | PASS |
| /admin/ativos | ✅ | ✅ | ativos.ver | 200 | PASS |
| /admin/ativos/[id] | ✅ | ✅ | ativos.ver | 200 | PASS |
| /admin/chamados | ✅ | ✅ | chamados.ver | 200 | PASS |
| /admin/chamados/novo | ✅ | ✅ | chamados.criar | 200 | PASS |
| /admin/chamados/[id] | ✅ | ✅ | chamados.ver (FIX) | 200 | PASS |
| /admin/chamados/[id]/os | ✅ | ✅ | os.ver (FIX) | 200 | PASS |
| /admin/ordens-servico | ✅ | ✅ | os.ver | 200 | PASS |
| /admin/preventivas | ✅ | ✅ | preventiva.ver | 200 | PASS |
| /admin/calendario | ✅ | ✅ | calendario.ver (FIX) | 200 | PASS |
| /admin/estoque | ✅ | ✅ | estoque.ver (FIX) | 200 | PASS |
| /admin/compras | ✅ | ✅ | compras.ver (FIX) | 200 | PASS |
| /admin/compras/solicitacoes | ✅ | ✅ | solicitacoes.ver | 200 | PASS |
| /admin/compras/solicitacoes/nova | ✅ | ✅ | solicitacoes.criar | 200 | PASS |
| /admin/compras/solicitacoes/[id] | ✅ | ✅ | solicitacoes.ver + scope | 200 | PASS |
| /admin/compras/pedidos/[id] | ✅ | ✅ | compras.ver | 200 | PASS |
| /admin/fornecedores | ✅ | ✅ | fornecedores.ver (FIX) | 200 | PASS |
| /admin/relatorios | ✅ | ✅ | relatorios.ver (FIX) | 200 | PASS |
| /admin/mapa | ✅ | ✅ | mapa.ver (FIX) | 200 | PASS |
| /admin/busca | ✅ | ✅ | chamados.ver | 200 | PASS |
| /admin/estrutura | ✅ | ✅ | estrutura.ver (FIX) | 200 | PASS |
| /admin/usuarios | ✅ | ✅ | usuarios.administrar | 200 | PASS |
| /admin/auditoria | ✅ | ✅ | auditoria.ver | 200 | PASS |
| /admin/monitoramento | ✅ | ✅ (FIX) | monitoramento.ver (FIX) | 200 | PASS |
| /admin/notificacoes | ✅ | ✅ (sino) | requireOrg | 200 | PASS |
| /admin/qr-compras | ✅ | ✅ (tab) | compras.criar | 200 | PASS |
| /admin/perfil | ✅ | ✅ | requireOrg | 200 | PASS |
| /admin/perfil/[id] | ✅ (FIX P01) | ✅ (Organograma) | requireOrg + eh_membro | 200 | PASS |
| /admin/organograma | ✅ | ✅ | organograma.ver | 200 | PASS |
| /admin/desempenho | ✅ | ✅ | requireOrg | 200 (real metrics) | PASS |
| /admin/mensagens | ✅ | ✅ | organograma.ver | 200 | PASS |
| /admin/mensagens/[id] | ✅ | ✅ | participante | 200 | PASS |
| /api/cron/preventivas | ✅ | — | service_role | 200 | PASS |
| /auth/callback | ✅ | — | public | 200 | PASS |

**404:** 0 (P01-P03 corrigidos) | **Placeholders:** 0
