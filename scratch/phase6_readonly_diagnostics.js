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
  throw new Error("DATABASE_URL not found in frontend/.env");
}

async function runReadOnlyDiagnostics() {
  const client = new Client({
    connectionString: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("================================================================================");
  console.log("CAKETOHOME ERP — PHASE 6 READ-ONLY FORENSIC FINANCIAL DIAGNOSTICS");
  console.log("================================================================================\n");

  try {
    // 1. TRIAL BALANCE & OVERALL GENERAL LEDGER
    console.log("--- 1. GENERAL LEDGER TRIAL BALANCE (ALL POSTED VOUCHERS) ---");
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

    let totalDr = 0;
    let totalCr = 0;
    console.log("Code  | Account Name                        | Type       | Total Debit (₹) | Total Credit (₹) | Net Debit (₹)");
    console.log("---------------------------------------------------------------------------------------------------------");
    for (const r of tbRes.rows) {
      const dr = Number(r.total_debit);
      const cr = Number(r.total_credit);
      const net = Number(r.net_debit);
      totalDr += dr;
      totalCr += cr;
      console.log(`${r.code.padEnd(5)} | ${r.name.padEnd(35)} | ${r.type.padEnd(10)} | ${dr.toFixed(2).padStart(15)} | ${cr.toFixed(2).padStart(16)} | ${net.toFixed(2).padStart(15)}`);
    }
    console.log("---------------------------------------------------------------------------------------------------------");
    console.log(`TOTALS: Debit = ₹${totalDr.toFixed(2)}, Credit = ₹${totalCr.toFixed(2)}, Net Difference = ₹${Math.abs(totalDr - totalCr).toFixed(2)}\n`);

    // 2. CASH ACCOUNTS AUDIT (1111, 1114, 1122, 1118)
    console.log("--- 2. DETAILED AUDIT OF CASH & CASH-EQUIVALENT ACCOUNTS ---");
    const cashLinesRes = await client.query(`
      SELECT 
        a.code as account_code,
        a.name as account_name,
        v.id as voucher_id,
        v.voucher_no,
        v.voucher_type,
        v.voucher_date,
        v.reference_type,
        v.reference_id,
        v.narration,
        l.debit_amount,
        l.credit_amount,
        v.branch_id
      FROM public.accounting_journal_line l
      JOIN public.accounting_account a ON a.id = l.account_id
      JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = e.voucher_id
      WHERE a.code IN ('1111', '1114', '1122', '1118') AND v.status = 'POSTED'
      ORDER BY a.code, v.voucher_date ASC, v.created_at ASC;
    `);

    console.log(`Found ${cashLinesRes.rows.length} posted journal lines on cash accounts (1111, 1114, 1122, 1118):`);
    for (const l of cashLinesRes.rows) {
      console.log(`[${l.account_code} ${l.account_name}] Vch: ${l.voucher_no} (${l.voucher_type}) | Date: ${l.voucher_date ? new Date(l.voucher_date).toISOString().slice(0, 10) : 'N/A'} | Ref: ${l.reference_type}:${l.reference_id} | Dr: ₹${Number(l.debit_amount).toFixed(2)} | Cr: ₹${Number(l.credit_amount).toFixed(2)} | Branch: ${l.branch_id} | Narration: ${l.narration}`);
    }
    console.log("");

    // 3. PHYSICAL CASH CUSTODY VS DRAWER BALANCES
    console.log("--- 3. TELLER CASH CUSTODY & DRAWER SESSIONS ---");
    try {
      const sessCols = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teller_session'
      `);
      console.log("teller_session columns:", sessCols.rows.map(r => r.column_name).join(", "));
      
      const sessionsRes = await client.query(`
        SELECT * FROM public.teller_session ORDER BY created_at DESC LIMIT 10
      `);
      console.log(`Recent teller sessions count: ${sessionsRes.rows.length}`);
      for (const s of sessionsRes.rows) {
        console.log(`Session: ${s.id} | Branch: ${s.branch_id} | Status: ${s.status} | Float: ₹${Number(s.opening_float || 0).toFixed(2)} | Expected: ₹${Number(s.expected_cash || 0).toFixed(2)} | Actual: ₹${Number(s.actual_cash || s.closing_balance || 0).toFixed(2)}`);
      }
    } catch (err) {
      console.warn("teller_session inspect error:", err.message);
    }
    console.log("");

    // COD Handover records
    try {
      const handoverRes = await client.query(`
        SELECT * FROM public.delivery_cash_handover ORDER BY created_at DESC LIMIT 10
      `);
      console.log(`Recent Delivery COD Handovers: ${handoverRes.rows.length}`);
      for (const h of handoverRes.rows) {
        console.log(`Handover ${h.id} | Branch: ${h.branch_id} | Status: ${h.status} | Expected: ₹${Number(h.expected_amount || 0).toFixed(2)} | Declared: ₹${Number(h.declared_amount || 0).toFixed(2)} | Actual: ₹${Number(h.actual_amount || 0).toFixed(2)} | Voucher: ${h.voucher_id}`);
      }
    } catch (err) {
      console.warn("delivery_cash_handover inspect error:", err.message);
    }
    console.log("");

    // 4. AR & HISTORICAL VOUCHERS AUDIT
    console.log("--- 4. ACCOUNTS RECEIVABLE (1121) & HISTORICAL VOUCHERS AUDIT ---");
    const arLinesRes = await client.query(`
      SELECT 
        v.id as voucher_id,
        v.voucher_no,
        v.voucher_type,
        v.voucher_date,
        v.reference_type,
        v.reference_id,
        v.narration,
        l.debit_amount,
        l.credit_amount,
        v.metadata
      FROM public.accounting_journal_line l
      JOIN public.accounting_account a ON a.id = l.account_id
      JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = e.voucher_id
      WHERE a.code = '1121' AND v.status = 'POSTED'
      ORDER BY v.created_at ASC;
    `);
    console.log(`Total posted AR journal lines on 1121: ${arLinesRes.rows.length}`);
    let arDrSum = 0;
    let arCrSum = 0;
    for (const l of arLinesRes.rows) {
      const dr = Number(l.debit_amount);
      const cr = Number(l.credit_amount);
      arDrSum += dr;
      arCrSum += cr;
      console.log(`AR Line: Voucher ${l.voucher_no} (${l.voucher_type}) | Date: ${l.voucher_date ? new Date(l.voucher_date).toISOString().slice(0, 10) : 'N/A'} | Ref: ${l.reference_type}:${l.reference_id} | Dr: ₹${dr.toFixed(2)} | Cr: ₹${cr.toFixed(2)} | Narration: ${l.narration}`);
    }
    console.log(`AR (1121) Net Ledger Balance: ₹${(arDrSum - arCrSum).toFixed(2)} (Debit: ₹${arDrSum.toFixed(2)}, Credit: ₹${arCrSum.toFixed(2)})\n`);

    // Specifically inspect the 2 SoD vouchers:
    const sodVouchersRes = await client.query(`
      SELECT 
        v.*,
        e.id as journal_entry_id,
        e.entry_no
      FROM public.accounting_voucher v
      LEFT JOIN public.accounting_journal_entry e ON e.voucher_id = v.id
      WHERE v.id IN ('vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8');
    `);
    console.log("Historical SoD Vouchers Details:");
    for (const v of sodVouchersRes.rows) {
      console.log(`Voucher ID: ${v.id} | No: ${v.voucher_no} | Type: ${v.voucher_type} | Status: ${v.status} | Amount: ₹${Number(v.total_amount).toFixed(2)} | RefType: ${v.reference_type} | RefId: ${v.reference_id} | CreatedBy: ${v.created_by} | ApprovedBy: ${v.approved_by} | PostedBy: ${v.posted_by}`);
      const lines = await client.query(`
        SELECT l.debit_amount, l.credit_amount, a.code, a.name
        FROM public.accounting_journal_line l
        JOIN public.accounting_account a ON a.id = l.account_id
        WHERE l.journal_entry_id = $1
      `, [v.journal_entry_id]);
      for (const line of lines.rows) {
        console.log(`    Line -> Account: ${line.code} (${line.name}) | Dr: ₹${Number(line.debit_amount).toFixed(2)} | Cr: ₹${Number(line.credit_amount).toFixed(2)}`);
      }
    }
    console.log("");

    // Invoices summary
    const invSummaryRes = await client.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(grand_total) as total_grand,
        SUM(paid_amount) as total_paid,
        SUM(outstanding_amount) as total_outstanding
      FROM public.invoice
      GROUP BY status
      ORDER BY status;
    `);
    console.log("Invoices Summary by Status in public.invoice:");
    for (const s of invSummaryRes.rows) {
      console.log(`Status: ${s.status.padEnd(15)} | Count: ${String(s.count).padStart(3)} | Grand: ₹${Number(s.total_grand).toFixed(2).padStart(12)} | Paid: ₹${Number(s.total_paid).toFixed(2).padStart(12)} | Outstanding: ₹${Number(s.total_outstanding).toFixed(2).padStart(12)}`);
    }

    const legacyInvoicesRes = await client.query(`
      SELECT invoice_number, grand_total, paid_amount, outstanding_amount, status, voucher_id, order_id
      FROM public.invoice
      WHERE invoice_number LIKE 'CTH/26-27/00003%'
      ORDER BY invoice_number;
    `);
    console.log(`\nLegacy Prototype Invoices (${legacyInvoicesRes.rows.length}):`);
    for (const inv of legacyInvoicesRes.rows) {
      console.log(`Invoice: ${inv.invoice_number} | Status: ${inv.status} | Total: ₹${Number(inv.grand_total).toFixed(2)} | Paid: ₹${Number(inv.paid_amount).toFixed(2)} | Outstanding: ₹${Number(inv.outstanding_amount).toFixed(2)} | Voucher: ${inv.voucher_id || 'NONE'} | Order: ${inv.order_id}`);
    }
    console.log("");

    // 5. AP & SUPPLIER AUDIT (2111)
    console.log("--- 5. ACCOUNTS PAYABLE (2111) & PURCHASES AUDIT ---");
    const apLinesRes = await client.query(`
      SELECT 
        v.id as voucher_id,
        v.voucher_no,
        v.voucher_type,
        v.voucher_date,
        v.reference_type,
        v.reference_id,
        v.narration,
        l.debit_amount,
        l.credit_amount
      FROM public.accounting_journal_line l
      JOIN public.accounting_account a ON a.id = l.account_id
      JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = e.voucher_id
      WHERE a.code = '2111' AND v.status = 'POSTED'
      ORDER BY v.created_at ASC;
    `);
    console.log(`Total posted AP journal lines on 2111: ${apLinesRes.rows.length}`);
    let apDrSum = 0;
    let apCrSum = 0;
    for (const l of apLinesRes.rows) {
      const dr = Number(l.debit_amount);
      const cr = Number(l.credit_amount);
      apDrSum += dr;
      apCrSum += cr;
      console.log(`AP Line: Voucher ${l.voucher_no} (${l.voucher_type}) | Date: ${l.voucher_date ? new Date(l.voucher_date).toISOString().slice(0, 10) : 'N/A'} | Ref: ${l.reference_type}:${l.reference_id} | Dr: ₹${dr.toFixed(2)} | Cr: ₹${cr.toFixed(2)} | Narration: ${l.narration}`);
    }
    console.log(`AP (2111) Net Ledger Balance: ₹${(apCrSum - apDrSum).toFixed(2)} (Credit: ₹${apCrSum.toFixed(2)}, Debit: ₹${apDrSum.toFixed(2)})\n`);

    const purchasesSummaryRes = await client.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(total) as total_amount
      FROM public.purchase
      WHERE deleted_at IS NULL
      GROUP BY status
      ORDER BY status;
    `);
    console.log(`Purchases Summary by Status in public.purchase:`);
    for (const p of purchasesSummaryRes.rows) {
      console.log(`Status: ${p.status.padEnd(15)} | Count: ${String(p.count).padStart(3)} | Total: ₹${Number(p.total_amount).toFixed(2).padStart(12)}`);
    }
    console.log("");

    // 6. EXPENSES & BANK RECONCILIATION
    console.log("--- 6. EXPENSES & BANK RECONCILIATION AUDIT ---");
    const expCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'expense'
    `);
    console.log("public.expense columns:", expCols.rows.map(r => r.column_name).join(", "));

    const expAmtCol = 'total';

    const expSummaryRes = await client.query(`
      SELECT 
        status,
        payment_method,
        COUNT(*) as count,
        SUM(${expAmtCol}) as total_amount
      FROM public.expense
      GROUP BY status, payment_method
      ORDER BY status, payment_method;
    `);
    console.log("Expenses Summary by Status and Payment Method in public.expense:");
    for (const e of expSummaryRes.rows) {
      console.log(`Status: ${e.status.padEnd(15)} | Method: ${(e.payment_method || 'N/A').padEnd(15)} | Count: ${String(e.count).padStart(3)} | Amount: ₹${Number(e.total_amount).toFixed(2).padStart(10)}`);
    }

    const expVouchersRes = await client.query(`
      SELECT 
        v.id,
        v.voucher_no,
        v.status,
        v.total_amount,
        v.narration,
        v.reference_id
      FROM public.accounting_voucher v
      WHERE v.voucher_no IN ('VCH-EXPENSE-FY2026-27-20261005-3TTZ8T', 'VCH-EXPENSE-FY2026-27-20261005-23MZ39');
    `);
    console.log("\nHistorical Expense Vouchers:");
    for (const v of expVouchersRes.rows) {
      console.log(`Voucher: ${v.voucher_no} | Status: ${v.status} | Total: ₹${Number(v.total_amount).toFixed(2)} | Ref: ${v.reference_id} | Narration: ${v.narration}`);
    }
    console.log("");

    // Bank deposit slips
    try {
      const slipsRes = await client.query(`
        SELECT * FROM public.bank_deposit_slip ORDER BY created_at DESC LIMIT 10
      `);
      console.log(`Bank Deposit Slips: ${slipsRes.rows.length}`);
      for (const s of slipsRes.rows) {
        console.log(`Slip: ${s.slip_number} | Branch: ${s.branch_id} | Status: ${s.status} | Declared: ₹${Number(s.declared_amount || 0).toFixed(2)} | Verified: ₹${s.verified_amount != null ? Number(s.verified_amount).toFixed(2) : 'N/A'} | TransitVch: ${s.transit_voucher_id} | ClearedVch: ${s.cleared_voucher_id}`);
      }
    } catch (err) {
      console.warn("bank_deposit_slip inspect error:", err.message);
    }
    console.log("");

    // 7. DOUBLE-ENTRY INTEGRITY CHECK ACROSS ALL POSTED VOUCHERS
    console.log("--- 7. GENERAL LEDGER EQUILIBRIUM & UNBALANCED ENTRIES CHECK ---");
    const unbalRes = await client.query(`
      SELECT 
        v.id as voucher_id,
        v.voucher_no,
        v.voucher_type,
        e.id as entry_id,
        SUM(l.debit_amount) as total_debit,
        SUM(l.credit_amount) as total_credit,
        ABS(SUM(l.debit_amount) - SUM(l.credit_amount)) as diff
      FROM public.accounting_journal_entry e
      JOIN public.accounting_voucher v ON v.id = e.voucher_id
      JOIN public.accounting_journal_line l ON l.journal_entry_id = e.id
      WHERE v.status = 'POSTED'
      GROUP BY v.id, v.voucher_no, v.voucher_type, e.id
      HAVING ABS(SUM(l.debit_amount) - SUM(l.credit_amount)) > 0.001;
    `);
    if (unbalRes.rows.length === 0) {
      console.log("✓ Double-entry equilibrium confirmed: 100% of posted journal entries are perfectly balanced (Debits === Credits to the exact paise).\n");
    } else {
      console.log(`⚠ Found ${unbalRes.rows.length} UNBALANCED journal entries:`);
      for (const u of unbalRes.rows) {
        console.log(`Unbalanced: Voucher ${u.voucher_no} (${u.voucher_id}) | Entry ${u.entry_id} | Dr: ₹${u.total_debit} | Cr: ₹${u.total_credit} | Diff: ₹${u.diff}`);
      }
      console.log("");
    }

  } finally {
    await client.end();
  }
}

runReadOnlyDiagnostics().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
