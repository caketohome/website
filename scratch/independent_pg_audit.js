const { Client } = require('../frontend/node_modules/pg');
const fs = require('fs');
const env = fs.readFileSync('./frontend/.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function verifyLedger() {
  await client.connect();

  console.log('=== INDEPENDENT POSTGRESQL FINANCIAL AUDIT ===');

  // 1. Double-entry equilibrium across ALL posted vouchers
  const bal = await client.query(`
    SELECT 
      SUM(jl.debit_amount) as sum_dr,
      SUM(jl.credit_amount) as sum_cr
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE v.status = 'POSTED'
  `);
  const dr = Number(bal.rows[0].sum_dr);
  const cr = Number(bal.rows[0].sum_cr);
  const diff = Math.abs(dr - cr);
  console.log(`Double-Entry Check: Total Debits = ₹${dr.toFixed(2)}, Total Credits = ₹${cr.toFixed(2)}, Diff = ₹${diff.toFixed(2)}`);

  // 2. Suspense Account 1119
  const susp = await client.query(`
    SELECT 
      COALESCE(SUM(jl.debit_amount) - SUM(jl.credit_amount), 0) as net_balance
    FROM public.accounting_journal_line jl
    JOIN public.accounting_account a ON a.id = jl.account_id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE a.code = '1119' AND v.status = 'POSTED'
  `);
  console.log(`Suspense Account 1119 Net Balance: ₹${Number(susp.rows[0]?.net_balance || 0).toFixed(2)}`);

  // 3. Preserved Key Accounts
  const codes = ['1111', '1114', '1122', '1121'];
  for (const c of codes) {
    const accRes = await client.query(`
      SELECT 
        a.code, a.name,
        COALESCE(SUM(jl.debit_amount) - SUM(jl.credit_amount), 0) as net_balance
      FROM public.accounting_account a
      LEFT JOIN public.accounting_journal_line jl ON jl.account_id = a.id
      LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED'
      WHERE a.code = $1
      GROUP BY a.code, a.name
    `, [c]);
    const r = accRes.rows[0];
    console.log(`Account ${r?.code} (${r?.name}): Net GL Balance = ₹${Number(r?.net_balance || 0).toFixed(2)}`);
  }

  // 4. Quarantined prototype invoices
  const invs = await client.query(`
    SELECT invoice_number, status, grand_total, paid_amount 
    FROM public.invoice 
    WHERE invoice_number BETWEEN 'CTH/26-27/000031' AND 'CTH/26-27/000035'
    ORDER BY invoice_number
  `);
  console.log(`Quarantined Invoices Count: ${invs.rows.length}`);
  for (const inv of invs.rows) {
    console.log(`  - ${inv.invoice_number}: status=${inv.status}, total=₹${inv.grand_total}, paid=₹${inv.paid_amount}`);
  }

  // 5. Total entities count in authoritative DB
  const counts = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM public.branch WHERE deleted_at IS NULL) as branch_count,
      (SELECT COUNT(*) FROM public.product WHERE deleted_at IS NULL) as product_count,
      (SELECT COUNT(*) FROM public.customer WHERE deleted_at IS NULL) as customer_count,
      (SELECT COUNT(*) FROM public."order") as order_count,
      (SELECT COUNT(*) FROM public.accounting_voucher WHERE status = 'POSTED') as posted_vouchers_count,
      (SELECT COUNT(*) FROM public.invoice) as invoice_count
  `);
  console.log('Authoritative Database Entity Counts:', counts.rows[0]);

  await client.end();
}

verifyLedger().catch(console.error);
