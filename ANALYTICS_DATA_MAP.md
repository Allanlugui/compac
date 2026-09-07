# SGA-M — ANALYTICS DATA MAP

**Versão:** BLOCO A — FASE 5
**Data:** 2026-09-07
**Objetivo:** Mapear Entidade → Tabela → Campo → Relacionamento → Uso analítico

> Fonte de verdade: `schema.sql` + `schema_v2..v15` e `src/lib/types.ts`

---

## 1. Princípios Transversais

### 1.1 Tenant
Toda tabela de domínio possui `organization_id uuid NOT NULL` com FK para `organizations(id)` e trigger `enforce_same_org()` (via `to_jsonb(NEW)` no `v13`) + RLS `eh_membro(organization_id)` / `tem_papel(organization_id, role[])`. Analytics **sempre** filtra `eq organization_id = ctx.orgId` derivado de `requireOrg()` (JWT), **nunca** do cliente.

### 1.2 Timezone
- **Banco:** `timestamptz` armazenado em UTC.
- **Cálculo:** `date_trunc` e comparações em UTC.
- **Apresentação:** conversão para `America/Sao_Paulo` via `toLocaleString("pt-BR")` ou `formatarDataHora`. Documentado por KPI.

### 1.3 Permissões
- `ADMIN`/`GESTOR`: organização inteira.
- `TECNICO`: `estoque.movimentar`, `ativos`, `O.S.` onde é responsável/equipe (quando aplicável). Não vê custos sensíveis se RLS restringir.
- `COMPRAS`: `solicitacoes`, `cotacoes`, `pedidos`, `recebimentos`, `produtos`.
- `AUDITOR`: só leitura (`audit_select`).
- `SOLICITANTE`: próprias solicitações/O.S. (quando `created_by = auth.uid()`).

---

## 2. Entidades e Tabelas

### 2.1 Organização

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Organização | `organizations` | `id`, `nome`, `slug`, `entry_token`, `created_at` | — | Tenant root, filtro de todos os KPIs, mapa nível 0 |

### 2.2 Identidade

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Perfil | `profiles` | `id PK FK auth.users`, `nome`, `telefone`, `cargo`, `matricula`, `avatar_url`, `ultimo_acesso`, `created_at` | — | Dimensão Técnico/Equipe (via `memberships`), busca global |
| Vínculo | `memberships` | `id`, `organization_id FK`, `user_id FK profiles`, `role` (ADMIN/GESTOR/TECNICO/COMPRAS/AUDITOR/SOLICITANTE), `status` ativo/inativo, `setor`, `departamento` | `organization_id → organizations`, `user_id → profiles` | Filtro por role, dimensão equipe/setor |

### 2.3 Ativos

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Ativo | `ativos` | `id`, `organization_id`, `nome`, `localizacao` (texto legado), `qr_code_hash` unique, `codigo` unique(org,codigo), `status` (operacional/em_manutencao/parado/em_instalacao/em_inspecao/inativo/desativado), `criticidade` (baixa/media/alta/critica), `prioridade_padrao`, `categoria_id FK categorias`, `localidade_id FK localidades`, `fornecedor_id FK fornecedores`, `centro_custo`, `departamento`, `responsavel`, `equipe`, `codigo/numero_serie/patrimonio/tag/fabricante/modelo`, `data_aquisicao/instalacao/garantia_ate`, `valor_aquisicao`, `vida_util_meses`, `dados_tecnicos jsonb`, `qr_impresso_em`, `created_at`, `updated_at` | `localidade_id → localidades`, `categoria_id → categorias`, `fornecedor_id → fornecedores` | KPIs: total, por status, críticos, reincidência, custo acumulado, mapa |
| Histórico de status | `ativo_status_historico` | `id`, `organization_id`, `ativo_id FK`, `de`, `para`, `motivo`, `user_id`, `created_at` (append-only) | `ativo_id → ativos` | Disponibilidade (tempo em cada status) — *insuficiente se só há `ativos.status` atual* |
| Documento | `ativo_documentos` | `id`, `organization_id`, `ativo_id`, `nome`, `categoria` (manual/ficha_tecnica/nota_fiscal/...), `path`, `tamanho_bytes`, `mime` | `ativo_id → ativos` | Contagem de documentos, busca |
| Categoria (ativo) | `categorias` | `id`, `organization_id`, `nome`, `tipo='ativo'`, `atributos jsonb [{nome,tipo,obrigatorio,unidade,opcoes}]`, `ativa` | — | Dimensão categoria, atributos dinâmicos |
| Localidade | `localidades` | `id`, `organization_id`, `nome`, `tipo` (unidade/predio/bloco/andar/area/sala), `parent_id self FK`, `created_at` | `parent_id → localidades` | Hierarquia do mapa, dimensão localização |

**Índices:** `ativos_org_idx`, `ativos_org_status_idx`, `ativos_localidade_idx`, `ativos_categoria_idx`

### 2.4 Chamados / O.S. (entidade única, `chamados` é O.S.)

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Demanda | `chamados.status` | `aberto`, `em_triagem`, `aguardando_informacao`, `convertido_os`, `em_andamento` (legado), `concluido` (legado), `resolvido`, `cancelado` | — | Backlog de demanda, funil |
| Execução O.S. | `chamados.os_status` | `aberta`, `planejada`, `atribuida`, `em_execucao`, `aguardando_peca`, `aguardando_terceiro`, `em_validacao`, `concluida`, `encerrada` (NULL até conversão) | — | Backlog de O.S., kanban, SLA por fase |
| Chamado/O.S. | `chamados` | `id`, `organization_id`, `ativo_id FK ativos`, `solicitante`, `descricao`, `status`, `os_status`, `os_tipo` (corretiva/preventiva/preditiva/inspecao/instalacao/melhoria), `created_at`, `concluido_em` (trigger `set_concluido_em` em `concluido`/`resolvido`), `prazo` (date, SLA), `prioridade` (baixa/media/alta/critica), `criticidade`, `impacto` (baixo/medio/alto/critico/parada_total), `origem` (qr/portal/administrador/...), `responsavel`, `equipe`, `supervisor`, `departamento`, `contato`, `categoria`, `subcategoria`, `plano_id FK planos_manutencao`, `diagnostico`, `solucao`, `causa`, `causa_raiz`, `planejamento`, `ferramentas`, `previsao_horas`, `riscos`, `data_inicio`, `data_fim`, `horimetro_ini/fim/unidade`, `custo_mao_obra`, `custo_outros`, `custo_outros_desc` | `ativo_id → ativos`, `plano_id → planos_manutencao` | **Todas** as métricas de manutenção: MTTR, SLA, backlog, reincidência, custo |
| Histórico O.S. | `os_status_historico` | `id`, `organization_id`, `os_id FK chamados`, `de`, `para`, `motivo`, `user_id`, `created_at` | `os_id → chamados` | SLA por fase, tempo em cada `os_status` |
| Atividade | `os_atividades` | `id`, `organization_id`, `chamado_id FK`, `descricao 1-500`, `user_id`, `executado_por` | `chamado_id → chamados` | Produtividade, contribuição por técnico |
| Serviço externo | `os_servicos_externos` | `id`, `organization_id`, `chamado_id FK`, `fornecedor_id FK`, `servico 1-200`, `valor >=0`, `nota`, `data_servico`, `observacao` | `chamado_id → chamados`, `fornecedor_id → fornecedores` | Custo de serviços, fornecedor |
| Foto | `os_fotos` | `id`, `organization_id`, `chamado_id FK`, `path`, `categoria` (antes/durante/depois) | `chamado_id → chamados` | Evidência, não KPI |
| Preventiva | `planos_manutencao` | `id`, `organization_id`, `ativo_id FK`, `tipo`, `atividade 1-500`, `frequencia>0`, `unidade` (dias/semanas/meses/horas/ciclos), `responsavel`, `checklist_modelo_id FK`, `ultima_execucao`, `proxima_execucao`, `tolerancia_dias`, `prioridade`, `ativo` | `ativo_id → ativos` | Preventiva em dia/próxima/atrasada |

**Índices:** `chamados_ativo_id_idx`, `chamados_status_idx`, `chamados_os_status_idx(org,os_status)`, `chamados_created_at_idx`, `chamados_org_idx`

### 2.5 Checklist

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Modelo | `checklist_modelos` | `id`, `organization_id`, `ativo_id FK`, `titulo` | `ativo_id → ativos` | — |
| Item | `checklist_itens` | `id`, `modelo_id FK`, `texto`, `obrigatorio`, `ordem`, `tipo` (ok_nok/sim_nao/texto/numero/selecao/data/hora/foto), `foto_obrigatoria`, `obs_obrigatoria`, `valor_esperado`, `opcoes jsonb` | `modelo_id → checklist_modelos` | — |
| Execução | `checklist_execucoes` | `id`, `organization_id`, `modelo_id FK`, `chamado_id FK`, `ativo_id FK`, `status` (em_andamento/concluida), `resultado` (aprovado/reprovado/ressalvas), `user_id`, `snapshot jsonb` (imutável), `created_at` | `chamado_id → chamados` | Taxa de checklist concluída, snapshot vs modelo atual |
| Resposta | `checklist_respostas` | `id`, `execucao_id FK`, `item_id FK`, `ok`, `valor text`, `observacao`, `foto_url` | `execucao_id → checklist_execucoes` | — |

### 2.6 Estoque

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Produto | `produtos` | `id`, `organization_id`, `codigo` unique(org,codigo), `sku` unique(org,sku) where not null, `descricao`, `categoria` (texto legado), `subcategoria`, `categoria_id FK categorias`, `unidade` default UN, `estoque_atual` (físico), `estoque_reservado`, `estoque_minimo`, `estoque_maximo`, `ponto_reposicao`, `localizacao`, `fornecedor_id FK`, `custo_medio`, `ultimo_custo`, `codigo_fornecedor`, `ativo`, `created_at` | `categoria_id → categorias`, `fornecedor_id → fornecedores` | Estoque físico/disponível/reservado, crítico, valor, giro |
| Movimento | `movimentacoes_estoque` | `id`, `organization_id`, `produto_id FK RESTRICT`, `tipo` (entrada/saida/ajuste/reserva/consumo/devolucao) + `transferencia` via RPC (par saída+entrada), `quantidade>0`, `custo_unitario`, `chamado_id FK SET NULL`, `compra_id FK`, `origem/destino` (transferência), `observacao`, `executado_por`, `created_at` | `produto_id → produtos`, `chamado_id → chamados` | Consumo, entradas/saídas, reservado vs consumo (evita dupla contagem) |
| Unidade | `unidades_medida` | `id`, `organization_id`, `sigla 1-10`, `nome 1-40`, `ativa`, `created_at` | — | Dimensão unidade |
| Vínculo produto-fornecedor | `produto_fornecedores` | `id`, `organization_id`, `produto_id FK`, `fornecedor_id FK`, `principal`, `preco_ref`, `prazo_medio_dias`, unique(produto,fornecedor) | `produto_id → produtos`, `fornecedor_id → fornecedores` | Prazo médio, preço ref |

**Regra homologada:** `disponível = físico - reservado` (`físico = estoque_atual`, `reservado = estoque_reservado`). Métricas devem explicitar qual dos três usa. `reserva` move para reservado sem baixar físico; `consumo` baixa ambos; `devolução` retorna ao disponível.

**Índices:** `produtos_org_idx`, `mov_org_data_idx(org,created_at desc)`, `mov_produto_idx`

### 2.7 Fornecedores

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Fornecedor | `fornecedores` | `id`, `organization_id`, `nome`, `cnpj`, `contato`, `telefone`, `email`, `endereco`, `categoria`, `avaliacao 0-5`, `ativo`, `razao_social`, `nome_fantasia`, `ie`, `site`, `cidade`, `estado`, `cep`, `observacoes` | — | Total comprado, prazo médio, divergências |
|  | `produto_fornecedores` | ver acima |  |  |
|  | `cotacoes` | `fornecedor_id` |  |  |
|  | `pedidos_compra` | `fornecedor_id` |  |  |
|  | `os_servicos_externos` | `fornecedor_id` |  |  |

### 2.8 Compras (legado financeiro)

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Compra | `compras` | `id`, `organization_id`, `chamado_id FK SET NULL`, `fornecedor_id FK`, `item`, `quantidade>0`, `valor_unitario>=0`, `valor_total` generated `quantidade*valor_unitario` stored, `setor`, `data_compra`, `created_at` | `chamado_id → chamados`, `fornecedor_id → fornecedores` | **Atenção:** `valor_total` é `quantidade*valor_unitario` (custo de aquisição), **não** custo de manutenção. Não somar com `movimentacoes_estoque` sem regra. |

### 2.9 Suprimentos (workflow v11)

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Solicitação | `solicitacoes_compra` | `id`, `organization_id`, `setor`, `solicitante`, `item` (legado), `justificativa`, `quantidade`, `valor_estimado`, `status` (rascunho/enviada/em_analise/aprovada/rejeitada/em_cotacao/pedido_gerado/recebida/encerrada/cancelada + legados pendente/aprovado/rejeitado/comprado), `qr_code_hash` unique, `origem` (qr/portal/estoque/manual), `prioridade`, `centro_custo`, `prazo`, `created_by FK profiles`, `aprovado_por/em/obs`, `created_at`, `updated_at` | — | Solicitações pendentes, aprovações, valor |
| Item solicitação | `solicitacao_itens` | `id`, `organization_id`, `solicitacao_id FK`, `produto_id FK`, `descricao 1-200`, `quantidade>0`, `unidade`, `justificativa`, `urgencia` (baixa/normal/alta/critica), `observacao` | `solicitacao_id → solicitacoes_compra`, `produto_id → produtos` | Quantidade por produto |
| Histórico solicitação | `solicitacao_historico` | `id`, `organization_id`, `solicitacao_id FK`, `de`, `para`, `motivo`, `user_id` | `solicitacao_id → solicitacoes_compra` | SLA de aprovação |
| Cotação | `cotacoes` | `id`, `organization_id`, `solicitacao_id FK`, `fornecedor_id FK`, `valor>=0`, `prazo_dias`, `vencedora` | `solicitacao_id → solicitacoes_compra`, `fornecedor_id → fornecedores` | Valor por fornecedor, prazo médio |
| Pedido | `pedidos_compra` | `id`, `organization_id`, `solicitacao_id FK SET NULL`, `fornecedor_id FK RESTRICT`, `numero` unique(org,numero), `status` (aberto/aprovado/recebido/encerrado/cancelado), `frete/desconto/impostos`, `prazo`, `centro_custo`, `comprador` | `solicitacao_id → solicitacoes_compra`, `fornecedor_id → fornecedores` | Pedidos, valor, prazo |
| Item pedido | `pedido_itens` | `id`, `organization_id`, `pedido_id FK`, `produto_id FK`, `descricao 1-200`, `quantidade>0`, `preco_unitario` | `pedido_id → pedidos_compra`, `produto_id → produtos` | Valor por item |
| Recebimento | `recebimentos` | `id`, `organization_id`, `pedido_id FK`, `status` (aceito/divergente), `lote`, `validade`, `motivo_divergencia`, `foto_path`, `recebido_por` | `pedido_id → pedidos_compra` | Divergências, recebimento |
| Item recebimento | `recebimento_itens` | `id`, `organization_id`, `recebimento_id FK`, `pedido_item_id FK`, `qtd_recebida`, `qtd_recusada`, `motivo` | `recebimento_id → recebimentos`, `pedido_item_id → pedido_itens` | Quantidade recebida vs recusada |

**Cadeia:** `solicitacoes_compra → solicitacao_itens → cotacoes → pedidos_compra → pedido_itens → recebimentos → recebimento_itens`

### 2.10 Auditoria / Notificações

| Entidade | Tabela | Campos | Relacionamento | Uso analítico |
|---|---|---|---|---|
| Log | `auditoria_logs` | `id`, `organization_id`, `tabela`, `registro_id`, `acao` (33 valores canônicos), `dados_anteriores jsonb`, `dados_novos jsonb`, `executado_por`, `user_id`, `created_at` | — | **Não** fonte universal; usar domínio operacional como fonte, auditoria só para trilha |
| Notificação | `notificacoes` | `id`, `organization_id`, `user_id` nullable (broadcast), `tipo`, `titulo`, `descricao`, `link`, `lida`, `created_at` | `user_id → profiles` | Não KPI, eventos |

---

## 3. Mapa Entidade → Evento → Timestamp → Indicador

```
Chamado/O.S.
  abertura → chamados.created_at → backlog, O.S. abertas
  triagem → chamados.status='em_triagem' → backlog em triagem
  conversão → chamados.status='convertido_os' + os_status='aberta' + criar_os_a_partir_de_triagem() → O.S. abertas
  início execução → chamados.data_inicio / os_status='em_execucao' → MTTR início, SLA até início
  conclusão → chamados.concluido_em (trigger em 'concluido'/'resolvido') / os_status='concluida' → MTTR fim, SLA até conclusão
  encerramento → os_status='encerrada' → backlog fim
  cancelamento → status='cancelado' → exclusão de MTTR/MTBF/SLA
  prazo → chamados.prazo → SLA (dentro/próximo/atrasado)

Produto
  entrada → movimentacoes_estoque.tipo='entrada' + created_at → entradas, valor estoque
  reserva → tipo='reserva' → reservado
  consumo → tipo='consumo' + chamado_id → consumo por O.S./ativo, custo consumido
  devolução → tipo='devolução' → disponível
  ajuste → tipo='ajuste' → correção
  transferência → tipo='transferencia' (par saída+entrada com origem/destino) → giro (rede zero)

Ativo
  cadastro → ativos.created_at → total ativos
  chamados/O.S. → chamados.ativo_id → reincidência (mesmo ativo + janela), top ativos, custo por ativo
  serviços → os_servicos_externos.chamado_id → ativos → custo por ativo
  consumos → movimentacoes_estoque.chamado_id → chamados.ativo_id → custo por ativo
```

---

## 4. Campos Autoridade

| Métrica | Campo autoridade | Alternativa | Exclusão |
|---|---|---|---|
| **Abertura O.S.** | `chamados.created_at` (sempre preenchido) | — | — |
| **Conclusão O.S.** | `chamados.concluido_em` (trigger em `concluido`/`resolvido`) | `os_status_historico where para='concluida'` se `concluido_em` nulo e `os_status` indica conclusão | `status='cancelado'` sem `concluido_em` → *excluído* de MTTR |
| **Início execução** | `chamados.data_inicio` (quando preenchido) | `os_status_historico where para='em_execucao'` min(created_at) | Se ambos nulos → usar `created_at` como fallback documentado, ou `null` → *excluído* de MTTR se opção 2 |
| **SLA prazo** | `chamados.prazo` (date) | — | `prazo IS NULL` → *excluído* de SLA (ou `Sem prazo` separado) |
| **Custo O.S.** | `custo_mao_obra + custo_outros + SUM(os_servicos_externos.valor) + SUM(movimentacoes_estoque.quantidade*custo_unitario where tipo='consumo' and chamado_id)` | `compras.valor_total` **não** entra (é aquisição) | `status='cancelado'` → custo zero mas não conta como manutenção |
| **Estoque disponível** | `produtos.estoque_atual - produtos.estoque_reservado` | — | `ativo=false` → excluído de crítico/reposição opcionalmente |
| **Valor estoque** | `estoque_atual * custo_medio` (regra homologada `src/app/admin/estoque/page.tsx:62`) | `ultimo_custo` se `custo_medio` nulo | — |

---

## 5. Riscos de Dupla Contagem

| Par | Risco | Regra |
|---|---|---|
| `compras` + `movimentacoes_estoque (consumo)` | Compra é aquisição, consumo é manutenção. Somar ambos conta aquisição como custo de O.S. | **Separar:** `custo_aquisicao = compras.valor_total`, `custo_manutencao = mao_obra + outros + servicos + consumo*unitario`. Nunca `SUM(compras)+SUM(consumo)` como custo único. |
| `recebimento` + `movimentacoes_estoque (entrada)` | Recebimento registra chegada, entrada registra estoque. São eventos distintos mas representam mesma mercadoria. | **Distinguir:** `recebimentos` (logística) vs `movimentacoes tipo entrada` (estoque). Não contar `recebimento_itens.qtd_recebida` como entrada se já há `movimentacao entrada` para mesma NF. |
| `reserva` + `consumo` | `reserva` move para `estoque_reservado` sem baixar físico; `consumo` baixa físico e reservado. Contar `reserva+consumo` como 2 saídas dobra. | **Usar:** `disponível = físico - reservado` e `consumo` como única saída para custo. `reserva` não é custo. |
| `chamado` + `O.S.` | `chamados` é demanda; `os_status` é execução. Um `convertido_os` é 1 demanda e 1 O.S. | **Não** `COUNT(chamados)` como O.S. abertas. Usar `os_status IS NOT NULL` para O.S. e `status` para demanda. Documentar separados. |
| `evento + historico` | `os_status_historico` registra transição, `chamados.os_status` é estado atual. Contar ambos como O.S. abertas duplica. | **Usar:** estado atual para backlog, histórico só para tempo em fase/SLA por fase. |

---

## 6. Consultas Atuais vs Ideal

| Tela | Atual (problema) | Ideal (BLOCO B+) |
|---|---|---|
| `dashboard` | `SELECT * FROM chamados WHERE orgId` + filter JS, sem paginação, sem agregação no banco | `SELECT status, os_status, count(*) GROUP BY`, `AVG(concluido_em - created_at)`, `SUM(custo)` com `eq orgId` + `gte created_at` + índices |
| `relatorios` | Carrega 6 meses de `chamados` + `compras` + `ativos` em JS, calcula em browser | Aggregates no banco: `date_trunc('month', created_at)`, `SUM(valor_total) GROUP BY setor` |
| `estoque` | `SELECT * FROM produtos` + `movimentacoes limit 200` + JS `disponível = fisico - reservado`, `valor = fisico * custo_medio` | Mantém JS para `disponível` (regra simples), mas `SUM(estoque_atual*custo_medio)` pode ir para `SELECT SUM(...)` se >1k produtos |
| `estrutura` | `SELECT * FROM localidades` + `ativos` por local, JS | `COUNT ativos GROUP BY localidade_id`, `COUNT chamados GROUP BY ativo.localidade_id` via JOIN |

**Índices já existentes (não criar novos sem EXPLAIN):** `chamados_ativo_id_idx`, `chamados_status_idx`, `chamados_os_status_idx(org,os_status)`, `chamados_created_at_idx`, `produtos_org_idx`, `mov_org_data_idx(org,created_at)`, `fornecedores_org_idx`, `solic_org_idx`, etc. Ver §30 de ANALYTICS_SPEC.

---

## 7. Dados Ausentes / Insuficientes

| Indicador | Dado ausente | Impacto | Próximo passo |
|---|---|---|---|
| `MTBF` | Sem definição de o que é falha + sem histórico de `ativo_status_historico` contínuo (só há `status` atual + histórico O.S., não histórico de disponibilidade do ativo) | **Dados insuficientes** → não calcular, mostrar "Sem dados suficientes" | Precisa `ativo_status_historico` com cobertura temporal contínua ou `data_inicio/data_fim` preenchidos para inferir indisponibilidade |
| `Disponibilidade` | Sem `tempo disponível / tempo total` confiável | Mesmo que MTBF | Mesmo |
| `Custo por localização` | `localidade_id` pode ser nulo em muitos ativos antigos (legado) | Subestimado se agrupar só por FK | Documentar % de ativos sem localidade, mostrar "Sem localização" separado |
| `Reincidência` | Sem `categoria`/`causa_raiz` preenchidos consistentemente | Heurística fraca | Definir janela (ex: 90d) + mesmo `ativo_id` + `categoria` igual, mas marcar como "heurística" |
| `MTBF por ativo` | Muitos ativos com <2 O.S. | Denominador pequeno | Exigir ≥3 O.S. válidas no período |

---

## 8. Timezone

`America/Sao_Paulo` para apresentação. `timestamptz` em UTC no banco. Filtro `Hoje` = `00:00 BRT` → `00:00 BRT+1` convertido para `03:00 UTC` no `gte`/`lt`. Documentar em cada query.

## 9. Tenant

`organization_id` via `requireOrg()` → `ctx.orgId`. Nunca `req.query.organization_id`. RLS `eh_membro()` garante isolamento mesmo se `ctx` falhar.

## 10. Auditoria vs Operacional

- **Operacional:** `chamados`, `produtos`, `movimentacoes`, `os_servicos`, `custos` → fonte de KPI.
- **Auditoria:** `auditoria_logs` → trilha, não KPI. Exceção: `auditoria_logs` pode contar `TRIAGEM`/`OS_CREATED` se `chamados` não tiver timestamp da triagem, mas preferir `chamados.created_at` + `os_status_historico`.
