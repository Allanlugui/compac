import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function main() {
  const fns = ["eh_membro","tem_papel","enforce_same_org","criar_os_a_partir_de_triagem","exec_as_user","consumir_estoque","transferir_estoque","reajustar_estoque"];
  for (const fn of fns) {
    const { data, error } = await admin.rpc(fn, { x: null });
    if (error) {
      console.log("fn:" + fn.padEnd(35) + error.message.split("\n")[0].substring(0,70));
    } else {
      console.log("fn:" + fn.padEnd(35) + "EXISTS");
    }
  }

  console.log("\n--- RPC access tests ---");
  const r1 = await admin.rpc("exec_as_user", { p_user_id: "00000000-0000-0000-0000-000000000000", p_sql: "SELECT 1 as ok" });
  console.log("admin.exec_as_user:", r1.error ? "ERR: " + r1.error.message.split("\n")[0].substring(0,60) : "OK", r1.data);

  const r2 = await anon.rpc("exec_as_user", { p_user_id: "00000000-0000-0000-0000-000000000000", p_sql: "SELECT 1" });
  console.log("anon.exec_as_user:", r2.error ? "NEGADO: " + r2.error.message.split("\n")[0].substring(0,50) : "ALLOW (INSECURE!)");

  const r3 = await admin.from("auditoria_logs").select("acao").limit(0);
  console.log("auditoria_logs accessible:", r3.error ? "ERR: " + r3.error.message.split(".")[0] : "OK");
}

main().catch(console.error);
