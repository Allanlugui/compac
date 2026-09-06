# GATE FASE 3 — Validação do núcleo de manutenção

> Sem features novas. Legenda: `PASS` (código) · `BLOCKED` (exige banco + 2 usuários reais).
> JWTs só no terminal local, nunca aqui. `lint` 0 · `tsc` 0 · `build` 0.

## 1. Regra CHAMADO × O.S. (conceito único do sistema)

```text
status    = estado da DEMANDA  (aberto → triagem → convertido/resolvido/cancelado)
os_status = estado da EXECUÇÃO (aberta → … → encerrada; nulo até a conversão)
```

| Superfície | Usa | Mistura? |
|---|---|---|
| Dashboard (abas/KPIs) | `status` (demanda) + selo `os_status` | Não — grupos `novos/em_os/concluidos/cancelados` |
| Relatórios | `status` + `concluido_em` (resolvido+concluído) | Não |
| Timeline | ambos, rotulados (`Triagem` vs `O.S.: …`) | Não — dup `STATUS_CHANGE` com `os_status` filtrado |
| Notificações | texto por evento | Não |
| SLA | `prazo` × `concluido_em`/hoje | Não depende de texto da UI |

## 2. Workflow (mapas fechados em `chamados/[id]/actions.ts`)

Demanda: `aberto→em_triagem/cancelado` · `em_triagem→+info/convertido/resolvido/cancelado` ·
`aguardando→triagem/cancelado` · legados `em_andamento→triagem/OS/resolvido/cancelado` ·
`convertido/resolvido/cancelado/concluido` terminais.
O.S.: `aberta→planejada→atribuida→em_execucao→[peca|terceiro|validacao]→concluida→encerrada`
+ retornos `planejada↔atribuida`, `validacao↔execucao`, `concluida→validacao`.
Transição fora do mapa via action direta → `NEGADO` (qualquer papel).

## 3. Sincronismo do ativo (só automático seguro)

| Evento O.S. | Ativo muda | Condição guardada |
|---|---|---|
| `em_execucao` / volta p/ `em_validacao` | → `em_manutencao` | só se `operacional` |
| `concluida` / `encerrada` | → `operacional` | só se `em_manutencao` |
| qualquer | `desativado/inativo/parado/inspecao/instalacao` | **nunca** tocados |

## 4. Matriz de testes

| # | Teste | Esperado | Status |
|---|---|---|---|
| 1 | CHAMADO/O.S. (conceitos) | §1 respeitado nas 5 superfícies | PASS |
| 2 | Workflow + retornos; transição inválida direta | NEGADO | PASS (código) / BLOCKED (ao vivo) |
| 3 | Sync ativo (tabela §3, incl. desativado não reativa) | coerente | PASS (código) / BLOCKED (ao vivo) |
| 4 | Conversão carrega ativo/código/local/categoria/fabr/modelo/etc. | sem redigitar (doc O.S. §1) | PASS |
| 5 | Snapshot imutável; obrigatório/foto/obs pendente bloqueia conclusão | NEGADO | PASS (código) / BLOCKED (ao vivo) |
| 6 | Fotos antes/durante/depois com O.S.+org+usuário+data+categoria (`os_fotos`); câmera+galeria | ok | PASS |
| 7 | Estoque 10 → reserva 3 (fís 10/res 3) → consome 2 (fís 8/res 1) → devolve 1 (fís 8/res 0); auditoria STOCK_* | exato | PASS (código) / BLOCKED (ao vivo) |
| 8 | 100+80+50+20 = **250**; derivados × diretos sem dupla | 250 | PASS (construção) / BLOCKED (ao vivo) |
| 9 | Serviço com fornecedor de outro tenant | NEGADO (action + trigger `schema_v10`) | PASS (código) / BLOCKED (ao vivo) |
| 10 | horímetro 1000→1015 = 15; final &lt; inicial | NEGADO (sem reset configurado) | PASS |
| 11 | Plano→O.S. (`plano_id`); encerrar atualiza última/próxima; corretiva avulsa não toca plano | ok | PASS (código) / BLOCKED (ao vivo) |
| 12 | SLA por datas (`prazo` × conclusão/hoje) | No prazo/Próximo/Atrasado | PASS |
| 13 | Timeline 8 fontes sem duplicar | filtro `os_status` | PASS |
| 14 | Auditoria (mapeamento abaixo) | consistente | PASS |
| 15 | Multi-tenant O.S./ativo/produto/fornecedor/checklist/fotos/preventiva/timeline/audit | NEGADO cross | BLOCKED — `teste_isolamento.md` + O.S. de A × ativo/produto/fornecedor de B |
| 16 | Roles (TECNICO executa, não aprova; SOLICITANTE não conclui; AUDITOR não altera) | servidor+RLS | PASS (código) / BLOCKED (ao vivo) |
| 17 | Ponta a ponta QR→…→auditoria com dados reais circulando | — | BLOCKED |

## 5. Auditoria (nomes do sistema)

`INSERT` (criações) · `TRIAGEM` · `STATUS_CHANGE` (fases + workflow) · `OS_CONCLUIDA`
(concluir+encerrar) · `CHECKLIST_CONCLUIDA` · `STOCK_ENTRY/EXIT/ADJUSTMENT`
(entrada/devolução/saída+consumo+reserva/ajuste) · `FOTO_ADICIONADA` · `COST_ADDED`
(serviços + custos diretos) · `LOGIN/LOGOUT`. Sem `PHOTO_DELETED` (não há exclusão
de foto de O.S.) nem `CHECKLIST_STARTED` (execução é ato único concluído).

## 6. Roles da FASE 3 (explícito, sem auto-grant)

`chamados.criar` AGT · `triagem` AG · `os.planejar/concluir/encerrar/aprovar` AG ·
`os.executar` AGT · `os.ver` AGTAud · `preventiva.criar/editar/executar` AG ·
`compras.escrever` AGC (serviços externos).

## 7. Para liberar a FASE 4

1. Rodar `schema_v10.sql` (inclui §0 dois baldes + trigger serviços).
2. `npm run lint/tsc/build` = 0 (ok nesta revisão).
3. Executar BLOCKED acima e colar a tabela.
