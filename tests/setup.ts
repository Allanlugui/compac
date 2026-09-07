import { config } from "dotenv";
config({ path: ".env.test" });
import { SignJWT } from "jose";
import { afterAll, afterEach, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "";

export interface TestOrg {
  /** Cliente service_role — usado para criar dados no nome da org. */
  admin: SupabaseClient;
  /** ID da organização. */
  orgId: string;
  /** UUID do usuário criado em auth.users. */
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
    if (!usedEmails.has(email)) {
      usedEmails.add(email);
      return email;
    }
    attempt++;
  }
}

async function criarOrganizacao(slug: string): Promise<string> {
  orgCounter++;
  const id = crypto.randomUUID();
  const uniqueSlug = `${slug}-${orgCounter}-${Date.now().toString(36)}`;
  const { error } = await ADMIN_CLIENT.from("organizations")
    .insert({ id, nome: `Teste ${slug} ${orgCounter}`, slug: uniqueSlug })
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
  await criarMembership(userId, orgId);
  return { admin: ADMIN_CLIENT, orgId, userId, email, slug };
}

/**
 * Cria um cliente autenticado como `userId` gerando JWT real via Supabase JWT_SECRET.
 */
export async function clienteComo(userId: string): Promise<SupabaseClient> {
  if (!JWT_SECRET) throw new Error("SUPABASE_JWT_SECRET não definido no .env.test");
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({ role: "authenticated", sub: userId, aud: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
  return createClient(SUPABASE_URL, token, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function limparTudo() {
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

const ADMIN_CLIENT = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

beforeAll(() => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.test",
    );
  }
  if (!JWT_SECRET) {
    console.warn("[setup] SUPABASE_JWT_SECRET não definido — testes RLS podem não funcionar.");
  }
});

afterEach(async () => {
  await limparTudo();
});

afterAll(async () => {
  await ADMIN_CLIENT.auth.signOut();
});

export { ADMIN_CLIENT };
