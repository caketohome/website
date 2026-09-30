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

async function inspectTop() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
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
    console.log("TABLE_COUNTS:", JSON.stringify(counts.rows[0]));

    const settingRes = await client.query(`
      SELECT key, value FROM public.setting
      WHERE key = 'accounting_start_date'
    `);
    console.log("START_DATE_SETTING:", JSON.stringify(settingRes.rows));

    const voucherConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'accounting_voucher'
      ORDER BY conname
    `);
    console.log("VOUCHER_CONSTRAINTS:", JSON.stringify(voucherConstraints.rows, null, 2));

    const voucherIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'accounting_voucher'
      ORDER BY indexname
    `);
    console.log("VOUCHER_INDEXES:", JSON.stringify(voucherIndexes.rows, null, 2));

    const voucherTriggers = await client.query(`
      SELECT tgname, pg_get_triggerdef(oid) AS def
      FROM pg_trigger
      WHERE tgrelid = 'public.accounting_voucher'::regclass
      ORDER BY tgname
    `);
    console.log("VOUCHER_TRIGGERS:", JSON.stringify(voucherTriggers.rows, null, 2));

  } finally {
    await client.end();
  }
}

inspectTop().catch(err => {
  console.error(err);
  process.exit(1);
});
