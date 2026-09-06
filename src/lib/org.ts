"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const COOKIE_ORG = "sga_org";

export interface ContextoOrg {
  userId: string;
  email: string;
  orgId: string;
  orgNome: string;
  orgSlug: string;
  role: Role;
}

export interface MembershipAtiva {
  organization_id: string;
  role: Role;
  organizacao_nome: string;
  organizacao_slug: string;
}

/**
 * Lista memberships ativas do usuário logado (para seletor/troca).
 * Retorna [] se não autenticado.
 */
export async function getMemberships(): Promise<MembershipAtiva[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role, organizations!inner(nome, slug)")
    .eq("user_id", user.id)
    .eq("status", "ativo");

  return ((data ?? []) as unknown as {
    organization_id: string;
    role: Role;
    organizations: { nome: string; slug: string };
  }[]).map((m) => ({
    organization_id: m.organization_id,
    role: m.role,
    organizacao_nome: m.organizations.nome,
    organizacao_slug: m.organizations.slug,
  }));
}

/**
 * Contexto obrigatório de organização.
 *
 * O cookie `sga_org` é mera conveniência de UX: a membership é
 * REVALIDADA no servidor a cada chamada. Cookie adulterado ou de
 * org sem vínculo → redirect para seleção/login. Nunca confia no cliente.
 */
export async function requireOrg(): Promise<ContextoOrg> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/sem-acesso");

  // Usuário de uma org só: usa direto, sem depender do cookie.
  if (memberships.length === 1) {
    const m = memberships[0];
    return {
      userId: user.id,
      email: user.email ?? "",
      orgId: m.organization_id,
      orgNome: m.organizacao_nome,
      orgSlug: m.organizacao_slug,
      role: m.role,
    };
  }

  const jar = await cookies();
  const ativa = jar.get(COOKIE_ORG)?.value;
  const match = ativa
    ? memberships.find((m) => m.organization_id === ativa)
    : undefined;

  if (!match) redirect("/selecionar-org");

  return {
    userId: user.id,
    email: user.email ?? "",
    orgId: match.organization_id,
    orgNome: match.organizacao_nome,
    orgSlug: match.organizacao_slug,
    role: match.role,
  };
}

/** Troca a organização ativa (valida membership antes de assinar o cookie). */
export async function setActiveOrg(organizationId: string): Promise<void> {
  const memberships = await getMemberships();
  const match = memberships.find((m) => m.organization_id === organizationId);
  if (!match) {
    throw new Error("Organização inválida para este usuário.");
  }
  const jar = await cookies();
  jar.set(COOKIE_ORG, organizationId, {
    httpOnly: true,
    // Em produção (HTTPS) o navegador só envia via TLS.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/admin", "layout");
}
