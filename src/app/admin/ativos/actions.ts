"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CriarAtivoResult =
  | { ok: true }
  | { ok: false; error: string };

const MAX_NOME = 120;
const MAX_LOCALIZACAO = 160;

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I) para etiquetas legíveis.
const ALFABETO_HASH = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function gerarHash(tamanho = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return Array.from(bytes, (b) => ALFABETO_HASH[b % ALFABETO_HASH.length]).join(
    "",
  );
}

/**
 * Cadastra um ativo gerando automaticamente um `qr_code_hash` único.
 * Em caso de colisão (constraint única), gera um novo hash e tenta de novo.
 */
export async function criarAtivo(input: {
  nome: string;
  localizacao: string;
}): Promise<CriarAtivoResult> {
  const nome = input.nome.trim();
  const localizacao = input.localizacao.trim();

  if (nome.length < 2 || nome.length > MAX_NOME) {
    return { ok: false, error: "Nome do ativo: 2 a 120 caracteres." };
  }
  if (localizacao.length > MAX_LOCALIZACAO) {
    return { ok: false, error: "Localização: máximo de 160 caracteres." };
  }

  const supabase = await createClient();

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const qr_code_hash = gerarHash(12);
    const { error } = await supabase.from("ativos").insert({
      nome,
      localizacao: localizacao === "" ? null : localizacao,
      qr_code_hash,
    });

    if (!error) {
      revalidatePath("/admin/ativos");
      return { ok: true };
    }
    // 23505 = violação de unicidade → tenta outro hash.
    if (error.code !== "23505") {
      return { ok: false, error: "Não foi possível salvar o ativo." };
    }
  }

  return { ok: false, error: "Tente novamente em instantes." };
}
