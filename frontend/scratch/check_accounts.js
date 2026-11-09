const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function getConnectionString() {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        let val = trimmed.substring("DATABASE_URL=".length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

const pool = new Pool({ connectionString: getConnectionString() });

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, code, name, type, is_group
      FROM "accounting_account"
      WHERE code LIKE '21%' OR code LIKE '5%' OR code LIKE '11%' OR code LIKE '4%'
      ORDER BY code;
    `);
    console.log("Found", rows.length, "accounts:");
    for (const r of rows) {
      console.log(`- ${r.code}: ${r.name} (${r.type}, group=${r.is_group}) [id: ${r.id}]`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
