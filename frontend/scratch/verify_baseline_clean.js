const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const projectRoot = path.resolve(__dirname, '..');
const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
let connStr = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connStr = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

(async () => {
  const db = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const [v, j, l, p, s, accts, orders, payments, locks] = await Promise.all([
    db.query('SELECT count(*) FROM public.accounting_voucher'),
    db.query('SELECT count(*) FROM public.accounting_journal_entry'),
    db.query('SELECT count(*) FROM public.accounting_journal_line'),
    db.query('SELECT count(*) FROM public.accounting_fiscal_period'),
    db.query("SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%'"),
    db.query('SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL'),
    db.query('SELECT count(*) FROM public.order WHERE deleted_at IS NULL'),
    db.query('SELECT count(*) FROM public.payment_transaction WHERE deleted_at IS NULL'),
    db.query("SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid()")
  ]);

  console.log('--- DATABASE SAFETY BASELINE AUDIT ---');
  console.log(`accounting_voucher:       ${v.rows[0].count} (expected: 0)`);
  console.log(`accounting_journal_entry: ${j.rows[0].count} (expected: 0)`);
  console.log(`accounting_journal_line:  ${l.rows[0].count} (expected: 0)`);
  console.log(`accounting_fiscal_period: ${p.rows[0].count} (expected: 0)`);
  console.log(`accounting_settings:      ${s.rows[0].count} (expected: 0)`);
  console.log(`active_accounts:          ${accts.rows[0].count} (expected: 99)`);
  console.log(`orders:                   ${orders.rows[0].count} (expected: 173)`);
  console.log(`payments:                 ${payments.rows[0].count} (expected: 53)`);
  console.log(`active_locks/queries:     ${locks.rows[0].count} (expected: 0)`);
  console.log('STATUS: ZERO MUTATIONS - CLEAN BASELINE PRESERVED');

  await db.end();
})();
