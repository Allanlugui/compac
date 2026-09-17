"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { enviarSenhaProvisoria } from "@/lib/email";
import { gerarSenhaProvisoria } from "@/lib/senhas";
import { registrarLog } from "@/lib/auditoria";
import { requireOrg } from "@/lib/org";
import { exigirPermissao, PERMISSOES } from "@/lib/permissoes";
import {
  PERMISSOES_BLOQUEADAS,
  escopoDaPermissao,
} from "@/lib/permissoes-custom";
import type { EfeitoPermissao, EscopoPermissao, PermissaoCustom, Role } from "@/lib/types";

export type UsuarioResult =
  | { ok: true; senhaProvisoria: string; emailEnviado: boolean }
  | { ok: false; error: string };

const ROLES: Role[] = ["ADMIN", "GESTOR", "TECNICO", "COMPRAS", "AUDITOR", "SOLICITANTE"];

function normalizarSetor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 80);
  return t === "" ? null : t;
}

/**
 * Cadastra membro com SENHA PROVISÓRIA de uso único (ADMIN).
 * Fluxo: gera senha → createUser confirmado + flag must_change_password →
 * profile + membership (com setor/departamento) → e-mail com a senha
 * (SMTP próprio) → audita.
 * Sem SMTP, a senha retorna para exibição única ao admin.
 */
function normalizarContato(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export async function convidarMembro(input: {
  email: string;
  nome: string;
  role: Role;
  setor?: string;
  departamento?: string;
  telefone?: string;
  cargo?: string;
  matricula?: string;
}): Promise<UsuarioResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "usuarios.administrar");

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

  await svc.from("profiles").upsert({
    id: data.user.id,
    nome,
    telefone: normalizarContato(input.telefone, 30),
    cargo: normalizarContato(input.cargo, 80),
    matricula: normalizarContato(input.matricula, 40),
  });
  await svc.from("memberships").insert({
    organization_id: ctx.orgId,
    user_id: data.user.id,
    role: input.role,
    status: "ativo",
    setor: normalizarSetor(input.setor),
    departamento: normalizarSetor(input.departamento),
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
    dados_novos: {
      email,
      nome,
      role: input.role,
      organization_id: ctx.orgId,
      setor: normalizarSetor(input.setor),
      departamento: normalizarSetor(input.departamento),
      email_enviado: envio.enviado,
    },
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
  exigirPermissao(ctx, "usuarios.administrar");
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
  exigirPermissao(ctx, "usuarios.administrar");
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

/**
 * Edita membro do vínculo (ADMIN). Nome vai ao profile (global);
 * role/setor/departamento vão à membership (por org).
 * Role própria nunca muda aqui (anti-lockout); setor/departamento/nome sim.
 */
export async function editarMembro(input: {
  userId: string;
  nome: string;
  role: Role;
  setor?: string;
  departamento?: string;
  telefone?: string;
  cargo?: string;
  matricula?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "usuarios.administrar");
  if (!input.userId) return { ok: false, error: "Membro inválido." };

  const nome = input.nome.trim().slice(0, 120);
  if (nome.length < 2) return { ok: false, error: "Nome: mínimo 2 caracteres." };
  if (!ROLES.includes(input.role)) {
    return { ok: false, error: "Perfil inválido." };
  }
  if (input.userId === ctx.userId && input.role) {
    // Trava: verifica se tentou rebaixar a si mesmo.
    const supabase0 = await createClient();
    const { data: propria } = await supabase0
      .from("memberships")
      .select("role")
      .eq("organization_id", ctx.orgId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (propria && (propria as { role: string }).role !== input.role) {
      return { ok: false, error: "Você não pode alterar seu próprio perfil." };
    }
  }

  const setor = normalizarSetor(input.setor);
  const departamento = normalizarSetor(input.departamento);

  const svc = createServiceClient();
  const { error: erroProfile } = await svc
    .from("profiles")
    .update({
      nome,
      telefone: normalizarContato(input.telefone, 30),
      cargo: normalizarContato(input.cargo, 80),
      matricula: normalizarContato(input.matricula, 40),
    })
    .eq("id", input.userId);
  if (erroProfile) return { ok: false, error: "Não foi possível salvar o nome." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("memberships")
    .select("role, setor, departamento")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Membro não encontrado nesta organização." };

  const { error } = await supabase
    .from("memberships")
    .update({ role: input.role, setor, departamento })
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: "Não foi possível salvar o vínculo." };

  await registrarLog(supabase, {
    tabela: "memberships",
    registro_id: input.userId,
    acao: "MEMBERSHIP_CHANGE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { nome, role: input.role, setor, departamento },
    executado_por: ctx.email,
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/**
 * Remove o VÍNCULO do membro com a org (ADMIN; nunca a si mesmo;
 * nunca o último ADMIN ativo). Preserva login, profile e histórico.
 */
export async function removerMembro(input: {
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "usuarios.administrar");
  if (!input.userId || input.userId === ctx.userId) {
    return { ok: false, error: "Operação inválida para este usuário." };
  }

  const supabase = await createClient();
  const { data: alvo } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!alvo) return { ok: false, error: "Membro não encontrado." };

  if ((alvo as { role: string }).role === "ADMIN") {
    const { count } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("role", "ADMIN")
      .eq("status", "ativo")
      .neq("user_id", input.userId);
    if (!count || count < 1) {
      return { ok: false, error: "Não é possível remover o último ADMIN ativo." };
    }
  }

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: "Não foi possível remover o membro." };

  await registrarLog(supabase, {
    tabela: "memberships",
    registro_id: input.userId,
    acao: "MEMBERSHIP_CHANGE",
    dados_anteriores: alvo as unknown as Record<string, unknown>,
    dados_novos: { removido: true, organization_id: ctx.orgId },
    executado_por: ctx.email,
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export type PermissaoResult = { ok: true } | { ok: false; error: string };

export type PermissaoCustomRow = PermissaoCustom;

/** Lista as customizações de um membro (ADMIN). Pré-v25 → []. */
export async function listarPermissoesCustom(input: {
  userId: string;
}): Promise<{ ok: true; dados: PermissaoCustom[] } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "usuarios.administrar");
  if (!input.userId) return { ok: false, error: "Membro inválido." };

  const supabase = await createClient();
  const { data: alvo } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!alvo) return { ok: false, error: "Membro não encontrado nesta organização." };

  const { data, error } = await supabase
    .from("permissoes_custom")
    .select("id, organization_id, user_id, permissao, efeito, escopo_tipo, escopo_id, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId);
  if (error) {
    // Pré-v25: tabela inexistente → sem customizações (legado).
    return { ok: true, dados: [] };
  }
  return { ok: true, dados: (data ?? []) as unknown as PermissaoCustom[] };
}

/**
 * Define ou remove customização (ADMIN).
 * efeito null = remover (volta ao padrão do perfil).
 * Anti-escalada: `usuarios.administrar` fora do modelo; alvo precisa
 * ser membro ativo; escopo precisa pertencer à org.
 */
export async function definirPermissaoCustom(input: {
  userId: string;
  permissao: string;
  efeito: EfeitoPermissao | null;
  escopoTipo?: EscopoPermissao;
  escopoId?: string | null;
}): Promise<PermissaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "usuarios.administrar");
  if (!input.userId) return { ok: false, error: "Membro inválido." };
  if (!(input.permissao in PERMISSOES)) return { ok: false, error: "Permissão desconhecida." };
  if ((PERMISSOES_BLOQUEADAS as readonly string[]).includes(input.permissao)) {
    return { ok: false, error: "Esta permissão é exclusiva do perfil." };
  }

  const supabase = await createClient();
  const { data: alvo } = await supabase
    .from("memberships")
    .select("user_id, status")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!alvo || (alvo as { status: string }).status !== "ativo") {
    return { ok: false, error: "Membro sem vínculo ativo." };
  }

  const escopoTipo: EscopoPermissao = input.escopoTipo ?? "global";
  const escopoId = input.escopoId || null;
  const esperado = escopoDaPermissao(input.permissao);
  if (esperado === "global") {
    if (escopoTipo !== "global" || escopoId) {
      return { ok: false, error: "Esta permissão só aceita alcance global." };
    }
  } else if (escopoTipo !== "global" && escopoTipo !== esperado) {
    return { ok: false, error: "Escopo incompatível com a permissão." };
  } else if (escopoTipo !== "global" && !escopoId) {
    return { ok: false, error: "Escopo exige vínculo." };
  } else if (escopoTipo === "global" && escopoId) {
    return { ok: false, error: "Alcance global não usa vínculo." };
  }
  if (escopoId) {
    const tabela = escopoTipo === "localidade" ? "localidades" : "almoxarifados";
    const { data: esc } = await supabase
      .from(tabela)
      .select("id")
      .eq("id", escopoId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!esc) return { ok: false, error: "Escopo não encontrado." };
  }

  if (input.efeito === null) {
    const { error } = await supabase
      .from("permissoes_custom")
      .delete()
      .eq("organization_id", ctx.orgId)
      .eq("user_id", input.userId)
      .eq("permissao", input.permissao)
      .eq("escopo_tipo", escopoTipo);
    if (error) return { ok: false, error: "Não foi possível remover." };
  } else {
    // Substituição determinística (onConflict não enxerga NULL do escopo global):
    // apaga a linha equivalente e insere a nova.
    let del = supabase
      .from("permissoes_custom")
      .delete()
      .eq("organization_id", ctx.orgId)
      .eq("user_id", input.userId)
      .eq("permissao", input.permissao)
      .eq("escopo_tipo", escopoTipo);
    del = escopoId ? del.eq("escopo_id", escopoId) : del.is("escopo_id", null);
    const { error: eDel } = await del;
    if (eDel) return { ok: false, error: "Não foi possível salvar." };
    const { error } = await supabase.from("permissoes_custom").insert({
      organization_id: ctx.orgId,
      user_id: input.userId,
      permissao: input.permissao,
      efeito: input.efeito,
      escopo_tipo: escopoTipo,
      escopo_id: escopoId,
      created_by: ctx.email,
    });
    if (error) return { ok: false, error: "Não foi possível salvar." };
  }

  await registrarLog(supabase, {
    tabela: "permissoes_custom",
    registro_id: input.userId,
    acao: "MEMBERSHIP_CHANGE",
    dados_anteriores: null,
    dados_novos: { permissao: input.permissao, efeito: input.efeito, escopo_tipo: escopoTipo, escopo_id: escopoId },
    executado_por: ctx.email,
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
