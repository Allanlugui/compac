require("dotenv").config({ path: ".env.test" });
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const tables = ["solicitacoes_compra","cotacoes","pedidos_compra","recebimentos","recebimento_itens","checklist_modelos","checklist_itens","checklist_execucoes","checklist_respostas","planos_manutencao","produtos","ativos","chamados","fornecedores","organizations","profiles","memberships","auditoria_logs","movimentacoes_estoque","compras"];
  for (const t of tables) {
    const r = await admin.from(t).select("id").limit(0);
    console.log(t.padEnd(30), r.error ? "NAO existe" : "existe");
  }
}
main().catch(console.error);
