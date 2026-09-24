# SGA-M · REARQUITETURA V2 — Plano Mestre pós-feedback do cliente

> **FASE 0 — RESET ARQUITETURAL (2026-09-24). NÃO implementar nesta sessão.**
> Fonte de verdade funcional: feedback do cliente (§7–§33 do protocolo).
> Roadmap anterior (FASE 11.x, Blocos 1–4 de cadastros) = HISTÓRICO TÉCNICO, suspenso.
> Precedência factual: código + banco + git + produção verificada > memória.

## A. ESTADO ATUAL (auditado no código, branch `fix/os-foto-antes-bug` @ `a1eac3c`)

### A.1 Plataforma
- Next.js 16.3.4 App Router + React 19.2.8 + TS5 + Tailwind 4 + Supabase + Recharts. **42 `page.tsx` + 2 `route.ts`** (build 42 rotas). 21 suítes vitest (209/209 na reconciliação 2026-09-21). `src/` limpo.
- Git: branch `fix/os-foto-antes-bug` = `origin` (`a1eac3c`: FASE 11.2 + Blocos 1–4). `master` em `f8e0886` (Release 2.0.1). **FASE 11.1/11.2 e Blocos 1–4 NÃO estão em master.** Produção congelada v2.0.1, DB v22 + migrations v23→v26 aplicadas no live (verificado por probe).
- Segurança (PRESERVAR): `requireOrg()` JWT server-side + RLS `eh_membro`/`tem_papel` + `enforce_same_org` + Storage privado `o/{orgId}/` + `service_role` server-only. Matriz 60+ permissões + overlay `permissoes_custom` (Bloco 3, aplicado em estoque/cadastros).

### A.2 Módulos e rotas atuais
| Área | Rotas |
|---|---|
| Operação | dashboard, ativos(+`[id]`), chamados(+novo, `[id]`, `[id]/os`), ordens-servico, preventivas, calendario |
| Suprimentos | estoque, compras(+pedidos, solicitacoes...), fornecedores, qr-compras |
| Inteligência | relatorios, mapa, busca, organograma, mensagens(+`[id]`), desempenho |
| Admin | estrutura, cadastros, usuarios, auditoria, monitoramento, perfil(+`[id]`) |
| Público | qr/`[hash]`, qr-compra/`[hash]` (+`nova?t=`), login, primeiro-acesso, recuperar-senha, selecionar-org |

### A.3 Fluxos atuais (resumo)
- **Chamado:** QR ativo / manual → chamado → triagem → O.S. (RPC) → execução (fotos antes/durante/depois) → conclusão. Escalonamento O.S. quase obrigatório.
- **Estoque:** produto global (`estoque_atual`) + vínculo almox (Bloco 2, dual) via RPC atômica; transferência = par auditado; NF-e XML/PDF importa entradas.
- **Compras:** solicitação (portal público via QR contexto ou admin) → cotação → pedido → recebimento → entrada estoque. QR-compra público existe (a descontinuar como formulário).
- **Usuários:** convite ADMIN com senha provisória (SMTP `lib/email.ts` best-effort) → membership role + setor/depto texto → overlay custom por usuário.
- **Notificações:** `gerarNotificacaoIdempotente` (janela 24h) + 4 verificadores (SLA, estoque, ativos, solicitações) + sino. **HIPÓTESE de bug real:** dedup usa `.eq("user_id", null)` — em Postgres `= NULL` nunca é verdadeiro, logo a deduplicação de broadcast (sino geral) NÃO funciona → possíveis duplicatas (NÃO VALIDADO em runtime).
- **Mensagens:** `conversas` + `conversa_participantes` + `mensagens` (sender binding + imutabilidade via trigger, HOTFIX 2–4). User-to-user global.
- **E-mail:** `nodemailer` SMTP próprio (`SMTP_HOST/PORT/USER/PASS/FROM`), server-side, sem templates (textos hardcoded), usado em convite + senha provisória.
- **Mobile:** `BottomNav` 6 destinos + `RoleDashboard` + layout responsivo. Sem app dedicado; sem contexto técnico/almox separado. Sem alternância de contexto (1 role por membership).
- **IA/chatbot:** INEXISTENTE (nenhuma dependência LLM, nenhum endpoint chat).

### A.4 Referências cruzadas dos módulos a descontinuar
- `mensagens`: AdminNav + link no organograma (`?to=`) + notificações `mensagem_recebida` + `messages.ts`.
- `organograma`: AdminNav + voltar de `perfil/[id]`.
- `busca` (rota): AdminNav + BottomNav `ativoEm` + empty-state do mapa. BuscaGlobal (header, Ctrl+K) é componente separado — permanece.

## B. ESTADO DESEJADO (arquitetura alvo)

### B.1 Navegação alvo (4 grupos compactos)
- **Operação:** Dashboard, Ativos, Chamados, Ordens de Serviço, Preventivas, Calendário.
- **Suprimentos:** Estoque, Solicitações, Compras, Fornecedores.
- **Inteligência:** Relatórios, Mapa, Desempenho.
- **Administração:** Estrutura, Cadastros (inclui **Usuários** como subnível), Auditoria, Monitoramento, Perfil, **Configurações do Sistema**.
- Removidos do menu: Mensagens, Organograma, Busca (rota). Busca universal do header permanece.

### B.2 Cadastros (centro de dados mestres) — matriz
| Entidade | Finalidade | Hoje | Deverá ficar | Relacionamentos | Permissão | Dependências |
|---|---|---|---|---|---|---|
| Departamentos | Org funcional | `departamentos_setores` (v23) | Cadastros | localidades, CCs | estrutura.* | localidades |
| Centros de custo | Apropriação | `centros_custo` (v23) | Cadastros | deptos, localidades | estrutura.* | deptos |
| Almoxarifados | Estoque físico | `almoxarifados` (v24) | Cadastros | localidades | estrutura.* | localidades |
| Setores | Subdivisão operacional | texto em memberships | Cadastros (tabela própria, futuro) | deptos | estrutura.* | decisão pendente |
| Equipes | Times de execução | INEXISTENTE (texto `equipe` em chamados/ativos) | Cadastros (tabela futura) | memberships, localidades | estrutura.* | decisão pendente |
| Usuários | Acesso | `/admin/usuarios` isolado | **Cadastros > Usuários** | memberships,roles | usuarios.* | — |
| Localidades | Árvore física | `/admin/estrutura` | Estrutura (fonte) / leitura em Cadastros | tudo físico | estrutura.* | — |
| Categorias | Atributos dinâmicos | `/admin/estrutura` | Estrutura (permanece) | ativos, produtos | estrutura.* | — |
| Unidades medida | Siglas estoque | tabela sem UI | Cadastros | produtos | estrutura.* | — |
| Fornecedores | Suprimentos | `/admin/fornecedores` | Suprimentos (permanece; espelho leitura em Cadastros, NÃO VALIDADO) | produtos, pedidos | fornecedores.* | — |

### B.3 Configurações do Sistema (centro novo, sob Administração)
Concentra, no mínimo: permissões + perfis/roles + overrides por usuário (evolução do `PermissoesEditor`); agente de triagem (habilitar IA, provedor, modelo, endpoint, key server-side, prompts, templates, fallback); templates de e-mail + remetente/assinatura; notificações (eventos, canais); links públicos + QR codes (prefixos, expiração); parâmetros de atendimento (SLA, prioridades, escalonamento); integrações/APIs; identidade visual. **Nada disso implementado — só arquitetura nesta fase.**

### B.4 Atendimento conversacional (Intake Engine)
- `Intake Engine` = workflow determinístico (máquina de estados por intenção) + `LLM Adapter` opcional (interface `gerarProximaPergunta/extrairEntidades`, providers plugáveis, secrets server-side, fallback total sem IA).
- Intenções v1: `manutencao`, `compra`. Rotas: `/atendimento/[...ctx]` (link contextual com `ref` tipada: ativo/localidade/almox + token curto; link universal sem contexto).
- Triagem adaptativa coleta: o quê, onde (localidade/ambiente), ativo?, tipo, descrição, impacto, urgência, contato, foto (Storage privado), participantes.
- Saída: chamado (resolução direta Facilities sem O.S. obrigatória) ou O.S. quando necessário; solicitação de compra pelo mesmo engine.

### B.5 Identidade, participantes, portal, comunicação, e-mail
- **Solicitante:** 4 modos — interno autenticado (vincula `user_id`), externo identificado (nome+contato, sem conta), público anônimo (token), acompanhamento por link seguro (token não-previsível, revogável, expiração). Propor `solicitantes_externos` (NÃO VALIDADO contra duplicidade — auditar `profiles`/`memberships` antes).
- **Participantes:** `ticket_participantes` (chamado_id, nome, e-mail, token acesso, notificações on/off). Reutilizar padrão sender-binding das `mensagens`.
- **Portal:** `/acompanhar/[token]` — status, timeline, mensagens, anexos, participantes, escalonamento. Sem expor ID sequencial.
- **Comunicação:** `chamado_mensagens` (chamado_id, autor tipo/referência, corpo, anexos, visibilidade interna/cliente) + trigger imutabilidade; cada mensagem-cliente pode gerar e-mail; resposta no portal reabre thread + notifica equipe. **Mensagens globais NÃO voltam.**
- **E-mail:** pipeline `evento → template (DB, versionado) → variáveis → provider (SMTP atual, interface para outros) → envio → log`. Templates iniciais: ticket aberto/atualizado/escalonado/concluído, nova mensagem, participante adicionado, O.S. criada, compra criada. Admin edita corpo/variáveis; segredos server-side.

### B.6 Estoque (modernização, sem CRUD seco)
Manter motor (RPC, reserva, transferência auditada, NF-e). Propor: atendimento de solicitação com baixa vinculada, alertas baixo/crítico acionáveis, consumo por O.S. reconciliado, devoluções com motivo, inventário cego, rastreabilidade lote (NÃO VALIDADO — auditar colunas). Automação em fases, depois do atendimento.

### B.7 Notificações (correção)
Auditar runtime: geração, persistência, leitura, contagem do sino, marcar lida, navegação, permissões, duplicidade (hipótese §A.3), eventos faltantes. Separar canais: **notificação interna** (sino, DB) vs **e-mail externo** (pipeline §B.5) vs **mensagem de ticket** (thread). Sem realtime obrigatório (polling/`revalidate` cobre; avaliar Supabase Realtime depois).

### B.8 Mobile (2 contextos, mesmo backend)
- **Técnico:** Painel (O.S. abertas/andamento/concluídas/aguardando peça/atrasadas/SLA/tempo médio — só com respaldo no banco), O.S. execução, Solicitações (pedir+acompanhar, sem mudar status operacional), Perfil.
- **Almoxarifado:** Painel (itens, baixo/crítico, movimentações, pendentes/atendidas, consumo, top movimentados, alertas), Estoque (saldo/movimentação/entrada/saída/ajuste autorizado), Solicitações (atender/separar/disponibilidade), Perfil.
- **Multi-contexto:** `modo_operacional` (tecnico|almoxarifado) por membership/override, alternância simples respeitando permissões; 1 usuário, N contextos. Rotas `/m/tecnico`, `/m/almox` (proposta, NÃO VALIDADO).

### B.9 Permissões (evolução, sem destruir)
Manter ROLE + matriz + overlay conceder/negar + escopos (Bloco 3) + RLS. Mover gestão para `Configurações > Permissões` (evolução do `PermissoesEditor`: matriz por papel + overrides + escopos localidade/almox). Auditar antes: field visibility (quais campos por papel — NÃO VALIDADO), record scope além de org (NÃO VALIDADO).

## C. MATRIZ ATUAL → FUTURO
| Módulo atual | Ação | Destino | Motivo |
|---|---|---|---|
| Dashboard | MANTER (+ métricas mobile por contexto, com respaldo) | Operação | cliente mantém |
| Ativos + QR ativo | MANTER (+ link contextual p/ atendimento) | Operação | base do atendimento |
| Chamados | REFATORAR (resolução direta sem O.S. obrigatória + thread + participantes) | Operação | ciclo de vida §23 |
| O.S. | MANTER (execução mobile-first depois) | Operação | cliente mantém |
| Preventivas/Calendário | MANTER | Operação | cliente mantém |
| Estoque | REFATORAR (atendimento, alertas acionáveis; motor preservado) | Suprimentos | §25 |
| Solicitações | REFATORAR (intake compra + vínculo QR mantido) | Suprimentos | §24 |
| Compras/Fornecedores | MANTER | Suprimentos | cliente mantém |
| QR-compra público (formulário) | DESCONTINUAR (formulário) / REFATORAR (link→chat compra) | Intake compra | §24 (NÃO usar QR p/ compra pública) |
| QR contextos admin | REFATORAR → links de atendimento | Configurações (links/QR) | §14 |
| Relatórios/Mapa/Desempenho | MANTER | Inteligência | cliente mantém |
| Mensagens global | DESCONTINUAR (código preservado no git; sem substituto global) | → thread do ticket | §8/§21 |
| Organograma | DESCONTINUAR | — (perfil/[id] vira leitura via Cadastros>Usuários) | §8 |
| Busca (rota) | DESCONTINUAR (rota) / MANTER (BuscaGlobal header) | recurso global | §8 |
| Estrutura | MANTER (fonte da árvore) | Administração | cliente mantém |
| Cadastros | REFATORAR → centro de dados mestres (§B.2) | Administração | §11 |
| Usuários (rota isolada) | MOVER → `Cadastros > Usuários` | Administração | §9 |
| Auditoria/Monitoramento/Perfil | MANTER | Administração | cliente mantém |
| Notificações | REFATORAR (corrigir + separar canais) | base (sino) + e-mail | §26 |
| Permissões (matriz+overlay) | REFATORAR → `Configurações > Permissões` | Configurações | §12 |
| E-mail (SMTP hardcoded) | REFATORAR → pipeline + templates | Configurações | §22 |
| Solicitante anônimo | REFATORAR → 4 modos §B.5 | Atendimento | §18 |

## D. FLUXOS (diagramas textuais)
1. **Abertura manutenção (universal):** link → `/atendimento` → intake pergunta (o quê/onde/contato) → triagem → chamado.
2. **Abertura por ativo:** QR/link `ref=ativo:X` → chat já contextualizado → coleta complementar → chamado vinculado.
3. **Triagem:** engine determinística (slots obrigatórios por intenção) → LLM opcional enriquece → validação → cria entidade.
4. **Escalonamento:** Facilities avalia → resolve direto (encerra, histórico+audit) OU converte em O.S. (RPC existente).
5. **Resolução sem O.S.:** entrada → triagem → chamado → resolução → encerramento + e-mail + auditoria.
6. **Resolução com O.S.:** … → chamado → O.S. → execução (fotos) → conclusão → e-mail + auditoria.
7. **Acompanhamento:** e-mail com `/acompanhar/[token]` → timeline + mensagens + anexos + participantes.
8. **Comunicação:** Facilities escreve (interna/cliente) → cliente notificado por e-mail → responde no portal → thread + notifica equipe. Tudo no histórico.
9. **Compra conversacional:** link → chat intenção `compra` → triagem (item/qtd/justificativa/centro) → solicitação → notificação Compras → acompanhamento.
10. **Estoque:** solicitação aprovada → reserva → separação (almox) → consumo/devolução → auditoria; compra → recebimento → entrada (NF-e).
11. **Técnico mobile:** `/m/tecnico` → painel → O.S. → executar (fotos) → concluir; solicitar material → acompanhar.
12. **Almox mobile:** `/m/almox` → painel → estoque → movimentar/atender → solicitações → separar/disponibilidade.

## E. BANCO (existente → proposto, sem executar)
Existente (36+ tabelas + v23→v26): organizations, profiles, memberships, localidades, categorias, ativos(+hist/doc), chamados(+os_*, planos, checklist), produtos, movimentacoes_estoque, unidades_medida, fornecedores, solicitacoes_compra(+itens/hist/anexos/cotacoes/pedidos/recebimentos), qr_contextos, conversas(+participantes/mensagens), notificacoes, auditoria_logs, departamentos_setores, centros_custo, almoxarifados, permissoes_custom.
Propostas (NÃO VALIDADO, auditar duplicidade antes): `intake_sessoes` (sessão chat: intenção, slots jsonb, estado) + `intake_mensagens`; `solicitantes_externos`; `ticket_participantes`; `chamado_mensagens` (+anexos via Storage); `email_templates` + `email_logs`; `config_sistema` (chave/valor jsonb, secrets só server) + `agente_config`; `portal_tokens` (ou coluna token em chamados/participantes); `modo_operacional` (membership ou override); `equipes` + `equipe_membros`; `setores` (tabela, hoje texto). Remoção física: NENHUMA nesta fase (mensagens/organograma/busca saem do menu, código e dados preservados).

## F. SEGURANÇA
- RLS/trigger/tenant: intocados. Novas tabelas seguem padrão v6 (select membros, write por papel) + `enforce_same_org`.
- Tokens públicos: `gerarTokenPublico(24)` já usado (QR); estender a portal/participantes com expiração/revogação (colunas `expira_em`, `revogado_em`).
- Links públicos: nunca ID sequencial; token na URL + validação server-side + escopo mínimo (só campos do ticket).
- Participantes: token por participante, acesso só ao próprio ticket.
- Secrets: SMTP/LLM só server-side (`process.env`, nunca `NEXT_PUBLIC_*`), gestão restrita a TI (novo `ti.administrar`? NÃO VALIDADO — propor).
- Storage: fotos do intake no bucket privado `o/{orgId}/...` + signed URL curta; anexos de ticket idem.
- APIs: rotas públicas com rate limit (NÃO VALIDADO — auditar `next.config`/proxy).

## G. UX
- Desktop: mesma linguagem (PageHeader/StatCard/cards, Tailwind, mobile-first nos forms 44px); menu 4 grupos; Cadastros com subníveis; Configurações com seções.
- Portal externo: 1 coluna, emerald (padrão qr-compra), timeline, thread, anexos, sem login.
- Chat atendimento: bolhas, progresso de triagem, upload foto, confirmação antes de criar, QR acompanhamento.
- Mobile técnico/almox: bottom nav 4 itens, telas tarefa-única, offline-tolerante (NÃO VALIDADO — avaliar).
- Configurações: formulários segmentados por seção,.feedback de teste (ex.: "enviar e-mail teste").

## H. MIGRAÇÃO (incremental, sem big bang)
- **Fase A (fundação, sem UX nova):** auditoria runtime notificações; `config_sistema` + `email_templates` + pipeline e-mail; mover PermissoesEditor → Configurações; Cadastros>Usuários (mover rota, redirects).
- **Fase B (atendimento):** `intake_sessoes` + engine determinística + `/atendimento` + criação de chamado; links contextuais por ativo; portal `/acompanhar/[token]` + `chamado_mensagens`; participantes + e-mails.
- **Fase C (compras conversacionais + QR):** intenção `compra`; descontinuar formulário QR-compra (manter QRs legados com aviso); links/QR sob Configurações.
- **Fase D (menu + remoções de navegação):** nova IA de navegação; despublicar rotas mensagens/organograma/busca (código preservado, redirects explicativos); BuscaGlobal permanece.
- **Fase E (estoque avançado + mobile):** atendimento vinculado, inventário, `/m/*` + modos operacionais.
- **Fase F (LLM opcional + endurecimento):** adapter LLM + config TI; realtime; expiração/revogação; QA geral; Preview; aprovação; produção.
- Cada fase: modelar → implementar → gates → Preview → aval. Produção congelada até aprovação explícita.

## Riscos e NÃO VALIDADOS
R1 notificações: bugs relatados sem repro — auditar runtime antes de redesenhar. R2 `conversas` vs thread do ticket: possível reuso parcial — auditar antes de criar `chamado_mensagens`. R3 solicitante externo vs LGPD/retenção — definir com TI. R4 SMTP atual deliverability — avaliar provider. R5 `TipoMovimentacao` sem `transferencia` + `AuditoriaLog` sem `organization_id` (dívida conhecida). R6 escopo de `ti.administrar` para Configurações. R7 expiração de tokens legados (`qr_code_hash` sem expiração). R8 `setores`/`equipes` como tabelas — confirmar com cliente antes de modelar.
