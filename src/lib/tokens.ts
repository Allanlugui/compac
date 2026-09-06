/**
 * Tokens públicos não-enumeráveis (QR, acompanhamento).
 *
 * Alfabeto de 58 símbolos (sem 0/O, 1/l/I ambíguos), gerador
 * criptograficamente seguro (WebCrypto).
 *
 * Entropia: 24 × log2(58) ≈ 24 × 5,86 ≈ 140 BITS.
 * Tokens legados de 12 chars (~70 bits) permanecem válidos
 * por compatibilidade com etiquetas já impressas.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BITS_POR_CHAR = Math.log2(58); // ≈ 5,86

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const ENTROPIA_TOKEN_NOVO = "≈140 bits (24 caracteres × log2(58))";
export const ENTROPIA_TOKEN_LEGADO = "≈70 bits (12 caracteres × log2(58))";

export function gerarTokenPublico(tamanho = 24): string {
  if (tamanho < 16) {
    throw new Error("Token público mínimo: 16 caracteres.");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}
