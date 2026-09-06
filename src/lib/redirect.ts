/**
 * Destinos internos seguros (anti open-redirect).
 *
 * Parâmetros `next`/`returnTo` vindos da URL nunca são confiáveis:
 * `/login?next=https://evil.com` deve cair no fallback, nunca navegar
 * para fora. Só aceita caminho relativo iniciado por `/` simples
 * (sem `//`, sem `\`, sem protocolo).
 */
export function destinoSeguro(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  if (/^\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*$/.test(next)) return next;
  return fallback;
}
