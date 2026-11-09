const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDbUrl() {
  return fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8')
    .split('\n')
    .find(l => l.startsWith('DATABASE_URL='))
    .replace('DATABASE_URL=', '')
    .trim()
    .replace(/['"]/g, '');
}

async function verify() {
  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const vchs = await client.query("SELECT id, voucher_no, branch_id FROM public.accounting_voucher WHERE branch_id = 'br_tc_1792406058562'");
  const jes = await client.query("SELECT id FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE branch_id = 'br_tc_1792406058562')");

  console.log('--- Verification for test run br_tc_1792406058562 ---');
  console.log('Leftover vouchers count:', vchs.rows.length);
  console.log('Leftover journal entries count:', jes.rows.length);

  const tbRes = await client.query(`
    SELECT 
      COALESCE(SUM(jl.debit_amount), 0)::numeric(15,2) as total_debit,
      COALESCE(SUM(jl.credit_amount), 0)::numeric(15,2) as total_credit
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE v.status = 'POSTED' AND v.deleted_at IS NULL
  `);
  console.log('Current General Ledger Trial Balance:');
  console.log('Total Debit:', tbRes.rows[0].total_debit);
  console.log('Total Credit:', tbRes.rows[0].total_credit);
  console.log('Difference:', Math.abs(Number(tbRes.rows[0].total_debit) - Number(tbRes.rows[0].total_credit)));

  await client.end();
}

verify().catch(console.error);
