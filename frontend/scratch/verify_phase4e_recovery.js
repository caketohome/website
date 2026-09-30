/**
 * Independent Forensic Verification for Phase 4E Crash Recovery
 * Audits all required tables and checks mandatory database safety invariants.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = [
    'accounting_account',
    'accounting_voucher',
    'accounting_journal_entry',
    'accounting_journal_line',
    'accounting_fiscal_period',
    'purchase',
    'purchase_item',
    'purchase_payment',
    'supplier',
    'order',
    'payment_transaction',
    'branch_inventory',
    'product',
    'product_variant',
    'expense',
    'expense_category',
    'fleet_fuel',
    'vehicle',
    'vehicle_trip',
    'branch',
    'customer',
    'setting'
  ];

  const counts = {};
  for (const table of tables) {
    try {
      const q = table === 'order' ? 'SELECT count(*)::int as cnt FROM public."order"' : `SELECT count(*)::int as cnt FROM public.${table}`;
      const res = await client.query(q);
      counts[table] = res.rows[0].cnt;
    } catch (err) {
      counts[table] = `ERROR: ${err.message}`;
    }
  }

  // Check specific settings
  const settingRows = await client.query(`SELECT key, value FROM public.setting;`);
  const accountingStartDateSetting = settingRows.rows.find(r => r.key === 'accounting_start_date');

  // Verify group accounts vs posting accounts
  const groupRes = await client.query(`
    SELECT 
      count(*) FILTER (WHERE is_group = true)::int as group_count,
      count(*) FILTER (WHERE is_group = false)::int as posting_count
    FROM public.accounting_account;
  `);

  const report = {
    timestamp: new Date().toISOString(),
    counts,
    settings: settingRows.rows,
    account_groups: groupRes.rows[0],
    accounting_start_date_configured: !!accountingStartDateSetting,
    safety_checks: {
      accounting_account_is_98: counts['accounting_account'] === 98,
      accounting_voucher_is_0: counts['accounting_voucher'] === 0,
      accounting_journal_entry_is_0: counts['accounting_journal_entry'] === 0,
      accounting_journal_line_is_0: counts['accounting_journal_line'] === 0,
      order_is_173: counts['order'] === 173,
      payment_transaction_is_53: counts['payment_transaction'] === 53,
      accounting_start_date_unconfigured: !accountingStartDateSetting,
      group_count_is_24: groupRes.rows[0].group_count === 24,
      posting_count_is_74: groupRes.rows[0].posting_count === 74
    }
  };

  fs.writeFileSync(path.join(__dirname, 'forensic_recovery_report.json'), JSON.stringify(report, null, 2));
  console.log("REPORT WRITTEN TO forensic_recovery_report.json");
  console.log(JSON.stringify(report, null, 2));

  await client.end();
}

run().catch(err => {
  console.error("Forensic check failed with error:", err);
  process.exit(1);
});
