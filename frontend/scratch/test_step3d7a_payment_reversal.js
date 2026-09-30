/**
 * CakeToHome ERP — Phase 4F Step 3D.7-A Supplier Payment Reversal Test Suite
 *
 * SCOPE & BOUNDARIES (Step 3D.7-A):
 * - Void / Reversal of POSTED supplier payment disbursements.
 * - Handles legitimate correction workflows: bounced cheque, failed wire, duplicate payment, erroneous entry.
 * - Verifies purchase is in POSTED status.
 * - Enforces Segregation of Duties (payer, purchase creator, purchase approver cannot reverse; SUPER_ADMIN cannot bypass).
 * - Enforces ACCOUNTING.POST permission and branch isolation.
 * - Creates compensating reversal voucher via canonical PostingService primitives.
 * - Inverts original payment financial effect: Dr 1111/1112 (Cash/Bank) / Cr 2111 (Accounts Payable).
 * - Preserves supplier_id and branch_id dimensions.
 * - Authoritative bidirectional linkage: original.reversed_by_voucher_id <-> reversal.reversal_of_voucher_id.
 * - Original payment voucher remains immutable with status = 'POSTED'.
 * - Original journal entry marked is_reversed = true, reversed_at = NOW().
 * - Soft-deletes purchase_payment record (deleted_at = NOW()).
 * - Restores outstanding balance on the purchase invoice.
 * - Unblocks downstream Step 3D.6-B full invoice reversal when all payments are reversed.
 * - Zero inventory, zero cost lots, zero movements mutated.
 * - Idempotency: cannot reverse an already-reversed payment.
 * - Fail-closed: unconfigured start date and fiscal periods block reversals.
 * - Full transactional isolation inside ROLLBACK transaction; baseline completely preserved.
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
  console.log('CakeToHome ERP — Phase 4F Step 3D.7-A Supplier Payment Reversal Test Suite');
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
  const { PurchaseReversalService } = require('../src/lib/services/purchase-reversal.service');
  const { PostingService } = require('../src/lib/services/posting.service');
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
    console.log('[0/11] Verifying pre-test database baseline...');
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
    // SECTION 1: TEST HARNESS & ROLLBACK SETUP
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/11] Setting up test harness inside an isolated ROLLBACK transaction...');
    await client.query('BEGIN');

    // 1. Resolve branch
    const branchRes = await client.query(`
      SELECT b.id, b.name, b.metadata
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

    // 3. Create test supplier
    const testSupplierId = `sup_test_payrev_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier
        (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
      VALUES
        ($1, 'Cake Decor Supplies Ltd', '29ABCDE1234F1Z5', 'Karnataka', $2, true, NOW(), NOW())
    `, [testSupplierId, testBranch.id]);
    assert(true, `Created test supplier ${testSupplierId}`);

    // 4. Staff identities for Segregation of Duties
    const buyerId = 'usr_buyer_payrev_01';
    const storeManagerId = 'usr_mgr_payrev_01';
    const superAdminId = 'admin_01';

    let disburser = StaffAccessControl.getStaffMemberByEmail("disburser.payrev@cakes2home.com");
    if (!disburser) {
      disburser = StaffAccessControl.createStaffMember({
        name: "Disbursing Officer",
        phone: "+91 99999 55555",
        email: "disburser.payrev@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(disburser.id, "ACCOUNTING.POST", "ALLOW", "admin_01");
    StaffAccessControl.setStaffOverride(disburser.id, "ACCOUNTING.APPROVE", "ALLOW", "admin_01");
    const disbursingStaffId = disburser.id;

    let revSupervisor = StaffAccessControl.getStaffMemberByEmail("fin.rev.supervisor@cakes2home.com");
    if (!revSupervisor) {
      revSupervisor = StaffAccessControl.createStaffMember({
        name: "Finance Reversal Supervisor",
        phone: "+91 99999 11111",
        email: "fin.rev.supervisor@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(revSupervisor.id, "ACCOUNTING.POST", "ALLOW", "admin_01");
    StaffAccessControl.setStaffOverride(revSupervisor.id, "ACCOUNTING.APPROVE", "ALLOW", "admin_01");
    const financeSupervisorId = revSupervisor.id;

    let unauthStaff = StaffAccessControl.getStaffMemberByEmail("basic.unauth.payrev@cakes2home.com");
    if (!unauthStaff) {
      unauthStaff = StaffAccessControl.createStaffMember({
        name: "Basic Staff",
        phone: "+91 99999 22222",
        email: "basic.unauth.payrev@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(unauthStaff.id, "ACCOUNTING.POST", "DENY", "admin_01");
    const basicStaffId = unauthStaff.id;

    assert(hasEffectivePermission({ userId: disbursingStaffId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Disbursing officer possesses ACCOUNTING.POST');
    assert(hasEffectivePermission({ userId: financeSupervisorId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Finance supervisor possesses ACCOUNTING.POST');
    assert(!hasEffectivePermission({ userId: basicStaffId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Basic staff lacks ACCOUNTING.POST');

    // Helper: setup posted purchase with cost lots, branch stock, voucher & journal
    async function setupPostedPurchase(purchaseId, items, voucherDate = '2026-09-25') {
      let subtotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      for (const it of items) {
        subtotal += it.taxable;
        cgstTotal += it.cgst || 0;
        sgstTotal += it.sgst || 0;
        igstTotal += it.igst || 0;
      }
      const total = subtotal + cgstTotal + sgstTotal + igstTotal;

      await client.query(`
        INSERT INTO public.purchase
          (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, 0, $6, $7, $8, $9, $10, 'POSTED', $11, $12, NOW(), NOW(), NOW())
      `, [purchaseId, testSupplierId, testBranch.id, `INV-${purchaseId}`, voucherDate, subtotal, cgstTotal, sgstTotal, igstTotal, total, buyerId, storeManagerId]);

      for (const it of items) {
        await client.query(`
          INSERT INTO public.purchase_item
            (id, purchase_id, product_id, variant_id, item_type, description, quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total, created_at, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        `, [
          it.id, purchaseId, it.product_id || testAccessory.product_id, it.variant_id || testAccessory.variant_id,
          it.item_type || 'ACCESSORY', it.description, it.qty, it.unit_cost, it.taxable,
          it.cgst_rate || 9, it.sgst_rate || 9, it.igst_rate || 0,
          it.cgst || 0, it.sgst || 0, it.igst || 0, it.total,
        ]);

        await client.query(`
          INSERT INTO public.inventory_cost_lot
            (id, purchase_item_id, purchase_id, supplier_id, branch_id, product_id, variant_id, item_type, received_quantity, remaining_quantity, unit_cost, total_cost, currency, received_at, status, created_by, created_at, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, 'INR', $12, 'ACTIVE', $13, NOW(), NOW())
        `, [
          `lot_${it.id}`, it.id, purchaseId, testSupplierId, testBranch.id,
          it.product_id || testAccessory.product_id, it.variant_id || testAccessory.variant_id,
          it.item_type || 'ACCESSORY', it.qty, it.unit_cost, Math.round(it.qty * it.unit_cost * 100) / 100, voucherDate, buyerId
        ]);

        if (it.variant_id || testAccessory.variant_id) {
          await client.query(`
            UPDATE public.branch_inventory
            SET quantity = quantity + $1
            WHERE branch_id = $2 AND variant_id = $3
          `, [it.qty, testBranch.id, it.variant_id || testAccessory.variant_id]);
        }
      }

      const voucherNo = `VCH-PUR-${Date.now().toString(36).toUpperCase()}`;
      const vRes = await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'PURCHASE', $3, $4, 'FY2627', 'POSTED', $5, 'INR', 'PURCHASE', $6, 'INVOICE_POSTED', 'Original Purchase Voucher', 'clerk_01', 'clerk_01', $7, $8, NOW(), NOW(), NOW())
        RETURNING *
      `, [`vch_orig_${purchaseId}`, voucherNo, voucherDate, testBranch.id, total, purchaseId, storeManagerId, financeSupervisorId]);
      const voucher = vRes.rows[0];

      const entryNo = `JE-PUR-${Date.now().toString(36).toUpperCase()}`;
      const jeRes = await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, $4, $5, 'FY2627', $6, $6, false, $7, NOW())
        RETURNING *
      `, [`je_orig_${purchaseId}`, entryNo, voucher.id, voucherDate, testBranch.id, total, financeSupervisorId]);
      const journal = jeRes.rows[0];

      const apAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '2111'")).rows[0].id;
      const acc1131 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1131'")).rows[0].id;
      const cgstAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1143'")).rows[0].id;
      const sgstAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1144'")).rows[0].id;

      let lineNo = 1;
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, $3, $4, 0, $5, $6, $7, 'Accounts Payable')
      `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 1, apAcc, total, testBranch.id, testSupplierId]);

      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, $3, $4, $5, 0, $6, $7, 'Inventory Accessories')
      `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 2, acc1131, subtotal, testBranch.id, testSupplierId]);

      if (cgstTotal > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, $3, $4, $5, 0, $6, $7, 'Input CGST')
        `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 3, cgstAcc, cgstTotal, testBranch.id, testSupplierId]);
      }

      if (sgstTotal > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, $3, $4, $5, 0, $6, $7, 'Input SGST')
        `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 4, sgstAcc, sgstTotal, testBranch.id, testSupplierId]);
      }

      return { purchaseId, voucher, journal, total };
    }

    // Helper: create mock posted payment row, PAYMENT voucher and journal
    async function createMockPayment(purchaseId, paymentId, payAmount = 1000, payer = disbursingStaffId) {
      await client.query(`
        INSERT INTO public.purchase_payment
          (id, purchase_id, amount, method, payment_date, reference, created_by, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'BANK_TRANSFER', '2026-09-25', 'CHQ-MOCK-001', $4, NOW(), NOW())
      `, [paymentId, purchaseId, payAmount, payer]);

      const vchId = `vch_pay_${paymentId}`;
      const vRes = await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'PAYMENT', '2026-09-25', $3, 'FY2627', 'POSTED', $4, 'INR', 'PURCHASE_PAYMENT', $5, 'SUPPLIER_DISBURSEMENT', 'Supplier Payment', $6, $6, $7, $7, NOW(), NOW(), NOW())
        RETURNING *
      `, [vchId, `VCH-PAY-${Date.now().toString(36).toUpperCase()}`, testBranch.id, payAmount, paymentId, payer, financeSupervisorId]);

      const jeId = `je_pay_${paymentId}`;
      const jeRes = await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, '2026-09-25', $4, 'FY2627', $5, $5, false, $6, NOW())
        RETURNING *
      `, [jeId, `JE-PAY-${Date.now().toString(36).toUpperCase()}`, vchId, testBranch.id, payAmount, financeSupervisorId]);

      const apAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '2111'")).rows[0].id;
      const bankAcc = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1112'")).rows[0].id;

      // Line 1: Dr 2111 AP
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, 1, $3, $4, 0, $5, $6, 'Accounts Payable')
      `, [`jl_${paymentId}_1`, jeId, apAcc, payAmount, testBranch.id, testSupplierId]);

      // Line 2: Cr 1112 Bank
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
        VALUES
          ($1, $2, 2, $3, 0, $4, $5, 'Bank Operating A/c')
      `, [`jl_${paymentId}_2`, jeId, bankAcc, payAmount, testBranch.id]);

      return { paymentId, voucher: vRes.rows[0], journal: jeRes.rows[0] };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: STATUS & EXISTENCE GUARDS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/11] Testing payment status & existence guards...');

    // Setup an initial posted purchase
    await setupPostedPurchase('pur_payrev_guard_01', [{
      id: 'pi_payrev_g01', description: 'Candles', qty: 10, unit_cost: 200, taxable: 2000,
      cgst_rate: 9, sgst_rate: 9, cgst: 180, sgst: 180, total: 2360
    }]);

    // Setup mock payment
    await createMockPayment('pur_payrev_guard_01', 'purp_guard_01', 1000);
    const guardPaymentId = 'purp_guard_01';

    // 2.1 Test non-existent payment
    const nonExistPay = await PurchasePaymentService.reversePayment({
      paymentId: 'purp_non_existent',
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Testing non-existent payment',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!nonExistPay.success, 'Reversal against non-existent payment is rejected');
    assert(nonExistPay.code === 'PAYMENT_NOT_FOUND', `Returns PAYMENT_NOT_FOUND (got ${nonExistPay.code})`);

    // 2.2 Test payment mismatch (wrong purchase ID)
    const mismatchPurchase = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_wrong_purchase_id',
      branchId: testBranch.id,
      reason: 'Testing wrong purchase ID',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!mismatchPurchase.success, 'Reversal against mismatched purchase is rejected');
    assert(mismatchPurchase.code === 'PAYMENT_NOT_FOUND', `Returns PAYMENT_NOT_FOUND for mismatched purchase (got ${mismatchPurchase.code})`);

    // 2.3 Test reversal on non-POSTED purchase (DRAFT purchase)
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, created_at, updated_at)
      VALUES
        ('pur_payrev_draft_01', $1, $2, 'INV-DRAFT', '2026-09-25', 1000, 0, 1000, 0, 0, 0, 1000, 'DRAFT', $3, NOW(), NOW())
    `, [testSupplierId, testBranch.id, buyerId]);
    await createMockPayment('pur_payrev_draft_01', 'purp_draft_01', 500);

    const draftRev = await PurchasePaymentService.reversePayment({
      paymentId: 'purp_draft_01',
      purchaseId: 'pur_payrev_draft_01',
      branchId: testBranch.id,
      reason: 'Reversing payment on draft purchase',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!draftRev.success, 'Reversal on non-POSTED purchase is rejected');
    assert(draftRev.code === 'INVALID_PURCHASE_STATUS', `Returns INVALID_PURCHASE_STATUS (got ${draftRev.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: FAIL-CLOSED CONFIGURATION GUARDS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/11] Testing fail-closed configuration guards (start date & fiscal period)...');

    // 3.1 Unconfigured start date
    const noStartDate = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Testing unconfigured start date',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!noStartDate.success, 'Payment reversal blocked when accounting start date is unconfigured');
    assert(noStartDate.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED', `Returns ACCOUNTING_START_DATE_NOT_CONFIGURED (got ${noStartDate.code})`);

    // Insert mock start date inside rollback transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_payrev', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW())
    `);
    assert(true, 'Configured temporary mock accounting_start_date inside rollback transaction');

    // 3.2 Unconfigured fiscal periods
    const noFiscalPeriod = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Testing unconfigured fiscal period',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!noFiscalPeriod.success, 'Payment reversal blocked when zero fiscal periods configured');
    assert(noFiscalPeriod.code === 'FISCAL_PERIOD_NOT_CONFIGURED', `Returns FISCAL_PERIOD_NOT_CONFIGURED (got ${noFiscalPeriod.code})`);

    // Insert mock fiscal period inside rollback transaction
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_payrev_2627', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      )
    `);
    assert(true, 'Configured temporary mock fiscal period inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: SEGREGATION OF DUTIES (SoD) & RBAC
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/11] Testing Segregation of Duties (SoD) and RBAC on payment reversal...');

    // 4.1 Payer self-reversal rejected
    const payerReversal = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Payer trying to reverse own payment',
      reversalDate: '2026-09-25',
      reversedBy: disbursingStaffId, // same as payment.created_by
      client,
    });
    assert(!payerReversal.success, 'Payment reversal blocked when reversedBy === payment.created_by');
    assert(payerReversal.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for payer (got ${payerReversal.code})`);

    // 4.2 Purchase creator reversal rejected
    const creatorReversal = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Purchase creator trying to reverse payment',
      reversalDate: '2026-09-25',
      reversedBy: buyerId, // purchase.created_by
      client,
    });
    assert(!creatorReversal.success, 'Payment reversal blocked when reversedBy === purchase.created_by');
    assert(creatorReversal.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase creator (got ${creatorReversal.code})`);

    // 4.3 Purchase approver reversal rejected
    const approverReversal = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Purchase approver trying to reverse payment',
      reversalDate: '2026-09-25',
      reversedBy: storeManagerId, // purchase.approved_by
      client,
    });
    assert(!approverReversal.success, 'Payment reversal blocked when reversedBy === purchase.approved_by');
    assert(approverReversal.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase approver (got ${approverReversal.code})`);

    // 4.4 Super Admin cannot bypass SoD if they were the payer
    const saPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      payment: { amount: 500, method: 'CASH', payment_date: '2026-09-25' },
      paidBy: superAdminId,
      actorRole: 'SUPER_ADMIN',
      client,
    });
    assert(saPayRes.success, 'Pre-condition: Super Admin recorded payment');
    const saPaymentId = saPayRes.data.payment.id;

    const saSelfReversal = await PurchasePaymentService.reversePayment({
      paymentId: saPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Super Admin trying to reverse own payment',
      reversalDate: '2026-09-25',
      reversedBy: superAdminId,
      actorRole: 'SUPER_ADMIN',
      client,
    });
    assert(!saSelfReversal.success, 'Super Admin CANNOT bypass SoD if they were the payer');
    assert(saSelfReversal.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for Super Admin payer (got ${saSelfReversal.code})`);

    // 4.5 Staff lacking ACCOUNTING.POST is rejected
    const unpermReversal = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: testBranch.id,
      reason: 'Staff without permission',
      reversalDate: '2026-09-25',
      reversedBy: basicStaffId,
      client,
    });
    assert(!unpermReversal.success, 'Staff lacking ACCOUNTING.POST is rejected');
    assert(unpermReversal.code === 'PERMISSION_DENIED', `Returns PERMISSION_DENIED (got ${unpermReversal.code})`);

    // 4.6 Branch mismatch rejected
    const branchMismatch = await PurchasePaymentService.reversePayment({
      paymentId: guardPaymentId,
      purchaseId: 'pur_payrev_guard_01',
      branchId: 'br_foreign_branch',
      reason: 'Testing foreign branch access',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!branchMismatch.success, 'Branch mismatch correctly rejected with BRANCH_ACCESS_DENIED');
    assert(branchMismatch.code === 'BRANCH_ACCESS_DENIED', `Returns BRANCH_ACCESS_DENIED (got ${branchMismatch.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: FULL CLEAN PAYMENT REVERSAL EXECUTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/11] Testing full clean supplier payment reversal execution...');

    // Setup fresh purchase with clean partial payment
    await setupPostedPurchase('pur_payrev_clean_01', [{
      id: 'pi_payrev_c01', description: 'Candles', qty: 20, unit_cost: 250, taxable: 5000,
      cgst_rate: 9, sgst_rate: 9, cgst: 450, sgst: 450, total: 5900
    }]);

    // Record partial payment of ₹2,500 via BANK_TRANSFER (Account 1112)
    const cleanPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_payrev_clean_01',
      branchId: testBranch.id,
      payment: { amount: 2500, method: 'BANK_TRANSFER', payment_date: '2026-09-25', reference: 'CHQ-778899' },
      paidBy: disbursingStaffId,
      client,
    });
    assert(cleanPayRes.success, 'Pre-condition: Clean partial payment of ₹2,500 recorded');
    const cleanPayment = cleanPayRes.data.payment;
    const origPaymentVoucher = cleanPayRes.data.voucher;
    assert(cleanPayRes.data.remaining_balance === 3400, 'Pre-condition: Remaining balance is ₹3,400 (5900 - 2500)');

    // Reverse the payment (e.g. Bounced Cheque CHQ-778899)
    const revRes = await PurchasePaymentService.reversePayment({
      paymentId: cleanPayment.id,
      purchaseId: 'pur_payrev_clean_01',
      branchId: testBranch.id,
      reason: 'Cheque bounced due to signature mismatch (CHQ-778899)',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });

    assert(revRes.success, 'Clean supplier payment reversal executed successfully');
    const reversalData = revRes.data;

    // Verify Compensating Voucher
    assert(!!reversalData.reversal_voucher, 'Compensating reversal voucher created');
    assert(reversalData.reversal_voucher.voucher_type === 'JOURNAL', 'Reversal voucher type is JOURNAL');
    assert(reversalData.reversal_voucher.status === 'POSTED', 'Reversal voucher status is POSTED');
    assert(reversalData.reversal_voucher.reference_type === 'PURCHASE_PAYMENT_REVERSAL', 'Reversal voucher reference_type is PURCHASE_PAYMENT_REVERSAL');
    assert(reversalData.reversal_voucher.reversal_of_voucher_id === origPaymentVoucher.id, 'Reversal voucher points to original voucher');
    assert(Number(reversalData.reversal_voucher.total_amount) === 2500, `Reversal voucher total === 2500 (got ${reversalData.reversal_voucher.total_amount})`);

    // Verify Original Voucher Immutability & Linkage
    const origVchCheck = (await client.query('SELECT * FROM public.accounting_voucher WHERE id = $1', [origPaymentVoucher.id])).rows[0];
    assert(origVchCheck.status === 'POSTED', 'Original payment voucher status remains POSTED (immutable per chk_voucher_status)');
    assert(origVchCheck.reversed_by_voucher_id === reversalData.reversal_voucher.id, `Original voucher linked to reversal voucher (${origVchCheck.reversed_by_voucher_id})`);

    // Verify Original Journal Entry Flag
    const origJeCheck = (await client.query('SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1', [origPaymentVoucher.id])).rows[0];
    assert(origJeCheck.is_reversed === true, 'Original journal entry is marked is_reversed = true');
    assert(!!origJeCheck.reversed_at, `Original journal entry reversed_at is populated (${origJeCheck.reversed_at})`);

    // Verify Compensating Double-Entry Lines
    const revLines = reversalData.reversal_journal_entry.lines;
    assert(revLines.length === 2, `Compensating journal entry has exactly 2 lines (got ${revLines.length})`);

    // Line 1: Dr Bank Operating A/c (1112)
    const bankLine = revLines.find(l => Number(l.debit_amount) > 0);
    assert(!!bankLine, 'Found Bank Debit line (disbursed funds restored to cash/bank)');
    assert(Number(bankLine.debit_amount) === 2500, `Bank debit amount === 2500 (got ${bankLine?.debit_amount})`);

    // Line 2: Cr Accounts Payable (2111)
    const apLine = revLines.find(l => Number(l.credit_amount) > 0);
    assert(!!apLine, 'Found Accounts Payable Credit line (AP liability restored)');
    assert(Number(apLine.credit_amount) === 2500, `AP credit amount === 2500 (got ${apLine?.credit_amount})`);
    assert(apLine.supplier_id === testSupplierId, `AP line carries supplier_id (${apLine?.supplier_id})`);
    assert(apLine.branch_id === testBranch.id, `AP line carries branch_id (${apLine?.branch_id})`);

    // Verify Payment Soft-Deletion
    const payCheck = (await client.query('SELECT * FROM public.purchase_payment WHERE id = $1', [cleanPayment.id])).rows[0];
    assert(!!payCheck.deleted_at, `Purchase payment row has deleted_at set (${payCheck.deleted_at})`);
    assert(payCheck.reference.includes('REVERSED: Cheque bounced'), 'Purchase payment reference annotated with reversal notice');

    // Verify Zero Inventory Side Effects
    const lotCheck = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot WHERE purchase_id = $1', ['pur_payrev_clean_01'])).rows[0].count, 10);
    assert(lotCheck === 1, 'Inventory cost lots strictly unaffected by payment reversal (1 lot exists)');
    const movCount = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement WHERE voucher_id = $1', [reversalData.reversal_voucher.id])).rows[0].count, 10);
    assert(movCount === 0, 'Zero inventory movements created by payment reversal');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: OUTSTANDING BALANCE RESTORATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/11] Testing purchase outstanding balance restoration...');

    // Outstanding balance should be restored to full ₹5,900
    assert(reversalData.restored_balance === 5900, `Returned restored_balance === 5900 (got ${reversalData.restored_balance})`);

    const summary = await PurchasePaymentService.getPurchasePayments('pur_payrev_clean_01', testBranch.id, client);
    assert(summary.payments.length === 0, `getPurchasePayments active payments count === 0 (got ${summary.payments.length})`);
    assert(summary.total_paid === 0, `getPurchasePayments total_paid === 0 (got ${summary.total_paid})`);
    assert(summary.balance_due === 5900, `getPurchasePayments balance_due restored to ₹5,900 (got ${summary.balance_due})`);
    assert(summary.is_fully_settled === false, 'Purchase is_fully_settled correctly restored to false');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: REVERSAL IDEMPOTENCY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/11] Testing payment reversal idempotency (cannot reverse twice)...');

    const doubleRevRes = await PurchasePaymentService.reversePayment({
      paymentId: cleanPayment.id,
      purchaseId: 'pur_payrev_clean_01',
      branchId: testBranch.id,
      reason: 'Second reversal attempt',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!doubleRevRes.success, 'Second payment reversal attempt is rejected');
    assert(doubleRevRes.code === 'PAYMENT_ALREADY_REVERSED', `Returns PAYMENT_ALREADY_REVERSED (got ${doubleRevRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: DOWNSTREAM INVOICE VOID UNBLOCKING (3D.6-B INTEGRATION)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/11] Testing downstream invoice void unblocking (Step 3D.6-B integration)...');

    // Setup purchase of ₹2,360
    await setupPostedPurchase('pur_payrev_void_01', [{
      id: 'pi_payrev_v01', description: 'Ribbons', qty: 10, unit_cost: 200, taxable: 2000,
      cgst_rate: 9, sgst_rate: 9, cgst: 180, sgst: 180, total: 2360
    }]);

    // Record full payment of ₹2,360
    const fullPay = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_payrev_void_01',
      branchId: testBranch.id,
      payment: { amount: 2360, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      paidBy: disbursingStaffId,
      client,
    });
    assert(fullPay.success, 'Pre-condition: Full payment recorded on invoice to be voided');

    // Step 3D.6-B invoice void must fail because payment exists
    const blockedVoidRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_payrev_void_01',
      branchId: testBranch.id,
      reason: 'Attempting void while payment exists',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!blockedVoidRes.success, 'Invoice void (3D.6-B) is BLOCKED while payment exists');
    assert(blockedVoidRes.code === 'CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS', `Returns CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS (got ${blockedVoidRes.code})`);

    // Now reverse the payment using 3D.7-A
    const unblockPayRev = await PurchasePaymentService.reversePayment({
      paymentId: fullPay.data.payment.id,
      purchaseId: 'pur_payrev_void_01',
      branchId: testBranch.id,
      reason: 'Voiding erroneous payment prior to invoice void',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(unblockPayRev.success, 'Step 3D.7-A reversed the payment successfully');

    // Now re-attempt Step 3D.6-B invoice void — it must now SUCCEED!
    const unblockedVoidRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_payrev_void_01',
      branchId: testBranch.id,
      reason: 'Invoice entered in error, voiding after payment reversal',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(unblockedVoidRes.success, 'Step 3D.6-B invoice void SUCCEEDS after payment reversal!');
    assert(unblockedVoidRes.data.reversal_voucher.status === 'POSTED', 'Invoice reversal voucher is POSTED');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: MULTIPLE PAYMENTS & PARTIAL PAYMENT REVERSAL
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/11] Testing multi-installment payment reversal...');

    await setupPostedPurchase('pur_payrev_multi_01', [{
      id: 'pi_payrev_m01', description: 'Boxes', qty: 10, unit_cost: 300, taxable: 3000,
      cgst_rate: 9, sgst_rate: 9, cgst: 270, sgst: 270, total: 3540
    }]);

    const pay1 = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_payrev_multi_01', branchId: testBranch.id,
      payment: { amount: 1540, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      paidBy: disbursingStaffId, client,
    });
    const pay2 = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_payrev_multi_01', branchId: testBranch.id,
      payment: { amount: 1000, method: 'CASH', payment_date: '2026-09-25' },
      paidBy: disbursingStaffId, client,
    });
    assert(pay1.success && pay2.success, 'Pre-condition: Two payments recorded (1540 + 1000 = 2540)');

    let multiSummary = await PurchasePaymentService.getPurchasePayments('pur_payrev_multi_01', testBranch.id, client);
    assert(multiSummary.total_paid === 2540, `Total paid before reversal === 2540 (got ${multiSummary.total_paid})`);
    assert(multiSummary.balance_due === 1000, `Balance due before reversal === 1000 (got ${multiSummary.balance_due})`);

    // Reverse pay2 (₹1,000 cash)
    const revPay2 = await PurchasePaymentService.reversePayment({
      paymentId: pay2.data.payment.id,
      purchaseId: 'pur_payrev_multi_01',
      branchId: testBranch.id,
      reason: 'Reversing cash receipt payment 2',
      reversalDate: '2026-09-25',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(revPay2.success, 'Reversed payment 2 successfully');

    multiSummary = await PurchasePaymentService.getPurchasePayments('pur_payrev_multi_01', testBranch.id, client);
    assert(multiSummary.payments.length === 1, `Active payments count === 1 (got ${multiSummary.payments.length})`);
    assert(multiSummary.payments[0].id === pay1.data.payment.id, 'Active payment is payment 1');
    assert(multiSummary.total_paid === 1540, `Total paid is now ₹1,540 (got ${multiSummary.total_paid})`);
    assert(multiSummary.balance_due === 2000, `Balance due restored to ₹2,000 (got ${multiSummary.balance_due})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10: CONCURRENCY, SAVEPOINT ISOLATION & FAILURE INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/11] Testing savepoint rollback & failure injection on reversal...');

    const vCountBeforeFail = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);

    // Inject failure: pass unconfigured reversal date before start date (2025-01-01 < 2026-04-01)
    const failInjectRes = await PurchasePaymentService.reversePayment({
      paymentId: pay1.data.payment.id,
      purchaseId: 'pur_payrev_multi_01',
      branchId: testBranch.id,
      reason: 'Failed reversal attempt',
      reversalDate: '2025-01-01',
      reversedBy: financeSupervisorId,
      client,
    });
    assert(!failInjectRes.success, 'Payment reversal before accounting start date fails');
    assert(failInjectRes.code === 'POSTING_BEFORE_ACCOUNTING_START_DATE', `Returns POSTING_BEFORE_ACCOUNTING_START_DATE (got ${failInjectRes.code})`);

    const vCountAfterFail = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(vCountAfterFail === vCountBeforeFail, `Zero vouchers created on failure (${vCountAfterFail} vs ${vCountBeforeFail})`);

    const pay1Check = (await client.query('SELECT deleted_at FROM public.purchase_payment WHERE id = $1', [pay1.data.payment.id])).rows[0];
    assert(pay1Check.deleted_at === null, 'Payment 1 remains active (deleted_at is null) after savepoint rollback');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 11: FULL ROLLBACK AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[11/11] Rolling back test transaction and verifying pristine baseline...');
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
    assert(postBinv === 424, `Post-rollback branch_inventory returned to 424 (actual: ${postBinv})`);

    const postOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    assert(postOrders === 173, `Post-rollback order remained untouched at 173 (actual: ${postOrders})`);

    const postOrderPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    assert(postOrderPayments === 53, `Post-rollback payment_transaction remained untouched at 53 (actual: ${postOrderPayments})`);

    console.log('\n=============================================================================');
    console.log(`TEST SUITE SUMMARY: ${passCount} Passed, ${failCount} Failed`);
    console.log('=============================================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
