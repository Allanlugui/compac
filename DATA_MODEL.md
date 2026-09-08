# SGA-M — DATA MODEL

**Versão:** FASE FINAL
**Fonte:** `schema.sql` + `schema_v2`..`v15` + `src/lib/types.ts`

---

## 1. Core

### organizations
`id PK, nome, slug unique, entry_token unique (hex 36), created_at`
- Root tenant, 1 linha `operacao-principal` seed.

### profiles
`id PK FK auth.users ON DELETE CASCADE, nome, telefone, cargo, matricula, avatar_url, ultimo_acesso, created_at`
- 1:1 com `auth.users`.

### memberships
`id PK, organization_id FK CASCADE, user_id FK profiles CASCADE, role (ADMIN/GESTOR/TECNICO/COMPRAS/AUDITOR/SOLICITANTE), status ativo/inativo, setor, departamento, created_at, UNIQUE(org,user)`
- Vínculo tenant + role, usado por `eh_membro`/`tem_papel`.

---

## 2. Estrutura Física

### localidades
`id PK, organization_id FK CASCADE, nome (1-120), tipo (unidade/predio/bloco/andar/area/sala), parent_id self FK CASCADE, created_at, UNIQUE(org,parent_id,nome), UNIQUE(org,nome) WHERE parent_id IS NULL`

### categorias
`id PK, organization_id FK CASCADE, nome, tipo (ativo/produto), atributos jsonb [{nome,tipo texto|numero|selecao|data, obrigatorio, unidade, opcoes[]}], ativa, created_at, UNIQUE(org,tipo,nome)`

---

## 3. Ativos

### ativos
`id PK, organization_id FK, nome, localizacao (texto legado), qr_code_hash unique, codigo unique(org,codigo) WHERE not null, status (operacional/em_manutencao/parado/em_instalacao/em_inspecao/inativo/desativado), criticidade, prioridade_padrao, categoria_id FK SET NULL, localidade_id FK SET NULL, fornecedor_id FK SET NULL, centro_custo, departamento, responsavel, equipe, codigo/numero_serie/patrimonio/tag/fabricante/modelo, data_aquisicao/instalacao/garantia_ate, valor_aquisicao, vida_util_meses, dados_tecnicos jsonb, qr_impresso_em, created_at, updated_at`

### ativo_status_historico
`id PK, organization_id FK, ativo_id FK CASCADE, de, para, motivo, user_id, created_at` (append-only)

### ativo_documentos
`id PK, organization_id FK, ativo_id FK CASCADE, nome, categoria (manual/ficha_tecnica/.../outro), path, tamanho_bytes, mime, created_at`

---

## 4. Chamados / O.S.

### chamados
`id PK, organization_id FK, ativo_id FK CASCADE, solicitante, descricao, status (aberto/em_triagem/aguardando_informacao/convertido_os/em_andamento/concluido/resolvido/cancelado), os_status (aberta/planejada/atribuida/em_execucao/aguardando_peca/aguardando_terceiro/em_validacao/concluida/encerrada), os_tipo, created_at, concluido_em (trigger), prazo, prioridade, criticidade, impacto, origem, responsavel, equipe, supervisor, departamento, contato, categoria, subcategoria, plano_id FK SET NULL, diagnostico, solucao, causa, causa_raiz, planejamento, ferramentas, previsao_horas, riscos, data_inicio, data_fim, horimetro_ini/fim/unidade, custo_mao_obra, custo_outros, custo_outros_desc, solicitante, descricao, fotos_antes/depois text[], concluido_em`

### os_status_historico
`id PK, organization_id FK, os_id FK chamados CASCADE, de, para, motivo, user_id`

### os_atividades
`id PK, organization_id FK, chamado_id FK CASCADE, descricao 1-500, user_id`

### os_servicos_externos
`id PK, organization_id FK, chamado_id FK CASCADE, fornecedor_id FK SET NULL, servico 1-200, valor, nota, data_servico`

### os_fotos
`id PK, organization_id FK, chamado_id FK CASCADE, path, categoria (antes/durante/depois)`

### planos_manutencao
`id PK, organization_id FK, ativo_id FK CASCADE, tipo, atividade 1-500, frequencia, unidade (dias/semanas/meses/horas/ciclos), responsavel, checklist_modelo_id FK SET NULL, ultima_execucao, proxima_execucao, tolerancia_dias, prioridade, ativo`

### checklist_modelos / itens / execucoes / respostas
`checklist_modelos(id, organization_id, ativo_id, titulo)`, `checklist_itens(id, modelo_id FK CASCADE, texto, obrigatorio, ordem, tipo ok_nok/.../foto, foto_obrigatoria, obs_obrigatoria, valor_esperado, opcoes jsonb)`, `checklist_execucoes(id, organization_id, modelo_id FK RESTRICT, chamado_id FK SET NULL, status em_andamento/concluida, resultado aprovado/reprovado/ressalvas, snapshot jsonb)`, `checklist_respostas(id, execucao_id FK CASCADE, item_id FK, ok, valor, observacao, foto_url)`

---

## 5. Estoque

### produtos
`id PK, organization_id FK, codigo unique(org,codigo), sku unique(org,sku) where not null, descricao, categoria (texto legado), subcategoria, categoria_id FK SET NULL, unidade default UN, estoque_atual, estoque_reservado, estoque_minimo, estoque_maximo, ponto_reposicao, localizacao, fornecedor_id FK SET NULL, custo_medio, ultimo_custo, codigo_fornecedor, ativo`

### movimentacoes_estoque
`id PK, organization_id FK, produto_id FK RESTRICT, tipo (entrada/saida/ajuste/reserva/consumo/devolucao/transferencia via RPC), quantidade>0, custo_unitario, chamado_id FK SET NULL, compra_id FK, origem/destino, observacao, executado_por`

### unidades_medida
`id PK, organization_id FK, sigla 1-10 unique(org,sigla), nome 1-40, ativa`

### produto_fornecedores
`id PK, organization_id FK, produto_id FK CASCADE, fornecedor_id FK CASCADE, principal, preco_ref, prazo_medio_dias, UNIQUE(produto,fornecedor)`

---

## 6. Fornecedores / Compras

### fornecedores
`id PK, organization_id FK, nome, cnpj, contato, telefone, email, endereco, categoria, avaliacao 0-5, ativo, razao_social, nome_fantasia, ie, site, cidade, estado, cep, observacoes`

### compras (legado)
`id PK, organization_id FK RESTRICT, chamado_id FK SET NULL, fornecedor_id FK SET NULL, item, quantidade>0, valor_unitario, valor_total generated, setor, data_compra, created_at`

### solicitacoes_compra
`id PK, organization_id FK RESTRICT, setor, solicitante, item, justificativa, quantidade>0, valor_estimado, status (rascunho...comprado), qr_code_hash unique, origem, prioridade, centro_custo, prazo, created_by FK SET NULL, aprovado_por/em/obs, created_at, updated_at`

### solicitacao_itens / historico / anexos / cotacoes / pedidos_compra / pedido_itens / recebimentos / recebimento_itens / qr_contextos
Ver `ANALYTICS_DATA_MAP.md` §2.9 para detalhes.

---

## 7. Auditoria / Notificações

### auditoria_logs
`id PK, organization_id, tabela, registro_id, acao (33 valores), dados_anteriores jsonb, dados_novos jsonb, executado_por, user_id, created_at`

### notificacoes
`id PK, organization_id FK CASCADE, user_id FK profiles CASCADE nullable (null=broadcast), tipo, titulo, descricao, link, lida default false, created_at, indexes (user_id,lida,created_at) e (organization_id,created_at)`

---

## 8. Relações

```
organizations 1--* memberships *--1 profiles (auth.users)
organizations 1--* localidades (tree parent_id)
organizations 1--* categorias
organizations 1--* ativos *--* chamados *--* os_atividades/servicos/fotos/historico
ativos 1--* planos_manutencao
ativos *--* produtos (via categoria)
produtos 1--* movimentacoes_estoque
fornecedores 1--* produtos, compras, os_servicos_externos, cotacoes, pedidos_compra
solicitacoes_compra 1--* solicitacao_itens/cotacoes/pedidos_compra
pedidos_compra 1--* pedido_itens 1--* recebimentos 1--* recebimento_itens
```

---

## 9. Índices e Constraints

- `unique` parciais: `produtos(sku) where sku not null`, `ativos(codigo) where not null`, `pedidos(numero)`, `localidades` com `where parent_id is null`.
- `check` para `quantidade>0`, `status` enums, `avaliacao 0-5`, `tamanho_bytes >=0`.
- `FK` com `CASCADE` para hierarquias (localidades, chamados→os), `SET NULL` para opcionais (fornecedor), `RESTRICT` para `movimentacoes.produto_id` (evita apagar produto com movimentação).
- `enable row level security` em 36 tabelas + `storage.objects`.
