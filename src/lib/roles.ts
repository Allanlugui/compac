import type { ContextoOrg } from "./org";
import type { Role } from "./types";

/**
 * Barreira de papel (camada SERVER). Uso obrigatório no início das
 * Server Actions sensíveis — a UI esconder o botão NÃO é segurança.
 * Síncrona de propósito: deve lançar imediatamente no fluxo da action.
 */
export function exigirPapel(ctx: ContextoOrg, papeis: Role[]): void {
  if (!papeis.includes(ctx.role)) {
    throw new Error("Sem permissão para esta operação.");
  }
}
