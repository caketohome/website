/**
 * CakeToHome ERP — Phase 4F Step 3D.6-B Purchase Invoice Reversal Test Suite
 *
 * SCOPE & BOUNDARIES (Step 3D.6-B):
 * - Void / Reversal of POSTED purchase invoice entered in error.
 * - Requires 100% unconsumed cost lots (rejects if any lot consumed or returned).
 * - Requires zero supplier payments (rejects if any payments exist).
 * - Creates compensating reversal voucher via canonical PostingService primitives.
 * - Inverts original financial effect: Dr 2111 (AP) / Cr 1131-1133 (Inventory) / Cr 1141-1149 (Input GST).
 * - Authoritative bidirectional linkage: original.reversed_by_voucher_id <-> reversal.reversal_of_voucher_id.
 * - Original voucher remains immutable with status = 'POSTED'.
 * - Original journal entry marked is_reversed = true, reversed_at = NOW().
 * - Cost lots transition to status = 'REVERSED', remaining_quantity = 0.
 * - Branch inventory decremented for catalog items.
 * - Inventory movement recorded (movement_type = 'INVOICE_REVERSAL', direction = 'OUT').
 * - Idempotency: cannot reverse an already-reversed purchase.
 * - SoD and ACCOUNTING.POST permission enforced (SUPER_ADMIN cannot bypass SoD).
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
  console.log('CakeToHome ERP — Phase 4F Step 3D.6-B Purchase Reversal & Void Test Suite');
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

  const { PurchaseReversalService } = require('../src/lib/services/purchase-reversal.service');
  const { PurchaseReturnService } = require('../src/lib/services/purchase-return.service');
  const { PurchasePostingService } = require('../src/lib/services/purchase-posting.service');
  const { PurchasePaymentService } = require('../src/lib/services/purchase-payment.service');
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
    // SECTION 0: PRE-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/11] Verifying pre-test database baseline...');
    const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(preVouchers === 0, `Pre-test accounting_voucher === 0 (actual: ${preVouchers})`);

    const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    assert(preJournals === 0, `Pre-test accounting_journal_entry === 0 (actual: ${preJournals})`);

    const preLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    assert(preLines === 0, `Pre-test accounting_journal_line === 0 (actual: ${preLines})`);

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
    console.log('\n[1/11] Setting up test harness inside an isolated ROLLBACK transaction...');
    await client.query('BEGIN');

    // 1. Resolve active branch (Karnataka)
    const branchRes = await client.query(`
      SELECT b.id, b.name, b.metadata
      FROM public.branch b
      WHERE b.deleted_at IS NULL AND b.metadata->>'state' = 'Karnataka'
      LIMIT 1
    `);
    const testBranch = branchRes.rows[0];
    assert(!!testBranch, `Resolved active branch ${testBranch?.name} (${testBranch?.id})`);

    // 2. Resolve catalog accessory and product variants
    const accProdRes = await client.query(`
      SELECT p.id as product_id, pv.id as variant_id, p.title
      FROM public.product p
      JOIN public.product_variant pv ON pv.product_id = p.id
      WHERE p.id = 'acc_01'
      LIMIT 1
    `);
    const testAccessory = accProdRes.rows[0];
    assert(!!testAccessory, `Resolved catalog accessory (${testAccessory?.product_id})`);

    // Ensure branch_inventory row exists for testAccessory
    const binvCheck = await client.query(`
      SELECT quantity FROM public.branch_inventory
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);
    if (binvCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO public.branch_inventory (id, branch_id, variant_id, quantity, created_at, updated_at)
        VALUES ('binv_test_acc_rev', $1, $2, 50, NOW(), NOW())
      `, [testBranch.id, testAccessory.variant_id]);
    }

    // 3. Create test supplier (Karnataka)
    const supId = `sup_test_rev_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier
        (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
      VALUES
        ($1, 'Test Karnataka Supplier Ltd', '29ABCDE1234F1Z5', 'Karnataka', $2, true, NOW(), NOW())
    `, [supId, testBranch.id]);
    assert(true, `Created test supplier ${supId}`);

    // 4. Configure Staff identities & permissions
    const buyerId = 'usr_buyer_rev_01';
    const storeManagerId = 'usr_mgr_rev_01';

    let revSupervisor = StaffAccessControl.getStaffMemberByEmail("rev.supervisor@cakes2home.com");
    if (!revSupervisor) {
      revSupervisor = StaffAccessControl.createStaffMember({
        name: "Reversal Supervisor",
        phone: "+91 99999 77777",
        email: "rev.supervisor@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(revSupervisor.id, "ACCOUNTING.POST", "ALLOW", "admin_01");
    StaffAccessControl.setStaffOverride(revSupervisor.id, "ACCOUNTING.APPROVE", "ALLOW", "admin_01");
    const reversalSupervisorId = revSupervisor.id;

    let unauthStaff = StaffAccessControl.getStaffMemberByEmail("unauth.rev@cakes2home.com");
    if (!unauthStaff) {
      unauthStaff = StaffAccessControl.createStaffMember({
        name: "Unauthorized Staff",
        phone: "+91 99999 88888",
        email: "unauth.rev@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(unauthStaff.id, "ACCOUNTING.POST", "DENY", "admin_01");
    const unauthorizedStaffId = unauthStaff.id;

    assert(hasEffectivePermission({ userId: reversalSupervisorId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Reversal supervisor possesses ACCOUNTING.POST');
    assert(!hasEffectivePermission({ userId: unauthorizedStaffId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Basic staff lacks ACCOUNTING.POST');

    // Helper to setup a posted purchase with full accounting voucher, journal entry, and cost lot
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
      `, [purchaseId, supId, testBranch.id, `INV-${purchaseId}`, voucherDate, subtotal, cgstTotal, sgstTotal, igstTotal, total, buyerId, storeManagerId]);

      // Insert purchase items & cost lots
      for (const it of items) {
        await client.query(`
          INSERT INTO public.purchase_item
            (id, purchase_id, product_id, variant_id, item_type, description, quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total, created_at, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        `, [
          it.id, purchaseId, it.product_id || null, it.variant_id || null, it.item_type, it.description,
          it.qty, it.unit_cost, it.taxable, it.cgst_rate || null, it.sgst_rate || null, it.igst_rate || null,
          it.cgst || 0, it.sgst || 0, it.igst || 0, it.total,
        ]);

        await client.query(`
          INSERT INTO public.inventory_cost_lot
            (id, purchase_item_id, purchase_id, supplier_id, branch_id, product_id, variant_id, item_type, received_quantity, remaining_quantity, unit_cost, total_cost, currency, received_at, status, created_by, created_at, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, 'INR', $12, 'ACTIVE', $13, NOW(), NOW())
        `, [
          `lot_${it.id}`, it.id, purchaseId, supId, testBranch.id, it.product_id || null, it.variant_id || null,
          it.item_type, it.qty, it.unit_cost, Math.round(it.qty * it.unit_cost * 100) / 100, voucherDate, buyerId
        ]);

        // Increment physical branch stock
        if (it.variant_id) {
          await client.query(`
            UPDATE public.branch_inventory
            SET quantity = quantity + $1
            WHERE branch_id = $2 AND variant_id = $3
          `, [it.qty, testBranch.id, it.variant_id]);
        }
      }

      // Create & post original PURCHASE voucher and journal
      const voucherNo = `VCH-PUR-FY2627-${Date.now().toString(36).toUpperCase()}`;
      const vRes = await client.query(`
        INSERT INTO public.accounting_voucher
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, narration, created_by, submitted_by, approved_by, posted_by, posted_at, created_at, updated_at)
        VALUES
          ($1, $2, 'PURCHASE', $3, $4, 'FY2627', 'POSTED', $5, 'INR', 'PURCHASE', $6, 'INVOICE_POSTED', 'Original Purchase Voucher', 'clerk_01', 'clerk_01', $7, $8, NOW(), NOW(), NOW())
        RETURNING *
      `, [`vch_orig_${purchaseId}`, voucherNo, voucherDate, testBranch.id, total, purchaseId, storeManagerId, reversalSupervisorId]);
      const voucher = vRes.rows[0];

      const entryNo = `JE-FY2627-${Date.now().toString(36).toUpperCase()}`;
      const jeRes = await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at)
        VALUES
          ($1, $2, $3, $4, $5, 'FY2627', $6, $6, false, $7, NOW())
        RETURNING *
      `, [`je_orig_${purchaseId}`, entryNo, voucher.id, voucherDate, testBranch.id, total, reversalSupervisorId]);
      const journal = jeRes.rows[0];

      // Add lines: Dr Inventory, Dr GST, Cr AP 2111
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
      `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 1, apAcc, total, testBranch.id, supId]);

      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
        VALUES
          ($1, $2, $3, $4, $5, 0, $6, $7, 'Inventory Accessories')
      `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 2, acc1131, subtotal, testBranch.id, supId]);

      if (cgstTotal > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, $3, $4, $5, 0, $6, $7, 'Input CGST')
        `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 3, cgstAcc, cgstTotal, testBranch.id, supId]);
      }

      if (sgstTotal > 0) {
        await client.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration)
          VALUES
            ($1, $2, $3, $4, $5, 0, $6, $7, 'Input SGST')
        `, [`jl_${purchaseId}_${lineNo++}`, journal.id, 4, sgstAcc, sgstTotal, testBranch.id, supId]);
      }

      return { purchaseId, voucher, journal, total };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: PURCHASE STATUS GUARDS (ONLY POSTED PURCHASES CAN BE REVERSED)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/11] Testing purchase status guards (DRAFT, SUBMITTED, APPROVED, non-existent rejected)...');

    // 2.1 Test DRAFT purchase
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
      VALUES
        ('pur_rev_draft', $1, $2, 'INV-DRAFT', '2026-09-25', 1000, 0, 1000, 0, 0, 0, 1000, 'DRAFT', $3, $4, NOW(), NOW())
    `, [supId, testBranch.id, buyerId, storeManagerId]);

    const revDraftRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_draft',
      branchId: testBranch.id,
      reason: 'Entered in error',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!revDraftRes.success, 'Reversal against DRAFT purchase is rejected');
    assert(revDraftRes.code === 'INVALID_PURCHASE_STATUS', `Returns INVALID_PURCHASE_STATUS (got ${revDraftRes.code})`);

    // 2.2 Test SUBMITTED purchase
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
      VALUES
        ('pur_rev_submitted', $1, $2, 'INV-SUB', '2026-09-25', 1000, 0, 1000, 0, 0, 0, 1000, 'SUBMITTED', $3, $4, NOW(), NOW())
    `, [supId, testBranch.id, buyerId, storeManagerId]);

    const revSubRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_submitted',
      branchId: testBranch.id,
      reason: 'Entered in error',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!revSubRes.success, 'Reversal against SUBMITTED purchase is rejected');
    assert(revSubRes.code === 'INVALID_PURCHASE_STATUS', `Returns INVALID_PURCHASE_STATUS (got ${revSubRes.code})`);

    // 2.3 Test APPROVED (unposted) purchase
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
      VALUES
        ('pur_rev_approved', $1, $2, 'INV-APP', '2026-09-25', 1000, 0, 1000, 0, 0, 0, 1000, 'APPROVED', $3, $4, NOW(), NOW())
    `, [supId, testBranch.id, buyerId, storeManagerId]);

    const revAppRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_approved',
      branchId: testBranch.id,
      reason: 'Entered in error',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!revAppRes.success, 'Reversal against APPROVED (unposted) purchase is rejected');
    assert(revAppRes.code === 'INVALID_PURCHASE_STATUS', `Returns INVALID_PURCHASE_STATUS (got ${revAppRes.code})`);

    // 2.4 Test non-existent purchase
    const revNonExistent = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_nonexistent',
      branchId: testBranch.id,
      reason: 'Entered in error',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!revNonExistent.success, 'Reversal against non-existent purchase is rejected');
    assert(revNonExistent.code === 'PURCHASE_NOT_FOUND', `Returns PURCHASE_NOT_FOUND (got ${revNonExistent.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: FAIL-CLOSED CONFIGURATION GUARDS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/11] Testing fail-closed configuration guards (start date & fiscal period)...');

    // Create a POSTED purchase with cost lot
    await setupPostedPurchase('pur_rev_posted_01', [{
      id: 'pi_rev_pos_01', product_id: testAccessory.product_id, variant_id: testAccessory.variant_id,
      item_type: 'ACCESSORY', description: 'Party Poppers', qty: 10, unit_cost: 200, taxable: 2000,
      gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 180, sgst: 180, total: 2360,
    }]);

    // 3.1 Unconfigured accounting start date
    const revNoStartDate = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_posted_01',
      branchId: testBranch.id,
      reason: 'Void invoice',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!revNoStartDate.success, 'Reversal blocked when accounting start date is unconfigured');
    assert(revNoStartDate.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED', `Returns ACCOUNTING_START_DATE_NOT_CONFIGURED (got ${revNoStartDate.code})`);

    // Configure temporary mock start date inside rollback transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_rev', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW())
    `);
    assert(true, 'Configured temporary mock accounting_start_date inside rollback transaction');

    // 3.2 Zero configured fiscal periods
    const revNoPeriod = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_posted_01',
      branchId: testBranch.id,
      reason: 'Void invoice',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!revNoPeriod.success, 'Reversal blocked when zero fiscal periods configured');
    assert(revNoPeriod.code === 'FISCAL_PERIOD_NOT_CONFIGURED', `Returns FISCAL_PERIOD_NOT_CONFIGURED (got ${revNoPeriod.code})`);

    // Configure temporary mock fiscal period inside rollback transaction
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_rev', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      )
    `);
    assert(true, 'Configured temporary mock fiscal period inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: SEGREGATION OF DUTIES (SoD) & PERMISSION ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/11] Testing Segregation of Duties (SoD) and RBAC on purchase reversals...');

    // 4.1 Purchase creator cannot reverse invoice
    const sodBuyerRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_posted_01',
      branchId: testBranch.id,
      reason: 'Buyer attempting reversal',
      reversalDate: '2026-09-25',
      reversedBy: buyerId, // buyerId === purchase.created_by
      client,
    });
    assert(!sodBuyerRes.success, 'Reversal blocked when reversedBy === purchase.created_by');
    assert(sodBuyerRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase creator (got ${sodBuyerRes.code})`);

    // 4.2 Purchase commercial approver cannot reverse invoice
    const sodMgrRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_posted_01',
      branchId: testBranch.id,
      reason: 'Manager attempting reversal',
      reversalDate: '2026-09-25',
      reversedBy: storeManagerId, // storeManagerId === purchase.approved_by
      client,
    });
    assert(!sodMgrRes.success, 'Reversal blocked when reversedBy === purchase.approved_by');
    assert(sodMgrRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase approver (got ${sodMgrRes.code})`);

    // 4.3 Super Admin cannot bypass SoD if they were the purchase creator
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
      VALUES
        ('pur_rev_admin_creator', $1, $2, 'INV-ADMIN-REV', '2026-09-25', 1000, 0, 1000, 0, 0, 0, 1000, 'POSTED', 'admin_01', $3, NOW(), NOW())
    `, [supId, testBranch.id, storeManagerId]);

    const sodAdminRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_admin_creator',
      branchId: testBranch.id,
      reason: 'Admin self-reversal attempt',
      reversalDate: '2026-09-25',
      reversedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      client,
    });
    assert(!sodAdminRes.success, 'Super Admin CANNOT bypass SoD if they were the purchase creator');
    assert(sodAdminRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for Super Admin creator (got ${sodAdminRes.code})`);

    // 4.4 Staff lacking ACCOUNTING.POST is rejected
    const unauthRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_posted_01',
      branchId: testBranch.id,
      reason: 'Unauthorized reversal',
      reversalDate: '2026-09-25',
      reversedBy: unauthorizedStaffId,
      actorRole: 'STAFF',
      client,
    });
    assert(!unauthRes.success, 'Staff lacking ACCOUNTING.POST is rejected');
    assert(unauthRes.code === 'PERMISSION_DENIED', `Returns PERMISSION_DENIED (got ${unauthRes.code})`);

    // 4.5 Branch access / BOLA defense: branch mismatch rejected
    const bolaRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_posted_01',
      branchId: 'br_other_branch_999',
      reason: 'Branch breach attempt',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!bolaRes.success, 'Branch mismatch correctly rejected with BRANCH_ACCESS_DENIED');
    assert(bolaRes.code === 'BRANCH_ACCESS_DENIED', `Returns BRANCH_ACCESS_DENIED (got ${bolaRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: PAYMENT BLOCKING GUARD (CANNOT REVERSE IF PAYMENTS EXIST)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/11] Testing payment blocking guard (cannot void invoice with supplier payments)...');

    // Setup posted purchase with a recorded payment
    await setupPostedPurchase('pur_rev_with_pay_01', [{
      id: 'pi_pay_block_01', item_type: 'ACCESSORY', description: 'Candles',
      qty: 10, unit_cost: 50, taxable: 500, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 45, sgst: 45, total: 590,
    }]);

    await client.query(`
      INSERT INTO public.purchase_payment
        (id, purchase_id, amount, method, payment_date, created_by, created_at, updated_at)
      VALUES
        ('purp_test_rev_block', 'pur_rev_with_pay_01', 200, 'BANK_TRANSFER', '2026-09-25', $1, NOW(), NOW())
    `, [reversalSupervisorId]);

    const payBlockRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_with_pay_01',
      branchId: testBranch.id,
      reason: 'Attempt reverse paid invoice',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!payBlockRes.success, 'Reversal blocked when supplier payments exist');
    assert(payBlockRes.code === 'CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS', `Returns CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS (got ${payBlockRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: CONSUMED / ALTERED INVENTORY GUARD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/11] Testing consumed/altered inventory guards (reversal requires 100% untouched stock)...');

    // 6.1 Purchase with a physical return / debit note already processed
    await setupPostedPurchase('pur_rev_with_dn_01', [{
      id: 'pi_dn_block_01', item_type: 'ACCESSORY', description: 'Balloons',
      qty: 20, unit_cost: 10, taxable: 200, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 18, sgst: 18, total: 236,
    }]);

    // Process a partial debit note
    await PurchaseReturnService.processReturn({
      purchaseId: 'pur_rev_with_dn_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_dn_block_01', quantity: 5 }],
      returnDate: '2026-09-25',
      reason: 'Partial return 5 units',
      returnedBy: reversalSupervisorId,
      client,
    });

    // Attempt invoice reversal on this purchase -> must fail closed
    const dnBlockRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_with_dn_01',
      branchId: testBranch.id,
      reason: 'Attempt reverse purchase with existing debit note',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!dnBlockRes.success, 'Reversal blocked when physical returns/debit notes already exist');
    assert(dnBlockRes.code === 'CANNOT_REVERSE_CONSUMED_LOTS', `Returns CANNOT_REVERSE_CONSUMED_LOTS (got ${dnBlockRes.code})`);

    // 6.2 Purchase where lot has child cost consumption records
    await setupPostedPurchase('pur_rev_with_cons_01', [{
      id: 'pi_cons_block_01', item_type: 'ACCESSORY', description: 'Ribbons',
      qty: 10, unit_cost: 25, taxable: 250, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 22.5, sgst: 22.5, total: 295,
    }]);

    await client.query(`
      INSERT INTO public.inventory_movement
        (id, branch_id, product_id, variant_id, movement_type, quantity, direction, narration, created_by, created_at)
      VALUES
        ('mov_test_cons_01', $1, $2, $3, 'SALES_FULFILLMENT', 2, 'OUT', 'Test fulfillment', $4, NOW())
    `, [testBranch.id, testAccessory.product_id, testAccessory.variant_id, buyerId]);

    await client.query(`
      INSERT INTO public.inventory_cost_consumption
        (id, movement_id, lot_id, quantity, unit_cost, total_cost, created_at)
      VALUES
        ('icc_test_block', 'mov_test_cons_01', 'lot_pi_cons_block_01', 2, 25, 50, NOW())
    `);

    const consBlockRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_with_cons_01',
      branchId: testBranch.id,
      reason: 'Attempt reverse purchase with consumed lot',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!consBlockRes.success, 'Reversal blocked when lot has cost consumption records');
    assert(consBlockRes.code === 'CANNOT_REVERSE_CONSUMED_LOTS', `Returns CANNOT_REVERSE_CONSUMED_LOTS (got ${consBlockRes.code})`);

    // 6.3 Purchase where physical stock in branch is less than received quantity
    await setupPostedPurchase('pur_rev_stock_block_01', [{
      id: 'pi_stock_block_01', product_id: testAccessory.product_id, variant_id: testAccessory.variant_id,
      item_type: 'ACCESSORY', description: 'Poppers', qty: 20, unit_cost: 100, taxable: 2000,
      gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 180, sgst: 180, total: 2360,
    }]);

    // Force physical stock in branch to 5 (less than received quantity 20)
    await client.query(`
      UPDATE public.branch_inventory
      SET quantity = 5
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);

    const stockBlockRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_stock_block_01',
      branchId: testBranch.id,
      reason: 'Attempt reverse with insufficient branch stock',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!stockBlockRes.success, 'Reversal blocked when physical branch stock is insufficient');
    assert(stockBlockRes.code === 'INSUFFICIENT_STOCK_FOR_REVERSAL', `Returns INSUFFICIENT_STOCK_FOR_REVERSAL (got ${stockBlockRes.code})`);

    // Reset branch stock
    await client.query(`
      UPDATE public.branch_inventory
      SET quantity = 100
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: FULL CLEAN PURCHASE INVOICE REVERSAL EXECUTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/11] Testing full clean purchase invoice reversal execution...');

    // Record initial branch stock
    const binvBeforeRes = await client.query(`
      SELECT quantity FROM public.branch_inventory
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);
    const binvBefore = Number(binvBeforeRes.rows[0].quantity);

    // Setup pristine posted purchase:
    // 'pur_rev_clean_01': 10 units @ 200 = 2000 + 18% GST (360) = 2360.00
    // physical stock was incremented by 10
    const cleanPurchaseSetup = await setupPostedPurchase('pur_rev_clean_01', [{
      id: 'pi_clean_01', product_id: testAccessory.product_id, variant_id: testAccessory.variant_id,
      item_type: 'ACCESSORY', description: 'Party Poppers Full', qty: 10, unit_cost: 200, taxable: 2000,
      gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 180, sgst: 180, total: 2360,
    }]);

    const binvWithPurchase = binvBefore + 10;
    const cleanRevRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_clean_01',
      branchId: testBranch.id,
      reason: 'Invoice entered in error - duplicate vendor bill',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });

    assert(cleanRevRes.success, 'Clean purchase invoice reversal executed successfully');
    const revData = cleanRevRes.data;

    // 7.1 Verify Compensating Reversal Voucher
    assert(!!revData.reversal_voucher, 'Compensating reversal voucher created');
    assert(revData.reversal_voucher.voucher_type === 'JOURNAL', 'Reversal voucher type is JOURNAL');
    assert(revData.reversal_voucher.status === 'POSTED', 'Reversal voucher status is POSTED');
    assert(revData.reversal_voucher.reference_type === 'PURCHASE_REVERSAL', 'Reversal voucher reference_type is PURCHASE_REVERSAL');
    assert(revData.reversal_voucher.reversal_of_voucher_id === cleanPurchaseSetup.voucher.id, `Reversal voucher points to original voucher (${revData.reversal_voucher.reversal_of_voucher_id})`);
    assert(Number(revData.reversal_voucher.total_amount) === 2360.00, `Reversal voucher total === 2360.00 (got ${revData.reversal_voucher.total_amount})`);

    // 7.2 Verify Original Voucher Immutability & Linkage
    const origVAfter = (await client.query("SELECT * FROM public.accounting_voucher WHERE id = $1", [cleanPurchaseSetup.voucher.id])).rows[0];
    assert(origVAfter.status === 'POSTED', 'Original voucher status remains POSTED (immutable status per chk_voucher_status)');
    assert(origVAfter.reversed_by_voucher_id === revData.reversal_voucher.id, `Original voucher linked to reversal voucher (${origVAfter.reversed_by_voucher_id})`);

    // 7.3 Verify Original Journal Entry is marked reversed
    const origJeAfter = (await client.query("SELECT * FROM public.accounting_journal_entry WHERE id = $1", [cleanPurchaseSetup.journal.id])).rows[0];
    assert(origJeAfter.is_reversed === true, 'Original journal entry is marked is_reversed = true');
    assert(!!origJeAfter.reversed_at, `Original journal entry reversed_at is populated (${origJeAfter.reversed_at})`);

    // 7.4 Verify Inverted Compensating Journal Lines
    const compLines = revData.reversal_journal_entry.lines;
    assert(Number(revData.reversal_journal_entry.total_debit) === 2360.00, `Reversal journal total_debit === 2360.00 (got ${revData.reversal_journal_entry.total_debit})`);
    assert(Number(revData.reversal_journal_entry.total_credit) === 2360.00, `Reversal journal total_credit === 2360.00 (got ${revData.reversal_journal_entry.total_credit})`);

    const apDebitLine = compLines.find(l => Number(l.debit_amount) === 2360.00);
    assert(!!apDebitLine, 'Found Accounts Payable debit line (Dr 2111 for ₹2,360)');
    assert(apDebitLine.supplier_id === supId, 'AP debit line carries supplier_id');
    assert(apDebitLine.branch_id === testBranch.id, 'AP debit line carries branch_id');

    const invCreditLine = compLines.find(l => l.narration && l.narration.includes('Inventory Accessories'));
    assert(!!invCreditLine, 'Found Inventory credit line');
    assert(Number(invCreditLine.credit_amount) === 2000.00, `Inventory credit === 2000.00 (got ${invCreditLine.credit_amount})`);

    const cgstCreditLine = compLines.find(l => l.narration && l.narration.includes('Input CGST'));
    assert(!!cgstCreditLine, 'Found Input CGST credit line');
    assert(Number(cgstCreditLine.credit_amount) === 180.00, `CGST credit === 180.00 (got ${cgstCreditLine.credit_amount})`);

    const sgstCreditLine = compLines.find(l => l.narration && l.narration.includes('Input SGST'));
    assert(!!sgstCreditLine, 'Found Input SGST credit line');
    assert(Number(sgstCreditLine.credit_amount) === 180.00, `SGST credit === 180.00 (got ${sgstCreditLine.credit_amount})`);

    // 7.5 Verify Cost Lots Transitioned to REVERSED
    assert(revData.reversed_lots.length === 1, 'Exactly one cost lot reversed');
    const lotReversed = (await client.query("SELECT * FROM public.inventory_cost_lot WHERE id = $1", [revData.reversed_lots[0].id])).rows[0];
    assert(lotReversed.status === 'REVERSED', `Cost lot status is REVERSED (got ${lotReversed.status})`);
    assert(Number(lotReversed.remaining_quantity) === 0, `Cost lot remaining_quantity is 0 (got ${lotReversed.remaining_quantity})`);
    assert(Number(lotReversed.received_quantity) === 10, 'Cost lot received_quantity preserved as historical fact (10)');

    // 7.6 Verify Physical Branch Inventory Decremented
    const binvFinalRes = await client.query(`
      SELECT quantity FROM public.branch_inventory
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);
    const binvFinal = Number(binvFinalRes.rows[0].quantity);
    assert(binvFinal === binvBefore, `Branch inventory returned to original pre-purchase level (before: ${binvBefore}, final: ${binvFinal})`);

    // 7.7 Verify Inventory Movement (INVOICE_REVERSAL / OUT)
    assert(revData.movements.length === 1, 'Exactly one inventory movement created');
    const mov = revData.movements[0];
    assert(mov.movement_type === 'INVOICE_REVERSAL', `Movement type is INVOICE_REVERSAL (got ${mov.movement_type})`);
    assert(mov.direction === 'OUT', `Movement direction is OUT (got ${mov.direction})`);
    assert(Number(mov.quantity) === 10, `Movement quantity === 10 (got ${mov.quantity})`);
    assert(mov.voucher_id === revData.reversal_voucher.id, `Movement linked to reversal voucher_id (${mov.voucher_id})`);

    // 7.8 Verify Purchase Metadata Annotation
    const purAfter = (await client.query("SELECT * FROM public.purchase WHERE id = 'pur_rev_clean_01'")).rows[0];
    const meta = purAfter.metadata || {};
    assert(meta.is_reversed === true, 'Purchase metadata marked is_reversed = true');
    assert(meta.reversal?.reversed_by === reversalSupervisorId, 'Purchase metadata records reversed_by');
    assert(meta.reversal?.reversal_voucher_id === revData.reversal_voucher.id, 'Purchase metadata records reversal_voucher_id');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: REVERSAL IDEMPOTENCY GUARD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/11] Testing reversal idempotency (cannot reverse an already reversed purchase)...');

    const duplicateRevRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_clean_01',
      branchId: testBranch.id,
      reason: 'Second reversal attempt',
      reversalDate: '2026-09-25',
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!duplicateRevRes.success, 'Second reversal attempt is rejected');
    assert(duplicateRevRes.code === 'PURCHASE_ALREADY_REVERSED', `Returns PURCHASE_ALREADY_REVERSED (got ${duplicateRevRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: AP SETTLEMENT INTEGRATION VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/11] Testing AP settlement protection on reversed purchase...');

    // Attempting to record payment on a reversed purchase must be blocked
    const payOnReversedRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_rev_clean_01',
      branchId: testBranch.id,
      payment: { amount: 1000, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      paidBy: reversalSupervisorId,
      client,
    });
    assert(!payOnReversedRes.success, 'Payment against reversed purchase is blocked');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10: CONCURRENCY, SAVEPOINT ISOLATION & FAILURE INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/11] Testing savepoint rollback & failure injection on reversal...');

    // Setup purchase to test failure injection
    await setupPostedPurchase('pur_rev_fail_01', [{
      id: 'pi_fail_rev_01', item_type: 'ACCESSORY', description: 'Bells',
      qty: 5, unit_cost: 100, taxable: 500, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 45, sgst: 45, total: 590,
    }]);

    const vCountBeforeFail = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const mCountBeforeFail = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);

    // Inject failure: pass unconfigured reversal date before start date
    const failInjectRes = await PurchaseReversalService.reversePurchase({
      purchaseId: 'pur_rev_fail_01',
      branchId: testBranch.id,
      reason: 'Failed reversal attempt',
      reversalDate: '2025-01-01', // Date before start date (2026-04-01)
      reversedBy: reversalSupervisorId,
      client,
    });
    assert(!failInjectRes.success, 'Reversal before accounting start date fails');
    assert(failInjectRes.code === 'POSTING_BEFORE_ACCOUNTING_START_DATE', `Returns POSTING_BEFORE_ACCOUNTING_START_DATE (got ${failInjectRes.code})`);

    // Verify atomicity via savepoint: zero extra vouchers or movements
    const vCountAfterFail = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const mCountAfterFail = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    assert(vCountBeforeFail === vCountAfterFail, 'Zero vouchers created on failure');
    assert(mCountBeforeFail === mCountAfterFail, 'Zero inventory movements created on failure');

    // Verify cost lot remains untouched and ACTIVE
    const lotFail = (await client.query("SELECT * FROM public.inventory_cost_lot WHERE id = 'lot_pi_fail_rev_01'")).rows[0];
    assert(lotFail.status === 'ACTIVE', `Cost lot status remains ACTIVE after failure (got ${lotFail.status})`);
    assert(Number(lotFail.remaining_quantity) === 5, `Cost lot remaining_quantity remains 5 (got ${lotFail.remaining_quantity})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 11: FULL ROLLBACK & PRISTINE BASELINE AUDIT
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
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
