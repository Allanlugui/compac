import { config } from "dotenv";
config({ path: ".env.test" });
import { afterAll, afterEach, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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
    .insert({ id, nome: `Teste ${slug} ${orgCounter}`, slug: `${slug}-${orgCounter}-${Date.now().toString(36)}` })
    .select("id").single();
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
    user_id: userId, organization_id: orgId, role: "ADMIN", status: "ativo",
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
  const testUsers = (users?.users ?? []).filter((u) => u.email?.endsWith("@sga-test.local"));
  for (const u of testUsers) {
    await ADMIN_CLIENT.auth.admin.deleteUser(u.id);
  }
  usedEmails.clear();
  usedOrgs.clear();
}

/**
 * Executa query SQL no contexto do usuário `userId` usando a RPC
 * exec_as_user (security definer, injeta JWT via set_config).
 * Se a RPC não existir, cai para query direta via admin (sem RLS).
 *
 * Para testes de isolamento, usamos a RPC com SET LOCAL para que
 * auth.uid() retorne o userId correto e o RLS filtre os dados.
 */
export async function selectComo<T = Record<string, unknown>>(
  userId: string,
  table: string,
  filters: Record<string, string> = {},
  selects = "*"
): Promise<{ data: T[]; error: string | null }> {
  try {
    let query = `SELECT ${selects} FROM public.${table} WHERE 1=1`;
    for (const [k, v] of Object.entries(filters)) {
      query += ` AND ${k} = '${v.replace(/'/g, "''")}'`;
    }
    const { data, error } = await ADMIN_CLIENT.rpc("exec_as_user", {
      p_user_id: userId,
      p_sql: query,
    });
    if (error) throw new Error(error.message);
    return { data: (data ?? []) as T[], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

const ADMIN_CLIENT = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

beforeAll(() => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.test");
  }
});

afterEach(async () => { await cleanup(); });
afterAll(async () => { await ADMIN_CLIENT.auth.signOut(); });

export { ADMIN_CLIENT };
