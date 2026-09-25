# BLOCO 3.5 — Auditoria global de UX/UI e arquitetura de informação

> Só auditoria (código real, 2026-09-24/25). Nenhuma implementação. Branch `refactor/sgam-rearquitetura-cliente`.
> Escala verificada: 42 pages + 2 routes; `EstoqueClient` 923 linhas/56 `useState`; `EstruturaManager` 351; `MembrosManager` 373+; dashboard 350; `chamados/[id]` ~20 componentes; compras ~20 arquivos; DS formal: 3 componentes (`PageHeader`, `StatCard`, `EmptyState`).

## A. MAPA ATUAL (rota → tarefa real)
- **Dashboard** (`dashboard/page.tsx` + `RoleDashboard`): N1–N4, ~15 cards + 5 BarLists, mesmo para todos (menos N4 p/ SOLICITANTE). Tarefa real: "o que preciso saber/fazer agora?" — soterrada em métricas globais.
- **Ativos**: lista dupla (`AtivosGrid` + `AtivosTable` — duplicação), wizard `NovoAtivoForm`, ficha `[id]` com 8 managers (form, checklist, docs, QR, status, dados técnicos...). Tarefa real: "encontrar equipamento e ver situação".
- **Chamados**: lista + `NovoChamadoForm`; detalhe `[id]` com ~20 componentes (triagem, planejamento, execução, checklist, fotos ×3, custos, serviços, consumo, compras, timeline, status...). Tarefa real: "acompanhar/executar o ticket". Página faz tudo ao mesmo tempo.
- **O.S.** (`chamados/[id]/os` + `ordens-servico`): espelha o chamado — duas visões do mesmo objeto.
- **Estoque**: 1 client gigante, 4 abas (produtos/movs/inventário/notas), criar+editar+ficha+transfer+NF-e na mesma tela. Tarefa real varia por contexto (técnico consome; almox movimenta).
- **Compras**: 3 níveis (solicitações → pedidos → recebimentos) + QR-compras + `compras` legado (`TabelaCompras` + `PedidosCompra` + `NovaCompraForm` convivendo com fluxo novo — duplicação de modelo).
- **Relatórios**: 8 abas + gráficos + CSV/print; mesmos KPIs do dashboard (duplicação de consulta).
- **Mapa/Desempenho/Calendário/Preventivas/Monitoramento**: visões fragmentadas do mesmo domínio operacional.
- **Estrutura/Cadastros/Usuários**: 3 CRUDs tabulares quase idênticos (managers 350+ linhas cada) + `PermissoesEditor` anexado em usuários.
- **Mensagens/Organograma/Busca-rota**: fora do menu (BLOCO 1), código preservado.
- **Público**: `qr/[hash]` (form + fotos), `qr-compra/[hash]` (form + tracking), `/atendimento/*` (chat novo).

## B. PROBLEMAS GLOBAIS
1. **Páginas-faz-tudo**: detalhe do chamado (~20 componentes), estoque (4 abas), cadastros (3 abas) — carga cognitiva máxima, sem прогрессão por tarefa.
2. **Duplicações**: AtivosGrid×Table; `Card` local do dashboard × `StatCard`; `compras` legado × fluxo novo; dashboard × relatórios (mesmos KPIs); mensagens × futura thread.
3. **Densidade sem hierarquia**: 15 cards no dashboard para todos os perfis; tabelas com 8–11 colunas; formulários com 10+ campos simultâneos.
4. **Ações enterradas**: transferir/ajustar/inventário dentro de abas; O.S. dentro do chamado; permissões dentro do editor de membro.
5. **Navegação por CRUD, não por tarefa**: menu espelha tabelas; técnico e almox veem o mesmo desktop comprimido.
6. **DS informal**: 3 componentes oficiais + variantes locais (`Card`, botões/campos redefinidos por arquivo, tons arbitrários); sem tokens de espaçamento/tipografia (só Tailwind ad-hoc); `globals.css` mínimo.
7. **Mobile = desktop estreito**: BottomNav 6 itens genéricos; sem fluxos dedicados; sem leitura de QR integrada.
8. **Conceitos misturados**: chamado = ticket = O.S. em formação; `compras` legado × novo; setor/departamento texto × tabelas; solicitação com/sem vínculo.

## C. PERMANECEM (funcionalidade, não forma)
Dashboard (repensado por perfil), ativos, chamados, O.S., preventivas, calendário, estoque+RPC, solicitações, compras, fornecedores, relatórios, mapa, desempenho, estrutura, cadastros, usuários, auditoria, monitoramento, perfil, notificações (corrigidas), QR/links, atendimento engine, e-mail SMTP.

## D. CONSOLIDAR
- AtivosGrid+Table → 1 lista com alternância de densidade.
- Dashboard Card local + StatCard → 1.
- `compras` legado → migrar ou remover (auditar uso real; NÃO VALIDADO volume).
- Dashboard × relatórios → mesma camada (já é), UX distinta: dashboard = ação, relatório = análise.
- O.S. como VISÃO do chamado (não rota paralela confusa).
- Cadastros/estrutura/usuários → IA única de dados mestres (BLOCO 1 começou).
- Mensagens → thread do ticket (BLOCO 4/5).

## E. REMOVER (navegação já; código/dados só com migração)
Mensagens, organograma, busca-rota (feito no menu). Físico: NADA neste bloco.

## F. NAVEGAÇÃO PROPOSTA
- **Desktop por tarefa**: Operação (fila de trabalho primeiro, não cards), Suprimentos (fluxo solicitação→estoque), Inteligência (análise), Administração (Configurações como IA própria §H-BLOCO1-doc).
- **Padrão de página**: header (tarefa) → estado atual → 1 ação principal → secundárias colapsadas → histórico em aba/timeline.
- **Mobile**: `/m/tecnico`, `/m/almox` (tarefa-única, bottom 4 itens, QR nativo).

## G. INFORMAÇÃO PROPOSTA
- Ficha de ativo como centro de contexto (§5 briefing); chamado como timeline (não 20 painéis); estoque por contexto operacional; formulários progressivos (como o intake: 1 pergunta/vez); tabelas com colunas por perfil; empty/loading/error padronizados.

## H. FLUXOS PRINCIPAIS
1. Universal: link → chat → triagem → ticket → acompanhamento.
2. Ativo: QR → chat contextualizado → ticket vinculado.
3. Triagem: slots obrigatórios → validação → confirmação → entidade.
4. Escalonamento: Facilities resolve direto OU converte em O.S. (nunca automático).
5. Sem O.S.: entrada → resolução → encerramento + e-mail + auditoria.
6. Com O.S.: ticket → O.S. → execução → conclusão.
7. Acompanhamento: token → timeline + thread + anexos.
8. Comunicação: thread → e-mail → resposta no portal → equipe notificada.
9. Compra: link → chat → solicitação → notificação → acompanhamento.
10. Estoque: reserva → separação → consumo/devolução; compra → recebimento → entrada.
11–12. Mobile técnico/almox conforme briefing (tarefa-única).

## I. TICKET → CHAMADO → O.S. (proposta, NÃO VALIDADO)
`solicitacao_entrada` (intake bruto) → `ticket` (triado, com solicitante/participantes) → `chamado` (operacional, opcional) → O.S. (quando necessário). Hoje: intake cria `chamados` direto (divergência registrada). BLOCO 4 decide: nova tabela `tickets` OU `chamados` com `fase=ticket` (auditar impacto em 20+ queries antes).

## J. SUPRIMENTOS (proposta)
Solicitação → aprovação → (reserva) → compra → recebimento → entrada; consumo vinculado à O.S.; devolução com motivo; alertas acionáveis; inventário cego. Motor RPC preservado; faltam amarração solicitação↔reserva e lote (NÃO VALIDADO).

## K. MOBILE (proposta)
Técnico: Painel (minhas O.S., atrasadas, SLA) → O.S. execução (fotos, checklist, concluir) → Solicitar material → Perfil. Almox: Painel (críticos, pendentes, top) → Estoque (ler QR, movimentar) → Atender solicitações → Perfil. Multicontexto: alternador por membership/override. Mesmo backend/actions/permissões.

## L. DESIGN SYSTEM (princípios, sem implementar)
1. Uma pergunta/ação por tela em fluxos; 2. hierarquia fixa (título → estado → ação → detalhe); 3. tokens (espaçamento 4/8, texto sm/base/lg, raios xl/2xl); 4. 6 tons semânticos existentes como base; 5. botões primário/perigo/fantasma únicos; 6. tabelas com densidade por perfil; 7. estados (vazio/loading/erro/sucesso) padronizados; 8. 44px mínimo touch; 9. sem cor como único sinal; 10. dark mode NÃO VALIDADO (globals tem media query morta).

## M. REDESENHO POR ETAPAS
1. Fundação DS (tokens + botões/inputs/tabela/card únicos, remove duplicados). 2. Ficha ativo como contexto. 3. Chamado como timeline (colapsa 20 componentes em seções por fase). 4. Estoque por contexto. 5. Cadastros/config IA única. 6. Mobile dedicado. 7. Dashboard por perfil (por último, consome o resto).

## N. RISCOS E DEPENDÊNCIAS
- `compras` legado: mapear uso antes de remover. - Ticket vs chamado: decisão trava BLOCO 4. - RLS/policies em novas tabelas (padrão v6). - Volume real das tabelas (NÃO VALIDADO — paginação existe, mas sem medição). - SMTP deliverability (R4). - Realtime (polling cobre; avaliar depois).

## O. NÃO IMPLEMENTAR AINDA
Nada visual; nada de banco; BLOCO 4; portal; IA; mobile; DS; remoção física; merge/produção.
