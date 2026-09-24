import { enviarTexto } from "./email";

/**
 * FASE A — Pipeline de e-mail: evento → template → variáveis → provider → envio → log.
 * Fundação (sem tabelas novas): templates versionados em código; o log de
 * envio retorna no recibo (persistência em `email_logs` fica para a Fase B).
 * Provider atual: SMTP próprio (`src/lib/email.ts`, server-only).
 */

export type EventoEmail = "convite_acesso";

export interface TemplateEmail {
  versao: number;
  assunto: string;
  corpo: string;
}

const TEMPLATES: Record<EventoEmail, TemplateEmail> = {
  convite_acesso: {
    versao: 1,
    assunto: "Seu acesso ao SGA-M · {{orgNome}}",
    corpo: [
      "Olá, {{nome}}!",
      "",
      "Sua conta no SGA-M ({{orgNome}}) foi criada.",
      "",
      "E-mail: {{para}}",
      "Senha provisória (uso único): {{senha}}",
      "",
      "Entre em {{siteUrl}}/login e defina sua senha permanente no primeiro acesso.",
      "",
      "Não compartilhe esta senha.",
    ].join("\n"),
  },
};

export function templateDoEvento(evento: EventoEmail): TemplateEmail {
  return TEMPLATES[evento];
}

/** Substitui `{{chave}}` (ausente → ""). Sem HTML: texto puro. */
export function renderizar(template: TemplateEmail, variaveis: Record<string, string>): { assunto: string; texto: string } {
  const trocar = (s: string) => s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => variaveis[k] ?? "");
  return { assunto: trocar(template.assunto), texto: trocar(template.corpo) };
}

export interface ReciboEmail {
  enviado: boolean;
  motivo?: string;
  evento: EventoEmail;
  versaoTemplate: number;
  para: string;
  em: string;
}

export async function dispararEmail(input: {
  evento: EventoEmail;
  para: string;
  variaveis: Record<string, string>;
}): Promise<ReciboEmail> {
  const template = templateDoEvento(input.evento);
  const { assunto, texto } = renderizar(template, { ...input.variaveis, para: input.para });
  const r = await enviarTexto({ para: input.para, assunto, texto });
  return {
    enviado: r.enviado,
    motivo: r.motivo,
    evento: input.evento,
    versaoTemplate: template.versao,
    para: input.para,
    em: new Date().toISOString(),
  };
}
