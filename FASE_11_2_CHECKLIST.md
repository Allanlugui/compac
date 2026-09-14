# Checklist FASE 11.2 — Bug Crítico O.S. Inacessível após Upload Foto

## Investigação
- [x] Auditoria completa do fluxo: O.S. → componente fotos → upload → Storage → persistência → leitura
- [x] Mapeamento de dados: IDs, organization_id, paths Storage, registros os_fotos, joins
- [x] Identificação da causa raiz: `GaleriaFotos` (async Server Component) dentro de `FotosDurante` (Client Component)

## Reprodução
- [x] Teste baseline: O.S. sem foto abre
- [x] Teste: O.S. com foto 'durante' abre
- [x] Teste: O.S. com foto 'depois' abre
- [x] Teste: Registro órfão em os_fotos não quebra
- [x] Teste: Upload 'durante' simulado não quebra
- [x] Teste: Upload 'depois' simulado não quebra
- [x] Teste: Cross-tenant bloqueado

## Correção
- [x] `GaleriaFotos.tsx`: async Server Component → Client Component síncrono (`"use client"`)
- [x] `GaleriaFotos.tsx`: Recebe URLs resolvidas, remove `resolverFoto` interno, remove prop `orgId`
- [x] `FotosDurante.tsx`: Prop `paths` → `urls` (signed URLs), remove `orgId`
- [x] `page.tsx` (chamados/[id]): Resolve `fotosAntesUrls`, `fotosDuranteUrls`, `fotosDepoisUrls` no Server Component
- [x] `page.tsx`: Passa URLs resolvidas para `FotosDurante` e `GaleriaFotos`
- [x] `os/page.tsx`: Resolve `fotosAntesUrls`, `fotosDepoisUrls` para `FotosOS`
- [x] Avisos para fotos não resolvíveis (antes/durante/depois)

## Qualidade
- [x] TypeScript: `tsc --noEmit` → 0 errors
- [x] ESLint: 0 errors, 0 warnings
- [x] Build: `next build` → SUCCESS (41 rotas)
- [x] Testes FASE 11.2: 7/7 PASS
- [x] Testes FASE 11.1.1: 7/7 PASS (branch anterior)

## Segurança/RLS
- [x] organization_id server-side only
- [x] RLS preservado em os_fotos, chamados
- [x] Trigger enforce_same_org ativo
- [x] Cross-tenant testado e bloqueado

## Storage
- [x] Bucket `manutencao-midia` privado, signed URLs 1h
- [x] Paths válidos por categoria
- [x] Validação MIME/tamanho/rate limit
- [x] Comportamento arquivo ausente: retorna "", não quebra

## UX
- [x] Loading/upload states mantidos
- [x] Erros visíveis não travam O.S.
- [x] Retry funcionando
- [x] Mobile/desktop coberto

## Deploy
- [x] Branch `fix/os-foto-antes-bug` criada
- [x] Commit pronto
- [x] Preview deploy pendente
- [x] Produção NÃO tocada
- [x] Merge NÃO feito
- [x] Migration NÃO necessária

## Documentação
- [x] FASE_11_2_RELATORIO.md
- [x] FASE_11_2_CHECKLIST.md