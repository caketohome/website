const fs = require("fs");
const { Client } = require("../node_modules/pg");

function getConn() {
  const path = require("path");
  if (process.env.PG_URL) return process.env.PG_URL;
  const envPath = path.join(__dirname, "../../backend/.env");
  const e = fs.readFileSync(envPath, "utf8");
  for (const l of e.split("\n")) {
    if (l.startsWith("DATABASE_URL=")) return l.substring("DATABASE_URL=".length).trim();
  }
}

async function main() {
  const c = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='branch_inventory' ORDER BY ordinal_position"
  );
  console.log("=== branch_inventory columns ===");
  console.log(JSON.stringify(r.rows, null, 2));

  const r2 = await c.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='accounting_voucher' ORDER BY ordinal_position"
  );
  console.log("=== accounting_voucher columns ===");
  console.log(JSON.stringify(r2.rows, null, 2));

  const r3 = await c.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='accounting_fiscal_period' ORDER BY ordinal_position"
  );
  console.log("=== accounting_fiscal_period columns ===");
  console.log(JSON.stringify(r3.rows, null, 2));

  await c.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
