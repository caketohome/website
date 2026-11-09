const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDatabaseUrl() {
  const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return line.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
}

async function main() {
  const client = new Client({ connectionString: getDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT v.id, v.voucher_no, v.voucher_type, v.status, l.debit_amount, l.credit_amount, v.created_at
    FROM public.accounting_journal_line l
    JOIN public.accounting_account a ON a.id = l.account_id
    JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = e.voucher_id
    WHERE a.code = '1111'
    ORDER BY v.created_at ASC
  `);
  console.log("Vouchers on 1111:", res.rows.length);
  res.rows.forEach(r => console.log(`${r.id} | ${r.voucher_no} | ${r.status} | Dr: ${r.debit_amount} | Cr: ${r.credit_amount}`));
  const sum = res.rows.reduce((acc, r) => acc + (r.status === 'POSTED' ? (Number(r.debit_amount) - Number(r.credit_amount)) : 0), 0);
  console.log('Total net POSTED on 1111:', sum);
  await client.end();
}
main();
