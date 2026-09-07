require("dotenv").config({ path: ".env.test" });
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // testa colunas que distinguem v2-v6
  const checks = [
    // v2+
    ["ativos","tipo"],
    ["ativos","qr_hash"],
    ["ativos","numero_serie"],
    ["produtos","codigo"],
    ["produtos","categoria"],
    // v4+
    ["chamados","prioridade"],
    ["ativos","fornecedor_id"],
    ["memberships","role"],
    // v6+
    ["ativos","marca"],
    ["ativos","responsavel"],
    ["chamados","origem"],
    ["chamados","categoria"],
    ["produtos","estoque_reservado"],
    ["chamados","os_tipo"],
    // tables
    ["planos_manutencao"],
    ["os_atividades"],
    ["os_status_historico"],
    ["os_servicos_externos"],
    ["os_fotos"],
    ["checklist_execucoes","snapshot"],
  ];

  let maxVersion = 0;
  const versionChecks = {
    1: [],
    2: [["ativos","tipo"],["ativos","numero_serie"]],
    4: [["ativos","qr_hash"],["chamados","prioridade"],["memberships","role"]],
    6: [["ativos","marca"],["ativos","responsavel"],["produtos","estoque_reservado"]],
    8: [["chamados","origem"]],
    10: [["chamados","os_tipo"],["chamados","os_status"]],
    12: [],
    13: [],
    14: [],
    15: [],
  };

  for (const [tbl, col] of checks) {
    if (col) {
      const r = await admin.from(tbl).select(col).limit(0);
      if (r.error) {
        // table might not exist
        const r2 = await admin.from(tbl).select("*").limit(0);
        if (r2.error) continue;
      }
    }
  }

  // Simple probe: count which schema items exist
  const items = [
    {v:2, tbl:"ativos", col:"tipo"},
    {v:2, tbl:"produtos", col:"codigo"},
    {v:4, tbl:"chamados", col:"prioridade"},
    {v:4, tbl:"memberships", col:"role"},
    {v:6, tbl:"ativos", col:"marca"},
    {v:6, tbl:"ativos", col:"responsavel"},
    {v:6, tbl:"produtos", col:"estoque_reservado"},
    {v:8, tbl:"chamados", col:"origem"},
    {v:8, tbl:"ativos", col:"qr_code"},
    {v:10, tbl:"chamados", col:"os_tipo"},
    {v:10, tbl:"chamados", col:"os_status"},
    {v:12, tbl:"checklist_execucoes", col:"snapshot"},
    {v:14, tbl:"os_atividades", col:"id"},
  ];

  for (const item of items) {
    const r = await admin.from(item.tbl).select(item.col).limit(0);
    const exists = !r.error;
    if (exists && item.v > maxVersion) maxVersion = item.v;
  }

  console.log("Colunas existentes:");
  for (const item of items) {
    const r = await admin.from(item.tbl).select(item.col).limit(0);
    const exists = !r.error;
    console.log("  v" + item.v + " | " + item.tbl + "." + item.col + ":", exists ? "OK" : "MISSING");
  }
  console.log("\nVersao estimada do banco: v" + maxVersion);
}
main().catch(console.error);
