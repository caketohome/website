const fs = require("fs");
const path = require("path");
const { Client } = require("../node_modules/pg");

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, "../../backend/.env");
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    if (line.startsWith("DATABASE_URL=")) {
      return line.substring("DATABASE_URL=".length).trim();
    }
  }
  throw new Error("No database connection string found.");
}

async function inspectReversalSchema() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // 1. Column info for accounting_voucher
    const voucherCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_voucher'
      ORDER BY ordinal_position;
    `);
    console.log("=== VOUCHER COLUMNS ===");
    console.log(JSON.stringify(voucherCols.rows, null, 2));

    // 2. Column info for accounting_journal_entry
    const journalCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_journal_entry'
      ORDER BY ordinal_position;
    `);
    console.log("=== JOURNAL ENTRY COLUMNS ===");
    console.log(JSON.stringify(journalCols.rows, null, 2));

    // 3. Constraints on accounting_voucher related to reversal / status / immutability
    const voucherConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'accounting_voucher'
      ORDER BY conname;
    `);
    console.log("=== VOUCHER CONSTRAINTS ===");
    console.log(JSON.stringify(voucherConstraints.rows, null, 2));

    // 4. Constraints on accounting_journal_entry
    const journalConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'accounting_journal_entry'
      ORDER BY conname;
    `);
    console.log("=== JOURNAL CONSTRAINTS ===");
    console.log(JSON.stringify(journalConstraints.rows, null, 2));

  } finally {
    await client.end();
  }
}

inspectReversalSchema().catch(err => {
  console.error(err);
  process.exit(1);
});
