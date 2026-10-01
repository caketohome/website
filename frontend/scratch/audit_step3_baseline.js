const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

function getConnStr() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(__dirname, '..', '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error('.env missing DATABASE_URL');
}

const pool = new Pool({ connectionString: getConnStr() });

(async () => {
  console.log('=== INDEPENDENT POSTGRESQL BASELINE AUDIT — Phase 5A.6 Step 3 ===\n');

  const r = await pool.query(`
    SELECT
      (SELECT count(*) FROM public.accounting_voucher WHERE deleted_at IS NULL) AS vouchers,
      (SELECT count(*) FROM public.accounting_journal_entry) AS journal_entries,
      (SELECT count(*) FROM public.accounting_journal_line) AS journal_lines,
      (SELECT count(*) FROM public.accounting_fiscal_period) AS fiscal_periods,
      (SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%') AS acct_settings,
      (SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL) AS total_coa,
      (SELECT count(*) FROM public.accounting_account WHERE is_active = true AND deleted_at IS NULL) AS active_coa,
      (SELECT count(*) FROM public."order" WHERE deleted_at IS NULL) AS orders,
      (SELECT count(*) FROM public.payment_transaction WHERE deleted_at IS NULL) AS payments
  `);
  const d = r.rows[0];
  console.log('Accounting vouchers :', d.vouchers);
  console.log('Journal entries     :', d.journal_entries);
  console.log('Journal lines       :', d.journal_lines);
  console.log('Fiscal periods      :', d.fiscal_periods);
  console.log('Accounting settings :', d.acct_settings);
  console.log('Total CoA accounts  :', d.total_coa);
  console.log('Active CoA accounts :', d.active_coa);
  console.log('Orders              :', d.orders);
  console.log('Payments            :', d.payments);

  // Closing voucher check
  const cv = await pool.query(`SELECT count(*) AS c FROM public.accounting_voucher WHERE reference_type = 'YEAR_END_CLOSE' AND deleted_at IS NULL`);
  console.log('\nResidual YEAR_END_CLOSE vouchers:', cv.rows[0].c);

  // Audit log check
  const al = await pool.query(`SELECT action, count(*) AS c FROM public.audit_log WHERE action LIKE 'accounting.%' GROUP BY action ORDER BY action`);
  console.log('Accounting audit logs:', al.rows.length === 0 ? 'NONE (pristine)' : JSON.stringify(al.rows));

  // Verdict
  const pristine = d.vouchers === '0' && d.journal_entries === '0' && d.journal_lines === '0'
    && d.fiscal_periods === '0' && d.acct_settings === '0' && d.active_coa === '99'
    && d.orders === '173' && d.payments === '53'
    && cv.rows[0].c === '0' && al.rows.length === 0;

  console.log('\n' + (pristine
    ? '✅ VERDICT: PostgreSQL baseline is PRISTINE — zero financial mutations.'
    : '❌ VERDICT: PostgreSQL baseline has UNEXPECTED residuals!'));

  await pool.end();
})();
