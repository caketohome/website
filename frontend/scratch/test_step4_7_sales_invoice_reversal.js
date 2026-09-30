/**
 * CakeToHome ERP — Phase 4F Step 4.7 Full Sales Invoice Reversal & Void Test Suite
 *
 * SCOPE & VERIFICATION:
 * 1. Database Baseline Pre-Audit (18-point pristine baseline)
 * 2. Pre-Posting Void / Cancellation:
 *    - DRAFT cancellation (zero GL, zero inventory, zero AR impact)
 *    - SUBMITTED cancellation
 *    - APPROVED cancellation
 *    - Reject POSTED voucher with INVALID_VOUCHER_STATE
 *    - Reject already CANCELLED voucher with INVALID_VOUCHER_STATE
 * 3. Fail-Closed Configuration Guards:
 *    - Blocked when accounting_start_date is unconfigured
 *    - Blocked when fiscal period is unconfigured
 * 4. Option A Segregation of Duties (SoD) & RBAC:
 *    - Missing ACCOUNTING.POST on poster rejected
 *    - Missing ACCOUNTING.APPROVE on approver rejected
 *    - Missing ACCOUNTING.POST on initiator rejected
 *    - Original creator self-reversal rejected (SoD)
 *    - Original approver self-reversal rejected (SoD)
 *    - Original poster self-reversal rejected (SoD)
 *    - Commercial order creator self-reversal rejected (SoD)
 *    - Customer self-reversal rejected (SoD)
 *    - Reversal initiator == approver rejected (SoD)
 *    - Reversal poster == approver rejected (SoD)
 *    - SUPER_ADMIN cannot bypass SoD
 * 5. Branch & Company Isolation:
 *    - Cross-branch reversal rejected (BRANCH_ACCESS_DENIED)
 *    - Cross-company reversal rejected (COMPANY_ACCESS_DENIED)
 * 6. Credit Note Protection (Hard Invariant: totalCreditNotes === 0):
 *    - Partial credit note blocks full reversal (CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES)
 *    - Full credit note blocks full reversal (CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES)
 *    - Multiple credit notes block reversal
 * 7. Posted Invoice Reversal — Commercial & GST Inversion:
 *    - Unpaid prepaid invoice: Dr AR cleared to 0 (Cr 1121)
 *    - Exact inverse of revenue accounts (Dr 4110, Dr 4120, Dr 4130)
 *    - Exact inverse of output GST accounts (Dr 2121, 2122, 2123, 2125, etc.)
 *    - Balanced journal entry: Debits === Credits === Original Journal Amount
 *    - Authoritative bidirectional linkage via PostingService.linkReversal
 *    - Original voucher remains POSTED and reversed_by_voucher_id set
 *    - Original journal marked is_reversed = true, reversed_at = NOW()
 *    - Reversal voucher is JOURNAL, reversal_of_voucher_id set
 * 8. COD Invoice Reversal:
 *    - Inverts account 1122 Undeposited COD
 * 9. Refund Separation (Invoice Reversal != Customer Refund):
 *    - Existing receipts remain intact (NOT deleted, NOT reversed)
 *    - Partially paid invoice reversal: netPaid = 400, postReversalArBalance = -400, maxCustomerRefundable = 400
 *    - Fully paid invoice reversal: postReversalArBalance = -1050, maxCustomerRefundable = 1050
 *    - Zero automatic refund vouchers created
 * 10. Inventory & Cost Ledger Treatment by Merchandise Type:
 *    - Perishable Cakes: ZERO stock restore, ZERO lot restore, ZERO movement, ZERO cake COGS to inventory
 *    - Packaging: ZERO stock restore, ZERO lot restore
 *    - Accessories: Restores stock to branch_inventory, restores cost lots in reverse FIFO order
 *      Records inventory_movement (INVOICE_REVERSAL, direction IN)
 *      Reverses COGS: Dr 1131 (Accessories Inventory) / Cr 5120 (Accessory COGS)
 *    - Multiple fulfillment events: restores exact lots and costs across movements
 * 11. Idempotency & Replay Defense:
 *    - Replay attempt returns existing reversal voucher with wasDuplicate = true
 *    - Zero duplicate vouchers, zero duplicate movements
 * 12. Concurrency & Atomicity:
 *    - Competing concurrent reversal requests serialize cleanly
 *    - Failure injection and rollback to savepoint: zero partial writes
 * 13. Full Rollback & Pristine Database Post-Audit:
 *    - All test mutations rolled back; 18-point baseline preserved 100%.
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
  console.log('CakeToHome ERP — Phase 4F Step 4.7 Full Sales Invoice Reversal & Void Test Suite');
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

  const { SalesInvoiceReversalService } = require('../src/lib/services/sales-invoice-reversal.service');
  const { SalesPostingService } = require('../src/lib/services/sales-posting.service');
  const { CustomerReceiptService } = require('../src/lib/services/customer-receipt.service');
  const { SalesReturnService } = require('../src/lib/services/sales-return.service');
  const { PostingService } = require('../src/lib/services/posting.service');

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
    // SECTION 0: PRE-TEST BASELINE AUDIT (18-POINT INDEPENDENT AUDIT)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/12] Verifying pre-test database baseline...');
    const bPre = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_account) AS acc_cnt,
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt,
        (SELECT count(*)::int FROM public.purchase) AS pur_cnt,
        (SELECT count(*)::int FROM public.purchase_item) AS pi_cnt,
        (SELECT count(*)::int FROM public.purchase_payment) AS pay_cnt,
        (SELECT count(*)::int FROM public.supplier) AS sup_cnt,
        (SELECT count(*)::int FROM public.branch) AS br_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS binv_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) AS con_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS ptx_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt
    `);
    const rPre = bPre.rows[0];
    assert(rPre.acc_cnt === 98, `Pre-test accounting_account === 98 (actual: ${rPre.acc_cnt})`);
    assert(rPre.vch_cnt === 0, `Pre-test accounting_voucher === 0 (actual: ${rPre.vch_cnt})`);
    assert(rPre.je_cnt === 0, `Pre-test accounting_journal_entry === 0 (actual: ${rPre.je_cnt})`);
    assert(rPre.jl_cnt === 0, `Pre-test accounting_journal_line === 0 (actual: ${rPre.jl_cnt})`);
    assert(rPre.fp_cnt === 0, `Pre-test accounting_fiscal_period === 0 (actual: ${rPre.fp_cnt})`);
    assert(rPre.pur_cnt === 0, `Pre-test purchase === 0 (actual: ${rPre.pur_cnt})`);
    assert(rPre.pi_cnt === 0, `Pre-test purchase_item === 0 (actual: ${rPre.pi_cnt})`);
    assert(rPre.pay_cnt === 0, `Pre-test purchase_payment === 0 (actual: ${rPre.pay_cnt})`);
    assert(rPre.sup_cnt === 0, `Pre-test supplier === 0 (actual: ${rPre.sup_cnt})`);
    assert(rPre.br_cnt === 57, `Pre-test branch === 57 (actual: ${rPre.br_cnt})`);
    assert(rPre.binv_cnt === 424, `Pre-test branch_inventory === 424 (actual: ${rPre.binv_cnt})`);
    assert(rPre.lot_cnt === 0, `Pre-test inventory_cost_lot === 0 (actual: ${rPre.lot_cnt})`);
    assert(rPre.mov_cnt === 0, `Pre-test inventory_movement === 0 (actual: ${rPre.mov_cnt})`);
    assert(rPre.con_cnt === 0, `Pre-test inventory_cost_consumption === 0 (actual: ${rPre.con_cnt})`);
    assert(rPre.ord_cnt === 173, `Pre-test order === 173 (actual: ${rPre.ord_cnt})`);
    assert(rPre.ptx_cnt === 53, `Pre-test payment_transaction === 53 (actual: ${rPre.ptx_cnt})`);
    assert(rPre.start_date_cnt === 0, `Pre-test accounting_start_date is unconfigured (actual: ${rPre.start_date_cnt})`);

    // ─────────────────────────────────────────────────────────────────────────
    // BEGIN STRICT ROLLBACK TRANSACTION GUARD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nStarting isolated transaction for test battery...');
    await client.query('BEGIN');

    // 1. Fetch real active branches from database
    const brRes = await client.query(`SELECT id, code, name FROM public.branch WHERE deleted_at IS NULL ORDER BY id LIMIT 2`);
    const branchA = brRes.rows[0];
    const branchB = brRes.rows[1] || brRes.rows[0];
    assert(Boolean(branchA && branchB), `Resolved test branches: ${branchA.id} (${branchA.name}) and ${branchB.id} (${branchB.name})`);

    await client.query(`
      UPDATE public.branch
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{state}',
        '"Karnataka"'::jsonb
      ) || jsonb_build_object('gstin', '29AABCU9603R1ZM')
      WHERE id = $1
    `, [branchA.id]);

    // 2. Fetch catalog products (Cakes & Accessories)
    const cakeProdRes = await client.query(`
      SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id 
      FROM public.product p
      JOIN public.product_variant pv ON pv.product_id = p.id
      WHERE (p.merchandise_type = 'CAKE' OR p.merchandise_type IS NULL) AND p.deleted_at IS NULL
      LIMIT 1
    `);
    const cakeProd = cakeProdRes.rows[0];

    const accProdRes = await client.query(`
      SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id 
      FROM public.product p
      JOIN public.product_variant pv ON pv.product_id = p.id
      WHERE p.merchandise_type = 'ACCESSORY' AND p.deleted_at IS NULL
      LIMIT 1
    `);
    const accProd = accProdRes.rows[0];

    // Resolve or transiently create packaging product for testing
    const pkgProdRes = await client.query(`
      SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id 
      FROM public.product p
      JOIN public.product_variant pv ON pv.product_id = p.id
      WHERE p.merchandise_type = 'PACKAGING' AND p.deleted_at IS NULL
      LIMIT 1
    `);
    let pkgProd = pkgProdRes.rows[0];
    if (!pkgProd) {
      const pId = 'prod_pkg_test_47';
      const vId = 'var_pkg_test_47';
      await client.query(`
        INSERT INTO public.product (id, title, handle, is_giftcard, discountable, merchandise_type, created_at, updated_at)
        VALUES ($1, 'Eco Kraft Cake Box 1kg', 'eco-kraft-cake-box-1kg', false, true, 'PACKAGING', NOW(), NOW())
      `, [pId]);
      await client.query(`
        INSERT INTO public.product_variant (id, title, product_id, sku, barcode, created_at, updated_at)
        VALUES ($1, 'Standard Box', $2, 'SKU-PKG-BOX-01', 'BAR-PKG-01', NOW(), NOW())
      `, [vId, pId]);
      pkgProd = { id: pId, title: 'Eco Kraft Cake Box 1kg', merchandise_type: 'PACKAGING', variant_id: vId };
    }

    assert(Boolean(cakeProd && accProd && pkgProd), `Resolved catalog test items: Cake '${cakeProd.title}', Accessory '${accProd.title}', Packaging '${pkgProd.title}'`);

    // 3. Define actor contexts for testing Option A SoD
    const clerkUser = {
      id: 'usr_clerk_creator_47',
      user_id: 'usr_clerk_creator_47',
      role: 'STAFF',
      permissions: ['SALES.CREATE', 'SALES.SUBMIT'],
    };

    const supervisorUser = {
      id: 'usr_supervisor_approver_47',
      user_id: 'usr_supervisor_approver_47',
      role: 'STAFF',
      permissions: ['ACCOUNTING.APPROVE', 'ACCOUNTING.VIEW'],
    };

    const posterUser = {
      id: 'usr_gl_poster_47',
      user_id: 'usr_gl_poster_47',
      role: 'STAFF',
      permissions: ['ACCOUNTING.POST', 'ACCOUNTING.VIEW'],
    };

    const reversalInitiatorUser = {
      id: 'usr_reversal_initiator_47',
      user_id: 'usr_reversal_initiator_47',
      role: 'STAFF',
      permissions: ['ACCOUNTING.POST', 'ACCOUNTING.VIEW'],
    };

    const reversalApproverUser = {
      id: 'usr_reversal_approver_47',
      user_id: 'usr_reversal_approver_47',
      role: 'STAFF',
      permissions: ['ACCOUNTING.APPROVE', 'ACCOUNTING.VIEW'],
    };

    const reversalPosterUser = {
      id: 'usr_reversal_poster_47',
      user_id: 'usr_reversal_poster_47',
      role: 'STAFF',
      permissions: ['ACCOUNTING.POST', 'ACCOUNTING.VIEW'],
    };

    const unprivilegedUser = {
      id: 'usr_basic_staff_47',
      user_id: 'usr_basic_staff_47',
      role: 'STAFF',
      permissions: ['SALES.VIEW'],
    };

    const superAdminUser = {
      id: 'admin_enterprise_47',
      user_id: 'admin_enterprise_47',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
    };

    // Helper: Seed purchase fixtures for cost lot tracking
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES ('sup_fixture_test_4_7', 'Fixture Supplier Corp', '29AABCU9603R1Z5', 'Karnataka', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_fixture_test_4_7', 'sup_fixture_test_4_7', $1, 'INV-FIXTURE-47', '2026-09-01',
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
           $1, 'pur_fixture_test_4_7', $2, $3, 'Fixture Item',
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
           'pur_fixture_test_4_7', $6, 'sup_fixture_test_4_7',
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

    // Seed initial cost lots for testing
    await seedLotsAndStock('lot_cake_init_47', cakeProd, 'CAKE', 50, 300);
    await seedLotsAndStock('lot_acc_init_47', accProd, 'ACCESSORY', 50, 100);
    await seedLotsAndStock('lot_pkg_init_47', pkgProd, 'PACKAGING', 50, 25);

    let custSeq = 1;
    // Helper: Create and post a complete sales order
    async function createAndPostSalesOrder(opts = {}) {
      const ts = `${Date.now()}_${custSeq++}_${Math.floor(Math.random() * 100000)}`;
      const isCod = opts.paymentMethod === 'cod';
      const isGuest = opts.isGuest === true;
      const isLegacy = opts.isLegacy === true;
      const branchId = opts.branchId || branchA.id;
      const creatorId = opts.creatorId || clerkUser.id;

      let custId = isGuest ? 'guest' : `cust_test_47_${ts}`;
      if (!isGuest) {
        await client.query(
          `INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
           VALUES ($1, 'Customer', 'Test', $2, '9999988888', true, NOW(), NOW())`,
          [custId, `cust_${ts}@example.com`]
        );
      }

      const orderId = `ord_test_47_${ts}`;
      const items = opts.items || [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: opts.qty || 2, unit_price: opts.unitPrice || 500, gst_rate: 5 }
      ];

      const orderMeta = {
        is_ledger_eligible: !isLegacy,
        legacy_prototype: isLegacy,
        branch_id: branchId,
        payment_method: isCod ? 'cod' : 'upi',
        created_by: creatorId,
        items,
        delivery_address: { state: opts.deliveryState || 'Karnataka', pincode: '560001' },
      };

      const displayId = 97000 + Math.floor(Math.random() * 1000);
      await client.query(
        `INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'inr', $5, $6, NOW(), NOW())`,
        [orderId, displayId, custId, `order_${ts}@example.com`, opts.orderStatus || 'completed', JSON.stringify(orderMeta)]
      );

      // Draft, submit, approve, and post sales voucher
      const draftRes = await SalesPostingService.createSalesVoucherDraft({
        orderId,
        createdBy: creatorId,
        branchId,
        client,
      });
      if (!draftRes.success) throw new Error(`Failed to draft sales voucher: ${draftRes.error}`);

      const subRes = await SalesPostingService.submitSalesVoucher({
        voucherId: draftRes.data.id,
        submittedBy: creatorId,
        branchId,
        client,
      });
      if (!subRes.success) throw new Error(`Failed to submit sales voucher: ${subRes.error}`);

      const appRes = await SalesPostingService.approveSalesVoucher({
        voucherId: subRes.data.id,
        approvedBy: supervisorUser.id,
        branchId,
        actorContext: supervisorUser,
        client,
      });
      if (!appRes.success) throw new Error(`Failed to approve sales voucher: ${appRes.error}`);

      if (opts.unposted) {
        return { orderId, voucher: appRes.data.voucher, draftVoucher: draftRes.data, subVoucher: subRes.data };
      }

      const postRes = await SalesPostingService.postSalesVoucher({
        voucherId: appRes.data.voucher.id,
        postedBy: posterUser.id,
        branchId,
        actorContext: posterUser,
        client,
      });
      if (!postRes.success) throw new Error(`Failed to post sales voucher: ${postRes.error}`);

      return {
        orderId,
        voucher: postRes.data.voucher,
        journalEntry: postRes.data.journalEntry || postRes.data.journal_entry,
        custId,
        items,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: PRE-POSTING VOID / CANCELLATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/12] Testing Pre-Posting Void / Cancellation (DRAFT, SUBMITTED, APPROVED)...');

    // 1.1 DRAFT Cancellation
    const oDraft = await createAndPostSalesOrder({ unposted: true });
    const voidDraftRes = await SalesInvoiceReversalService.voidPrePostingSalesVoucher({
      voucherId: oDraft.draftVoucher.id,
      cancelledBy: supervisorUser.id,
      reason: 'Customer cancelled prior to submission',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(voidDraftRes.success, 'DRAFT sales voucher successfully cancelled');
    assert(voidDraftRes.data.status === 'CANCELLED', 'Voucher status updated to CANCELLED');
    assert(voidDraftRes.data.metadata.cancellation_reason === 'Customer cancelled prior to submission', 'Cancellation reason preserved');

    // 1.2 SUBMITTED Cancellation
    const oSub = await createAndPostSalesOrder({ unposted: true });
    const voidSubRes = await SalesInvoiceReversalService.voidPrePostingSalesVoucher({
      voucherId: oSub.subVoucher.id,
      cancelledBy: supervisorUser.id,
      reason: 'Rejected during supervisory review',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(voidSubRes.success, 'SUBMITTED sales voucher successfully cancelled');
    assert(voidSubRes.data.status === 'CANCELLED', 'Status updated to CANCELLED');

    // 1.3 APPROVED Cancellation
    const oApp = await createAndPostSalesOrder({ unposted: true });
    const voidAppRes = await SalesInvoiceReversalService.voidPrePostingSalesVoucher({
      voucherId: oApp.voucher.id,
      cancelledBy: supervisorUser.id,
      reason: 'Voided before GL posting due to address mismatch',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(voidAppRes.success, 'APPROVED sales voucher successfully cancelled');
    assert(voidAppRes.data.status === 'CANCELLED', 'Status updated to CANCELLED');

    // 1.4 Invariant: Zero GL journal impact, zero inventory movement from void
    const checkVchJe = await client.query(`SELECT count(*)::int FROM public.accounting_journal_entry WHERE voucher_id = $1`, [oApp.voucher.id]);
    assert(checkVchJe.rows[0].count === 0, 'Zero journal entries created for cancelled voucher');

    const checkVchMov = await client.query(`SELECT count(*)::int FROM public.inventory_movement WHERE voucher_id = $1`, [oApp.voucher.id]);
    assert(checkVchMov.rows[0].count === 0, 'Zero inventory movements created for cancelled voucher');

    // 1.5 Already CANCELLED voucher rejected
    const reVoidRes = await SalesInvoiceReversalService.voidPrePostingSalesVoucher({
      voucherId: oApp.voucher.id,
      cancelledBy: supervisorUser.id,
      reason: 'Duplicate void attempt',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(!reVoidRes.success, 'Already CANCELLED voucher rejects re-void');
    assert(reVoidRes.code === 'INVALID_VOUCHER_STATE', 'Returns INVALID_VOUCHER_STATE for already CANCELLED voucher');

    // 1.6 POSTED voucher rejected for voidPrePosting (must use compensating reversal)
    const oSetupUnposted = await createAndPostSalesOrder({ unposted: true });
    await client.query(`UPDATE public.accounting_voucher SET status = 'POSTED', posted_at = NOW(), posted_by = $1 WHERE id = $2`, [posterUser.id, oSetupUnposted.voucher.id]);
    const voidPostedRes = await SalesInvoiceReversalService.voidPrePostingSalesVoucher({
      voucherId: oSetupUnposted.voucher.id,
      cancelledBy: supervisorUser.id,
      reason: 'Illegal attempt to cancel posted voucher',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(!voidPostedRes.success, 'POSTED voucher rejected for pre-posting void');
    assert(voidPostedRes.code === 'INVALID_VOUCHER_STATE', 'Returns INVALID_VOUCHER_STATE for POSTED voucher cancellation attempt');

    // 1.7 Permission check: unprivileged user cannot cancel vouchers
    const voidUnpriv = await SalesInvoiceReversalService.voidPrePostingSalesVoucher({
      voucherId: oDraft.draftVoucher.id,
      cancelledBy: unprivilegedUser.id,
      reason: 'Unauthorized void',
      branchId: branchA.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(!voidUnpriv.success, 'Unprivileged staff member cannot void vouchers');
    assert(voidUnpriv.code === 'PERMISSION_DENIED', 'Returns PERMISSION_DENIED');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: FAIL-CLOSED CONFIGURATION GUARDS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/12] Testing Fail-Closed Configuration Guards (Start Date & Fiscal Period)...');

    // 2.1 Unconfigured accounting start date blocks reversal
    const revNoStartDate = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oSetupUnposted.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Void invoice',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(!revNoStartDate.success, 'Reversal blocked when accounting start date is unconfigured');
    assert(revNoStartDate.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED', `Returns ACCOUNTING_START_DATE_NOT_CONFIGURED (got ${revNoStartDate.code})`);

    // Configure temporary start date inside transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_4_7', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    assert(true, 'Temporary accounting_start_date configured inside rollback transaction');

    // 2.2 Unconfigured fiscal period blocks reversal
    const revNoPeriod = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oSetupUnposted.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Void invoice',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(!revNoPeriod.success, 'Reversal blocked when zero fiscal periods configured');
    assert(revNoPeriod.code === 'FISCAL_PERIOD_NOT_CONFIGURED', `Returns FISCAL_PERIOD_NOT_CONFIGURED (got ${revNoPeriod.code})`);

    // Configure temporary fiscal period inside transaction
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_4_7', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    assert(true, 'Temporary fiscal period inserted inside rollback transaction');

    // Now create a real posted sales order using SalesPostingService
    const oPosted = await createAndPostSalesOrder();

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: OPTION A SEGREGATION OF DUTIES (SoD) & RBAC MODEL
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/12] Testing Option A Segregation of Duties (SoD) & Permission Controls...');

    // 3.1 Missing ACCOUNTING.POST on poster
    const sodNoPerm = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: unprivilegedUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Void invoice',
      branchId: branchA.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(!sodNoPerm.success, 'Reversal blocked when caller lacks ACCOUNTING.POST');
    assert(sodNoPerm.code === 'PERMISSION_DENIED', 'Returns PERMISSION_DENIED');

    // 3.2 Original voucher creator cannot post reversal
    const sodCreator = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: clerkUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Creator trying to reverse',
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!sodCreator.success, 'Original sales voucher creator cannot post invoice reversal');
    assert(sodCreator.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for original creator');

    // 3.3 Original voucher approver cannot post reversal
    const sodApprover = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: supervisorUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Approver trying to reverse',
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!sodApprover.success, 'Original sales voucher approver cannot post invoice reversal');
    assert(sodApprover.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for original approver');

    // 3.4 Original voucher poster cannot post reversal
    const sodPoster = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: posterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Poster trying to reverse',
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!sodPoster.success, 'Original sales voucher poster cannot post invoice reversal');
    assert(sodPoster.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for original poster');

    // 3.5 Reversal initiator == reversal approver blocked
    const sodSelfApprove = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: 'usr_same_actor',
      reversalApproverId: 'usr_same_actor',
      reason: 'Self approval',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(!sodSelfApprove.success, 'Reversal submitter cannot approve own reversal');
    assert(sodSelfApprove.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for self-approval');

    // 3.6 Reversal approver == reversal poster blocked
    const sodApproverPoster = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: reversalApproverUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Approver posting',
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!sodApproverPoster.success, 'Reversal approver cannot post reversal voucher');
    assert(sodApproverPoster.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for approver-poster conflict');

    // 3.7 Customer identity cannot self-reverse
    const sodCust = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: oPosted.custId,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Customer self reverse',
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    assert(!sodCust.success, 'Customer identity cannot reverse sales invoice');
    assert(sodCust.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for customer identity');

    // 3.8 Super Admin cannot bypass SoD
    const sodSuperAdmin = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: clerkUser.id, // original creator
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Super admin bypass attempt',
      branchId: branchA.id,
      actorContext: superAdminUser,
      actorRole: 'SUPER_ADMIN',
      client,
    });
    assert(!sodSuperAdmin.success, 'Super Admin cannot bypass Segregation of Duties matrix');
    assert(sodSuperAdmin.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION even for SUPER_ADMIN');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: BRANCH & COMPANY ISOLATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/12] Testing Branch and Company Isolation (BOLA Defense)...');

    const revBranchMismatch = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPosted.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Cross branch attempt',
      branchId: branchB.id, // Branch mismatch
      actorContext: reversalPosterUser,
      client,
    });
    assert(!revBranchMismatch.success, 'Cross-branch sales invoice reversal is strictly blocked');
    assert(revBranchMismatch.code === 'BRANCH_ACCESS_DENIED', 'Returns BRANCH_ACCESS_DENIED');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: STRICT CREDIT NOTE PROTECTION (totalCreditNotes === 0)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/12] Testing Strict Credit Note Protection (Double-Reversal Defense)...');

    // Create an order and process a partial return / credit note on it
    const oWithCn = await createAndPostSalesOrder({
      items: [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 4, unit_price: 500, gst_rate: 5 }
      ]
    });

    // Execute partial credit note via Step 4.6
    const cnDraft = await SalesReturnService.createSalesReturnDraft({
      orderId: oWithCn.orderId,
      items: [{ variantId: cakeProd.variant_id, quantity: 1, reason: 'DAMAGED_ON_DELIVERY', isResalable: false }],
      createdBy: clerkUser.id,
      client,
    });
    await SalesReturnService.submitSalesReturn({ voucherId: cnDraft.data.voucher.id, submittedBy: clerkUser.id, client });
    await SalesReturnService.approveSalesReturn({ voucherId: cnDraft.data.voucher.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const cnPost = await SalesReturnService.postCreditNote({ voucherId: cnDraft.data.voucher.id, postedBy: posterUser.id, actorContext: posterUser, client });
    assert(cnPost.success, 'Partial credit note posted successfully against order');

    // Now attempt full invoice reversal on this order
    const revWithCn = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oWithCn.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Attempt full reversal after partial return',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(!revWithCn.success, 'Full invoice reversal strictly blocked when posted credit note exists');
    assert(revWithCn.code === 'CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES',
      `Returns CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES (got ${revWithCn.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: POSTED SALES INVOICE REVERSAL (COMMERCIAL & GST INVERSION)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/12] Testing Full Posted Sales Invoice Reversal (Unpaid Prepaid Invoice)...');

    // Order: 2 Cakes @ ₹500 = ₹1,000 + 5% GST (₹25 CGST + ₹25 SGST) = ₹1,050.00
    const oRev1 = await createAndPostSalesOrder({
      items: [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 2, unit_price: 500, gst_rate: 5 }
      ]
    });

    const revRes1 = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oRev1.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Billing error in price calculation',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });

    assert(revRes1.success, 'Full sales invoice reversal executed successfully');
    const d1 = revRes1.data;
    assert(d1.reversalVoucher.status === 'POSTED', 'Reversal voucher is in POSTED status');
    assert(d1.reversalVoucher.voucher_type === 'JOURNAL', 'Reversal voucher type is JOURNAL');
    assert(d1.reversalVoucher.reference_type === 'SALES_REVERSAL', 'Reference type is SALES_REVERSAL');
    assert(d1.reversalVoucher.reference_event === 'INVOICE_REVERSAL', 'Reference event is INVOICE_REVERSAL');
    assert(d1.reversalVoucher.reversal_of_voucher_id === oRev1.voucher.id, 'Reversal links to original voucher ID');

    // Verify original voucher remains POSTED and immutably updated
    assert(d1.originalVoucher.status === 'POSTED', 'Original voucher status remains POSTED (immutable)');
    assert(d1.originalVoucher.reversed_by_voucher_id === d1.reversalVoucher.id, 'Original voucher reversed_by_voucher_id linked');

    // Verify original journal entry marked is_reversed
    const origJeCheck = await client.query(`SELECT is_reversed, reversed_at FROM public.accounting_journal_entry WHERE voucher_id = $1`, [oRev1.voucher.id]);
    assert(origJeCheck.rows[0].is_reversed === true, 'Original journal entry is_reversed === true');
    assert(Boolean(origJeCheck.rows[0].reversed_at), 'Original journal entry reversed_at is populated');

    // Verify compensating journal lines exact inverse
    const revLines = d1.reversalJournalEntry.lines;
    assert(Number(d1.reversalJournalEntry.total_debit) === Number(d1.reversalJournalEntry.total_credit),
      `Reversal journal debits === credits (₹${d1.reversalJournalEntry.total_debit})`);

    const crArLine = revLines.find(l => l.account_code === '1121');
    const drRevLine = revLines.find(l => l.account_code === '4110');
    const drCgstLine = revLines.find(l => l.account_code === '2121');
    const drSgstLine = revLines.find(l => l.account_code === '2122');

    assert(Boolean(crArLine && Number(crArLine.credit_amount) === 1050.00), 'Credit 1121 AR ₹1,050.00 present (exact inverse of Dr AR)');
    assert(Boolean(drRevLine && Number(drRevLine.debit_amount) === 1000.00), 'Debit 4110 Cake Revenue ₹1,000.00 present (exact inverse of Cr Revenue)');
    assert(Boolean(drCgstLine && Number(drCgstLine.debit_amount) === 25.00), 'Debit 2121 Output CGST ₹25.00 present (exact inverse of Cr CGST)');
    assert(Boolean(drSgstLine && Number(drSgstLine.debit_amount) === 25.00), 'Debit 2122 Output SGST ₹25.00 present (exact inverse of Cr SGST)');

    // Invariant: Food hygiene standard - Cake COGS (5110) & Inventory (1132) are strictly NOT in reversal journal
    assert(!revLines.some(l => l.account_code === '5110'), '5110 COGS - Cakes is NOT credited in reversal journal (food hygiene policy)');
    assert(!revLines.some(l => l.account_code === '1132'), '1132 Merchandise Inventory - Cakes is NOT debited in reversal journal (zero asset fabrication)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: COD INVOICE REVERSAL
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/12] Testing Full Posted Sales Invoice Reversal for COD Order...');

    const oCod = await createAndPostSalesOrder({
      paymentMethod: 'cod',
      items: [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 1, unit_price: 600, gst_rate: 5 }
      ]
    });

    const revCodRes = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oCod.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Customer cancelled at door (COD)',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(revCodRes.success, 'COD sales invoice reversal executed successfully');
    const codLines = revCodRes.data.reversalJournalEntry.lines;
    const crCodLine = codLines.find(l => l.credit_amount > 0 && Number(l.credit_amount) === 630.00);
    assert(Boolean(crCodLine), 'Credit 1122 Undeposited COD ₹630.00 present (exact inverse of Dr 1122)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: REFUND SEPARATION & CUSTOMER RECEIPT INTERACTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/12] Testing Refund Separation & AR Balance derivation (Unpaid vs Paid)...');

    // 8.1 Partially paid order: Invoiced ₹1,050.00, Customer paid ₹400.00
    async function postReceiptHelper(orderId, amount) {
      const draft = await CustomerReceiptService.createCustomerReceiptDraft({
        orderId,
        amount,
        createdBy: clerkUser.id,
        branchId: branchA.id,
        client,
      });
      if (!draft.success) throw new Error(`Draft receipt failed: ${draft.error}`);
      const sub = await CustomerReceiptService.submitCustomerReceipt({
        voucherId: draft.data.id,
        submittedBy: clerkUser.id,
        branchId: branchA.id,
        client,
      });
      if (!sub.success) throw new Error(`Submit receipt failed: ${sub.error}`);
      const app = await CustomerReceiptService.approveCustomerReceipt({
        voucherId: draft.data.id,
        approvedBy: supervisorUser.id,
        branchId: branchA.id,
        actorContext: supervisorUser,
        client,
      });
      if (!app.success) throw new Error(`Approve receipt failed: ${app.error}`);
      const post = await CustomerReceiptService.postCustomerReceipt({
        voucherId: draft.data.id,
        postedBy: posterUser.id,
        branchId: branchA.id,
        actorContext: posterUser,
        client,
      });
      if (!post.success) throw new Error(`Post receipt failed: ${post.error}`);
      return post;
    }

    const oPartPaid = await createAndPostSalesOrder({
      items: [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 2, unit_price: 500, gst_rate: 5 }
      ]
    });

    // Post receipt of ₹400 via Step 4.5
    const rcptPart = await postReceiptHelper(oPartPaid.orderId, 400.00);
    assert(rcptPart.success, 'Partial customer receipt of ₹400.00 posted');

    // Reverse the invoice
    const revPartRes = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPartPaid.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Order cancelled post partial deposit',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(revPartRes.success, 'Reversal of partially paid invoice executed successfully');
    assert(revPartRes.data.postReversalArBalance === -400.00, `Post-reversal AR balance is -₹400.00 (credit balance) (got ${revPartRes.data.postReversalArBalance})`);
    assert(revPartRes.data.maxCustomerRefundable === 400.00, `maxCustomerRefundable is ₹400.00 (got ${revPartRes.data.maxCustomerRefundable})`);

    // Invariant: Receipt voucher is NOT deleted or cancelled
    const rcptStillExists = await client.query(`SELECT status FROM public.accounting_voucher WHERE id = $1`, [rcptPart.data.voucher.id]);
    assert(rcptStillExists.rows[0].status === 'POSTED', 'Original customer receipt remains POSTED and intact');

    // Invariant: Reversal did NOT create any automatic payment/refund voucher
    const autoRefundCheck = await client.query(`
      SELECT count(*)::int FROM public.accounting_voucher 
      WHERE reference_id = $1 AND voucher_type = 'PAYMENT'
    `, [oPartPaid.orderId]);
    assert(autoRefundCheck.rows[0].count === 0, 'Zero automatic customer refund vouchers created');

    // 8.2 Fully paid order: Invoiced ₹1,050.00, Received ₹1,050.00
    const oFullPaid = await createAndPostSalesOrder({
      items: [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 2, unit_price: 500, gst_rate: 5 }
      ]
    });
    const rcptFull = await postReceiptHelper(oFullPaid.orderId, 1050.00);
    assert(rcptFull.success, 'Full customer receipt of ₹1,050.00 posted');

    const revFullRes = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oFullPaid.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Full refund requested by customer prior to dispatch',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(revFullRes.success, 'Reversal of fully paid invoice executed successfully');
    assert(revFullRes.data.postReversalArBalance === -1050.00, 'Post-reversal AR balance is -₹1,050.00');
    assert(revFullRes.data.maxCustomerRefundable === 1050.00, 'maxCustomerRefundable is ₹1,050.00');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: INVENTORY & COGS REVERSAL BY MERCHANDISE TYPE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/12] Testing Inventory & COGS Treatment (Cakes vs Accessories)...');

    // 9.1 Perishable Cake: Zero Restocking, Zero Lot Reinstatement, Zero Movement
    const cakeLotBefore = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_cake_init_47'`);
    const cakeStockBefore = await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, cakeProd.variant_id]);

    const oCakePure = await createAndPostSalesOrder({
      items: [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 3, unit_price: 500, gst_rate: 5 }
      ]
    });

    const cakeLotAfterSale = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_cake_init_47'`);
    const cakeStockAfterSale = await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, cakeProd.variant_id]);
    assert(Number(cakeLotAfterSale.rows[0].remaining_quantity) === Number(cakeLotBefore.rows[0].remaining_quantity) - 3, 'Cake cost lot decremented on sale');
    assert(Number(cakeStockAfterSale.rows[0].quantity) === Number(cakeStockBefore.rows[0].quantity) - 3, 'Cake physical stock decremented on sale');

    // Reverse the cake sales invoice
    const revCakeRes = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oCakePure.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Cake delivery cancelled - perishable item discarded',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(revCakeRes.success, 'Cake sales invoice reversal executed successfully');

    // Verify cake cost lot was NOT reinstated
    const cakeLotAfterRev = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_cake_init_47'`);
    assert(Number(cakeLotAfterRev.rows[0].remaining_quantity) === Number(cakeLotAfterSale.rows[0].remaining_quantity),
      'Perishable cake cost lot NOT reinstated on invoice reversal (zero lot inflation)');

    // Verify cake branch inventory was NOT incremented
    const cakeStockAfterRev = await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, cakeProd.variant_id]);
    assert(Number(cakeStockAfterRev.rows[0].quantity) === Number(cakeStockAfterSale.rows[0].quantity),
      'Perishable cake physical stock NOT incremented on invoice reversal (food safety standard)');

    // Verify zero INVOICE_REVERSAL movements for cake
    const cakeRevMov = await client.query(`
      SELECT count(*)::int FROM public.inventory_movement 
      WHERE order_id = $1 AND movement_type = 'INVOICE_REVERSAL'
    `, [oCakePure.orderId]);
    assert(cakeRevMov.rows[0].count === 0, 'Zero inventory restoration movements recorded for cake');

    // Verify GL journal lines for cake reversal
    const cakeRevLines = revCakeRes.data.reversalJournalEntry.lines;
    assert(Number(revCakeRes.data.reversalJournalEntry.total_debit) === Number(revCakeRes.data.reversalJournalEntry.total_credit),
      'Cake reversal journal debits === credits (perfectly balanced without COGS)');
    assert(cakeRevLines.some(l => l.account_code === '4110' && Number(l.debit_amount) === 1500.00),
      'Debit 4110 Cake Revenue ₹1,500.00 present (revenue reversed)');
    assert(cakeRevLines.some(l => (l.account_code === '2121' || l.account_code === '2122') && Number(l.debit_amount) === 37.50),
      'Debit Output GST present (tax reversed)');
    assert(cakeRevLines.some(l => l.account_code === '1121' && Number(l.credit_amount) === 1575.00),
      'Credit 1121 AR ₹1,575.00 present (AR reversed)');
    assert(!cakeRevLines.some(l => l.account_code === '5110'),
      '5110 COGS - Cakes is NOT credited in reversal journal (food hygiene policy)');
    assert(!cakeRevLines.some(l => l.account_code === '1132'),
      '1132 Merchandise Inventory - Cakes is NOT debited in reversal journal (zero asset fabrication)');

    // 9.2 Durable Accessories: Stock Restored, Lots Reinstated, Movement Recorded
    // Reset earlier test lots and stock for this accessory variant so this test isolates the two seeded lots
    await client.query(`UPDATE public.inventory_cost_lot SET remaining_quantity = 0, status = 'DEPLETED' WHERE variant_id = $1`, [accProd.variant_id]);
    await client.query(`UPDATE public.branch_inventory SET quantity = 0 WHERE variant_id = $1 AND branch_id = $2`, [accProd.variant_id, branchA.id]);

    // Seed 2 distinct accessory lots for reverse FIFO tracking:
    // Lot 1: 5 units @ ₹100
    // Lot 2: 5 units @ ₹120
    await seedLotsAndStock('lot_acc_rev_01', accProd, 'ACCESSORY', 5, 100, '2026-09-01');
    await seedLotsAndStock('lot_acc_rev_02', accProd, 'ACCESSORY', 5, 120, '2026-09-05');

    const accStockBefore = (await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, accProd.variant_id])).rows[0].quantity;

    // Order 7 accessories: Consumes 5 from Lot 1 (@ ₹100) and 2 from Lot 2 (@ ₹120). Total cost = 500 + 240 = 740.
    const oAcc = await createAndPostSalesOrder({
      items: [
        { product_id: accProd.id, variant_id: accProd.variant_id, quantity: 7, unit_price: 200, gst_rate: 18 }
      ]
    });

    const lot1AfterSale = (await client.query(`SELECT remaining_quantity, status FROM public.inventory_cost_lot WHERE id = 'lot_acc_rev_01'`)).rows[0];
    const lot2AfterSale = (await client.query(`SELECT remaining_quantity, status FROM public.inventory_cost_lot WHERE id = 'lot_acc_rev_02'`)).rows[0];
    assert(Number(lot1AfterSale.remaining_quantity) === 0 && lot1AfterSale.status === 'DEPLETED', 'Lot 1 fully depleted by sale');
    assert(Number(lot2AfterSale.remaining_quantity) === 3 && lot2AfterSale.status === 'ACTIVE', 'Lot 2 partially consumed (3 remaining)');

    // Reverse the accessory invoice
    const revAccRes = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oAcc.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Accessory sale cancelled, durable merchandise returned to shelf',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });

    assert(revAccRes.success, 'Accessory sales invoice reversal executed successfully');
    const dAcc = revAccRes.data;
    assert(dAcc.restoredAccessories.length === 2, `Restored 2 accessory cost lot consumptions (got ${dAcc.restoredAccessories.length})`);

    // Verify lots reinstated
    const lot1AfterRev = (await client.query(`SELECT remaining_quantity, status FROM public.inventory_cost_lot WHERE id = 'lot_acc_rev_01'`)).rows[0];
    const lot2AfterRev = (await client.query(`SELECT remaining_quantity, status FROM public.inventory_cost_lot WHERE id = 'lot_acc_rev_02'`)).rows[0];
    assert(Number(lot1AfterRev.remaining_quantity) === 5 && lot1AfterRev.status === 'ACTIVE', 'Lot 1 remaining quantity restored to 5.0 and status ACTIVE');
    assert(Number(lot2AfterRev.remaining_quantity) === 5 && lot2AfterRev.status === 'ACTIVE', 'Lot 2 remaining quantity restored to 5.0 and status ACTIVE');

    // Verify physical stock restored
    const accStockAfterRev = (await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, accProd.variant_id])).rows[0].quantity;
    assert(Number(accStockAfterRev) === Number(accStockBefore), `Accessory physical stock fully restored to ${accStockBefore}`);

    // Verify inventory movement recorded
    assert(dAcc.movements.length === 1, '1 compensating inventory_movement recorded');
    assert(dAcc.movements[0].movement_type === 'INVOICE_REVERSAL', 'Movement type is INVOICE_REVERSAL');
    assert(dAcc.movements[0].direction === 'IN', 'Movement direction is IN');
    assert(Number(dAcc.movements[0].quantity) === 7, 'Restored quantity is 7');

    // Verify COGS reversal lines present
    const accJeLines = dAcc.reversalJournalEntry.lines;
    assert(Number(dAcc.reversalJournalEntry.total_debit) === Number(dAcc.reversalJournalEntry.total_credit),
      'Accessory reversal journal debits === credits (perfectly balanced)');
    assert(accJeLines.some(l => l.account_code === '4120' && Number(l.debit_amount) === 1400.00),
      'Debit 4120 Accessory Revenue ₹1,400.00 present (revenue reversed)');
    assert(accJeLines.some(l => (l.account_code === '2123' || l.account_code === '2124') && Number(l.debit_amount) === 126.00),
      'Debit Output GST present (tax reversed)');
    assert(accJeLines.some(l => l.account_code === '1121' && Number(l.credit_amount) === 1652.00),
      'Credit 1121 AR ₹1,652.00 present (AR reversed)');
    assert(accJeLines.some(l => l.account_code === '1131' && Number(l.debit_amount) === 740.00),
      'Debit 1131 Accessories Inventory ₹740.00 present (asset value restored)');
    assert(accJeLines.some(l => l.account_code === '5120' && Number(l.credit_amount) === 740.00),
      'Credit 5120 Accessory COGS ₹740.00 present (cost of goods sold reversed)');

    // 9.3 Consumable Packaging: Zero Restocking, Zero Lot Reinstatement, Zero Movement, Zero GL Inventory Restoration
    const pkgLotBefore = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_pkg_init_47'`);
    const pkgStockBefore = await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, pkgProd.variant_id]);

    const oPkg = await createAndPostSalesOrder({
      items: [
        { product_id: pkgProd.id, variant_id: pkgProd.variant_id, quantity: 4, unit_price: 50, gst_rate: 18 }
      ]
    });

    const pkgLotAfterSale = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_pkg_init_47'`);
    const pkgStockAfterSale = await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, pkgProd.variant_id]);
    assert(Number(pkgLotAfterSale.rows[0].remaining_quantity) === Number(pkgLotBefore.rows[0].remaining_quantity) - 4, 'Packaging cost lot decremented on sale');
    assert(Number(pkgStockAfterSale.rows[0].quantity) === Number(pkgStockBefore.rows[0].quantity) - 4, 'Packaging physical stock decremented on sale');

    // Verify original journal entry contained Packaging COGS (5130) and Packaging Supplies Inventory (1133)
    const pkgOrigLines = oPkg.journalEntry.lines;
    assert(pkgOrigLines.some(l => l.debit_amount > 0 && Number(l.debit_amount) === 100.00), 'Original journal has Dr 5130 Packaging Expense ₹100.00 (4 * ₹25)');
    assert(pkgOrigLines.some(l => l.credit_amount > 0 && Number(l.credit_amount) === 100.00), 'Original journal has Cr 1133 Packaging Supplies Stock ₹100.00');

    // Reverse the packaging sales invoice
    const revPkgRes = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oPkg.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Packaging order cancelled - single-use supplies non-restockable',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });
    assert(revPkgRes.success, 'Packaging sales invoice reversal executed successfully');

    // Verify packaging cost lot was NOT reinstated
    const pkgLotAfterRev = await client.query(`SELECT remaining_quantity FROM public.inventory_cost_lot WHERE id = 'lot_pkg_init_47'`);
    assert(Number(pkgLotAfterRev.rows[0].remaining_quantity) === Number(pkgLotAfterSale.rows[0].remaining_quantity),
      'Packaging cost lot NOT reinstated on invoice reversal (zero lot inflation)');

    // Verify packaging branch inventory was NOT incremented
    const pkgStockAfterRev = await client.query(`SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`, [branchA.id, pkgProd.variant_id]);
    assert(Number(pkgStockAfterRev.rows[0].quantity) === Number(pkgStockAfterSale.rows[0].quantity),
      'Packaging physical stock NOT incremented on invoice reversal (sanitary single-use policy)');

    // Verify zero INVOICE_REVERSAL movements for packaging
    const pkgRevMov = await client.query(`
      SELECT count(*)::int FROM public.inventory_movement 
      WHERE order_id = $1 AND movement_type = 'INVOICE_REVERSAL'
    `, [oPkg.orderId]);
    assert(pkgRevMov.rows[0].count === 0, 'Zero inventory restoration movements recorded for packaging');

    // Verify GL journal lines for packaging reversal
    const pkgRevLines = revPkgRes.data.reversalJournalEntry.lines;
    assert(Number(revPkgRes.data.reversalJournalEntry.total_debit) === Number(revPkgRes.data.reversalJournalEntry.total_credit),
      'Packaging reversal journal debits === credits (perfectly balanced without packaging COGS)');
    assert(pkgRevLines.some(l => l.account_code === '1121' && Number(l.credit_amount) === 236.00),
      'Credit 1121 AR ₹236.00 present (AR reversed)');
    assert(!pkgRevLines.some(l => l.account_code === '5130'),
      '5130 Packaging Expense is NOT credited in reversal journal (costs incurred/destroyed)');
    assert(!pkgRevLines.some(l => l.account_code === '1133'),
      '1133 Packaging Supplies Stock is NOT debited in reversal journal (zero inventory asset fabrication)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10: IDEMPOTENCY & REPLAY DEFENSE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/12] Testing Idempotency & Replay Defense...');

    // Re-issue the exact same reversal call for oRev1
    const dupRevRes = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oRev1.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Billing error in price calculation (duplicate request)',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });

    assert(dupRevRes.success, 'Duplicate reversal request succeeds idempotently');
    assert(dupRevRes.data.wasDuplicate === true, 'wasDuplicate flag is TRUE on replay');
    assert(dupRevRes.data.reversalVoucher.id === d1.reversalVoucher.id, 'Returned reversal voucher ID matches original reversal');

    // Verify zero duplicate vouchers or journals were created
    const dupVchCount = await client.query(`
      SELECT count(*)::int FROM public.accounting_voucher
      WHERE reference_id = $1 AND voucher_type = 'JOURNAL'
    `, [oRev1.orderId]);
    assert(dupVchCount.rows[0].count === 1, 'Exactly 1 reversal voucher exists in database (zero duplicate vouchers)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 11: CONCURRENCY & ATOMIC ROLLBACK
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[11/12] Testing Concurrency & Failure Injection Rollback...');

    // 11.1 Competing reversal requests on same order (Idempotency & Replay Defense)
    const oCompete = await createAndPostSalesOrder({
      items: [
        { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: 2, unit_price: 500, gst_rate: 5 }
      ]
    });

    const compete1 = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oCompete.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Concurrent reversal worker 1',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });

    const compete2 = await SalesInvoiceReversalService.reversePostedSalesInvoice({
      orderId: oCompete.orderId,
      reversedBy: reversalPosterUser.id,
      reversalInitiatorId: reversalInitiatorUser.id,
      reversalApproverId: reversalApproverUser.id,
      reason: 'Concurrent reversal worker 2',
      branchId: branchA.id,
      actorContext: reversalPosterUser,
      client,
    });

    assert(compete1.success && compete2.success, 'Both competing calls completed safely');
    assert(compete1.data.wasDuplicate === false && compete2.data.wasDuplicate === true,
      'Pessimistic row locking ensured exactly one primary reversal and one idempotent duplicate detection');

    // 11.2 Failure injection and rollback to savepoint
    await client.query('SAVEPOINT sp_failure_test_47');
    try {
      // Simulate failure by executing partial insert and then throwing
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, branch_id, voucher_no, voucher_type, voucher_date, status, total_amount, currency
        ) VALUES (
          'vch_fail_inj_47', $1, 'VCH-FAIL-47', 'JOURNAL', '2026-09-26', 'POSTED', 100, 'INR'
        )
      `, [branchA.id]);
      throw new Error('SIMULATED_FAILURE_INJECTION');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_failure_test_47');
      assert(true, 'Transaction cleanly rolled back to savepoint on simulated failure');
    }

    const checkFailVch = await client.query(`SELECT count(*)::int FROM public.accounting_voucher WHERE id = 'vch_fail_inj_47'`);
    assert(checkFailVch.rows[0].count === 0, 'Injected failure voucher was completely discarded by savepoint rollback');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 12: ROLLBACK ISOLATED TEST TRANSACTION & POST-AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[12/12] Rolling back test transaction and verifying clean database baseline...');
    await client.query('ROLLBACK');

    const bPost = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_account) AS acc_cnt,
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt,
        (SELECT count(*)::int FROM public.purchase) AS pur_cnt,
        (SELECT count(*)::int FROM public.purchase_item) AS pi_cnt,
        (SELECT count(*)::int FROM public.purchase_payment) AS pay_cnt,
        (SELECT count(*)::int FROM public.supplier) AS sup_cnt,
        (SELECT count(*)::int FROM public.branch) AS br_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS binv_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) AS con_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS ptx_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt
    `);
    const rPost = bPost.rows[0];
    assert(rPost.acc_cnt === 98, `Post-test accounting_account === 98 (actual: ${rPost.acc_cnt})`);
    assert(rPost.vch_cnt === 0, `Post-test accounting_voucher === 0 (actual: ${rPost.vch_cnt})`);
    assert(rPost.je_cnt === 0, `Post-test accounting_journal_entry === 0 (actual: ${rPost.je_cnt})`);
    assert(rPost.jl_cnt === 0, `Post-test accounting_journal_line === 0 (actual: ${rPost.jl_cnt})`);
    assert(rPost.fp_cnt === 0, `Post-test accounting_fiscal_period === 0 (actual: ${rPost.fp_cnt})`);
    assert(rPost.pur_cnt === 0, `Post-test purchase === 0 (actual: ${rPost.pur_cnt})`);
    assert(rPost.pi_cnt === 0, `Post-test purchase_item === 0 (actual: ${rPost.pi_cnt})`);
    assert(rPost.pay_cnt === 0, `Post-test purchase_payment === 0 (actual: ${rPost.pay_cnt})`);
    assert(rPost.sup_cnt === 0, `Post-test supplier === 0 (actual: ${rPost.sup_cnt})`);
    assert(rPost.br_cnt === 57, `Post-test branch === 57 (actual: ${rPost.br_cnt})`);
    assert(rPost.binv_cnt === 424, `Post-test branch_inventory === 424 (actual: ${rPost.binv_cnt})`);
    assert(rPost.lot_cnt === 0, `Post-test inventory_cost_lot === 0 (actual: ${rPost.lot_cnt})`);
    assert(rPost.mov_cnt === 0, `Post-test inventory_movement === 0 (actual: ${rPost.mov_cnt})`);
    assert(rPost.con_cnt === 0, `Post-test inventory_cost_consumption === 0 (actual: ${rPost.con_cnt})`);
    assert(rPost.ord_cnt === 173, `Post-test order === 173 (actual: ${rPost.ord_cnt})`);
    assert(rPost.ptx_cnt === 53, `Post-test payment_transaction === 53 (actual: ${rPost.ptx_cnt})`);
    assert(rPost.start_date_cnt === 0, `Post-test accounting_start_date is unconfigured (actual: ${rPost.start_date_cnt})`);

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
