/**
 * CakeToHome ERP — Phase 4F Step 3D.6-A Purchase Return & Supplier Debit Note Test Suite
 *
 * SCOPE & BOUNDARIES (Step 3D.6-A):
 * - Physical purchase return against POSTED purchases.
 * - Item and cost-lot based quantity control (never exceeds available remaining_quantity).
 * - Decrements inventory_cost_lot.remaining_quantity (transitions to 'DEPLETED' when 0).
 * - Decrements branch_inventory.quantity for catalog items (non-negative bound enforced).
 * - Creates inventory_movement (movement_type = 'PURCHASE_RETURN', direction = 'OUT').
 * - Creates & posts DEBIT_NOTE voucher via canonical PostingService primitives:
 *     Dr 2111 Accounts Payable (reduced liability)
 *     Cr 1131 / 1132 / 1133 Merchandise Inventory (cost basis reversed)
 *     Cr 1141–1149 Input GST Accounts (Rule 42 ITC reversal)
 * - Integrates with AP settlement (reduces outstanding balance so supplier cannot be overpaid).
 * - Enforces Segregation of Duties (SoD) & ACCOUNTING.POST canonical permission.
 * - Fail-closed: unconfigured accounting start date and fiscal periods block returns.
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
  console.log('CakeToHome ERP — Phase 4F Step 3D.6-A Purchase Return & Debit Note Test Suite');
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

  const { PurchaseReturnService } = require('../src/lib/services/purchase-return.service');
  const { PurchasePostingService } = require('../src/lib/services/purchase-posting.service');
  const { PurchasePaymentService } = require('../src/lib/services/purchase-payment.service');
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
        VALUES ('binv_test_acc', $1, $2, 50, NOW(), NOW())
      `, [testBranch.id, testAccessory.variant_id]);
    }

    // 3. Create test supplier (Karnataka)
    const supId = `sup_test_ret_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier
        (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
      VALUES
        ($1, 'Test Karnataka Supplier Ltd', '29ABCDE1234F1Z5', 'Karnataka', $2, true, NOW(), NOW())
    `, [supId, testBranch.id]);
    assert(true, `Created test supplier ${supId}`);

    // 4. Configure Staff identities & permissions
    const buyerId = 'usr_buyer_ret_01';
    const storeManagerId = 'usr_mgr_ret_01';

    let retSupervisor = StaffAccessControl.getStaffMemberByEmail("ret.supervisor@cakes2home.com");
    if (!retSupervisor) {
      retSupervisor = StaffAccessControl.createStaffMember({
        name: "Returns Supervisor",
        phone: "+91 99999 55555",
        email: "ret.supervisor@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(retSupervisor.id, "ACCOUNTING.POST", "ALLOW", "admin_01");
    StaffAccessControl.setStaffOverride(retSupervisor.id, "ACCOUNTING.APPROVE", "ALLOW", "admin_01");
    const returnsSupervisorId = retSupervisor.id;

    let unauthStaff = StaffAccessControl.getStaffMemberByEmail("unauth.ret@cakes2home.com");
    if (!unauthStaff) {
      unauthStaff = StaffAccessControl.createStaffMember({
        name: "Unauthorized Staff",
        phone: "+91 99999 66666",
        email: "unauth.ret@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(unauthStaff.id, "ACCOUNTING.POST", "DENY", "admin_01");
    const unauthorizedStaffId = unauthStaff.id;

    assert(hasEffectivePermission({ userId: returnsSupervisorId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Returns supervisor possesses ACCOUNTING.POST');
    assert(!hasEffectivePermission({ userId: unauthorizedStaffId, role: 'STAFF' }, 'ACCOUNTING.POST'), 'Basic staff lacks ACCOUNTING.POST');

    // Helper to insert mock purchase with items
    async function createTestPurchase(id, status, items) {
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
          (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, '2026-09-25', $5, 0, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      `, [id, supId, testBranch.id, `INV-${id}`, subtotal, cgstTotal, sgstTotal, igstTotal, total, status, buyerId, storeManagerId]);

      for (const it of items) {
        await client.query(`
          INSERT INTO public.purchase_item
            (id, purchase_id, product_id, variant_id, item_type, description, quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total, created_at, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        `, [
          it.id, id, it.product_id || null, it.variant_id || null, it.item_type, it.description,
          it.qty, it.unit_cost, it.taxable, it.cgst_rate || null, it.sgst_rate || null, it.igst_rate || null,
          it.cgst || 0, it.sgst || 0, it.igst || 0, it.total,
        ]);

        if (status === 'POSTED') {
          // Create corresponding cost lot for posted purchases
          await client.query(`
            INSERT INTO public.inventory_cost_lot
              (id, purchase_item_id, purchase_id, supplier_id, branch_id, product_id, variant_id, item_type, received_quantity, remaining_quantity, unit_cost, total_cost, currency, received_at, status, created_by, created_at, updated_at)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, 'INR', '2026-09-25', 'ACTIVE', $12, NOW(), NOW())
          `, [
            `lot_${it.id}`, it.id, id, supId, testBranch.id, it.product_id || null, it.variant_id || null,
            it.item_type, it.qty, it.unit_cost, Math.round(it.qty * it.unit_cost * 100) / 100, buyerId
          ]);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: PURCHASE STATUS GUARDS (ONLY POSTED PURCHASES CAN RECEIVE RETURNS)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/11] Testing purchase status guards (DRAFT, SUBMITTED, APPROVED, non-existent rejected)...');

    // 2.1 Test DRAFT purchase
    await createTestPurchase('pur_ret_draft', 'DRAFT', [{
      id: 'pi_draft_01', item_type: 'ACCESSORY', description: 'Candles', qty: 10, unit_cost: 20, taxable: 200, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 18, sgst: 18, total: 236
    }]);
    const retDraftRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_draft',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_draft_01', quantity: 2 }],
      returnDate: '2026-09-25',
      reason: 'Defective batch',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!retDraftRes.success, 'Return against DRAFT purchase is rejected');
    assert(retDraftRes.code === 'INVALID_PURCHASE_STATUS', `Error code is INVALID_PURCHASE_STATUS (got ${retDraftRes.code})`);

    // 2.2 Test SUBMITTED purchase
    await createTestPurchase('pur_ret_submitted', 'SUBMITTED', [{
      id: 'pi_sub_01', item_type: 'ACCESSORY', description: 'Candles', qty: 10, unit_cost: 20, taxable: 200, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 18, sgst: 18, total: 236
    }]);
    const retSubRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_submitted',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_sub_01', quantity: 2 }],
      returnDate: '2026-09-25',
      reason: 'Defective batch',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!retSubRes.success, 'Return against SUBMITTED purchase is rejected');
    assert(retSubRes.code === 'INVALID_PURCHASE_STATUS', `Error code is INVALID_PURCHASE_STATUS (got ${retSubRes.code})`);

    // 2.3 Test APPROVED (unposted) purchase
    await createTestPurchase('pur_ret_approved', 'APPROVED', [{
      id: 'pi_app_01', item_type: 'ACCESSORY', description: 'Candles', qty: 10, unit_cost: 20, taxable: 200, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 18, sgst: 18, total: 236
    }]);
    const retAppRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_approved',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_app_01', quantity: 2 }],
      returnDate: '2026-09-25',
      reason: 'Defective batch',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!retAppRes.success, 'Return against APPROVED (unposted) purchase is rejected');
    assert(retAppRes.code === 'INVALID_PURCHASE_STATUS', `Error code is INVALID_PURCHASE_STATUS (got ${retAppRes.code})`);

    // 2.4 Test non-existent purchase
    const retNonExistent = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_nonexistent',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_app_01', quantity: 2 }],
      returnDate: '2026-09-25',
      reason: 'Defective batch',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!retNonExistent.success, 'Return against non-existent purchase is rejected');
    assert(retNonExistent.code === 'PURCHASE_NOT_FOUND', `Error code is PURCHASE_NOT_FOUND (got ${retNonExistent.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: FAIL-CLOSED CONFIGURATION GUARDS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/11] Testing fail-closed configuration guards (start date & fiscal period)...');

    // Create a POSTED purchase with cost lot
    await createTestPurchase('pur_ret_posted_01', 'POSTED', [{
      id: 'pi_pos_01', product_id: testAccessory.product_id, variant_id: testAccessory.variant_id,
      item_type: 'ACCESSORY', description: 'Party Poppers', qty: 10, unit_cost: 200, taxable: 2000,
      gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 180, sgst: 180, total: 2360,
    }]);

    // 3.1 Unconfigured accounting start date
    const retNoStartDate = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 2 }],
      returnDate: '2026-09-25',
      reason: 'Test return',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!retNoStartDate.success, 'Return blocked when accounting start date is unconfigured');
    assert(retNoStartDate.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED', `Returns ACCOUNTING_START_DATE_NOT_CONFIGURED (got ${retNoStartDate.code})`);

    // Configure temporary mock start date inside rollback transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_ret', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW())
    `);
    assert(true, 'Configured temporary mock accounting_start_date inside rollback transaction');

    // 3.2 Zero configured fiscal periods
    const retNoPeriod = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 2 }],
      returnDate: '2026-09-25',
      reason: 'Test return',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!retNoPeriod.success, 'Return blocked when zero fiscal periods configured');
    assert(retNoPeriod.code === 'FISCAL_PERIOD_NOT_CONFIGURED', `Returns FISCAL_PERIOD_NOT_CONFIGURED (got ${retNoPeriod.code})`);

    // Configure temporary mock fiscal period inside rollback transaction
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_ret', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      )
    `);
    assert(true, 'Configured temporary mock fiscal period inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: SEGREGATION OF DUTIES (SoD) & PERMISSION ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/11] Testing Segregation of Duties (SoD) and RBAC on purchase returns...');

    // 4.1 Purchase creator cannot authorize or process return
    const sodBuyerRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 1 }],
      returnDate: '2026-09-25',
      reason: 'Buyer attempting return',
      returnedBy: buyerId, // buyerId === purchase.created_by
      client,
    });
    assert(!sodBuyerRes.success, 'Return blocked when returnedBy === purchase.created_by');
    assert(sodBuyerRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase creator (got ${sodBuyerRes.code})`);

    // 4.2 Purchase commercial approver cannot authorize or process return
    const sodMgrRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 1 }],
      returnDate: '2026-09-25',
      reason: 'Manager attempting return',
      returnedBy: storeManagerId, // storeManagerId === purchase.approved_by
      client,
    });
    assert(!sodMgrRes.success, 'Return blocked when returnedBy === purchase.approved_by');
    assert(sodMgrRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase approver (got ${sodMgrRes.code})`);

    // 4.3 Super Admin cannot bypass SoD if they created the purchase requisition
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
      VALUES
        ('pur_ret_admin_creator', $1, $2, 'INV-ADMIN-RET', '2026-09-25', 1000, 0, 1000, 0, 0, 0, 1000, 'POSTED', 'admin_01', $3, NOW(), NOW())
    `, [supId, testBranch.id, storeManagerId]);
    await client.query(`
      INSERT INTO public.purchase_item
        (id, purchase_id, item_type, description, quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total, created_at, updated_at)
      VALUES
        ('pi_admin_01', 'pur_ret_admin_creator', 'ACCESSORY', 'Admin Item', 5, 200, 0, 1000, 0, 0, 0, 0, 0, 0, 1000, NOW(), NOW())
    `);
    await client.query(`
      INSERT INTO public.inventory_cost_lot
        (id, purchase_item_id, purchase_id, supplier_id, branch_id, item_type, received_quantity, remaining_quantity, unit_cost, total_cost, currency, received_at, status, created_by, created_at, updated_at)
      VALUES
        ('lot_admin_01', 'pi_admin_01', 'pur_ret_admin_creator', $1, $2, 'ACCESSORY', 5, 5, 200, 1000, 'INR', '2026-09-25', 'ACTIVE', 'admin_01', NOW(), NOW())
    `, [supId, testBranch.id]);

    const sodAdminRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_admin_creator',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_admin_01', quantity: 1 }],
      returnDate: '2026-09-25',
      reason: 'Admin self-approval attempt',
      returnedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      client,
    });
    assert(!sodAdminRes.success, 'Super Admin CANNOT bypass SoD if they were the purchase creator');
    assert(sodAdminRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for Super Admin creator (got ${sodAdminRes.code})`);

    // 4.4 Staff lacking ACCOUNTING.POST is rejected
    const unauthRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 1 }],
      returnDate: '2026-09-25',
      reason: 'Unauthorized return',
      returnedBy: unauthorizedStaffId,
      actorRole: 'STAFF',
      client,
    });
    assert(!unauthRes.success, 'Staff lacking ACCOUNTING.POST is rejected');
    assert(unauthRes.code === 'PERMISSION_DENIED', `Returns PERMISSION_DENIED (got ${unauthRes.code})`);

    // 4.5 Branch access / BOLA defense: branch mismatch rejected
    const bolaRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: 'br_other_branch_999',
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 1 }],
      returnDate: '2026-09-25',
      reason: 'Branch breach attempt',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!bolaRes.success, 'Branch mismatch correctly rejected with BRANCH_ACCESS_DENIED');
    assert(bolaRes.code === 'BRANCH_ACCESS_DENIED', `Returns BRANCH_ACCESS_DENIED (got ${bolaRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: QUANTITY & COST LOT VALIDATION GUARDS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/11] Testing return quantity and item validation guards...');

    // 5.1 Empty items array
    const emptyItemsRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [],
      returnDate: '2026-09-25',
      reason: 'Empty items',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!emptyItemsRes.success, 'Empty items array rejected with EMPTY_RETURN');
    assert(emptyItemsRes.code === 'EMPTY_RETURN', `Returns EMPTY_RETURN (got ${emptyItemsRes.code})`);

    // 5.2 Zero return quantity
    const zeroQtyRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 0 }],
      returnDate: '2026-09-25',
      reason: 'Zero quantity',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!zeroQtyRes.success, 'Zero return quantity rejected with INVALID_RETURN_QUANTITY');
    assert(zeroQtyRes.code === 'INVALID_RETURN_QUANTITY', `Returns INVALID_RETURN_QUANTITY (got ${zeroQtyRes.code})`);

    // 5.3 Negative return quantity
    const negQtyRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: -2 }],
      returnDate: '2026-09-25',
      reason: 'Negative quantity',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!negQtyRes.success, 'Negative return quantity rejected with INVALID_RETURN_QUANTITY');
    assert(negQtyRes.code === 'INVALID_RETURN_QUANTITY', `Returns INVALID_RETURN_QUANTITY (got ${negQtyRes.code})`);

    // 5.4 Foreign item not in purchase
    const foreignItemRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_admin_01', quantity: 1 }],
      returnDate: '2026-09-25',
      reason: 'Foreign item return',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!foreignItemRes.success, 'Item from another purchase rejected with ITEM_NOT_FOUND');
    assert(foreignItemRes.code === 'ITEM_NOT_FOUND', `Returns ITEM_NOT_FOUND (got ${foreignItemRes.code})`);

    // 5.5 Return quantity exceeding cost lot remaining quantity
    const overQtyRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 15 }], // Lot only has 10 units
      returnDate: '2026-09-25',
      reason: 'Over-return attempt',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!overQtyRes.success, 'Return exceeding available lot quantity rejected with RETURN_EXCEEDS_AVAILABLE_QUANTITY');
    assert(overQtyRes.code === 'RETURN_EXCEEDS_AVAILABLE_QUANTITY', `Returns RETURN_EXCEEDS_AVAILABLE_QUANTITY (got ${overQtyRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: CANONICAL PARTIAL PURCHASE RETURN & SUPPLIER DEBIT NOTE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/11] Testing atomic partial purchase return & supplier debit note...');

    // Record initial branch inventory
    const binvBeforeRes = await client.query(`
      SELECT quantity FROM public.branch_inventory
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);
    const binvBefore = Number(binvBeforeRes.rows[0].quantity);

    // Initial lot: received 10, remaining 10, unit_cost 200, total_cost 2000, 18% GST (9% CGST 180, 9% SGST 180)
    // Partial return: 3 units
    // Returned item cost = 3 * 200 = 600.00
    // Returned taxable = (2000 / 10) * 3 = 600.00
    // Reversed CGST (9%) = 54.00
    // Reversed SGST (9%) = 54.00
    // Total debit to 2111 Accounts Payable = 600 + 54 + 54 = 708.00
    const partialReturnRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 3, reason: 'Damaged packaging' }],
      returnDate: '2026-09-25',
      reason: 'Partial return - 3 units damaged',
      returnedBy: returnsSupervisorId,
      client,
    });

    assert(partialReturnRes.success, 'Partial purchase return executed successfully');
    const returnData = partialReturnRes.data;

    // Verify Debit Note Voucher
    assert(!!returnData.debit_note_id, `Generated debit_note_id: ${returnData.debit_note_id}`);
    assert(returnData.voucher.voucher_type === 'DEBIT_NOTE', 'Voucher type is DEBIT_NOTE');
    assert(returnData.voucher.status === 'POSTED', 'Voucher status is POSTED');
    assert(returnData.voucher.reference_type === 'PURCHASE_RETURN', 'Voucher reference_type is PURCHASE_RETURN');
    assert(Number(returnData.voucher.total_amount) === 708.00, `Voucher total_amount === 708.00 (got ${returnData.voucher.total_amount})`);

    // Verify General Ledger Journal Entry
    assert(!!returnData.journal_entry, 'Journal entry created');
    assert(Number(returnData.journal_entry.total_debit) === 708.00, `Journal total_debit === 708.00 (got ${returnData.journal_entry.total_debit})`);
    assert(Number(returnData.journal_entry.total_credit) === 708.00, `Journal total_credit === 708.00 (got ${returnData.journal_entry.total_credit})`);
    assert(returnData.journal_entry.lines.length >= 3, `Journal contains at least 3 lines (got ${returnData.journal_entry.lines.length})`);

    // Check individual journal lines
    const jlLines = returnData.journal_entry.lines;
    const apLine = jlLines.find(l => Number(l.debit_amount) > 0);
    assert(!!apLine, 'Found Accounts Payable debit line');
    assert(Number(apLine.debit_amount) === 708.00, `AP debit amount === 708.00 (got ${apLine.debit_amount})`);
    assert(apLine.supplier_id === supId, `AP line carries supplier_id (${apLine.supplier_id})`);
    assert(apLine.branch_id === testBranch.id, `AP line carries branch_id (${apLine.branch_id})`);

    const invCredit = jlLines.find(l => l.narration && l.narration.includes('Inventory Reversal'));
    assert(!!invCredit, 'Found Inventory Reversal credit line');
    assert(Number(invCredit.credit_amount) === 600.00, `Inventory credit amount === 600.00 (got ${invCredit.credit_amount})`);

    const cgstCredit = jlLines.find(l => l.narration && l.narration.includes('CGST Reversal'));
    assert(!!cgstCredit, 'Found CGST Reversal credit line');
    assert(Number(cgstCredit.credit_amount) === 54.00, `CGST credit amount === 54.00 (got ${cgstCredit.credit_amount})`);

    const sgstCredit = jlLines.find(l => l.narration && l.narration.includes('SGST Reversal'));
    assert(!!sgstCredit, 'Found SGST Reversal credit line');
    assert(Number(sgstCredit.credit_amount) === 54.00, `SGST credit amount === 54.00 (got ${sgstCredit.credit_amount})`);

    // Verify Cost Lot updates
    const lotAfterRes = await client.query(`
      SELECT * FROM public.inventory_cost_lot WHERE purchase_item_id = 'pi_pos_01'
    `);
    const lotAfter = lotAfterRes.rows[0];
    assert(Number(lotAfter.remaining_quantity) === 7, `Lot remaining_quantity reduced from 10 to 7 (got ${lotAfter.remaining_quantity})`);
    assert(lotAfter.status === 'ACTIVE', `Lot status remains ACTIVE since remaining > 0 (got ${lotAfter.status})`);
    assert(Number(lotAfter.received_quantity) === 10, 'Lot received_quantity preserved as immutable historical fact (10)');

    // Verify Physical Branch Inventory updates
    const binvAfterRes = await client.query(`
      SELECT quantity FROM public.branch_inventory
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);
    const binvAfter = Number(binvAfterRes.rows[0].quantity);
    assert(binvAfter === binvBefore - 3, `Branch inventory decremented by exactly 3 (before: ${binvBefore}, after: ${binvAfter})`);

    // Verify Inventory Movement
    assert(returnData.movements.length === 1, 'Exactly one inventory movement created');
    const mov = returnData.movements[0];
    assert(mov.movement_type === 'PURCHASE_RETURN', `Movement type is PURCHASE_RETURN (got ${mov.movement_type})`);
    assert(mov.direction === 'OUT', `Movement direction is OUT (got ${mov.direction})`);
    assert(Number(mov.quantity) === 3, `Movement quantity === 3 (got ${mov.quantity})`);
    assert(mov.voucher_id === returnData.voucher.id, `Movement linked to voucher_id (${mov.voucher_id})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: FULL EXHAUSTION RETURN (TRANSITION TO DEPLETED)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/11] Testing full return of remaining units & transition to DEPLETED...');

    // Attempt to return 8 units (only 7 remain) -> should fail
    const overRemainingRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 8 }],
      returnDate: '2026-09-25',
      reason: 'Attempt return 8 of 7',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!overRemainingRes.success, 'Returning 8 units when 7 remain rejected with RETURN_EXCEEDS_AVAILABLE_QUANTITY');
    assert(overRemainingRes.code === 'RETURN_EXCEEDS_AVAILABLE_QUANTITY', `Returns RETURN_EXCEEDS_AVAILABLE_QUANTITY (got ${overRemainingRes.code})`);

    // Return the exact remaining 7 units
    // Returned cost = 7 * 200 = 1400.00
    // Taxable = 1400.00
    // CGST 9% = 126.00, SGST 9% = 126.00
    // Total debit = 1400 + 126 + 126 = 1652.00
    const fullReturnRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 7, reason: 'Remaining batch rejected' }],
      returnDate: '2026-09-25',
      reason: 'Full return of remaining stock',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(fullReturnRes.success, 'Full remaining return processed successfully');

    // Verify Cost Lot is now DEPLETED
    const lotDepletedRes = await client.query(`
      SELECT * FROM public.inventory_cost_lot WHERE purchase_item_id = 'pi_pos_01'
    `);
    const lotDepleted = lotDepletedRes.rows[0];
    assert(Number(lotDepleted.remaining_quantity) === 0, `Lot remaining_quantity === 0 (got ${lotDepleted.remaining_quantity})`);
    assert(lotDepleted.status === 'DEPLETED', `Lot status transitioned to DEPLETED (got ${lotDepleted.status})`);

    // Verify physical branch inventory
    const binvFinalRes = await client.query(`
      SELECT quantity FROM public.branch_inventory
      WHERE branch_id = $1 AND variant_id = $2
    `, [testBranch.id, testAccessory.variant_id]);
    const binvFinal = Number(binvFinalRes.rows[0].quantity);
    assert(binvFinal === binvBefore - 10, `Branch inventory decremented by full 10 units (before: ${binvBefore}, after: ${binvFinal})`);

    // Attempting any further return on this item must fail immediately
    const zeroLotReturnRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_posted_01',
      branchId: testBranch.id,
      items: [{ purchaseItemId: 'pi_pos_01', quantity: 1 }],
      returnDate: '2026-09-25',
      reason: 'Attempt return from depleted lot',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!zeroLotReturnRes.success, 'Return against depleted lot rejected with RETURN_EXCEEDS_AVAILABLE_QUANTITY');
    assert(zeroLotReturnRes.code === 'RETURN_EXCEEDS_AVAILABLE_QUANTITY', `Returns RETURN_EXCEEDS_AVAILABLE_QUANTITY (got ${zeroLotReturnRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: MULTI-ITEM RETURN ACROSS MERCHANDISE TYPES (CAKES + PACKAGING)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/11] Testing multi-item return across merchandise classifications (Cakes + Packaging)...');

    // Create a multi-item purchase: Cake (5% GST) + Packaging (18% GST)
    await createTestPurchase('pur_ret_multi_01', 'POSTED', [
      {
        id: 'pi_multi_cake', item_type: 'CAKE', description: 'Chocolate Truffle 1kg',
        qty: 5, unit_cost: 400, taxable: 2000, gst_rate: 5, cgst_rate: 2.5, sgst_rate: 2.5, cgst: 50, sgst: 50, total: 2100,
      },
      {
        id: 'pi_multi_pkg', item_type: 'PACKAGING', description: 'Corrugated Cake Boxes',
        qty: 100, unit_cost: 15, taxable: 1500, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 135, sgst: 135, total: 1770,
      },
    ]);

    // Return 2 cakes and 20 packaging boxes in a single debit note
    // Cake return: 2 * 400 = 800 cost, Taxable = 800, CGST 2.5% = 20, SGST 2.5% = 20 -> Subtotal = 840.00
    // Packaging return: 20 * 15 = 300 cost, Taxable = 300, CGST 9% = 27, SGST 9% = 27 -> Subtotal = 354.00
    // Total Debit Note = 840 + 354 = 1194.00
    const multiReturnRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_multi_01',
      branchId: testBranch.id,
      items: [
        { purchaseItemId: 'pi_multi_cake', quantity: 2, reason: 'Expired date' },
        { purchaseItemId: 'pi_multi_pkg', quantity: 20, reason: 'Torn boxes' },
      ],
      returnDate: '2026-09-25',
      reason: 'Multi-category supplier return',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(multiReturnRes.success, 'Multi-category return executed successfully');
    const multiData = multiReturnRes.data;

    assert(Number(multiData.voucher.total_amount) === 1194.00, `Multi-item voucher total_amount === 1194.00 (got ${multiData.voucher.total_amount})`);
    assert(Number(multiData.journal_entry.total_debit) === 1194.00, `Multi-item total_debit === 1194.00 (got ${multiData.journal_entry.total_debit})`);

    // Verify distinct credits to Cake inventory (1132) and Packaging inventory (1133)
    const cakeInvCredit = multiData.journal_entry.lines.find(l => l.account_id && l.narration.includes('Chocolate Truffle'));
    assert(!!cakeInvCredit, 'Found Cake inventory reversal line');
    assert(Number(cakeInvCredit.credit_amount) === 800.00, `Cake inventory credit === 800.00 (got ${cakeInvCredit.credit_amount})`);

    const pkgInvCredit = multiData.journal_entry.lines.find(l => l.account_id && l.narration.includes('Cake Boxes'));
    assert(!!pkgInvCredit, 'Found Packaging inventory reversal line');
    assert(Number(pkgInvCredit.credit_amount) === 300.00, `Packaging inventory credit === 300.00 (got ${pkgInvCredit.credit_amount})`);

    // Verify both lots were properly decremented
    const cakeLot = (await client.query("SELECT * FROM public.inventory_cost_lot WHERE purchase_item_id = 'pi_multi_cake'")).rows[0];
    assert(Number(cakeLot.remaining_quantity) === 3, `Cake lot remaining quantity reduced to 3 (got ${cakeLot.remaining_quantity})`);

    const pkgLot = (await client.query("SELECT * FROM public.inventory_cost_lot WHERE purchase_item_id = 'pi_multi_pkg'")).rows[0];
    assert(Number(pkgLot.remaining_quantity) === 80, `Packaging lot remaining quantity reduced to 80 (got ${pkgLot.remaining_quantity})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: OUTSTANDING PAYABLE BALANCE & AP SETTLEMENT INTEGRATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/11] Testing AP settlement & outstanding balance reduction after debit notes...');

    // On 'pur_ret_multi_01':
    // Original total: 2100 + 1770 = 3870.00
    // Debit note posted: 1194.00
    // Outstanding balance should now be: 3870 - 1194 = 2676.00
    const balanceInfo = await PurchasePaymentService.getPurchasePayments('pur_ret_multi_01', testBranch.id, client);
    assert(Number(balanceInfo.purchase_total) === 3870.00, `Purchase total === 3870.00 (got ${balanceInfo.purchase_total})`);
    assert(Number(balanceInfo.total_debit_notes) === 1194.00, `Total debit notes === 1194.00 (got ${balanceInfo.total_debit_notes})`);
    assert(Number(balanceInfo.total_paid) === 0, `Total paid === 0 (got ${balanceInfo.total_paid})`);
    assert(Number(balanceInfo.balance_due) === 2676.00, `Balance due === 2676.00 (got ${balanceInfo.balance_due})`);
    assert(!balanceInfo.is_fully_settled, 'Purchase is not yet fully settled');

    // 9.1 Attempting to pay the original 3870.00 must be rejected with PAYMENT_EXCEEDS_OUTSTANDING_BALANCE
    const overpayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_ret_multi_01',
      branchId: testBranch.id,
      payment: { amount: 3870.00, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      paidBy: returnsSupervisorId,
      client,
    });
    assert(!overpayRes.success, 'Paying original purchase total after debit note rejected with PAYMENT_EXCEEDS_OUTSTANDING_BALANCE');
    assert(overpayRes.code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE', `Returns PAYMENT_EXCEEDS_OUTSTANDING_BALANCE (got ${overpayRes.code})`);

    // 9.2 Paying the exact adjusted balance (2676.00) must succeed
    const payExactRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_ret_multi_01',
      branchId: testBranch.id,
      payment: { amount: 2676.00, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      paidBy: returnsSupervisorId,
      client,
    });
    assert(payExactRes.success, 'Payment of adjusted outstanding balance (2676.00) succeeded');

    // 9.3 Verify purchase is now fully settled
    const settledInfo = await PurchasePaymentService.getPurchasePayments('pur_ret_multi_01', testBranch.id, client);
    assert(Number(settledInfo.balance_due) === 0, `Balance due is now 0 (got ${settledInfo.balance_due})`);
    assert(settledInfo.is_fully_settled, 'Purchase is marked fully settled');

    // 9.4 Attempting any further payment is rejected with PURCHASE_ALREADY_SETTLED
    const extraPayRes = await PurchasePaymentService.recordPayment({
      purchaseId: 'pur_ret_multi_01',
      branchId: testBranch.id,
      payment: { amount: 100.00, method: 'BANK_TRANSFER', payment_date: '2026-09-25' },
      paidBy: returnsSupervisorId,
      client,
    });
    assert(!extraPayRes.success, 'Extra payment against settled purchase rejected with PURCHASE_ALREADY_SETTLED');
    assert(extraPayRes.code === 'PURCHASE_ALREADY_SETTLED', `Returns PURCHASE_ALREADY_SETTLED (got ${extraPayRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10: CONCURRENCY, IDEMPOTENCY & FAILURE INJECTION (ATOMICITY)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/11] Testing atomicity, savepoint rollback & failure injection...');

    // Create a purchase to test failure injection
    await createTestPurchase('pur_ret_fail_01', 'POSTED', [{
      id: 'pi_fail_01', item_type: 'ACCESSORY', description: 'Party Hats',
      qty: 10, unit_cost: 50, taxable: 500, gst_rate: 18, cgst_rate: 9, sgst_rate: 9, cgst: 45, sgst: 45, total: 590,
    }]);

    const countVouchersBeforeFail = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const countMovementsBeforeFail = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);

    // Inject an error: pass invalid/future fiscal date or negative quantity within an atomic call
    const failInjectRes = await PurchaseReturnService.processReturn({
      purchaseId: 'pur_ret_fail_01',
      branchId: testBranch.id,
      items: [
        { purchaseItemId: 'pi_fail_01', quantity: 2 },
        { purchaseItemId: 'pi_fail_01', quantity: -10 }, // Invalid quantity will trigger error
      ],
      returnDate: '2026-09-25',
      reason: 'Failure injection test',
      returnedBy: returnsSupervisorId,
      client,
    });
    assert(!failInjectRes.success, 'Return with invalid item quantity fails');

    // Verify atomic rollback via savepoint: zero vouchers or movements created for failed attempt
    const countVouchersAfterFail = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const countMovementsAfterFail = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    assert(countVouchersBeforeFail === countVouchersAfterFail, 'Accounting vouchers unchanged after failed return');
    assert(countMovementsBeforeFail === countMovementsAfterFail, 'Inventory movements unchanged after failed return');

    // Cost lot remaining quantity remains intact (10)
    const lotFail = (await client.query("SELECT * FROM public.inventory_cost_lot WHERE purchase_item_id = 'pi_fail_01'")).rows[0];
    assert(Number(lotFail.remaining_quantity) === 10, `Cost lot remaining_quantity preserved intact at 10 (got ${lotFail.remaining_quantity})`);

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
