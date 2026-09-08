import { config } from "dotenv";
config({ path: ".env.test" });
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

export interface TestOrg {
  admin: SupabaseClient;
  client: SupabaseClient;
  orgId: string;
  userId: string;
  email: string;
  slug: string;
}

const usedEmails = new Set<string>();
const usedOrgs = new Set<string>();
let orgCounter = 0;
const userClients = new Map<string, SupabaseClient>();

async function createJwtClient(userId: string): Promise<SupabaseClient> {
  if (userClients.has(userId)) return userClients.get(userId)!;
  const secret = new TextEncoder().encode(JWT_SECRET);
  const jwt = await new SignJWT({ role: "authenticated", aud: "authenticated", ref: "ialjfeltqpbgrxtymfwa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("https://ialjfeltqpbgrxtymfwa.supabase.co/auth/v1")
    .setSubject(userId)
    .setExpirationTime("2h")
    .setIssuedAt()
    .sign(secret);
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  userClients.set(userId, client);
  return client;
}

function uniqueEmail(prefix: string): string {
  const suffix = crypto.randomUUID().slice(0, 8);
  let attempt = 0;
  while (true) {
    const email =
      attempt === 0
        ? `${prefix}-${suffix}@sga-test.local`
        : `${prefix}-${suffix}+${attempt}@sga-test.local`;
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
  const r1 = await ADMIN_CLIENT.from("profiles").upsert({
    id: userId,
    email,
    nome: `Teste ${email}`,
  });
  if (!r1.error) return;
  if (r1.error.message.includes("email")) {
    const r2 = await ADMIN_CLIENT.from("profiles").upsert({
      id: userId,
      nome: `Teste ${email}`,
    });
    if (!r2.error) return;
    throw new Error(`criarPerfil fallback: ${r2.error.message}`);
  }
  throw new Error(`criarPerfil: ${r1.error.message}`);
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
  // Small delay to avoid auth rate limiting
  await new Promise((r) => setTimeout(r, 300));
  const userId = await criarUsuario(email);
  await criarPerfil(userId, email);
  await criarMembership(userId, orgId);
  const client = await createJwtClient(userId);
  return { admin: ADMIN_CLIENT, client, orgId, userId, email, slug };
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
  userClients.clear();
}

/**
 * SELECT via JWT client (RLS enforced as that user).
 */
export async function selectComo<T = Record<string, unknown>>(
  userId: string,
  table: string,
  filters: Record<string, string> = {},
  selects = "*",
): Promise<{ data: T[]; rowsAffected: number }> {
  const client = await createJwtClient(userId);
  let q = client.from(table).select(selects);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q;
  if (error) throw new Error(`selectComo(${table}) falhou: ${error.message}`);
  return { data: (data ?? []) as T[], rowsAffected: (data ?? []).length };
}

/**
 * UPDATE via JWT client. Retorna quantidade de linhas afetadas (RLS filtra).
 */
export async function updateComo(
  userId: string,
  table: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<{ rowsAffected: number }> {
  const client = await createJwtClient(userId);
  const { data, error } = await client.from(table).update(updates).eq("id", id).select("id");
  if (error) throw new Error(`updateComo(${table}) falhou: ${error.message}`);
  return { rowsAffected: (data ?? []).length };
}

/**
 * DELETE via JWT client.
 */
export async function deleteComo(
  userId: string,
  table: string,
  id: string,
): Promise<{ rowsAffected: number }> {
  const client = await createJwtClient(userId);
  const { data, error } = await client.from(table).delete().eq("id", id).select("id");
  if (error) throw new Error(`deleteComo(${table}) falhou: ${error.message}`);
  return { rowsAffected: (data ?? []).length };
}

/**
 * Legacy: executeComo via RPC (para testes de privilégio, não RLS).
 */
export async function executeComo(
  _userId: string,
  sql: string,
): Promise<{ ok: true; rowsAffected: number }> {
  const { data, error } = await ADMIN_CLIENT.rpc("exec_as_user", {
    p_user_id: _userId,
    p_sql: sql,
  });
  if (error) throw new Error(`executeComo falhou: ${error.message}`);
  const arr = Array.isArray(data) ? (data as unknown[]) : [];
  return { ok: true, rowsAffected: arr.length };
}

/** Cliente anon (não autenticado). */
export const ANON_CLIENT = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_CLIENT = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export { ADMIN_CLIENT };
