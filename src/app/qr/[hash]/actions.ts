"use server";

import { createClient } from "@/lib/supabase/server";

export interface CriarChamadoInput {
  ativoId: string;
  solicitante: string;
  descricao: string;
  /** URLs públicas das fotos já enviadas ao Storage. */
  fotosAntes: string[];
}

export type CriarChamadoResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_SOLICITANTE = 120;
const MAX_DESCRICAO = 2000;
const MAX_FOTOS = 6;

/**
 * Registra um chamado aberto pelo formulário público do QR Code.
 * O upload das fotos é feito no navegador (Storage) e apenas as
 * URLs públicas chegam aqui para serem salvas em `fotos_antes`.
 */
export async function criarChamado(
  input: CriarChamadoInput,
): Promise<CriarChamadoResult> {
  const solicitante = input.solicitante.trim();
  const descricao = input.descricao.trim();
  const fotosAntes = (Array.isArray(input.fotosAntes) ? input.fotosAntes : [])
    .filter((url) => typeof url === "string" && url.startsWith("http"))
    .slice(0, MAX_FOTOS);

  if (!input.ativoId) {
    return { ok: false, error: "Ativo inválido. Escaneie o QR Code novamente." };
  }
  if (solicitante.length < 2 || solicitante.length > MAX_SOLICITANTE) {
    return { ok: false, error: "Informe seu nome (2 a 120 caracteres)." };
  }
  if (descricao.length < 5 || descricao.length > MAX_DESCRICAO) {
    return {
      ok: false,
      error: "Descreva o problema com mais detalhes (5 a 2000 caracteres).",
    };
  }

  const supabase = await createClient();

  // Garante que o ativo realmente existe (o id veio do navegador).
  const { data: ativo } = await supabase
    .from("ativos")
    .select("id")
    .eq("id", input.ativoId)
    .maybeSingle();

  if (!ativo) {
    return { ok: false, error: "Ativo não encontrado." };
  }

  const { data, error } = await supabase
    .from("chamados")
    .insert({
      ativo_id: input.ativoId,
      solicitante,
      descricao,
      fotos_antes: fotosAntes,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: "Não foi possível registrar o chamado. Tente novamente.",
    };
  }

  return { ok: true, id: data.id as string };
}
