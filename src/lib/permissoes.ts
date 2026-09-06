import type { ContextoOrg } from "./org";
import type { Role } from "./types";

/**
 * Matriz granular de permissões (FASE 1, §25 do plano).
 *
 * Eixo 1 — módulo; eixo 2 — ação. Ex.:
 *   TECNICO → chamados.executar ✓ · compras.escrever ✗ · usuarios.administrar ✗
 *
 * Comportamento idêntico ao `exigirPapel` anterior (migração mecânica);
 * a granularidade nova aparece onde faz sentido (estrutura, auditoria).
 * Validação SEMPRE em 3 camadas: UI + Server (`exigirPermissao`) + RLS.
 */

export const PERMISSOES = {
  "usuarios.administrar": ["ADMIN"],
  "auditoria.ver": ["ADMIN", "GESTOR", "AUDITOR"],
  "estrutura.escrever": ["ADMIN", "GESTOR"],
  "ativos.escrever": ["ADMIN", "GESTOR", "TECNICO"],
  "chamados.executar": ["ADMIN", "GESTOR", "TECNICO"],
  "compras.escrever": ["ADMIN", "GESTOR", "COMPRAS"],
  "estoque.escrever": ["ADMIN", "GESTOR", "COMPRAS"],
  "estoque.movimentar": ["ADMIN", "GESTOR", "COMPRAS", "TECNICO"],
  "fornecedores.escrever": ["ADMIN", "GESTOR", "COMPRAS"],
  "checklists.escrever": ["ADMIN", "GESTOR", "TECNICO"],
} as const satisfies Record<string, readonly Role[]>;

export type Permissao = keyof typeof PERMISSOES;

/** Barreira de permissão (camada SERVER). Lança se o papel não concede. */
export function exigirPermissao(ctx: ContextoOrg, permissao: Permissao): void {
  const papeis = PERMISSOES[permissao] as readonly Role[];
  if (!papeis.includes(ctx.role)) {
    throw new Error("Sem permissão para esta operação.");
  }
}

/** Leitura da matriz (para filtrar navegação na UI). */
export function pode(ctx: Pick<ContextoOrg, "role">, permissao: Permissao): boolean {
  return (PERMISSOES[permissao] as readonly Role[]).includes(ctx.role);
}
