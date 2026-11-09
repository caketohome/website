const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const envPath = path.join(__dirname, "../.env");
const lines = fs.readFileSync(envPath, "utf8").split("\n");
let connStr = "";
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    let val = trimmed.substring("DATABASE_URL=".length).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    connStr = val;
    break;
  }
}

const pool = new Pool({ connectionString: connStr });

async function check() {
  const cats = await pool.query("SELECT * FROM product_category WHERE deleted_at IS NULL ORDER BY name");
  console.log("Product categories in DB (" + cats.rows.length + "):");
  for (const c of cats.rows) {
    console.log(`  - [${c.id}] ${c.name} (${c.handle})`);
  }

  const vouchers = await pool.query("SELECT id, voucher_no, voucher_type, status, total_amount, reference_type, reference_id FROM accounting_voucher");
  console.log("Existing vouchers:", vouchers.rows);

  const jLines = await pool.query(`
    SELECT jl.id, jl.account_id, a.code, a.name, jl.debit_amount, jl.credit_amount 
    FROM accounting_journal_line jl 
    JOIN accounting_account a ON a.id = jl.account_id
  `);
  console.log("Existing Journal Lines (" + jLines.rows.length + "):");
  for (const l of jLines.rows) {
    console.log(`  - [${l.code}] ${l.name}: Dr ₹${l.debit_amount} / Cr ₹${l.credit_amount}`);
  }

  await pool.end();
}

check().catch(e => {
  console.error("DB error:", e.message);
  process.exit(1);
});


check().catch(e => {
  console.error("DB error:", e.message);
  process.exit(1);
});
