const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDatabaseUrl() {
  const envPath = path.join(__dirname, '../frontend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

async function exportTrialBalance() {
  const client = new Client({ connectionString: getDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tbRes = await client.query(`
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

  console.log("=== TRIAL BALANCE OF POSTED VOUCHERS ===");
  console.log("Code  | Name                                  | Type       | Debit (₹)       | Credit (₹)      | Net Debit (₹)");
  console.log("-------------------------------------------------------------------------------------------------------");
  let totalDr = 0;
  let totalCr = 0;
  for (const r of tbRes.rows) {
    const dr = Number(r.total_debit);
    const cr = Number(r.total_credit);
    const net = Number(r.net_debit);
    totalDr += dr;
    totalCr += cr;
    console.log(`${r.code.padEnd(5)} | ${r.name.padEnd(37)} | ${r.type.padEnd(10)} | ${dr.toFixed(2).padStart(15)} | ${cr.toFixed(2).padStart(15)} | ${net.toFixed(2).padStart(15)}`);
  }
  console.log("-------------------------------------------------------------------------------------------------------");
  console.log(`TOTALS: Debit = ₹${totalDr.toFixed(2)}, Credit = ₹${totalCr.toFixed(2)}, Net Diff = ₹${Math.abs(totalDr - totalCr).toFixed(2)}`);

  await client.end();
}

exportTrialBalance().catch(console.error);
