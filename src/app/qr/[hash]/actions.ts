"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface CriarChamadoInput {
  ativoId: string;
  solicitante: string;
  descricao: string;
  /** PATHS do Storage (`o/{org}/...`) gerados pelo upload server-side. */
  fotosAntes: string[];
}

export type CriarChamadoResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_SOLICITANTE = 120;
const MAX_DESCRICAO = 2000;
const MAX_FOTOS = 6;

/**
 * Registra chamado público. Tenant NUNCA vem do cliente: é resolvido
 * do ativo no servidor e cada foto é validada contra o prefixo da org.
 * Insert via anon (RLS `chamados_insert_publico`); audit via service
 * (anon não tem INSERT em auditoria).
 */
export async function criarChamado(
  input: CriarChamadoInput,
): Promise<CriarChamadoResult> {
  const solicitante = input.solicitante.trim();
  const descricao = input.descricao.trim();

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

  const svc = createServiceClient();
  const { data: ativo } = await svc
    .from("ativos")
    .select("id, organization_id")
    .eq("id", input.ativoId)
    .maybeSingle();

  if (!ativo?.organization_id) {
    return { ok: false, error: "Ativo não encontrado." };
  }
  const orgId = ativo.organization_id as string;

  // Só aceita fotos dentro do prefixo da org do ativo (anti-forgery).
  const prefixo = `o/${orgId}/chamados/${input.ativoId}/`;
  const fotosAntes = (Array.isArray(input.fotosAntes) ? input.fotosAntes : [])
    .filter((u) => typeof u === "string" && u.startsWith(prefixo))
    .slice(0, MAX_FOTOS);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chamados")
    .insert({
      organization_id: orgId,
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

  const id = data.id as string;
  await svc.from("auditoria_logs").insert({
    tabela: "chamados",
    registro_id: id,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { ativo_id: input.ativoId, solicitante, fotos: fotosAntes.length },
    executado_por: solicitante,
    organization_id: orgId,
  });

  return { ok: true, id };
}
