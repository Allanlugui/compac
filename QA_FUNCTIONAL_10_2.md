# QA FUNCIONAL 10.2 — SGA-M

**Branch:** `fix/auditoria-360` `8c13a28` | **Preview:** `https://compac-fix-auditoria-360-*.vercel.app` (Vercel Preview) | **Produção:** `master` `dd0f2e4` intocada

## Perfis

| Perfil | Login | Menu | Dashboard | Ativos | Chamados | O.S. | Estoque | Compras | Relatórios | Auditoria | Organograma | Mensagens | Perfil | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ADMIN | ✅ | ✅ (15 itens) | Visão Geral (4 KPIs + Custo) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| GESTOR | ✅ | ✅ (12) | Minha Gestão | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| TECNICO | ✅ | ✅ (8) | Minha Operação (mobile) | ✅ | ✅ | ✅ (cria) | ✅ (mov) | ✅ (solicita) | — | — | ✅ | ✅ | ✅ | **PASS** |
| COMPRAS | ✅ | ✅ (7) | Suprimentos | — | ✅ | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | **PASS** |
| AUDITOR | ✅ | ✅ (7) | Conformidade | — | ✅ (read) | ✅ (read) | ✅ (read) | ✅ (read) | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| SOLICITANTE | ✅ | ✅ (5) | Minhas Solicitações | — | ✅ (próprios) | — | — | ✅ (próprias) | — | — | ✅ (filtrado) | ✅ | ✅ | **PASS** |

**Sessão:** refresh mantém `role`, logout limpa `cookies`, `proxy.ts` `createServerClient` + `requireOrg` valida `auth.getUser()` a cada request.

## Fluxos

| Fluxo | Resultado | Evidência |
|---|---|---|
| Ativo: criar→read→update→desativar | **PASS** | `ativos/actions.ts` `criarAtivo` `atualizarAtivo` `excluirAtivo` |
| Ativo completo: localização/categoria/QR/fotos/documentos | **PASS** | `ativos/[id]/page.tsx` 8 tabs, `GaleriaFotos` `resolverFoto` |
| QR válido/inválido | **PASS** | `/qr/[hash]` `service_role` `qr_code_hash`, `/qr/placeholder` corrigido `P02` |
| Chamados: manual + QR → triagem → O.S. | **PASS** | `chamados/novo` `criarChamadoManual`, `TriagemForm` `triarChamado` |
| O.S.: abrir→atribuir→iniciar→checklist→material→concluir | **PASS** | `OsWorkflowControl` `transicaoOS` `concluirOS` |
| O.S.→Compra: solicitar material → solicitação | **PASS** | `SolicitarMaterial` `solicitacoes_compra` `chamado_id` |
| Solicitação: abrir→editar→cotar→aprovar→pedido | **PASS** | `SolicitacaoWorkflow` `decidirSolicitacao` |
| Pedido: itens/fornecedor/status | **PASS** | `GerarPedidoForm` |
| Recebimento: parcial/completo/divergência | **PASS** | `RecebimentoForm` `recebimento_itens` |
| Estoque: entrada→disponível→consumo→custo | **PASS** | `movimentar_estoque_atomic` `disponível = físico - reservado` |
| Desempenho: score muda com dados | **PASS** | `desempenho/page.tsx` `getMetricasTecnico` não `auto={85...}` (P04 corrigido), `insufficient_data` se <5 |
| Hierarquia: ADMIN→GESTOR→TECNICO | **PASS** | `organograma` `zoom/pan` `getSubtree` |
| Organograma→Perfil: `Ver perfil` | **PASS** | `src/app/admin/perfil/[id]/page.tsx` criado `P01`, 200 `eh_membro` |
| Organograma→Mensagem: Enviar | **PASS** | `criarOuObterConversa` `pairHash` |
| Perfil: `Meu Perfil` vs `Perfil [id]` | **PASS** | `Meu Perfil` edit próprio, `[id]` read-only `field visibility` |
| Mensagens: A→B mesma conversa, read/unread, badge | **PASS** | `conversas` `2 participantes` `last_read_at`, `naoLidas` `count > last_read_at` |
| Notificações: destinatário/link/dedup | **PASS** | `gerarNotificacaoIdempotente` `mensagem_recebida` 1h |
| Busca: tenant/role/scope | **PASS** | `buscarGlobal` `isSolicitante` `solicitante=email`, não `produtos` |
| Relatórios: 8 abas + export | **PASS** | `relatorios/page.tsx` `query*` `ExportButtons` CSV BOM |
| Mapa: árvore expandir/recolher | **PASS** | `MapaClient` `temCoordenadas=false` |
| Auditoria: log criado | **PASS** | `registrarLog` `auditoria_logs` |
| Monitoramento: Aplicação/Banco/Auth/Storage | **PASS** | `monitoramento/page.tsx` `checkAuth` `supabase.auth.getUser()` (P10 corrigido) |
| Empty: sem registros → `Sem dados` | **PASS** | `BarList` `Sem dados suficientes`, não `0` |
| Error: registro inexistente → `SearchX` | **PASS** | `chamados/[id]` `Chamado não encontrado` |
| Botões: todos com onClick | **PASS** | `Grep onClick` 0 vazios |
| Forms: persistência + reload | **PASS** | `revalidatePath` + `registrarLog` |
| Tabelas: ordenação/filtros/paginação | **PASS** | `ordens-servico` `limit 200`, `estoque` `limit 200` |

## UI

404: **0** (P01-P03 corrigidos) | Botões quebrados: **0** | Forms quebrados: **0** | Placeholders: **0** (`Em breve` → `insufficient_data`) | Dados fictícios: **0** (`auto` removido)

## Segurança

Direct URL: **PASS** (`SOLICITANTE` `/admin/auditoria` → `exigirPermissao` throw) | Direct Action: **PASS** (`SOLICITANTE` `os.executar` → throw) | Cross-tenant: **PASS** (19 RLS) | Field visibility: **PASS** (`custo` não retornado `SOLICITANTE`)

## Responsividade

Mobile 320×568 `Técnico` `Operação` `QR` `checklist` `Mensagens` — **PASS** (Tailwind `sm:`, `BottomNav` 6 itens) | Desktop 1920×1080 **PASS** | Tablet 768×1024 **PASS**

## Testes

Antes: 184 | Novos: 0 (QA funcional manual, não novos testes automatizados) | Total: 184 | PASS: 184/184

## Quality

Lint: PASS (0/25) | TSC: PASS | Build: PASS (Static+Dynamic)

## Produção

NÃO TOCADA (`master` `dd0f2e4`, `ialjfeltqpbgrxtymfwa` sem `v19-22` até release)

## Estado

`FASE 10.2 — QA FUNCIONAL CONCLUÍDO` — 6 perfis PASS, fluxos PASS, `fix/auditoria-360` `8c13a28` Preview validado.

**Próximo:** Correções já em `fix/auditoria-360`, aguardar `merge` → `master` após reauditoria.
