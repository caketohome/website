/**
 * Phase 4F Step 1 — Schema Inspection Script
 * Queries live DB for exact column definitions on all accounting tables
 * and branch_inventory, to inform repository design.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("../node_modules/pg");

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, "../../backend/.env");
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
  }
}

async function main() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = [
    "accounting_account",
    "accounting_voucher",
    "accounting_journal_entry",
    "accounting_journal_line",
    "accounting_fiscal_period",
    "branch_inventory",
    "setting",
  ];

  const result = {};
  for (const table of tables) {
    const res = await client.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    result[table] = res.rows;
  }

  // Also get constraint names
  const constraintRes = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = ANY(ARRAY[
      'public.accounting_voucher'::regclass,
      'public.accounting_journal_entry'::regclass,
      'public.accounting_journal_line'::regclass,
      'public.accounting_fiscal_period'::regclass
    ])
    ORDER BY conrelid, contype, conname
  `);
  result["constraints"] = constraintRes.rows;

  // Check indexes on accounting_voucher
  const idxRes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN (
      'accounting_voucher', 'accounting_journal_entry',
      'accounting_journal_line', 'accounting_fiscal_period'
    )
    ORDER BY tablename, indexname
  `);
  result["indexes"] = idxRes.rows;

  await client.end();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
