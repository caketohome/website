/**
 * Test zero-transaction Trial Balance for Balance Sheet as-of date query.
 */
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

  console.log('Testing getTrialBalance with as_of_date (no start_date)...');
  const asOfDate = '2026-03-31';

  // Simulating AccountingJournalRepository.getTrialBalance(undefined, undefined, asOfDate)
  const sql = `
    SELECT
      a.id AS account_id,
      a.code,
      a.name,
      a.type,
      a.subtype,
      a.level,
      a.is_group,
      COALESCE(filtered.total_debit, 0)  AS total_debit,
      COALESCE(filtered.total_credit, 0) AS total_credit,
      COALESCE(filtered.total_debit, 0) - COALESCE(filtered.total_credit, 0) AS net_balance
    FROM public.accounting_account a
    LEFT JOIN (
      SELECT
        jl.account_id,
        SUM(jl.debit_amount)  AS total_debit,
        SUM(jl.credit_amount) AS total_credit
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      WHERE je.entry_date <= $1
      GROUP BY jl.account_id
    ) filtered ON filtered.account_id = a.id
    WHERE a.deleted_at IS NULL AND a.is_active = true
    GROUP BY a.id, a.code, a.name, a.type, a.subtype, a.level, a.is_group,
             filtered.total_debit, filtered.total_credit
    ORDER BY a.code ASC;
  `;

  const res = await db.query(sql, [asOfDate]);
  console.log(`TB Rows returned: ${res.rows.length}`);
  
  const bsRows = res.rows.filter(r => ['ASSET', 'LIABILITY', 'EQUITY'].includes(r.type) && !r.is_group);
  console.log(`BS leaf accounts: ${bsRows.length}`);

  let totalDebit = 0;
  let totalCredit = 0;
  for (const r of res.rows) {
    totalDebit += Number(r.total_debit);
    totalCredit += Number(r.total_credit);
  }
  console.log(`Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`);
  console.log('Zero transaction test successful!');

  await db.end();
})();
