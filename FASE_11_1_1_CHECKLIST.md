# Checklist FASE 11.1.1 — Seletor Hierárquico de Localização

## Implementação
- [x] Helpers puros extraídos em `src/lib/arvore-localidades.ts`
- [x] Componente `SeletorLocalidade.tsx` criado (árvore, busca, a11y, ícones)
- [x] `NovoAtivoForm.tsx` integrado com `SeletorLocalidade`
- [x] `AtivoForm.tsx` integrado com `SeletorLocalidade`
- [x] `page.tsx` (ativos) passa `parent_id` + aceita `novaLocalidade` query param
- [x] `ArvoreFisica.tsx` botão "Criar ativo nesta localidade"
- [x] Caminho completo no detalhe do ativo (`[id]/page.tsx`)
- [x] Localidade indisponível tratada (indica, não limpa automaticamente)

## Quality Gates
- [x] tsc --noEmit → 0 errors
- [x] ESLint → 0 errors (1 warning pre-existente)
- [x] Novos testes → 7/7 PASS
- [x] Suite fundacao-cadastro → 9/9 PASS

## Validação Pendente
- [ ] Build completo (39+ rotas)
- [ ] Suite completa 218+ (211 base + 7 novos)
- [ ] Smoke visual em produção (Preview)
- [ ] Aprovação do usuário para merge
