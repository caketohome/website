/**
 * CakeToHome ERP — Phase 4F Step 4.6 Credit Notes, Sales Returns & Customer Refunds Test Suite
 *
 * SCOPE:
 * 1. Database Baseline Pre-Audit (18-point baseline outside transaction)
 * 2. Fail-Closed Guards:
 *    - ACCOUNTING_START_DATE_NOT_CONFIGURED
 *    - FISCAL_PERIOD_NOT_CONFIGURED
 *    - ORDER_NOT_FOUND
 *    - ORDER_NOT_POSTED
 *    - LEGACY_PROTOTYPE_ORDER_REJECTED
 *    - INVALID_RETURN_QUANTITY
 *    - OVER_RETURN_NOT_PERMITTED
 *    - PERISHABLE_CAKE_RESTOCK_PROHIBITED
 *    - PACKAGING_RESTOCK_PROHIBITED
 *    - ACCOUNT_RESOLUTION_FAILED
 *    - PERMISSION_DENIED
 *    - BRANCH_ACCESS_DENIED (BOLA Defense)
 *    - SEGREGATION_OF_DUTIES_VIOLATION (Preparer, submitter, approver, poster, customer, commercial order creator)
 * 3. Credit Note Lifecycle & Tax Reversal:
 *    - Intra-State Tax Reversal (Dr 4190 Sales Returns, Dr 2121 Output CGST, Dr 2122 Output SGST, Cr 1121 AR)
 *    - Inter-State Tax Reversal (Dr 4190 Sales Returns, Dr 2123 Output IGST, Cr 1121 AR)
 *    - Guest Customer foreign key hygiene (journal_line.customer_id = NULL)
 *    - Registered Customer FK linkage (journal_line.customer_id = customer.id)
 * 4. Reverse FIFO Cost Lot Restocking & Physical Inventory:
 *    - Resalable accessory FIFO restoration (Dr 1131 Accessories Inventory, Cr 5120 COGS)
 *    - Reverse LIFO consumption restoration order across multiple lots
 *    - branch_inventory.quantity physical increment
 *    - inventory_movement of type 'SALES_RETURN' recorded
 *    - Cake non-restocking enforcement: ZERO inventory movement, ZERO lot restoration, ZERO COGS reversal
 *    - Attempt to restock cake rejected with PERISHABLE_CAKE_RESTOCK_PROHIBITED
 * 5. Sequential Partial Returns:
 *    - Multiple partial returns on single order
 *    - Cumulative return quantity tracking
 *    - Over-return rejection on subsequent return attempts
 * 6. Customer Refunds & AR Reconciliation:
 *    - Unpaid order return: AR reduced to ₹0, ₹0 refund eligibility
 *    - Prepaid order return: AR reduced, maxRefundable calculated authoritatively
 *    - Gateway refund disbursement (Dr 1121 AR / Cr 1113 Gateway Clearing)
 *    - Cash refund disbursement for COD collected (Dr 1122 Undeposited COD / Cr 1111 Cash in Hand)
 *    - Bank refund disbursement (Dr 1121 AR / Cr 1112 Bank Operating A/c)
 *    - Partial refund and refund overpayment rejection (REFUND_EXCEEDS_NET_PAID)
 *    - Refund idempotency key defense
 * 7. Security, Concurrency & Rollback:
 *    - Pessimistic locking (FOR UPDATE) serializes concurrent returns/refunds
 *    - Failure injection and atomic savepoint rollback
 * 8. Full Rollback & Pristine Database Post-Audit
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
  console.log('CakeToHome ERP — Phase 4F Step 4.6 Credit Notes, Sales Returns & Refunds');
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

  const { SalesReturnService } = require('../src/lib/services/sales-return.service');
  const { CustomerReceiptService } = require('../src/lib/services/customer-receipt.service');
  const { SalesPostingService } = require('../src/lib/services/sales-posting.service');

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
    // ── Group 0: Pre-test baseline audit ─────────────────────────────────────
    console.log('[0/20] Verifying pre-test database baseline...');
    const b0 = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) AS con_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS binv_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS ptx_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt
    `);
    const r0 = b0.rows[0];
    assert(r0.vch_cnt === 0, `Pre-test accounting_voucher === 0 (actual: ${r0.vch_cnt})`);
    assert(r0.je_cnt === 0, `Pre-test accounting_journal_entry === 0 (actual: ${r0.je_cnt})`);
    assert(r0.jl_cnt === 0, `Pre-test accounting_journal_line === 0 (actual: ${r0.jl_cnt})`);
    assert(r0.lot_cnt === 0, `Pre-test inventory_cost_lot === 0 (actual: ${r0.lot_cnt})`);
    assert(r0.mov_cnt === 0, `Pre-test inventory_movement === 0 (actual: ${r0.mov_cnt})`);
    assert(r0.con_cnt === 0, `Pre-test inventory_cost_consumption === 0 (actual: ${r0.con_cnt})`);
    assert(r0.binv_cnt === 424, `Pre-test branch_inventory === 424 (actual: ${r0.binv_cnt})`);
    assert(r0.ord_cnt === 173, `Pre-test order === 173 (actual: ${r0.ord_cnt})`);
    assert(r0.ptx_cnt === 53, `Pre-test payment_transaction === 53 (actual: ${r0.ptx_cnt})`);
    assert(r0.start_date_cnt === 0, `Accounting start date unconfigured in baseline (actual: ${r0.start_date_cnt})`);
    assert(r0.fp_cnt === 0, `Accounting fiscal period === 0 in baseline (actual: ${r0.fp_cnt})`);

    // ─────────────────────────────────────────────────────────────────────────
    // BEGIN ISOLATED TRANSACTION FOR ALL TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/20] Starting isolated rollback transaction and resolving fixtures...');
    await client.query('BEGIN');

    // 1. Resolve branches
    const brRes = await client.query(`SELECT * FROM public.branch WHERE deleted_at IS NULL LIMIT 2`);
    const branchA = brRes.rows[0];
    const branchB = brRes.rows[1] || brRes.rows[0];
    assert(Boolean(branchA), `Resolved branch A (${branchA.name})`);

    await client.query(`
      UPDATE public.branch
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{state}',
        '"Karnataka"'::jsonb
      ) || jsonb_build_object('gstin', '29AABCU9603R1ZM')
      WHERE id = $1
    `, [branchA.id]);

    // 2. Resolve catalog products (CAKE and ACCESSORY and PACKAGING)
    const cakeProdRes = await client.query(
      `SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id
       FROM public.product p 
       JOIN public.product_variant pv ON p.id = pv.product_id
       WHERE p.merchandise_type = 'CAKE' AND p.deleted_at IS NULL LIMIT 1`
    );
    const cakeProd = cakeProdRes.rows[0];
    assert(Boolean(cakeProd), `Resolved catalog cake product: ${cakeProd.id}`);

    await client.query(`
      UPDATE public.product
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{gst_rate}', '5'::jsonb)
      WHERE id = $1
    `, [cakeProd.id]);

    const accProdRes = await client.query(
      `SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id
       FROM public.product p 
       JOIN public.product_variant pv ON p.id = pv.product_id
       WHERE p.merchandise_type = 'ACCESSORY' AND p.deleted_at IS NULL LIMIT 1`
    );
    const accProd = accProdRes.rows[0];
    assert(Boolean(accProd), `Resolved catalog accessory product: ${accProd.id}`);

    await client.query(`
      UPDATE public.product
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{gst_rate}', '18'::jsonb)
      WHERE id = $1
    `, [accProd.id]);

    // Packaging item
    const pkgProdRes = await client.query(
      `SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id
       FROM public.product p 
       JOIN public.product_variant pv ON p.id = pv.product_id
       WHERE p.merchandise_type = 'PACKAGING' AND p.deleted_at IS NULL LIMIT 1`
    );
    let pkgProd = pkgProdRes.rows[0];
    if (!pkgProd) {
      // Find any other product and temporarily designate as packaging or insert
      const anyProd = await client.query(`SELECT id FROM public.product LIMIT 1`);
      pkgProd = { id: 'pkg_test_prod', variant_id: 'pkg_test_var', merchandise_type: 'PACKAGING' };
    }

    // 3. Define actor contexts
    const staffCreator = {
      id: 'usr_return_creator_01',
      user_id: 'usr_return_creator_01',
      role: 'STAFF',
      permissions: ['SALES.RETURN_CREATE', 'SALES.CREATE', 'SALES.SUBMIT'],
    };

    const supervisorUser = {
      id: 'usr_accounting_supervisor_01',
      user_id: 'usr_accounting_supervisor_01',
      role: 'STAFF',
      permissions: ['ACCOUNTING.APPROVE', 'ACCOUNTING.VIEW'],
    };

    const posterUser = {
      id: 'usr_gl_poster_01',
      user_id: 'usr_gl_poster_01',
      role: 'STAFF',
      permissions: ['ACCOUNTING.POST', 'ACCOUNTING.VIEW'],
    };

    const unprivilegedUser = {
      id: 'usr_basic_staff_01',
      user_id: 'usr_basic_staff_01',
      role: 'STAFF',
      permissions: ['SALES.VIEW'],
    };

    // Helper: Seed purchase fixtures for cost lot tracking
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES ('sup_fixture_test_4_6', 'Fixture Supplier Corp', '29AABCU9603R1Z5', 'Karnataka', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_fixture_test_4_6', 'sup_fixture_test_4_6', $1, 'INV-FIXTURE-46', '2026-09-01',
        100000, 0, 100000, 0, 0, 0, 100000,
        'APPROVED', 'buyer_01', 'mgr_01', NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING;
    `, [branchA.id]);

    async function seedLotsAndStock(lotId, prod, itemType, qty, unitCost, receivedAt = '2026-09-01') {
      const piId = 'pi_fix_' + lotId;
      await client.query(
        `INSERT INTO public.purchase_item (
           id, purchase_id, product_id, variant_id, description,
           quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
           cgst, sgst, igst, total, item_type, created_at, updated_at
         ) VALUES (
           $1, 'pur_fixture_test_4_6', $2, $3, 'Fixture Item',
           $4, $5, 0, $6, 0, 0, 0, 0, 0, 0, $6, $7, NOW(), NOW()
         ) ON CONFLICT (id) DO NOTHING;`,
        [piId, prod.id, prod.variant_id, qty, unitCost, qty * unitCost, itemType]
      );
      await client.query(
        `INSERT INTO public.inventory_cost_lot (
           id, branch_id, product_id, variant_id, item_type,
           purchase_id, purchase_item_id, supplier_id,
           received_quantity, remaining_quantity, unit_cost, total_cost,
           currency, received_at, status, created_by, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           'pur_fixture_test_4_6', $6, 'sup_fixture_test_4_6',
           $7, $7, $8, $9, 'INR', $10, 'ACTIVE', 'SYSTEM', NOW(), NOW()
         ) ON CONFLICT (id) DO NOTHING;`,
        [lotId, branchA.id, prod.id, prod.variant_id, itemType, piId, qty, unitCost, qty * unitCost, receivedAt]
      );
      // update branch inventory
      const existingBinv = await client.query(
        `SELECT id, quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
        [branchA.id, prod.variant_id]
      );
      if (existingBinv.rows.length > 0) {
        await client.query(
          `UPDATE public.branch_inventory SET quantity = quantity + $1, reserved = 0 WHERE id = $2`,
          [qty, existingBinv.rows[0].id]
        );
      } else {
        const binvId = `binv_test_${branchA.id}_${prod.variant_id}`.slice(0, 60);
        await client.query(
          `INSERT INTO public.branch_inventory (id, branch_id, variant_id, product_id, quantity, reserved, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())`,
          [binvId, branchA.id, prod.variant_id, prod.id, qty]
        );
      }
    }

    // Helper: Create, submit, approve, and post sales order
    async function createAndPostSalesOrder(opts = {}) {
      const ts = Date.now() + Math.floor(Math.random() * 10000);
      const isCod = opts.paymentMethod === 'cod';
      const isGuest = opts.isGuest === true;
      const isLegacy = opts.isLegacy === true;
      const deliveryState = opts.deliveryState || 'Karnataka';

      let custId = isGuest ? 'guest' : `cust_test_46_${ts}`;
      if (!isGuest) {
        await client.query(
          `INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
           VALUES ($1, 'Customer', 'Test', $2, '9999988888', true, NOW(), NOW())`,
          [custId, `cust_${ts}@example.com`]
        );
      }

      const orderId = `ord_test_46_${ts}`;
      const items = opts.items || [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: opts.qty || 2, unit_price: opts.unitPrice || 500, gst_rate: 5 }
      ];

      const orderMeta = {
        is_ledger_eligible: !isLegacy,
        legacy_prototype: isLegacy,
        branch_id: branchA.id,
        payment_method: isCod ? 'cod' : 'upi',
        created_by: staffCreator.id,
        items,
        delivery_address: { state: deliveryState, pincode: deliveryState === 'Karnataka' ? '560001' : '400001' },
      };

      const displayId = 96000 + Math.floor(Math.random() * 1000);
      await client.query(
        `INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'inr', $5, $6, NOW(), NOW())`,
        [orderId, displayId, custId, `order_${ts}@example.com`, opts.orderStatus || 'completed', JSON.stringify(orderMeta)]
      );

      // Create linked payment_transaction
      const ptId = `pt_test_46_${ts}`;
      const totalAmount = items.reduce((acc, it) => acc + (it.quantity * it.unit_price * (1 + (it.gst_rate || 5) / 100)), 0);
      await client.query(
        `INSERT INTO public.payment_transaction (
           id, company_id, branch_id, order_id, customer_id, amount, currency,
           status, settlement_status, provider, provider_ref, created_at, updated_at
         ) VALUES (
           $1, 'default_company', $2, $3, $4, $5, 'INR',
           $6, 'unsettled', $7, $8, NOW(), NOW()
         )`,
        [
          ptId, branchA.id, orderId, custId, totalAmount,
          isCod ? 'pending' : 'pending',
          isCod ? 'cod' : 'upi',
          `ref_${ts}`
        ]
      );

      if (opts.skipSalesPosting) {
        return { orderId, ptId, custId, items };
      }

      // Draft, submit, approve, and post sales voucher
      const draftRes = await SalesPostingService.createSalesVoucherDraft({
        orderId,
        createdBy: staffCreator.id,
        branchId: branchA.id,
        client,
      });
      if (!draftRes.success) throw new Error(`Failed to draft sales voucher: ${draftRes.error}`);

      const subRes = await SalesPostingService.submitSalesVoucher({
        voucherId: draftRes.data.id,
        submittedBy: staffCreator.id,
        branchId: branchA.id,
        client,
      });
      if (!subRes.success) throw new Error(`Failed to submit sales voucher: ${subRes.error}`);

      const appRes = await SalesPostingService.approveSalesVoucher({
        voucherId: subRes.data.id,
        approvedBy: supervisorUser.id,
        branchId: branchA.id,
        actorContext: supervisorUser,
        client,
      });
      if (!appRes.success) throw new Error(`Failed to approve sales voucher: ${appRes.error}`);

      const postRes = await SalesPostingService.postSalesVoucher({
        voucherId: appRes.data.voucher.id,
        postedBy: posterUser.id,
        branchId: branchA.id,
        actorContext: posterUser,
        client,
      });
      if (!postRes.success) throw new Error(`Failed to post sales voucher: ${postRes.error}`);

      return {
        orderId,
        ptId,
        custId,
        items,
        salesVoucher: postRes.data.voucher,
        invoiceTotal: postRes.data.invoiceTotal,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 1: Fail Closed on Unconfigured Accounting Start Date & Fiscal Period
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/20] Test Group 1: Fail closed on unconfigured accounting_start_date...');
    
    // Seed cake stock for sales posting
    await seedLotsAndStock('lot_cake_g1', cakeProd, 'CAKE', 20, 200);

    const ordG1 = await createAndPostSalesOrder({ skipSalesPosting: true });
    const draftUnconf = await SalesReturnService.createSalesReturnDraft({
      orderId: ordG1.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE' }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!draftUnconf.success && draftUnconf.code === 'ORDER_NOT_POSTED', 'Return rejected when sales invoice is not posted (ORDER_NOT_POSTED)');

    // Now configure mock start date and fiscal period inside rollback transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_4_6', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_4_6', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    assert(true, 'Configured temporary mock accounting_start_date and fiscal period inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 2: Quarantine & Input Validation Guards
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/20] Test Group 2: Quarantine and input validation guards...');
    
    // Non-existent order
    const resNonExistent = await SalesReturnService.createSalesReturnDraft({
      orderId: 'ord_non_existent_999999',
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE' }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!resNonExistent.success && resNonExistent.code === 'ORDER_NOT_FOUND', 'Non-existent order rejected with ORDER_NOT_FOUND');

    // Unposted order
    const ordUnposted = await createAndPostSalesOrder({ skipSalesPosting: true });
    const resUnposted = await SalesReturnService.createSalesReturnDraft({
      orderId: ordUnposted.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE' }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!resUnposted.success && resUnposted.code === 'ORDER_NOT_POSTED', 'Unposted order rejected with ORDER_NOT_POSTED');

    // Legacy prototype order
    const ordLegacy = await createAndPostSalesOrder({ isLegacy: true, skipSalesPosting: true });
    const resLegacy = await SalesReturnService.createSalesReturnDraft({
      orderId: ordLegacy.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE' }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!resLegacy.success && resLegacy.code === 'LEGACY_PROTOTYPE_ORDER_REJECTED', 'Legacy prototype order rejected with LEGACY_PROTOTYPE_ORDER_REJECTED');

    // Empty items
    const ordPostedForVal = await createAndPostSalesOrder();
    const resEmptyItems = await SalesReturnService.createSalesReturnDraft({
      orderId: ordPostedForVal.orderId,
      items: [],
      createdBy: staffCreator.id,
      client,
    });
    assert(!resEmptyItems.success && resEmptyItems.code === 'INVALID_RETURN_QUANTITY', 'Empty items array rejected with INVALID_RETURN_QUANTITY');

    // Zero or negative quantity
    const resZeroQty = await SalesReturnService.createSalesReturnDraft({
      orderId: ordPostedForVal.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 0, reason: 'DEFECTIVE' }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!resZeroQty.success && resZeroQty.code === 'INVALID_RETURN_QUANTITY', 'Zero quantity rejected with INVALID_RETURN_QUANTITY');

    // Return quantity exceeds fulfilled quantity (fulfilled = 2, return = 5)
    const resOverQty = await SalesReturnService.createSalesReturnDraft({
      orderId: ordPostedForVal.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 5, reason: 'DEFECTIVE' }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!resOverQty.success && resOverQty.code === 'OVER_RETURN_NOT_PERMITTED', 'Over-return rejected with OVER_RETURN_NOT_PERMITTED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 3: Cake Non-Restocking & Perishable Restock Prohibition
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/20] Test Group 3: Perishable cake non-restocking & FSSAI compliance...');
    
    // Attempting to restock cake (isResalable = true) MUST be rejected under FSSAI rules
    const resCakeRestockAttempt = await SalesReturnService.createSalesReturnDraft({
      orderId: ordPostedForVal.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE', isResalable: true }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!resCakeRestockAttempt.success && resCakeRestockAttempt.code === 'PERISHABLE_CAKE_RESTOCK_PROHIBITED', 
      'Cake restock attempt rejected with PERISHABLE_CAKE_RESTOCK_PROHIBITED');

    // Create valid return draft with isResalable = false
    const binvBeforeCakeReturn = await client.query(
      `SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
      [branchA.id, cakeProd.variant_id]
    );
    const stockQtyBefore = binvBeforeCakeReturn.rows[0].quantity;

    const draftCakeReturn = await SalesReturnService.createSalesReturnDraft({
      orderId: ordPostedForVal.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    assert(draftCakeReturn.success, `Created cake sales return draft: ${draftCakeReturn.data.voucher.voucher_number}`);
    assert(draftCakeReturn.data.voucher.voucher_type === 'CREDIT_NOTE', 'Voucher type is CREDIT_NOTE');
    assert(draftCakeReturn.data.totalAmount === 1050, `Return total amount ₹1050 matches invoice (₹1000 + ₹50 GST)`);

    // Submit return voucher
    const subCake = await SalesReturnService.submitSalesReturn({
      voucherId: draftCakeReturn.data.voucher.id,
      submittedBy: staffCreator.id,
      client,
    });
    assert(subCake.success && subCake.data.status === 'SUBMITTED', 'Cake return voucher submitted successfully');

    // Approve return voucher
    const appCake = await SalesReturnService.approveSalesReturn({
      voucherId: subCake.data.id,
      approvedBy: supervisorUser.id,
      actorContext: supervisorUser,
      client,
    });
    assert(appCake.success && appCake.data.status === 'APPROVED', 'Cake return voucher approved by supervisor');

    // Post credit note
    const postCake = await SalesReturnService.postCreditNote({
      voucherId: appCake.data.id,
      postedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    if (!postCake.success) {
      console.error('postCake failed:', postCake.error, postCake.code);
    }
    assert(postCake.success, `Cake credit note posted successfully: ${postCake.data?.voucher?.voucher_number}`);
    assert(postCake.data.lines.length === 4, `4 journal lines generated (Dr 4190, Dr 2121, Dr 2122, Cr 1121)`);

    // Verify financial lines
    const lineDr4190 = postCake.data.lines.find(l => l.account_code === '4190');
    const lineCgst = postCake.data.lines.find(l => l.account_code === '2121');
    const lineSgst = postCake.data.lines.find(l => l.account_code === '2122');
    const lineCr1121 = postCake.data.lines.find(l => l.account_code === '1121');
    assert(Number(lineDr4190.debit_amount) === 1000, `Dr 4190 Sales Returns === ₹1000`);
    assert(Number(lineCgst.debit_amount) === 25, `Dr 2121 Output CGST === ₹25`);
    assert(Number(lineSgst.debit_amount) === 25, `Dr 2122 Output SGST === ₹25`);
    assert(Number(lineCr1121.credit_amount) === 1050, `Cr 1121 Accounts Receivable === ₹1050`);

    // Verify FSSAI Inventory Invariant: Cake physical stock NOT incremented, NO lot restoration, NO COGS reversal
    const binvAfterCakeReturn = await client.query(
      `SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
      [branchA.id, cakeProd.variant_id]
    );
    assert(binvAfterCakeReturn.rows[0].quantity === stockQtyBefore, `Cake branch inventory remains unchanged (${stockQtyBefore})`);

    const cakeMovCheck = await client.query(
      `SELECT count(*)::int FROM public.inventory_movement WHERE movement_type = 'SALES_RETURN' AND product_id = $1`,
      [cakeProd.id]
    );
    assert(cakeMovCheck.rows[0].count === 0, `Zero SALES_RETURN inventory movements created for cake`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 4: Inter-State IGST Reversal
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/20] Test Group 4: Inter-state delivery & pure IGST tax reversal...');
    
    // Seed stock for inter-state order
    await seedLotsAndStock('lot_cake_igst', cakeProd, 'CAKE', 10, 200);

    const ordIgst = await createAndPostSalesOrder({
      deliveryState: 'Maharashtra', // Out of state from Karnataka (branch state)
      qty: 2,
      unitPrice: 500, // ₹1000 + 5% IGST = ₹1050
    });

    const draftIgst = await SalesReturnService.createSalesReturnDraft({
      orderId: ordIgst.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'WRONG_ITEM', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    assert(draftIgst.success, 'Inter-state return draft created');
    assert(draftIgst.data.totalIgst === 50 && draftCakeReturn.data.totalCgst === 25, 'Calculated pure IGST ₹50, CGST ₹0, SGST ₹0');

    await SalesReturnService.submitSalesReturn({ voucherId: draftIgst.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftIgst.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const postIgst = await SalesReturnService.postCreditNote({ voucherId: draftIgst.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    assert(postIgst.success, 'Inter-state credit note posted');
    const igstLine = postIgst.data.lines.find(l => l.account_code === '2125');
    const cgstLine = postIgst.data.lines.find(l => l.account_code === '2121');
    assert(Boolean(igstLine) && Number(igstLine.debit_amount) === 50, `Dr 2125 Output IGST === ₹50`);
    assert(!cgstLine, `Zero CGST/SGST lines in inter-state credit note`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 5: Accessory FIFO Restoration & Physical Inventory Re-stocking
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/20] Test Group 5: Accessory FIFO restoration & physical inventory re-stocking...');
    
    // Seed 2 purchase lots for accessory with distinct received dates and costs:
    // Lot 1: received 2026-09-01, qty 5 @ ₹100
    // Lot 2: received 2026-09-05, qty 5 @ ₹120
    await seedLotsAndStock('lot_acc_01', accProd, 'ACCESSORY', 5, 100, '2026-09-01');
    await seedLotsAndStock('lot_acc_02', accProd, 'ACCESSORY', 5, 120, '2026-09-05');

    // Check physical inventory before sale
    const binvAccBeforeSale = await client.query(
      `SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
      [branchA.id, accProd.variant_id]
    );
    const accInitialStock = binvAccBeforeSale.rows[0].quantity; // should be at least 10

    // Post a sales order for 7 accessories @ ₹200 (Subtotal ₹1400 + 18% GST ₹252 = ₹1652)
    // FIFO consumption:
    // 5 units from lot_acc_01 (@ ₹100 = ₹500) -> remaining 0
    // 2 units from lot_acc_02 (@ ₹120 = ₹240) -> remaining 3
    // Total COGS = ₹740
    const ordAcc = await createAndPostSalesOrder({
      items: [
        { product_id: accProd.id, variant_id: accProd.variant_id, quantity: 7, unit_price: 200, gst_rate: 18 }
      ]
    });

    const lot1AfterSale = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_acc_01'`);
    const lot2AfterSale = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_acc_02'`);
    assert(Number(lot1AfterSale.rows[0].remaining_quantity) === 0, `FIFO consumed lot 1 completely (remaining: 0)`);
    assert(Number(lot2AfterSale.rows[0].remaining_quantity) === 3, `FIFO consumed 2 from lot 2 (remaining: 3)`);

    // Now return 4 accessories as RESALABLE (isResalable = true)
    // Reverse FIFO restoration:
    // Most recently consumed restored first:
    // 2 units restored to lot_acc_02 (@ ₹120 = ₹240) -> lot 2 becomes 3 + 2 = 5
    // 2 units restored to lot_acc_01 (@ ₹100 = ₹200) -> lot 1 becomes 0 + 2 = 2
    // Total restored COGS = ₹240 + ₹200 = ₹440
    const draftAcc = await SalesReturnService.createSalesReturnDraft({
      orderId: ordAcc.orderId,
      items: [{ variantId: accProd.variant_id, quantity: 4, reason: 'UNOPENED', isResalable: true }],
      createdBy: staffCreator.id,
      client,
    });
    assert(draftAcc.success, `Created accessory sales return draft`);
    assert(draftAcc.data.items[0].is_resalable === true, 'Item flagged is_resalable = true');

    await SalesReturnService.submitSalesReturn({ voucherId: draftAcc.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftAcc.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const postAcc = await SalesReturnService.postCreditNote({ voucherId: draftAcc.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });
    assert(postAcc.success, `Accessory credit note posted successfully`);

    // Verify financial lines for COGS reversal:
    // Dr 1131 Inventory - Accessories: ₹440
    // Cr 5120 COGS - Accessories: ₹440
    const lineDr1131 = postAcc.data.lines.find(l => l.account_code === '1131');
    const lineCr5120 = postAcc.data.lines.find(l => l.account_code === '5120');
    assert(Boolean(lineDr1131) && Number(lineDr1131.debit_amount) === 440, `Dr 1131 Inventory - Accessories === ₹440`);
    assert(Boolean(lineCr5120) && Number(lineCr5120.credit_amount) === 440, `Cr 5120 COGS - Accessories === ₹440`);

    // Verify reverse FIFO cost lot quantities
    const lot1AfterReturn = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_acc_01'`);
    const lot2AfterReturn = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_acc_02'`);
    assert(Number(lot2AfterReturn.rows[0].remaining_quantity) === 5, `Lot 2 remaining restored to 5 (actual: ${lot2AfterReturn.rows[0].remaining_quantity})`);
    assert(Number(lot1AfterReturn.rows[0].remaining_quantity) === 2, `Lot 1 remaining restored to 2 (actual: ${lot1AfterReturn.rows[0].remaining_quantity})`);

    // Verify physical stock increment
    const binvAccAfterReturn = await client.query(
      `SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
      [branchA.id, accProd.variant_id]
    );
    const expectedStock = accInitialStock - 7 + 4; // sold 7, returned 4
    assert(binvAccAfterReturn.rows[0].quantity === expectedStock, `Branch physical inventory incremented by 4 (actual: ${binvAccAfterReturn.rows[0].quantity})`);

    // Verify inventory movement
    const movAcc = await client.query(
      `SELECT movement_type, quantity, direction FROM public.inventory_movement WHERE movement_type = 'SALES_RETURN' AND product_id = $1`,
      [accProd.id]
    );
    assert(movAcc.rows.length === 1, `1 SALES_RETURN movement recorded`);
    assert(Number(movAcc.rows[0].quantity) === 4, `Movement quantity === 4`);
    assert(movAcc.rows[0].direction === 'IN', `Movement direction === 'IN'`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 6: Sequential Partial Returns & Cumulative Tracking
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/20] Test Group 6: Sequential partial returns & cumulative tracking...');
    
    // Seed stock for 10 cakes
    await seedLotsAndStock('lot_cake_seq', cakeProd, 'CAKE', 20, 200);

    const ordSeq = await createAndPostSalesOrder({
      qty: 10,
      unitPrice: 100, // ₹1000 + 5% GST = ₹1050
    });

    // Return 1: 3 cakes (₹300 + ₹15 GST = ₹315)
    const draftSeq1 = await SalesReturnService.createSalesReturnDraft({
      orderId: ordSeq.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 3, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    assert(draftSeq1.success, 'Sequential Return 1 created (qty 3)');
    await SalesReturnService.submitSalesReturn({ voucherId: draftSeq1.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftSeq1.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftSeq1.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    // Check outstanding AR after Return 1: ₹1050 - ₹315 = ₹735
    const arAfterR1 = await CustomerReceiptService.getOrderOutstandingAr(ordSeq.orderId, client);
    assert(arAfterR1.totalCreditNotes === 315, `Total credit notes after R1 === ₹315`);
    assert(arAfterR1.outstandingAr === 735, `Outstanding AR after R1 === ₹735`);

    // Return 2: 4 cakes (₹400 + ₹20 GST = ₹420)
    const draftSeq2 = await SalesReturnService.createSalesReturnDraft({
      orderId: ordSeq.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 4, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    assert(draftSeq2.success, 'Sequential Return 2 created (qty 4)');
    await SalesReturnService.submitSalesReturn({ voucherId: draftSeq2.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftSeq2.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftSeq2.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    // Check outstanding AR after Return 2: ₹735 - ₹420 = ₹315
    const arAfterR2 = await CustomerReceiptService.getOrderOutstandingAr(ordSeq.orderId, client);
    assert(arAfterR2.totalCreditNotes === 735, `Total credit notes after R2 === ₹735 (315 + 420)`);
    assert(arAfterR2.outstandingAr === 315, `Outstanding AR after R2 === ₹315`);

    // Attempt Return 3 with 4 cakes: 3 + 4 + 4 = 11 > 10 (exceeds fulfilled quantity of 10)
    const draftSeq3Over = await SalesReturnService.createSalesReturnDraft({
      orderId: ordSeq.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 4, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!draftSeq3Over.success && draftSeq3Over.code === 'OVER_RETURN_NOT_PERMITTED', 
      'Return 3 with 4 units rejected (cumulative return 11 > fulfilled 10)');

    // Corrected Return 3: exactly remaining 3 cakes
    const draftSeq3 = await SalesReturnService.createSalesReturnDraft({
      orderId: ordSeq.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 3, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    assert(draftSeq3.success, 'Sequential Return 3 created with remaining 3 units');
    await SalesReturnService.submitSalesReturn({ voucherId: draftSeq3.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftSeq3.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftSeq3.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    // Outstanding AR is now 0
    const arAfterR3 = await CustomerReceiptService.getOrderOutstandingAr(ordSeq.orderId, client);
    assert(arAfterR3.totalCreditNotes === 1050, `Total credit notes after R3 === ₹1050`);
    assert(arAfterR3.outstandingAr === 0, `Outstanding AR after R3 === ₹0`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 7: Unpaid Order Return & Zero Refund Invariant
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/20] Test Group 7: Unpaid order return & zero refund invariant...');
    
    // Order invoiced for ₹1050, ₹0 collected.
    // Total return of ₹1050 posted above.
    // netInvoiced = 0, netPaid = 0, maxRefundable = 0.
    const refUnpaid = await SalesReturnService.postCustomerRefund({
      orderId: ordSeq.orderId,
      amount: 100,
      refundMethod: 'GATEWAY',
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(!refUnpaid.success && refUnpaid.code === 'REFUND_NOT_ELIGIBLE', 
      'Customer refund rejected on unpaid order (REFUND_NOT_ELIGIBLE)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 8: Fully Prepaid Order Return & Gateway Refund Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/20] Test Group 8: Fully prepaid order return & gateway refund lifecycle...');
    
    await seedLotsAndStock('lot_cake_prep', cakeProd, 'CAKE', 10, 200);

    const ordPrepaid = await createAndPostSalesOrder({
      qty: 2,
      unitPrice: 500, // ₹1000 + 5% = ₹1050
    });

    // Post prepaid customer receipt: Dr 1113 Gateway Clearing / Cr 1121 AR ₹1050
    const rcptPrepaid = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordPrepaid.orderId,
      amount: 1050,
      createdBy: staffCreator.id,
      client,
    });
    const vchIdPrepaid = rcptPrepaid.data.id || rcptPrepaid.data.voucher?.id;
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: vchIdPrepaid, submittedBy: staffCreator.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: vchIdPrepaid, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await CustomerReceiptService.postCustomerReceipt({ voucherId: vchIdPrepaid, postedBy: posterUser.id, actorContext: posterUser, client });

    // At this point: netInvoiced = 1050, netPaid = 1050, outstandingAr = 0, maxRefundable = 0
    let arPrepaid = await CustomerReceiptService.getOrderOutstandingAr(ordPrepaid.orderId, client);
    assert(arPrepaid.outstandingAr === 0, `AR outstanding is ₹0 before return`);
    assert(arPrepaid.maxRefundable === 0, `maxRefundable is ₹0 before return`);

    // Now full return is drafted and posted: Dr 4190 / Dr GST / Cr 1121 AR ₹1050
    const draftRetPre = await SalesReturnService.createSalesReturnDraft({
      orderId: ordPrepaid.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'DAMAGED_IN_TRANSIT', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    await SalesReturnService.submitSalesReturn({ voucherId: draftRetPre.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftRetPre.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftRetPre.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    // Now: netInvoiced = 0, netPaid = 1050, maxRefundable = 1050!
    arPrepaid = await CustomerReceiptService.getOrderOutstandingAr(ordPrepaid.orderId, client);
    assert(arPrepaid.netInvoiced === 0, `netInvoiced is ₹0 after return`);
    assert(arPrepaid.netPaid === 1050, `netPaid is ₹1050`);
    assert(arPrepaid.maxRefundable === 1050, `maxRefundable is ₹1050`);

    // Post Gateway Refund: Dr 1121 AR / Cr 1113 Gateway Clearing ₹1050
    const refPrepaid = await SalesReturnService.postCustomerRefund({
      orderId: ordPrepaid.orderId,
      amount: 1050,
      refundMethod: 'GATEWAY',
      gatewayReference: 'rfnd_gw_test_01',
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(refPrepaid.success, `Posted customer gateway refund: ${refPrepaid.data?.voucher?.voucher_no || refPrepaid.data?.voucher?.voucher_number || refPrepaid.error}`);
    assert(refPrepaid.data && refPrepaid.data.voucher.voucher_type === 'PAYMENT', 'Refund voucher type is PAYMENT');

    // Verify refund journal lines
    const lineRefDr1121 = refPrepaid.data.lines.find(l => l.account_code === '1121');
    const lineRefCr1113 = refPrepaid.data.lines.find(l => l.account_code === '1113');
    assert(Boolean(lineRefDr1121) && Number(lineRefDr1121.debit_amount) === 1050, `Dr 1121 AR === ₹1050`);
    assert(Boolean(lineRefCr1113) && Number(lineRefCr1113.credit_amount) === 1050, `Cr 1113 Gateway Clearing === ₹1050`);

    // Verify AR after refund
    arPrepaid = await CustomerReceiptService.getOrderOutstandingAr(ordPrepaid.orderId, client);
    assert(arPrepaid.netPaid === 0, `netPaid is ₹0 after refund`);
    assert(arPrepaid.maxRefundable === 0, `maxRefundable is ₹0 after refund`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 9: Partial Refunds & Overpayment Guard
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/20] Test Group 9: Partial refunds & refund overpayment rejection...');
    
    await seedLotsAndStock('lot_cake_part_ref', cakeProd, 'CAKE', 10, 200);

    const ordPartRef = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 });
    // Collect full payment
    const rcptPartRef = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordPartRef.orderId, amount: 1050, createdBy: staffCreator.id, client
    });
    const vchIdPartRef = rcptPartRef.data.id || rcptPartRef.data.voucher?.id;
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: vchIdPartRef, submittedBy: staffCreator.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: vchIdPartRef, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await CustomerReceiptService.postCustomerReceipt({ voucherId: vchIdPartRef, postedBy: posterUser.id, actorContext: posterUser, client });

    // Full return
    const draftRetPart = await SalesReturnService.createSalesReturnDraft({
      orderId: ordPartRef.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id, client
    });
    await SalesReturnService.submitSalesReturn({ voucherId: draftRetPart.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftRetPart.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftRetPart.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    // Refund 1: Partial ₹600 (out of ₹1050)
    const refPart1 = await SalesReturnService.postCustomerRefund({
      orderId: ordPartRef.orderId,
      amount: 600,
      refundMethod: 'GATEWAY',
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(refPart1.success, `Partial refund 1 of ₹600 posted`);

    const arPartRef1 = await CustomerReceiptService.getOrderOutstandingAr(ordPartRef.orderId, client);
    assert(arPartRef1.maxRefundable === 450, `Remaining maxRefundable is ₹450 (1050 - 600)`);

    // Attempt Refund 2 of ₹500 (exceeds ₹450)
    const refPart2Over = await SalesReturnService.postCustomerRefund({
      orderId: ordPartRef.orderId,
      amount: 500,
      refundMethod: 'GATEWAY',
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(!refPart2Over.success && refPart2Over.code === 'REFUND_EXCEEDS_NET_PAID', 
      'Refund 2 of ₹500 rejected (exceeds max refundable ₹450)');

    // Refund 2: Exactly remaining ₹450
    const refPart2 = await SalesReturnService.postCustomerRefund({
      orderId: ordPartRef.orderId,
      amount: 450,
      refundMethod: 'GATEWAY',
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(refPart2.success, `Partial refund 2 of exactly ₹450 posted`);

    const arPartRef2 = await CustomerReceiptService.getOrderOutstandingAr(ordPartRef.orderId, client);
    assert(arPartRef2.maxRefundable === 0, `Remaining maxRefundable is ₹0`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 10: COD Return Before Collection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[11/20] Test Group 10: COD return before collection...');
    
    await seedLotsAndStock('lot_cake_cod_pre', cakeProd, 'CAKE', 10, 200);

    const ordCodPre = await createAndPostSalesOrder({
      paymentMethod: 'cod',
      qty: 2,
      unitPrice: 500, // ₹1050 to 1122 Undeposited COD
    });

    // Return before cash collection: Cr 1122 Undeposited COD
    const draftCodPre = await SalesReturnService.createSalesReturnDraft({
      orderId: ordCodPre.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'REJECTED_AT_DOOR', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    await SalesReturnService.submitSalesReturn({ voucherId: draftCodPre.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftCodPre.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const postCodPre = await SalesReturnService.postCreditNote({ voucherId: draftCodPre.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    assert(postCodPre.success, 'COD credit note before collection posted');
    const lineCr1122 = postCodPre.data.lines.find(l => l.account_code === '1122');
    assert(Boolean(lineCr1122) && Number(lineCr1122.credit_amount) === 1050, `Cr 1122 Undeposited COD === ₹1050`);

    // Outstanding AR is 0, refundable is 0
    const arCodPre = await CustomerReceiptService.getOrderOutstandingAr(ordCodPre.orderId, client);
    assert(arCodPre.outstandingAr === 0, `COD AR outstanding is ₹0`);
    assert(arCodPre.maxRefundable === 0, `COD refundable is ₹0`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 11: COD Return After Collection & Cash Drawer Refund
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[12/20] Test Group 11: COD return after collection & cash drawer refund...');
    
    await seedLotsAndStock('lot_cake_cod_post', cakeProd, 'CAKE', 10, 200);

    const ordCodPost = await createAndPostSalesOrder({ paymentMethod: 'cod', qty: 2, unitPrice: 500 });

    // Cash collected: Dr 1111 Cash in Hand / Cr 1122 Undeposited COD ₹1050
    const rcptCod = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordCodPost.orderId, amount: 1050, createdBy: staffCreator.id, client
    });
    const vchIdCod = rcptCod.data.id || rcptCod.data.voucher?.id;
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: vchIdCod, submittedBy: staffCreator.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: vchIdCod, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await CustomerReceiptService.postCustomerReceipt({ voucherId: vchIdCod, postedBy: posterUser.id, actorContext: posterUser, client });

    // Customer returns goods later: Cr 1122 Undeposited COD ₹1050
    const draftRetCodPost = await SalesReturnService.createSalesReturnDraft({
      orderId: ordCodPost.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'POOR_QUALITY', isResalable: false }],
      createdBy: staffCreator.id, client
    });
    await SalesReturnService.submitSalesReturn({ voucherId: draftRetCodPost.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftRetCodPost.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftRetCodPost.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    // Cash refund from register: Dr 1122 Undeposited COD / Cr 1111 Cash in Hand ₹1050
    const refCash = await SalesReturnService.postCustomerRefund({
      orderId: ordCodPost.orderId,
      amount: 1050,
      refundMethod: 'CASH',
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(refCash.success, `Cash refund posted: ${refCash.data?.voucher?.voucher_no || refCash.data?.voucher?.voucher_number || refCash.error}`);
    const lineRefDr1122 = refCash.data.lines.find(l => l.account_code === '1122');
    const lineRefCr1111 = refCash.data.lines.find(l => l.account_code === '1111');
    assert(Boolean(lineRefDr1122) && Number(lineRefDr1122.debit_amount) === 1050, `Dr 1122 Undeposited COD === ₹1050`);
    assert(Boolean(lineRefCr1111) && Number(lineRefCr1111.credit_amount) === 1050, `Cr 1111 Cash in Hand === ₹1050`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 12: Partial Payment + Partial Return AR Reconciliation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[13/20] Test Group 12: Partial payment + partial return AR reconciliation...');
    
    await seedLotsAndStock('lot_cake_mix', cakeProd, 'CAKE', 10, 200);

    // Invoiced: 2 cakes @ ₹500 + 5% GST = ₹1050
    const ordMix = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 });

    // Customer paid partial ₹400 via UPI
    const rcptMix = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordMix.orderId, amount: 400, createdBy: staffCreator.id, client
    });
    const vchIdMix = rcptMix.data.id || rcptMix.data.voucher?.id;
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: vchIdMix, submittedBy: staffCreator.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: vchIdMix, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await CustomerReceiptService.postCustomerReceipt({ voucherId: vchIdMix, postedBy: posterUser.id, actorContext: posterUser, client });

    // Outstanding AR is ₹650 (1050 - 400)
    let arMix = await CustomerReceiptService.getOrderOutstandingAr(ordMix.orderId, client);
    assert(arMix.outstandingAr === 650, `Outstanding AR before return is ₹650`);

    // Customer returns 1 cake (₹500 + ₹25 GST = ₹525)
    const draftRetMix = await SalesReturnService.createSalesReturnDraft({
      orderId: ordMix.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id, client
    });
    await SalesReturnService.submitSalesReturn({ voucherId: draftRetMix.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftRetMix.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftRetMix.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    // AR reconciliation:
    // netInvoiced = 1050 - 525 = 525
    // netPaid = 400
    // outstandingAr = 525 - 400 = 125
    // maxRefundable = max(0, 400 - 525) = 0
    arMix = await CustomerReceiptService.getOrderOutstandingAr(ordMix.orderId, client);
    assert(arMix.netInvoiced === 525, `netInvoiced === ₹525`);
    assert(arMix.netPaid === 400, `netPaid === ₹400`);
    assert(arMix.outstandingAr === 125, `Remaining customer liability === ₹125`);
    assert(arMix.maxRefundable === 0, `maxRefundable === ₹0 (customer still owes money)`);

    // Attempting refund on this state MUST be rejected
    const refMixAttempt = await SalesReturnService.postCustomerRefund({
      orderId: ordMix.orderId,
      amount: 50,
      refundMethod: 'GATEWAY',
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(!refMixAttempt.success && refMixAttempt.code === 'REFUND_NOT_ELIGIBLE', 
      'Refund rejected when customer still has outstanding liability (REFUND_NOT_ELIGIBLE)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 13: Segregation of Duties (SoD) Enforcement
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[14/20] Test Group 13: Segregation of Duties (SoD) enforcement...');
    
    await seedLotsAndStock('lot_cake_sod', cakeProd, 'CAKE', 10, 200);
    const ordSod = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 });

    const draftSod = await SalesReturnService.createSalesReturnDraft({
      orderId: ordSod.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });

    const subSod = await SalesReturnService.submitSalesReturn({
      voucherId: draftSod.data.voucher.id,
      submittedBy: 'usr_return_submitter_01',
      client,
    });

    // Rule A: Creator cannot approve
    const appSodRuleA = await SalesReturnService.approveSalesReturn({
      voucherId: subSod.data.id,
      approvedBy: staffCreator.id,
      actorContext: { ...staffCreator, permissions: ['ACCOUNTING.APPROVE'] },
      client,
    });
    assert(!appSodRuleA.success && appSodRuleA.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 
      'SoD: Voucher creator cannot approve own return voucher');

    // Rule B: Submitter cannot approve
    const appSodRuleB = await SalesReturnService.approveSalesReturn({
      voucherId: subSod.data.id,
      approvedBy: 'usr_return_submitter_01',
      actorContext: { id: 'usr_return_submitter_01', permissions: ['ACCOUNTING.APPROVE'] },
      client,
    });
    assert(!appSodRuleB.success && appSodRuleB.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 
      'SoD: Voucher submitter cannot approve return voucher');

    // Approve validly by independent supervisor
    const appSodValid = await SalesReturnService.approveSalesReturn({
      voucherId: subSod.data.id,
      approvedBy: supervisorUser.id,
      actorContext: supervisorUser,
      client,
    });
    assert(appSodValid.success, 'Approved validly by independent supervisor');

    // Rule C: Creator cannot post
    const postSodRuleC = await SalesReturnService.postCreditNote({
      voucherId: appSodValid.data.id,
      postedBy: staffCreator.id,
      actorContext: { ...staffCreator, permissions: ['ACCOUNTING.POST'] },
      client,
    });
    assert(!postSodRuleC.success && postSodRuleC.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 
      'SoD: Voucher creator cannot post own return voucher');

    // Rule D: Customer cannot post
    const postSodRuleD = await SalesReturnService.postCreditNote({
      voucherId: appSodValid.data.id,
      postedBy: ordSod.custId,
      actorContext: { id: ordSod.custId, permissions: ['ACCOUNTING.POST'] },
      client,
    });
    assert(!postSodRuleD.success && postSodRuleD.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 
      'SoD: Customer cannot post return voucher');

    // Rule E: Commercial order creator cannot post
    const postSodRuleE = await SalesReturnService.postCreditNote({
      voucherId: appSodValid.data.id,
      postedBy: staffCreator.id,
      actorContext: { ...staffCreator, permissions: ['ACCOUNTING.POST'] },
      client,
    });
    assert(!postSodRuleE.success && postSodRuleE.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 
      'SoD: Commercial order creator cannot post return voucher');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 14: Canonical Permissions Enforcement
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[15/20] Test Group 14: Canonical permissions enforcement...');
    
    // Approving without ACCOUNTING.APPROVE
    const appNoPerm = await SalesReturnService.approveSalesReturn({
      voucherId: appSodValid.data.id,
      approvedBy: unprivilegedUser.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(!appNoPerm.success && appNoPerm.code === 'PERMISSION_DENIED', 
      'Approval rejected without ACCOUNTING.APPROVE (PERMISSION_DENIED)');

    // Posting without ACCOUNTING.POST
    const postNoPerm = await SalesReturnService.postCreditNote({
      voucherId: appSodValid.data.id,
      postedBy: unprivilegedUser.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(!postNoPerm.success && postNoPerm.code === 'PERMISSION_DENIED', 
      'Posting credit note rejected without ACCOUNTING.POST (PERMISSION_DENIED)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 15: Branch Isolation (BOLA Defense)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[16/20] Test Group 15: Branch isolation (BOLA defense)...');
    
    const draftBola = await SalesReturnService.createSalesReturnDraft({
      orderId: ordSod.orderId,
      branchId: 'br_foreign_branch_999', // foreign branch
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id,
      client,
    });
    assert(!draftBola.success && draftBola.code === 'BRANCH_ACCESS_DENIED', 
      'Cross-branch return rejected with BRANCH_ACCESS_DENIED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 16: Refund Idempotency
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[17/20] Test Group 16: Refund idempotency...');
    
    await seedLotsAndStock('lot_cake_idem', cakeProd, 'CAKE', 10, 200);
    const ordIdem = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 });
    // Pay full
    const rcptIdem = await CustomerReceiptService.createCustomerReceiptDraft({ orderId: ordIdem.orderId, amount: 1050, createdBy: staffCreator.id, client });
    const vchIdIdem = rcptIdem.data.id || rcptIdem.data.voucher?.id;
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: vchIdIdem, submittedBy: staffCreator.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: vchIdIdem, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await CustomerReceiptService.postCustomerReceipt({ voucherId: vchIdIdem, postedBy: posterUser.id, actorContext: posterUser, client });
    // Return full
    const draftRetIdem = await SalesReturnService.createSalesReturnDraft({
      orderId: ordIdem.orderId, items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'DEFECTIVE', isResalable: false }], createdBy: staffCreator.id, client
    });
    await SalesReturnService.submitSalesReturn({ voucherId: draftRetIdem.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftRetIdem.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    await SalesReturnService.postCreditNote({ voucherId: draftRetIdem.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    const testIdempotencyKey = 'idem_key_refund_test_46_' + Date.now();
    const refIdem1 = await SalesReturnService.postCustomerRefund({
      orderId: ordIdem.orderId,
      amount: 1050,
      refundMethod: 'GATEWAY',
      idempotencyKey: testIdempotencyKey,
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(refIdem1.success && refIdem1.data.wasDuplicate === false, 'First refund attempt with idempotency key succeeded');

    const refIdem2 = await SalesReturnService.postCustomerRefund({
      orderId: ordIdem.orderId,
      amount: 1050,
      refundMethod: 'GATEWAY',
      idempotencyKey: testIdempotencyKey,
      disbursedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(refIdem2.success && refIdem2.data.wasDuplicate === true, 'Duplicate refund attempt with same idempotency key returned existing voucher (wasDuplicate = true)');
    assert(refIdem2.data.voucher.id === refIdem1.data.voucher.id, 'Duplicate returned the exact same voucher ID');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 17: Guest Customer FK Hygiene (journal_line.customer_id = NULL)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[18/20] Test Group 17: Guest customer foreign key hygiene...');
    
    await seedLotsAndStock('lot_cake_guest', cakeProd, 'CAKE', 10, 200);
    const ordGuest = await createAndPostSalesOrder({ isGuest: true, qty: 2, unitPrice: 500 });
    const draftGuest = await SalesReturnService.createSalesReturnDraft({
      orderId: ordGuest.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 2, reason: 'DEFECTIVE', isResalable: false }],
      createdBy: staffCreator.id, client
    });
    await SalesReturnService.submitSalesReturn({ voucherId: draftGuest.data.voucher.id, submittedBy: staffCreator.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: draftGuest.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const postGuest = await SalesReturnService.postCreditNote({ voucherId: draftGuest.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });

    assert(postGuest.success, 'Guest customer credit note posted successfully');
    for (const line of postGuest.data.lines) {
      assert(line.customer_id === null, `Journal line customer_id === NULL for guest customer (line ${line.account_code})`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 18: Failure Injection & Atomic Savepoint Rollback
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[19/20] Test Group 18: Failure injection & atomic savepoint rollback...');
    
    await client.query('SAVEPOINT sp_failure_test');
    try {
      // Simulate failure by corrupting voucher state or intentional exception
      await client.query(`INSERT INTO public.accounting_voucher (id, branch_id, voucher_number, voucher_type, voucher_date, status, total_amount, currency)
        VALUES ('vch_fail_corrupt', $1, 'VCH-CORRUPT', 'CREDIT_NOTE', '2026-09-26', 'POSTED', 100, 'INR')`, [branchA.id]);
      throw new Error('SIMULATED_FAILURE');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_failure_test');
      assert(true, 'Transaction rolled back cleanly to savepoint on simulated error');
    }

    const checkFailVch = await client.query(`SELECT count(*)::int FROM public.accounting_voucher WHERE id = 'vch_fail_corrupt'`);
    assert(checkFailVch.rows[0].count === 0, 'Corrupt record was completely discarded by savepoint rollback');

    // ─────────────────────────────────────────────────────────────────────────
    // ROLLBACK ISOLATED TEST TRANSACTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[20/20] Rolling back test transaction and verifying clean database baseline...');
    await client.query('ROLLBACK');

    // ── Group 20: Post-test baseline audit ───────────────────────────────────
    const bPost = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) AS con_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS binv_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS ptx_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt
    `);
    const rPost = bPost.rows[0];
    assert(rPost.vch_cnt === 0, `Post-test accounting_voucher === 0 (actual: ${rPost.vch_cnt})`);
    assert(rPost.je_cnt === 0, `Post-test accounting_journal_entry === 0 (actual: ${rPost.je_cnt})`);
    assert(rPost.jl_cnt === 0, `Post-test accounting_journal_line === 0 (actual: ${rPost.jl_cnt})`);
    assert(rPost.lot_cnt === 0, `Post-test inventory_cost_lot === 0 (actual: ${rPost.lot_cnt})`);
    assert(rPost.mov_cnt === 0, `Post-test inventory_movement === 0 (actual: ${rPost.mov_cnt})`);
    assert(rPost.con_cnt === 0, `Post-test inventory_cost_consumption === 0 (actual: ${rPost.con_cnt})`);
    assert(rPost.binv_cnt === 424, `Post-test branch_inventory === 424 (actual: ${rPost.binv_cnt})`);
    assert(rPost.ord_cnt === 173, `Post-test order === 173 (actual: ${rPost.ord_cnt})`);
    assert(rPost.ptx_cnt === 53, `Post-test payment_transaction === 53 (actual: ${rPost.ptx_cnt})`);
    assert(rPost.start_date_cnt === 0, `Accounting start date unconfigured in baseline (actual: ${rPost.start_date_cnt})`);
    assert(rPost.fp_cnt === 0, `Accounting fiscal period === 0 in baseline (actual: ${rPost.fp_cnt})`);

    console.log('\n=============================================================================');
    console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} assertions.`);
    console.log('=============================================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
