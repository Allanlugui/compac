# SGA-M — MAP SPEC — Mapa Operacional

**Versão:** BLOCO D
**Data:** 2026-09-07
**Rota:** `/admin/mapa` (`src/app/admin/mapa/page.tsx` + `MapaClient.tsx`)
**Tenant:** `requireOrg() → ctx.orgId` + RLS `eh_membro`

---

## 1. Arquitetura

```
MapaPage (Server Component)
  ├── fetch: localidades, ativos, chamados, categorias (eq organization_id, limit 1000)
  └── MapaClient (Client Component)
       ├── MapFilters (busca, categoria, status, criticidade, flags)
       ├── MapSummary (total, críticos, parados, em manutenção, O.S. abertas, sem localização)
       ├── MapHierarchical (árvore expansível)
       ├── MapCanvas (geográfico — não aplicável, ver §3)
       ├── AssetList (filtrada, com drill-down)
       └── AssetMapCard (popup/resumo — inline na lista)
```

**Server / Client:** dados via Server Component (`supabase.from(...).eq(organization_id)`), interatividade via Client Component. Nunca `supabase` direto no client sem `organization_id`.

**Cache:** não implementado no BLOCO D (chave seria `org + filtros + role + localidade`). Reutiliza `Promise.all` e `useMemo` para `buildTree` e `contagemPorLocal`.

---

## 2. Origem dos Dados

| Dado | Tabela | Campos | Filtro | Limite |
|---|---|---|---|---|
| Localidades | `localidades` | `id, organization_id, nome, tipo, parent_id` | `eq orgId` | 1000 |
| Ativos | `ativos` | `id, organization_id, nome, codigo, status, criticidade, categoria_id, localidade_id` | `eq orgId` | 1000 |
| Chamados (O.S.) | `chamados` | `id, ativo_id, os_status, status` | `eq orgId, not ativo_id is null` | 1000 |
| Categorias | `categorias` | `id, nome` | `eq orgId, tipo=ativo, ativa` | — |

**Sem latitude/longitude:** schema atual não possui `latitude`, `longitude`, `geojson` em `localidades` ou `ativos`. Verificado via `grep schema*.sql` (0 resultados) e `package.json` (0 libs de mapa).

**Decisão:** **Mapa geográfico NÃO APLICÁVEL** — não inventar coordenadas. Exibir aviso `Mapa geográfico indisponível` + `Mapa operacional por estrutura` (hierárquico).

---

## 3. Hierarquia

```
Organização
 └─ Unidade (tipo=unidade, parent_id=null)
     └─ Prédio (predio, parent=unidade)
         └─ Bloco (bloco, parent=predio)
             └─ Andar (andar, parent=bloco)
                 └─ Área (area, parent=andar)
                     └─ Sala (sala, parent=area)
                         └─ Ativo (localidade_id)
```

- Níveis opcionais: org pequena pode ter só `Unidade` + `Sala` ou só `Unidade`.
- `parent_id` define árvore; `UNIQUE(org,parent_id,nome)` + `UNIQUE(org,nome) where parent null` garante unicidade.
- **Caminho:** `caminho(localidade)` = `nome` de todos os ancestrais `→` atual (ex: `Unidade São Paulo › Prédio A › Térreo › Recepção`).

**Árvore expansível:** `expandidos` = `Set<string>` com raízes expandidas por padrão. Clique no chevron expande/recolhe; clique no nome seleciona para filtro.

---

## 4. Contagem por Localidade

Para cada `localidade`, `qtd = COUNT(ativos where localidade_id in subtree(localidade))`.

```ts
function coletarDescendentes(id, filhos, acc) {
  acc.add(id);
  for (const f of filhos.get(id) ?? []) coletarDescendentes(f.id, filhos, acc);
}
```

Exibida como badge `rounded-full` ao lado do nome (ex: `Prédio A — 37 ativos`).

**Consistência:** `Lista = Mapa = Contagem` para o mesmo filtro — todos usam `coletarDescendentes` + `ativosFiltrados`.

Não contar ativos duas vezes (cada ativo pertence a no máximo 1 localidade).

---

## 5. Filtros

| Filtro | Campo | Valores | Comportamento |
|---|---|---|---|
| Unidade/Prédio/Bloco/... | `localidade_id` | Clique na árvore → `selecionada` | Mostra `selecionada + descendentes` + ativos descendentes |
| Categoria | `categoria_id` | `categorias` tipo ativo | `eq categoria_id` |
| Status | `status` | `operacional, em_manutencao, parado, inativo...` | `eq status` |
| Criticidade | `criticidade` | `baixa, media, alta, critica` | `eq criticidade` |
| Somente com O.S. aberta | `chamados.os_status` | boolean | `ativosComOS = Set(chamados where os_status not in (concluida,encerrada) → ativo_id)` |
| Somente críticos | `criticidade` | boolean | `criticidade alta/critica` |
| Somente parados | `status` | boolean | `status == parado` |

**Filtro por hierarquia inteligente:** selecionar `Prédio A` mostra `Prédio A + todos filhos + ativos descendentes`. Selecionar `Andar 2` mostra só `Andar 2 + descendentes`.

**Filtros são AND entre si** (todos aplicados cumulativamente em `ativosFiltrados`).

---

## 6. Busca Contextual (dentro do mapa)

Campo `Buscar por nome, código, patrimônio...` com `useState(busca)`.

Filtra: `${nome} ${codigo} ${criticidade} ${status}`.toLowerCase().includes(t).

**Não é busca global** (BLOCO E). Apenas busca local no mapa, sem `Ctrl+K`, sem `O.S.`/`Produto`/`Fornecedor`.

---

## 7. Status Visual e Criticidade

Distribuição no resumo: `Operacional 24, Em manutenção 5, Parado 3, Em inspeção 2` (contagem via `resumo`).

Cores: `operacional=emerald`, `parado=red`, `em_manutencao=amber` (via Tailwind, mas também texto).

Criticidade: `baixa, media, alta, critica` — filtro reutiliza semântica existente, não nova regra.

---

## 8. Destaques Operacionais (resumo no topo)

```
Total de ativos: resumo.total
Ativos críticos: resumo.criticos (alta/critica)
Ativos parados: resumo.parados (status=parado)
Ativos em manutenção: resumo.emManut (status=em_manutencao)
O.S. abertas: resumo.osAbertas (os_status ativos)
Ativos sem localização: resumo.semLoc (localidade_id is null)
```

Valores vêm de `ativos` + `chamados` já carregados, sem nova query.

---

## 9. Ativos sem Localização

Seção `Ativos sem localização (X)` com `TriangleAlert`, lista os ativos onde `localidade_id is null` **após** filtros (ex: se filtro categoria ativo, mostra sem localização daquela categoria).

Importante para qualidade cadastral. Nunca esconder.

Clique `Ver ativo` → `/admin/ativos/[id]`.

**Localização incompleta:** ativo com `Unidade X` sem `prédio/andar/sala` não é "sem localização", é `localidade_id = Unidade X` (parcial). Não inventar caminho. Mostrar só `Unidade X` no `caminho()`.

---

## 10. Mapa Geográfico — Não Aplicável

**Dados:** schema não possui `latitude`/`longitude` em `localidades` ou `ativos`. `temCoordenadas = false` hardcoded em `page.tsx`.

**Comportamento:** exibe `Mapa geográfico indisponível — dados geográficos reais não cadastrados. Exibindo mapa operacional por estrutura.` com ícone `MapPin` em `amber-50`.

**Se houver coordenadas futuras:** usar `leaflet` ou `mapbox-gl` (avaliar `next/dynamic` com `ssr: false`), cada ativo como marcador `[●]`, popup com `AssetMapCard` (nome, código, status, categoria, criticidade, localização, responsável, O.S. abertas, `Ver ativo` → `/admin/ativos/[id]`). Isolar `MapCanvas` como Client Component.

**Não usar coordenadas fictícias, não posicionar aleatoriamente, não criar mapa fake.**

---

## 11. Pop-up / Resumo do Ativo

Na lista (e futuro popup do mapa), cada ativo mostra:

- `nome` (bold)
- `codigo` (mono, xs)
- `status` (badge)
- `criticidade` (se alta/critica)
- `localidade` (via `caminho()`)
- `O.S. abertas` (count de `chamados` where `ativo_id` e `os_status` ativo)
- `Ver ativo` → `/admin/ativos/[id]`

QR: se `qr_code_hash` existe, link para `/qr/[hash]` já existe em `ativos/[id]` (não duplicar no mapa).

---

## 12. Drill-down

```
Filtro/Árvore → Lista de ativos → Ver ativo → /admin/ativos/[id] → ficha do ativo
```

Mapa é camada de navegação, não nova página do ativo.

---

## 13. Responsividade

- **320–430 (mobile):** `Filtros → Localidade → Resumo (2 cols) → Lista de ativos → Ativos sem localização → Mapa (se houver)`. Árvore com `ml-3` por nível, lista com `max-h-[520px] overflow-y-auto`, botão `Ver ativo` sempre visível.
- **768 (tablet):** `Filtros (12 cols) → Resumo (3 cols) → [Árvore 4 cols | Lista 8 cols]`.
- **1366+ (desktop):** mesma, com `lg:grid-cols-12`.

Nenhum número some por `overflow`.

---

## 14. Estados

| Estado | Quando | Exibição |
|---|---|---|
| `loading` | `localidades` ou `ativos` ainda não carregados (Server Component já resolveu, mas Client pode ter `useState` vazio) | Skeleton (não implementado no MVP, mas `localidades.length===0` mostra "Nenhuma localidade. Crie em /admin/estrutura.") |
| `ok` | Dados carregados | Árvore + lista |
| `empty` | `ativosFiltrados.length===0` | `Nenhum ativo encontrado com os filtros atuais.` |
| `error` | `supabase` error (não esperado, mas `page.tsx` não tem `try/catch`, Next.js mostra error.tsx) | `Error` boundary |
| `insufficient_data` | `temCoordenadas=false` | `Mapa geográfico indisponível` |

Não exibir `0` quando dado não carregado. Não transformar `sem localização` em localização inventada.

---

## 15. Performance

- `Promise.all` para 4 queries (localidades, ativos, chamados, categorias) com `eq orgId` + `order` + `limit 1000`.
- `useMemo` para `buildTree`, `contagemPorLocal`, `ativosFiltrados`, `resumo` (evita recalcular a cada render).
- `filhos` Map + `coletarDescendentes` com `Set` (O(n) por filtro, para 1k ativos/loc é <5ms).
- Sem N+1, sem queries repetidas, sem `SELECT *` sem filtro.
- Lista mostra `slice(0,100)` + `Mostrando 100 de X. Refine os filtros.` para >100.

---

## 16. Segurança

- `page.tsx` é Server Component com `requireOrg()` → `ctx.orgId` + `eq organization_id` em todas as queries.
- `MapaClient` é Client Component mas recebe dados já filtrados por `orgId` do servidor; não faz `supabase.from` sem `orgId`.
- RLS `eh_membro` como segunda barreira; não criar policy permissiva.
- Não usar `service_role` para operação normal.
- Não expor `organization_id` via query string como autoridade (só `localidade_id` selecionada, que é validada via `porId` Map).

---

## 17. Limitações

- Sem coordenadas → mapa geográfico não aplicável (documentado).
- Sem paginação de localidades (mostra todas, `order nome`).
- Sem filtro por `técnico/responsável` no mapa (campo `responsavel` existe em `ativos` mas não tem FK confiável para filtro hierárquico).
- Sem cache (chave seria `org+filtros+role+localidade`, mas não implementado no BLOCO D).

---

## 18. Testes

Ver `tests/mapa.test.ts` (BLOCO D).

---

## 19. Próximos Passos

BLOCO E: Busca Global + Notificações (não mapa).
