/**
 * Helpers puros da árvore física (localidades.parent_id).
 * Fonte única usada por ArvoreFisica (estrutura) e SeletorLocalidade (ativos).
 * Sem acesso a banco — recebe listas já filtradas por organization_id.
 */

export interface NoLocalidade {
  id: string;
  nome: string;
  tipo: string;
  parent_id: string | null;
}

export function buildFilhosMap<T extends NoLocalidade>(localidades: T[]): Map<string | null, T[]> {
  const m = new Map<string | null, T[]>();
  for (const l of localidades) {
    const k = l.parent_id ?? null;
    const arr = m.get(k) ?? [];
    arr.push(l);
    m.set(k, arr);
  }
  for (const [, arr] of m) arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return m;
}

export function caminhoLocalidade<T extends NoLocalidade>(porId: Map<string, T>, id: string): string {
  const partes: string[] = [];
  let cur: T | undefined = porId.get(id);
  const vistos = new Set<string>();
  while (cur && !vistos.has(cur.id)) {
    vistos.add(cur.id);
    partes.unshift(cur.nome);
    cur = cur.parent_id ? porId.get(cur.parent_id) : undefined;
  }
  return partes.join(" › ");
}

/** IDs que combinam com o termo + todos os seus ancestrais (preserva contexto). */
export function visiveisComAncestrais<T extends NoLocalidade>(
  localidades: T[],
  porId: Map<string, T>,
  termo: string,
): Set<string> | null {
  const t = termo.trim().toLowerCase();
  if (!t) return null;
  const match = new Set<string>();
  for (const l of localidades) {
    if (l.nome.toLowerCase().includes(t) || l.tipo.toLowerCase().includes(t)) match.add(l.id);
  }
  const incluir = new Set<string>(match);
  for (const id of match) {
    let cur = porId.get(id);
    while (cur?.parent_id) {
      incluir.add(cur.parent_id);
      cur = porId.get(cur.parent_id);
    }
  }
  return incluir;
}
