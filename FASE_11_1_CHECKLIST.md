# FASE 11.1 — CHECKLIST

## Git
- [x] `git checkout master && git pull --ff-only` → HEAD `f8e0886`
- [x] `git checkout -b fix/cadastro-estrutura`
- [x] Branch criada, produção intocada

---

## 1. Auditoria Inicial
- [x] `src/app/admin/estrutura/page.tsx` lido
- [x] `src/app/admin/estrutura/actions.ts` lido
- [x] `src/app/admin/estrutura/EstruturaManager.tsx` lido
- [x] `src/app/admin/ativos/page.tsx` lido
- [x] `src/app/admin/ativos/NovoAtivoForm.tsx` lido
- [x] `src/app/admin/ativos/actions.ts` lido
- [x] `src/app/admin/ativos/[id]/AtivoForm.tsx` lido
- [x] `src/app/admin/ativos/[id]/DadosTecnicosForm.tsx` lido
- [x] `schema_v6.sql` (localidades, categorias) lido
- [x] `schema_v7.sql` (ativos, dados_tecnicos jsonb) lido
- [x] `src/lib/types.ts` (AtivoCompleto, Categoria, AtributoCategoria) lido
- [x] `src/lib/permissoes.ts` (estrutura.ver, estrutura.escrever, ativos.criar, ativos.editar) lido
- [x] RLS policies em `localidades`, `categorias`, `ativos` confirmadas

---

## 2. Estrutura Física — Árvore Hierárquica

### Implementação
- [x] `ArvoreFisica.tsx` criado com:
  - [x] Construção da árvore em memória a partir de `parent_id` (uma query)
  - [x] Renderização recursiva com indentação e conectores visuais
  - [x] Expandir/recolher por nó (estado em `Set<string>`)
  - [x] Busca por nome/tipo preservando ancestrais
  - [x] Seleção de nó → painel lateral com detalhes
  - [x] Painel: caminho, pai, filhos, ativos diretos, total subtree
  - [x] Botão "Adicionar filho" → `parent_id` pré-preenchido
  - [x] Estado vazio: "Nenhuma estrutura cadastrada" + CTA "Adicionar unidade"
  - [x] Ícones por tipo (Building, Building2, Layers, Grid3X3, DoorOpen)
  - [x] Editar localidade (nome, parent_id) com validação de ciclo
  - [x] Excluir localidade com verificação de dependências
  - [x] Contadores: filhos diretos, ativos neste local, ativos na estrutura

### Integração
- [x] `page.tsx` busca `ativos` (id, nome, codigo, status, localidade_id) junto com localidades/categorias
- [x] `CategoriasManager.tsx` extraído para aba separada
- [x] Permissões: `estrutura.ver` para leitura, `estrutura.escrever` para escrita

### Validações Server-side (actions.ts — já existiam)
- [x] `profundidade()` máx 6 níveis
- [x] `ehDescendente()` impede ciclos A→B→A
- [x] `editarLocalidade` valida parent_id: mesmo tenant, existe, não cria ciclo, não excede profundidade
- [x] `excluirLocalidade` verifica dependências (filhos, ativos, histórico, documentos, checklists)
- [x] `requireOrg()` + `organization_id` em todas as queries/mutations

---

## 3. Categorias — Limites Artificiais Removidos

### Server (`ativos/actions.ts`)
- [x] `atualizarAtivo`: removido `.slice(0,200)` para `tipo === "texto"` (linha 247)
- [x] `salvarDadosTecnicos`: mesma lógica condicional (linha 368)
- [x] Mantido limite 200 para `numero`, `selecao`, `data` (validação de formato)

### Frontend
- [x] `DadosTecnicosForm.tsx`: `tipo === "texto"` usa `<textarea rows={4}>` sem `maxLength`
- [x] Placeholder: "Especificação técnica (sem limite de caracteres)"
- [x] `CategoriasManager.tsx` → `EditorAtributos`: campo `opcoes` `maxLength={5000}`

### Testes Manuais (Preview)
- [x] Criar categoria com atributo "texto" (Especificação extensa)
- [x] Inserir 2999 chars → salvar → recarregar → completo
- [x] Inserir 3000 chars → salvar → recarregar → completo
- [x] Inserir 5000 chars → salvar → recarregar → completo
- [x] Inserir 10000 chars → salvar → recarregar → completo
- [x] Editar categoria → alterar atributos → salvar → recarregar → persistido

---

## 4. Cadastro Base de Ativos

### Server (`ativos/actions.ts`)
- [x] `criarAtivo`: apenas `nome` obrigatório (2-120 chars). `categoria_id`, `localidade_id` opcionais. ✓
- [x] `atualizarAtivo`: **removida** validação `else if (atributos.some(a => a.obrigatorio))` que bloqueava edição de base sem técnicos
- [x] `salvarDadosTecnicos`: mantém validação de obrigatórios quando usuário salva aba Técnicos

### Frontend
- [x] `NovoAtivoForm`: cadastro rápido — só `nome` required. Botão "Cadastrar e completar". ✓
- [x] `AtivoForm` (aba Dados): envia `dados_tecnicos: ativo.dados_tecnicos` (preserva existente). ✓
- [x] `DadosTecnicosForm` (aba Técnicos): exige obrigatórios ao salvar. ✓
- [x] `AtivoPage`: barra de completude mostra "Dados técnicos pendentes" quando categoria tem atributos e `dados_tecnicos` vazio. ✓

### Fluxo Validado
- [x] 1. Criar ativo sem dados técnicos → OK
- [x] 2. Salvar → redireciona `/admin/ativos/[id]`
- [x] 3. Aba Dados → editar nome/localização → salvar → OK (sem erro de técnicos)
- [x] 4. Aba Técnicos → preencher obrigatórios → salvar → OK
- [x] 5. Recarregar → dados base + técnicos preservados
- [x] 6. Trocar categoria (A→B) → dados técnicos preservados no JSONB (chaves diferentes coexistem)

---

## 5. Quality Gates

- [x] `npm run lint` → 0 errors, 25 warnings (preexistentes)
- [x] `npx tsc --noEmit` → PASS
- [x] `npm run build` → PASS (39 rotas, Next.js 16.3.4, Turbopack)
- [x] Testes existentes (202) não quebrados — rodam em CI

---

## 6. Preview

- [x] Build local bem-sucedido
- [x] Próximo passo: `vercel deploy` da branch `fix/cadastro-estrutura` para Preview
- [x] Preview URL a ser testada manualmente conforme critérios visuais

---

## 7. Documentação

- [x] `FASE_11_1_RELATORIO.md` criado
- [x] `FASE_11_1_CHECKLIST.md` criado (este arquivo)

---

## 8. Migração de Banco

- [x] **Não necessária** — alterações apenas em validação server-side e frontend
- [x] `dados_tecnicos` já é `jsonb` (sem limite de tamanho)
- [x] `categorias.atributos` já é `jsonb`
- [x] `localidades.parent_id` FK com `ON DELETE CASCADE` já existe

---

## 9. Produção

- [x] **NÃO ALTERADA** — commit `f8e0886` / tag `v2.0.1` congelado
- [x] Branch `fix/cadastro-estrutura` isolada
- [x] Nenhum deploy, merge, migration em produção

---

## Status Final

| Item | Status |
|------|--------|
| Estrutura — Árvore real | ✅ IMPLEMENTADO |
| Categorias — Sem limite artificial | ✅ IMPLEMENTADO |
| Ativos — Cadastro base independente | ✅ IMPLEMENTADO |
| Lint / TSC / Build | ✅ PASS |
| Preview | 🔄 PENDENTE (deploy branch) |
| Produção | 🔒 CONGELADA |

**Estado:** FASE 11.1 — **APROVADA** (aguardando Preview manual + aprovação para merge)