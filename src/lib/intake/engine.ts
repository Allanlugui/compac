import { EMAIL_RE, novaSessao, proximaPergunta, slotsVisiveis } from "./slots";
import type { AnexoIntake, Respostas, SessaoIntake, SlotDef } from "./types";

export { novaSessao, proximaPergunta, slotsVisiveis, EMAIL_RE };
export type { Respostas, SessaoIntake, SlotDef };

/**
 * BLOCO 2 — Motor: valida resposta, avança estado, confirma, resume.
 * Tudo puro e síncrono. A camada externa persiste a sessão e executa uploads.
 */

// Mesma allowlist de `src/lib/storage.ts` (duplicada de propósito: este
// módulo não pode importar camadas server-only).
const MIME_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 8 * 1024 * 1024;

export type ResultadoResposta =
  | { ok: true; sessao: SessaoIntake }
  | { ok: false; error: string };

function validarAnexoLista(raw: unknown, max: number): AnexoIntake[] | string {
  const lista = Array.isArray(raw) ? raw : [];
  if (lista.length > max) return `Máximo de ${max} arquivos.`;
  const out: AnexoIntake[] = [];
  for (const a of lista) {
    const r = a as Record<string, unknown>;
    const nome = typeof r.nome === "string" ? r.nome.slice(0, 120) : "";
    const mime = typeof r.mime === "string" ? r.mime : "";
    const tamanho = typeof r.tamanhoBytes === "number" ? r.tamanhoBytes : NaN;
    if (!nome || !MIME_PERMITIDOS.has(mime)) return `Arquivo inválido: use JPG, PNG, WebP ou GIF.`;
    if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > MAX_BYTES) return `Arquivo excede 8 MB.`;
    const path = typeof r.path === "string" ? r.path : undefined;
    out.push({ nome, mime, tamanhoBytes: tamanho, ...(path ? { path } : {}) });
  }
  return out;
}

function validarAcompanhantes(raw: unknown): string[] | string {
  const texto = typeof raw === "string" ? raw : "";
  if (texto.trim() === "") return [];
  const emails = texto.split(/[;,\n]/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length > 5) return "Máximo de 5 acompanhantes.";
  for (const e of emails) {
    if (!EMAIL_RE.test(e) || e.length > 120) return `E-mail inválido: ${e.slice(0, 40)}.`;
  }
  return [...new Set(emails)];
}

type Validado = { ok: true; valor: unknown } | { ok: false; error: string };

function err(error: string): Validado {
  return { ok: false, error };
}

/** Valida + registra a resposta do slot atual. Fora de ordem = erro. */
export function responder(sessao: SessaoIntake, slotId: string, valor: unknown): ResultadoResposta {
  const proxima = proximaPergunta(sessao);
  if (!proxima) return { ok: false, error: "Sessão já concluída." };
  if (proxima.id !== slotId) {
    return { ok: false, error: `Esperava resposta para "${proxima.id}".` };
  }
  const slot: SlotDef = proxima;
  const v = validarSlot(slot, valor);
  if (!v.ok) return { ok: false, error: v.error };

  const respostas: Respostas = { ...sessao.respostas, [slot.id]: v.valor };
  const concluidos = [...sessao.concluidos, slot.id];
  const confirmada = slot.tipo === "confirmacao" ? v.valor === true : sessao.confirmada;
  return { ok: true, sessao: { ...sessao, respostas, concluidos, confirmada } };
}

function validarSlot(slot: SlotDef, valor: unknown): Validado {
  switch (slot.tipo) {
    case "texto": {
      const s = typeof valor === "string" ? valor.trim() : "";
      const min = slot.min ?? 1;
      const max = slot.max ?? 2000;
      if (s === "" && !slot.obrigatorio) return { ok: true, valor: null };
      if (s.length < min || s.length > max) return err(`"${slot.id}": ${min} a ${max} caracteres.`);
      if (slot.id === "acompanhantes") {
        const lista = validarAcompanhantes(s);
        return typeof lista === "string" ? err(lista) : { ok: true, valor: lista };
      }
      return { ok: true, valor: s };
    }
    case "email": {
      const s = typeof valor === "string" ? valor.trim().toLowerCase() : "";
      if (s === "" && !slot.obrigatorio) return { ok: true, valor: null };
      if (!EMAIL_RE.test(s) || s.length > 120) return err("E-mail inválido.");
      return { ok: true, valor: s };
    }
    case "telefone": {
      const s = typeof valor === "string" ? valor.trim() : "";
      if (s === "") return { ok: true, valor: null };
      const digitos = s.replace(/\D/g, "");
      if (digitos.length < 8 || digitos.length > 15) return err("Telefone inválido.");
      return { ok: true, valor: s.slice(0, 30) };
    }
    case "numero": {
      const n = typeof valor === "number" ? valor : Number(valor);
      const min = slot.min ?? 0;
      const max = slot.max ?? Number.MAX_SAFE_INTEGER;
      if (!Number.isFinite(n) || n < min || n > max) return err(`"${slot.id}": número entre ${min} e ${max}.`);
      return { ok: true, valor: n };
    }
    case "opcao": {
      const s = typeof valor === "string" ? valor : "";
      if (!slot.opcoes?.includes(s)) return err(`Opção inválida para "${slot.id}".`);
      return { ok: true, valor: s };
    }
    case "confirmacao": {
      if (valor !== true && valor !== "sim") return err("Confirmação necessária para concluir.");
      return { ok: true, valor: true };
    }
    case "anexo": {
      const lista = validarAnexoLista(valor, slot.maxAnexos ?? 6);
      return typeof lista === "string" ? err(lista) : { ok: true, valor: lista };
    }
  }
}

/** Sessão pronta para criar a entidade: sem pendências + confirmada. */
export function prontaParaCriar(sessao: SessaoIntake): boolean {
  return proximaPergunta(sessao) === null && sessao.confirmada;
}

/** Resumo pergunta → resposta (tela de confirmação da camada externa). */
export function resumo(sessao: SessaoIntake): { pergunta: string; resposta: string }[] {
  return slotsVisiveis(sessao)
    .filter((s) => sessao.concluidos.includes(s.id))
    .map((s) => ({ pergunta: s.rotulo, resposta: formatarResposta(sessao.respostas[s.id]) }));
}

function formatarResposta(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v === true) return "Confirmado";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (typeof v[0] === "object") return `${v.length} arquivo(s)`;
    return (v as unknown[]).map(String).join(", ");
  }
  return String(v);
}
