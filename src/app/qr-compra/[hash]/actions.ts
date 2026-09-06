"use server";

import { createClient } from "@/lib/supabase/server";

export interface CriarSolicitacaoInput {
  setor: string;
  solicitante: string;
  item: string;
  quantidade: number;
  justificativa: string;
  valorEstimado: number;
}

export type CriarSolicitacaoResult =
  | { ok: true; id: string; hash: string }
  | { ok: false; error: string };

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I) — mesmo padrão dos ativos.
const ALFABETO_HASH =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function gerarHash(tamanho = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return Array.from(bytes, (b) => ALFABETO_HASH[b % ALFABETO_HASH.length]).join(
    "",
  );
}

/**
 * Registra uma solicitação de compra via QR Code e gera o log de
 * auditoria correspondente. O `qr_code_hash` devolvido é o link de
 * acompanhamento público: /qr-compra/{hash}.
 */
export async function criarSolicitacao(
  input: CriarSolicitacaoInput,
): Promise<CriarSolicitacaoResult> {
  const setor = input.setor.trim();
  const solicitante = input.solicitante.trim();
  const item = input.item.trim();
  const justificativa = input.justificativa.trim();
  const quantidade = Number(input.quantidade);
  const valorEstimado = Number(input.valorEstimado);

  if (setor.length < 2 || setor.length > 80) {
    return { ok: false, error: "Setor/unidade: 2 a 80 caracteres." };
  }
  if (solicitante.length < 2 || solicitante.length > 120) {
    return { ok: false, error: "Informe seu nome (2 a 120 caracteres)." };
  }
  if (item.length < 2 || item.length > 160) {
    return { ok: false, error: "Item: 2 a 160 caracteres." };
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1_000_000) {
    return { ok: false, error: "Quantidade deve ser maior que zero." };
  }
  if (justificativa.length < 5 || justificativa.length > 2000) {
    return { ok: false, error: "Justifique o pedido (5 a 2000 caracteres)." };
  }
  if (!Number.isFinite(valorEstimado) || valorEstimado < 0) {
    return { ok: false, error: "Valor estimado inválido." };
  }

  const supabase = await createClient();

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const qr_code_hash = gerarHash(12);
    const { data, error } = await supabase
      .from("solicitacoes_compra")
      .insert({
        setor,
        solicitante,
        item,
        quantidade,
        justificativa,
        valor_estimado: valorEstimado,
        qr_code_hash,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 = colisão de hash → tenta outro.
      if (error.code !== "23505") {
        return {
          ok: false,
          error: "Não foi possível registrar. Tente novamente.",
        };
      }
      continue;
    }
    if (!data) {
      return { ok: false, error: "Não foi possível registrar. Tente novamente." };
    }

    const id = data.id as string;

    // Trilha de auditoria (Fase 4). Best-effort: não bloqueia a solicitação.
    await supabase.from("auditoria_logs").insert({
      tabela: "solicitacoes_compra",
      registro_id: id,
      acao: "INSERT",
      dados_anteriores: null,
      dados_novos: {
        setor,
        solicitante,
        item,
        quantidade,
        justificativa,
        valor_estimado: valorEstimado,
        status: "pendente",
      },
      executado_por: solicitante,
    });

    return { ok: true, id, hash: qr_code_hash };
  }

  return { ok: false, error: "Tente novamente em instantes." };
}
