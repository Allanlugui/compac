# SGA-M 2.0 — ROLE EXPERIENCE MATRIX (FASE 9.1 Adendo)

**Fonte:** `src/lib/permissoes.ts` 35 + `src/app/admin/_components/AdminNav.tsx` + `src/lib/analytics` + `src/app/admin/**`

> Princípio: `ROLE → PERMISSION → ROUTE → ACTION → RECORD SCOPE → FIELD VISIBILITY → DATA` (least privilege, não enviar dado restrito ao client).

## 1. Menu global (role-aware, `AdminNav.tsx:SECOES_NAV`)

| Seção | Rota | ADMIN | GESTOR | TECNICO | COMPRAS | AUDITOR | SOLICITANTE |
|---|---|---|---|---|---|---|---|
| Dashboard | `/admin/dashboard` | ✅ (todos KPIs) | ✅ | ✅ (sem N4) | ✅ | ✅ | ✅ (sem N4, sem valor físico) |
| Ativos | `/admin/ativos` | ✅ | ✅ | ✅ | — | — | — |
| Chamados | `/admin/chamados` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (só próprios) |
| Ordens Serviço | `/admin/ordens-servico` | ✅ | ✅ | ✅ | — | ✅ | — |
| Preventivas | `/admin/preventivas` | ✅ | ✅ | ✅ | — | — | — |
| Calendário | `/admin/calendario` | ✅ | ✅ | ✅ | — | — | — |
| Estoque | `/admin/estoque` | ✅ | ✅ | ✅ (só movimentar) | ✅ | ✅ (read) | — |
| Solicitações | `/admin/compras/solicitacoes` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (só próprias) |
| Compras | `/admin/compras` | ✅ | ✅ | — | ✅ | ✅ (read) | — |
| Fornecedores | `/admin/fornecedores` | ✅ | ✅ | ✅ (ver) | ✅ | ✅ (ver) | — |
| Relatórios | `/admin/relatorios` | ✅ | ✅ | — | ✅ | ✅ | — |
| Mapa | `/admin/mapa` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Busca | `/admin/busca` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (filtrada) |
| Estrutura | `/admin/estrutura` | ✅ | ✅ | ✅ (ver) | ✅ (ver) | ✅ (ver) | ✅ (ver) |
| Usuários | `/admin/usuarios` | ✅ | — | — | — | — | — |
| Auditoria | `/admin/auditoria` | ✅ | ✅ | — | — | ✅ | — |
| Monitoramento | `/admin/monitoramento` | ✅ | ✅ | — | — | ✅ | — |
| Notificações | `/admin/notificacoes` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| QR Compras | `/admin/qr-compras` | ✅ | ✅ | — | ✅ | — | — |
| Meu Perfil | `/admin/perfil` (futuro) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Organograma | `/admin/organograma` (futuro) | ✅ (all) | ✅ (subtree) | ✅ (sup+pares) | ✅ | ✅ | ✅ |
| Mensagens | `/admin/mensagens` (futuro) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 2. Field visibility (least privilege)

| Campo | ADMIN | GESTOR | TECNICO | COMPRAS | AUDITOR | SOLICITANTE |
|---|---|---|---|---|---|---|
| `ativos.custo` `valor_aquisicao` | ✅ | ✅ | — | — | ✅ (read) | — |
| `produtos.custo_medio` `ultimo_custo` | ✅ | ✅ | — (só `codigo/desc/estoque`) | ✅ | ✅ (read) | — |
| `chamados.custo_mao_obra/outros` `os_servicos` | ✅ | ✅ | — | — | ✅ (read) | — |
| `compras.valor_total` `pedidos` frete/impostos | ✅ | ✅ | — | ✅ | ✅ (read) | — |
| ` Dashboard N4 Custo total` | ✅ | ✅ | — | ✅ | ✅ | — |
| `Estoque valor físico` | ✅ | ✅ | — | ✅ | ✅ | — |
| `email/telefone/matricula` | ✅ | — | — | — | — | — |
| `auditoria_logs` | ✅ | ✅ | — | — | ✅ | — |
| `notificacoes` custo | ✅ | ✅ | — | ✅ | ✅ | — (só próprias) |

Servidor **não retorna** campo se `!pode()` — ex: `SOLICITANTE` `GET /admin/dashboard` → `custoTotal` não incluído (ou `null`), `produtos` sem `custo_medio`.

## 3. Record scope

| Entidade | ADMIN | GESTOR | TECNICO | COMPRAS | AUDITOR | SOLICITANTE |
|---|---|---|---|---|---|---|
| `ativos` | org inteira | org inteira | org (via `ativos.ver`) | — | — | — |
| `chamados` | org | equipe (manager_id subtree) | atribuídos `responsavel=uid` ou `equipe` | — | org read | `solicitante=email` |
| `os` | org | equipe | atribuídas | — | org read | — |
| `solicitacoes_compra` | org | org | próprias + equipe | org | org read | `created_by=uid OR solicitante=email` |
| `produtos/estoque` | org | org | necessário à execução | org | org read | — |
| `compras/pedidos` | org | org | — | org | org read | — |
| `mensagens` | participantes | participantes | participantes | participantes | participantes | participantes |
| `notificacoes` | `org + (user_id null OR =uid)` | idem | idem | idem | idem | idem |

## 4. Route → Action → Scope

| Rota | Action | ADMIN | GESTOR | TECNICO | COMPRAS | AUDITOR | SOLICITANTE |
|---|---|---|---|---|---|---|---|
| `ativos` | `ver/criar/editar/excluir/status` | ✅/✅/✅/✅/✅ | ✅/✅/✅/—/✅ | ✅/—/—/—/✅ | — | — | — |
| `chamados` | `ver/criar/triagem/executar` | ✅ | ✅ | ✅ | ✅(ver) | ✅(ver) | ✅(ver/criar) |
| `os` | `ver/planejar/executar/concluir/encerrar/aprovar` | ✅ | ✅ | ✅(exec) | — | ✅(ver) | — |
| `estoque` | `ver/criar/editar/movimentar/ajustar/transferir` | ✅ | ✅ | ✅(mov) | ✅ | ✅(ver) | — |
| `compras` | `ver/criar/aprovar/cotar/receber` | ✅ | ✅ | — | ✅ | ✅(ver) | — |
| `solicitacoes` | `ver/criar/aprovar` | ✅ | ✅ | ✅(criar) | ✅ | ✅(ver) | ✅(ver/criar, não aprovar) |

## 5. Componentes / Botões / Formulários

- `TECNICO` `chamados/[id]`: `TriagemForm` ❌, `ExecucaoForm` ✅, `ConsumoEstoque` ✅, `SolicitarMaterial` ✅, `CustosForm` ❌, `ServicosList` read.
- `GESTOR` `chamados/[id]`: `TriagemForm` ✅, `OsWorkflowControl` `concluir/encerrar` ✅, `CustosForm` ✅.
- `COMPRAS` `estoque`: `criarProduto` ✅, `movimentar` ✅, `transferir` ✅.
- `SOLICITANTE` `solicitacoes/nova`: `NovaSolicitacaoForm` ✅, `CotacoesManager` ❌, `GerarPedidoForm` ❌.

## 6. Filtros / Indicadores / Links / Atalhos / Notificações

- Dashboard: `SOLICITANTE` sem `N4`, `TECNICO` sem `valor físico`, `AUDITOR` sem `os.executar`.
- Mapa: `TECNICO` só ativos `localidade` da sua `equipe` (futuro).
- Busca: `SOLICITANTE` não retorna `produtos`/`fornecedores`/`compras` (já filtrado 9.1).
- Notificações: `sla_atrasada` só `GESTOR/TECNICO` atribuído, `estoque_critico` só `COMPRAS/GESTOR`, `mensagem_recebida` só participantes.
- Relatórios: `custos` só `ADMIN/GESTOR/COMPRAS/AUDITOR`, `SOLICITANTE` não vê `aba custos`.

## 7. Dados retornados (least privilege)

- `SOLICITANTE` `GET /admin/ativos` → 403 (sem `ativos.ver`).
- `SOLICITANTE` `GET /admin/estoque` → 403.
- `SOLICITANTE` `GET /api` `produtos` → sem `custo_medio`.
- `TECNICO` `GET /admin/estoque` → `produtos` sem `custo_medio` (se policy).

## 8. Auditoria

Toda mudança `role`, `manager_id`, `avaliacao`, `mensagem`, `perfil` → `registrarLog` com `organization_id`, `user_id`.

Ver `ACCESS_CONTROL_SPEC.md` para gates server-side + RLS.
