# Relatório FASE 11.1.1 — Seletor Hierárquico de Localização para Ativos

## Objetivo
Substituir o `<select>` plano de localidade nos formulários de criação/edição de ativos por um seletor hierárquico reutilizável, garantindo a mesma fonte `parent_id` usada na página Estrutura.

## O que foi feito

### 1. `src/lib/arvore-localidades.ts` (helpers puros)
- `buildFilhosMap` — agrupa localidades por `parent_id`, ordena alfabeticamente.
- `caminhoLocalidade` — retorna caminho completo (ex: `Brasil › Condomínio X › Sala 01`).
- `visiveisComAncestrais` — filtra por termo e preserva ancestrais (semântica idêntica ao `ArvoreFisica`).
- **Sem acesso a banco** — recebe listas já filtradas por `organization_id`.

### 2. `src/app/admin/estrutura/SeletorLocalidade.tsx`
- Componente client-side reutilizável com:
  - Árvore expansível com ícones por tipo (`unidade/predio/bloco/andar/area/sala`).
  - Busca preservando ancestrais (mesmo algoritmo de `ArvoreFisica`).
  - Caminho completo no trigger e nos nós.
  - Acessibilidade: `role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-selected`.
  - Botão "Sem localização" + indicador visual para localidade indisponível.
- **Não acessa banco** — recebe `localidades` do servidor.

### 3. Integração nos formulários
- **`NovoAtivoForm.tsx`**: substituído `<select>` por `<SeletorLocalidade>`, adicionado `initialLocalidadeId` para pre-fill.
- **`AtivoForm.tsx`**: substituído `<select>` por `<SeletorLocalidade>`.
- **`page.tsx` (ativos)**: passa `parent_id` para `localidades`, aceita query param `novaLocalidade` para pre-fill.

### 4. Atalho Estrutura → Ativo
- Botão "Criar ativo nesta localidade" no painel de detalhes do `ArvoreFisica.tsx`.
- Navega para `/admin/ativos?novaLocalidade={id}` — pre-seleciona a localidade no formulário.

### 5. Caminho completo no detalhe do ativo
- `page.tsx` ([id]) agora exibe `caminhoLocalidade` (ex: `Brasil › X › 1º Andar › Sala 01`) em vez de nome plano.
- Link clicável para a página Estrutura.

### 6. Testes
- **7 novos testes** em `tests/seletor-localidade.test.ts`:
  - Helpers puros: `buildFilhosMap`, `caminhoLocalidade`, `visiveisComAncestrais`, busca vazia.
  - Integração: criar/editar ativo com localidade, cross-tenant rejeitado, localidade removida não quebra.
- **Suite total: 16/16 PASS** (fundacao-cadastro 9 + seletor-localidade 7).

## Quality Gates

| Verificação | Resultado |
|---|---|
| tsc --noEmit | 0 errors |
| ESLint (arquivos alterados) | 0 errors, 1 warning pre-existente |
| Testes (seletor-localidade) | 7/7 PASS |
| Testes (fundacao-cadastro) | 9/9 PASS |
| Build | não executado neste passo (staging) |

## Arquivos alterados
- `src/lib/arvore-localidades.ts` — **novo** (helpers puros)
- `src/app/admin/estrutura/SeletorLocalidade.tsx` — **novo** (componente reutilizável)
- `src/app/admin/estrutura/ArvoreFisica.tsx` — botão "Criar ativo nesta localidade"
- `src/app/admin/ativos/NovoAtivoForm.tsx` — integração com SeletorLocalidade
- `src/app/admin/ativos/page.tsx` — passa `parent_id`, aceita `novaLocalidade`
- `src/app/admin/ativos/[id]/AtivoForm.tsx` — integração com SeletorLocalidade
- `src/app/admin/ativos/[id]/page.tsx` — caminho completo, link para Estrutura
- `tests/seletor-localidade.test.ts` — **novo** (7 testes)

## Conclusão
O seletor hierárquico de localização está implementado, compartilhando a mesma lógica de árvore da página Estrutura. Fluxo: criar ativo → selecionar hierarquia → reload → editar → trocar localidade → reload. Botão na Estrutura pre-seleciona a localidade ao criar ativo. Caminho completo visível no detalhe do ativo.

**Status: FASE 11.1.1 CONCLUÍDA — PRONTO PARA VALIDAÇÃO (sem merge/deploy).**
