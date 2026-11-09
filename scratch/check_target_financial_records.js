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

async function main() {
  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== SECTION 6 FINANCIAL SAFEGUARD AUDIT ===');
  const vouchers = await client.query(`
    SELECT id, voucher_no, voucher_type, total_amount, status, branch_id, created_at 
    FROM public.accounting_voucher 
    WHERE voucher_no IN ('VCH-VAL-tc_1792398245910', 'VCH-C-A-tc_1792398245910')
  `);
  console.log('Target Vouchers Found:', vouchers.rows);

  const accounts = await client.query(`
    SELECT 
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(l.debit_amount), 0) as total_debit,
      COALESCE(SUM(l.credit_amount), 0) as total_credit,
      (COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0)) as net_balance
    FROM public.accounting_account a
    LEFT JOIN public.accounting_journal_line l ON l.account_id = a.id
    LEFT JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = e.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE a.code IN ('1111', '1114', '1122', '5210')
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `);
  console.log('Account Balances:');
  accounts.rows.forEach(r => {
    console.log(`  Account ${r.code} (${r.name}): Total Dr: ${r.total_debit}, Total Cr: ${r.total_credit}, Net: ${r.net_balance}`);
  });

  const tbRes = await client.query(`
    SELECT 
      COALESCE(SUM(jl.debit_amount), 0)::numeric(15,2) as total_debit,
      COALESCE(SUM(jl.credit_amount), 0)::numeric(15,2) as total_credit
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE v.status = 'POSTED' AND v.deleted_at IS NULL
  `);
  console.log('GL Equilibrium:');
  console.log('  Total Debit:', tbRes.rows[0].total_debit);
  console.log('  Total Credit:', tbRes.rows[0].total_credit);
  console.log('  Difference:', Math.abs(Number(tbRes.rows[0].total_debit) - Number(tbRes.rows[0].total_credit)));

  await client.end();
}

main().catch(console.error);
