const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const connStr = match ? match[1] : process.env.DATABASE_URL;

const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();

  const baselineRes = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.accounting_account WHERE deleted_at IS NULL) AS accounting_account,
      (SELECT COUNT(*)::int FROM public.gateway_payout_batch) AS gateway_payout_batch,
      (SELECT COUNT(*)::int FROM public.gateway_settlement_order) AS gateway_settlement_order,
      (SELECT COUNT(*)::int FROM public.bank_account) AS bank_account,
      (SELECT COUNT(*)::int FROM public.bank_deposit_slip) AS bank_deposit_slip,
      (SELECT COUNT(*)::int FROM public.bank_statement_import) AS bank_statement_import,
      (SELECT COUNT(*)::int FROM public.bank_statement_line) AS bank_statement_line,
      (SELECT COUNT(*)::int FROM public.bank_reconciliation_session) AS bank_reconciliation_session,
      (SELECT COUNT(*)::int FROM public.bank_reconciliation_match) AS bank_reconciliation_match,
      (SELECT COUNT(*)::int FROM public.accounting_voucher) AS accounting_voucher,
      (SELECT COUNT(*)::int FROM public.accounting_journal_entry) AS accounting_journal_entry,
      (SELECT COUNT(*)::int FROM public.accounting_journal_line) AS accounting_journal_line,
      (SELECT COUNT(*)::int FROM public.accounting_fiscal_period) AS accounting_fiscal_period,
      (SELECT COUNT(*)::int FROM public."order" WHERE deleted_at IS NULL) AS "order",
      (SELECT COUNT(*)::int FROM public.payment_transaction WHERE deleted_at IS NULL) AS payment_transaction,
      (SELECT COUNT(*)::int FROM public.branch_inventory WHERE deleted_at IS NULL) AS branch_inventory,
      (SELECT COUNT(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS accounting_start_date
  `);

  const idleInTx = await client.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE state = 'idle in transaction'");
  const exclusiveLocks = await client.query("SELECT count(*)::int AS count FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND l.mode LIKE '%ExclusiveLock'");

  console.log("=== INDEPENDENT POSTGRESQL AUDIT REPORT (POST STEP 4.10.5-D-B) ===");
  console.log(JSON.stringify(baselineRes.rows[0], null, 2));
  console.log("Idle in transaction sessions:", idleInTx.rows[0].count);
  console.log("User-relation locks in public schema:", exclusiveLocks.rows[0].count);

  await client.end();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
