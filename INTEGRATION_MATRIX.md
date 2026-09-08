# SGA-M — INTEGRATION MATRIX

| Origem | Destino | Evento | Existe | Testado | Observação |
|---|---|---|---|---|---|
| Ativo | Localização | `localidade_id` | ✅ | ✅ | Ativo aparece em estrutura |
| QR | Chamado | abertura | ✅ | ✅ | Via `qr/[hash]` com `qr_code_hash` → `ativo_id` |
| Chamado | O.S. | triagem | ✅ | ✅ | `triagemECriarOS` RPC |
| O.S. | Checklist | execução | ✅ | ✅ | `checklist_execucoes` com `chamado_id` |
| O.S. | Estoque | reserva | ✅ | ✅ | `reserva` → `estoque_reservado` |
| O.S. | Compra | falta material | ⚠️ | ⚠️ | Link para `/admin/compras/solicitacoes/nova?os=ID`, vínculo manual |
| Compra | Recebimento | entrega | ✅ | ✅ | `pedidos_compra` → `recebimentos` |
| Recebimento | Estoque | entrada | ✅ | ✅ | `movimentar_estoque_atomic` tipo `entrada` |
| O.S. | Estoque | consumo | ✅ | ✅ | `tipo=consumo` com `chamado_id` |
| Estoque | Compra | reposição | ✅ | ✅ | `ponto_reposicao` → `solicitação` |
| Tudo | Auditoria | evento | ✅ | ✅ | `auditoria_logs` 33 ações |
| Ativo | O.S. | histórico | ✅ | ✅ | `ativos/[id]?tab=os` + `chamados` por `ativo_id` |
| Plano | O.S. | preventiva | ⚠️ | ⚠️ | Manual, não automática |
| Notificação | Usuário | evento | ✅ | ✅ | `notificacoes` com dedup 24h |

**Legenda:** ✅ Existe e funciona, ⚠️ Parcial (requer seleção manual ou geração manual), ❌ Não existe

**Pendente:** `O.S. → Compra` automático com vínculo `O.S. → solicitação` visível em ambos os lados sem busca manual.
