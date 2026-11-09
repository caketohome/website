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
  console.log('CakeToHome ERP — Deep Forensic Audit of the Two Historical SoD Vouchers');
  console.log('=============================================================================\n');

  // 1. Full Row Audit from public.accounting_voucher
  const vchIds = ['vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8'];
  console.log('[Step 1] Inspecting accounting_voucher rows for IDs:', vchIds);
  const vchRows = await client.query(`
    SELECT * FROM public.accounting_voucher WHERE id = ANY($1) ORDER BY id;
  `, [vchIds]);
  for (const row of vchRows.rows) {
    console.log(`\n--- VOUCHER: ${row.id} ---`);
    console.log('  voucher_no:            ', row.voucher_no);
    console.log('  voucher_type:          ', row.voucher_type);
    console.log('  voucher_date:          ', row.voucher_date?.toISOString?.() || row.voucher_date);
    console.log('  status:                ', row.status);
    console.log('  total_amount:          ', row.total_amount);
    console.log('  reference_type:        ', row.reference_type);
    console.log('  reference_id:          ', row.reference_id);
    console.log('  reference_event:       ', row.reference_event);
    console.log('  narration:             ', row.narration);
    console.log('  created_by:            ', row.created_by);
    console.log('  submitted_by:          ', row.submitted_by);
    console.log('  submitted_at:          ', row.submitted_at);
    console.log('  approved_by:           ', row.approved_by);
    console.log('  approved_at:           ', row.approved_at);
    console.log('  posted_by:             ', row.posted_by);
    console.log('  posted_at:             ', row.posted_at);
    console.log('  branch_id:             ', row.branch_id);
    console.log('  cost_centre_id:        ', row.cost_centre_id);
    console.log('  reversed_by_voucher_id:', row.reversed_by_voucher_id);
    console.log('  reversal_of_voucher_id:', row.reversal_of_voucher_id);
    console.log('  metadata:              ', JSON.stringify(row.metadata));
    console.log('  created_at:            ', row.created_at);
    console.log('  updated_at:            ', row.updated_at);
    console.log('  deleted_at:            ', row.deleted_at);
  }

  // 2. Journal Entries & Lines Linked to these Vouchers
  console.log('\n[Step 2] Inspecting Journal Entries & Journal Lines for both Vouchers...');
  const jeRows = await client.query(`
    SELECT 
      je.id as journal_entry_id, je.entry_no, je.voucher_id, je.entry_date::text,
      je.total_debit, je.total_credit, je.is_reversed, je.narration as je_narration,
      jl.id as line_id, jl.line_no, jl.account_id, acc.code as account_code, acc.name as account_name,
      jl.debit_amount, jl.credit_amount, jl.customer_id, jl.supplier_id, jl.branch_id as line_branch_id,
      jl.narration as line_narration, jl.metadata as line_metadata
    FROM public.accounting_journal_entry je
    JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
    JOIN public.accounting_account acc ON acc.id = jl.account_id
    WHERE je.voucher_id = ANY($1)
    ORDER BY je.voucher_id, jl.line_no;
  `, [vchIds]);
  console.table(jeRows.rows);

  // 3. Independent Calculation of GL Account 1121
  console.log('\n[Step 3] Independent Calculation of GL Control Account 1121 (Accounts Receivable)...');
  const gl1121Res = await client.query(`
    SELECT 
      acc.id as account_id, acc.code, acc.name,
      COALESCE(SUM(jl.debit_amount), 0) as total_debit,
      COALESCE(SUM(jl.credit_amount), 0) as total_credit,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0) as net_receivable_balance,
      COUNT(jl.id) as line_count
    FROM public.accounting_account acc
    LEFT JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE acc.code = '1121'
    GROUP BY acc.id, acc.code, acc.name;
  `);
  console.table(gl1121Res.rows);

  // 4. Detailed Line Drilldown on GL Account 1121
  console.log('\n[Step 4] All Journal Lines Posted to GL Account 1121...');
  const lines1121 = await client.query(`
    SELECT 
      v.id as voucher_id, v.voucher_no, v.voucher_type, v.reference_id, v.voucher_date::text,
      jl.line_no, jl.debit_amount, jl.credit_amount, jl.customer_id, jl.narration
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    JOIN public.accounting_account acc ON acc.id = jl.account_id
    WHERE acc.code = '1121' AND v.status = 'POSTED' AND v.deleted_at IS NULL
    ORDER BY v.voucher_date, jl.line_no;
  `);
  console.table(lines1121.rows);

  // 5. Customer Subledger Calculation from Invoices, Receipts, Allocations, Credit Notes, Returns
  console.log('\n[Step 5] Independent Customer Receivables Subledger Audit...');
  const invSummary = await client.query(`
    SELECT 
      COUNT(*) as total_invoices,
      COALESCE(SUM(grand_total), 0) as total_invoiced_amount,
      COALESCE(SUM(paid_amount), 0) as total_paid_amount,
      COALESCE(SUM(outstanding_amount), 0) as total_outstanding_amount
    FROM public.invoice
    WHERE deleted_at IS NULL;
  `);
  console.table(invSummary.rows);

  const openInvoices = await client.query(`
    SELECT id, invoice_number, order_id, customer_id, customer_name, grand_total, paid_amount, outstanding_amount, payment_status
    FROM public.invoice
    WHERE deleted_at IS NULL AND (outstanding_amount > 0 OR payment_status NOT IN ('paid', 'PAID'));
  `);
  console.log(`  Open/Unpaid Invoices Count: ${openInvoices.rows.length}`);
  if (openInvoices.rows.length > 0) {
    console.table(openInvoices.rows);
  } else {
    console.log('  ✓ Zero open/unpaid customer invoices. All invoices have payment_status = paid.');
  }

  // Check customer receipt allocations
  const allocRes = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%receipt%';
  `);
  console.log('  Receipt tables found:', allocRes.rows.map(r => r.table_name).join(', '));

  // 6. Reconciliation Formula and Attribution Analysis
  console.log('\n[Step 6] Reconciliation Formula & Discrepancy Attribution:');
  const glBal = Number(gl1121Res.rows[0]?.net_receivable_balance || 0);
  const sodDebits = lines1121.rows
    .filter(r => vchIds.includes(r.voucher_id))
    .reduce((sum, r) => sum + Number(r.debit_amount) - Number(r.credit_amount), 0);
  const subledgerOutstanding = Number(invSummary.rows[0]?.total_outstanding_amount || 0);
  const nonSodGlBal = glBal - sodDebits;

  console.log(`  - General Ledger Account 1121 Balance: ₹${glBal.toFixed(2)}`);
  console.log(`  - Subledger Invoiced Outstanding:      ₹${subledgerOutstanding.toFixed(2)}`);
  console.log(`  - Total Historical SoD Test Vouchers:  ₹${sodDebits.toFixed(2)}`);
  console.log(`  - Remaining GL Balance after SoD:      ₹${nonSodGlBal.toFixed(2)}`);
  console.log(`  - Net Discrepancy:                     ₹${Math.abs(nonSodGlBal - subledgerOutstanding).toFixed(2)}`);

  if (glBal === sodDebits && subledgerOutstanding === 0) {
    console.log('  ✓ CONFIRMED: The ₹2,000.00 AR GL balance is 100.00% attributable to the two historical SoD test vouchers.');
    console.log('  ✓ There are zero open customer receivables and zero untracked invoice differences.');
  } else {
    console.log('  ⚠️ Other reconciling differences exist!');
  }

  await client.end();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
