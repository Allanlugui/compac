"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { enviarSenhaProvisoria } from "@/lib/email";
import { gerarSenhaProvisoria } from "@/lib/senhas";
import { registrarLog } from "@/lib/auditoria";
import { requireOrg } from "@/lib/org";
import { exigirPapel } from "@/lib/roles";
import type { Role } from "@/lib/types";

export type UsuarioResult =
  | { ok: true; senhaProvisoria: string; emailEnviado: boolean }
  | { ok: false; error: string };

const ROLES: Role[] = ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR", "SOLICITANTE"];

/**
 * Cadastra membro com SENHA PROVISÓRIA de uso único (ADMIN).
 * Fluxo: gera senha → createUser confirmado + flag must_change_password →
 * profile + membership → e-mail com a senha (SMTP próprio) → audita.
 * Sem SMTP, a senha retorna para exibição única ao admin.
 */
export async function convidarMembro(input: {
  email: string;
  nome: string;
  role: Role;
}): Promise<UsuarioResult> {
  const ctx = await requireOrg();
  exigirPapel(ctx, ["ADMIN"]);

  const email = input.email.trim().toLowerCase();
  const nome = input.nome.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "E-mail inválido." };
  }
  if (nome.length < 2 || nome.length > 120) {
    return { ok: false, error: "Nome: 2 a 120 caracteres." };
  }
  if (!ROLES.includes(input.role)) {
    return { ok: false, error: "Perfil inválido." };
  }

  const svc = createServiceClient();

  // Checa vínculo existente buscando o user pelo e-mail (lista paginada).
  const { data: lista } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const jaExiste = (lista?.users ?? []).find(
    (u) => u.email?.toLowerCase() === email,
  );
  if (jaExiste) {
    const { data: memb } = await svc
      .from("memberships")
      .select("id, status")
      .eq("organization_id", ctx.orgId)
      .eq("user_id", jaExiste.id)
      .maybeSingle();
    if (memb && memb.status === "ativo") {
      return { ok: false, error: "Usuário já é membro desta organização." };
    }
    if (memb) {
      await svc
        .from("memberships")
        .update({ role: input.role, status: "ativo" })
        .eq("id", memb.id);
      revalidatePath("/admin/usuarios");
      return { ok: true, senhaProvisoria: "", emailEnviado: false };
    }
  }

  const senhaProvisoria = gerarSenhaProvisoria(12);
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: senhaProvisoria,
    email_confirm: true,
    user_metadata: { nome, must_change_password: true },
  });
  if (error || !data.user) {
    return { ok: false, error: "Não foi possível criar o usuário." };
  }

  await svc.from("profiles").upsert({ id: data.user.id, nome });
  await svc.from("memberships").insert({
    organization_id: ctx.orgId,
    user_id: data.user.id,
    role: input.role,
    status: "ativo",
  });

  const envio = await enviarSenhaProvisoria({
    para: email,
    nome,
    senha: senhaProvisoria,
    orgNome: ctx.orgNome,
  });

  const supabase = await createClient();
  await registrarLog(supabase, {
    tabela: "memberships",
    registro_id: data.user.id,
    acao: "MEMBERSHIP_CHANGE",
    dados_anteriores: null,
    dados_novos: { email, nome, role: input.role, organization_id: ctx.orgId, email_enviado: envio.enviado },
    executado_por: ctx.email,
  });

  revalidatePath("/admin/usuarios");
  return { ok: true, senhaProvisoria, emailEnviado: envio.enviado };
}

/** Troca o papel (ADMIN; nunca o próprio, contra lockout). */
export async function alterarPapel(input: {
  userId: string;
  role: Role;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPapel(ctx, ["ADMIN"]);
  if (!input.userId || input.userId === ctx.userId) {
    return { ok: false, error: "Operação inválida para este usuário." };
  }
  if (!ROLES.includes(input.role)) {
    return { ok: false, error: "Perfil inválido." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Membro não encontrado." };

  const { error } = await supabase
    .from("memberships")
    .update({ role: input.role })
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: "Não foi possível alterar o perfil." };

  await registrarLog(supabase, {
    tabela: "memberships",
    registro_id: input.userId,
    acao: "ROLE_CHANGE",
    dados_anteriores: { role: atual.role },
    dados_novos: { role: input.role },
    executado_por: ctx.email,
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Ativa/inativa membro (ADMIN; nunca a si mesmo). */
export async function alternarStatusMembro(input: {
  userId: string;
  status: "ativo" | "inativo";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPapel(ctx, ["ADMIN"]);
  if (!input.userId || input.userId === ctx.userId) {
    return { ok: false, error: "Operação inválida para este usuário." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ status: input.status })
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: "Não foi possível alterar o status." };

  await registrarLog(supabase, {
    tabela: "memberships",
    registro_id: input.userId,
    acao: "MEMBERSHIP_CHANGE",
    dados_anteriores: null,
    dados_novos: { status: input.status },
    executado_por: ctx.email,
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
