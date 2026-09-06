"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface CriarChamadoInput {
  /** Token público do QR (da URL). O ativo E o tenant são resolvidos no servidor. */
  token: string;
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
 * Registra chamado público. NADA de tenant/ativo vem do cliente além do
 * token da URL: ativo e organization_id são resolvidos no servidor e cada
 * foto é validada contra o prefixo da org. O UUID do ativo nunca trafega
 * no HTML. Insert via anon (RLS `chamados_insert_publico`); audit via
 * service (anon não tem INSERT em auditoria).
 */
export async function criarChamado(
  input: CriarChamadoInput,
): Promise<CriarChamadoResult> {
  const solicitante = input.solicitante.trim();
  const descricao = input.descricao.trim();
  const token = (input.token ?? "").trim();

  if (!token || token.length < 8) {
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
    .eq("qr_code_hash", token)
    .maybeSingle();

  if (!ativo?.organization_id) {
    return { ok: false, error: "Ativo não encontrado." };
  }
  const orgId = ativo.organization_id as string;
  const ativoId = ativo.id as string;

  // Só aceita fotos dentro do prefixo da org do ativo (anti-forgery).
  const prefixo = `o/${orgId}/chamados/${ativoId}/`;
  const fotosAntes = (Array.isArray(input.fotosAntes) ? input.fotosAntes : [])
    .filter((u) => typeof u === "string" && u.startsWith(prefixo))
    .slice(0, MAX_FOTOS);

  const supabase = await createClient();
  // UUID gerado no servidor ANTES do insert (mesmo motivo do qr-compra:
  // anon tem INSERT, sem SELECT — nada de `.select().single()`).
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("chamados")
    .insert({
      id,
      organization_id: orgId,
      ativo_id: ativoId,
      solicitante,
      descricao,
      fotos_antes: fotosAntes,
    });

  if (error) {
    console.error(
      "[qr] insert chamado:",
      error.code ?? "?",
      (error.message ?? "").slice(0, 200),
    );
    return {
      ok: false,
      error: "Não foi possível registrar o chamado. Tente novamente.",
    };
  }

  // Metadados das fotos do antes (visitante: user_id null; autor no audit).
  if (fotosAntes.length > 0) {
    const { error: fotosError } = await svc.from("os_fotos").insert(
      fotosAntes.map((path) => ({
        organization_id: orgId,
        chamado_id: id,
        path,
        categoria: "antes",
        user_id: null,
      })),
    );
    if (fotosError) {
      console.error(
        "[qr] insert os_fotos:",
        fotosError.code ?? "?",
        (fotosError.message ?? "").slice(0, 200),
      );
    }
  }
  // Auditoria best-effort documentada (não desfaz o chamado; só loga).
  const { error: auditError } = await svc.from("auditoria_logs").insert({
    tabela: "chamados",
    registro_id: id,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { ativo_id: ativoId, solicitante, fotos: fotosAntes.length },
    executado_por: solicitante,
    organization_id: orgId,
  });
  if (auditError) {
    console.error(
      "[qr] insert audit:",
      auditError.code ?? "?",
      (auditError.message ?? "").slice(0, 200),
    );
  }

  return { ok: true, id };
}
