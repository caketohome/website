/**
 * CakeToHome ERP — Phase 4F Step 3D.7-B AP Subledger, Aging & Reconciliation Test Suite
 *
 * SCOPE & BOUNDARIES (Step 3D.7-B):
 * 1. Supplier Statement of Account (Authoritative Chronological Subledger for Account 2111):
 *    - Accurate opening balance calculation prior to startDate.
 *    - Chronological ordering of purchases, payments, returns/debit notes, invoice voids, and payment reversals.
 *    - Running balance calculation: Balance_i = Balance_{i-1} + Credit_i - Debit_i.
 *    - Dimension tracking: voucher_no, entry_no, voucher_type, reference_type, narration, debit, credit.
 *    - Date range filtering and multi-branch isolation.
 * 2. AP Aging Schedule:
 *    - As-of-date evaluation.
 *    - Aging buckets: CURRENT (<= 0 days), DAYS_1_30, DAYS_31_60, DAYS_61_90, DAYS_90_PLUS.
 *    - Debit notes (PURCHASE_RETURN) reduce bill-wise balance due.
 *    - Payment reversals restore bill-wise balance due.
 *    - Voided purchase invoices (is_reversed = true) have 0 balance due and are excluded.
 *    - Supplier summary aggregations and grand totals.
 * 3. Operational Report Reconciliation:
 *    - PurchaseRepository.getBillWiseSummary correctly calculates balance_due with debit notes and voided invoices.
 *    - PurchaseRepository.getSupplierWiseSummary correctly aggregates total_returns and pending_value.
 * 4. AP <-> GL Reconciliation:
 *    - Verifies operational bill-wise AP total === General Ledger Account 2111 net credit balance.
 *    - Discrepancy === 0.00 across all suppliers.
 *    - Per-supplier variance === 0.00.
 * 5. Full Rollback Isolation:
 *    - Entire test suite executes inside a single BEGIN ... ROLLBACK transaction.
 *    - Zero persistent artifacts in PostgreSQL baseline.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3D.7-B AP Subledger & Aging Test Suite');
  console.log('=============================================================================\n');

  // Register TypeScript transpile hook for .ts imports
  const ts = require('../node_modules/typescript');
  require.extensions['.ts'] = function(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      }
    });
    return module._compile(compiled.outputText, filename);
  };

  const { AccountsPayableService } = require('../src/lib/services/accounts-payable.service');
  const { PurchaseRepository } = require('../src/lib/repositories/purchase.repository');
  const { StaffAccessControl, hasEffectivePermission } = require('../src/lib/staff-access-control');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0: PRE-TEST DATABASE BASELINE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/9] Verifying pre-test database baseline...');
    const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const preLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const prePayments = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const prePurchases = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const preLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const preMovements = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const preBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const preOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const preOrderPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);

    assert(preVouchers === 0, `Pre-test accounting_voucher === 0 (actual: ${preVouchers})`);
    assert(preJournals === 0, `Pre-test accounting_journal_entry === 0 (actual: ${preJournals})`);
    assert(preLines === 0, `Pre-test accounting_journal_line === 0 (actual: ${preLines})`);
    assert(prePayments === 0, `Pre-test purchase_payment === 0 (actual: ${prePayments})`);
    assert(prePurchases === 0, `Pre-test purchase === 0 (actual: ${prePurchases})`);
    assert(preLots === 0, `Pre-test inventory_cost_lot === 0 (actual: ${preLots})`);
    assert(preMovements === 0, `Pre-test inventory_movement === 0 (actual: ${preMovements})`);
    assert(preBinv === 424, `Pre-test branch_inventory === 424 (actual: ${preBinv})`);
    assert(preOrders === 173, `Pre-test order === 173 (actual: ${preOrders})`);
    assert(preOrderPayments === 53, `Pre-test payment_transaction === 53 (actual: ${preOrderPayments})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: SETUP TEST HARNESS INSIDE ROLLBACK TRANSACTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/9] Setting up test harness inside an isolated ROLLBACK transaction...');
    await client.query('BEGIN');

    // 1. Resolve branch
    const branchRes = await client.query(`
      SELECT b.id, b.name
      FROM public.branch b
      WHERE b.deleted_at IS NULL
      LIMIT 1
    `);
    const testBranch = branchRes.rows[0];
    assert(!!testBranch, `Resolved active branch ${testBranch?.name} (${testBranch?.id})`);

    // 2. Resolve catalog accessory
    const accProdRes = await client.query(`
      SELECT p.id as product_id, pv.id as variant_id, p.title
      FROM public.product p
      JOIN public.product_variant pv ON pv.product_id = p.id
      WHERE p.id = 'acc_01'
      LIMIT 1
    `);
    const testAccessory = accProdRes.rows[0];
    assert(!!testAccessory, `Resolved catalog accessory (${testAccessory?.product_id})`);

    // 3. Create 2 test suppliers
    const supplierAId = `sup_apsub_a_${Date.now()}`;
    const supplierBId = `sup_apsub_b_${Date.now()}`;

    await client.query(`
      INSERT INTO public.supplier
        (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
      VALUES
        ($1, 'Supplier Alpha Ingredients Ltd', '29AAAAA0001A1Z5', 'Karnataka', $2, true, NOW(), NOW()),
        ($3, 'Supplier Beta Packaging Co', '29BBBBB0002B1Z6', 'Karnataka', $2, true, NOW(), NOW())
    `, [supplierAId, testBranch.id, supplierBId]);
    assert(true, `Created Supplier Alpha (${supplierAId}) and Supplier Beta (${supplierBId})`);

    // 4. Resolve Accounts
    const apAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '2111'")).rows[0].id;
    const invAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1131'")).rows[0].id;
    const cgstAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1143'")).rows[0].id;
    const sgstAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1144'")).rows[0].id;
    const bankAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1112'")).rows[0].id;

    assert(!!apAcc && !!invAcc && !!cgstAcc && !!sgstAcc && !!bankAcc, 'Resolved all required accounting accounts (2111, 1131, 1143, 1144, 1112)');

    // Helper: setup posted purchase with voucher and journal
    async function createPostedBill({
      purchaseId,
      supplierId,
      invoiceNo,
      invoiceDate,
      dueDate,
      subtotal,
      cgst,
      sgst,
      total,
    }) {
      await client.query(`
        INSERT INTO public.purchase
          (id, supplier_id, branch_id, invoice_no, invoice_date, due_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, 0, $7, $8, $9, 0, $10, 'POSTED', 'usr_buyer', 'usr_mgr', NOW(), NOW(), NOW())
      `, [purchaseId, supplierId, testBranch.id, invoiceNo, invoiceDate, dueDate, subtotal, cgst, sgst, total]);

      const vchId = `vch_${purchaseId}`;
      await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'PURCHASE', $3, $4, 'FY2627', 'POSTED', $5, 'INR', 'PURCHASE', $6, 'INVOICE_POSTED', 'Purchase Bill ' || $4, 'usr_buyer', 'usr_buyer', 'usr_mgr', 'usr_fin', NOW(), NOW(), NOW())
      `, [vchId, `VCH-${invoiceNo}`, invoiceDate, testBranch.id, total, purchaseId]);

      const jeId = `je_${purchaseId}`;
      await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, $4, $5, 'FY2627', $6, $6, false, 'usr_fin', NOW())
      `, [jeId, `JE-${invoiceNo}`, vchId, invoiceDate, testBranch.id, total]);

      // Dr Inventory
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 1, $3, $4, 0, $5, $6, 'Inventory Accessories')
      `, [`jl_${purchaseId}_1`, jeId, invAcc, subtotal, testBranch.id, supplierId]);

      // Dr CGST
      if (cgst > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, 2, $3, $4, 0, $5, $6, 'Input CGST')
        `, [`jl_${purchaseId}_2`, jeId, cgstAcc, cgst, testBranch.id, supplierId]);
      }

      // Dr SGST
      if (sgst > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, 3, $3, $4, 0, $5, $6, 'Input SGST')
        `, [`jl_${purchaseId}_3`, jeId, sgstAcc, sgst, testBranch.id, supplierId]);
      }

      // Cr Accounts Payable (2111)
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 4, $3, 0, $4, $5, $6, 'Accounts Payable')
      `, [`jl_${purchaseId}_4`, jeId, apAcc, total, testBranch.id, supplierId]);
    }

    // Helper: create payment
    async function recordPayment({ paymentId, purchaseId, supplierId, amount, paymentDate, refNo }) {
      await client.query(`
        INSERT INTO public.purchase_payment
          (id, purchase_id, amount, method, payment_date, reference, created_by, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'BANK_TRANSFER', $4, $5, 'usr_disburser', NOW(), NOW())
      `, [paymentId, purchaseId, amount, paymentDate, refNo]);

      const vchId = `vch_${paymentId}`;
      await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'PAYMENT', $3, $4, 'FY2627', 'POSTED', $5, 'INR', 'PURCHASE_PAYMENT', $6, 'SUPPLIER_DISBURSEMENT', 'Payment ' || $7, 'usr_disburser', 'usr_disburser', 'usr_mgr', 'usr_fin', NOW(), NOW(), NOW())
      `, [vchId, `VCH-PAY-${refNo}`, paymentDate, testBranch.id, amount, paymentId, refNo]);

      const jeId = `je_${paymentId}`;
      await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, $4, $5, 'FY2627', $6, $6, false, 'usr_fin', NOW())
      `, [jeId, `JE-PAY-${refNo}`, vchId, paymentDate, testBranch.id, amount]);

      // Dr 2111 AP
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 1, $3, $4, 0, $5, $6, 'Accounts Payable Settlement')
      `, [`jl_${paymentId}_1`, jeId, apAcc, amount, testBranch.id, supplierId]);

      // Cr 1112 Bank
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
        VALUES
          ($1, $2, 2, $3, 0, $4, $5, 'Bank Disbursement')
      `, [`jl_${paymentId}_2`, jeId, bankAcc, amount, testBranch.id]);

      return { paymentId, vchId, jeId };
    }

    // Helper: create debit note (PURCHASE_RETURN)
    async function recordDebitNote({ returnVchId, purchaseId, supplierId, amount, taxable, cgst, sgst, returnDate, debitNoteNo }) {
      await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, metadata, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'DEBIT_NOTE', $3, $4, 'FY2627', 'POSTED', $5, 'INR', 'PURCHASE_RETURN', $6, 'PURCHASE_RETURN_POSTED', $8::jsonb, 'Supplier Debit Note ' || $7, 'usr_buyer', 'usr_buyer', 'usr_mgr', 'usr_fin', NOW(), NOW(), NOW())
      `, [returnVchId, `DN-${debitNoteNo}`, returnDate, testBranch.id, amount, purchaseId, debitNoteNo, JSON.stringify({ purchase_id: purchaseId })]);

      const jeId = `je_${returnVchId}`;
      await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, $4, $5, 'FY2627', $6, $6, false, 'usr_fin', NOW())
      `, [jeId, `JE-DN-${debitNoteNo}`, returnVchId, returnDate, testBranch.id, amount]);

      // Dr 2111 AP
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 1, $3, $4, 0, $5, $6, 'Accounts Payable Debit Note')
      `, [`jl_${returnVchId}_1`, jeId, apAcc, amount, testBranch.id, supplierId]);

      // Cr 1131 Inventory
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 2, $3, 0, $4, $5, $6, 'Inventory Return')
      `, [`jl_${returnVchId}_2`, jeId, invAcc, taxable, testBranch.id, supplierId]);

      // Cr CGST
      if (cgst > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, 3, $3, 0, $4, $5, $6, 'Input CGST Reversal')
        `, [`jl_${returnVchId}_3`, jeId, cgstAcc, cgst, testBranch.id, supplierId]);
      }

      // Cr SGST
      if (sgst > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, 4, $3, 0, $4, $5, $6, 'Input SGST Reversal')
        `, [`jl_${returnVchId}_4`, jeId, sgstAcc, sgst, testBranch.id, supplierId]);
      }
    }

    // Helper: reverse payment (3D.7-A logic)
    async function reversePayment({ paymentId, supplierId, amount, reversalDate, reason }) {
      // Soft-delete payment
      await client.query(`
        UPDATE public.purchase_payment
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [paymentId]);

      const revVchId = `vch_rev_${paymentId}`;
      const origVchId = `vch_${paymentId}`;

      // Create payment reversal voucher
      await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, reversal_of_voucher_id, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'JOURNAL', $3, $4, 'FY2627', 'POSTED', $5, 'INR', 'PURCHASE_PAYMENT_REVERSAL', $6, 'PAYMENT_REVERSED', $7, $8, 'usr_buyer', 'usr_buyer', 'usr_mgr', 'usr_fin', NOW(), NOW(), NOW())
      `, [revVchId, `VCH-REV-${paymentId}`, reversalDate, testBranch.id, amount, paymentId, origVchId, reason]);

      // Link original voucher
      await client.query(`
        UPDATE public.accounting_voucher
        SET reversed_by_voucher_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [revVchId, origVchId]);

      // Mark original journal reversed
      await client.query(`
        UPDATE public.accounting_journal_entry
        SET is_reversed = true, reversed_at = NOW()
        WHERE voucher_id = $1
      `, [origVchId]);

      // Create reversal journal
      const revJeId = `je_rev_${paymentId}`;
      await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, $4, $5, 'FY2627', $6, $6, false, 'usr_fin_sup', NOW())
      `, [revJeId, `JE-REV-${paymentId}`, revVchId, reversalDate, testBranch.id, amount]);

      // Dr 1112 Bank (restore cash)
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
        VALUES
          ($1, $2, 1, $3, $4, 0, $5, 'Bank Reversal / Dishonor')
      `, [`jl_rev_${paymentId}_1`, revJeId, bankAcc, amount, testBranch.id]);

      // Cr 2111 AP (restore liability)
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 2, $3, 0, $4, $5, $6, 'Accounts Payable Restored')
      `, [`jl_rev_${paymentId}_2`, revJeId, apAcc, amount, testBranch.id, supplierId]);
    }

    // Helper: reverse invoice (3D.6-B logic)
    async function reverseInvoice({ purchaseId, supplierId, subtotal, cgst, sgst, total, reversalDate, reason }) {
      await client.query(`
        UPDATE public.purchase
        SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"is_reversed": true}'::jsonb, updated_at = NOW()
        WHERE id = $1
      `, [purchaseId]);

      const revVchId = `vch_rev_${purchaseId}`;
      const origVchId = `vch_${purchaseId}`;

      await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, reversal_of_voucher_id, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'JOURNAL', $3, $4, 'FY2627', 'POSTED', $5, 'INR', 'PURCHASE_REVERSAL', $6, 'INVOICE_REVERSED', $7, $8, 'usr_buyer', 'usr_buyer', 'usr_mgr', 'usr_fin', NOW(), NOW(), NOW())
      `, [revVchId, `VCH-REV-${purchaseId}`, reversalDate, testBranch.id, total, purchaseId, origVchId, reason]);

      await client.query(`
        UPDATE public.accounting_voucher
        SET reversed_by_voucher_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [revVchId, origVchId]);

      await client.query(`
        UPDATE public.accounting_journal_entry
        SET is_reversed = true, reversed_at = NOW()
        WHERE voucher_id = $1
      `, [origVchId]);

      const revJeId = `je_rev_${purchaseId}`;
      await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, $4, $5, 'FY2627', $6, $6, false, 'usr_fin_sup', NOW())
      `, [revJeId, `JE-REV-${purchaseId}`, revVchId, reversalDate, testBranch.id, total]);

      // Dr 2111 AP (debit liability away)
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 1, $3, $4, 0, $5, $6, 'Accounts Payable Cancelled')
      `, [`jl_rev_${purchaseId}_1`, revJeId, apAcc, total, testBranch.id, supplierId]);

      // Cr 1131 Inventory
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 2, $3, 0, $4, $5, $6, 'Inventory Cancelled')
      `, [`jl_rev_${purchaseId}_2`, revJeId, invAcc, subtotal, testBranch.id, supplierId]);

      // Cr CGST
      if (cgst > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, 3, $3, 0, $4, $5, $6, 'Input CGST Cancelled')
        `, [`jl_rev_${purchaseId}_3`, revJeId, cgstAcc, cgst, testBranch.id, supplierId]);
      }

      // Cr SGST
      if (sgst > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, 4, $3, 0, $4, $5, $6, 'Input SGST Cancelled')
        `, [`jl_rev_${purchaseId}_4`, revJeId, sgstAcc, sgst, testBranch.id, supplierId]);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: CREATE THE 5 TRANSACTIONAL SCENARIOS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/9] Creating the 5 canonical transactional scenarios...');

    // Bill 1 (Supplier A): ₹6,000, 2026-08-01 (due 2026-08-15) -> Overdue by 41 days as of 2026-09-25 (DAYS_31_60)
    // Partial payment: ₹2,500 on 2026-08-20. Remaining: ₹3,500
    await createPostedBill({
      purchaseId: 'pur_apsub_01',
      supplierId: supplierAId,
      invoiceNo: 'INV-A-001',
      invoiceDate: '2026-08-01',
      dueDate: '2026-08-15',
      subtotal: 5084.75,
      cgst: 457.625,
      sgst: 457.625,
      total: 6000.00,
    });
    await recordPayment({
      paymentId: 'pay_apsub_01',
      purchaseId: 'pur_apsub_01',
      supplierId: supplierAId,
      amount: 2500.00,
      paymentDate: '2026-08-20',
      refNo: 'TXN-A-001',
    });
    assert(true, 'Scenario 1: Bill 1 (₹6,000) created with ₹2,500 partial payment -> ₹3,500 pending (31-60 days bucket)');

    // Bill 2 (Supplier A): ₹4,000, 2026-06-01 (due 2026-06-15) -> Overdue by 102 days as of 2026-09-25 (DAYS_90_PLUS)
    // Physical return / debit note: ₹1,000 on 2026-06-20. Remaining: ₹3,000
    await createPostedBill({
      purchaseId: 'pur_apsub_02',
      supplierId: supplierAId,
      invoiceNo: 'INV-A-002',
      invoiceDate: '2026-06-01',
      dueDate: '2026-06-15',
      subtotal: 3389.83,
      cgst: 305.085,
      sgst: 305.085,
      total: 4000.00,
    });
    await recordDebitNote({
      returnVchId: 'vch_dn_apsub_02',
      purchaseId: 'pur_apsub_02',
      supplierId: supplierAId,
      amount: 1000.00,
      taxable: 847.46,
      cgst: 76.27,
      sgst: 76.27,
      returnDate: '2026-06-20',
      debitNoteNo: 'DN-001',
    });
    assert(true, 'Scenario 2: Bill 2 (₹4,000) created with ₹1,000 debit note -> ₹3,000 pending (90+ days bucket)');

    // Bill 3 (Supplier A): ₹2,000, 2026-09-20 (due 2026-10-05) -> Not overdue as of 2026-09-25 (CURRENT)
    // Paid in full ₹2,000 on 2026-09-21, then payment reversed on 2026-09-22 via Step 3D.7-A. Remaining: ₹2,000
    await createPostedBill({
      purchaseId: 'pur_apsub_03',
      supplierId: supplierAId,
      invoiceNo: 'INV-A-003',
      invoiceDate: '2026-09-20',
      dueDate: '2026-10-05',
      subtotal: 1694.92,
      cgst: 152.54,
      sgst: 152.54,
      total: 2000.00,
    });
    await recordPayment({
      paymentId: 'pay_apsub_03',
      purchaseId: 'pur_apsub_03',
      supplierId: supplierAId,
      amount: 2000.00,
      paymentDate: '2026-09-21',
      refNo: 'TXN-A-003',
    });
    await reversePayment({
      paymentId: 'pay_apsub_03',
      supplierId: supplierAId,
      amount: 2000.00,
      reversalDate: '2026-09-22',
      reason: 'Cheque bounced due to signature mismatch',
    });
    assert(true, 'Scenario 3: Bill 3 (₹2,000) paid then reversed -> ₹2,000 restored pending (Current bucket)');

    // Bill 4 (Supplier A): ₹3,000, 2026-09-10 (due 2026-09-25).
    // Fully voided / reversed on 2026-09-12 via Step 3D.6-B. Remaining: ₹0.00
    await createPostedBill({
      purchaseId: 'pur_apsub_04',
      supplierId: supplierAId,
      invoiceNo: 'INV-A-004',
      invoiceDate: '2026-09-10',
      dueDate: '2026-09-25',
      subtotal: 2542.37,
      cgst: 228.815,
      sgst: 228.815,
      total: 3000.00,
    });
    await reverseInvoice({
      purchaseId: 'pur_apsub_04',
      supplierId: supplierAId,
      subtotal: 2542.37,
      cgst: 228.815,
      sgst: 228.815,
      total: 3000.00,
      reversalDate: '2026-09-12',
      reason: 'Billed to wrong branch by mistake',
    });
    assert(true, 'Scenario 4: Bill 4 (₹3,000) voided/reversed -> ₹0.00 pending (excluded from aging)');

    // Bill 5 (Supplier B): ₹5,000, 2026-09-01 (due 2026-09-15) -> Overdue by 10 days as of 2026-09-25 (DAYS_1_30).
    // Unpaid. Remaining: ₹5,000
    await createPostedBill({
      purchaseId: 'pur_apsub_05',
      supplierId: supplierBId,
      invoiceNo: 'INV-B-001',
      invoiceDate: '2026-09-01',
      dueDate: '2026-09-15',
      subtotal: 4237.29,
      cgst: 381.355,
      sgst: 381.355,
      total: 5000.00,
    });
    assert(true, 'Scenario 5: Supplier B Bill 5 (₹5,000) unpaid -> ₹5,000 pending (1-30 days bucket)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: VERIFY SUPPLIER STATEMENT OF ACCOUNT (SUBLEDGER 2111)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/9] Testing Supplier Statement of Account (Subledger 2111)...');

    // 3.1 Full Statement for Supplier A
    const stmtA = await AccountsPayableService.getSupplierStatement({
      supplier_id: supplierAId,
    }, client);

    assert(stmtA.supplier.name === 'Supplier Alpha Ingredients Ltd', 'Statement header reflects correct supplier name');
    assert(stmtA.opening_balance === 0, `Opening balance is 0.00 when no startDate specified (actual: ${stmtA.opening_balance})`);
    assert(stmtA.transactions.length === 9, `Contains exactly 9 chronological journal lines (actual: ${stmtA.transactions.length})`);
    assert(stmtA.closing_balance === 8500.00, `Closing balance is exactly ₹8,500.00 (actual: ${stmtA.closing_balance})`);
    assert(stmtA.total_credit === 17000.00, `Total credit is ₹17,000.00 (actual: ${stmtA.total_credit})`);
    assert(stmtA.total_debit === 8500.00, `Total debit is ₹8,500.00 (actual: ${stmtA.total_debit})`);

    // Verify chronological line order and running balance formula
    let expectedRunning = 0;
    let runningValid = true;
    for (const line of stmtA.transactions) {
      expectedRunning = Math.round((expectedRunning + line.credit_amount - line.debit_amount) * 100) / 100;
      if (line.running_balance !== expectedRunning) {
        runningValid = false;
        console.error(`Running balance mismatch at line ${line.entry_no}: expected ${expectedRunning}, got ${line.running_balance}`);
      }
    }
    assert(runningValid, 'Running balance strictly satisfies Balance_i = Balance_{i-1} + Credit_i - Debit_i across all lines');

    // 3.2 Filtered Statement for Supplier A (September only)
    // Prior transactions: Bill 2 (4000) - Return (1000) + Bill 1 (6000) - Pay (2500) = 6500 opening balance!
    const filteredStmtA = await AccountsPayableService.getSupplierStatement({
      supplier_id: supplierAId,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    }, client);

    assert(filteredStmtA.opening_balance === 6500.00, `Opening balance for Sept 2026 correctly aggregates prior transactions to ₹6,500.00 (actual: ${filteredStmtA.opening_balance})`);
    assert(filteredStmtA.transactions.length === 5, `Filtered statement contains only September transactions (actual: ${filteredStmtA.transactions.length})`);
    assert(filteredStmtA.closing_balance === 8500.00, `Filtered statement reaches identical closing balance of ₹8,500.00 (actual: ${filteredStmtA.closing_balance})`);

    // 3.3 Supplier B Statement (Isolation)
    const stmtB = await AccountsPayableService.getSupplierStatement({
      supplier_id: supplierBId,
    }, client);
    assert(stmtB.transactions.length === 1, `Supplier B statement contains exactly 1 purchase line (actual: ${stmtB.transactions.length})`);
    assert(stmtB.closing_balance === 5000.00, `Supplier B closing balance is ₹5,000.00 (actual: ${stmtB.closing_balance})`);
    assert(stmtB.total_credit === 5000.00, `Supplier B total credit is ₹5,000.00 (actual: ${stmtB.total_credit})`);
    assert(stmtB.total_debit === 0, `Supplier B total debit is ₹0.00 (actual: ${stmtB.total_debit})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: VERIFY AP AGING SCHEDULE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/9] Testing AP Aging Schedule (Buckets, As-Of-Date, Supplier Aggregation)...');

    const aging = await AccountsPayableService.getApAgingSchedule({
      as_of_date: '2026-09-25',
    }, client);

    assert(aging.summary.supplier_count === 2, `Aging schedule identifies 2 active suppliers with balances (actual: ${aging.summary.supplier_count})`);
    assert(aging.summary.bill_count === 4, `Aging schedule identifies 4 active bills (Bill 4 voided is excluded, actual: ${aging.summary.bill_count})`);
    assert(aging.summary.grand_total === 13500.00, `Grand total outstanding is ₹13,500.00 (actual: ${aging.summary.grand_total})`);
    assert(aging.summary.total_current === 2000.00, `Current bucket (<0 days) is ₹2,000.00 (Bill 3, actual: ${aging.summary.total_current})`);
    assert(aging.summary.total_1_30 === 5000.00, `1-30 days bucket is ₹5,000.00 (Bill 5, actual: ${aging.summary.total_1_30})`);
    assert(aging.summary.total_31_60 === 3500.00, `31-60 days bucket is ₹3,500.00 (Bill 1, actual: ${aging.summary.total_31_60})`);
    assert(aging.summary.total_61_90 === 0.00, `61-90 days bucket is ₹0.00 (actual: ${aging.summary.total_61_90})`);
    assert(aging.summary.total_90_plus === 3000.00, `90+ days bucket is ₹3,000.00 (Bill 2, actual: ${aging.summary.total_90_plus})`);

    // Verify Supplier A row in aging schedule
    const supARow = aging.suppliers.find(s => s.supplier_id === supplierAId);
    assert(!!supARow, 'Supplier A row exists in aging schedule');
    assert(supARow.total_outstanding === 8500.00, `Supplier A total outstanding is ₹8,500.00 (actual: ${supARow.total_outstanding})`);
    assert(supARow.current_amount === 2000.00, `Supplier A Current is ₹2,000.00 (actual: ${supARow.current_amount})`);
    assert(supARow.days_31_60 === 3500.00, `Supplier A 31-60 days is ₹3,500.00 (actual: ${supARow.days_31_60})`);
    assert(supARow.days_90_plus === 3000.00, `Supplier A 90+ days is ₹3,000.00 (actual: ${supARow.days_90_plus})`);
    assert(supARow.bill_count === 3, `Supplier A has 3 active bills (actual: ${supARow.bill_count})`);

    // Verify Supplier B row in aging schedule
    const supBRow = aging.suppliers.find(s => s.supplier_id === supplierBId);
    assert(!!supBRow, 'Supplier B row exists in aging schedule');
    assert(supBRow.total_outstanding === 5000.00, `Supplier B total outstanding is ₹5,000.00 (actual: ${supBRow.total_outstanding})`);
    assert(supBRow.days_1_30 === 5000.00, `Supplier B 1-30 days is ₹5,000.00 (actual: ${supBRow.days_1_30})`);
    assert(supBRow.bill_count === 1, `Supplier B has 1 active bill (actual: ${supBRow.bill_count})`);

    // 4.2 Aging Schedule filtered by single supplier
    const agingSingleSup = await AccountsPayableService.getApAgingSchedule({
      as_of_date: '2026-09-25',
      supplier_id: supplierAId,
    }, client);
    assert(agingSingleSup.suppliers.length === 1, `Filtered aging returns 1 supplier (actual: ${agingSingleSup.suppliers.length})`);
    assert(agingSingleSup.summary.grand_total === 8500.00, `Filtered aging grand total is ₹8,500.00 (actual: ${agingSingleSup.summary.grand_total})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: VERIFY OPERATIONAL REPORT QUERIES
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/9] Testing Operational Reports (PurchaseRepository)...');

    // 5.1 Bill-Wise Summary
    const billWise = await PurchaseRepository.getBillWiseSummary({}, client);
    const b1 = billWise.find(b => b.id === 'pur_apsub_01');
    const b2 = billWise.find(b => b.id === 'pur_apsub_02');
    const b3 = billWise.find(b => b.id === 'pur_apsub_03');
    const b4 = billWise.find(b => b.id === 'pur_apsub_04');
    const b5 = billWise.find(b => b.id === 'pur_apsub_05');

    assert(Number(b1.total_paid) === 2500.00, `Bill 1 total_paid === 2500.00 (actual: ${b1.total_paid})`);
    assert(Number(b1.total_returns) === 0.00, `Bill 1 total_returns === 0.00 (actual: ${b1.total_returns})`);
    assert(Number(b1.balance_due) === 3500.00, `Bill 1 balance_due === 3500.00 (actual: ${b1.balance_due})`);

    assert(Number(b2.total_paid) === 0.00, `Bill 2 total_paid === 0.00 (actual: ${b2.total_paid})`);
    assert(Number(b2.total_returns) === 1000.00, `Bill 2 total_returns === 1000.00 (actual: ${b2.total_returns})`);
    assert(Number(b2.balance_due) === 3000.00, `Bill 2 balance_due === 3000.00 (actual: ${b2.balance_due})`);

    assert(Number(b3.total_paid) === 0.00, `Bill 3 total_paid === 0.00 (payment was reversed, actual: ${b3.total_paid})`);
    assert(Number(b3.total_returns) === 0.00, `Bill 3 total_returns === 0.00 (actual: ${b3.total_returns})`);
    assert(Number(b3.balance_due) === 2000.00, `Bill 3 balance_due === 2000.00 (actual: ${b3.balance_due})`);

    assert(b4.is_reversed === true, `Bill 4 is_reversed === true`);
    assert(Number(b4.balance_due) === 0.00, `Bill 4 balance_due === 0.00 (voided invoice, actual: ${b4.balance_due})`);

    assert(Number(b5.total_paid) === 0.00, `Bill 5 total_paid === 0.00 (actual: ${b5.total_paid})`);
    assert(Number(b5.total_returns) === 0.00, `Bill 5 total_returns === 0.00 (actual: ${b5.total_returns})`);
    assert(Number(b5.balance_due) === 5000.00, `Bill 5 balance_due === 5000.00 (actual: ${b5.balance_due})`);

    // 5.2 Supplier-Wise Summary
    const supWise = await PurchaseRepository.getSupplierWiseSummary({}, client);
    const swA = supWise.find(s => s.supplier_id === supplierAId);
    const swB = supWise.find(s => s.supplier_id === supplierBId);

    assert(Number(swA.total_value) === 15000.00, `Supplier A total_value === 15000.00 (actual: ${swA.total_value})`);
    assert(Number(swA.total_paid) === 2500.00, `Supplier A total_paid === 2500.00 (actual: ${swA.total_paid})`);
    assert(Number(swA.total_returns) === 1000.00, `Supplier A total_returns === 1000.00 (actual: ${swA.total_returns})`);
    assert(Number(swA.pending_value) === 8500.00, `Supplier A pending_value === 8500.00 (actual: ${swA.pending_value})`);

    assert(Number(swB.total_value) === 5000.00, `Supplier B total_value === 5000.00 (actual: ${swB.total_value})`);
    assert(Number(swB.total_paid) === 0.00, `Supplier B total_paid === 0.00 (actual: ${swB.total_paid})`);
    assert(Number(swB.total_returns) === 0.00, `Supplier B total_returns === 0.00 (actual: ${swB.total_returns})`);
    assert(Number(swB.pending_value) === 5000.00, `Supplier B pending_value === 5000.00 (actual: ${swB.pending_value})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: VERIFY AP <-> GL RECONCILIATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/9] Testing AP <-> GL Reconciliation (Identity, Variances, Discrepancy)...');

    const recon = await AccountsPayableService.getApGlReconciliation({
      as_of_date: '2026-09-25',
    }, client);

    assert(recon.is_reconciled === true, `AP <-> GL is_reconciled === true (actual: ${recon.is_reconciled})`);
    assert(recon.discrepancy === 0.00, `Grand discrepancy === 0.00 (actual: ${recon.discrepancy})`);
    assert(recon.operational_ap_total === 13500.00, `Operational AP total === ₹13,500.00 (actual: ${recon.operational_ap_total})`);
    assert(recon.gl_2111_balance === 13500.00, `GL 2111 balance === ₹13,500.00 (actual: ${recon.gl_2111_balance})`);
    assert(recon.supplier_count === 2, `Reconciliation covers 2 suppliers (actual: ${recon.supplier_count})`);

    const varA = recon.supplier_variances.find(v => v.supplier_id === supplierAId);
    assert(!!varA, 'Supplier A variance item exists');
    assert(varA.operational_balance === 8500.00, `Supplier A operational balance === ₹8,500.00 (actual: ${varA.operational_balance})`);
    assert(varA.gl_2111_balance === 8500.00, `Supplier A GL 2111 balance === ₹8,500.00 (actual: ${varA.gl_2111_balance})`);
    assert(varA.variance === 0.00, `Supplier A variance === 0.00 (actual: ${varA.variance})`);
    assert(varA.is_reconciled === true, `Supplier A is_reconciled === true`);

    const varB = recon.supplier_variances.find(v => v.supplier_id === supplierBId);
    assert(!!varB, 'Supplier B variance item exists');
    assert(varB.operational_balance === 5000.00, `Supplier B operational balance === ₹5,000.00 (actual: ${varB.operational_balance})`);
    assert(varB.gl_2111_balance === 5000.00, `Supplier B GL 2111 balance === ₹5,000.00 (actual: ${varB.gl_2111_balance})`);
    assert(varB.variance === 0.00, `Supplier B variance === 0.00 (actual: ${varB.variance})`);
    assert(varB.is_reconciled === true, `Supplier B is_reconciled === true`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: EDGE CASES & ERROR HANDLING
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/9] Testing edge cases & error handling...');

    // 7.1 Non-existent supplier in getSupplierStatement throws error
    let nonExistThrew = false;
    try {
      await AccountsPayableService.getSupplierStatement({
        supplier_id: 'sup_non_existent',
      }, client);
    } catch (e) {
      nonExistThrew = true;
      assert(e.message.includes('not found'), `Non-existent supplier error message contains 'not found' (got: ${e.message})`);
    }
    assert(nonExistThrew, 'getSupplierStatement rejects non-existent supplier');

    // 7.2 Supplier with 0 transactions returns empty statement with 0 balance
    const supplierCId = `sup_apsub_c_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier
        (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
      VALUES
        ($1, 'Supplier Gamma Inactive', '29GGGGG0003G1Z7', 'Karnataka', $2, true, NOW(), NOW())
    `, [supplierCId, testBranch.id]);

    const stmtC = await AccountsPayableService.getSupplierStatement({
      supplier_id: supplierCId,
    }, client);
    assert(stmtC.opening_balance === 0, `Inactive supplier opening balance === 0 (actual: ${stmtC.opening_balance})`);
    assert(stmtC.closing_balance === 0, `Inactive supplier closing balance === 0 (actual: ${stmtC.closing_balance})`);
    assert(stmtC.total_debit === 0, `Inactive supplier total debit === 0 (actual: ${stmtC.total_debit})`);
    assert(stmtC.total_credit === 0, `Inactive supplier total credit === 0 (actual: ${stmtC.total_credit})`);
    assert(stmtC.transactions.length === 0, `Inactive supplier transactions.length === 0`);

    // 7.3 CRITICAL AS-OF TEST 1: Payment occurring AFTER asOfDate does NOT reduce historical balance
    // Bill 1 created on 2026-08-01 (₹6,000). Payment of ₹2,500 made on 2026-08-20.
    // Query as of 2026-08-10: Payment must NOT be counted yet!
    const asOfAug10 = await AccountsPayableService.getApAgingSchedule({
      as_of_date: '2026-08-10',
      supplier_id: supplierAId,
    }, client);
    const b1Aug10 = asOfAug10.suppliers[0]?.bills?.find(b => b.purchase_id === 'pur_apsub_01');
    assert(!!b1Aug10, 'Bill 1 exists in aging schedule as of 2026-08-10');
    assert(b1Aug10.paid_amount === 0.00, `Bill 1 paid_amount as of 2026-08-10 is 0.00 (actual: ${b1Aug10.paid_amount})`);
    assert(b1Aug10.balance_due === 6000.00, `Bill 1 balance_due as of 2026-08-10 is full ₹6,000.00 (actual: ${b1Aug10.balance_due})`);

    const reconAug10 = await AccountsPayableService.getApGlReconciliation({
      as_of_date: '2026-08-10',
    }, client);
    assert(reconAug10.is_reconciled === true, `AP <-> GL is reconciled as of 2026-08-10 (actual: ${reconAug10.is_reconciled})`);
    assert(reconAug10.discrepancy === 0.00, `AP <-> GL discrepancy as of 2026-08-10 is 0.00 (actual: ${reconAug10.discrepancy})`);
    assert(reconAug10.operational_ap_total === 9000.00, `Total AP as of 2026-08-10 is ₹9,000.00 [Bill 2 pending ₹3,000 + Bill 1 ₹6,000] (actual: ${reconAug10.operational_ap_total})`);

    // 7.4 CRITICAL AS-OF TEST 2: Debit Note occurring AFTER asOfDate does NOT reduce historical balance
    // Bill 2 created on 2026-06-01 (₹4,000). Debit note of ₹1,000 posted on 2026-06-20.
    // Query as of 2026-06-10: Debit note must NOT be counted yet!
    const asOfJun10 = await AccountsPayableService.getApAgingSchedule({
      as_of_date: '2026-06-10',
      supplier_id: supplierAId,
    }, client);
    const b2Jun10 = asOfJun10.suppliers[0]?.bills?.find(b => b.purchase_id === 'pur_apsub_02');
    assert(!!b2Jun10, 'Bill 2 exists in aging schedule as of 2026-06-10');
    assert(b2Jun10.returns_amount === 0.00, `Bill 2 returns_amount as of 2026-06-10 is 0.00 (actual: ${b2Jun10.returns_amount})`);
    assert(b2Jun10.balance_due === 4000.00, `Bill 2 balance_due as of 2026-06-10 is full ₹4,000.00 (actual: ${b2Jun10.balance_due})`);

    const reconJun10 = await AccountsPayableService.getApGlReconciliation({
      as_of_date: '2026-06-10',
    }, client);
    assert(reconJun10.is_reconciled === true, `AP <-> GL is reconciled as of 2026-06-10`);
    assert(reconJun10.discrepancy === 0.00, `AP <-> GL discrepancy as of 2026-06-10 is 0.00`);
    assert(reconJun10.operational_ap_total === 4000.00, `Total AP as of 2026-06-10 is ₹4,000.00 [Bill 2 only] (actual: ${reconJun10.operational_ap_total})`);

    // 7.5 CRITICAL AS-OF TEST 3: Payment reversal occurring AFTER asOfDate leaves the payment active as of asOfDate
    // Bill 3 created on 2026-09-20 (₹2,000). Paid ₹2,000 on 2026-09-21. Reversed on 2026-09-22.
    // Query as of 2026-09-21: The payment WAS made, and reversal on 2026-09-22 has NOT occurred yet!
    // Therefore, as of 2026-09-21, Bill 3 was fully paid (balance_due === 0.00)!
    const asOfSep21 = await AccountsPayableService.getApAgingSchedule({
      as_of_date: '2026-09-21',
      supplier_id: supplierAId,
    }, client);
    const b3Sep21 = asOfSep21.suppliers[0]?.bills?.find(b => b.purchase_id === 'pur_apsub_03');
    assert(!b3Sep21, 'Bill 3 is excluded from outstanding aging bills on 2026-09-21 because it was fully paid prior to reversal');
    assert(asOfSep21.suppliers[0]?.total_outstanding === 6500.00, `Supplier A total outstanding as of 2026-09-21 is ₹6,500.00 (Bill 1 + Bill 2, Bill 3 fully paid) (actual: ${asOfSep21.suppliers[0]?.total_outstanding})`);

    const reconSep21 = await AccountsPayableService.getApGlReconciliation({
      as_of_date: '2026-09-21',
    }, client);
    assert(reconSep21.is_reconciled === true, `AP <-> GL is reconciled as of 2026-09-21`);
    assert(reconSep21.discrepancy === 0.00, `AP <-> GL discrepancy as of 2026-09-21 is 0.00`);
    // On Sept 21: Bill 1 (3500) + Bill 2 (3000) + Bill 3 (0) + Bill 4 (voided on Sep 12: 0) + Bill 5 (5000) = 11,500.00
    assert(reconSep21.operational_ap_total === 11500.00, `Total AP as of 2026-09-21 is ₹11,500.00 (actual: ${reconSep21.operational_ap_total})`);
    assert(reconSep21.gl_2111_balance === 11500.00, `GL 2111 balance as of 2026-09-21 is ₹11,500.00 (actual: ${reconSep21.gl_2111_balance})`);

    // 7.6 CRITICAL AS-OF TEST 4: Invoice reversal occurring AFTER asOfDate leaves the invoice active as of asOfDate
    // Bill 4 created on 2026-09-10 (₹3,000). Voided/reversed on 2026-09-12.
    // Query as of 2026-09-11: Bill 4 was NOT yet voided! Must be active with balance ₹3,000.00!
    const asOfSep11 = await AccountsPayableService.getApAgingSchedule({
      as_of_date: '2026-09-11',
      supplier_id: supplierAId,
    }, client);
    const b4Sep11 = asOfSep11.suppliers[0]?.bills?.find(b => b.purchase_id === 'pur_apsub_04');
    assert(!!b4Sep11, 'Bill 4 exists in aging schedule as of 2026-09-11');
    assert(b4Sep11.balance_due === 3000.00, `Bill 4 balance_due as of 2026-09-11 is ₹3,000.00 (actual: ${b4Sep11.balance_due})`);

    const reconSep11 = await AccountsPayableService.getApGlReconciliation({
      as_of_date: '2026-09-11',
    }, client);
    assert(reconSep11.is_reconciled === true, `AP <-> GL is reconciled as of 2026-09-11`);
    assert(reconSep11.discrepancy === 0.00, `AP <-> GL discrepancy as of 2026-09-11 is 0.00`);
    // On Sept 11: Bill 1 (3500) + Bill 2 (3000) + Bill 4 (3000) + Bill 5 (5000) = 14,500.00
    assert(reconSep11.operational_ap_total === 14500.00, `Total AP as of 2026-09-11 is ₹14,500.00 (actual: ${reconSep11.operational_ap_total})`);
    assert(reconSep11.gl_2111_balance === 14500.00, `GL 2111 balance as of 2026-09-11 is ₹14,500.00 (actual: ${reconSep11.gl_2111_balance})`);

    // 7.7 SERVER-SIDE SECURITY & RBAC VERIFICATION
    // Actor lacking ACCOUNTING.VIEW is rejected
    const unprivilegedActor = {
      id: 'usr_staff_no_perm',
      role: 'TELECALLER',
      branch_id: testBranch.id,
      permissions: ['TELEMARKETING.VIEW'],
    };

    let rbacStmtThrew = false;
    try {
      await AccountsPayableService.getSupplierStatement({
        supplier_id: supplierAId,
        actorContext: unprivilegedActor,
      }, client);
    } catch (e) {
      rbacStmtThrew = true;
      assert(e.message.includes('PERMISSION_DENIED'), `Statement rejects unprivileged user (got: ${e.message})`);
    }
    assert(rbacStmtThrew, 'getSupplierStatement enforces ACCOUNTING.VIEW permission');

    let rbacAgingThrew = false;
    try {
      await AccountsPayableService.getApAgingSchedule({
        actorContext: unprivilegedActor,
      }, client);
    } catch (e) {
      rbacAgingThrew = true;
      assert(e.message.includes('PERMISSION_DENIED'), `Aging rejects unprivileged user (got: ${e.message})`);
    }
    assert(rbacAgingThrew, 'getApAgingSchedule enforces ACCOUNTING.VIEW permission');

    let rbacReconThrew = false;
    try {
      await AccountsPayableService.getApGlReconciliation({
        actorContext: unprivilegedActor,
      }, client);
    } catch (e) {
      rbacReconThrew = true;
      assert(e.message.includes('PERMISSION_DENIED'), `Reconciliation rejects unprivileged user (got: ${e.message})`);
    }
    assert(rbacReconThrew, 'getApGlReconciliation enforces ACCOUNTING.VIEW permission');

    // 7.8 BRANCH ISOLATION VERIFICATION
    // Actor from Branch X cannot request Branch Y data
    const branchBoundActor = {
      id: 'usr_branch_mgr',
      role: 'STORE_MANAGER',
      branch_id: testBranch.id,
      permissions: ['ACCOUNTING.VIEW'],
    };

    let crossBranchThrew = false;
    try {
      await AccountsPayableService.getApAgingSchedule({
        branch_id: 'br_other_foreign_branch',
        actorContext: branchBoundActor,
      }, client);
    } catch (e) {
      crossBranchThrew = true;
      assert(e.message.includes('BRANCH_ACCESS_DENIED'), `Cross-branch query is blocked (got: ${e.message})`);
    }
    assert(crossBranchThrew, 'Cross-branch access is strictly denied for branch-bound staff');

    // Authorized actor succeeds
    const authorizedActor = {
      id: 'usr_accountant',
      role: 'ACCOUNTANT',
      branch_id: testBranch.id,
      permissions: ['ACCOUNTING.VIEW'],
    };
    const authRecon = await AccountsPayableService.getApGlReconciliation({
      actorContext: authorizedActor,
    }, client);
    assert(authRecon.is_reconciled === true, 'Authorized accountant with ACCOUNTING.VIEW can generate AP <-> GL reconciliation');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: TRANSACTION ROLLBACK & POST-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/9] Rolling back test transaction and verifying pristine database baseline...');
    await client.query('ROLLBACK');

    const postVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const postJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const postLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const postPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const postPurchases = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const postLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const postMovements = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const postBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const postOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const postOrderPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);

    assert(postVouchers === 0, `Post-test accounting_voucher === 0 (actual: ${postVouchers})`);
    assert(postJournals === 0, `Post-test accounting_journal_entry === 0 (actual: ${postJournals})`);
    assert(postLines === 0, `Post-test accounting_journal_line === 0 (actual: ${postLines})`);
    assert(postPayments === 0, `Post-test purchase_payment === 0 (actual: ${postPayments})`);
    assert(postPurchases === 0, `Post-test purchase === 0 (actual: ${postPurchases})`);
    assert(postLots === 0, `Post-test inventory_cost_lot === 0 (actual: ${postLots})`);
    assert(postMovements === 0, `Post-test inventory_movement === 0 (actual: ${postMovements})`);
    assert(postBinv === 424, `Post-test branch_inventory === 424 (actual: ${postBinv})`);
    assert(postOrders === 173, `Post-test order === 173 (actual: ${postOrders})`);
    assert(postOrderPayments === 53, `Post-test payment_transaction === 53 (actual: ${postOrderPayments})`);

    // Verify unconfigured fail-closed baseline
    const settingRes = await client.query("SELECT value FROM public.setting WHERE key = 'accounting.start_date'");
    assert(settingRes.rows.length === 0, 'Accounting start date remains unconfigured in baseline');

    const fpRes = await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period');
    assert(parseInt(fpRes.rows[0].count, 10) === 0, 'Accounting fiscal periods remain unconfigured in baseline');

    console.log('\n=============================================================================');
    console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
    console.log('=============================================================================\n');

    await client.end();
    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    await client.end();
    process.exit(1);
  }
}

runTests();
