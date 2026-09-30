/**
 * Phase 4F Step 1 — Independent DB Verification Script
 * Verifies that ALL accounting table counts remain at their mandated values
 * after implementing the Phase 4F Step 1 repositories.
 *
 * Expected invariants:
 *   accounting_account         = 98  (24 groups, 74 posting leaves)
 *   accounting_voucher         = 0
 *   accounting_journal_entry   = 0
 *   accounting_journal_line    = 0
 *   accounting_fiscal_period   = 0
 *   orders                     = 173
 *   payment_transaction        = 53
 *   branch_inventory           = 424
 *   accounting_start_date      = UNCONFIGURED
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
    if (line.startsWith("DATABASE_URL=")) {
      return line.substring("DATABASE_URL=".length).trim();
    }
  }
  throw new Error("No database connection string found.");
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const result = {};
  const failures = [];

  try {
    // Count all accounting tables
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
    const c = counts.rows[0];
    result.counts = {
      accounting_account:       parseInt(c.accounting_account),
      accounting_voucher:       parseInt(c.accounting_voucher),
      accounting_journal_entry: parseInt(c.accounting_journal_entry),
      accounting_journal_line:  parseInt(c.accounting_journal_line),
      accounting_fiscal_period: parseInt(c.accounting_fiscal_period),
      orders:                   parseInt(c.orders),
      payment_transaction:      parseInt(c.payment_transaction),
      branch_inventory:         parseInt(c.branch_inventory),
    };

    // Group/leaf split
    const groupRes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_group = true)  AS group_count,
        COUNT(*) FILTER (WHERE is_group = false) AS posting_count
      FROM public.accounting_account
      WHERE deleted_at IS NULL
    `);
    result.account_split = {
      group_count:   parseInt(groupRes.rows[0].group_count),
      posting_count: parseInt(groupRes.rows[0].posting_count),
    };

    // Accounting start date check
    const startDateRes = await client.query(`
      SELECT value FROM public.setting
      WHERE key = 'accounting_start_date' AND deleted_at IS NULL
      LIMIT 1
    `);
    result.accounting_start_date_configured = startDateRes.rows.length > 0;
    result.accounting_start_date_value = startDateRes.rows[0]?.value ?? null;

    // Branch_inventory cost column check (important design note)
    const biColRes = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='branch_inventory'
      ORDER BY ordinal_position
    `);
    result.branch_inventory_columns = biColRes.rows.map(r => r.column_name);
    result.branch_inventory_has_cost_column = biColRes.rows.some(
      r => r.column_name === 'unit_cost' || r.column_name === 'avg_cost' || r.column_name === 'mwa_cost'
    );

    // Assertions
    const expected = {
      accounting_account:       98,
      accounting_voucher:       0,
      accounting_journal_entry: 0,
      accounting_journal_line:  0,
      accounting_fiscal_period: 0,
      orders:                   173,
      payment_transaction:      53,
      branch_inventory:         424,
    };

    result.assertions = {};
    for (const [key, expectedVal] of Object.entries(expected)) {
      const actual = result.counts[key];
      const pass = actual === expectedVal;
      result.assertions[`${key}_is_${expectedVal}`] = pass;
      if (!pass) {
        failures.push(`FAIL: ${key} expected ${expectedVal}, got ${actual}`);
      }
    }

    result.assertions.group_count_is_24       = result.account_split.group_count === 24;
    result.assertions.posting_count_is_74     = result.account_split.posting_count === 74;
    result.assertions.accounting_start_date_unconfigured = !result.accounting_start_date_configured;
    result.assertions.branch_inventory_has_NO_cost_column = !result.branch_inventory_has_cost_column;

    if (result.account_split.group_count !== 24)    failures.push("FAIL: group_count expected 24, got " + result.account_split.group_count);
    if (result.account_split.posting_count !== 74)  failures.push("FAIL: posting_count expected 74, got " + result.account_split.posting_count);
    if (result.accounting_start_date_configured)    failures.push("FAIL: accounting_start_date should be UNCONFIGURED");
    if (result.branch_inventory_has_cost_column)    failures.push("FAIL: branch_inventory unexpectedly has a cost column — update the design");

  } finally {
    await client.end();
  }

  result.failures = failures;
  result.all_pass = failures.length === 0;

  console.log(JSON.stringify(result, null, 2));

  if (!result.all_pass) {
    console.error("\nFAILURES:");
    failures.forEach(f => console.error(" ", f));
    process.exit(1);
  } else {
    console.log("\nALL ASSERTIONS PASS — Phase 4F Step 1 DB state verified.");
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
