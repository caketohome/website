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
    SELECT 
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(l.debit_amount), 0) as total_debit,
      COALESCE(SUM(l.credit_amount), 0) as total_credit,
      (COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0)) as net_debit
    FROM public.accounting_account a
    LEFT JOIN public.accounting_journal_line l ON l.account_id = a.id
    LEFT JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = e.voucher_id
    WHERE v.status = 'POSTED' OR v.id IS NULL
    GROUP BY a.code, a.name, a.type
    HAVING COALESCE(SUM(l.debit_amount), 0) > 0 OR COALESCE(SUM(l.credit_amount), 0) > 0
    ORDER BY a.code ASC;
  `);
  let totalDr = 0, totalCr = 0;
  console.log("Code  | Name                                | Type       | Total Dr (₹) | Total Cr (₹) | Net Dr (₹)");
  console.log("---------------------------------------------------------------------------------------------------");
  for (const r of res.rows) {
    const dr = Number(r.total_debit);
    const cr = Number(r.total_credit);
    totalDr += dr;
    totalCr += cr;
    console.log(`${r.code.padEnd(5)} | ${r.name.padEnd(35)} | ${r.type.padEnd(10)} | ${dr.toFixed(2).padStart(12)} | ${cr.toFixed(2).padStart(12)} | ${(dr - cr).toFixed(2).padStart(12)}`);
  }
  console.log("---------------------------------------------------------------------------------------------------");
  console.log(`TOTALS: Dr = ₹${totalDr.toFixed(2)}, Cr = ₹${totalCr.toFixed(2)}, Net Diff = ₹${Math.abs(totalDr - totalCr).toFixed(2)}`);
  await client.end();
}
main();
