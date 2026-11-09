const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getDbConn() {
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
  const client = new Client({ connectionString: getDbConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=============================================================================');
  console.log('CakeToHome ERP — Independent Financial Statements & Cash Audit');
  console.log('=============================================================================\n');

  // 1. Authoritative Trial Balance
  console.log('[1] Authoritative Trial Balance from Posted Journal Lines in PostgreSQL:');
  const tbRes = await client.query(`
    SELECT 
      acc.code, acc.name, acc.type, acc.subtype,
      COALESCE(SUM(jl.debit_amount), 0)::numeric as debit_sum,
      COALESCE(SUM(jl.credit_amount), 0)::numeric as credit_sum,
      CASE 
        WHEN acc.type IN ('ASSET', 'EXPENSE') THEN COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)
        ELSE COALESCE(SUM(jl.credit_amount - jl.debit_amount), 0)
      END as normal_balance
    FROM public.accounting_account acc
    JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE v.status = 'POSTED' AND v.deleted_at IS NULL
    GROUP BY acc.code, acc.name, acc.type, acc.subtype
    ORDER BY acc.code;
  `);
  console.table(tbRes.rows);

  const totals = tbRes.rows.reduce(
    (acc, r) => ({
      debit: acc.debit + Number(r.debit_sum),
      credit: acc.credit + Number(r.credit_sum)
    }),
    { debit: 0, credit: 0 }
  );
  console.log(`  ✓ Total Debits:  ₹${totals.debit.toFixed(2)}`);
  console.log(`  ✓ Total Credits: ₹${totals.credit.toFixed(2)}`);
  console.log(`  ✓ Trial Balance Variance: ₹${Math.abs(totals.debit - totals.credit).toFixed(2)}`);

  // 2. Specific Requested Account Balances: 1111, 1114, 1121, 1119, 2111, 4110, 1143, 1144
  console.log('\n[2] Specific Requested Account Balances:');
  const targetCodes = ['1111', '1114', '1121', '1119', '2111', '4110', '1143', '1144'];
  const targetRes = await client.query(`
    SELECT 
      acc.code, acc.name, acc.type,
      COALESCE(SUM(jl.debit_amount), 0)::numeric as dr,
      COALESCE(SUM(jl.credit_amount), 0)::numeric as cr,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric as dr_minus_cr,
      CASE 
        WHEN acc.type IN ('ASSET', 'EXPENSE') THEN COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)
        ELSE COALESCE(SUM(jl.credit_amount - jl.debit_amount), 0)
      END as net_normal_balance
    FROM public.accounting_account acc
    LEFT JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE acc.code = ANY($1)
    GROUP BY acc.code, acc.name, acc.type
    ORDER BY acc.code;
  `, [targetCodes]);
  console.table(targetRes.rows);

  // 3. Forensic Investigation of Cash in Hand (1111) and Petty Cash (1114)
  console.log('\n[3] Forensic Investigation of Negative Cash Balances (1111 & 1114):');
  const cashLines = await client.query(`
    SELECT 
      acc.code, acc.name, v.id as voucher_id, v.voucher_no, v.voucher_type, v.reference_id,
      v.voucher_date::text, jl.debit_amount, jl.credit_amount, jl.narration,
      v.created_by, v.approved_by, v.posted_by
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    JOIN public.accounting_account acc ON acc.id = jl.account_id
    WHERE acc.code IN ('1111', '1114') AND v.status = 'POSTED' AND v.deleted_at IS NULL
    ORDER BY acc.code, v.voucher_date;
  `);
  console.table(cashLines.rows);

  // Trace the linked expenses
  const expenseIds = cashLines.rows.map(r => r.reference_id).filter(Boolean);
  console.log('\n  Linked expense IDs from cash vouchers:', expenseIds);
  const expRows = await client.query(`
    SELECT id, reference_no, description, total, payment_method, status, branch_id, teller_session_id, voucher_id, created_at::text
    FROM public.expense
    WHERE id = ANY($1) OR voucher_id = ANY($2);
  `, [expenseIds, cashLines.rows.map(r => r.voucher_id)]);
  console.table(expRows.rows);

  // Check if any cash receipts or opening floats exist in the database
  const floatRes = await client.query(`
    SELECT id, teller_id, branch_id, status, opening_float, expected_cash, closing_count, variance, opened_at::text, closed_at::text
    FROM public.teller_session;
  `);
  console.log(`\n  Teller Sessions in Database (Count: ${floatRes.rows.length}):`);
  console.table(floatRes.rows);

  const tellerMov = await client.query(`
    SELECT id, teller_session_id, branch_id, direction, movement_type, amount, narration, created_at::text
    FROM public.teller_movement;
  `);
  console.log(`  Teller Movements in Database (Count: ${tellerMov.rows.length}):`);
  console.table(tellerMov.rows);

  // 4. Statement of Profit and Loss
  console.log('\n[4] Authoritative Statement of Profit & Loss:');
  const revRes = await client.query(`
    SELECT 
      acc.code, acc.name,
      COALESCE(SUM(jl.credit_amount - jl.debit_amount), 0)::numeric as net_revenue
    FROM public.accounting_account acc
    JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE acc.type = 'REVENUE' AND v.status = 'POSTED' AND v.deleted_at IS NULL
    GROUP BY acc.code, acc.name;
  `);
  console.log('  Revenue Accounts:');
  console.table(revRes.rows);

  const expRes = await client.query(`
    SELECT 
      acc.code, acc.name,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric as net_expense
    FROM public.accounting_account acc
    JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE acc.type = 'EXPENSE' AND v.status = 'POSTED' AND v.deleted_at IS NULL
    GROUP BY acc.code, acc.name;
  `);
  console.log('  Expense Accounts:');
  console.table(expRes.rows);

  const totalRev = revRes.rows.reduce((sum, r) => sum + Number(r.net_revenue), 0);
  const totalExp = expRes.rows.reduce((sum, r) => sum + Number(r.net_expense), 0);
  const curNetProfit = totalRev - totalExp;
  console.log(`  ✓ Current Operating Revenue: ₹${totalRev.toFixed(2)}`);
  console.log(`  ✓ Current Operating Expense: ₹${totalExp.toFixed(2)}`);
  console.log(`  ✓ Current Net Operating Profit: ₹${curNetProfit.toFixed(2)}`);

  // 5. Balance Sheet & Fundamental Accounting Equation
  console.log('\n[5] Balance Sheet Verification (Assets = Liabilities + Equity):');
  const assetsRes = await client.query(`
    SELECT 
      acc.code, acc.name,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric as asset_balance
    FROM public.accounting_account acc
    JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE acc.type = 'ASSET' AND v.status = 'POSTED' AND v.deleted_at IS NULL
    GROUP BY acc.code, acc.name;
  `);
  console.log('  Asset Balances:');
  console.table(assetsRes.rows);

  const liabRes = await client.query(`
    SELECT 
      acc.code, acc.name,
      COALESCE(SUM(jl.credit_amount - jl.debit_amount), 0)::numeric as liab_balance
    FROM public.accounting_account acc
    JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE acc.type = 'LIABILITY' AND v.status = 'POSTED' AND v.deleted_at IS NULL
    GROUP BY acc.code, acc.name;
  `);
  console.log('  Liability Balances:');
  console.table(liabRes.rows);

  const totalAssets = assetsRes.rows.reduce((sum, r) => sum + Number(r.asset_balance), 0);
  const totalLiab = liabRes.rows.reduce((sum, r) => sum + Number(r.liab_balance), 0);
  const baseEquity = 0;
  const totalEquity = baseEquity + curNetProfit;

  console.log(`  ✓ Total Assets:      ₹${totalAssets.toFixed(2)}`);
  console.log(`  ✓ Total Liabilities: ₹${totalLiab.toFixed(2)}`);
  console.log(`  ✓ Total Equity:      ₹${totalEquity.toFixed(2)} (Base ₹0 + Net Profit ₹${curNetProfit.toFixed(2)})`);
  console.log(`  ✓ Accounting Equation: Assets (₹${totalAssets.toFixed(2)}) === Liabilities (₹${totalLiab.toFixed(2)}) + Equity (₹${totalEquity.toFixed(2)})`);
  console.log(`  ✓ Discrepancy:       ₹${Math.abs(totalAssets - (totalLiab + totalEquity)).toFixed(2)}`);

  await client.end();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
