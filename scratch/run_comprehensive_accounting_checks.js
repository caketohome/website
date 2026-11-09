const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=============================================================================');
  console.log('CakeToHome ERP — Comprehensive Independent PostgreSQL Accounting Balance Audit');
  console.log('=============================================================================\n');

  // 1. TRIAL BALANCE BY ACCOUNT
  console.log('[1] TRIAL BALANCE BY ACCOUNT:');
  const tbRes = await client.query(`
    SELECT 
      ca.code,
      ca.name,
      ca.type,
      ca.subtype,
      COALESCE(SUM(jl.debit_amount), 0) AS total_dr,
      COALESCE(SUM(jl.credit_amount), 0) AS total_cr,
      CASE 
        WHEN ca.type IN ('ASSET', 'EXPENSE') THEN COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0)
        ELSE COALESCE(SUM(jl.credit_amount), 0) - COALESCE(SUM(jl.debit_amount), 0)
      END AS normal_balance
    FROM public.accounting_account ca
    LEFT JOIN public.accounting_journal_line jl ON jl.account_id = ca.id
    LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    GROUP BY ca.code, ca.name, ca.type, ca.subtype
    HAVING COALESCE(SUM(jl.debit_amount), 0) > 0 OR COALESCE(SUM(jl.credit_amount), 0) > 0
    ORDER BY ca.code ASC
  `);
  console.table(tbRes.rows);

  const totalDr = tbRes.rows.reduce((acc, r) => acc + Number(r.total_dr), 0);
  const totalCr = tbRes.rows.reduce((acc, r) => acc + Number(r.total_cr), 0);
  const tbDiff = Math.round((totalDr - totalCr) * 100) / 100;
  console.log(`Trial Balance Totals: Debits = ₹${totalDr.toFixed(2)}, Credits = ₹${totalCr.toFixed(2)}, Diff = ₹${tbDiff.toFixed(2)}`);

  // 2. CASH AND PETTY CASH BALANCES
  console.log('\n[2] CASH & PETTY CASH QUALITY:');
  const cashAccounts = tbRes.rows.filter(r => ['1111', '1114'].includes(r.code));
  for (const c of cashAccounts) {
    console.log(`  - Account [${c.code}] ${c.name}: Dr ₹${c.total_dr}, Cr ₹${c.total_cr}, Normal Balance = ₹${c.normal_balance}`);
  }

  // 3. BANK BALANCES AND BRS
  console.log('\n[3] BANK ACCOUNTS & BRS RECONCILIATION:');
  const bankAccs = await client.query('SELECT id, account_name, account_number_masked, status, gl_account_id FROM public.bank_account');
  console.log(`  - Persisted Bank Accounts: ${bankAccs.rows.length}`);
  const brsImports = await client.query('SELECT id, source_filename, status FROM public.bank_statement_import');
  console.log(`  - BRS Statement Imports: ${brsImports.rows.length}`);
  const bankGl = tbRes.rows.filter(r => r.code.startsWith('1112'));
  console.log(`  - Bank GL [1112] Posted Lines: ${bankGl.length}`);

  // 4. ACCOUNTS PAYABLE VS SUPPLIER SUBLEDGER
  console.log('\n[4] ACCOUNTS PAYABLE (2111) VS SUPPLIER BALANCES:');
  const apGl = tbRes.rows.filter(r => r.code === '2111');
  console.log(`  - GL 2111 Balance: ₹${apGl[0]?.normal_balance || '0.00'}`);
  const bills = await client.query(`SELECT count(*)::int as count FROM public.purchase_invoice WHERE status = 'POSTED'`).catch(() => ({ rows: [{ count: 0 }] }));
  console.log(`  - Posted Purchase Invoices: ${bills.rows[0].count}`);

  // 5. ACCOUNTS RECEIVABLE VS INVOICE & RECEIPT SUBLEDGER
  console.log('\n[5] ACCOUNTS RECEIVABLE (1121) VS INVOICE SUBLEDGER:');
  const arGl = tbRes.rows.filter(r => r.code === '1121');
  console.log(`  - GL 1121 Balance: ₹${arGl[0]?.normal_balance || '0.00'}`);
  const invRes = await client.query(`
    SELECT count(*)::int as total_invoices, 
           COALESCE(SUM(grand_total), 0)::numeric as total_invoiced
    FROM public.invoice WHERE deleted_at IS NULL
  `);
  console.log(`  - Total Invoices: ${invRes.rows[0].total_invoices}, Total Amount: ₹${invRes.rows[0].total_invoiced}`);
  const openInv = await client.query(`
    SELECT count(*)::int as open_count,
           COALESCE(SUM(grand_total), 0)::numeric as open_invoiced
    FROM public.invoice 
    WHERE deleted_at IS NULL AND payment_status != 'paid' AND payment_method != 'prepaid_online'
  `);
  console.log(`  - Open / Unsettled Invoices: ${openInv.rows[0].open_count}, Open Amount: ₹${openInv.rows[0].open_invoiced}`);
  const unassignedJel = await client.query(`
    SELECT COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric as unassigned_total
    FROM public.accounting_journal_line jl
    JOIN public.accounting_account ca ON ca.id = jl.account_id
    WHERE ca.code = '1121' AND jl.customer_id IS NULL
  `);
  console.log(`  - Unassigned Manual Journals on 1121: ₹${unassignedJel.rows[0].unassigned_total}`);
  const arReconciled = Number(arGl[0]?.normal_balance || 0) === (Number(openInv.rows[0].open_invoiced) + Number(unassignedJel.rows[0].unassigned_total));
  console.log(`  - Subledger + Unassigned === GL 1121: ${arReconciled}`);

  // 6. GST ACCOUNTS AUDIT (INPUT VS OUTPUT)
  console.log('\n[6] GST STATUTORY ACCOUNTS AUDIT:');
  const gstLines = tbRes.rows.filter(r => r.code.startsWith('114') || r.code.startsWith('212'));
  console.table(gstLines);

  // 7. PROFIT & LOSS AUDIT
  console.log('\n[7] STATEMENT OF PROFIT AND LOSS:');
  const rev = tbRes.rows.filter(r => r.type === 'REVENUE').reduce((acc, r) => acc + Number(r.normal_balance), 0);
  const exp = tbRes.rows.filter(r => r.type === 'EXPENSE').reduce((acc, r) => acc + Number(r.normal_balance), 0);
  const netProfit = rev - exp;
  console.log(`  - Operating Revenue (4xxx) : ₹${rev.toFixed(2)}`);
  console.log(`  - Operating Expenses (5xxx): ₹${exp.toFixed(2)}`);
  console.log(`  - Net Operating Profit     : ₹${netProfit.toFixed(2)}`);

  // 8. BALANCE SHEET CONVERGENCE & ACCOUNTING EQUATION
  console.log('\n[8] BALANCE SHEET STATEMENT & ACCOUNTING EQUATION:');
  const assets = tbRes.rows.filter(r => r.type === 'ASSET').reduce((acc, r) => acc + Number(r.normal_balance), 0);
  const liab = tbRes.rows.filter(r => r.type === 'LIABILITY').reduce((acc, r) => acc + Number(r.normal_balance), 0);
  const equity = tbRes.rows.filter(r => r.type === 'EQUITY').reduce((acc, r) => acc + Number(r.normal_balance), 0);
  const totalEquityAndProfit = equity + netProfit;
  const balanceSheetDiff = Math.round((assets - (liab + totalEquityAndProfit)) * 100) / 100;
  console.log(`  - Total Assets (1xxx)             : ₹${assets.toFixed(2)}`);
  console.log(`  - Total Liabilities (2xxx)        : ₹${liab.toFixed(2)}`);
  console.log(`  - Contributed Equity (3xxx)       : ₹${equity.toFixed(2)}`);
  console.log(`  - Current Year Net Earnings       : ₹${netProfit.toFixed(2)}`);
  console.log(`  - Total Liabilities + Equity      : ₹${(liab + totalEquityAndProfit).toFixed(2)}`);
  console.log(`  - Accounting Equation Invariant   : Assets === Liabilities + Equity? ${balanceSheetDiff === 0} (Diff = ₹${balanceSheetDiff.toFixed(2)})`);

  // 9. JOURNAL INTEGRITY & IMMUTABILITY AUDIT
  console.log('\n[9] JOURNAL INTEGRITY & IMMUTABILITY AUDIT:');
  const unbalancedJe = await client.query(`
    SELECT je.id, je.entry_no, je.total_debit, je.total_credit, 
           SUM(jl.debit_amount) as line_dr, SUM(jl.credit_amount) as line_cr
    FROM public.accounting_journal_entry je
    JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
    GROUP BY je.id, je.entry_no, je.total_debit, je.total_credit
    HAVING je.total_debit != je.total_credit 
        OR SUM(jl.debit_amount) != SUM(jl.credit_amount)
        OR SUM(jl.debit_amount) != je.total_debit
  `);
  console.log(`  - Unbalanced Journal Entries in DB: ${unbalancedJe.rows.length}`);

  const dupVouchers = await client.query(`
    SELECT reference_type, reference_id, count(*)
    FROM public.accounting_voucher
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL AND reference_event = 'PRIMARY' AND status = 'POSTED' AND deleted_at IS NULL
    GROUP BY reference_type, reference_id
    HAVING count(*) > 1
  `);
  console.log(`  - Duplicate Primary Vouchers: ${dupVouchers.rows.length}`);

  // 10. POSTING GUARDS AUDIT
  console.log('\n[10] POSTING GUARDS AUDIT:');
  const startDate = await client.query("SELECT value FROM public.setting WHERE key = 'accounting_start_date'");
  console.log(`  - accounting_start_date setting: ${startDate.rows[0]?.value}`);
  const periods = await client.query("SELECT count(*)::int as count FROM public.accounting_fiscal_period");
  console.log(`  - Total Fiscal Periods: ${periods.rows[0].count}`);
  const currentPeriod = await client.query("SELECT period_name, is_locked FROM public.accounting_fiscal_period WHERE CURRENT_DATE BETWEEN start_date AND end_date");
  console.log(`  - Current Period: ${currentPeriod.rows[0]?.period_name} (Locked: ${currentPeriod.rows[0]?.is_locked})`);

  await client.end();
}

run().catch(console.error);
