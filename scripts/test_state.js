require("dotenv").config({ path: ".env.test" });
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function applySQL(sql) {
  // O Supabase JS não permite executar SQL arbitrário diretamente.
  // Esta funcao simula a aplicacao via pg* RPC se disponivel, ou
  // tenta usar a interface REST.
  // Para o teste real, o usuario precisa colar no SQL Editor do Supabase.
  console.log("[SQL Editor] Execute este SQL manualmente:");
  console.log("---");
  console.log(sql.substring(0, 200) + "...");
  console.log("---");
}

async function testExecAsUser() {
  // Testa se a funcao atualizada funciona
  const r = await admin.rpc("exec_as_user", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_sql: "SELECT 1 as test_version_15"
  });
  if (r.error) {
    console.log("exec_as_user (admin): FALHOU -", r.error.message.split("\n")[0]);
  } else {
    console.log("exec_as_user (admin): OK", r.data);
  }
  return !r.error;
}

async function testConstraint() {
  // Testa constraint com OS_CREATED
  const id = crypto.randomUUID();
  const slug = "test-" + id.slice(0,8);

  await admin.from("organizations").insert({ id, nome: "Test", slug });

  const { data: ativo } = await admin.from("ativos").insert({
    organization_id: id, nome: "A", status: "operacional",
    // nao inclui tipo se nao existir
  }).select("id").single().catch(()=>({data:null}));

  const orgId2 = ativo ? id : null;
  const regId = ativo ? ativo.id : id;

  const r1 = await admin.from("auditoria_logs").insert({
    organization_id: id,
    tabela: "test",
    registro_id: regId,
    acao: "TRIAGEM",
  });
  console.log("INSERT TRIAGEM:", r1.error ? "FALHOU: " + r1.error.message.split(".")[0] : "OK");

  const r2 = await admin.from("auditoria_logs").insert({
    organization_id: id,
    tabela: "test",
    registro_id: regId,
    acao: "OS_CREATED",
  });
  console.log("INSERT OS_CREATED:", r2.error ? "FALHOU: " + r2.error.message.split(".")[0] : "OK");

  const r3 = await admin.from("auditoria_logs").insert({
    organization_id: id,
    tabela: "test",
    registro_id: regId,
    acao: "ACAO_INVALIDA_XYZ",
  });
  console.log("INSERT INVALIDA:", r3.error ? "CORRETAMENTE NEGADO" : "BUG - ACEITA INVALIDA");

  if (orgId2) {
    await admin.from("auditoria_logs").delete().eq("organization_id", id);
    await admin.from("organizations").delete().eq("id", id);
  }
}

async function main() {
  console.log("=== Teste de estado do banco ===\n");

  await testConstraint();
  console.log("");
  await testExecAsUser();
}

main().catch(console.error);
