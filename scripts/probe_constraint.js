require("dotenv").config({ path: ".env.test" });
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const r = await admin.from("ativos").select("id, nome, status, organization_id, categoria_id, fornecedor_id, localidade_id, created_at").limit(0);
  if (r.error) return console.log("ERR:", r.error);
  console.log("OK (campos conhecidos)");
  // tentar colunas do v6
  const tries = ["tipo","data_aquisicao","numero_serie","patrimonio","modelo","marca","qr_code","qr_hash","qr_impresso_em","responsavel","descricao","valor_aquisicao","horimetro"];
  for (const c of tries) {
    const rr = await admin.from("ativos").select(c).limit(0);
    if (rr.error) console.log("  ", c.padEnd(20), "MISSING");
    else console.log("  ", c.padEnd(20), "OK");
  }
}
main().catch(console.error);
