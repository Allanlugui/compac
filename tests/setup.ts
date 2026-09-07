import { afterAll, afterEach, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

let orgACount = 0;
let orgBCount = 0;

export interface TestOrg {
  client: SupabaseClient;
  orgId: string;
  userId: string;
  email: string;
  slug: string;
}

const usedEmails = new Set<string>();

function uniqueEmail(prefix: string): string {
  let attempt = 0;
  while (true) {
    const email = attempt === 0
      ? `${prefix}@sga-test.local`
      : `${prefix}+${attempt}@sga-test.local`;
    if (!usedEmails.has(email)) {
      usedEmails.add(email);
      return email;
    }
    attempt++;
  }
}

export async function criarOrganizacaoTeste(slug: string): Promise<string> {
  orgACount++;
  const nome = `Teste ${slug} ${orgACount}`;
  const id = crypto.randomUUID();
  const { error } = await ADMIN_CLIENT
    .from("organizations")
    .insert({ id, nome, slug, ativo: true })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar org: ${error.message}`);
  return id;
}

export async function criarUsuarioTeste(orgId: string): Promise<{ userId: string; email: string }> {
  const email = uniqueEmail(`user-${orgId.slice(0, 8)}`);
  const { data, error } = await ADMIN_CLIENT.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: `Teste ${email}` },
  });
  if (error || !data.user) throw new Error(`Falha ao criar usuário: ${error?.message}`);
  return { userId: data.user.id, email };
}

export async function adicionarMembro(
  userId: string,
  orgId: string,
  role: "ADMIN" | "GESTOR" | "TECNICO" | "SOLICITANTE" = "ADMIN"
) {
  const { error } = await ADMIN_CLIENT
    .from("memberships")
    .insert({ user_id: userId, organization_id: orgId, role, status: "ativo" });
  if (error) throw new Error(`Falha ao adicionar membro: ${error.message}`);
}

export async function criarAtivo(orgId: string, nome: string): Promise<string> {
  const { data, error } = await ADMIN_CLIENT
    .from("ativos")
    .insert({ organization_id: orgId, nome, status: "operacional", tipo: "equipamento" })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar ativo: ${error.message}`);
  return data.id;
}

export async function criarChamado(orgId: string, ativoId: string, solicitante: string): Promise<string> {
  const { data, error } = await ADMIN_CLIENT
    .from("chamados")
    .insert({
      organization_id: orgId,
      ativo_id: ativoId,
      solicitante,
      descricao: "Teste de isolamento RLS",
      origem: "administrador",
      prioridade: "media",
      status: "aberto",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar chamado: ${error.message}`);
  return data.id;
}

export async function criarProduto(orgId: string, codigo: string): Promise<string> {
  const { data, error } = await ADMIN_CLIENT
    .from("produtos")
    .insert({ organization_id: orgId, codigo, descricao: `Produto ${codigo}`, estoque_atual: 100 })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar produto: ${error.message}`);
  return data.id;
}

export async function consumirEstoque(
  orgId: string,
  userId: string,
  produtoId: string,
  chamadoId: string,
  quantidade: number
): Promise<string> {
  const { data, error } = await ADMIN_CLIENT
    .from("movimentacoes_estoque")
    .insert({
      organization_id: orgId,
      produto_id: produtoId,
      chamado_id: chamadoId,
      user_id: userId,
      tipo: "consumo",
      quantidade,
      custo_unitario: 10,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao consumir estoque: ${error.message}`);
  return data.id;
}

export async function criarFornecedor(orgId: string, nome: string): Promise<string> {
  const { data, error } = await ADMIN_CLIENT
    .from("fornecedores")
    .insert({ organization_id: orgId, nome })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar fornecedor: ${error.message}`);
  return data.id;
}

export async function criarCompra(
  orgId: string,
  chamadoId: string,
  item: string
): Promise<string> {
  const { data, error } = await ADMIN_CLIENT
    .from("compras")
    .insert({
      organization_id: orgId,
      chamado_id: chamadoId,
      item,
      quantidade: 1,
      valor_unitario: 50,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar compra: ${error.message}`);
  return data.id;
}

export async function limparDadosTeste() {
  const allOrgIds = [...usedOrgs];
  for (const orgId of allOrgIds) {
    await ADMIN_CLIENT.from("movimentacoes_estoque").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("compras").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_atividades").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_servicos_externos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_fotos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("os_status_historico").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("auditoria_logs").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("chamados").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("ativos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("produtos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("fornecedores").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("checklist_execucoes").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("checklist_respostas").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("checklist_modelos").delete().eq("organization_id", orgId);
    await ADMIN_CLIENT.from("memberships").delete().eq("organization_id", orgId);
  }
  for (const orgId of allOrgIds) {
    await ADMIN_CLIENT.from("organizations").delete().eq("id", orgId);
  }
  const { data: users } = await ADMIN_CLIENT.auth.admin.listUsers();
  const testUsers = (users?.users ?? []).filter((u) =>
    u.email?.endsWith("@sga-test.local")
  );
  for (const u of testUsers) {
    await ADMIN_CLIENT.auth.admin.deleteUser(u.id);
  }
  usedEmails.clear();
  usedOrgs.clear();
}

const usedOrgs = new Set<string>();

export async function setupOrg(nome: string): Promise<TestOrg> {
  const orgId = await criarOrganizacaoTeste(nome);
  usedOrgs.add(orgId);
  const { userId, email } = await criarUsuarioTeste(orgId);
  await adicionarMembro(userId, orgId, "ADMIN");

  const { data: sessionData } = await ADMIN_CLIENT.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  return {
    client: createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${sessionData?.properties?.href ?? ""}` } },
    }),
    orgId,
    userId,
    email,
    slug: nome,
  };
}

const ADMIN_CLIENT = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

beforeAll(() => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.test"
    );
  }
});

afterEach(async () => {
  await limparDadosTeste();
});

afterAll(async () => {
  await ADMIN_CLIENT.auth.signOut();
});
