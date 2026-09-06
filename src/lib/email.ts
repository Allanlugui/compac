import nodemailer from "nodemailer";

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

/** E-mail com a senha provisória do primeiro acesso. */
export async function enviarSenhaProvisoria(input: {
  para: string;
  nome: string;
  senha: string;
  orgNome: string;
}): Promise<ResultadoEmail> {
  const t = transporter();
  if (!t) {
    return { enviado: false, motivo: "SMTP não configurado no servidor." };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: input.para,
      subject: `Seu acesso ao SGA-M · ${input.orgNome}`,
      text: [
        `Olá, ${input.nome}!`,
        ``,
        `Sua conta no SGA-M (${input.orgNome}) foi criada.`,
        ``,
        `E-mail: ${input.para}`,
        `Senha provisória (uso único): ${input.senha}`,
        ``,
        `Entre em ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://compac-xi.vercel.app"}/login e defina sua senha permanente no primeiro acesso.`,
        ``,
        `Não compartilhe esta senha.`,
      ].join("\n"),
    });
    return { enviado: true };
  } catch {
    return { enviado: false, motivo: "Falha de conexão com o SMTP." };
  }
}
