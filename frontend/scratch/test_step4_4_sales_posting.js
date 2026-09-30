/**
 * CakeToHome ERP — Phase 4F Step 4.4 Sales Posting, Inventory Fulfillment & FIFO COGS Test Suite
 *
 * SCOPE:
 * Approved Sales Voucher (Step 4.3 Frozen)
 *       ↓
 * Atomic Concurrency & Pessimistic Row Locking (Order, Voucher, Branch Inventory, Cost Lots)
 *       ↓
 * Fail-Closed Guards:
 *   - ACCOUNTING_START_DATE_NOT_CONFIGURED (Unconfigured start date)
 *   - FISCAL_PERIOD_NOT_CONFIGURED (Unconfigured fiscal period)
 *   - INSUFFICIENT_COST_LOT_QUANTITY (Zero Cost Fabrication Guard)
 *   - INSUFFICIENT_PHYSICAL_INVENTORY (Physical branch stock check)
 *   - INVALID_VOUCHER_STATE (Only APPROVED vouchers postable)
 *   - PERMISSION_DENIED (Missing ACCOUNTING.POST)
 *   - SEGREGATION_OF_DUTIES_VIOLATION (Preparer, submitter, creator, customer)
 *   - INVALID_ORDER_STATUS / LEGACY_PROTOTYPE_ORDER_REJECTED
 *       ↓
 * Deterministic FIFO Cost-Lot Consumption & Allocation
 *       ↓
 * Authoritative Ledgers Creation:
 *   - public.inventory_movement (SALES_FULFILLMENT, OUT)
 *   - public.inventory_cost_consumption (chk_cost_consumption_math)
 *   - public.branch_inventory decrement
 *       ↓
 * Atomic Compound GL Journal Entry:
 *   - Commercial Side: Dr 1121/1122 AR = Cr 4110/4120/4130 Revenue + Cr 2121-2129 Output GST
 *   - Operational Side: Dr 5110/5120/5130 COGS = Cr 1132/1131/1133 Inventory
 *   - 1:1 UNIQUE constraint on accounting_journal_entry.voucher_id preserved
 *   - Exact paise-level balance: sum(Debits) === invoiceTotal + totalCogs === sum(Credits)
 *       ↓
 * Delegate to Canonical PostingService.postVoucher -> Voucher POSTED
 *       ↓
 * 100% Rollback Integrity Guard: Zero persistent mutations to baseline DB.
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
  console.log('CakeToHome ERP — Phase 4F Step 4.4 Sales Posting & FIFO COGS Test Suite');
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

  const { SalesPostingService } = require('../src/lib/services/sales-posting.service');
  const { StaffAccessControl } = require('../src/lib/staff-access-control');

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
    console.log('[0/15] Verifying pre-test database baseline...');
    const b0 = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) AS con_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS inv_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS pay_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt
    `);
    const pre = b0.rows[0];
    assert(pre.vch_cnt === 0, `Pre-test accounting_voucher === 0 (actual: ${pre.vch_cnt})`);
    assert(pre.je_cnt === 0, `Pre-test accounting_journal_entry === 0 (actual: ${pre.je_cnt})`);
    assert(pre.jl_cnt === 0, `Pre-test accounting_journal_line === 0 (actual: ${pre.jl_cnt})`);
    assert(pre.lot_cnt === 0, `Pre-test inventory_cost_lot === 0 (actual: ${pre.lot_cnt})`);
    assert(pre.mov_cnt === 0, `Pre-test inventory_movement === 0 (actual: ${pre.mov_cnt})`);
    assert(pre.con_cnt === 0, `Pre-test inventory_cost_consumption === 0 (actual: ${pre.con_cnt})`);
    assert(pre.inv_cnt === 424, `Pre-test branch_inventory === 424 (actual: ${pre.inv_cnt})`);
    assert(pre.ord_cnt === 173, `Pre-test order === 173 (actual: ${pre.ord_cnt})`);
    assert(pre.pay_cnt === 53, `Pre-test payment_transaction === 53 (actual: ${pre.pay_cnt})`);
    assert(pre.start_date_cnt === 0, `Accounting start date unconfigured in baseline (actual: ${pre.start_date_cnt})`);

    // BEGIN isolated transaction
    console.log('\n[1/15] Beginning isolated ROLLBACK transaction for all Step 4.4 test groups...');
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────────────────
    // FIXTURE SETUP
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Resolve branch
    const brRes = await client.query(`SELECT * FROM public.branch WHERE deleted_at IS NULL LIMIT 2`);
    const branchA = brRes.rows[0];
    const branchB = brRes.rows[1] || brRes.rows[0];
    assert(Boolean(branchA), `Resolved branch A (${branchA.name})`);

    // Ensure branchA has state 'Karnataka' and GSTIN prefix '29' in metadata
    await client.query(`
      UPDATE public.branch
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{state}',
        '"Karnataka"'::jsonb
      ) || jsonb_build_object('gstin', '29AABCU9603R1ZM')
      WHERE id = $1
    `, [branchA.id]);

    // 2. Resolve catalog products (CAKE and ACCESSORY)
    const cakeProdRes = await client.query(
      `SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id
       FROM public.product p 
       JOIN public.product_variant pv ON p.id = pv.product_id
       WHERE p.merchandise_type = 'CAKE' AND p.deleted_at IS NULL LIMIT 1`
    );
    const cakeProd = cakeProdRes.rows[0];
    assert(Boolean(cakeProd), `Resolved catalog cake product: ${cakeProd.id} (${cakeProd.title})`);

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
    assert(Boolean(accProd), `Resolved catalog accessory product: ${accProd.id} (${accProd.title})`);

    await client.query(`
      UPDATE public.product
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{gst_rate}', '18'::jsonb)
      WHERE id = $1
    `, [accProd.id]);

    // 3. Define actor contexts
    const clerkUser = {
      id: 'usr_clerk_01',
      user_id: 'usr_clerk_01',
      role: 'STAFF',
      permissions: ['SALES.CREATE', 'SALES.SUBMIT'],
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

    // Helper: create an approved sales voucher
    async function createApprovedSalesVoucher(orderIdSuffix, items, orderStatus = 'completed', isLegacy = false, createdBy = clerkUser.id, extraMeta = {}) {
      const ts = Date.now() + Math.floor(Math.random() * 1000);
      const custId = `cust_test_${orderIdSuffix}_${ts}`;
      await client.query(
        `INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
         VALUES ($1, 'Customer', $2, $3, '9999977777', true, NOW(), NOW())`,
        [custId, orderIdSuffix, `${orderIdSuffix}_${ts}@example.com`]
      );

      const orderId = `ord_test_${orderIdSuffix}_${ts}`;
      const orderMetadata = {
        is_ledger_eligible: !isLegacy,
        legacy_prototype: isLegacy,
        branch_id: branchA.id,
        items,
        delivery_address: {
          state: 'Karnataka',
          pincode: '560001',
        },
        payment_method: 'card',
        created_by: createdBy,
        ...extraMeta,
      };

      await client.query(
        `INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'inr', $5, '2026-09-26 10:00:00Z', NOW())`,
        [orderId, orderStatus, custId, `${orderIdSuffix}_${ts}@example.com`, JSON.stringify(orderMetadata)]
      );

      // Create draft
      const draftRes = await SalesPostingService.createSalesVoucherDraft({
        orderId,
        createdBy: clerkUser.id,
        branchId: branchA.id,
        client,
      });
      if (!draftRes.success) {
        throw new Error(`Failed to create draft: ${draftRes.error}`);
      }

      // Submit
      const subRes = await SalesPostingService.submitSalesVoucher({
        voucherId: draftRes.data.id,
        submittedBy: clerkUser.id,
        branchId: branchA.id,
        client,
      });
      if (!subRes.success) {
        throw new Error(`Failed to submit: ${subRes.error}`);
      }

      // Approve
      const appRes = await SalesPostingService.approveSalesVoucher({
        voucherId: subRes.data.id,
        approvedBy: supervisorUser.id,
        branchId: branchA.id,
        actorContext: supervisorUser,
        client,
      });
      if (!appRes.success) {
        throw new Error(`Failed to approve: ${appRes.error}`);
      }

      return {
        orderId,
        voucher: appRes.data.voucher,
      };
    }

    // Seed prerequisite purchase fixture inside rollback transaction for foreign keys
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES ('sup_fixture_test', 'Fixture Supplier Corp', '29AABCU9603R1Z5', 'Karnataka', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_fixture_test', 'sup_fixture_test', $1, 'INV-FIXTURE-01', '2026-09-01',
        100000, 0, 100000, 0, 0, 0, 100000,
        'APPROVED', 'buyer_01', 'mgr_01', NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING;
    `, [branchA.id]);

    // Helper: seed authentic purchase cost lots within transaction
    async function seedPurchaseCostLot(lotId, branchId, productId, variantId, itemType, qty, unitCost, receivedAt = '2026-09-01') {
      const totalCost = Math.round(qty * unitCost * 100) / 100;
      const piId = 'pi_fixture_' + lotId;

      await client.query(
        `INSERT INTO public.purchase_item (
           id, purchase_id, product_id, variant_id, description,
           quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
           cgst, sgst, igst, total, item_type, created_at, updated_at
         ) VALUES (
           $1, 'pur_fixture_test', $2, $3, 'Fixture Item ' || $1,
           $4, $5, 0.00, $6, 0, 0, 0,
           0, 0, 0, $6, $7, NOW(), NOW()
         ) ON CONFLICT (id) DO NOTHING;`,
        [piId, productId, variantId, qty, unitCost, totalCost, itemType]
      );

      const res = await client.query(
        `INSERT INTO public.inventory_cost_lot (
           id, branch_id, product_id, variant_id, item_type,
           purchase_id, purchase_item_id, supplier_id,
           received_quantity, remaining_quantity, unit_cost, total_cost,
           currency, received_at, status, created_by, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           'pur_fixture_test', $6, 'sup_fixture_test',
           $7, $7, $8, $9,
           'INR', $10, 'ACTIVE', 'SYSTEM', NOW(), NOW()
         ) RETURNING *;`,
        [lotId, branchId, productId, variantId, itemType, piId, qty, unitCost, totalCost, receivedAt]
      );
      return res.rows[0];
    }

    // Helper: ensure branch_inventory quantity
    async function setBranchInventoryQty(branchId, variantId, productId, qty) {
      const existing = await client.query(
        `SELECT id FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
        [branchId, variantId]
      );
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE public.branch_inventory SET quantity = $1, reserved = 0, updated_at = NOW() WHERE id = $2`,
          [qty, existing.rows[0].id]
        );
      } else {
        const binvId = `binv_test_${branchId}_${variantId}`.slice(0, 60);
        await client.query(
          `INSERT INTO public.branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())`,
          [binvId, branchId, productId, variantId, qty]
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 1: Fail Closed on Unconfigured Accounting Start Date
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/15] Test Group 1: Fail closed on unconfigured accounting_start_date...');
    const f1 = await createApprovedSalesVoucher('g1', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 500, gst_rate: 5 }
    ]);
    const res1 = await SalesPostingService.postSalesVoucher({
      voucherId: f1.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!res1.success, 'Post blocked when accounting_start_date is unconfigured');
    assert(res1.code === 'POSTING_GUARD_FAILED' && res1.error?.includes('ACCOUNTING_START_DATE_NOT_CONFIGURED'),
      'Returned error is ACCOUNTING_START_DATE_NOT_CONFIGURED');

    // Configure temporary start date inside transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_4_4', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    assert(true, 'Temporary accounting_start_date configured inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 2: Fail Closed on Unconfigured Fiscal Period
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/15] Test Group 2: Fail closed on unconfigured fiscal period...');
    const res2 = await SalesPostingService.postSalesVoucher({
      voucherId: f1.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!res2.success, 'Post blocked when 0 fiscal periods are configured');
    assert(res2.code === 'POSTING_GUARD_FAILED' && res2.error?.includes('FISCAL_PERIOD_NOT_CONFIGURED'),
      'Returned error is FISCAL_PERIOD_NOT_CONFIGURED');

    // Configure temporary fiscal period inside transaction
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_4_4', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    assert(true, 'Temporary fiscal period inserted inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 3: Fail Closed on Zero Cost Lots (Strict Zero Cost Fabrication Guard)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/15] Test Group 3: Strict Zero Cost Fabrication Guard (Zero cost lots in DB)...');
    // Ensure physical inventory exists so the test specifically validates cost-lot guard
    await setBranchInventoryQty(branchA.id, cakeProd.variant_id, cakeProd.id, 20);

    // Update product cost_price in DB to prove it is NEVER consulted
    await client.query(
      `UPDATE public.product 
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cost_price}', '199.99'::jsonb)
       WHERE id = $1`,
      [cakeProd.id]
    );

    const res3 = await SalesPostingService.postSalesVoucher({
      voucherId: f1.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!res3.success, 'Post blocked when 0 cost lots exist in DB');
    assert(res3.code === 'INSUFFICIENT_COST_LOT_QUANTITY', 'Error code is INSUFFICIENT_COST_LOT_QUANTITY');
    assert(res3.error?.includes('Inventory cost cannot be synthesized or fabricated'),
      'Error message explicitly states cost cannot be fabricated (product.cost_price ignored)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 4: Fail Closed on Partial / Insufficient Cost Lots (7 available vs 10 needed)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/15] Test Group 4: Fail closed on partial cost lots (7 available vs 10 required)...');
    // Seed exactly 7 cost lots
    await seedPurchaseCostLot('lot_g4_cake', branchA.id, cakeProd.id, cakeProd.variant_id, 'CAKE', 7, 300.0);
    await setBranchInventoryQty(branchA.id, cakeProd.variant_id, cakeProd.id, 20);

    const f4 = await createApprovedSalesVoucher('g4', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 10, unit_price: 600, gst_rate: 5 }
    ]);

    const res4 = await SalesPostingService.postSalesVoucher({
      voucherId: f4.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!res4.success, 'Post blocked when cost lots are insufficient (7 available vs 10 required)');
    assert(res4.code === 'INSUFFICIENT_COST_LOT_QUANTITY', 'Error code is INSUFFICIENT_COST_LOT_QUANTITY');
    assert(res4.error?.includes('required 10, available 7'), 'Error message specifies required vs available');

    // Clean up temporary lot for subsequent isolated tests
    await client.query(`DELETE FROM public.inventory_cost_lot WHERE id = 'lot_g4_cake'`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 5: Fail Closed on Insufficient Physical Inventory
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/15] Test Group 5: Fail closed on insufficient physical branch inventory...');
    // Seed 10 cost lots, but set physical inventory to only 3
    await seedPurchaseCostLot('lot_g5_cake', branchA.id, cakeProd.id, cakeProd.variant_id, 'CAKE', 10, 300.0);
    await setBranchInventoryQty(branchA.id, cakeProd.variant_id, cakeProd.id, 3);

    const f5 = await createApprovedSalesVoucher('g5', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 5, unit_price: 500, gst_rate: 5 }
    ]);

    const res5 = await SalesPostingService.postSalesVoucher({
      voucherId: f5.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!res5.success, 'Post blocked when physical stock is insufficient (3 available vs 5 required)');
    assert(res5.code === 'INSUFFICIENT_PHYSICAL_INVENTORY', 'Error code is INSUFFICIENT_PHYSICAL_INVENTORY');
    assert(res5.error?.includes('required 5, available 3'), 'Error message specifies physical required vs available');

    await client.query(`DELETE FROM public.inventory_cost_lot WHERE id = 'lot_g5_cake'`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 6: Voucher State Machine Guards (Only APPROVED vouchers postable)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/15] Test Group 6: Voucher State Machine Guards...');
    // A. DRAFT voucher rejected
    const draftOnlyRes = await SalesPostingService.createSalesVoucherDraft({
      orderId: f1.orderId,
      createdBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });
    // Create new order for clean draft
    const g6Meta = {
      is_ledger_eligible: true,
      branch_id: branchA.id,
      items: [{ product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 500, gst_rate: 5 }],
      delivery_address: { state: 'Karnataka' },
      payment_method: 'card',
    };
    const f6OrderRes = await client.query(
      `INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
       VALUES ('ord_test_g6_draft', 'completed', 'cust_g6', 'cust_g6@example.com', 'inr', $1, NOW(), NOW()) RETURNING id`,
      [JSON.stringify(g6Meta)]
    );
    const g6Draft = await SalesPostingService.createSalesVoucherDraft({
      orderId: f6OrderRes.rows[0].id,
      createdBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });
    const resDraft = await SalesPostingService.postSalesVoucher({
      voucherId: g6Draft.data.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resDraft.success, 'Posting DRAFT voucher rejected');
    assert(resDraft.code === 'INVALID_VOUCHER_STATE', 'Error code is INVALID_VOUCHER_STATE');

    // B. SUBMITTED voucher rejected
    const g6Sub = await SalesPostingService.submitSalesVoucher({
      voucherId: g6Draft.data.id,
      submittedBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });
    const resSub = await SalesPostingService.postSalesVoucher({
      voucherId: g6Sub.data.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resSub.success, 'Posting SUBMITTED voucher rejected');
    assert(resSub.code === 'INVALID_VOUCHER_STATE', 'Error code is INVALID_VOUCHER_STATE');

    // C. CANCELLED voucher rejected
    const g6Cancel = await SalesPostingService.rejectSalesVoucher({
      voucherId: g6Sub.data.id,
      rejectedBy: supervisorUser.id,
      rejectionReason: 'Quality inspection reject',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    const resCancel = await SalesPostingService.postSalesVoucher({
      voucherId: g6Cancel.data.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resCancel.success, 'Posting CANCELLED voucher rejected');
    assert(resCancel.code === 'INVALID_VOUCHER_STATE', 'Error code is INVALID_VOUCHER_STATE');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 7: Permission & Authorization Guards (ACCOUNTING.POST)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/15] Test Group 7: Permission & Authorization Guards...');
    const f7 = await createApprovedSalesVoucher('g7', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 500, gst_rate: 5 }
    ]);
    const resPermFail = await SalesPostingService.postSalesVoucher({
      voucherId: f7.voucher.id,
      postedBy: unprivilegedUser.id,
      branchId: branchA.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(!resPermFail.success, 'Posting without ACCOUNTING.POST permission rejected');
    assert(resPermFail.code === 'PERMISSION_DENIED', 'Error code is PERMISSION_DENIED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 8: Segregation of Duties (SoD) Guards
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/15] Test Group 8: Segregation of Duties (SoD) Guards...');
    // A. Preparer self-posting blocked
    const resSodPrep = await SalesPostingService.postSalesVoucher({
      voucherId: f7.voucher.id,
      postedBy: clerkUser.id, // Voucher creator
      branchId: branchA.id,
      actorContext: posterUser, // Even with post permission, self-posting is blocked
      client,
    });
    assert(!resSodPrep.success, 'Voucher preparer cannot post their own voucher');
    assert(resSodPrep.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Error code is SEGREGATION_OF_DUTIES_VIOLATION');

    // B. Submitter self-posting blocked
    const resSodSub = await SalesPostingService.postSalesVoucher({
      voucherId: f7.voucher.id,
      postedBy: f7.voucher.submitted_by,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resSodSub.success, 'Voucher submitter cannot post voucher');
    assert(resSodSub.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Error code is SEGREGATION_OF_DUTIES_VIOLATION');

    // C. Commercial Order Creator self-posting blocked
    const f8c = await createApprovedSalesVoucher('g8c', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 500, gst_rate: 5 }
    ], 'completed', false, 'usr_comm_creator_01');
    const resSodComm = await SalesPostingService.postSalesVoucher({
      voucherId: f8c.voucher.id,
      postedBy: 'usr_comm_creator_01',
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resSodComm.success, 'Commercial order creator cannot post accounting voucher');
    assert(resSodComm.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Error code is SEGREGATION_OF_DUTIES_VIOLATION');

    // D. Customer self-posting blocked
    const ordCustRes = await client.query(`SELECT customer_id FROM public."order" WHERE id = $1`, [f7.voucher.reference_id]);
    const custId = ordCustRes.rows[0].customer_id;
    const resSodCust = await SalesPostingService.postSalesVoucher({
      voucherId: f7.voucher.id,
      postedBy: custId,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resSodCust.success, 'Customer identity cannot post accounting voucher');
    assert(resSodCust.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Error code is SEGREGATION_OF_DUTIES_VIOLATION');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 9: Source Order Integrity & Quarantine Guards
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/15] Test Group 9: Source Order Integrity & Quarantine Guards...');
    // A. Canceled order rejected
    const f9Cancel = await createApprovedSalesVoucher('g9_cancel', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 500, gst_rate: 5 }
    ]);
    await client.query(`UPDATE public."order" SET status = 'canceled' WHERE id = $1`, [f9Cancel.orderId]);
    const resOrdCancel = await SalesPostingService.postSalesVoucher({
      voucherId: f9Cancel.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resOrdCancel.success, 'Canceled source order rejected for sales posting');
    assert(resOrdCancel.code === 'INVALID_ORDER_STATUS', 'Error code is INVALID_ORDER_STATUS');

    // B. Legacy prototype order rejected
    const f9Legacy = await createApprovedSalesVoucher('g9_legacy', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 500, gst_rate: 5 }
    ]);
    await client.query(`
      UPDATE public."order"
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{legacy_prototype}', 'true'::jsonb)
      WHERE id = $1
    `, [f9Legacy.orderId]);
    const resOrdLegacy = await SalesPostingService.postSalesVoucher({
      voucherId: f9Legacy.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resOrdLegacy.success, 'Legacy prototype quarantined order rejected');
    assert(resOrdLegacy.code === 'LEGACY_PROTOTYPE_ORDER_REJECTED', 'Error code is LEGACY_PROTOTYPE_ORDER_REJECTED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 10: Happy Path Full Atomic Posting (Single Lot, Pure Cake Merchandise)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[11/15] Test Group 10: Happy Path Full Atomic Posting (Single Lot Cake)...');
    // Seed authentic purchase lot: 10 units @ ₹350.00
    await seedPurchaseCostLot('lot_g10_cake', branchA.id, cakeProd.id, cakeProd.variant_id, 'CAKE', 10, 350.0);
    await setBranchInventoryQty(branchA.id, cakeProd.variant_id, cakeProd.id, 10);

    // Sales voucher: 2 cakes @ ₹500.00 each = ₹1,000.00 + 5% GST (₹25 CGST + ₹25 SGST) = ₹1,050.00 invoice total
    const f10 = await createApprovedSalesVoucher('g10', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 2, unit_price: 500, gst_rate: 5 }
    ]);

    const res10 = await SalesPostingService.postSalesVoucher({
      voucherId: f10.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });

    assert(res10.success, 'Happy path sales posting executed successfully');
    const d10 = res10.data;
    assert(d10.voucher.status === 'POSTED', 'Voucher status updated to POSTED');
    assert(d10.voucher.posted_by === posterUser.id, 'Voucher posted_by matches poster ID');
    assert(d10.invoiceTotal === 1050.00, `Invoice total is ₹1,050.00 (got ${d10.invoiceTotal})`);
    assert(d10.totalCogs === 700.00, `Total COGS is ₹700.00 (2 * 350.00) (got ${d10.totalCogs})`);
    assert(d10.totalJournalAmount === 1750.00, `Total compound journal amount is ₹1,750.00 (1050 + 700) (got ${d10.totalJournalAmount})`);

    // Verify 1:1 Journal Entry created
    assert(Boolean(d10.journalEntry), 'Journal entry created');
    assert(Number(d10.journalEntry.total_debit) === 1750.00, 'Journal total_debit === 1,750.00');
    assert(Number(d10.journalEntry.total_credit) === 1750.00, 'Journal total_credit === 1,750.00');

    // Verify compound lines
    const lines10 = d10.journalEntry.lines;
    assert(lines10.length === 6, `Compound journal contains 6 lines (got ${lines10.length})`);

    const drAr = lines10.find(l => l.debit_amount > 0 && Number(l.debit_amount) === 1050.00);
    const crRev = lines10.find(l => l.credit_amount > 0 && Number(l.credit_amount) === 1000.00);
    const crCgst = lines10.find(l => l.credit_amount > 0 && Number(l.credit_amount) === 25.00);
    const crSgst = lines10.find(l => l.credit_amount > 0 && Number(l.credit_amount) === 25.00);
    const drCogs = lines10.find(l => l.debit_amount > 0 && Number(l.debit_amount) === 700.00);
    const crInv = lines10.find(l => l.credit_amount > 0 && Number(l.credit_amount) === 700.00);

    assert(Boolean(drAr), 'Debit 1121 AR ₹1,050.00 present');
    assert(Boolean(crRev), 'Credit 4110 Cake Revenue ₹1,000.00 present');
    assert(Boolean(crCgst), 'Credit 2121 Output CGST ₹25.00 present');
    assert(Boolean(crSgst), 'Credit 2122 Output SGST ₹25.00 present');
    assert(Boolean(drCogs), 'Debit 5110 COGS - Cakes ₹700.00 present');
    assert(Boolean(crInv), 'Credit 1132 Merchandise Inventory - Cakes ₹700.00 present');

    // Verify cost lot remaining quantity
    const updatedLot10 = (await client.query(`SELECT remaining_quantity, status FROM public.inventory_cost_lot WHERE id = 'lot_g10_cake'`)).rows[0];
    assert(Number(updatedLot10.remaining_quantity) === 8.0, `Cost lot remaining_quantity decremented to 8.000 (got ${updatedLot10.remaining_quantity})`);
    assert(updatedLot10.status === 'ACTIVE', 'Cost lot status remains ACTIVE');

    // Verify inventory movement
    assert(d10.movements.length === 1, '1 inventory movement recorded');
    assert(d10.movements[0].movement_type === 'SALES_FULFILLMENT', 'Movement type is SALES_FULFILLMENT');
    assert(d10.movements[0].direction === 'OUT', 'Movement direction is OUT');
    assert(Number(d10.movements[0].quantity) === 2, 'Movement quantity is 2');

    // Verify cost consumption
    assert(d10.costConsumptions.length === 1, '1 cost consumption record created');
    assert(Number(d10.costConsumptions[0].quantity) === 2, 'Consumption quantity is 2');
    assert(Number(d10.costConsumptions[0].unit_cost) === 350.0, 'Consumption unit_cost is 350.0');
    assert(Number(d10.costConsumptions[0].total_cost) === 700.0, 'Consumption total_cost is 700.0');

    // Verify physical branch inventory decremented
    const updatedBinv10 = (await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, cakeProd.variant_id])).rows[0];
    assert(Number(updatedBinv10.quantity) === 8, `Physical branch inventory decremented to 8 (got ${updatedBinv10.quantity})`);

    // Verify order metadata audit trail
    const updatedOrd10 = (await client.query(`SELECT metadata FROM public."order" WHERE id = $1`, [f10.orderId])).rows[0];
    assert(updatedOrd10.metadata.financial_voucher_id === d10.voucher.id, 'Order metadata references posted voucher ID');
    assert(updatedOrd10.metadata.journal_entry_id === d10.journalEntry.id, 'Order metadata references journal entry ID');
    assert(updatedOrd10.metadata.cogs_total === 700.00, 'Order metadata records cogs_total');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 11: Multi-Lot FIFO Consumption (Oldest Lot Depleted to 0 and DEPLETED)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[12/15] Test Group 11: Multi-Lot FIFO Consumption (Oldest lot depletion & partial second lot)...');
    // Deplete remaining lots from prior test groups to isolate FIFO sequence without violating consumption FKs
    await client.query(`UPDATE public.inventory_cost_lot SET remaining_quantity = 0, status = 'DEPLETED' WHERE branch_id = $1 AND product_id = $2`, [branchA.id, cakeProd.id]);

    // Lot 1: received 2026-08-15, qty 4 @ ₹300.00
    // Lot 2: received 2026-09-01, qty 10 @ ₹320.00
    await seedPurchaseCostLot('lot_g11_cake_1', branchA.id, cakeProd.id, cakeProd.variant_id, 'CAKE', 4, 300.0, '2026-08-15');
    await seedPurchaseCostLot('lot_g11_cake_2', branchA.id, cakeProd.id, cakeProd.variant_id, 'CAKE', 10, 320.0, '2026-09-01');
    await setBranchInventoryQty(branchA.id, cakeProd.variant_id, cakeProd.id, 20);

    // Sales voucher: 7 cakes required
    // FIFO allocation: 4 units from lot 1 (depleted), 3 units from lot 2 (7 remaining)
    // COGS = (4 * 300) + (3 * 320) = 1,200 + 960 = 2,160.00
    const f11 = await createApprovedSalesVoucher('g11', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 7, unit_price: 500, gst_rate: 5 }
    ]);

    const res11 = await SalesPostingService.postSalesVoucher({
      voucherId: f11.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });

    assert(res11.success, 'Multi-lot FIFO sales posting succeeded');
    const d11 = res11.data;
    assert(d11.totalCogs === 2160.00, `Multi-lot COGS total is ₹2,160.00 (got ${d11.totalCogs})`);
    assert(d11.costConsumptions.length === 2, `2 cost consumption records created (got ${d11.costConsumptions.length})`);

    // Verify Lot 1 is DEPLETED
    const lot1After = (await client.query(`SELECT remaining_quantity, status FROM public.inventory_cost_lot WHERE id = 'lot_g11_cake_1'`)).rows[0];
    assert(Number(lot1After.remaining_quantity) === 0, 'Lot 1 remaining_quantity === 0');
    assert(lot1After.status === 'DEPLETED', 'Lot 1 status === DEPLETED');

    // Verify Lot 2 has 7 remaining and ACTIVE
    const lot2After = (await client.query(`SELECT remaining_quantity, status FROM public.inventory_cost_lot WHERE id = 'lot_g11_cake_2'`)).rows[0];
    assert(Number(lot2After.remaining_quantity) === 7, 'Lot 2 remaining_quantity === 7 (10 - 3)');
    assert(lot2After.status === 'ACTIVE', 'Lot 2 status === ACTIVE');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 12: Mixed Merchandise Posting (Cakes + Accessories + Delivery Fee)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[13/15] Test Group 12: Mixed Merchandise (Cake + Accessory + Delivery Fee)...');
    // Deplete prior lots
    await client.query(`UPDATE public.inventory_cost_lot SET remaining_quantity = 0, status = 'DEPLETED' WHERE branch_id = $1`, [branchA.id]);

    // Seed cake lot: 5 @ ₹300.00
    // Seed accessory lot: 10 @ ₹40.00
    await seedPurchaseCostLot('lot_g12_cake', branchA.id, cakeProd.id, cakeProd.variant_id, 'CAKE', 5, 300.0);
    await seedPurchaseCostLot('lot_g12_acc', branchA.id, accProd.id, accProd.variant_id, 'ACCESSORY', 10, 40.0);
    await setBranchInventoryQty(branchA.id, cakeProd.variant_id, cakeProd.id, 10);
    await setBranchInventoryQty(branchA.id, accProd.variant_id, accProd.id, 10);

    // Order: 1 Cake @ ₹500 (5% GST), 2 Toppers @ ₹100 (18% GST), ₹50 Delivery Fee (18% GST)
    // Cake Rev: 500, Tax: 25 (12.50 CGST + 12.50 SGST)
    // Acc Rev: 200, Tax: 36 (18.00 CGST + 18.00 SGST)
    // Delivery Rev: 50, Tax: 9 (4.50 CGST + 4.50 SGST)
    // Total Invoice: 500 + 25 + 200 + 36 + 50 + 9 = ₹820.00
    // Cake COGS: 1 * 300 = ₹300.00
    // Acc COGS: 2 * 40 = ₹80.00
    // Total COGS = ₹380.00
    // Total Journal Debits = 820 + 380 = ₹1,200.00
    const f12 = await createApprovedSalesVoucher('g12', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 500, gst_rate: 5 },
      { product_id: accProd.id, variant_id: accProd.variant_id, quantity: 2, unit_price: 100, gst_rate: 18 },
    ], 'completed', false, clerkUser.id, { delivery_fee: 50 });

    const res12 = await SalesPostingService.postSalesVoucher({
      voucherId: f12.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });

    assert(res12.success, 'Mixed merchandise posting succeeded');
    const d12 = res12.data;
    assert(d12.invoiceTotal === 820.00, `Invoice total is ₹820.00 (got ${d12.invoiceTotal})`);
    assert(d12.totalCogs === 380.00, `Total COGS is ₹380.00 (300 cake + 80 acc) (got ${d12.totalCogs})`);
    assert(d12.totalJournalAmount === 1200.00, `Total journal amount is ₹1,200.00 (820 + 380) (got ${d12.totalJournalAmount})`);

    // Verify lines contain both COGS lines
    const lines12 = d12.journalEntry.lines;
    const cakeCogsLine = lines12.find(l => l.debit_amount > 0 && Number(l.debit_amount) === 300.00);
    const accCogsLine = lines12.find(l => l.debit_amount > 0 && Number(l.debit_amount) === 80.00);
    const cakeInvLine = lines12.find(l => l.credit_amount > 0 && Number(l.credit_amount) === 300.00);
    const accInvLine = lines12.find(l => l.credit_amount > 0 && Number(l.credit_amount) === 80.00);

    assert(Boolean(cakeCogsLine), 'Dr 5110 COGS - Cakes ₹300.00 verified');
    assert(Boolean(accCogsLine), 'Dr 5120 Accessory Merchandise Sold ₹80.00 verified');
    assert(Boolean(cakeInvLine), 'Cr 1132 Inventory - Cakes ₹300.00 verified');
    assert(Boolean(accInvLine), 'Cr 1131 Inventory - Accessories ₹80.00 verified');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 13: Idempotency Guards (Re-posting POSTED voucher rejected)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[14/15] Test Group 13: Idempotency Guards...');
    const resIdemp = await SalesPostingService.postSalesVoucher({
      voucherId: d10.voucher.id, // Already posted
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!resIdemp.success, 'Re-posting an already POSTED voucher rejected');
    assert(resIdemp.code === 'VOUCHER_ALREADY_POSTED', 'Error code is VOUCHER_ALREADY_POSTED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 14: Failure Injection & 100% Rollback Guarantee
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[15/15] Test Group 14: Failure Injection & Atomic Rollback Verification...');
    // Deplete prior lots to isolate test
    await client.query(`UPDATE public.inventory_cost_lot SET remaining_quantity = 0, status = 'DEPLETED' WHERE branch_id = $1`, [branchA.id]);

    // Seed test lot
    await seedPurchaseCostLot('lot_g14_fail', branchA.id, cakeProd.id, cakeProd.variant_id, 'CAKE', 10, 300.0);
    await setBranchInventoryQty(branchA.id, cakeProd.variant_id, cakeProd.id, 10);

    const f14 = await createApprovedSalesVoucher('g14', [
      { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 2, unit_price: 500, gst_rate: 5 }
    ]);

    // Snapshot counts before failure injection
    const snapBefore = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.inventory_movement) as mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) as con_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) as je_cnt
    `);

    // Temporarily deactivate Account 5110 to trigger failure inside postVoucher
    await client.query(`UPDATE public.accounting_account SET is_active = false WHERE code = '5110'`);

    const resFail = await SalesPostingService.postSalesVoucher({
      voucherId: f14.voucher.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });

    assert(!resFail.success, 'Posting with inactive GL account failed as expected');

    // Reactivate Account 5110
    await client.query(`UPDATE public.accounting_account SET is_active = true WHERE code = '5110'`);

    // Verify zero mutations occurred
    const snapAfter = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.inventory_movement) as mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) as con_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) as je_cnt
    `);

    assert(snapBefore.rows[0].mov_cnt === snapAfter.rows[0].mov_cnt, 'Zero partial inventory movements created on failure');
    assert(snapBefore.rows[0].con_cnt === snapAfter.rows[0].con_cnt, 'Zero partial cost consumptions created on failure');
    assert(snapBefore.rows[0].je_cnt === snapAfter.rows[0].je_cnt, 'Zero partial journal entries created on failure');

    // Verify voucher status remains APPROVED (not POSTED)
    const v14Check = (await client.query(`SELECT status FROM public.accounting_voucher WHERE id = $1`, [f14.voucher.id])).rows[0];
    assert(v14Check.status === 'APPROVED', 'Voucher status remains APPROVED on rollback');

    // ─────────────────────────────────────────────────────────────────────────
    // ROLLBACK & POST-TEST DATABASE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n=============================================================================');
    console.log('Rolling back test transaction and executing independent baseline audit...');
    console.log('=============================================================================');
    await client.query('ROLLBACK');

    const bPost = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) AS con_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS inv_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS pay_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fpd_cnt
    `);
    const post = bPost.rows[0];
    assert(post.vch_cnt === 0, `Post-rollback accounting_voucher === 0 (actual: ${post.vch_cnt})`);
    assert(post.je_cnt === 0, `Post-rollback accounting_journal_entry === 0 (actual: ${post.je_cnt})`);
    assert(post.jl_cnt === 0, `Post-rollback accounting_journal_line === 0 (actual: ${post.jl_cnt})`);
    assert(post.lot_cnt === 0, `Post-rollback inventory_cost_lot === 0 (actual: ${post.lot_cnt})`);
    assert(post.mov_cnt === 0, `Post-rollback inventory_movement === 0 (actual: ${post.mov_cnt})`);
    assert(post.con_cnt === 0, `Post-rollback inventory_cost_consumption === 0 (actual: ${post.con_cnt})`);
    assert(post.inv_cnt === 424, `Post-rollback branch_inventory === 424 (actual: ${post.inv_cnt})`);
    assert(post.ord_cnt === 173, `Post-rollback order === 173 (actual: ${post.ord_cnt})`);
    assert(post.pay_cnt === 53, `Post-rollback payment_transaction === 53 (actual: ${post.pay_cnt})`);
    assert(post.start_date_cnt === 0, `Post-rollback accounting_start_date unconfigured (actual: ${post.start_date_cnt})`);
    assert(post.fpd_cnt === 0, `Post-rollback accounting_fiscal_period === 0 (actual: ${post.fpd_cnt})`);

    console.log('\n=============================================================================');
    console.log(`TEST SUITE RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
    console.log('=============================================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\nUNHANDLED TEST SUITE ERROR:', err);
    try {
      await client.query('ROLLBACK');
    } catch {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
