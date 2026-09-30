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

async function inspect() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // 1. Exact counts
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM public.accounting_account)         AS accounting_account,
        (SELECT COUNT(*) FROM public.accounting_voucher)         AS accounting_voucher,
        (SELECT COUNT(*) FROM public.accounting_journal_entry)   AS accounting_journal_entry,
        (SELECT COUNT(*) FROM public.accounting_journal_line)    AS accounting_journal_line,
        (SELECT COUNT(*) FROM public.accounting_fiscal_period)   AS accounting_fiscal_period,
        (SELECT COUNT(*) FROM public."order")                    AS orders,
        (SELECT COUNT(*) FROM public.payment_transaction)        AS payment_transaction,
        (SELECT COUNT(*) FROM public.branch_inventory)           AS branch_inventory
    `);
    console.log("=== TABLE COUNTS ===");
    console.log(JSON.stringify(counts.rows[0], null, 2));

    // 2. Accounting start date
    const settingRes = await client.query(`
      SELECT key, value FROM public.setting
      WHERE key ILIKE '%accounting%' OR key ILIKE '%start_date%'
    `);
    console.log("=== ACCOUNTING START DATE SETTINGS ===");
    console.log(JSON.stringify(settingRes.rows, null, 2));

    // 3. Constraints on accounting_voucher
    const voucherConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'accounting_voucher'
      ORDER BY conname
    `);
    console.log("=== ACCOUNTING_VOUCHER CONSTRAINTS ===");
    console.log(JSON.stringify(voucherConstraints.rows, null, 2));

    // 4. Indexes on accounting_voucher
    const voucherIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'accounting_voucher'
      ORDER BY indexname
    `);
    console.log("=== ACCOUNTING_VOUCHER INDEXES ===");
    console.log(JSON.stringify(voucherIndexes.rows, null, 2));

    // 5. Triggers on accounting_voucher
    const voucherTriggers = await client.query(`
      SELECT tgname, pg_get_triggerdef(oid) AS def
      FROM pg_trigger
      WHERE tgrelid = 'public.accounting_voucher'::regclass
      ORDER BY tgname
    `);
    console.log("=== ACCOUNTING_VOUCHER TRIGGERS ===");
    console.log(JSON.stringify(voucherTriggers.rows, null, 2));

    // 6. Constraints on accounting_journal_entry and accounting_journal_line
    const journalConstraints = await client.query(`
      SELECT t.relname, conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname IN ('accounting_journal_entry', 'accounting_journal_line')
      ORDER BY t.relname, conname
    `);
    console.log("=== JOURNAL CONSTRAINTS ===");
    console.log(JSON.stringify(journalConstraints.rows, null, 2));

    // 7. Triggers on accounting_journal_line and entry
    const journalTriggers = await client.query(`
      SELECT tgrelid::regclass AS table_name, tgname, pg_get_triggerdef(oid) AS def
      FROM pg_trigger
      WHERE tgrelid IN ('public.accounting_journal_entry'::regclass, 'public.accounting_journal_line'::regclass)
      ORDER BY tgrelid::regclass::text, tgname
    `);
    console.log("=== JOURNAL TRIGGERS ===");
    console.log(JSON.stringify(journalTriggers.rows, null, 2));

    // 8. Constraints on accounting_fiscal_period
    const periodConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'accounting_fiscal_period'
      ORDER BY conname
    `);
    console.log("=== FISCAL PERIOD CONSTRAINTS ===");
    console.log(JSON.stringify(periodConstraints.rows, null, 2));

  } finally {
    await client.end();
  }
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
