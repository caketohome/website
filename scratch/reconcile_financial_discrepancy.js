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

async function reconcile() {
  const client = new Client({ connectionString: getDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("===============================================================================");
  console.log("   CAKETOHOME ERP — FINANCIAL BASELINE FORENSIC RECONCILIATION");
  console.log("===============================================================================\n");

  // 1. Current Trial Balance by Account
  const tbRes = await client.query(`
    SELECT 
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(l.debit_amount), 0)::numeric(15,2) as total_debit,
      COALESCE(SUM(l.credit_amount), 0)::numeric(15,2) as total_credit,
      (COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0))::numeric(15,2) as net_debit
    FROM public.accounting_account a
    LEFT JOIN public.accounting_journal_line l ON l.account_id = a.id
    LEFT JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = e.voucher_id
    WHERE v.status = 'POSTED' OR v.id IS NULL
    GROUP BY a.code, a.name, a.type
    HAVING COALESCE(SUM(l.debit_amount), 0) > 0 OR COALESCE(SUM(l.credit_amount), 0) > 0
    ORDER BY a.code ASC;
  `);

  console.log("--- 1. CURRENT POSTED TRIAL BALANCE ---");
  console.table(tbRes.rows);

  let totalDr = 0, totalCr = 0;
  tbRes.rows.forEach(r => {
    totalDr += Number(r.total_debit);
    totalCr += Number(r.total_credit);
  });
  console.log(`Current Total Debits:  ₹${totalDr.toFixed(2)}`);
  console.log(`Current Total Credits: ₹${totalCr.toFixed(2)}`);
  console.log(`Net Imbalance:         ₹${Math.abs(totalDr - totalCr).toFixed(2)}\n`);

  // 2. Discover columns on accounting_voucher
  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounting_voucher'");
  console.log("accounting_voucher columns:", cols.rows.map(r => r.column_name));
  const vNoCol = cols.rows.some(r => r.column_name === 'voucher_number') ? 'v.voucher_number' : (cols.rows.some(r => r.column_name === 'voucher_no') ? 'v.voucher_no' : 'v.id');

  // 2. Chronological List of All Posted Vouchers
  const vchRes = await client.query(`
    SELECT 
      v.id,
      v.voucher_no as voucher_number,
      v.voucher_type,
      v.status,
      v.reference_type,
      v.reference_id,
      v.total_amount::numeric(15,2) as total_amount,
      v.voucher_date,
      v.created_at,
      COUNT(e.id) as entry_count,
      COUNT(l.id) as line_count,
      COALESCE(SUM(l.debit_amount), 0)::numeric(15,2) as voucher_dr,
      COALESCE(SUM(l.credit_amount), 0)::numeric(15,2) as voucher_cr
    FROM public.accounting_voucher v
    JOIN public.accounting_journal_entry e ON e.voucher_id = v.id
    JOIN public.accounting_journal_line l ON l.journal_entry_id = e.id
    WHERE v.status = 'POSTED'
    GROUP BY v.id, v.voucher_no, v.voucher_type, v.status, v.reference_type, v.reference_id, v.total_amount, v.voucher_date, v.created_at
    ORDER BY v.created_at ASC;
  `);

  console.log(`--- 2. ALL POSTED VOUCHERS (${vchRes.rows.length} total) IN CHRONOLOGICAL ORDER ---`);
  
  let runningDr = 0;
  const history = [];
  for (const v of vchRes.rows) {
    const dr = Number(v.voucher_dr);
    runningDr += dr;
    history.push({
      voucher_number: v.voucher_number,
      type: v.voucher_type,
      source: `${v.reference_type || 'N/A'}:${(v.reference_id || '').substring(0, 15)}`,
      amount: v.total_amount,
      dr: v.voucher_dr,
      cr: v.voucher_cr,
      cumulative_total: runningDr.toFixed(2),
      created_at: v.created_at
    });
  }
  console.table(history);

  // 3. Inspect Entries between 14625, 14925, and 15175
  console.log("\n--- 3. IDENTIFYING EXACT VOUCHERS AROUND 14,625 / 14,925 / 15,175 ---");
  let sum = 0;
  for (const v of vchRes.rows) {
    const prev = sum;
    sum += Number(v.voucher_dr);
    if (prev < 14625 && sum >= 14625) {
      console.log(`[MILESTONE ₹14,625 REACHED at Voucher ${v.voucher_number}]: Amount = ₹${v.voucher_dr}, Cumulative = ₹${sum.toFixed(2)}, Created = ${v.created_at}`);
    }
    if (sum > 14625) {
      console.log(`  -> Voucher beyond ₹14,625: ${v.voucher_number} | Type: ${v.voucher_type} | Source: ${v.reference_type} | Dr: ₹${v.voucher_dr} | Cumulative: ₹${sum.toFixed(2)} | Date: ${v.created_at}`);
    }
  }

  // 4. Suspense Account (1119) & Orphan Check
  const suspense = await client.query(`
    SELECT a.code, a.name, COALESCE(SUM(l.debit_amount), 0) as dr, COALESCE(SUM(l.credit_amount), 0) as cr
    FROM public.accounting_account a
    LEFT JOIN public.accounting_journal_line l ON l.account_id = a.id
    WHERE a.code = '1119'
    GROUP BY a.code, a.name;
  `);
  console.log("\n--- 4. SUSPENSE ACCOUNT 1119 CHECK ---");
  console.table(suspense.rows);

  // 5. Quarantined Invoices (CTH/26-27/000031 to 000035)
  const invCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoice'");
  console.log("invoice columns:", invCols.rows.map(r => r.column_name));
  const quarantined = await client.query(`
    SELECT *
    FROM public.invoice
    WHERE invoice_number IN ('CTH/26-27/000031', 'CTH/26-27/000032', 'CTH/26-27/000033', 'CTH/26-27/000034', 'CTH/26-27/000035')
    ORDER BY invoice_number ASC;
  `);
  console.log("\n--- 5. QUARANTINED PROTOTYPE INVOICES ---");
  console.table(quarantined.rows.map(r => ({
    invoice_number: r.invoice_number,
    status: r.status,
    total_amount: r.total_amount,
    balance_due: r.balance_due || r.amount_due,
    created_at: r.created_at
  })));

  await client.end();
}

reconcile().catch(err => {
  console.error("Reconciliation error:", err);
  process.exit(1);
});
