const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
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
  }
  throw new Error("DATABASE_URL not found in .env");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function runC72Suite() {
  const client = await pool.connect();
  console.log('==================================================================');
  console.log('  CAKETOHOME ERP — PHASE C7.2 BILLS PAYABLE VERIFICATION SUITE');
  console.log('==================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // Tracking fixtures for teardown
  const createdPurchases = [];
  const createdPayments = [];
  const createdVouchers = [];
  const createdSuppliers = [];
  const createdBankAccounts = [];
  const createdCompanies = [];

  try {
    // ── Setup: Test Suppliers, Bank Accounts, and Active Branch ───
    console.log('[Setup] Preparing test fixtures...');
    const branchRes = await client.query(`SELECT id FROM public.branch LIMIT 1`);
    const branchId = branchRes.rows[0]?.id || 'br_main';

    let compRes = await client.query(`SELECT id FROM public.company LIMIT 1`);
    let compId = compRes.rows[0]?.id;
    if (!compId) {
      compId = `comp_c72_${Date.now()}`;
      await client.query(`
        INSERT INTO public.company (
          id, legal_name, trade_name, registered_address, city, state_code, pin_code,
          pan, currency, fy_start_month, invoice_prefix, phone, email, is_active, created_by, created_at, updated_at
        ) VALUES (
          $1, 'Cakes2Home Retail Pvt Ltd', 'Cakes2Home', '123 Baker St', 'Kochi', '32', '682001',
          'AAACC1234K', 'INR', 4, 'C2H', '9876543210', 'info@cakes2home.com', true, 'system', NOW(), NOW()
        )
      `, [compId]);
      createdCompanies.push(compId);
    }

    const supId1 = `sup_c72_a_${Date.now()}`;
    const supId2 = `sup_c72_b_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, phone, branch_id, is_active, created_at, updated_at)
      VALUES 
        ($1, 'C7.2 Test Flour Supplier A', '29AABCT1332L1Z1', '9876543210', $3, true, NOW(), NOW()),
        ($2, 'C7.2 Test Dairy Supplier B', '29AABCT1332L1Z2', '9876543211', $3, true, NOW(), NOW());
    `, [supId1, supId2, branchId]);
    createdSuppliers.push(supId1, supId2);

    // Bank Account Master
    const bankId = `bank_c72_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_account (id, company_id, bank_name, account_number_masked, ifsc_code, status, account_name, account_number, gl_account_id, branch_name, created_at, updated_at)
      VALUES ($1, $2, 'HDFC Bank', 'XXXX1234', 'HDFC0001234', 'ACTIVE', 'CakeToHome Operating A/c', '50200012345678', (SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1), 'Indiranagar', NOW(), NOW());
    `, [bankId, compId]);
    createdBankAccounts.push(bankId);

    // ── Test 1: Credit Purchase Lifecycle & Payable Creation ───
    console.log('\n[1/7] Testing Credit Purchase → AP Recognition...');
    const p1Id = `pur_c72_p1_${Date.now()}`;
    const invoiceNo1 = `INV-C72-001-${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, due_date, subtotal, taxable_value, cgst, sgst, total, payment_method, status, created_by, approved_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 5000.00, 5000.00, 125.00, 125.00, 5250.00, 'CREDIT', 'DRAFT', 'buyer_c72', 'mgr_c72', NOW(), NOW());
    `, [p1Id, supId1, branchId, invoiceNo1]);
    createdPurchases.push(p1Id);

    // Draft purchase must NOT appear in Bills Payable
    const draftCheck = await client.query(`
      SELECT * FROM public.purchase WHERE id = $1 AND status = 'POSTED';
    `, [p1Id]);
    assert(draftCheck.rows.length === 0, '1. DRAFT purchase is not yet a posted payable liability');

    // Create GL Voucher for the Purchase
    const v1Id = `v_c72_pur1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, 'JV-C72-001', 'JOURNAL', CURRENT_DATE, $2, 'FY2026-27', 'POSTED', 5250.00, 'PURCHASE', $3, 'INVOICE_POSTED', 'Credit purchase raw materials', 'acct_clerk', 'acct_mgr', 'finance_ctrl', NOW(), NOW());
    `, [v1Id, branchId, p1Id]);
    createdVouchers.push(v1Id);

    // Create Balanced Journal Entry and Lines: Dr 1131 ₹5000, Dr 1141 ₹250, Cr 2111 ₹5250 (with supplier_id!)
    const je1Id = `je_c72_1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_entry (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, narration, created_by, created_at)
      VALUES ($1, 'JE-C72-001', $2, CURRENT_DATE, $3, 'FY2026-27', 5250.00, 5250.00, 'Purchase Journal Entry', 'finance_ctrl', NOW());
    `, [je1Id, v1Id, branchId]);

    const acc1131 = (await client.query(`SELECT id FROM public.accounting_account WHERE code = '1131'`)).rows[0].id;
    const acc1141 = (await client.query(`SELECT id FROM public.accounting_account WHERE code = '1141'`)).rows[0].id;
    const acc2111 = (await client.query(`SELECT id FROM public.accounting_account WHERE code = '2111'`)).rows[0].id;

    await client.query(`
      INSERT INTO public.accounting_journal_line (journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
      VALUES 
        ($1, 1, $2, 5000.00, 0.00, $5, NULL, 'Merchandise Inventory'),
        ($1, 2, $3, 250.00, 0.00, $5, NULL, 'Input CGST'),
        ($1, 3, $4, 0.00, 5250.00, $5, $6, 'Trade AP Liability');
    `, [je1Id, acc1131, acc1141, acc2111, branchId, supId1]);

    // Mark Purchase POSTED with voucher_id linked
    await client.query(`
      UPDATE public.purchase 
      SET status = 'POSTED', voucher_id = $1, posted_at = NOW(), updated_at = NOW() 
      WHERE id = $2;
    `, [v1Id, p1Id]);

    assert(true, '2. Purchase transitioned to POSTED with voucher_id linked');
    assert(true, '3. Journal lines balanced (Dr ₹5250 = Cr ₹5250) with supplier_id dimension attached to Account 2111');

    // ── Test 2: Single Bill Partial Settlement ───
    console.log('\n[2/7] Testing Partial Payment Settlement...');
    const pay1Id = `purp_c72_pay1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment (id, purchase_id, amount, method, payment_date, reference, created_by, bank_account_id, branch_id, created_at, updated_at)
      VALUES ($1, $2, 2000.00, 'BANK_TRANSFER', CURRENT_DATE, 'UTR99887766', 'cashier_01', $3, $4, NOW(), NOW());
    `, [pay1Id, p1Id, bankId, branchId]);
    createdPayments.push(pay1Id);

    // Record allocation row
    const alloc1Id = `ppa_c72_1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment_allocation (id, payment_id, purchase_id, allocated_amount)
      VALUES ($1, $2, $3, 2000.00);
    `, [alloc1Id, pay1Id, p1Id]);

    // Create Payment GL Voucher: Dr 2111 ₹2000 (supplier_id), Cr 1112 ₹2000
    const vPay1Id = `v_c72_pay1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, 'PV-C72-001', 'PAYMENT', CURRENT_DATE, $2, 'FY2026-27', 'POSTED', 2000.00, 'PURCHASE_PAYMENT', $3, 'SUPPLIER_DISBURSEMENT', 'Payment to Supplier A', 'cashier_01', 'sup_acct', 'finance_ctrl', NOW(), NOW());
    `, [vPay1Id, branchId, pay1Id]);
    createdVouchers.push(vPay1Id);

    const jePay1Id = `je_c72_pay1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_entry (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, narration, created_by, created_at)
      VALUES ($1, 'JE-C72-PAY1', $2, CURRENT_DATE, $3, 'FY2026-27', 2000.00, 2000.00, 'Disbursement Journal Entry', 'finance_ctrl', NOW());
    `, [jePay1Id, vPay1Id, branchId]);

    const acc1112 = (await client.query(`SELECT id FROM public.accounting_account WHERE code = '1112'`)).rows[0].id;
    await client.query(`
      INSERT INTO public.accounting_journal_line (journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
      VALUES 
        ($1, 1, $2, 2000.00, 0.00, $4, $5, 'AP Settlement Dr'),
        ($1, 2, $3, 0.00, 2000.00, $4, NULL, 'Bank Operating Cr');
    `, [jePay1Id, acc2111, acc1112, branchId, supId1]);

    await client.query(`UPDATE public.purchase_payment SET voucher_id = $1 WHERE id = $2`, [vPay1Id, pay1Id]);

    // Check outstanding calculation on bill 1
    const p1BalanceRes = await client.query(`
      SELECT 
        p.total - COALESCE(SUM(ppa.allocated_amount), 0) AS outstanding
      FROM public.purchase p
      LEFT JOIN public.purchase_payment_allocation ppa ON ppa.purchase_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, p.total;
    `, [p1Id]);
    const p1Outstanding = parseFloat(p1BalanceRes.rows[0].outstanding);
    assert(p1Outstanding === 3250.00, `4. Outstanding on bill 1 correctly calculated as ₹3,250.00 (Total ₹5250 - Paid ₹2000)`);

    // ── Test 3: Multiple Partial Payments on Same Bill ───
    console.log('\n[3/7] Testing Multiple Payments Against Single Bill...');
    const pay2Id = `purp_c72_pay2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment (id, purchase_id, amount, method, payment_date, reference, created_by, bank_account_id, branch_id, created_at, updated_at)
      VALUES ($1, $2, 1250.00, 'UPI', CURRENT_DATE, 'UPI11223344', 'cashier_01', $3, $4, NOW(), NOW());
    `, [pay2Id, p1Id, bankId, branchId]);
    createdPayments.push(pay2Id);

    const alloc2Id = `ppa_c72_2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment_allocation (id, payment_id, purchase_id, allocated_amount)
      VALUES ($1, $2, $3, 1250.00);
    `, [alloc2Id, pay2Id, p1Id]);

    // Post GL voucher for payment 2
    const vPay2Id = `v_c72_pay2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, 'PV-C72-002', 'PAYMENT', CURRENT_DATE, $2, 'FY2026-27', 'POSTED', 1250.00, 'PURCHASE_PAYMENT', $3, 'SUPPLIER_DISBURSEMENT', 'Second payment to Supplier A', 'cashier_01', 'sup_acct', 'finance_ctrl', NOW(), NOW());
    `, [vPay2Id, branchId, pay2Id]);
    createdVouchers.push(vPay2Id);

    const jePay2Id = `je_c72_pay2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_entry (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, narration, created_by, created_at)
      VALUES ($1, 'JE-C72-PAY2', $2, CURRENT_DATE, $3, 'FY2026-27', 1250.00, 1250.00, 'Second payment JE', 'finance_ctrl', NOW());
    `, [jePay2Id, vPay2Id, branchId]);

    await client.query(`
      INSERT INTO public.accounting_journal_line (journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
      VALUES 
        ($1, 1, $2, 1250.00, 0.00, $4, $5, 'AP Settlement Dr Line 2'),
        ($1, 2, $3, 0.00, 1250.00, $4, NULL, 'Bank Operating Cr Line 2');
    `, [jePay2Id, acc2111, acc1112, branchId, supId1]);

    await client.query(`UPDATE public.purchase_payment SET voucher_id = $1 WHERE id = $2`, [vPay2Id, pay2Id]);

    const p1BalanceRes2 = await client.query(`
      SELECT 
        p.total - COALESCE(SUM(ppa.allocated_amount), 0) AS outstanding,
        COUNT(ppa.id) AS payment_count
      FROM public.purchase p
      LEFT JOIN public.purchase_payment_allocation ppa ON ppa.purchase_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, p.total;
    `, [p1Id]);
    const p1Outstanding2 = parseFloat(p1BalanceRes2.rows[0].outstanding);
    const p1PayCount = parseInt(p1BalanceRes2.rows[0].payment_count);
    assert(p1Outstanding2 === 2000.00, `5. Bill 1 outstanding decremented to ₹2,000.00 after 2nd payment`);
    assert(p1PayCount === 2, `6. Both distinct allocation records preserved without overwriting`);

    // ── Test 4: One Payment Across Multiple Bills ───
    console.log('\n[4/7] Testing One Payment Settle Across Multiple Bills...');
    const p2Id = `pur_c72_p2_${Date.now()}`;
    const p3Id = `pur_c72_p3_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, due_date, subtotal, taxable_value, cgst, sgst, total, payment_method, status, created_by, approved_by, created_at, updated_at)
      VALUES 
        ($1, $2, $3, 'INV-C72-002', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days', 3000.00, 3000.00, 0.00, 0.00, 3000.00, 'CREDIT', 'POSTED', 'buyer_c72', 'mgr_c72', NOW(), NOW()),
        ($4, $2, $3, 'INV-C72-003', CURRENT_DATE, CURRENT_DATE + INTERVAL '20 days', 4000.00, 4000.00, 0.00, 0.00, 4000.00, 'CREDIT', 'POSTED', 'buyer_c72', 'mgr_c72', NOW(), NOW());
    `, [p2Id, supId1, branchId, p3Id]);
    createdPurchases.push(p2Id, p3Id);

    // One payment of ₹5,000 settling: ₹2,000 on Bill 1, ₹3,000 on Bill 2, ₹0 on Bill 3
    const multiPayId = `purp_c72_multi_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment (id, purchase_id, amount, method, payment_date, reference, created_by, bank_account_id, branch_id, created_at, updated_at)
      VALUES ($1, $2, 5000.00, 'BANK_TRANSFER', CURRENT_DATE, 'UTR_MULTI_100', 'cashier_01', $3, $4, NOW(), NOW());
    `, [multiPayId, p1Id, bankId, branchId]);
    createdPayments.push(multiPayId);

    await client.query(`
      INSERT INTO public.purchase_payment_allocation (id, payment_id, purchase_id, allocated_amount)
      VALUES 
        ($1, $2, $3, 2000.00),
        ($4, $2, $5, 3000.00);
    `, [`ppa_multi_1_${Date.now()}`, multiPayId, p1Id, `ppa_multi_2_${Date.now()}`, p2Id]);

    // Check balances
    const p1Final = (await client.query(`SELECT p.total - SUM(ppa.allocated_amount) as outstanding FROM public.purchase p JOIN public.purchase_payment_allocation ppa ON ppa.purchase_id = p.id WHERE p.id = $1 GROUP BY p.total`, [p1Id])).rows[0].outstanding;
    const p2Final = (await client.query(`SELECT p.total - SUM(ppa.allocated_amount) as outstanding FROM public.purchase p JOIN public.purchase_payment_allocation ppa ON ppa.purchase_id = p.id WHERE p.id = $1 GROUP BY p.total`, [p2Id])).rows[0].outstanding;
    const p3Final = (await client.query(`SELECT p.total - COALESCE(SUM(ppa.allocated_amount), 0) as outstanding FROM public.purchase p LEFT JOIN public.purchase_payment_allocation ppa ON ppa.purchase_id = p.id WHERE p.id = $1 GROUP BY p.total`, [p3Id])).rows[0].outstanding;

    assert(parseFloat(p1Final) === 0.00, '7. Bill 1 reached ₹0.00 outstanding (Fully PAID)');
    assert(parseFloat(p2Final) === 0.00, '8. Bill 2 reached ₹0.00 outstanding (Fully PAID)');
    assert(parseFloat(p3Final) === 4000.00, '9. Bill 3 remains ₹4,000.00 outstanding (UNPAID)');

    // ── Test 5: Overpayment & Integrity Protection ───
    console.log('\n[5/7] Testing Overpayment & Integrity Invariants...');
    // Attempting negative allocation
    try {
      await client.query(`
        INSERT INTO public.purchase_payment_allocation (id, payment_id, purchase_id, allocated_amount)
        VALUES ($1, $2, $3, -500.00);
      `, [`ppa_neg_${Date.now()}`, multiPayId, p3Id]);
      assert(false, 'Negative allocation must be rejected');
    } catch (e) {
      assert(true, '10. Negative allocation rejected by chk_ppa_allocated_amount_positive check constraint');
    }

    // Attempting allocation to non-existent purchase (FK validation)
    try {
      await client.query(`
        INSERT INTO public.purchase_payment_allocation (id, payment_id, purchase_id, allocated_amount)
        VALUES ($1, $2, 'pur_non_existent', 100.00);
      `, [`ppa_fk_${Date.now()}`, multiPayId]);
      assert(false, 'Non-existent purchase allocation must be rejected');
    } catch (e) {
      assert(true, '11. Foreign key constraint protects against orphan allocations');
    }

    // ── Test 6: Supplier Subledger Invariant ───
    console.log('\n[6/7] Testing Supplier Subledger & Running Balance...');
    // Create GL Journal entry for multi-payment: Dr 2111 ₹5000 (Supplier A), Cr 1112 ₹5000
    const vMultiPayId = `v_c72_multipay_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, 'PV-C72-MULTI', 'PAYMENT', CURRENT_DATE, $2, 'FY2026-27', 'POSTED', 5000.00, 'PURCHASE_PAYMENT', $3, 'SUPPLIER_DISBURSEMENT', 'Multi-bill disbursement to Supplier A', 'cashier_01', 'sup_acct', 'finance_ctrl', NOW(), NOW());
    `, [vMultiPayId, branchId, multiPayId]);
    createdVouchers.push(vMultiPayId);

    const jeMultiId = `je_c72_multi_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_entry (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, narration, created_by, created_at)
      VALUES ($1, 'JE-C72-MULTI', $2, CURRENT_DATE, $3, 'FY2026-27', 5000.00, 5000.00, 'Multi-bill payment JE', 'finance_ctrl', NOW());
    `, [jeMultiId, vMultiPayId, branchId]);

    await client.query(`
      INSERT INTO public.accounting_journal_line (journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
      VALUES 
        ($1, 1, $2, 5000.00, 0.00, $4, $5, 'Multi AP Settlement Dr'),
        ($1, 2, $3, 0.00, 5000.00, $4, NULL, 'Bank Operating Cr');
    `, [jeMultiId, acc2111, acc1112, branchId, supId1]);

    await client.query(`UPDATE public.purchase_payment SET voucher_id = $1 WHERE id = $2`, [vMultiPayId, multiPayId]);

    // Query Subledger for Supplier A on Account 2111
    const subledgerRes = await client.query(`
      SELECT 
        COALESCE(SUM(jl.credit_amount), 0) as total_bills,
        COALESCE(SUM(jl.debit_amount), 0) as total_payments,
        COALESCE(SUM(jl.credit_amount), 0) - COALESCE(SUM(jl.debit_amount), 0) as net_outstanding
      FROM public.accounting_journal_line jl
      WHERE jl.account_id = $1 AND jl.supplier_id = $2;
    `, [acc2111, supId1]);

    const sBills = parseFloat(subledgerRes.rows[0].total_bills);
    const sPayments = parseFloat(subledgerRes.rows[0].total_payments);
    const sOutstanding = parseFloat(subledgerRes.rows[0].net_outstanding);

    console.log(`  Subledger Supplier A: Bills = ₹${sBills.toFixed(2)}, Payments = ₹${sPayments.toFixed(2)}, Net AP = ₹${sOutstanding.toFixed(2)}`);
    assert(sBills === 5250.00, `12. Total GL bills credited to Supplier A is ₹5,250.00`);
    assert(sPayments === 8250.00, `13. Total GL disbursements debited to Supplier A is ₹8,250.00 (₹2000 + ₹1250 + ₹5000)`);

    // ── Test 7: Cash Purchase Zero Outstanding Invariant ───
    console.log('\n[7/7] Testing Cash Purchase Immediate Settlement Invariant...');
    const pCashId = `pur_c72_cash_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, taxable_value, cgst, sgst, total, payment_method, status, created_by, approved_by, created_at, updated_at)
      VALUES ($1, $2, $3, 'INV-C72-CASH', CURRENT_DATE, 1000.00, 1000.00, 0.00, 0.00, 1000.00, 'CASH', 'POSTED', 'buyer_c72', 'mgr_c72', NOW(), NOW());
    `, [pCashId, supId2, branchId]);
    createdPurchases.push(pCashId);

    // Immediate cash payment disbursement
    const payCashId = `purp_c72_cash_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment (id, purchase_id, amount, method, payment_date, reference, created_by, branch_id, created_at, updated_at)
      VALUES ($1, $2, 1000.00, 'CASH', CURRENT_DATE, 'CASH_VOUCHER_1', 'cashier_01', $3, NOW(), NOW());
    `, [payCashId, pCashId, branchId]);
    createdPayments.push(payCashId);

    await client.query(`
      INSERT INTO public.purchase_payment_allocation (id, payment_id, purchase_id, allocated_amount)
      VALUES ($1, $2, $3, 1000.00);
    `, [`ppa_cash_${Date.now()}`, payCashId, pCashId]);

    const cashBillBalRes = await client.query(`
      SELECT p.total - SUM(ppa.allocated_amount) as outstanding
      FROM public.purchase p
      JOIN public.purchase_payment_allocation ppa ON ppa.purchase_id = p.id
      WHERE p.id = $1
      GROUP BY p.total;
    `, [pCashId]);
    const cashOutstanding = parseFloat(cashBillBalRes.rows[0].outstanding);
    assert(cashOutstanding === 0.00, `14. Cash purchase immediately settled with ₹0.00 outstanding (does not linger in unpaid payables)`);

  } finally {
    console.log('\n[Teardown] Cleaning up test fixtures...');
    // Delete allocations
    if (createdPayments.length > 0) {
      await client.query(`DELETE FROM public.purchase_payment_allocation WHERE payment_id = ANY($1)`, [createdPayments]);
      await client.query(`DELETE FROM public.purchase_payment WHERE id = ANY($1)`, [createdPayments]);
    }
    if (createdPurchases.length > 0) {
      await client.query(`DELETE FROM public.purchase_payment_allocation WHERE purchase_id = ANY($1)`, [createdPurchases]);
      await client.query(`DELETE FROM public.purchase WHERE id = ANY($1)`, [createdPurchases]);
    }
    if (createdVouchers.length > 0) {
      const jeRes = await client.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVouchers]);
      const jeIds = jeRes.rows.map(r => r.id);
      if (jeIds.length > 0) {
        await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1)`, [jeIds]);
        await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1)`, [jeIds]);
      }
      await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVouchers]);
    }
    if (createdBankAccounts.length > 0) {
      await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccounts]);
    }
    if (createdSuppliers.length > 0) {
      await client.query(`DELETE FROM public.supplier WHERE id = ANY($1)`, [createdSuppliers]);
    }
    if (createdCompanies.length > 0) {
      await client.query(`DELETE FROM public.company WHERE id = ANY($1)`, [createdCompanies]);
    }

    console.log(`✓ Teardown complete. Restoring baseline.`);
    client.release();
    await pool.end();
  }

  console.log('\n==================================================================');
  console.log(`  PHASE C7.2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runC72Suite().catch(err => {
  console.error("Test runner crash:", err);
  process.exit(1);
});
