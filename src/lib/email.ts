import nodemailer from "nodemailer";
import { dispararEmail } from "./email-pipeline";

/**
 * Envio de e-mails transacionais (server-only).
 * Requer SMTP próprio configurado (ver .env.local). Sem SMTP, o
 * chamador deve usar o fallback de exibição única ao admin.
 */

interface ResultadoEmail {
  enviado: boolean;
  motivo?: string;
}

function transporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function smtpConfigurado(): Promise<boolean> {
  return transporter() !== null;
}

/** Envio genérico de texto (provider do pipeline FASE A). */
export async function enviarTexto(input: {
  para: string;
  assunto: string;
  texto: string;
}): Promise<ResultadoEmail> {
  const t = transporter();
  if (!t) {
    return { enviado: false, motivo: "SMTP não configurado no servidor." };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: input.para,
      subject: input.assunto,
      text: input.texto,
    });
    return { enviado: true };
  } catch {
    return { enviado: false, motivo: "Falha de conexão com o SMTP." };
  }
}

/** E-mail com a senha provisória do primeiro acesso (via pipeline FASE A). */
export async function enviarSenhaProvisoria(input: {
  para: string;
  nome: string;
  senha: string;
  orgNome: string;
}): Promise<ResultadoEmail> {
  const r = await dispararEmail({
    evento: "convite_acesso",
    para: input.para,
    variaveis: {
      nome: input.nome,
      senha: input.senha,
      orgNome: input.orgNome,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://compac-xi.vercel.app",
    },
  });
  return { enviado: r.enviado, motivo: r.motivo };
}
