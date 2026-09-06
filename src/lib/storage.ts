"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { requireOrg } from "@/lib/org";

/**
 * Uploads de fotos (SGA-M v3). Centraliza TODAS as subidas:
 *  - path sempre derivado no SERVIDOR (cliente nunca escolhe);
 *  - MIME + tamanho validados;
 *  - rate limit em memória por chave (best-effort; não persiste
 *    entre instâncias serverless — ver nota no schema/RLS).
 */

const BUCKET = "manutencao-midia";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const JANELA_MS = 10 * 60 * 1000;
const MAX_ENVIOS_JANELA = 20;

const envios = new Map<string, number[]>();

function checarLimite(chave: string): boolean {
  const agora = Date.now();
  const lista = (envios.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length >= MAX_ENVIOS_JANELA) return false;
  lista.push(agora);
  envios.set(chave, lista);
  return true;
}

function sanitizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-60);
}

function validarArquivo(file: File): string | null {
  // Allowlist estrita: SVG e formatos ativos são vetados (XSS armazenado).
  // MIME vem do cliente — é só a primeira barreira; o nome é gerado no
  // servidor e a exibição usa signed URL com content-type armazenado.
  const MIME_PERMITIDOS = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ]);
  if (!MIME_PERMITIDOS.has(file.type)) return "Apenas fotos JPG, PNG, WebP ou GIF.";
  if (file.size <= 0 || file.size > MAX_BYTES) return "Imagem excede 8 MB.";
  return null;
}

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Upload PÚBLICO via QR (visitante sem login). Deriva tudo do token:
 * token → ativo → organization_id → path. Service role restrito aqui.
 */
export async function uploadFotoQR(
  token: string,
  file: File,
): Promise<UploadResult> {
  const erroArquivo = validarArquivo(file);
  if (erroArquivo) return { ok: false, error: erroArquivo };
  if (!token || token.length < 8) return { ok: false, error: "Token inválido." };
  if (!checarLimite(`qr:${token}`)) {
    return { ok: false, error: "Muitas fotos em sequência. Aguarde alguns minutos." };
  }

  const svc = createServiceClient();
  const { data: ativo } = await svc
    .from("ativos")
    .select("id, organization_id")
    .eq("qr_code_hash", token)
    .maybeSingle();
  if (!ativo || !ativo.organization_id) {
    return { ok: false, error: "Ativo inválido." };
  }

  const path = `o/${ativo.organization_id}/chamados/${ativo.id}/${Date.now()}-${Math.floor(Math.random() * 1e6)}-${sanitizar(file.name)}`;
  const { error } = await svc.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) return { ok: false, error: "Falha no envio da foto." };
  return { ok: true, path };
}

/**
 * Upload AUTENTICADO (área admin). Org vem da sessão via requireOrg().
 */
export async function uploadFotoAdmin(
  file: File,
  pasta: "depois" | "checklist" | "geral",
  referenciaId: string,
): Promise<UploadResult & { orgId?: string }> {
  const erroArquivo = validarArquivo(file);
  if (erroArquivo) return { ok: false, error: erroArquivo };

  let ctx;
  try {
    ctx = await requireOrg();
  } catch {
    return { ok: false, error: "Sessão inválida." };
  }
  if (!checarLimite(`user:${ctx.userId}`)) {
    return { ok: false, error: "Muitas fotos em sequência. Aguarde alguns minutos." };
  }
  if (!/^[A-Za-z0-9-]{8,64}$/.test(referenciaId)) {
    return { ok: false, error: "Referência inválida." };
  }

  const svc = createServiceClient();
  const path = `o/${ctx.orgId}/${pasta}/${referenciaId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}-${sanitizar(file.name)}`;
  const { error } = await svc.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) return { ok: false, error: "Falha no envio da foto." };
  return { ok: true, path, orgId: ctx.orgId };
}

/**
 * Resolve foto armazenada para URL exibível:
 *  - legada (`.../object/public/...`) → direta (compat, policy autenticada);
 *  - nova (path `o/{org}/...`) → signed URL 1h (server-side).
 * Se `orgIdEsperado` for informado e o path for de outra org, nega.
 */
export async function resolverFoto(
  valor: string,
  orgIdEsperado?: string,
): Promise<string> {
  if (valor.includes("/object/public/")) return valor; // legada
  if (orgIdEsperado) {
    const m = valor.match(/^o\/([^/]+)\//);
    if (m && m[1] !== orgIdEsperado) return "";
  }
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.storage
      .from(BUCKET)
      .createSignedUrl(valor, 3600);
    if (error || !data) return "";
    return data.signedUrl;
  } catch {
    return "";
  }
}
