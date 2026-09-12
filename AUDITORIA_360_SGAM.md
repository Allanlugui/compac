# AUDITORIA 360° — SGA-M

**Data:** 2026-09-11 | **Commit:** `691f291` → `dfad547` | **Produção:** `master/d1b9c4a` intocada | **Método:** `Glob` + `Grep` + `Read` + `supabase` `SELECT` (somente leitura)

## Resumo (Reconciliado 2026-09-11 — HEAD `dd0f2e4`)

| Severidade | Quantidade | Estado |
|---|---|---|
| CRÍTICO | 1 | P01 |
| ALTO | 4 | P02-P05 |
| MÉDIO | 6 | P06-P11 |
| BAIXO | 4 | P12-P15 (corrigido de 5) |
| INFO | 1 | P16 |
| **Total** | **16** | **P17-P19 não existem — total 19 era erro de contagem, corrigido para 16** |

---

## Problemas Priorizados

### P01 — CRÍTICO — Link quebrado perfil de outro usuário
- **Módulo:** Organograma → Perfil
- **Arquivo:** `src/app/admin/organograma/OrganogramaClient.tsx:64`
- **Problema:** `href={`/admin/perfil/${selected.user_id}`}` aponta para `/admin/perfil/[id]` que **não existe** (só existe `/admin/perfil` sem `[id]`). Clique em usuário no organograma → 404.
- **Evidência:** `Glob src/app/**/page.tsx` lista `src/app/admin/perfil/page.tsx` apenas, não `src/app/admin/perfil/[id]/page.tsx`. `Grep href=` 100+ mostra este link.
- **Impacto:** Fluxo `Organograma → Ver perfil` quebrado (exemplo obrigatório do usuário).
- **Reprodução:** Login → Organograma → clicar nó → Ver perfil → 404.
- **Causa:** Rota dinâmica não criada, mas `OrganogramaClient` assume que existe.
- **Solução:** Criar `src/app/admin/perfil/[id]/page.tsx` com `requireOrg` + `eh_membro` + `field visibility` (só dados permitidos) ou mudar link para `/admin/usuarios?highlight=id`.
- **Dependências:** `profiles`, `memberships`, `permissoes.ts`.

### P02 — ALTO — Botão /qr/placeholder quebrado
- **Arquivo:** `src/app/admin/dashboard/RoleDashboard.tsx:117`
- **Problema:** `<Link href="/qr/placeholder">Ler QR</Link>` — `/qr/placeholder` não é hash válido, leva a `Ativo não encontrado`.
- **Evidência:** `Grep href="/qr` mostra este.
- **Impacto:** Técnico vê botão que não funciona (mobile first).
- **Solução:** Remover botão ou trocar para scanner real (`/admin/ativos` com `FotoAnexoInput` `capture=environment`).

### P03 — ALTO — /qr-compra/nova inexistente
- **Arquivo:** `src/app/qr-compra/[hash]/page.tsx:173,313`
- **Problema:** `href="/qr-compra/nova"` — rota `src/app/qr-compra/nova/page.tsx` não existe.
- **Solução:** Criar rota ou trocar para `/admin/compras/solicitacoes/nova`.

### P04 — ALTO — Desempenho página com dados fictícios
- **Arquivo:** `src/app/admin/desempenho/page.tsx:16` `auto = {produtividade:85, prazo:90, tempo:75, qualidade:80, eficiencia:90}` + `src/lib/performance.ts:47` `qualidade=80`
- **Problema:** Score sempre `84` para todos, não reflete dados reais. `FAKE_DATA` crítico.
- **Impacto:** Métrica de desempenho sem confiança.
- **Solução:** Plugar `getMetricasTecnico()` real e `performance_evaluations` `qualidade`.

### P05 — ALTO — Link `#` placeholder sem ação
- **Arquivo:** `src/app/admin/desempenho/page.tsx:34` `href="#"`
- **Problema:** `Como minha nota foi calculada?` com `href="#"` não faz nada, quebra a11y.
- **Solução:** Criar modal/tooltip com pesos 25/25/20/20/10.

### P06 — MÉDIO — Rotas órfãs sem menu
- **Arquivos:** `src/app/admin/monitoramento/page.tsx`, `src/app/admin/desempenho/page.tsx`, `src/app/admin/qr-compras/page.tsx`
- **Problema:** Existem mas não estão em `AdminNav.tsx` `SECOES_NAV` (monitoramento, desempenho órfãs; qr-compras só via tab).
- **Solução:** Adicionar em `SECOES_NAV` (Inteligência/Administração).

### P07 — MÉDIO — Cards "Em breve" sem query
- **Arquivos:** `src/app/admin/dashboard/RoleDashboard.tsx:65,84,147,169`
- **Problema:** `Preventivas`, `Auditorias`, `Notificações` sempre `—` `Em breve`, sem `query`.
- **Solução:** Esconder card se `role` não precisa ou usar `estado="insufficient_data"` + CTA.

### P08 — MÉDIO — N+1 em listarConversas
- **Arquivo:** `src/lib/messages.ts:141` `for (parts)` 1 + N*3 queries
- **Problema:** `listarConversas` faz `select conversas` + N `select participantes` + N `select mensagens` + N `count`.
- **Solução:** Usar `join` ou `rpc` agrupado.

### P09 — MÉDIO — Auditoria sem read/unread persistido
- **Arquivo:** `src/lib/messages.ts:158` `naoLidas: 0` no fallback
- **Problema:** Fallback `Storage` não persiste `last_read_at`, badge sempre 0.
- **Solução:** DB `conversa_participantes.last_read_at` já existe em `schema_v22`, remover fallback após `v22`.

### P10 — MÉDIO — Monitoramento auth Online fixo
- **Arquivo:** `src/app/admin/monitoramento/page.tsx:30` `Promise.resolve({status:"Online"})`
- **Problema:** Auth sempre `Online`, nunca `Degradado`.
- **Solução:** `supabase.auth.getUser()` com timing.

### P11 — MÉDIO — Estrutura leitura bloqueada — **JÁ CORRIGIDO**
- **Arquivo:** `src/app/admin/estrutura/page.tsx:16` `exigirPermissao estrutura.escrever` → corrigido para `estrutura.ver` em 9.1
- **Evidência:** HEAD `dd0f2e4` já tem `estrutura.ver` para todos, `git diff` mostra `exigirPermissao(ctx, "estrutura.ver")`
- **Solução:** Nenhuma ação adicional.

### P12 — BAIXO — Tabelas sem uso
- **Arquivo:** `unidades_medida` `schema_v11:35`
- **Problema:** Seed existe, nenhuma rota `supabase.from("unidades_medida")` em `src/` (Grep 0).
- **Solução:** Expor em `estoque` ou remover seed.

### P13 — BAIXO — Componente órfão
- **Arquivo:** `src/components/ui/Card.tsx:7`
- **Problema:** `Card.tsx` não importado (dashboard tem `function Card` local).
- **Solução:** Remover ou usar.

### P14 — BAIXO — Duplicidade ordens-servico vs chamados
- **Arquivo:** `src/app/admin/ordens-servico/page.tsx:93` `ativoEm: p=>p.startsWith("/admin/chamados")`
- **Problema:** Rota espelha `chamados`, 2 itens ativos simultâneos.
- **Solução:** Remover rota ou fazer `redirect`.

### P15 — BAIXO — `—` e `Sem dados` legítimos
- **Arquivos:** 100+ `?? "—"` `Sem dados suficientes`
- **Problema:** INFO, não bug — fallback honesto para nullable.
- **Solução:** Manter, já classificado como legítimo.

### P16 — INFO — `unidades_medida` sem índice
- **Arquivo:** `schema_v11:256` `uni_select` sem índice explícito
- **Solução:** Adicionar `create index` se volume crescer.

---

## Priorização

| Severidade | IDs |
|---|---|
| CRÍTICO | P01 |
| ALTO | P02,P03,P04,P05 |
| MÉDIO | P06,P07,P08,P09,P10,P11 |
| BAIXO | P12,P13,P14,P15 |
| INFO | P16 |

---

## Mapa de Fluxos (resumo)

Ver `SYSTEM_FLOW_AUDIT.md` para 10 fluxos completos.

---

## Pontas Soltas

Ver `ORPHAN_FEATURES.md` para 5 tabelas, 3 rotas órfãs, 2 componentes órfãos.

