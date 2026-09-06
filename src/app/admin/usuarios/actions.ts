"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { registrarLog } from "@/lib/auditoria";
import { requireOrg } from "@/lib/org";
import { exigirPapel } from "@/lib/roles";
import type { Role } from "@/lib/types";

export type UsuarioResult = { ok: true } | { ok: false; error: string };

const ROLES: Role[] = ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR", "SOLICITANTE"];

function siteUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return base === "" ? "http://localhost:3000" : base;
}

/**
 * Convida membro (ADMIN). Cria o usuário via Admin API, o profile e a
 * membership com o papel escolhido. Audita MEMBERSHIP_CHANGE.
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
  const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
    data: { nome },
    redirectTo: `${siteUrl()}/auth/callback?next=/admin/dashboard`,
  });
  if (error || !data.user) {
    return { ok: false, error: "Não foi possível enviar o convite." };
  }

  await svc.from("profiles").upsert({ id: data.user.id, nome });

  const { data: existente } = await svc
    .from("memberships")
    .select("id, status")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (existente && existente.status === "ativo") {
    return { ok: false, error: "Usuário já é membro desta organização." };
  }
  if (existente) {
    await svc
      .from("memberships")
      .update({ role: input.role, status: "ativo" })
      .eq("id", existente.id);
  } else {
    await svc.from("memberships").insert({
      organization_id: ctx.orgId,
      user_id: data.user.id,
      role: input.role,
      status: "ativo",
    });
  }

  const supabase = await createClient();
  await registrarLog(supabase, {
    tabela: "memberships",
    registro_id: data.user.id,
    acao: "MEMBERSHIP_CHANGE",
    dados_anteriores: null,
    dados_novos: { email, nome, role: input.role, organization_id: ctx.orgId },
    executado_por: ctx.email,
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Troca o papel (ADMIN; nunca o próprio, contra lockout). */
export async function alterarPapel(input: {
  userId: string;
  role: Role;
}): Promise<UsuarioResult> {
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
}): Promise<UsuarioResult> {
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
