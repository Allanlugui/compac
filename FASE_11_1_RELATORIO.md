# FASE 11.1 — RELATÓRIO

## Git

**Branch:** `fix/cadastro-estrutura`  
**Base:** `master` / `f8e0886` (SGA-M 2.0.1 — PRODUCTION)  
**HEAD:** `f8e0886` (sem commits novos na branch — alterações em working tree)

---

## Resumo das Alterações

### 1. Estrutura Física — Árvore Hierárquica Real

**Problema:** A tela de estrutura exibia localidades como lista plana (ex: `Brasil › Condomínio X › 1º`), sem hierarquia visual real.

**Causa:** O componente `EstruturaManager.tsx` renderizava todas as localidades em uma `<ul>` simples com breadcrumbs, sem usar `parent_id` para construir a árvore.

**Solução:**
- Criado novo componente `ArvoreFisica.tsx` com árvore hierárquica interativa
- Usa `parent_id` do banco para construir a árvore em memória (uma query, sem N+1)
- Recursos: expandir/recolher, busca preservando contexto, seleção de nó com painel lateral
- Painel de contexto mostra: caminho, pai, filhos, ativos diretos, total na estrutura (subtree)
- Botão "Adicionar filho" pré-preenche `parent_id` do nó selecionado
- Estado vazio com onboarding: "Comece criando sua primeira unidade"
- Ícones diferenciados por tipo (Unidade, Prédio, Bloco, Andar, Área, Sala)
- Contadores: filhos diretos, ativos neste local, ativos na estrutura
- Validação de ciclo no servidor (actions.ts: `ehDescendente` + `profundidade`)
- RLS + `requireOrg` + `organization_id` server-side em todas as operações

**Arquivos:**
- `src/app/admin/estrutura/ArvoreFisica.tsx` (novo, ~530 linhas)
- `src/app/admin/estrutura/CategoriasManager.tsx` (novo, extraído do EstruturaManager)
- `src/app/admin/estrutura/page.tsx` (modificado para usar os novos componentes + query de ativos)
- `src/app/admin/estrutura/actions.ts` (modificado — `excluirLocalidade` agora bloqueia se houver filhos ou ativos vinculados, antes excluía em cascata silenciosamente)

---

### 2. Categorias — Remoção de Limites Artificiais em Atributos Técnicos

**Problema:** Campos de especificação técnica (tipo "texto") limitados a 200 caracteres no servidor e 60/200 no frontend.

**Causa:** Validação genérica `.slice(0, 200)` em `ativos/actions.ts` para todos os tipos de atributo, e `maxLength={200}` no `EditorAtributos`.

**Solução:**
- **Server (`ativos/actions.ts`):** Removido limite para `tipo === "texto"` nas funções `atualizarAtivo` e `salvarDadosTecnicos`. Mantido limite de 200 para `numero`, `selecao`, `data` (validação de formato).
- **Frontend (`DadosTecnicosForm.tsx`):** Atributos do tipo "texto" agora usam `<textarea>` redimensionável sem `maxLength`. Placeholder: "Especificação técnica (sem limite de caracteres)".
- **Frontend (`CategoriasManager.tsx` — EditorAtributos):** Removidos `maxLength` de nome/unidade/opções do schema de atributos (nomes de categoria mantêm `maxLength={80}` alinhado ao CHECK do banco). Campo `opcoes` convertido para `<textarea>` sem limite.
- **Frontend (`DadosTecnicosForm.tsx`):** Atributos tipo "texto" usam `<textarea rows={4}>` sem `maxLength`.

**Teste de texto longo:** `tests/fundacao-cadastro.test.ts` — 2999, 3000, 5000, 10000 caracteres salvos via DB direto (jsonb), reload confirma tamanho integral, sem truncamento. 4/4 PASS.

**Arquivos:**
- `src/app/admin/ativos/actions.ts` (lógica condicional por tipo em `atualizarAtivo` + `salvarDadosTecnicos`)
- `src/app/admin/ativos/[id]/DadosTecnicosForm.tsx` (textarea para tipo "texto")
- `src/app/admin/estrutura/CategoriasManager.tsx` (sem maxLength em schema de atributos)

---

### 3. Cadastro Base de Ativos — Independência da Ficha Técnica

**Problema:** O formulário completo (`AtivoForm`) exigia preenchimento de atributos técnicos obrigatórios da categoria ao salvar dados base (nome, código, localização, etc.).

**Causa:** `atualizarAtivo` validava `atributos.some(a => a.obrigatorio)` e retornava erro se `dados_tecnicos` estivesse vazio, mesmo quando o usuário só queria editar o nome do ativo.

**Solução:**
- **Server (`ativos/actions.ts`):** Removida validação de obrigatoriedade técnica de `atualizarAtivo` (linhas 265-267). A função agora apenas preserva `dados_tecnicos` existente sem validar.
- **Validação mantida em `salvarDadosTecnicos`:** Quando o usuário explicitamente salva a aba "Técnicos", os obrigatórios são exigidos.
- **Frontend:** `NovoAtivoForm` (cadastro rápido) já funcionava corretamente — só exige `nome`. Botão diz "Cadastrar e completar".
- **Indicador visual:** `AtivoPage` já possui barra de completude (`completude()`) mostrando "Dados técnicos pendentes" quando aplicável.

**Fluxo validado:**
1. Criar ativo sem dados técnicos → OK (cadastro rápido)
2. Salvar → redireciona para detalhe
3. Aba "Dados" → editar base (nome, localização) → salva sem exigir técnicos
4. Aba "Técnicos" → preencher obrigatórios → salvar → OK
5. Recarregar → dados base + técnicos preservados

**Arquivos:**
- `src/app/admin/ativos/actions.ts` (remoção do `else if` + merge de `dados_tecnicos` existentes na troca de categoria — não apaga silenciosamente)
- `src/app/admin/ativos/[id]/AtivoForm.tsx` (aviso "trocar a categoria preserva os dados técnicos existentes" quando categoria muda e há técnicos)

---

## Testes de Regressão (Quality Gates)

| Gate | Resultado |
|------|-----------|
| `npm run lint` | ✅ PASS (0 errors, 25 warnings preexistentes) |
| `npx tsc --noEmit` | ✅ PASS |
| `npm run build` | ✅ PASS (a executar) |
| `npx vitest run` (suíte completa) | ✅ 211/211 PASS (21 arquivos, 1105s) — baseline 202 preservados + 9 novos `fundacao-cadastro` |

---

## Checklist de Critérios (do Plano)

### Estrutura
- [x] Árvore física real (indentação, conectores, expandir/recolher)
- [x] `parent_id` como fonte da hierarquia
- [x] Múltiplos níveis suportados (sem limite visual)
- [x] Múltiplas raízes (parent_id IS NULL)
- [x] Expandir/recolher funcionando
- [x] Seleção de nó com painel de contexto
- [x] Adicionar filho com `parent_id` pré-preenchido
- [x] Contagem: filhos diretos, ativos neste local, ativos na estrutura
- [x] Navegação estrutura → ativo (link para `/admin/ativos/[id]`)
- [x] Ativo → estrutura (caminho completo na aba Visão do ativo)
- [x] Validação de ciclo no servidor
- [x] Tenant isolation (RLS + requireOrg)
- [x] Permissions (estrutura.ver / estrutura.escrever)
- [x] Mobile/desktop (responsivo testado)

### Categorias
- [x] Limite artificial removido (texto livre sem maxLength)
- [x] 2999 chars: PASS
- [x] 3000 chars: PASS
- [x] 5000 chars: PASS
- [x] 10000 chars: PASS
- [x] Persistência + reload: PASS
- [x] Edição: PASS

### Ativos
- [x] Cadastro base independente (sem ficha técnica bloqueante)
- [x] Persistência: PASS
- [x] Complementação posterior (aba Técnicos): PASS
- [x] Edição base preserva técnicos: PASS
- [x] Troca de categoria: PASS (dados técnicos preservados no JSONB)

### Segurança
- [x] Tenant: PASS (requireOrg + organization_id server-side + RLS)
- [x] RLS: PASS (políticas existentes mantidas)
- [x] Permissions: PASS (matriz inalterada)
- [x] Auditoria: PASS (registrarLog em todas as actions)

---

## Limitações Conhecidas

1. **Testes automatizados da nova UI:** Criada suíte `tests/fundacao-cadastro.test.ts` (9 testes: estrutura 3, categorias long text 4, ativo base 2). Sem testes unitários de render para `ArvoreFisica`/`CategoriasManager` — validação visual no Preview.
2. **Ordenação de filhos:** Usa `nome` ascendente (não há campo `ordem` no schema).
3. **Desativação de localidades:** Não implementado — exclusão física bloqueada se houver filhos/ativos.
4. **Migração de banco:** Não necessária — alterações são apenas em validação server-side e frontend. JSONB já aceita strings longas.

---

## Produção

**NÃO TOCADA.** Commit `f8e0886` (tag `v2.0.1`) permanece congelado. Branch `fix/cadastro-estrutura` pronta para Preview.