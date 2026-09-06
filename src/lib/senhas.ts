import { randomBytes } from "node:crypto";

/**
 * Senha provisória de uso único (primeiro acesso).
 * 12 chars × alfabeto de 58 (~70 bits) — suficiente para credencial
 * temporária com expiração implícita (troca forçada no 1º login).
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function gerarSenhaProvisoria(tamanho = 12): string {
  return Array.from(randomBytes(tamanho), (b) => ALFABETO[b % ALFABETO.length]).join("");
}
