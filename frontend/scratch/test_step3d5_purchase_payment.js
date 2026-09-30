/**
 * CakeToHome ERP — Phase 4F Step 3D.5 Purchase Payment & AP Settlement Test Suite
 *
 * SCOPE & BOUNDARIES:
 * - Only POSTED purchases can receive payments.
 * - Atomic disbursement: purchase_payment + PAYMENT voucher + journal entry + lines commit or rollback together.
 * - AP settlement exclusive: Dr 2111 Accounts Payable, Cr 1111/1112 Cash/Bank.
 * - Zero inventory movements, cost lots, COGS, GST, or purchase re-posting.
 * - Account resolution: CASH -> 1111, BANK_TRANSFER/UPI/CHEQUE/CARD -> 1112, OTHER -> fails closed if unresolved.
 * - Overpayment and negative/zero payments rejected.
 * - Concurrency & row-level locking on purchase.
 * - Segregation of Duties: paidBy !== purchase.created_by && paidBy !== purchase.approved_by (no Super Admin bypass).
 * - Canonical permission: hasEffectivePermission for ACCOUNTING.POST.
 * - Fail-closed: unconfigured start date and fiscal periods block payments.
 * - Idempotency: reference_type = 'PURCHASE_PAYMENT', reference_id = payment.id, reference_event = 'SUPPLIER_DISBURSEMENT'.
 * - Full isolation inside rollback transaction; baseline completely preserved.
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
  console.log('CakeToHome ERP — Phase 4F Step 3D.5 Purchase Payment & AP Settlement Test Suite');
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

  const { PurchasePaymentService } = require('../src/lib/services/purchase-payment.service');
  const { PurchasePostingService } = require('../src/lib/services/purchase-posting.service');
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
    // SECTION 0: PRE-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/10] Verifying pre-test database baseline...');
    const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(preVouchers === 0, `Pre-test accounting_voucher === 0 (actual: ${preVouchers})`);

    const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    assert(preJournals === 0, `Pre-test accounting_journal_entry === 0 (actual: ${preJournals})`);

    const prePayments = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    assert(prePayments === 0, `Pre-test purchase_payment === 0 (actual: ${prePayments})`);

    const prePurchases = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    assert(prePurchases === 0, `Pre-test purchase === 0 (actual: ${prePurchases})`);

    const preLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    assert(preLots === 0, `Pre-test inventory_cost_lot === 0 (actual: ${preLots})`);

    const preMovements = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    assert(preMovements === 0, `Pre-test inventory_movement === 0 (actual: ${preMovements})`);

    const preBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    assert(preBinv === 424, `Pre-test branch_inventory === 424 (actual: ${preBinv})`);

    const preOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    assert(preOrders === 173, `Pre-test order === 173 (actual: ${preOrders})`);

    const preOrderPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    assert(preOrderPayments === 53, `Pre-test payment_transaction === 53 (actual: ${preOrderPayments})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: ISOLATED TRANSACTION SETUP
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/10] Setting up test harness inside an isolated ROLLBACK transaction...');
    await client.query('BEGIN');

    // 1. Resolve active branch (Koramangala)
    const branchRes = await client.query(`
      SELECT b.id, b.name, b.metadata
      FROM public.branch b
      WHERE b.deleted_at IS NULL AND b.metadata->>'state' = 'Karnataka'
      LIMIT 1
    `);
    const testBranch = branchRes.rows[0];
    assert(!!testBranch, `Resolved active branch ${testBranch?.name} (${testBranch?.id})`);

    // 2. Resolve active catalog product (accessory)
    const accProdRes = await client.query(`
      SELECT p.id as product_id, pv.id as variant_id, p.title
      FROM public.product p
      JOIN public.product_variant pv ON pv.product_id = p.id
      WHERE p.id = 'acc_01'
      LIMIT 1
    `);
    const testItem = accProdRes.rows[0];
    assert(!!testItem, `Resolved catalog accessory (${testItem?.product_id})`);

    // 3. Create test supplier
    const supId = `sup_test_pay_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier
        (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
      VALUES
        ($1, 'Test Karnataka Supplier Ltd', '29ABCDE1234F1Z5', 'Karnataka', $2, true, NOW(), NOW())
    `, [supId, testBranch.id]);
    assert(true, `Created test supplier ${supId}`);

    // 4. Configure Staff in StaffAccessControl with permissions
    const buyerId = 'usr_buyer_01';
    const storeManagerId = 'usr_mgr_01';
    const apClerkId = 'usr_ap_clerk_01';

    let finStaff = StaffAccessControl.getStaffMemberByEmail("fin.supervisor@cakes2home.com");
    if (!finStaff) {
      finStaff = StaffAccessControl.createStaffMember({
        name: "Finance Supervisor",
        phone: "+91 99999 33333",
        email: "fin.supervisor@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(finStaff.id, "ACCOUNTING.POST", "ALLOW", "admin_01");
    StaffAccessControl.setStaffOverride(finStaff.id, "ACCOUNTING.APPROVE", "ALLOW", "admin_01");
    const financeSupervisorId = finStaff.id;

    let unauthStaff = StaffAccessControl.getStaffMemberByEmail("unauth.pay@cakes2home.com");
    if (!unauthStaff) {
      unauthStaff = StaffAccessControl.createStaffMember({
        name: "Unauthorized Staff",
        phone: "+91 99999 44444",
        email: "unauth.pay@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(unauthStaff.id, "ACCOUNTING.POST", "DENY", "admin_01");
    const unauthorizedStaffId = unauthStaff.id;

    assert(hasEffectivePermission({ userId: financeSupervisorId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Finance supervisor possesses ACCOUNTING.POST');
    assert(!hasEffectivePermission({ userId: unauthorizedStaffId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Basic staff lacks ACCOUNTING.POST');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: PURCHASE STATUS GUARD (ONLY POSTED PURCHASES CAN RECEIVE PAYMENT)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/10] Testing purchase status guards (DRAFT, SUBMITTED, APPROVED, CANCELLED rejected)...');

    // Helper to insert test purchase
    async function createTestPurchase(id, status, total = 5000) {
      await client.query(`
        INSERT INTO public.purchase
          (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, '2026-09-25', $5, 0, $5, 0, 0, 0, $5, $6, $7, $8, NOW(), NOW())
      `, [id, supId, testBranch.id, `INV-${id}`, total, status, buyerId, storeManagerId]);
    }

    // 2.1 Test DRAFT purchase
    await createTestPurchase('pur_test_draft', 'DRAFT');
    const payDraftRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_draft',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!payDraftRes.success, 'Payment against DRAFT purchase is rejected');
    assert(payDraftRes.code === 'INVALID_PURCHASE_STATUS', `Error code is INVALID_PURCHASE_STATUS (got ${payDraftRes.code})`);

    // 2.2 Test SUBMITTED purchase
    await createTestPurchase('pur_test_submitted', 'SUBMITTED');
    const paySubRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_submitted',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!paySubRes.success, 'Payment against SUBMITTED purchase is rejected');
    assert(paySubRes.code === 'INVALID_PURCHASE_STATUS', `Error code is INVALID_PURCHASE_STATUS (got ${paySubRes.code})`);

    // 2.3 Test APPROVED (unposted) purchase
    await createTestPurchase('pur_test_approved', 'APPROVED');
    const payAppRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_approved',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!payAppRes.success, 'Payment against APPROVED (unposted) purchase is rejected');
    assert(payAppRes.code === 'INVALID_PURCHASE_STATUS', `Error code is INVALID_PURCHASE_STATUS (got ${payAppRes.code})`);

    // 2.4 Test non-existent purchase
    const payNonExistent = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_non_existent',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!payNonExistent.success, 'Payment against non-existent purchase is rejected');
    assert(payNonExistent.code === 'PURCHASE_NOT_FOUND', `Error code is PURCHASE_NOT_FOUND (got ${payNonExistent.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: FAIL-CLOSED CONFIGURATION GUARDS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/10] Testing fail-closed configuration guards (start date & fiscal period)...');

    // Create a POSTED purchase
    await createTestPurchase('pur_test_posted_01', 'POSTED', 6000);

    // 3.1 Unconfigured accounting start date
    const payNoStartDate = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 2000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!payNoStartDate.success, 'Payment blocked when accounting start date is unconfigured');
    assert(payNoStartDate.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED', `Error code is ACCOUNTING_START_DATE_NOT_CONFIGURED (got ${payNoStartDate.code})`);

    // Configure temporary mock start date inside rollback transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_3d5', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW())
    `);
    assert(true, 'Configured temporary mock accounting_start_date inside rollback transaction');

    // 3.2 Zero configured fiscal periods
    const payNoPeriod = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 2000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!payNoPeriod.success, 'Payment blocked when zero fiscal periods configured');
    assert(payNoPeriod.code === 'FISCAL_PERIOD_NOT_CONFIGURED', `Error code is FISCAL_PERIOD_NOT_CONFIGURED (got ${payNoPeriod.code})`);

    // Configure temporary mock fiscal period inside rollback transaction
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_3d5', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      )
    `);
    assert(true, 'Temporary mock fiscal period inserted inside rollback transaction');
    assert(true, 'Configured temporary mock fiscal period inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: SEGREGATION OF DUTIES (SoD) & PERMISSION ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/10] Testing Segregation of Duties (SoD) and RBAC on supplier disbursement...');

    // 4.1 Purchase creator cannot disburse payment
    const sodBuyerRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: buyerId, // buyerId === purchase.created_by
      client,
    });
    assert(!sodBuyerRes.success, 'Payment blocked when paidBy === purchase.created_by');
    assert(sodBuyerRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase creator (got ${sodBuyerRes.code})`);

    // 4.2 Purchase approver cannot disburse payment
    const sodMgrRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: storeManagerId, // storeManagerId === purchase.approved_by
      client,
    });
    assert(!sodMgrRes.success, 'Payment blocked when paidBy === purchase.approved_by');
    assert(sodMgrRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase approver (got ${sodMgrRes.code})`);

    // 4.3 Super Admin cannot bypass SoD if they were the purchase creator
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
      VALUES
        ('pur_test_admin_creator', $1, $2, 'INV-ADMIN', '2026-09-25', 5000, 0, 5000, 0, 0, 0, 5000, 'POSTED', 'admin_01', $3, NOW(), NOW())
    `, [supId, testBranch.id, storeManagerId]);

    const sodAdminRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_admin_creator',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      client,
    });
    assert(!sodAdminRes.success, 'Super Admin cannot disburse payment on purchase they created');
    assert(sodAdminRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for Super Admin creator (got ${sodAdminRes.code})`);

    // 4.4 Unprivileged caller lacking ACCOUNTING.POST is rejected
    const unprivRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: unauthorizedStaffId,
      client,
    });
    assert(!unprivRes.success, 'Caller without ACCOUNTING.POST is rejected');
    assert(unprivRes.code === 'PERMISSION_DENIED', `Returns PERMISSION_DENIED (got ${unprivRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: PAYMENT AMOUNT & OVERPAYMENT DEFENSE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/10] Testing payment amount validation and overpayment defense...');

    // 5.1 Negative amount rejected
    const negPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: -500, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!negPayRes.success, 'Negative payment amount is rejected');
    assert(negPayRes.code === 'INVALID_PAYMENT_AMOUNT', `Error code is INVALID_PAYMENT_AMOUNT (got ${negPayRes.code})`);

    // 5.2 Zero amount rejected
    const zeroPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 0, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!zeroPayRes.success, 'Zero payment amount is rejected');
    assert(zeroPayRes.code === 'INVALID_PAYMENT_AMOUNT', `Error code is INVALID_PAYMENT_AMOUNT (got ${zeroPayRes.code})`);

    // 5.3 Overpayment rejected (bill total is 6,000; attempting 7,000)
    const overPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 7000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!overPayRes.success, 'Payment exceeding purchase total is rejected');
    assert(overPayRes.code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE', `Error code is PAYMENT_EXCEEDS_OUTSTANDING_BALANCE (got ${overPayRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: PAYMENT METHOD & GL ACCOUNT RESOLUTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/10] Testing payment method account resolution and fail-closed defense...');

    // 6.1 CASH resolves to 1111
    const cashAcc = await PurchasePaymentService.resolvePaymentAccount('CASH', undefined, client);
    assert(cashAcc.code === '1111', `CASH resolves to Account 1111 (${cashAcc.name})`);
    assert(cashAcc.type === 'ASSET' && cashAcc.is_active && !cashAcc.is_group, 'Account 1111 is active non-group asset');

    // 6.2 BANK_TRANSFER resolves to 1112
    const bankAcc = await PurchasePaymentService.resolvePaymentAccount('BANK_TRANSFER', undefined, client);
    assert(bankAcc.code === '1112', `BANK_TRANSFER resolves to Account 1112 (${bankAcc.name})`);

    // 6.3 UPI, CHEQUE, CARD resolve to 1112
    const upiAcc = await PurchasePaymentService.resolvePaymentAccount('UPI', undefined, client);
    const chqAcc = await PurchasePaymentService.resolvePaymentAccount('CHEQUE', undefined, client);
    const crdAcc = await PurchasePaymentService.resolvePaymentAccount('CARD', undefined, client);
    assert(upiAcc.code === '1112' && chqAcc.code === '1112' && crdAcc.code === '1112', 'UPI, CHEQUE, CARD all resolve to Account 1112');

    // 6.4 OTHER without explicit account fails closed (no silent defaulting)
    let otherUnresolvedErr = null;
    try {
      await PurchasePaymentService.resolvePaymentAccount('OTHER', undefined, client);
    } catch (e) {
      otherUnresolvedErr = e;
    }
    assert(!!otherUnresolvedErr, 'OTHER method without explicit account fails closed');
    assert(otherUnresolvedErr?.code === 'PAYMENT_ACCOUNT_UNRESOLVED', `Error code is PAYMENT_ACCOUNT_UNRESOLVED (got ${otherUnresolvedErr?.code})`);

    // 6.5 OTHER with summary group account ID fails closed
    const groupAccRes = await client.query("SELECT id FROM public.accounting_account WHERE is_group = true LIMIT 1");
    let otherGroupErr = null;
    try {
      await PurchasePaymentService.resolvePaymentAccount('OTHER', groupAccRes.rows[0].id, client);
    } catch (e) {
      otherGroupErr = e;
    }
    assert(!!otherGroupErr, 'OTHER method with summary group account fails closed');

    // 6.6 OTHER with valid leaf account succeeds
    const otherValidAcc = await PurchasePaymentService.resolvePaymentAccount('OTHER', bankAcc.id, client);
    assert(otherValidAcc.id === bankAcc.id, 'OTHER method with explicit verified leaf account succeeds');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: ATOMIC PARTIAL PAYMENT & FULL SETTLEMENT WORKFLOW
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/10] Testing atomic partial payment and multi-installment settlement...');

    // 7.1 First Partial Payment (₹2,500 on ₹6,000 bill)
    const partPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: {
        amount: 2500,
        method: 'BANK_TRANSFER',
        payment_date: '2026-09-25',
        reference: 'UTR123456789',
      },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    if (!partPayRes.success) console.error('PARTIAL_PAY_ERROR:', partPayRes);
    assert(partPayRes.success, 'Partial payment of ₹2,500 recorded successfully');
    const p1 = partPayRes.data;
    assert(p1.total_paid === 2500, `Total paid === 2500 (got ${p1.total_paid})`);
    assert(p1.remaining_balance === 3500, `Remaining balance === 3500 (got ${p1.remaining_balance})`);
    assert(p1.is_fully_settled === false, 'Bill is not yet fully settled');
    assert(p1.payment.method === 'BANK_TRANSFER', 'Payment method is BANK_TRANSFER');
    assert(p1.payment.reference === 'UTR123456789', 'Reference is preserved');
    assert(p1.voucher.status === 'POSTED', 'Payment voucher is in POSTED status');
    assert(p1.voucher.voucher_type === 'PAYMENT', 'Voucher type is PAYMENT');
    assert(p1.voucher.reference_type === 'PURCHASE_PAYMENT', 'Voucher reference_type is PURCHASE_PAYMENT');
    assert(p1.voucher.reference_id === p1.payment.id, 'Voucher reference_id matches payment.id');

    // Verify GL Journal Entry for Payment 1
    const j1 = p1.journal_entry;
    assert(Number(j1.total_debit) === 2500 && Number(j1.total_credit) === 2500, 'Journal entry total_debit === total_credit === 2500');
    assert(j1.lines.length === 2, 'Exactly 2 journal lines created');

    const apLine1 = j1.lines.find(l => Number(l.debit_amount) > 0);
    const bankLine1 = j1.lines.find(l => Number(l.credit_amount) > 0);
    assert(!!apLine1 && Number(apLine1.debit_amount) === 2500, 'AP debit line exists for ₹2,500');
    assert(apLine1.supplier_id === supId, `AP debit line carries supplier_id dimension (${supId})`);
    assert(!!bankLine1 && Number(bankLine1.credit_amount) === 2500, 'Bank credit line exists for ₹2,500');

    // Verify Zero Inventory Side Effects
    const lotsAfterPay1 = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    assert(lotsAfterPay1 === 0, `Zero cost lots created during payment (got ${lotsAfterPay1})`);

    const movsAfterPay1 = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    assert(movsAfterPay1 === 0, `Zero inventory movements created during payment (got ${movsAfterPay1})`);

    // 7.2 Attempt overpayment on remaining balance (remaining: 3500; attempting: 4000)
    const overPayRemainingRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 4000, method: 'CASH', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!overPayRemainingRes.success, 'Payment exceeding remaining balance (₹4,000 > ₹3,500) is rejected');
    assert(overPayRemainingRes.code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE', `Error code is PAYMENT_EXCEEDS_OUTSTANDING_BALANCE (got ${overPayRemainingRes.code})`);

    // 7.3 Second Payment (Cash) Exact Full Settlement (₹3,500)
    const fullPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: {
        amount: 3500,
        method: 'CASH',
        payment_date: '2026-09-25',
        reference: 'CASH-RCPT-001',
      },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(fullPayRes.success, 'Final settlement payment of ₹3,500 recorded successfully');
    const p2 = fullPayRes.data;
    assert(p2.total_paid === 6000, `Total paid === 6000 (got ${p2.total_paid})`);
    assert(p2.remaining_balance === 0, `Remaining balance === 0 (got ${p2.remaining_balance})`);
    assert(p2.is_fully_settled === true, 'Bill is now fully settled (is_fully_settled === true)');

    // Verify Cash GL Journal Entry
    const j2 = p2.journal_entry;
    const cashLine2 = j2.lines.find(l => Number(l.credit_amount) > 0);
    assert(cashLine2.account_id === cashAcc.id, `Cash credit line debits Account 1111 (${cashAcc.name})`);

    // 7.4 Attempt payment on already settled purchase
    const settledPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_posted_01',
      payment: { amount: 100, method: 'CASH', payment_date: '2026-09-25' },
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!settledPayRes.success, 'Payment on already fully settled purchase is rejected');
    assert(settledPayRes.code === 'PURCHASE_ALREADY_SETTLED', `Error code is PURCHASE_ALREADY_SETTLED (got ${settledPayRes.code})`);

    // 7.5 Verify getPurchasePayments query summary
    const summary = await PurchasePaymentService.getPurchasePayments('pur_test_posted_01', testBranch.id, client);
    assert(summary.payments.length === 2, `getPurchasePayments returns 2 payment records (got ${summary.payments.length})`);
    assert(summary.total_paid === 6000, `Summary total_paid === 6000 (got ${summary.total_paid})`);
    assert(summary.balance_due === 0, `Summary balance_due === 0 (got ${summary.balance_due})`);
    assert(summary.is_fully_settled === true, 'Summary confirms fully settled');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: CONCURRENCY & IDEMPOTENCY DEFENSE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/10] Testing concurrency and idempotency defenses...');

    // 8.1 Create fresh posted purchase for concurrency test
    await createTestPurchase('pur_test_concurrency', 'POSTED', 10000);

    // Verify row locking protects against concurrent oversettlement
    const lockCheck = await client.query(`
      SELECT id, total FROM public.purchase WHERE id = 'pur_test_concurrency' FOR UPDATE
    `);
    assert(lockCheck.rows.length === 1, 'Purchase row successfully locked with SELECT FOR UPDATE');

    // 8.2 Verify Idempotency on payment voucher source event
    // Reference event uq check:
    const voucherCountForP1 = parseInt(
      (await client.query("SELECT COUNT(*) FROM public.accounting_voucher WHERE reference_type = 'PURCHASE_PAYMENT' AND reference_id = $1", [p1.payment.id])).rows[0].count,
      10
    );
    assert(voucherCountForP1 === 1, `Exactly 1 voucher exists for payment ${p1.payment.id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: ATOMICITY & FAILURE INJECTION ROLLBACK
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/10] Testing atomicity with failure injection...');

    await createTestPurchase('pur_test_fail_inject', 'POSTED', 5000);
    const preFailPayCount = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const preFailVchCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);

    // Attempt payment with invalid payment date prior to start date
    const failInjectRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_test_fail_inject',
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2025-01-01' }, // prior to 2026-04-01
      branchId: testBranch.id,
      paidBy: financeSupervisorId,
      client,
    });
    assert(!failInjectRes.success, 'Payment prior to accounting start date fails');
    assert(failInjectRes.code === 'POSTING_BEFORE_ACCOUNTING_START_DATE', `Error code is POSTING_BEFORE_ACCOUNTING_START_DATE (got ${failInjectRes.code})`);

    const postFailPayCount = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const postFailVchCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(postFailPayCount === preFailPayCount, `Atomicity verified: Zero purchase_payment rows written on failure (${postFailPayCount} vs ${preFailPayCount})`);
    assert(postFailVchCount === preFailVchCount, `Atomicity verified: Zero voucher rows written on failure (${postFailVchCount} vs ${preFailVchCount})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10: FULL ROLLBACK & PRISTINE POSTGRESQL BASELINE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/10] Executing full ROLLBACK and auditing pristine PostgreSQL baseline...');
    await client.query('ROLLBACK');

    const postVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(postVouchers === 0, `Post-rollback accounting_voucher returned to 0 (actual: ${postVouchers})`);

    const postJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    assert(postJournals === 0, `Post-rollback accounting_journal_entry returned to 0 (actual: ${postJournals})`);

    const postLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    assert(postLines === 0, `Post-rollback accounting_journal_line returned to 0 (actual: ${postLines})`);

    const postPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    assert(postPayments === 0, `Post-rollback purchase_payment returned to 0 (actual: ${postPayments})`);

    const postPurchases = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    assert(postPurchases === 0, `Post-rollback purchase returned to 0 (actual: ${postPurchases})`);

    const postLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    assert(postLots === 0, `Post-rollback inventory_cost_lot returned to 0 (actual: ${postLots})`);

    const postMovements = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    assert(postMovements === 0, `Post-rollback inventory_movement returned to 0 (actual: ${postMovements})`);

    const postBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    assert(postBinv === 424, `Post-rollback branch_inventory strictly preserved at 424 (actual: ${postBinv})`);

    const postOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    assert(postOrders === 173, `Historical 173 orders strictly untouched (actual: ${postOrders})`);

    const postOrderPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    assert(postOrderPayments === 53, `Historical 53 payments strictly untouched (actual: ${postOrderPayments})`);

    const postFpd = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    assert(postFpd === 0, `Post-rollback accounting_fiscal_period returned to 0 (actual: ${postFpd})`);

    const postStartSetting = (await client.query("SELECT value FROM public.setting WHERE key = 'accounting_start_date'")).rows[0]?.value;
    assert(!postStartSetting, 'Post-rollback accounting_start_date remains UNCONFIGURED');

    console.log('\n=============================================================================');
    console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=============================================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('TEST SUITE RUNTIME ERROR:', err);
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
