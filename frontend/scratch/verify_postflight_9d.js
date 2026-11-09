const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let cs = process.env.DATABASE_URL;
if (!cs) {
  for (const l of fs.readFileSync(path.join(__dirname, '../.env'), 'utf8').split('\n')) {
    const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
    if (m) { cs = m[1].trim(); break; }
  }
}

const pool = new Pool({
  connectionString: cs,
  ssl: cs.includes('supabase') ? { rejectUnauthorized: false } : false,
});

async function main() {
  const [coa, v, je, jl, tb, cand, ca, cac, cam, ce, cee, cax, cei] = await Promise.all([
    pool.query('SELECT count(*)::int as count FROM public.accounting_account'),
    pool.query('SELECT count(*)::int as count FROM public.accounting_voucher'),
    pool.query('SELECT count(*)::int as count FROM public.accounting_journal_entry'),
    pool.query('SELECT count(*)::int as count FROM public.accounting_journal_line'),
    pool.query('SELECT COALESCE(SUM(debit_amount),0)::numeric(12,2) as dr, COALESCE(SUM(credit_amount),0)::numeric(12,2) as cr FROM public.accounting_journal_line'),
    pool.query("SELECT count(*)::int as count FROM public.accounting_account WHERE code IN ('1118B', '2118', '2119', '5114', '5115')"),
    pool.query('SELECT count(*)::int as count FROM public.corporate_account'),
    pool.query('SELECT count(*)::int as count FROM public.corporate_account_contact'),
    pool.query('SELECT count(*)::int as count FROM public.corporate_account_member'),
    pool.query('SELECT count(*)::int as count FROM public.corporate_employee'),
    pool.query('SELECT count(*)::int as count FROM public.corporate_employee_event'),
    pool.query('SELECT count(*)::int as count FROM public.corporate_account_event'),
    pool.query('SELECT count(*)::int as count FROM public.corporate_employee_import_batch'),
  ]);

  console.log("=== POSTFLIGHT INDEPENDENT AUDIT ===");
  console.log({
    coaCount: coa.rows[0].count,
    vouchers: v.rows[0].count,
    journalEntries: je.rows[0].count,
    journalLines: jl.rows[0].count,
    trialBalanceDebit: tb.rows[0].dr,
    trialBalanceCredit: tb.rows[0].cr,
    forbiddenCandidateAccounts: cand.rows[0].count,
    corporateAccountRows: ca.rows[0].count,
    corporateContactRows: cac.rows[0].count,
    corporateMemberRows: cam.rows[0].count,
    corporateEmployeeRows: ce.rows[0].count,
    employeeEventRows: cee.rows[0].count,
    accountEventRows: cax.rows[0].count,
    importBatchRows: cei.rows[0].count,
  });

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
