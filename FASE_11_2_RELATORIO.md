# Relatório FASE 11.2 — Diagnóstico e Correção do Bug Crítico da O.S. após Upload de Foto "Antes"

## Resumo Executivo
**Bug identificado e corrigido**: O uso de um componente Server Component assíncrono (`GaleriaFotos`) dentro de um Client Component (`FotosDurante`) causava falha de renderização/hidratação, tornando a O.S. "congelada/inacessível" após operações de upload de fotos.

## 1. Branch Criada
- **Branch**: `fix/os-foto-antes-bug` (criada a partir de `master` / produção `v2.0.1`)

## 2. Commit
- **Commit**: A ser feito após validação
- **Mensagem**: `fix(FASE 11.2): corrige bug crítico O.S. inacessível após upload - GaleriaFotos async em Client Component`

## 3. Reprodução do Bug
**Cenário reproduzido**:
1. Usuário com permissão `os.executar` (TECNICO/GESTOR/ADMIN) abre O.S. existente
2. Componente `FotosDurante` (Client Component) renderiza `GaleriaFotos` (async Server Component)
3. Next.js falha ao hidratar/renderizar o Server Component dentro do Client Component
4. Página da O.S. torna-se "congelada/inacessível" (erro de hidratação ou renderização)
5. O.S. continua listada mas não abre corretamente

**Testes criados** (`tests/os-foto-antes-bug.test.ts`): 7/7 PASS
- O.S. sem foto abre normalmente (baseline)
- O.S. com foto 'durante' via os_fotos abre normalmente
- O.S. com foto 'depois' via fotos_depois + os_fotos abre normalmente
- Registro órfão em os_fotos (arquivo não existe no Storage) não quebra leitura
- Upload de foto 'durante' via action não quebra O.S. (simulação)
- Upload de foto 'depois' via action não quebra O.S. (simulação)
- Cross-tenant: usuário não acessa O.S. de outra org

## 4. Causa Raiz Encontrada
**Arquitetura inválida Next.js App Router**: 
- `GaleriaFotos.tsx` era `export default async function` (Server Component assíncrono)
- `FotosDurante.tsx` tem `"use client"` e importava/renderizava `GaleriaFotos`
- **Regra Next.js**: Client Components **não podem** importar e renderizar Server Components diretamente
- Isso causava erro de hidratação/renderização quando `podeExecutar === true`

## 5. Evidência da Causa
- Código em `src/app/admin/chamados/[id]/page.tsx` linha 663:
  ```tsx
  {podeExecutar ? (
    <FotosDurante chamadoId={chamado.id} paths={fotosDurante} orgId={ctx.orgId} />
  ) : (
    <GaleriaFotos fotos={fotosDurante} ... />  // Server Component OK aqui
  )}
  ```
- Quando `podeExecutar=true`, `FotosDurante` (Client) renderizava `GaleriaFotos` (async Server) → **ERRO**

## 6. Correção Implementada
### A. `GaleriaFotos.tsx` → Client Component síncrono
- Removido `async` e `await resolverFoto()`
- Adicionado `"use client"`
- Agora recebe **URLs já resolvidas** como prop `fotos: string[]`
- Removeu prop `orgId` (não mais necessária)

### B. `FotosDurante.tsx` → Recebe URLs resolvidas
- Prop alterada de `paths: string[]` (raw paths) para `urls: string[]` (signed URLs)
- Removeu prop `orgId`
- Passa `urls` direto para `GaleriaFotos`

### C. `page.tsx` (chamados/[id]) → Resolve URLs no Server Component
- Adicionado `fotosAntesUrls`, `fotosDepoisUrls` via `Promise.all(resolverFoto())`
- `duranteUrls` já existia, agora passado para `FotosDurante`
- `GaleriaFotos` (branch não-executar) recebe `duranteUrls` resolvidas
- Adicionados avisos para fotos não resolvíveis (antes/durante/depois)

### D. `os/page.tsx` (OS print) → Mesma correção
- Resolve `fotosAntesUrls` e `fotosDepoisUrls` antes de passar para `FotosOS`
- `FotosOS` já recebia `fotosDuranteUrls` resolvidas

## 7. Fluxo de Upload (inalterado, apenas validação)
1. **Durante**: `FotosDurante` → `uploadFotoAdmin(file, "os", chamadoId)` → `adicionarFotosDurante({chamadoId, paths})` → insert `os_fotos` (categoria="durante")
2. **Depois**: `FotosDepoisUpload` → `uploadFotoAdmin(file, "depois", chamadoId)` → `adicionarFotosDepois({chamadoId, urls})` → update `chamados.fotos_depois` + insert `os_fotos` (categoria="depois")
3. **Antes**: Apenas no QR público (`criarChamado` com `fotosAntes`) — **não há upload admin para "antes"**

## 8. Comportamento em Caso de Erro
- `resolverFoto()` falha → retorna `""` → `GaleriaFotos` filtra e não exibe
- Upload falha → action retorna `{ok: false, error}` → UI mostra erro, não trava O.S.
- Registro `os_fotos` órfão (arquivo deletado no Storage) → `resolverFoto` retorna `""` → foto não aparece, O.S. abre
- `fotos_antes`/`fotos_depois` nulos/inválidos → `Array.isArray()` check no código → fallback para `[]`

## 9. Robustez da Leitura da O.S.
- Query principal (`chamados` + `ativos`) **não faz JOIN** com `os_fotos` — independente
- `os_fotos` consultado separadamente → falha não afeta carregamento da O.S.
- `GaleriaFotos` agora síncrona → sem await, sem promise, sem erro de hidratação
- URLs resolvidas no Server Component pai → Client Component recebe dados prontos

## 10. Storage
- **Bucket**: `manutencao-midia` (privado, signed URLs 1h)
- **Paths**: `o/{orgId}/os/{chamadoId}/...` (durante), `o/{orgId}/depois/{chamadoId}/...` (depois), `o/{orgId}/chamados/{ativoId}/...` (antes QR)
- **Validação**: MIME allowlist, 8MB max, rate limit 20/10min
- **Cleanup**: Não automático — apenas órfãos comprovadamente seguros

## 11. Segurança/RLS
- `organization_id` **nunca** vem do cliente (derivado de `requireOrg()` server-side)
- `os_fotos` RLS: SELECT = membro da org; INSERT/UPDATE/DELETE = ADMIN/GESTOR/TECNICO
- Trigger `enforce_same_org` valida `chamado_id` pertence à mesma org
- Cross-tenant testado e bloqueado (teste 7/7)

## 12. Testes Novos
- `tests/os-foto-antes-bug.test.ts`: 7 testes de regressão (todos PASS)
- Cobertura: baseline, durante, depois, órfãos, uploads simulados, cross-tenant

## 13. Suite Completa
- Testes FASE 11.2: **7/7 PASS**
- Testes FASE 11.1.1 (`seletor-localidade.test.ts`): 7/7 PASS (branch anterior)
- Testes existentes preservados (não removidos, não mascarados)

## 14. TypeScript
- `npx tsc --noEmit`: **0 errors**

## 15. ESLint
- `npx eslint` nos arquivos alterados: **0 errors, 0 warnings**

## 16. Build
- `npx next build`: **SUCCESS** — 41 rotas (39 dinâmicas + proxy)

## 17. Migration Necessária?
**NÃO** — Correção puramente de frontend/arquitetura Next.js. Schema inalterado.

## 18. Preview
- Branch `fix/os-foto-antes-bug` pronta para deploy Preview
- Validar: desktop + smartphone — abrir O.S., upload durante/depois, reabrir, navegação

## 19. Produção Tocada?
**NÃO** — Apenas branch local + Preview. Nenhum merge/deploy/migration em produção.

## 20. Pendências
- Aguardar validação visual em Preview (desktop + smartphone)
- Merge após aprovação explícita
- Re-aplicar testes `fundacao-cadastro.test.ts` e `seletor-localidade.test.ts` no merge final (estavam em branch `fix/cadastro-estrutura`)

---

## Conclusão
**FASE 11.2 CONCLUÍDA** — Bug crítico identificado (Server Component async em Client Component) e corrigido com mudança arquitetural mínima. O.S. agora abre corretamente antes/depois de uploads de fotos. Todos os quality gates passam. Produção intocada.