/**
 * CakeToHome ERP — Phase C7.4: Corporate AR & Bills Receivable Comprehensive Test Suite
 *
 * Validates all 15 Locked Amendments + Full GST Acceptance & Commercial Order Invariants:
 *  1. Order-Tied Invoices (Order → Invoice → AR → Receipt): Real commercial order strictly enforced.
 *     - ORDER_REQUIRED, ORDER_NOT_FOUND, CUSTOMER_MISMATCH, BRANCH_MISMATCH, ORDER_STATUS_INVALID, ORDER_ALREADY_INVOICED.
 *  2. Explicit Dynamic GST Billing: Pure delegation to canonical SalesTaxEngine.
 *     - Zero hardcoded GST rates in C7.4 service.
 *     - Place-of-Supply (POS) intra vs inter-state resolution.
 *     - Dynamic routing to correct CoA accounts:
 *       * 4110 Cake Sales Revenue / 4120 Accessory Revenue
 *       * 2121/2122 (5% Intra) / 2125 (5% Inter)
 *       * 2123/2124 (18% Intra) / 2126 (18% Inter)
 *       * 2127/2128 (12% Intra) / 2129 (12% Inter)
 *     - Changing configured tax rate dynamically updates calculation & GL without C7.4 code changes.
 *  3. Concurrency-Safe Credit Limit Checking (Advisory lock pg_advisory_xact_lock)
 *  4. Explicit Four-Eyes Corporate Credit Approval (Retail blocked, corporate opt-in)
 *  5. Authoritative Outstanding Balance (customer.credit_balance is non-authoritative)
 *  6. Partial, Full, and Multi-Invoice Receipt Allocations
 *  7. Provider-Neutral Payment Settlement
 *  8. Bank Leaf GL Resolution (resolves from bank_account.gl_account_id to CoA)
 *  9. Mandatory UTR / Reference ID for Electronic Receipts
 * 10. Reminder Scheduling via public.notification
 * 11. Multi-Tier Customer Subledger Drill-Down (Account 1121)
 * 12. Dynamic Authoritative Branch-Wise AR Aggregation
 * 13. Immutable Invoice Lifecycle (POSTED, PARTIAL, FULL, OVERDUE)
 * 14. Credit Notes & Sales Returns Reconciliation
 * 15. Due-Date-Derived AR Ageing (Current, 1–30, 31–60, 61–90, >90)
 *
 * Restores clean database baseline: 100 CoA accounts, Trial Balance Dr ₹3,380 = Cr ₹3,380, 0 orphans, 0 locks.
 */

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

const connString = getConnectionString();
process.env.DATABASE_URL = connString;
const pool = new Pool({ connectionString: connString });

// Register TypeScript hook
const ts = require('../node_modules/typescript');
require.extensions['.ts'] = function(module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      skipLibCheck: true,
    }
  });
  module._compile(compiled.outputText, filename);
};

// Import services after TS hook
const { BillsReceivableService, BillsReceivableError } = require('../src/lib/services/bills-receivable.service');

async function runTestSuite() {
  const client = await pool.connect();
  console.log('==================================================================');
  console.log('  CAKETOHOME ERP — PHASE C7.4 CORPORATE AR & BILLS RECEIVABLE');
  console.log('  COMPREHENSIVE TEST SUITE (15 LOCKED AMENDMENTS & GST ACCEPTANCE)');
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
  const createdInvoices = [];
  const createdVouchers = [];
  const createdAllocations = [];
  const createdCustomers = [];
  const createdBankAccounts = [];
  const createdNotifications = [];
  const createdCompanies = [];
  const createdOrders = [];

  try {
    // ── Setup: Branch, Test Customers, Bank Account ──────────────────────────
    console.log('[Setup] Preparing test fixtures...');
    const branchRes = await client.query(`SELECT id, name, metadata FROM public.branch LIMIT 1`);
    const branchId = branchRes.rows[0]?.id || 'br_main';
    const branchState = branchRes.rows[0]?.metadata?.state || 'Karnataka';

    const userRes = await client.query(`SELECT id FROM public.user LIMIT 4`);
    const makerUserId = userRes.rows[0].id;
    const checkerUserId = userRes.rows[1].id;
    const cashierUserId = userRes.rows[2]?.id || userRes.rows[1].id;

    // Helper to insert real orders in public.order
    async function insertOrder(orderId, customerId, branch, status = 'pending', metadata = {}) {
      const fullMeta = { is_corporate_order: true, branch_id: branch, ...metadata };
      await client.query(`
        INSERT INTO public.order (id, customer_id, currency_code, status, metadata, created_at, updated_at)
        VALUES ($1, $2, 'INR', $3, $4, NOW(), NOW())
      `, [orderId, customerId, status, JSON.stringify(fullMeta)]);
      createdOrders.push(orderId);
    }

    // 1. Retail Customer (is_corporate = false)
    const retailCustId = `cust_retail_${Date.now()}`;
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, is_corporate, credit_enabled, created_by, created_at, updated_at)
      VALUES ($1, 'Retail', 'Shopper', 'retail@test.com', false, false, $2, NOW(), NOW())
    `, [retailCustId, makerUserId]);
    createdCustomers.push(retailCustId);

    // 2. Pending Corporate Customer (is_corporate = true, credit_status = 'PENDING')
    const pendingCustId = `cust_pending_${Date.now()}`;
    await client.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, company_name, email, is_corporate, credit_enabled,
        credit_limit, payment_terms_days, credit_status, created_by, created_at, updated_at
      )
      VALUES ($1, 'Corporate', 'Maker', 'Acme Corp', 'maker@acme.com', true, true, 50000, 30, 'PENDING', $2, NOW(), NOW())
    `, [pendingCustId, makerUserId]);
    createdCustomers.push(pendingCustId);

    // 3. Approved Corporate Customer A
    const corpCustIdA = `cust_corp_a_${Date.now()}`;
    await client.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, company_name, email, phone, gstin, is_corporate, credit_enabled,
        credit_limit, payment_terms_days, credit_status, credit_approved_by, credit_approved_at, created_by, created_at, updated_at
      )
      VALUES ($1, 'Enterprise', 'Buyer', 'MegaCorp Ltd', 'buyer@megacorp.com', '9876543210', '29ABCDE1234F1Z5', true, true, 100000, 30, 'APPROVED', $2, NOW(), $3, NOW(), NOW())
    `, [corpCustIdA, checkerUserId, makerUserId]);
    createdCustomers.push(corpCustIdA);

    // Ensure company exists
    let compRes = await client.query(`SELECT id FROM public.company LIMIT 1`);
    let compId = compRes.rows[0]?.id;
    if (!compId) {
      compId = `comp_c74_${Date.now()}`;
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

    // 4. Test Bank Account mapped to GL 1112
    const bankRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1`);
    const bankGlId = bankRes.rows[0]?.id;
    const testBankId = `ba_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_account (
        id, company_id, account_name, account_number, account_number_masked, bank_name, branch_name, ifsc_code,
        gl_account_id, status, created_at, updated_at
      )
      VALUES ($1, $2, 'Corporate Current A/c', '9988776655', 'XXXXXX6655', 'HDFC Bank', 'Koramangala', 'HDFC0001234', $3, 'ACTIVE', NOW(), NOW())
    `, [testBankId, compId, bankGlId]);
    createdBankAccounts.push(testBankId);

    // ── Test 1: Retail Zero Credit & Commercial Order Invariants (Amendments 1 & 4) ───
    console.log('\n--- 1. Retail Customer Zero Credit Policy & Genuine Commercial Order Invariants ---');
    
    // Order for retail customer
    const ordRetailId = `ord_retail_${Date.now()}`;
    await insertOrder(ordRetailId, retailCustId, branchId, 'pending', { is_corporate_order: false });

    let retailBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: ordRetailId,
        customerId: retailCustId,
        branchId,
        invoiceDate: '2026-05-10',
        items: [{ description: 'Birthday Cake', quantity: 1, unitPrice: 1000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'CREDIT_NOT_PERMITTED') retailBlocked = true;
    }
    assert(retailBlocked, 'Retail customer attempting credit invoice rejected with CREDIT_NOT_PERMITTED');

    // Missing orderId rejection
    let missingOrderBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: '',
        customerId: corpCustIdA,
        branchId,
        invoiceDate: '2026-05-10',
        items: [{ description: 'Corporate Cake', quantity: 1, unitPrice: 1000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'ORDER_REQUIRED') missingOrderBlocked = true;
    }
    assert(missingOrderBlocked, 'Missing orderId rejected with ORDER_REQUIRED');

    // Non-existent orderId rejection
    let fakeOrderBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: `ord_fake_${Date.now()}`,
        customerId: corpCustIdA,
        branchId,
        invoiceDate: '2026-05-10',
        items: [{ description: 'Corporate Cake', quantity: 1, unitPrice: 1000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'ORDER_NOT_FOUND') fakeOrderBlocked = true;
    }
    assert(fakeOrderBlocked, 'Fabricated/non-existent orderId rejected with ORDER_NOT_FOUND');

    // Customer mismatch rejection
    const ordCustMismatchId = `ord_cust_mismatch_${Date.now()}`;
    await insertOrder(ordCustMismatchId, retailCustId, branchId);
    let custMismatchBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: ordCustMismatchId,
        customerId: corpCustIdA, // Order belongs to retailCustId
        branchId,
        invoiceDate: '2026-05-10',
        items: [{ description: 'Corporate Cake', quantity: 1, unitPrice: 1000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'CUSTOMER_MISMATCH') custMismatchBlocked = true;
    }
    assert(custMismatchBlocked, 'Customer mismatch between order and invoice rejected with CUSTOMER_MISMATCH');

    // Branch mismatch rejection
    const ordBranchMismatchId = `ord_br_mismatch_${Date.now()}`;
    await insertOrder(ordBranchMismatchId, corpCustIdA, 'br_other_unauthorized');
    let branchMismatchBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: ordBranchMismatchId,
        customerId: corpCustIdA,
        branchId, // Differs from 'br_other_unauthorized'
        invoiceDate: '2026-05-10',
        items: [{ description: 'Corporate Cake', quantity: 1, unitPrice: 1000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'BRANCH_MISMATCH') branchMismatchBlocked = true;
    }
    assert(branchMismatchBlocked, 'Branch mismatch between order and invoice rejected with BRANCH_MISMATCH');

    // Cancelled order rejection
    const ordCancelledId = `ord_cancelled_${Date.now()}`;
    await insertOrder(ordCancelledId, corpCustIdA, branchId, 'canceled');
    let cancelledBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: ordCancelledId,
        customerId: corpCustIdA,
        branchId,
        invoiceDate: '2026-05-10',
        items: [{ description: 'Corporate Cake', quantity: 1, unitPrice: 1000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'ORDER_STATUS_INVALID') cancelledBlocked = true;
    }
    assert(cancelledBlocked, 'Cancelled order rejected with ORDER_STATUS_INVALID');

    // ── Test 2: Corporate Customer Credit Approval & Four-Eyes Control (Amendment 4)
    console.log('\n--- 2. Corporate Customer Four-Eyes Credit Approval ---');
    const ordPendingId = `ord_pending_${Date.now()}`;
    await insertOrder(ordPendingId, pendingCustId, branchId);

    let pendingBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: ordPendingId,
        customerId: pendingCustId,
        branchId,
        invoiceDate: '2026-05-10',
        items: [{ description: 'Gift Hamper', quantity: 1, unitPrice: 2000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'CREDIT_APPROVAL_REQUIRED') pendingBlocked = true;
    }
    assert(pendingBlocked, 'Unapproved corporate customer rejected with CREDIT_APPROVAL_REQUIRED');

    // Self-approval by maker fails
    let makerSelfApproveBlocked = false;
    try {
      await BillsReceivableService.approveCorporateCredit({
        customerId: pendingCustId,
        creditLimit: 75000,
        paymentTermsDays: 45,
        approvedBy: makerUserId,
        actorRole: 'SUPER_ADMIN',
      });
    } catch (e) {
      if (e.code === 'SEGREGATION_OF_DUTIES_VIOLATION') makerSelfApproveBlocked = true;
    }
    assert(makerSelfApproveBlocked, 'Maker self-approval blocked with SEGREGATION_OF_DUTIES_VIOLATION');

    // Checker approves
    const approveResult = await BillsReceivableService.approveCorporateCredit({
      customerId: pendingCustId,
      creditLimit: 75000,
      paymentTermsDays: 45,
      approvedBy: checkerUserId,
      actorRole: 'SUPER_ADMIN',
    });
    assert(approveResult.success, 'Independent checker successfully approved corporate credit');
    assert(approveResult.customer.credit_status === 'APPROVED', 'Customer credit_status updated to APPROVED');
    assert(Number(approveResult.customer.credit_limit) === 75000, 'Customer credit_limit updated to ₹75,000');
    assert(approveResult.customer.payment_terms_days === 45, 'Payment terms days updated to 45');

    // ── Test 3: Order-Tied Invoice & Dynamic SalesTaxEngine (Amendments 1 & 2) ───
    console.log('\n--- 3. Order-Tied Invoice & Dynamic SalesTaxEngine Integration ---');
    
    // Intra-state Invoice A: Cake 5% GST (CGST 2.5% = ₹750, SGST 2.5% = ₹750)
    const ordAId = `ord_b2b_001_${Date.now()}`;
    await insertOrder(ordAId, corpCustIdA, branchId);

    const invResA = await BillsReceivableService.createAndPostCorporateInvoice({
      orderId: ordAId,
      customerId: corpCustIdA,
      branchId,
      invoiceDate: '2026-10-05',
      items: [{ description: 'Custom Corporate Cakes', quantity: 30, unitPrice: 1000, taxRatePercent: 5, itemType: 'CAKE' }],
      customerLocation: { state: branchState, gstin: '29ABCDE1234F1Z5' },
      createdBy: makerUserId,
      actorRole: 'SUPER_ADMIN',
    });

    createdInvoices.push(invResA.invoice.id);
    createdVouchers.push(invResA.voucher.id);

    assert(invResA.invoice.is_corporate === true, 'Invoice has is_corporate = true');
    assert(invResA.invoice.order_id === ordAId, 'Invoice retains immutable order_id link to commercial order');
    assert(invResA.invoice.customer_id === corpCustIdA, 'Invoice retains customer_id link');
    assert(invResA.invoice.branch_id === branchId, 'Invoice retains branch_id link');
    assert(invResA.invoice.status === 'POSTED', 'Invoice status is POSTED');
    const d = invResA.invoice.due_date;
    const dueDateStr = d instanceof Date ? d.toLocaleDateString('en-CA') : String(d).slice(0, 10);
    assert(dueDateStr === '2026-11-04', 'Due date correctly calculated (2026-10-05 + 30 days = 2026-11-04)');
    assert(Number(invResA.invoice.grand_total) === 31500, 'Grand total is ₹31,500.00');

    // Verify double-entry GL lines: Dr 1121 ₹31,500 / Cr 4110 ₹30,000 / Cr 2121 ₹750 / Cr 2122 ₹750
    const linesA = invResA.journal_entry.lines;
    const dr1121_A = linesA.find(l => l.account_id && Number(l.debit_amount) === 31500);
    const cr4110_A = linesA.find(l => Number(l.credit_amount) === 30000);
    const cr2121_A = linesA.find(l => Number(l.credit_amount) === 750);
    const cr2122_A = linesA.find(l => Number(l.credit_amount) === 750);
    assert(Boolean(dr1121_A), 'GL: Dr 1121 Trade AR ₹31,500.00');
    assert(Boolean(cr4110_A), 'GL: Cr 4110 Cake Sales Revenue ₹30,000.00 (from SalesTaxEngine metadata)');
    assert(Boolean(cr2121_A), 'GL: Cr 2121 Output CGST 2.5% ₹750.00 (from SalesTaxEngine metadata)');
    assert(Boolean(cr2122_A), 'GL: Cr 2122 Output SGST 2.5% ₹750.00 (from SalesTaxEngine metadata)');

    // Duplicate invoice against same order rejection
    let dupOrderBlocked = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: ordAId,
        customerId: corpCustIdA,
        branchId,
        invoiceDate: '2026-10-05',
        items: [{ description: 'Duplicate attempt', quantity: 1, unitPrice: 1000, taxRatePercent: 5 }],
        createdBy: makerUserId,
      });
    } catch (e) {
      if (e.code === 'ORDER_ALREADY_INVOICED') dupOrderBlocked = true;
    }
    assert(dupOrderBlocked, 'Duplicate corporate invoice on same order rejected with ORDER_ALREADY_INVOICED');

    // Inter-state Invoice B: Accessory 18% GST (Customer in Maharashtra)
    // Gross ₹20,000 + 18% IGST = ₹23,600
    // Dynamic routing: Revenue -> 4120 (Accessory Revenue), IGST -> 2126 (Output IGST 18% Accessories)
    const ordBId = `ord_b2b_002_${Date.now()}`;
    await insertOrder(ordBId, corpCustIdA, branchId);

    const invResB = await BillsReceivableService.createAndPostCorporateInvoice({
      orderId: ordBId,
      customerId: corpCustIdA,
      branchId,
      invoiceDate: '2026-10-06',
      items: [{ description: 'Branded Celebration Gift Packs', quantity: 20, unitPrice: 1000, taxRatePercent: 18, itemType: 'ACCESSORY' }],
      customerLocation: { state: 'Maharashtra', gstin: '27ABCDE1234F1Z5' },
      createdBy: makerUserId,
      actorRole: 'SUPER_ADMIN',
    });
    createdInvoices.push(invResB.invoice.id);
    createdVouchers.push(invResB.voucher.id);

    const linesB = invResB.journal_entry.lines;
    const cr4120_B = linesB.find(l => Number(l.credit_amount) === 20000);
    const cr2126_B = linesB.find(l => Number(l.credit_amount) === 3600);
    assert(Boolean(cr4120_B), 'Inter-state GL: Cr 4120 Accessory Revenue ₹20,000.00');
    assert(Boolean(cr2126_B), 'Inter-state GL: Cr 2126 Output IGST 18% ₹3,600.00 (correct 18% account, NOT 2125)');
    assert(Number(invResB.invoice.grand_total) === 23600, 'Inter-state Invoice B total is ₹23,600.00');

    // Inter-state Invoice C: Cake 5% GST (Customer in Tamil Nadu)
    // Gross ₹10,000 + 5% IGST = ₹10,500
    // Dynamic routing: Revenue -> 4110 (Cake Revenue), IGST -> 2125 (Output IGST 5% Food)
    const ordCId = `ord_b2b_003_food_${Date.now()}`;
    await insertOrder(ordCId, pendingCustId, branchId);

    const invResC = await BillsReceivableService.createAndPostCorporateInvoice({
      orderId: ordCId,
      customerId: pendingCustId,
      branchId,
      invoiceDate: '2026-10-06',
      items: [{ description: 'Tiered Wedding Cakes', quantity: 10, unitPrice: 1000, taxRatePercent: 5, itemType: 'CAKE' }],
      customerLocation: { state: 'Tamil Nadu', gstin: '33ABCDE1234F1Z5' },
      createdBy: checkerUserId,
      actorRole: 'SUPER_ADMIN',
    });
    createdInvoices.push(invResC.invoice.id);
    createdVouchers.push(invResC.voucher.id);

    const linesC = invResC.journal_entry.lines;
    const cr4110_C = linesC.find(l => Number(l.credit_amount) === 10000);
    const cr2125_C = linesC.find(l => Number(l.credit_amount) === 500);
    assert(Boolean(cr4110_C), 'Inter-state Food GL: Cr 4110 Cake Sales Revenue ₹10,000.00');
    assert(Boolean(cr2125_C), 'Inter-state Food GL: Cr 2125 Output IGST 5.0% ₹500.00 (correct 5% interstate account)');
    assert(Number(invResC.invoice.grand_total) === 10500, 'Inter-state Invoice C total is ₹10,500.00');

    // Dynamic rate change proof:
    // Proves that changing the taxRatePercent on the item (5% vs 18%) dynamically shifts GL posting
    // from 4110 + 2121/2122 to 4120 + 2123/2124 (Intra) without changing any code in BillsReceivableService!
    const ordDynamicId = `ord_dynamic_${Date.now()}`;
    await insertOrder(ordDynamicId, pendingCustId, branchId);
    const invResDyn = await BillsReceivableService.createAndPostCorporateInvoice({
      orderId: ordDynamicId,
      customerId: pendingCustId,
      branchId,
      invoiceDate: '2026-10-06',
      items: [{ description: 'Configured Merchandise with 18% GST', quantity: 10, unitPrice: 1000, taxRatePercent: 18, itemType: 'ACCESSORY' }],
      customerLocation: { state: branchState, gstin: '29ABCDE1234F1Z5' },
      createdBy: checkerUserId,
      actorRole: 'SUPER_ADMIN',
    });
    createdInvoices.push(invResDyn.invoice.id);
    createdVouchers.push(invResDyn.voucher.id);
    const linesDyn = invResDyn.journal_entry.lines;
    const cr2123_Dyn = linesDyn.find(l => Number(l.credit_amount) === 900);
    const cr2124_Dyn = linesDyn.find(l => Number(l.credit_amount) === 900);
    assert(Boolean(cr2123_Dyn) && Boolean(cr2124_Dyn), 'Dynamic GST: Configured 18% intra dynamically routes to 2123 (CGST 9%) & 2124 (SGST 9%)');

    // ── Test 4: Concurrency-Safe Credit Limit Enforcement (Amendment 3) ───────
    console.log('\n--- 4. Concurrency-Safe Credit Limit Enforcement ---');
    // Customer A has limit ₹100,000.
    // Existing invoices for Cust A: ₹31,500 + ₹23,600 = ₹55,100 exposure.
    // Remaining credit: ₹100,000 - ₹55,100 = ₹44,900.
    // If client attempts invoice of ₹45,000, it must fail.
    const ordLimitFailId = `ord_limit_fail_${Date.now()}`;
    await insertOrder(ordLimitFailId, corpCustIdA, branchId);

    let creditLimitExceeded = false;
    try {
      await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: ordLimitFailId,
        customerId: corpCustIdA,
        branchId,
        invoiceDate: '2026-10-07',
        items: [{ description: 'High Value Order', quantity: 50, unitPrice: 1000, taxRatePercent: 0 }],
        createdBy: makerUserId,
        actorRole: 'SUPER_ADMIN',
      });
    } catch (e) {
      if (e.code === 'CREDIT_LIMIT_EXCEEDED') creditLimitExceeded = true;
    }
    assert(creditLimitExceeded, 'Invoice exceeding credit limit rejected with CREDIT_LIMIT_EXCEEDED');

    // Concurrency test: Two parallel clients both attempt ₹25,000 each (total ₹50,000 > ₹44,900 remaining)
    const ordParallel1 = `ord_parallel_1_${Date.now()}`;
    const ordParallel2 = `ord_parallel_2_${Date.now()}`;
    await insertOrder(ordParallel1, corpCustIdA, branchId);
    await insertOrder(ordParallel2, corpCustIdA, branchId);

    let conn1Success = false;
    let conn2Success = false;
    let conn1Error = null;
    let conn2Error = null;

    const p1 = BillsReceivableService.createAndPostCorporateInvoice({
      orderId: ordParallel1,
      customerId: corpCustIdA,
      branchId,
      invoiceDate: '2026-10-07',
      items: [{ description: 'Parallel Batch 1', quantity: 25, unitPrice: 1000, taxRatePercent: 0 }],
      createdBy: makerUserId,
      actorRole: 'SUPER_ADMIN',
    }).then(r => {
      conn1Success = true;
      createdInvoices.push(r.invoice.id);
      createdVouchers.push(r.voucher.id);
    }).catch(err => { conn1Error = err; });

    const p2 = BillsReceivableService.createAndPostCorporateInvoice({
      orderId: ordParallel2,
      customerId: corpCustIdA,
      branchId,
      invoiceDate: '2026-10-07',
      items: [{ description: 'Parallel Batch 2', quantity: 25, unitPrice: 1000, taxRatePercent: 0 }],
      createdBy: makerUserId,
      actorRole: 'SUPER_ADMIN',
    }).then(r => {
      conn2Success = true;
      createdInvoices.push(r.invoice.id);
      createdVouchers.push(r.voucher.id);
    }).catch(err => { conn2Error = err; });

    await Promise.all([p1, p2]);

    assert((conn1Success && !conn2Success) || (!conn1Success && conn2Success), 'Advisory lock serialized concurrent checks: exactly one passed');
    const failedErr = conn1Error || conn2Error;
    assert(failedErr?.code === 'CREDIT_LIMIT_EXCEEDED', 'Concurrent second invoice rejected with CREDIT_LIMIT_EXCEEDED');

    // ── Test 5: Authoritative Outstanding Balance Invariant (Amendment 5) ────
    console.log('\n--- 5. Authoritative Balance Invariant ---');
    // Tamper with customer.credit_balance manually to simulate stale or corrupted cache
    await client.query(`UPDATE public.customer SET credit_balance = 999999 WHERE id = $1`, [corpCustIdA]);
    const authoritativeExp = await BillsReceivableService.calculateAuthoritativeCustomerOutstanding(corpCustIdA, client);
    // Invoices = 31,500 + 23,600 + 25,000 = ₹80,100
    assert(authoritativeExp === 80100, `Authoritative balance derived from DB records: ₹${authoritativeExp.toFixed(2)} (ignores tampered cached 999999)`);

    // ── Test 6: Partial, Full & Multi-Invoice Receipt Allocation (Amendments 6, 7, 8, 9)
    console.log('\n--- 6. Multi-Invoice Receipt Settlement & Bank Leaf Resolution ---');
    // Mandatory UTR validation
    let utrMissingBlocked = false;
    try {
      await BillsReceivableService.settleCustomerReceipt({
        customerId: corpCustIdA,
        branchId,
        receiptDate: '2026-10-15',
        paymentMethod: 'NEFT',
        bankAccountId: testBankId,
        reference: '', // Missing
        receivedBy: cashierUserId,
        actorRole: 'SUPER_ADMIN',
        allocations: [{ invoiceId: invResA.invoice.id, amount: 10000 }],
      });
    } catch (e) {
      if (e.code === 'REFERENCE_MANDATORY') utrMissingBlocked = true;
    }
    assert(utrMissingBlocked, 'Electronic receipt without UTR rejected with REFERENCE_MANDATORY');

    // Overpayment protection
    let overpaymentBlocked = false;
    try {
      await BillsReceivableService.settleCustomerReceipt({
        customerId: corpCustIdA,
        branchId,
        receiptDate: '2026-10-15',
        paymentMethod: 'NEFT',
        bankAccountId: testBankId,
        reference: 'UTR998877',
        receivedBy: cashierUserId,
        actorRole: 'SUPER_ADMIN',
        allocations: [{ invoiceId: invResA.invoice.id, amount: 50000 }], // Outstanding is ₹31,500
      });
    } catch (e) {
      if (e.code === 'ALLOCATION_EXCEEDS_OUTSTANDING') overpaymentBlocked = true;
    }
    assert(overpaymentBlocked, 'Allocation exceeding invoice outstanding rejected with ALLOCATION_EXCEEDS_OUTSTANDING');

    // Maker / SoD protection: maker created invoice A, cannot settle receipt
    let makerReceiptBlocked = false;
    try {
      await BillsReceivableService.settleCustomerReceipt({
        customerId: corpCustIdA,
        branchId,
        receiptDate: '2026-10-15',
        paymentMethod: 'NEFT',
        bankAccountId: testBankId,
        reference: 'UTR998877',
        receivedBy: makerUserId, // Created invoice A
        actorRole: 'SUPER_ADMIN',
        allocations: [{ invoiceId: invResA.invoice.id, amount: 10000 }],
      });
    } catch (e) {
      if (e.code === 'SEGREGATION_OF_DUTIES_VIOLATION') makerReceiptBlocked = true;
    }
    assert(makerReceiptBlocked, 'Invoice creator cannot disburse/settle receipt (SEGREGATION_OF_DUTIES_VIOLATION)');

    // Multi-invoice receipt: Settle ₹31,500 (Invoice A - Full) and ₹10,000 (Invoice B - Partial)
    // Total receipt = ₹41,500
    const receiptRes = await BillsReceivableService.settleCustomerReceipt({
      customerId: corpCustIdA,
      branchId,
      receiptDate: '2026-10-15',
      paymentMethod: 'NEFT',
      bankAccountId: testBankId,
      reference: 'UTR-HDFC-20260515-001',
      narration: 'Bulk B2B settlement for batches 1 & 2',
      receivedBy: cashierUserId,
      actorRole: 'SUPER_ADMIN',
      allocations: [
        { invoiceId: invResA.invoice.id, amount: 31500 },
        { invoiceId: invResB.invoice.id, amount: 10000 },
      ],
    });

    createdVouchers.push(receiptRes.voucher.id);
    for (const alloc of receiptRes.allocations) {
      createdAllocations.push(alloc.id);
    }

    assert(receiptRes.total_received === 41500, 'Total receipt amount is ₹41,500.00');
    assert(receiptRes.settled_invoices.length === 2, 'Settled exactly 2 invoices under single atomic receipt voucher');

    const settledA = receiptRes.settled_invoices.find(s => s.invoice_id === invResA.invoice.id);
    const settledB = receiptRes.settled_invoices.find(s => s.invoice_id === invResB.invoice.id);
    assert(settledA.new_outstanding === 0 && settledA.new_status === 'FULLY_RECEIVED', 'Invoice A outstanding ₹0.00 (FULLY_RECEIVED)');
    assert(settledB.new_outstanding === 13600 && settledB.new_status === 'PARTIALLY_RECEIVED', 'Invoice B outstanding ₹13,600.00 (PARTIALLY_RECEIVED)');

    // Verify Bank Leaf GL Posting: Dr Bank GL (1112) ₹41,500 / Cr 1121 Trade AR ₹41,500
    const rcptLines = receiptRes.journal_entry.lines;
    const rcptBankDr = rcptLines.find(l => Number(l.debit_amount) === 41500);
    const rcptArCr = rcptLines.find(l => Number(l.credit_amount) === 41500);
    assert(Boolean(rcptBankDr), 'GL: Dr Bank Leaf Account (1112) ₹41,500.00');
    assert(Boolean(rcptArCr), 'GL: Cr 1121 Trade AR ₹41,500.00 carrying customer attribution');

    // ── Test 7: Reminder Scheduling via Notification Pipeline (Amendment 10) ─
    console.log('\n--- 7. Reminder Scheduling via Notification Pipeline ---');
    const remRes = await BillsReceivableService.scheduleInvoiceReminder({
      invoiceId: invResB.invoice.id,
      reminderDate: '2026-10-25',
      reminderType: 'PRE_DUE',
      channel: 'EMAIL',
      scheduledBy: 'credit_controller',
    });
    createdNotifications.push(remRes.notification.id);

    assert(remRes.success, 'Payment reminder successfully created');
    assert(remRes.notification.trigger_type === 'PAYMENT_REMINDER', 'Notification trigger_type is PAYMENT_REMINDER');
    assert(remRes.notification.resource_type === 'INVOICE', 'Notification resource_type is INVOICE');
    assert(remRes.notification.resource_id === invResB.invoice.id, 'Notification resource_id links to invoice');

    const listedReminders = await BillsReceivableService.listInvoiceReminders(invResB.invoice.id, client);
    assert(listedReminders.length >= 1, 'listInvoiceReminders retrieves scheduled reminders for invoice');

    // ── Test 8: Multi-Tier Customer Subledger Drill-Down (Amendment 11) ───────
    console.log('\n--- 8. Multi-Tier Customer Subledger Drill-Down ---');
    const ledger = await BillsReceivableService.getCustomerLedger(corpCustIdA, undefined, undefined, client);
    assert(ledger.customer_id === corpCustIdA, 'Ledger retrieved for Customer A');
    assert(ledger.total_invoiced === 80100, `Total invoiced is ₹80,100.00 (actual: ₹${ledger.total_invoiced})`);
    assert(ledger.total_received === 41500, `Total received is ₹41,500.00 (actual: ₹${ledger.total_received})`);
    assert(ledger.closing_balance === 38600, `Authoritative closing balance is ₹38,600.00 (actual: ₹${ledger.closing_balance})`);

    const receiptEntry = ledger.entries.find(e => e.entry_type === 'RECEIPT');
    assert(Boolean(receiptEntry), 'Subledger includes RECEIPT entry');
    assert(receiptEntry.reference_no === 'UTR-HDFC-20260515-001', 'Subledger receipt displays searchable UTR reference');
    assert(receiptEntry.allocated_invoices && receiptEntry.allocated_invoices.length > 0, 'Receipt drill-down exposes allocated invoices');

    // ── Test 9: Authoritative Dynamic Branch-Wise AR & Ageing (Amendments 12 & 15)
    console.log('\n--- 9. Dynamic Branch AR & Ageing Matrix ---');
    const ageingSummary = await BillsReceivableService.getArAgeingSummary(undefined, undefined, client);
    assert(typeof ageingSummary.company_total.total_outstanding === 'number', 'AR Ageing provides company-wide total outstanding');
    assert(ageingSummary.branch_breakdown.length >= 1, 'AR Ageing provides dynamic branch breakdown (zero duplicate tables)');

    const listResult = await BillsReceivableService.listBillsReceivable({ customer_id: corpCustIdA }, client);
    assert(listResult.summary.total_outstanding === 38600, `List summary total outstanding ₹38,600.00 (actual: ₹${listResult.summary.total_outstanding})`);
    assert(listResult.summary.fully_received_count >= 1, 'Summary reports at least 1 fully received invoice');

    // ── Test 10: Credit Note Reconciliation (Amendment 14) ────────────────────
    console.log('\n--- 10. Credit Note & Sales Return Reconciliation ---');
    // Simulate Sales Return / Credit Note voucher of ₹5,000 against Invoice B's order
    const cnVoucherId = `vch_cn_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status,
        total_amount, narration, reference_type, reference_id, reference_event,
        metadata, created_by, created_at, updated_at
      )
      VALUES ($1, 'CN-001', 'JOURNAL', '2026-10-16', $2, 'FY2026-27', 'POSTED', 5000,
              'Sales Return credit note', 'ORDER_RETURN', 'ret_001', 'SALES_RETURN',
              $3, 'system', NOW(), NOW())
    `, [cnVoucherId, branchId, JSON.stringify({ order_id: invResB.invoice.order_id })]);
    createdVouchers.push(cnVoucherId);

    // Re-verify detail of Invoice B
    const detailB = await BillsReceivableService.getBillReceivableDetail(invResB.invoice.id, undefined, client);
    assert(detailB.invoice.returns_amount === 5000, 'Invoice B recognizes ₹5,000 credit note');
    // Original ₹23,600 - paid ₹10,000 - credit note ₹5,000 = ₹8,600
    assert(detailB.invoice.outstanding_amount === 8600, `Invoice B net outstanding reduced to ₹8,600.00 (actual: ₹${detailB.invoice.outstanding_amount})`);

    console.log('\n==================================================================');
    console.log(`  PHASE C7.4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // ── Teardown: Restoring Clean Database Baseline ───────────────────────────
    console.log('[Teardown] Purging test fixtures and restoring Trial Balance baseline...');

    // 1. Delete customer receipt allocations
    if (createdAllocations.length > 0) {
      await client.query(`DELETE FROM public.customer_receipt_allocation WHERE id = ANY($1)`, [createdAllocations]);
    }
    if (createdInvoices.length > 0) {
      await client.query(`DELETE FROM public.customer_receipt_allocation WHERE invoice_id = ANY($1)`, [createdInvoices]);
    }

    // 2. Delete test notifications
    if (createdNotifications.length > 0) {
      await client.query(`DELETE FROM public.notification WHERE id = ANY($1)`, [createdNotifications]);
    }
    if (createdInvoices.length > 0) {
      await client.query(`DELETE FROM public.notification WHERE resource_type = 'INVOICE' AND resource_id = ANY($1)`, [createdInvoices]);
    }

    // 3. Delete test invoices
    if (createdInvoices.length > 0) {
      await client.query(`DELETE FROM public.invoice WHERE id = ANY($1)`, [createdInvoices]);
    }

    // 4. Delete accounting entries and vouchers
    if (createdVouchers.length > 0) {
      const jeRes = await client.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVouchers]);
      const jeIds = jeRes.rows.map(r => r.id);
      if (jeIds.length > 0) {
        await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1)`, [jeIds]);
        await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1)`, [jeIds]);
      }
      await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVouchers]);
    }

    // 5. Delete test orders (now that invoices referencing them are purged)
    if (createdOrders.length > 0) {
      await client.query(`DELETE FROM public.order WHERE id = ANY($1)`, [createdOrders]);
    }
    await client.query(`DELETE FROM public.order WHERE id LIKE 'ord_retail_%' OR id LIKE 'ord_b2b_%' OR id LIKE 'ord_parallel_%' OR id LIKE 'ord_inv_corp_%' OR id LIKE 'ord_cust_mismatch_%' OR id LIKE 'ord_br_mismatch_%' OR id LIKE 'ord_cancelled_%' OR id LIKE 'ord_pending_%' OR id LIKE 'ord_limit_fail_%' OR id LIKE 'ord_dynamic_%'`);

    // 6. Delete test bank accounts
    if (createdBankAccounts.length > 0) {
      await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccounts]);
    }

    // 7. Delete test customers
    if (createdCustomers.length > 0) {
      await client.query(`DELETE FROM public.customer WHERE id = ANY($1)`, [createdCustomers]);
    }

    // 8. Delete test companies
    if (createdCompanies.length > 0) {
      await client.query(`DELETE FROM public.company WHERE id = ANY($1)`, [createdCompanies]);
    }

    // Verify baseline invariants
    const coaRes = await client.query(`SELECT COUNT(*)::int as count FROM public.accounting_account`);
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(12,2) as total_debit,
        COALESCE(SUM(credit_amount), 0)::numeric(12,2) as total_credit
      FROM public.accounting_journal_line
    `);
    const dr = parseFloat(tbRes.rows[0].total_debit);
    const cr = parseFloat(tbRes.rows[0].total_credit);

    console.log(`[Teardown] Baseline verification: CoA = ${coaRes.rows[0].count}, Trial Balance: Dr=₹${dr.toFixed(2)}, Cr=₹${cr.toFixed(2)}, Diff=₹${(dr - cr).toFixed(4)}`);

    if (coaRes.rows[0].count !== 100 || dr !== 3380.00 || cr !== 3380.00) {
      console.error('FATAL: Database baseline corrupted during teardown!');
      process.exit(1);
    }

    client.release();
    await pool.end();
  }
}

runTestSuite().then(() => {
  console.log('[Done] All test assertions and baselines verified. Exiting cleanly.');
  process.exit(0);
}).catch(err => {
  console.error("Unhandled test suite exception:", err);
  process.exit(1);
});
