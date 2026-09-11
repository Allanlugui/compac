# SGA-M 2.0 — ROLE PERMISSIONS MATRIX (FASE 9.0 Auditoria)

**Data:** 2026-09-09 | **Fonte:** `src/lib/permissoes.ts:15` (34 chaves), `src/lib/types.ts:445` (6 roles)

Nenhum `SYSTEM_ROOT` existe. Superadmin é `ADMIN` por org (tenant-scoped). Não existe `auth.users` global admin.

## 1. Matriz 34 permissões × 6 perfis

| Permissão | ADMIN | GESTOR | TECNICO | COMPRAS | AUDITOR | SOLICITANTE | Uso (rotas/actions) |
|---|---|---|---|---|---|---|---|
| `usuarios.administrar` | ✅ | — | — | — | — | — | `/admin/usuarios` (5 actions) |
| `auditoria.ver` | ✅ | ✅ | — | — | ✅ | — | `/admin/auditoria`, `/admin/monitoramento` (deveria) |
| `estrutura.escrever` | ✅ | ✅ | — | — | — | — | `/admin/estrutura` (6 actions) — **bloqueia leitura** para outros |
| `ativos.ver` | ✅ | ✅ | ✅ | — | — | — | `/admin/ativos`, `/admin/ativos/[id]`, `/admin/mapa` |
| `ativos.criar` | ✅ | ✅ | — | — | — | — | `criarAtivo` |
| `ativos.editar` | ✅ | ✅ | — | — | — | — | `atualizarAtivo`, `uploadArquivo`, `regenerarQR` etc. |
| `ativos.alterar_status` | ✅ | ✅ | ✅ | — | — | — | `atualizarStatusAtivo` |
| `ativos.excluir` | ✅ | — | — | — | — | — | `excluirAtivo` (só ADMIN) |
| `chamados.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `/admin/chamados`, `/admin/chamados/[id]` (todos) |
| `chamados.criar` | ✅ | ✅ | ✅ | — | — | — | `criarChamadoManual`, QR público (bypass) |
| `chamados.executar` | ✅ | ✅ | ✅ | — | — | — | legado |
| `chamados.triagem` | ✅ | ✅ | — | — | — | — | `triarChamado`, `triagemECriarOS`, `atualizarImpacto` |
| `chamados.editar` | ✅ | ✅ | — | — | — | — | `chamados/[id]` edição |
| `os.ver` | ✅ | ✅ | ✅ | — | ✅ | — | `/admin/ordens-servico`, `/admin/chamados/[id]/os` |
| `os.criar` | ✅ | ✅ | — | — | — | — | `solicitarMaterialOS` cria solicitação |
| `os.planejar` | ✅ | ✅ | — | — | — | — | `atualizarPlanejamento` |
| `os.executar` | ✅ | ✅ | ✅ | — | — | — | `atualizarExecucao`, `transicaoOS`, `registrarAtividade`, `adicionarFotos*` |
| `os.concluir` | ✅ | ✅ | — | — | — | — | `concluirOS` |
| `os.encerrar` | ✅ | ✅ | — | — | — | — | `encerrarOS` |
| `os.aprovar` | ✅ | ✅ | — | — | — | — | `excluirServico`, `atualizarCustosDiretos` |
| `preventiva.ver` | ✅ | ✅ | ✅ | — | — | — | `/admin/preventivas`, `/admin/calendario` |
| `preventiva.criar` | ✅ | ✅ | — | — | — | — | `criarPlano` |
| `preventiva.editar` | ✅ | ✅ | — | — | — | — | `editarPlano` |
| `preventiva.executar` | ✅ | ✅ | — | — | — | — | `gerarOSPreventiva` |
| `compras.ver` | ✅ | ✅ | — | ✅ | ✅ | — | `/admin/compras`, `/admin/compras/pedidos/[id]` |
| `solicitacoes.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `/admin/compras/solicitacoes` (todos) |
| `solicitacoes.criar` | ✅ | ✅ | ✅ | ✅ | — | ✅ | `criarSolicitacaoInterna`, `enviarSolicitacao` |
| `solicitacoes.aprovar` | ✅ | ✅ | — | — | — | — | `transicaoSolicitacao` (segregação criador≠aprovador) |
| `compras.criar` | ✅ | ✅ | — | ✅ | — | — | `criarCompra`, `criarPedido`, `criarContexto` etc. |
| `compras.aprovar` | ✅ | ✅ | — | — | — | — | `aprovarPedido`, `transicaoSolicitacao` |
| `compras.cotar` | ✅ | ✅ | — | ✅ | — | — | `registrarCotacao`, `definirVencedora` |
| `compras.receber` | ✅ | ✅ | — | ✅ | — | — | `registrarRecebimento` |
| `estoque.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | — | `/admin/estoque` (deveria exigir) |
| `estoque.criar` | ✅ | ✅ | — | ✅ | — | — | `criarProduto` |
| `estoque.editar` | ✅ | ✅ | — | ✅ | — | — | `atualizarProduto`, `vincularFornecedor` |
| `estoque.movimentar` | ✅ | ✅ | ✅ | ✅ | — | — | `movimentarEstoque` (RPC) |
| `estoque.ajustar` | ✅ | ✅ | — | — | — | — | `movimentarEstoque` tipo ajuste |
| `estoque.transferir` | ✅ | ✅ | — | ✅ | — | — | `transferirEstoque` |
| `fornecedores.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | — | `/admin/fornecedores` |
| `fornecedores.criar` | ✅ | ✅ | — | ✅ | — | — | `criarFornecedor` |
| `fornecedores.editar` | ✅ | ✅ | — | ✅ | — | — | `editarFornecedor` |
| `checklists.escrever` | ✅ | ✅ | ✅ | — | — | — | `criarModelo`, `salvarExecucao` |

**Proteção 3 camadas:** UI `pode()` (esconde menu) + Server `exigirPermissao()` (42/83 actions) + RLS `eh_membro`/`tem_papel`. Gap: 10 rotas `/admin/*` sem `exigirPermissao` (dashboard, chamados/[id], os, calendario, estoque, compras, solicitacoes/[id], fornecedores, relatorios, monitoramento) — ver `UPGRADE_2_AUDIT.md:5.4`.

## 2. Dashboard / Menu por perfil (atual `AdminNav.tsx`)

| Perfil | Dashboard | Ativos | Chamados | O.S. | Preventivas | Calendário | Estoque | Solicitações | Compras | Fornecedores | Relatórios | Mapa | Busca | Estrutura | Usuários | Auditoria |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GESTOR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| TECNICO | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | — | — |
| COMPRAS | ✅ | — | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| AUDITOR | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| SOLICITANTE | ✅ | — | ✅ | — | — | ✅ | — | ✅ | — | — | — | ✅ | ✅ | — | — | — |

**Observação:** `SOLICITANTE` vê dashboard mas sem KPIs filtrados por `solicitante`; `TECNICO` vê custos em dashboard N4 sem gate.
