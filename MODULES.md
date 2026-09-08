# SGA-M — MODULES

## Estrutura (`/admin/estrutura`)
- **Finalidade:** Hierarquia física (unidade→sala) e categorias com atributos dinâmicos.
- **Rotas:** `/admin/estrutura`
- **Componentes:** `EstruturaManager` (abas locs/cats, CRUD)
- **Actions:** `criarLocalidade`, `editarLocalidade`, `excluirLocalidade`, `criarCategoria`, `editarCategoria`, `excluirCategoria`
- **Tabelas:** `localidades`, `categorias`
- **Permissões:** `estrutura.escrever` (`ADMIN`/`GESTOR`)
- **Integrações:** `ativos.localidade_id`, `ativos.categoria_id`, `produtos.categoria_id`

## Ativos (`/admin/ativos`)
- **Finalidade:** Cadastro e gestão de ativos com QR, documentos, histórico, checklist.
- **Rotas:** `/admin/ativos`, `/admin/ativos/[id]`
- **Componentes:** `AtivosClient`, `FichaAtivo`, `GaleriaFotos`, `Checklist`
- **Actions:** `criarAtivo`, `atualizarAtivo`, `mudarStatus`, `uploadDocumento`, `gerarQR`, `imprimirQR`
- **Tabelas:** `ativos`, `ativo_status_historico`, `ativo_documentos`, `categorias`, `localidades`, `fornecedores`
- **Permissões:** `ativos.criar` (`AG`), `ativos.editar` (`AGT`), `ativos.excluir` (`ADMIN`), `ativos.mudarStatus` (`AGT`)

## QR (`/qr/[hash]` e `/qr-compra/[hash]`)
- **Finalidade:** Identidade digital do ativo e tracking público de solicitação.
- **Rotas:** `/qr/[hash]` (público, sem auth), `/qr-compra/[hash]` (público)
- **Actions:** `qr/[hash]/actions.ts` (`abrirChamado`), `qr-compra/[hash]/actions.ts`
- **Tabelas:** `ativos` (via `qr_code_hash`), `chamados`, `solicitacoes_compra` (via `qr_code_hash`)
- **Permissões:** `anon` com escopo mínimo (`qr_code_hash` → `organization_id` server-side), `service_role` para `insert` com `RETURNING`

## Manutenção (`/admin/chamados`)
- **Finalidade:** Demanda → triagem → O.S. → execução → conclusão.
- **Rotas:** `/admin/chamados/novo`, `/admin/chamados/[id]`, `/admin/chamados/[id]/os`
- **Componentes:** `ChamadosClient`, `TriagemForm`, `OsWorkflowControl`, `GaleriaFotos` (antes/durante/depois)
- **Actions:** `criarChamado`, `triagemECriarOS` (via `criar_os_a_partir_de_triagem` RPC), `atualizarChamado`, `mudarStatus`, `adicionarAtividade`, `adicionarServico`, `uploadFoto`, `concluirOS`
- **Tabelas:** `chamados`, `os_status_historico`, `os_atividades`, `os_servicos_externos`, `os_fotos`, `planos_manutencao`, `checklist_execucoes`
- **Permissões:** `chamados.criar` (todos autenticados), `chamados.editar` (`AGT`), `chamados.excluir` (`AG`)

## Estoque (`/admin/estoque`)
- **Finalidade:** Produtos, movimentações, inventário, transferência, importação NF-e.
- **Rotas:** `/admin/estoque`
- **Componentes:** `EstoqueClient` (4 abas: produtos, movs, inventário, notas), `ProdutoTable`, `FichaProduto` (drawer)
- **Actions:** `criarProduto`, `atualizarProduto`, `movimentarEstoque` (via `movimentar_estoque_atomic` RPC), `transferirEstoque`, `criarUnidade`, `vincularFornecedor`, `processarNotaFiscal` (XML/PDF), `confirmarEntradaNotaFiscal`
- **Tabelas:** `produtos`, `movimentacoes_estoque`, `unidades_medida`, `produto_fornecedores`
- **Permissões:** `estoque.criar` (`AGC`), `estoque.editar` (`AGC`), `estoque.movimentar` (`AGCT`), `estoque.ajustar` (`AG`), `estoque.transferir` (`AGC`)

## Compras (`/admin/compras`)
- **Finalidade:** Solicitações → cotações → pedidos → recebimentos.
- **Rotas:** `/admin/compras`, `/admin/compras/solicitacoes`, `/admin/compras/solicitacoes/nova`, `/admin/compras/solicitacoes/[id]`, `/admin/compras/pedidos/[id]`, `/admin/qr-compras`
- **Actions:** `criarSolicitacao`, `aprovarSolicitacao`, `criarCotacao`, `criarPedido`, `receberPedido`
- **Tabelas:** `solicitacoes_compra`, `solicitacao_itens`, `cotacoes`, `pedidos_compra`, `pedido_itens`, `recebimentos`, `recebimento_itens`, `compras` (legado)
- **Permissões:** `compras.criar` (`AGCT`), `compras.aprovar` (`AG`), `compras.ver` (todos)

## Fornecedores (`/admin/fornecedores`)
- **Finalidade:** Cadastro de fornecedores.
- **Rotas:** `/admin/fornecedores`
- **Actions:** `criarFornecedor`, `atualizarFornecedor`
- **Tabelas:** `fornecedores`
- **Permissões:** `fornecedores.ver` (`AGC`), `fornecedores.criar` (`AGC`)

## Dashboard (`/admin/dashboard`)
- **Finalidade:** Centro de comando N1-N4 com 15 KPIs.
- **Rota:** `/admin/dashboard` com `?periodo=7d|30d|90d|12m`
- **Componentes:** `DashboardPage` (Server, `Promise.all` com `queries.ts`), `StatCard`, `BarList`
- **Tabelas:** Todas via `src/lib/analytics/queries.ts` (mesma camada de relatórios)
- **Permissões:** `ADMIN`/`GESTOR` (visão executiva), outros via `requireOrg` + RLS

## Relatórios (`/admin/relatorios`)
- **Finalidade:** 8 abas (executivo, ativos, manutenção, SLA, custos, estoque, solicitações, top)
- **Rota:** `/admin/relatorios?periodo=30d&aba=executivo`
- **Componentes:** `RelatoriosPage` (Server), `ExportButtons` (CSV + `window.print` PDF)
- **Tabelas:** Mesmas do Dashboard via `queries.ts`
- **Permissões:** `relatorios.ver` (todos autenticados, RLS filtra)

## Mapa (`/admin/mapa`)
- **Finalidade:** Navegação hierárquica por localidade → ativo.
- **Rota:** `/admin/mapa`
- **Componentes:** `MapaPage` (Server), `MapaClient` (árvore, filtros, busca contextual, lista, sem localização)
- **Tabelas:** `localidades`, `ativos`, `chamados` (para O.S. por ativo)
- **Permissões:** `mapa.ver` (todos autenticados, RLS)

## Busca (`/admin/busca` + header)
- **Finalidade:** Busca global transversal (8 entidades, até 10 por categoria, total 80).
- **Rota:** `/admin/busca?q=termo` + `BuscaGlobal` (header, `Ctrl+K`, debounce 300ms)
- **Actions:** `buscarGlobal` (sanitiza `[%_,()"'\\;]`, `ilike` com `or`, `limit`, `eq orgId`)
- **Tabelas:** `ativos`, `chamados`, `produtos`, `fornecedores`, `compras`, `solicitacoes_compra`, `pedidos_compra`, `localidades`
- **Permissões:** `requireOrg` + RLS, sem `service_role`

## Notificações (`/admin/notificacoes` + sino)
- **Finalidade:** Central de eventos operacionais (SLA, estoque, ativos, solicitações).
- **Rota:** `/admin/notificacoes` + `SinoLink` no header/layout
- **Actions:** `notificar`, `marcarLida`, `marcarTodasLidas` + `src/lib/notificacoes.ts` (geração idempotente com janela 24h, 4 verificadores)
- **Tabelas:** `notificacoes` (RLS `eh_membro` + `user_id` check)
- **Permissões:** `notificacoes.ver` (todos), `notificar` é sistema (via `requireOrg`)

## Auditoria (`/admin/auditoria`)
- **Finalidade:** Trilha imutável de mutações (33 ações canônicas).
- **Rota:** `/admin/auditoria` (ADMIN/GESTOR/AUDITOR)
- **Tabelas:** `auditoria_logs` (RLS `eh_membro` ou `org is null`)

## Usuários (`/admin/usuarios`)
- **Finalidade:** Gestão de membros e roles.
- **Rota:** `/admin/usuarios` (ADMIN)
- **Actions:** `convidarUsuario`, `mudarRole`, `removerMembro` (via `auth.admin` + `service_role`)
- **Tabelas:** `profiles`, `memberships`

