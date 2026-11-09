const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function getConnectionString() {
  const envPath = path.join(__dirname, "../.env");
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("DATABASE_URL=")) {
      let val = line.trim().substring("DATABASE_URL=".length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      return val;
    }
  }
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, voucher_no, voucher_type, status, created_by, approved_by, created_at
      FROM "accounting_voucher"
      ORDER BY created_at DESC;
    `);
    console.log("Vouchers in database (" + rows.length + "):");
    for (const r of rows) {
      console.log(`- ${r.id} | ${r.voucher_no} | ${r.voucher_type} | ${r.status} | Created: ${r.created_at}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
