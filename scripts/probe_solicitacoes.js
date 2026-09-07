require("dotenv").config({ path: ".env.test" });
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const r = await admin.from("solicitacoes_compra").select("status").limit(500);
  if (r.error) return console.log("ERR:", r.error);
  const counts = {};
  for (const row of r.data) counts[row.status] = (counts[row.status] || 0) + 1;
  const allowed = new Set(["rascunho","enviada","em_analise","aprovada","rejeitada","em_cotacao","pedido_gerado","recebida","encerrada","cancelada","pendente","aprovado","rejeitado","comprado"]);
  const bad = Object.entries(counts).filter(([k]) => !allowed.has(k));
  console.log("Status counts:", JSON.stringify(counts));
  console.log("INVALIDOS:", bad.length ? bad : "nenhum");
  console.log("Total:", r.data.length);
}
main().catch(console.error);
