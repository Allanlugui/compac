import { config } from "dotenv";
config({ path: ".env.test" });
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export interface TestOrg {
  admin: SupabaseClient;
  orgId: string;
  userId: string;
  email: string;
  slug: string;
}

const usedEmails = new Set<string>();
const usedOrgs = new Set<string>();
let orgCounter = 0;

function uniqueEmail(prefix: string): string {
  let attempt = 0;
  while (true) {
    const email =
      attempt === 0
        ? `${prefix}@sga-test.local`
        : `${prefix}+${attempt}@sga-test.local`;
    if (!usedEmails.has(email)) { usedEmails.add(email); return email; }
    attempt++;
  }
}

async function criarOrganizacao(slug: string): Promise<string> {
  orgCounter++;
  const id = crypto.randomUUID();
  const { error } = await ADMIN_CLIENT.from("organizations")
    .insert({
      id,
      nome: `Teste ${slug} ${orgCounter}`,
      slug: `${slug}-${orgCounter}-${Date.now().toString(36)}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(`criarOrganizacao: ${error.message}`);
  usedOrgs.add(id);
  return id;
}

async function criarUsuario(email: string): Promise<string> {
  const { data, error } = await ADMIN_CLIENT.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: `Teste ${email}` },
  });
  if (error || !data.user) throw new Error(`criarUsuario: ${error?.message}`);
  return data.user.id;
}

async function criarPerfil(userId: string, email: string): Promise<void> {
  const { error } = await ADMIN_CLIENT.from("profiles").upsert({
    id: userId,
    email,
    nome: `Teste ${email}`,
  });
  if (error) throw new Error(`criarPerfil: ${error.message}`);
}

async function criarMembership(userId: string, orgId: string) {
  const { error } = await ADMIN_CLIENT.from("memberships").insert({
    user_id: userId,
    organization_id: orgId,
    role: "ADMIN",
    status: "ativo",
  });
  if (error) throw new Error(`criarMembership: ${error.message}`);
}

export async function setupOrg(slug: string): Promise<TestOrg> {
  const orgId = await criarOrganizacao(slug);
  const email = uniqueEmail(`user-${orgId.slice(0, 6)}`);
  const userId = await criarUsuario(email);
  await criarPerfil(userId, email);
  await criarMembership(userId, orgId);
  return { admin: ADMIN_CLIENT, orgId, userId, email, slug };
}

export async function cleanup(): Promise<void> {
  for (const orgId of usedOrgs) {
    await ADMIN_CLIENT.from("movimentacoes_estoque").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("compras").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_atividades").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_servicos_externos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_fotos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_status_historico").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("checklist_respostas").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("checklist_execucoes").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("checklist_modelos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("auditoria_logs").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("chamados").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("ativos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("produtos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("fornecedores").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("memberships").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("organizations").delete().eq("id", orgId);
  }
  const { data: users } = await ADMIN_CLIENT.auth.admin.listUsers({ perPage: 1000 });
  const testUsers = (users?.users ?? []).filter((u) =>
    u.email?.endsWith("@sga-test.local"),
  );
  for (const u of testUsers) {
    await ADMIN_CLIENT.auth.admin.deleteUser(u.id);
  }
  usedEmails.clear();
  usedOrgs.clear();
}

/**
 * SELECT via RPC exec_as_user. Erros são propagados.
 * Se RLS bloqueou → 0 linhas (sucesso do teste).
 * Se RPC falhou → exceção (infraestrutura).
 */
export async function selectComo<T = Record<string, unknown>>(
  userId: string,
  table: string,
  filters: Record<string, string> = {},
  selects = "*",
): Promise<{ data: T[]; rowsAffected: number }> {
  const conditions = Object.entries(filters)
    .map(([k, v]) => ` AND ${k} = '${v.replace(/'/g, "''")}'`)
    .join("");
  const query = `SELECT ${selects} FROM public.${table} WHERE 1=1${conditions}`;
  const { data, error } = await ADMIN_CLIENT.rpc("exec_as_user", {
    p_user_id: userId,
    p_sql: query,
  });
  if (error) {
    throw new Error(`selectComo(${table}) falhou: ${error.message}`);
  }
  return { data: (data ?? []) as T[], rowsAffected: (data ?? []).length };
}

/**
 * INSERT/UPDATE/DELETE/EXISTS via RPC exec_as_user. Erros são propagados.
 * Se RLS/trigger bloqueou → exceção (sinal de SUCESSO do teste cross-tenant).
 * Se RPC falhou → exceção (infraestrutura).
 */
export async function executeComo(
  _userId: string,
  sql: string,
): Promise<{ ok: true; rowsAffected: number }> {
  // Para INSERT/UPDATE/DELETE, é mais seguro chamar com EXECUTE e checar via SELECT depois.
  const { data, error } = await ADMIN_CLIENT.rpc("exec_as_user", {
    p_user_id: _userId,
    p_sql: sql,
  });
  if (error) {
    throw new Error(`executeComo falhou: ${error.message}`);
  }
  return { ok: true, rowsAffected: (data ?? []).length };
}

/** Cliente anon (não autenticado). */
export const ANON_CLIENT = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_CLIENT = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export { ADMIN_CLIENT };
