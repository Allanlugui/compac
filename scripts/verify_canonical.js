require("dotenv").config({ path: ".env.test" });
const canonical = new Set([
  "INSERT","UPDATE","DELETE","STATUS_CHANGE",
  "LOGIN","LOGOUT",
  "APPROVAL","REJECTION",
  "STOCK_ENTRY","STOCK_EXIT","STOCK_ADJUSTMENT",
  "STOCK_RESERVED","STOCK_RELEASED","STOCK_CONSUMED","STOCK_TRANSFERRED",
  "MEMBERSHIP_CHANGE","ROLE_CHANGE",
  "QR_REGENERATED",
  "TRIAGEM",
  "OS_CREATED","OS_CONCLUIDA",
  "CHECKLIST_CONCLUIDA",
  "FOTO_ADICIONADA",
  "COST_ADDED",
  "REQUEST_CREATED","REQUEST_APPROVED","REQUEST_REJECTED",
  "QUOTE_CREATED","ORDER_CREATED","ORDER_APPROVED",
  "RECEIPT_CREATED","RECEIPT_ACCEPTED","RECEIPT_REJECTED",
]);

const files = ["schema_v8.sql","schema_v10.sql","schema_v11.sql","schema_v14.sql"];
for (const f of files) {
  const fs = require("fs");
  const sql = fs.readFileSync(f, "utf8");
  const matches = sql.match(/check \(acao in \(([^)]+)\)/);
  if (!matches) {
    console.log(f.padEnd(15), "SEM constraint de acao");
    continue;
  }
  const list = [...matches[1].matchAll(/'([A-Z_]+)'/g)].map(m => m[1]);
  const missing = [...canonical].filter(a => !list.includes(a));
  const extra = list.filter(a => !canonical.has(a));
  console.log(f.padEnd(15), "ok:", list.length, "faltam:", missing.length, "extras:", extra.length);
  if (missing.length) console.log("  faltando:", missing);
  if (extra.length) console.log("  extras:", extra);
}
console.log("\ncanonica tem:", canonical.size, "acoes");
