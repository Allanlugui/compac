import type { ContextoOrg } from "./org";
import type { Role } from "./types";

/**
 * Matriz granular de permissões (FASE 1, §25 do plano).
 *
 * Eixo 1 — módulo; eixo 2 — ação. Ex.:
 *   TECNICO → chamados.executar ✓ · compras.criar ✗ · usuarios.administrar ✗
 *
 * Comportamento idêntico ao `exigirPapel` anterior (migração mecânica);
 * a granularidade nova aparece onde faz sentido (estrutura, auditoria).
 * Validação SEMPRE em 3 camadas: UI + Server (`exigirPermissao`) + RLS.
 */

export const PERMISSOES = {
  "usuarios.administrar": ["ADMIN"],
  "auditoria.ver": ["ADMIN", "GESTOR", "AUDITOR"],
  "estrutura.ver": ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR", "SOLICITANTE"],
  "estrutura.escrever": ["ADMIN", "GESTOR"],
  "ativos.ver": ["ADMIN", "GESTOR", "TECNICO"],
  "ativos.criar": ["ADMIN", "GESTOR"],
  "ativos.editar": ["ADMIN", "GESTOR"],
  "ativos.alterar_status": ["ADMIN", "GESTOR", "TECNICO"],
  "ativos.excluir": ["ADMIN"],
  "chamados.executar": ["ADMIN", "GESTOR", "TECNICO"],
  "chamados.ver": ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR", "SOLICITANTE"],
  "chamados.criar": ["ADMIN", "GESTOR", "TECNICO"],
  "chamados.editar": ["ADMIN", "GESTOR"],
  "chamados.triagem": ["ADMIN", "GESTOR"],
  "os.ver": ["ADMIN", "GESTOR", "TECNICO", "AUDITOR"],
  "os.criar": ["ADMIN", "GESTOR", "TECNICO"],
  "os.planejar": ["ADMIN", "GESTOR"],
  "os.executar": ["ADMIN", "GESTOR", "TECNICO"],
  "os.concluir": ["ADMIN", "GESTOR"],
  "os.encerrar": ["ADMIN", "GESTOR"],
  "os.aprovar": ["ADMIN", "GESTOR"],
  "preventiva.ver": ["ADMIN", "GESTOR", "TECNICO"],
  "preventiva.criar": ["ADMIN", "GESTOR"],
  "preventiva.editar": ["ADMIN", "GESTOR"],
  "preventiva.executar": ["ADMIN", "GESTOR"],
  "compras.ver": ["ADMIN", "GESTOR", "COMPRAS", "AUDITOR"],
  "estoque.movimentar": ["ADMIN", "GESTOR", "COMPRAS", "TECNICO"],
  "estoque.ver": ["ADMIN", "GESTOR", "COMPRAS", "TECNICO", "AUDITOR"],
  "estoque.criar": ["ADMIN", "GESTOR", "COMPRAS"],
  "estoque.editar": ["ADMIN", "GESTOR", "COMPRAS"],
  "estoque.ajustar": ["ADMIN", "GESTOR"],
  "estoque.transferir": ["ADMIN", "GESTOR", "COMPRAS"],
  "fornecedores.ver": ["ADMIN", "GESTOR", "COMPRAS", "TECNICO", "AUDITOR"],
  "fornecedores.criar": ["ADMIN", "GESTOR", "COMPRAS"],
  "fornecedores.editar": ["ADMIN", "GESTOR", "COMPRAS"],
  "compras.criar": ["ADMIN", "GESTOR", "COMPRAS"],
  "compras.aprovar": ["ADMIN", "GESTOR"],
  "compras.cotar": ["ADMIN", "GESTOR", "COMPRAS"],
  "compras.receber": ["ADMIN", "GESTOR", "COMPRAS"],
  "solicitacoes.ver": ["ADMIN", "GESTOR", "COMPRAS", "TECNICO", "AUDITOR", "SOLICITANTE"],
  "solicitacoes.criar": ["ADMIN", "GESTOR", "COMPRAS", "TECNICO", "SOLICITANTE"],
  "solicitacoes.aprovar": ["ADMIN", "GESTOR"],
  "checklists.escrever": ["ADMIN", "GESTOR", "TECNICO"],
  "relatorios.ver": ["ADMIN", "GESTOR", "COMPRAS", "AUDITOR"],
  "calendario.ver": ["ADMIN", "GESTOR", "TECNICO"],
  "mapa.ver": ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR"],
  "monitoramento.ver": ["ADMIN", "GESTOR", "AUDITOR"],
  "organograma.ver": ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR", "SOLICITANTE"],
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
