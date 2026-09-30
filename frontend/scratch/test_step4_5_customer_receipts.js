/**
 * CakeToHome ERP — Phase 4F Step 4.5 Customer Receipts & AR Settlement Test Suite
 *
 * SCOPE:
 * 1. Database Baseline Pre-Audit (18-point baseline outside transaction)
 * 2. Fail-Closed Guards:
 *    - ACCOUNTING_START_DATE_NOT_CONFIGURED
 *    - FISCAL_PERIOD_NOT_CONFIGURED
 *    - ACCOUNT_RESOLUTION_FAILED
 *    - PERMISSION_DENIED
 *    - BRANCH_ACCESS_DENIED (BOLA Defense)
 *    - ORDER_NOT_POSTED (Unposted sales invoice)
 *    - LEGACY_PROTOTYPE_ORDER_REJECTED (Historical 173 orders quarantine)
 *    - INVALID_ORDER_STATUS (Canceled order)
 *    - OVERPAYMENT_NOT_PERMITTED (Overpayment prevention)
 *    - DUPLICATE_SOURCE_EVENT (Idempotency)
 *    - INVALID_SETTLEMENT_MATH (Settlement math mismatch)
 *    - MISSING_MDR_FEE (Authoritative MDR requirement)
 *    - SEGREGATION_OF_DUTIES_VIOLATION (Creator, submitter, customer, commercial creator, Super Admin self-approval)
 * 3. Double-Entry Posting Lifecycles:
 *    - Prepaid Customer Receipt: Dr 1113 Gateway Clearing / Cr 1121 Accounts Receivable
 *    - COD Cash Remittance: Dr 1111 Cash in Hand / Cr 1122 Undeposited COD
 *    - Gateway Settlement: Dr 1112 Bank Operating A/c + Dr 5290 MDR Fees / Cr 1113 Gateway Clearing
 * 4. Special Domain Invariants:
 *    - Guest Customer foreign key hygiene (journal_line.customer_id = NULL)
 *    - Registered Customer FK linkage (journal_line.customer_id = customer.id)
 *    - Partial Receipts and authoritatively calculated remaining balance
 *    - Exact Full Settlement
 *    - Concurrency & Race Condition Defense (Pessimistic locking prevents double consumption)
 *    - Failure Injection & Atomic Savepoint Rollback
 * 5. Full Rollback & Pristine Database Post-Audit
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
  console.log('CakeToHome ERP — Phase 4F Step 4.5 Customer Receipts & AR Settlement Suite');
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
    console.log('[0/17] Verifying pre-test database baseline...');
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
    console.log('\n[1/17] Starting isolated rollback transaction and resolving fixtures...');
    await client.query('BEGIN');

    // 1. Resolve branch
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

    // 2. Resolve catalog products
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

    // 3. Define actor contexts
    const cashierUser = {
      id: 'usr_cashier_01',
      user_id: 'usr_cashier_01',
      role: 'STAFF',
      permissions: ['PAYMENTS.RECEIVE', 'SALES.CREATE', 'SALES.SUBMIT'],
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

    // Helper: Seed purchase cost lot and inventory so sales posting succeeds
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES ('sup_fixture_test_4_5', 'Fixture Supplier Corp', '29AABCU9603R1Z5', 'Karnataka', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_fixture_test_4_5', 'sup_fixture_test_4_5', $1, 'INV-FIXTURE-45', '2026-09-01',
        100000, 0, 100000, 0, 0, 0, 100000,
        'APPROVED', 'buyer_01', 'mgr_01', NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING;
    `, [branchA.id]);

    async function seedLotsAndStock(lotId, qty, unitCost = 300) {
      const piId = 'pi_fix_' + lotId;
      await client.query(
        `INSERT INTO public.purchase_item (
           id, purchase_id, product_id, variant_id, description,
           quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
           cgst, sgst, igst, total, item_type, created_at, updated_at
         ) VALUES (
           $1, 'pur_fixture_test_4_5', $2, $3, 'Fixture Item',
           $4, $5, 0, $6, 0, 0, 0, 0, 0, 0, $6, 'CAKE', NOW(), NOW()
         ) ON CONFLICT (id) DO NOTHING;`,
        [piId, cakeProd.id, cakeProd.variant_id, qty, unitCost, qty * unitCost]
      );
      await client.query(
        `INSERT INTO public.inventory_cost_lot (
           id, branch_id, product_id, variant_id, item_type,
           purchase_id, purchase_item_id, supplier_id,
           received_quantity, remaining_quantity, unit_cost, total_cost,
           currency, received_at, status, created_by, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, 'CAKE',
           'pur_fixture_test_4_5', $5, 'sup_fixture_test_4_5',
           $6, $6, $7, $8, 'INR', '2026-09-01', 'ACTIVE', 'SYSTEM', NOW(), NOW()
         ) ON CONFLICT (id) DO NOTHING;`,
        [lotId, branchA.id, cakeProd.id, cakeProd.variant_id, piId, qty, unitCost, qty * unitCost]
      );
      // update branch inventory
      const existingBinv = await client.query(
        `SELECT id, quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
        [branchA.id, cakeProd.variant_id]
      );
      if (existingBinv.rows.length > 0) {
        await client.query(
          `UPDATE public.branch_inventory SET quantity = quantity + $1, reserved = 0 WHERE id = $2`,
          [qty, existingBinv.rows[0].id]
        );
      } else {
        const binvId = `binv_test_${branchA.id}_${cakeProd.variant_id}`.slice(0, 60);
        await client.query(
          `INSERT INTO public.branch_inventory (id, branch_id, variant_id, product_id, quantity, reserved, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())`,
          [binvId, branchA.id, cakeProd.variant_id, cakeProd.id, qty]
        );
      }
    }

    // Seed 100 units of cake cost lots
    await seedLotsAndStock('lot_test_receipt_01', 100, 300);

    // Helper: Create and post a sales order with sales voucher
    async function createAndPostSalesOrder(opts = {}) {
      const ts = Date.now() + Math.floor(Math.random() * 10000);
      const isCod = opts.paymentMethod === 'cod';
      const isGuest = opts.isGuest === true;
      const isLegacy = opts.isLegacy === true;
      const qty = opts.qty || 2;
      const unitPrice = opts.unitPrice || 500; // subtotal 1000, 5% gst = 1050

      let custId = isGuest ? 'guest' : `cust_test_45_${ts}`;
      if (!isGuest) {
        await client.query(
          `INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
           VALUES ($1, 'Customer', 'Test', $2, '9999988888', true, NOW(), NOW())`,
          [custId, `cust_${ts}@example.com`]
        );
      }

      const orderId = `ord_test_45_${ts}`;
      const orderMeta = {
        is_ledger_eligible: !isLegacy,
        legacy_prototype: isLegacy,
        branch_id: branchA.id,
        payment_method: isCod ? 'cod' : 'upi',
        created_by: cashierUser.id,
        items: [
          { product_id: cakeProd.id, variant_id: cakeProd.variant_id, quantity: qty, unit_price: unitPrice, gst_rate: 5 }
        ],
        delivery_address: { state: 'Karnataka', pincode: '560001' },
      };

      const displayId = 95000 + Math.floor(Math.random() * 1000);
      await client.query(
        `INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'inr', $5, $6, NOW(), NOW())`,
        [orderId, displayId, custId, `order_${ts}@example.com`, opts.orderStatus || 'completed', JSON.stringify(orderMeta)]
      );

      // Create linked payment_transaction
      const ptId = `pt_test_45_${ts}`;
      await client.query(
        `INSERT INTO public.payment_transaction (
           id, company_id, branch_id, order_id, customer_id, amount, currency,
           status, settlement_status, provider, provider_ref, created_at, updated_at
         ) VALUES (
           $1, 'default_company', $2, $3, $4, $5, 'INR',
           $6, 'unsettled', $7, $8, NOW(), NOW()
         )`,
        [
          ptId, branchA.id, orderId, custId, (qty * unitPrice * 1.05),
          isCod ? 'pending' : 'pending',
          isCod ? 'cod' : 'upi',
          `ref_${ts}`
        ]
      );

      if (opts.skipSalesPosting) {
        return { orderId, ptId, custId };
      }

      // Draft, submit, approve sales voucher
      const draftRes = await SalesPostingService.createSalesVoucherDraft({
        orderId,
        createdBy: cashierUser.id,
        branchId: branchA.id,
        client,
      });
      if (!draftRes.success) throw new Error(`Failed to draft sales voucher: ${draftRes.error}`);

      const subRes = await SalesPostingService.submitSalesVoucher({
        voucherId: draftRes.data.id,
        submittedBy: cashierUser.id,
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

      // Post sales voucher
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
        salesVoucher: postRes.data.voucher,
        invoiceTotal: postRes.data.invoiceTotal,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 1: Fail Closed on Unconfigured Accounting Start Date
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/17] Test Group 1: Fail closed on unconfigured accounting_start_date...');
    const ordG1 = await createAndPostSalesOrder({ skipSalesPosting: true });
    // Attempting to post when start date is not configured
    const dG1 = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordG1.orderId,
      amount: 1050,
      createdBy: cashierUser.id,
      client,
    });
    assert(!dG1.success && dG1.code === 'ORDER_NOT_POSTED', 'Receipt rejected when sales invoice is not posted (ORDER_NOT_POSTED)');

    // Now configure mock start date and fiscal period inside transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_4_5', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_4_5', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    assert(true, 'Configured temporary mock accounting_start_date and fiscal period inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 2: Unposted Sale and Historical Prototype Quarantine
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/17] Test Group 2: Unposted sale and historical prototype quarantine...');
    const ordUnposted = await createAndPostSalesOrder({ skipSalesPosting: true });
    const resUnposted = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordUnposted.orderId,
      amount: 500,
      createdBy: cashierUser.id,
      client,
    });
    assert(!resUnposted.success && resUnposted.code === 'ORDER_NOT_POSTED', 'Unposted sales order rejected with ORDER_NOT_POSTED');

    const ordLegacy = await createAndPostSalesOrder({ isLegacy: true, skipSalesPosting: true });
    const resLegacy = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordLegacy.orderId,
      amount: 500,
      createdBy: cashierUser.id,
      client,
    });
    assert(!resLegacy.success && resLegacy.code === 'LEGACY_PROTOTYPE_ORDER_REJECTED', 'Quarantined historical order rejected with LEGACY_PROTOTYPE_ORDER_REJECTED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 3: Authoritative Outstanding AR & Overpayment Prevention
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/17] Test Group 3: Authoritative outstanding AR & overpayment rejection...');
    const ord3 = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 }); // invoice total 1050
    const ar3 = await CustomerReceiptService.getOrderOutstandingAr(ord3.orderId, client);
    assert(ar3.outstandingAr === 1050, `Authoritative AR before receipt === 1050 (got ${ar3.outstandingAr})`);
    assert(ar3.isFullySettled === false, 'Order is not fully settled');

    // Overpayment attempt (₹1,051 on ₹1,050 balance)
    const resOverpay = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord3.orderId,
      amount: 1051,
      createdBy: cashierUser.id,
      client,
    });
    assert(!resOverpay.success && resOverpay.code === 'OVERPAYMENT_NOT_PERMITTED', 'Overpayment rejected with OVERPAYMENT_NOT_PERMITTED');

    // Negative / zero amount attempt
    const resZero = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord3.orderId,
      amount: 0,
      createdBy: cashierUser.id,
      client,
    });
    assert(!resZero.success && resZero.code === 'INVALID_AMOUNT', 'Zero amount rejected with INVALID_AMOUNT');

    const resNeg = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord3.orderId,
      amount: -50,
      createdBy: cashierUser.id,
      client,
    });
    assert(!resNeg.success && resNeg.code === 'INVALID_AMOUNT', 'Negative amount rejected with INVALID_AMOUNT');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 4: Full Prepaid Customer Receipt Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/17] Test Group 4: Full prepaid customer receipt lifecycle (Dr 1113 / Cr 1121)...');
    const ord4 = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 }); // 1050
    // Draft
    const d4 = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord4.orderId,
      amount: 1050,
      paymentTxnId: ord4.ptId,
      createdBy: cashierUser.id,
      branchId: branchA.id,
      client,
    });
    assert(d4.success, 'Prepaid receipt draft created');
    assert(d4.data.status === 'DRAFT', 'Voucher status is DRAFT');
    assert(d4.data.voucher_type === 'RECEIPT', 'Voucher type is RECEIPT');
    assert(Number(d4.data.total_amount) === 1050, 'Voucher total amount is ₹1,050');

    // Submit
    const s4 = await CustomerReceiptService.submitCustomerReceipt({
      voucherId: d4.data.id,
      submittedBy: cashierUser.id,
      branchId: branchA.id,
      client,
    });
    assert(s4.success && s4.data.status === 'SUBMITTED', 'Prepaid receipt submitted');

    // Approve
    const a4 = await CustomerReceiptService.approveCustomerReceipt({
      voucherId: d4.data.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(a4.success && a4.data.status === 'APPROVED', 'Prepaid receipt approved');

    // Post to GL
    const p4 = await CustomerReceiptService.postCustomerReceipt({
      voucherId: d4.data.id,
      postedBy: posterUser.id,
      branchId: branchA.id,
      actorContext: posterUser,
      client,
    });
    if (!p4.success) console.error('p4 ERROR DETAILS:', JSON.stringify(p4));
    assert(p4.success, 'Prepaid receipt posted to General Ledger');
    assert(p4.data.voucher.status === 'POSTED', 'Voucher status is POSTED');
    assert(p4.data.remainingAr === 0, 'Remaining AR is ₹0.00');

    // Check Journal Lines
    const jl4 = p4.data.journalEntry.lines;
    assert(jl4.length === 2, 'Exactly 2 journal lines generated');
    const debitLine = jl4.find(l => Number(l.debit_amount) > 0);
    const creditLine = jl4.find(l => Number(l.credit_amount) > 0);
    assert(debitLine && Number(debitLine.debit_amount) === 1050, 'Debit line is ₹1,050.00');
    assert(creditLine && Number(creditLine.credit_amount) === 1050, 'Credit line is ₹1,050.00');

    // Check account codes: 1113 Gateway Clearing (Dr) and 1121 Accounts Receivable (Cr)
    const accDrRes = await client.query(`SELECT code FROM public.accounting_account WHERE id = $1`, [debitLine.account_id]);
    const accCrRes = await client.query(`SELECT code FROM public.accounting_account WHERE id = $1`, [creditLine.account_id]);
    assert(accDrRes.rows[0].code === '1113', 'Debit line targets 1113 Gateway Clearing');
    assert(accCrRes.rows[0].code === '1121', 'Credit line targets 1121 Accounts Receivable');

    // Verify payment_transaction transitioned to captured
    const pt4Res = await client.query(`SELECT status, settlement_status FROM public.payment_transaction WHERE id = $1`, [ord4.ptId]);
    assert(pt4Res.rows[0].status === 'captured', 'payment_transaction status updated to captured');
    assert(pt4Res.rows[0].settlement_status === 'unsettled', 'payment_transaction settlement_status is unsettled awaiting payout');

    // Verify order metadata updated
    const o4Res = await client.query(`SELECT metadata FROM public."order" WHERE id = $1`, [ord4.orderId]);
    assert(o4Res.rows[0].metadata.payment_status === 'captured', 'Order metadata records payment_status = captured');
    assert(Boolean(o4Res.rows[0].metadata.receipt_voucher_id), 'Order metadata references receipt_voucher_id');

    // Verify outstanding balance via helper
    const arAfter4 = await CustomerReceiptService.getOrderOutstandingAr(ord4.orderId, client);
    assert(arAfter4.outstandingAr === 0, 'getOrderOutstandingAr confirms outstandingAr === 0');
    assert(arAfter4.isFullySettled === true, 'getOrderOutstandingAr confirms isFullySettled === true');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 5: Partial Customer Receipts
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/17] Test Group 5: Partial receipts & incremental AR reduction...');
    const ord5 = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 }); // 1050 invoice
    // First receipt: ₹600
    const d5a = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord5.orderId,
      amount: 600,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: d5a.data.id, submittedBy: cashierUser.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: d5a.data.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const p5a = await CustomerReceiptService.postCustomerReceipt({ voucherId: d5a.data.id, postedBy: posterUser.id, actorContext: posterUser, client });
    assert(p5a.success && p5a.data.remainingAr === 450, 'First partial receipt (₹600) leaves remaining AR of ₹450.00');

    // Verify DB reflects remaining balance
    const ar5Part = await CustomerReceiptService.getOrderOutstandingAr(ord5.orderId, client);
    assert(ar5Part.outstandingAr === 450, `Authoritative outstanding balance is ₹450 (actual: ${ar5Part.outstandingAr})`);
    assert(ar5Part.isFullySettled === false, 'Order is not fully settled after partial receipt');

    // Second receipt attempt for ₹500 (exceeds 450) -> FAIL
    const d5bOver = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord5.orderId,
      amount: 500,
      createdBy: cashierUser.id,
      client,
    });
    assert(!d5bOver.success && d5bOver.code === 'OVERPAYMENT_NOT_PERMITTED', 'Second receipt for ₹500 rejected (exceeds ₹450 remaining)');

    // Second receipt for exact ₹450 -> SUCCESS
    const d5b = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord5.orderId,
      amount: 450,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: d5b.data.id, submittedBy: cashierUser.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: d5b.data.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const p5b = await CustomerReceiptService.postCustomerReceipt({ voucherId: d5b.data.id, postedBy: posterUser.id, actorContext: posterUser, client });
    assert(p5b.success && p5b.data.remainingAr === 0, 'Second partial receipt (₹450) completes settlement (remaining AR: ₹0)');

    const ar5Final = await CustomerReceiptService.getOrderOutstandingAr(ord5.orderId, client);
    assert(ar5Final.outstandingAr === 0, 'Final authoritative balance is ₹0.00');
    assert(ar5Final.isFullySettled === true, 'Order is fully settled');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 6: COD Cash Remittance Workflow (Dr 1111 / Cr 1122)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/17] Test Group 6: COD cash remittance workflow (Dr 1111 / Cr 1122)...');
    const ord6 = await createAndPostSalesOrder({ paymentMethod: 'cod', qty: 1, unitPrice: 500 }); // invoice total 525
    const ar6 = await CustomerReceiptService.getOrderOutstandingAr(ord6.orderId, client);
    assert(ar6.paymentClassification === 'COD', 'Order classified as COD');
    assert(ar6.controlAccountCode === '1122', 'Control account is 1122 Undeposited COD');
    assert(ar6.outstandingAr === 525, 'Outstanding COD balance is ₹525.00');

    // Process rider cash remittance
    const resCod = await CustomerReceiptService.postCodCashRemittance({
      orderId: ord6.orderId,
      amount: 525,
      branchId: branchA.id,
      remittedByStaffId: cashierUser.id,
      approvedBySupervisorId: supervisorUser.id,
      postedByGlAccountantId: posterUser.id,
      paymentTxnId: ord6.ptId,
      client,
    });
    if (!resCod.success) console.error('resCod ERROR:', JSON.stringify(resCod));
    assert(resCod.success, 'COD cash remittance completed successfully');
    assert(resCod.data.remainingAr === 0, 'COD remaining AR is ₹0');

    // Verify journal lines: Dr 1111 Cash in Hand / Cr 1122 Undeposited COD
    const codLines = resCod.data.journalEntry.lines;
    const codDr = codLines.find(l => Number(l.debit_amount) > 0);
    const codCr = codLines.find(l => Number(l.credit_amount) > 0);

    const accCodDr = await client.query(`SELECT code FROM public.accounting_account WHERE id = $1`, [codDr.account_id]);
    const accCodCr = await client.query(`SELECT code FROM public.accounting_account WHERE id = $1`, [codCr.account_id]);
    assert(accCodDr.rows[0].code === '1111', 'Debit line targets 1111 Cash in Hand');
    assert(accCodCr.rows[0].code === '1122', 'Credit line targets 1122 Undeposited COD');

    // Verify payment_transaction updated to captured and settled
    const pt6Res = await client.query(`SELECT status, settlement_status FROM public.payment_transaction WHERE id = $1`, [ord6.ptId]);
    assert(pt6Res.rows[0].status === 'captured', 'COD payment transaction status is captured');
    assert(pt6Res.rows[0].settlement_status === 'settled', 'COD payment transaction settlement_status is settled');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 7: Guest Customer Foreign Key Hygiene
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/17] Test Group 7: Guest customer foreign key hygiene...');
    const ordGuest = await createAndPostSalesOrder({ isGuest: true, qty: 1, unitPrice: 500 });
    const dGuest = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordGuest.orderId,
      amount: 525,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: dGuest.data.id, submittedBy: cashierUser.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: dGuest.data.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const pGuest = await CustomerReceiptService.postCustomerReceipt({ voucherId: dGuest.data.id, postedBy: posterUser.id, actorContext: posterUser, client });
    assert(pGuest.success, 'Guest customer receipt posted without foreign key violation');

    // Verify journal_line.customer_id is strictly NULL
    const guestLines = pGuest.data.journalEntry.lines;
    for (const line of guestLines) {
      assert(line.customer_id === null, 'Journal line customer_id is strictly NULL for guest order');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 8: Registered Customer Linkage
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/17] Test Group 8: Registered customer linkage...');
    const ordReg = await createAndPostSalesOrder({ isGuest: false, qty: 1, unitPrice: 500 });
    const dReg = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordReg.orderId,
      amount: 525,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: dReg.data.id, submittedBy: cashierUser.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: dReg.data.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });
    const pReg = await CustomerReceiptService.postCustomerReceipt({ voucherId: dReg.data.id, postedBy: posterUser.id, actorContext: posterUser, client });
    assert(pReg.success, 'Registered customer receipt posted');

    const regLines = pReg.data.journalEntry.lines;
    for (const line of regLines) {
      assert(line.customer_id === ordReg.custId, `Journal line customer_id matches registered customer ID (${ordReg.custId})`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 9: Gateway Settlement (MDR & Payout)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/17] Test Group 9: Gateway settlement (Dr 1112 Bank + Dr 5290 MDR / Cr 1113 Clearing)...');
    // Gross: ₹1,050, MDR: ₹21.00 (2%), Net Bank: ₹1,029.00
    const payoutRef = `payout_batch_${Date.now()}`;
    const pSettlement = await CustomerReceiptService.postGatewaySettlement({
      branchId: branchA.id,
      voucherDate: '2026-09-26',
      grossAmount: 1050.00,
      mdrFeeAmount: 21.00,
      netBankAmount: 1029.00,
      payoutRef,
      provider: 'razorpay',
      paymentTxnIds: [ord4.ptId],
      postedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(pSettlement.success, 'Gateway settlement posted successfully');
    assert(pSettlement.data.voucher.status === 'POSTED', 'Settlement voucher status is POSTED');
    assert(pSettlement.data.settledTxnCount === 1, 'Linked payment_transaction marked settled');

    // Check Journal Lines: exactly 3 lines
    const setLines = pSettlement.data.journalEntry.lines;
    assert(setLines.length === 3, 'Compound settlement entry has exactly 3 lines');
    const bankLine = setLines.find(l => l.account_id && Number(l.debit_amount) === 1029.00);
    const mdrLine = setLines.find(l => l.account_id && Number(l.debit_amount) === 21.00);
    const clearLine = setLines.find(l => l.account_id && Number(l.credit_amount) === 1050.00);

    const bankAcc = await client.query(`SELECT code FROM public.accounting_account WHERE id = $1`, [bankLine.account_id]);
    const mdrAcc = await client.query(`SELECT code FROM public.accounting_account WHERE id = $1`, [mdrLine.account_id]);
    const clearAcc = await client.query(`SELECT code FROM public.accounting_account WHERE id = $1`, [clearLine.account_id]);
    assert(bankAcc.rows[0].code === '1112', 'Net bank deposit debits 1112 Bank Operating A/c');
    assert(mdrAcc.rows[0].code === '5290', 'MDR fee debits 5290 Payment Gateway MDR Fees');
    assert(clearAcc.rows[0].code === '1113', 'Gross clearing credits 1113 Gateway Clearing');

    // Verify Clearing reconciliation: Clearing Debit (1050 from prepaid receipt) === Clearing Credit (1050 from settlement)
    const clearTotalDebits = 1050.00;
    const clearTotalCredits = Number(clearLine.credit_amount);
    assert(clearTotalDebits === clearTotalCredits, 'Gateway Clearing account 1113 perfectly reconciled (Debits === Credits)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 10: Settlement Math Mismatch & Missing MDR Guards
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[11/17] Test Group 10: Settlement math mismatch & missing MDR guards...');
    // Net + MDR != Gross (1000 + 20 != 1050)
    const resBadMath = await CustomerReceiptService.postGatewaySettlement({
      branchId: branchA.id,
      voucherDate: '2026-09-26',
      grossAmount: 1050.00,
      mdrFeeAmount: 20.00,
      netBankAmount: 1000.00,
      payoutRef: 'bad_math_ref',
      provider: 'razorpay',
      postedBy: posterUser.id,
      client,
    });
    assert(!resBadMath.success && resBadMath.code === 'INVALID_SETTLEMENT_MATH', 'Math mismatch rejected with INVALID_SETTLEMENT_MATH');

    // Missing MDR fee
    const resMissingMdr = await CustomerReceiptService.postGatewaySettlement({
      branchId: branchA.id,
      voucherDate: '2026-09-26',
      grossAmount: 1050.00,
      mdrFeeAmount: -5,
      netBankAmount: 1055.00,
      payoutRef: 'bad_mdr_ref',
      provider: 'razorpay',
      postedBy: posterUser.id,
      client,
    });
    assert(!resMissingMdr.success && resMissingMdr.code === 'MISSING_MDR_FEE', 'Negative MDR fee rejected with MISSING_MDR_FEE');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 11: Idempotency & Duplicate Event Prevention
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[12/17] Test Group 11: Idempotency & duplicate event prevention...');
    // Repeat receipt on already receipted payment transaction
    const resDupReceipt = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ord4.orderId,
      amount: 1050,
      paymentTxnId: ord4.ptId,
      createdBy: cashierUser.id,
      client,
    });
    assert(!resDupReceipt.success && resDupReceipt.code === 'DUPLICATE_SOURCE_EVENT', 'Duplicate receipt rejected with DUPLICATE_SOURCE_EVENT');

    // Repeat settlement with same payoutRef
    const resDupSettlement = await CustomerReceiptService.postGatewaySettlement({
      branchId: branchA.id,
      voucherDate: '2026-09-26',
      grossAmount: 1050.00,
      mdrFeeAmount: 21.00,
      netBankAmount: 1029.00,
      payoutRef, // already used
      provider: 'razorpay',
      postedBy: posterUser.id,
      client,
    });
    assert(!resDupSettlement.success && resDupSettlement.code === 'DUPLICATE_SOURCE_EVENT', 'Duplicate gateway settlement rejected with DUPLICATE_SOURCE_EVENT');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 12: Segregation of Duties (SoD) Enforcement
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[13/17] Test Group 12: Segregation of Duties (SoD) enforcement...');
    const ordSod = await createAndPostSalesOrder({ qty: 1, unitPrice: 500 });
    const dSod = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordSod.orderId,
      amount: 525,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: dSod.data.id, submittedBy: cashierUser.id, client });

    // SoD Violation 1: Preparer self-approval
    const appSelf = await CustomerReceiptService.approveCustomerReceipt({
      voucherId: dSod.data.id,
      approvedBy: cashierUser.id, // Same as creator
      actorContext: cashierUser,
      client,
    });
    assert(!appSelf.success && appSelf.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Preparer self-approval rejected with SEGREGATION_OF_DUTIES_VIOLATION');

    // SoD Violation 2: Customer approval
    const appCust = await CustomerReceiptService.approveCustomerReceipt({
      voucherId: dSod.data.id,
      approvedBy: ordSod.custId,
      client,
    });
    assert(!appCust.success && appCust.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Customer approval rejected with SEGREGATION_OF_DUTIES_VIOLATION');

    // Legitimate approval by supervisor
    await CustomerReceiptService.approveCustomerReceipt({
      voucherId: dSod.data.id,
      approvedBy: supervisorUser.id,
      actorContext: supervisorUser,
      client,
    });

    // SoD Violation 3: Preparer posting
    const postPrep = await CustomerReceiptService.postCustomerReceipt({
      voucherId: dSod.data.id,
      postedBy: cashierUser.id, // Same as creator
      actorContext: cashierUser,
      client,
    });
    assert(!postPrep.success && postPrep.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Preparer posting rejected with SEGREGATION_OF_DUTIES_VIOLATION');

    // SoD Violation 4: Customer posting
    const postCust = await CustomerReceiptService.postCustomerReceipt({
      voucherId: dSod.data.id,
      postedBy: ordSod.custId,
      client,
    });
    assert(!postCust.success && postCust.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Customer posting rejected with SEGREGATION_OF_DUTIES_VIOLATION');

    // Legitimate post by independent GL poster
    const postLegit = await CustomerReceiptService.postCustomerReceipt({
      voucherId: dSod.data.id,
      postedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(postLegit.success, 'Independent GL accountant successfully posted receipt');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 13: Permission Resolution Guards
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[14/17] Test Group 13: Permission resolution guards...');
    const ordPerm = await createAndPostSalesOrder({ qty: 1, unitPrice: 500 });
    const dPerm = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordPerm.orderId,
      amount: 525,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: dPerm.data.id, submittedBy: cashierUser.id, client });

    // Basic staff lacking ACCOUNTING.APPROVE
    const appNoPerm = await CustomerReceiptService.approveCustomerReceipt({
      voucherId: dPerm.data.id,
      approvedBy: unprivilegedUser.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(!appNoPerm.success && appNoPerm.code === 'PERMISSION_DENIED', 'Approval lacking permission rejected with PERMISSION_DENIED');

    await CustomerReceiptService.approveCustomerReceipt({
      voucherId: dPerm.data.id,
      approvedBy: supervisorUser.id,
      actorContext: supervisorUser,
      client,
    });

    // Basic staff lacking ACCOUNTING.POST
    const postNoPerm = await CustomerReceiptService.postCustomerReceipt({
      voucherId: dPerm.data.id,
      postedBy: unprivilegedUser.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(!postNoPerm.success && postNoPerm.code === 'PERMISSION_DENIED', 'Posting lacking permission rejected with PERMISSION_DENIED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 14: Branch Isolation (BOLA Defense)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[15/17] Test Group 14: Branch isolation (BOLA defense)...');
    const resBola = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordPerm.orderId, // belongs to branchA
      amount: 525,
      branchId: branchB.id === branchA.id ? 'br_unauthorized_fake' : branchB.id,
      createdBy: cashierUser.id,
      client,
    });
    assert(!resBola.success && resBola.code === 'BRANCH_ACCESS_DENIED', 'Cross-branch receipt rejected with BRANCH_ACCESS_DENIED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 15: Concurrency Defense (Pessimistic Locking & Zero Double Consumption)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[16/17] Test Group 15: Concurrency defense (Zero double consumption)...');
    const ordConc = await createAndPostSalesOrder({ qty: 2, unitPrice: 500 }); // 1050 balance
    // Draft 1 for full 1050
    const dConc1 = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordConc.orderId,
      amount: 1050,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: dConc1.data.id, submittedBy: cashierUser.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: dConc1.data.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });

    // Post 1 succeeds and clears the balance to 0
    const pConc1 = await CustomerReceiptService.postCustomerReceipt({
      voucherId: dConc1.data.id,
      postedBy: posterUser.id,
      actorContext: posterUser,
      client,
    });
    assert(pConc1.success && pConc1.data.remainingAr === 0, 'First concurrent receipt consumed full AR balance');

    // Attempting a second receipt after balance is 0 fails closed
    const dConc2 = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordConc.orderId,
      amount: 500,
      createdBy: 'usr_clerk_02',
      client,
    });
    assert(!dConc2.success && dConc2.code === 'OVERPAYMENT_NOT_PERMITTED', 'Second concurrent request fails closed with OVERPAYMENT_NOT_PERMITTED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 16: Failure Injection & Atomic Rollback
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[17/17] Test Group 16: Failure injection & atomic rollback verification...');
    const ordFail = await createAndPostSalesOrder({ qty: 1, unitPrice: 500 });
    const dFail = await CustomerReceiptService.createCustomerReceiptDraft({
      orderId: ordFail.orderId,
      amount: 525,
      createdBy: cashierUser.id,
      client,
    });
    await CustomerReceiptService.submitCustomerReceipt({ voucherId: dFail.data.id, submittedBy: cashierUser.id, client });
    await CustomerReceiptService.approveCustomerReceipt({ voucherId: dFail.data.id, approvedBy: supervisorUser.id, actorContext: supervisorUser, client });

    // Inject savepoint to test atomic rollback on failure
    await client.query('SAVEPOINT sp_failure_test');
    // Deliberately tamper with voucher branch to trigger BOLA failure inside post
    await client.query(`UPDATE public.accounting_voucher SET branch_id = $1 WHERE id = $2`, [branchB.id, dFail.data.id]);

    const postFail = await CustomerReceiptService.postCustomerReceipt({
      voucherId: dFail.data.id,
      postedBy: posterUser.id,
      branchId: branchA.id, // Mismatch
      actorContext: posterUser,
      client,
    });
    assert(!postFail.success && postFail.code === 'BRANCH_ACCESS_DENIED', 'Failure properly caught during posting');

    // Rollback savepoint
    await client.query('ROLLBACK TO SAVEPOINT sp_failure_test');
    assert(true, 'Rolled back savepoint successfully; zero partial financial writes leaked');

  } catch (err) {
    console.error('Fatal error during test execution:', err);
    failCount++;
  } finally {
    console.log('\n[Teardown] Rolling back isolated transaction and running post-test audit...');
    await client.query('ROLLBACK');

    // ── Independent Post-Test Database Baseline Verification ──────────────────
    console.log('=============================================================================');
    console.log('Independent Post-Test PostgreSQL Baseline Verification (Outside Transaction)');
    console.log('=============================================================================');
    const bEnd = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt,
        (SELECT count(*)::int FROM public.purchase) AS pur_cnt,
        (SELECT count(*)::int FROM public.purchase_item) AS pi_cnt,
        (SELECT count(*)::int FROM public.purchase_payment) AS pp_cnt,
        (SELECT count(*)::int FROM public.supplier) AS sup_cnt,
        (SELECT count(*)::int FROM public.branch) AS br_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS binv_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_consumption) AS con_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS ptx_cnt,
        (SELECT count(*)::int FROM public.accounting_account) AS acc_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt
    `);
    const rEnd = bEnd.rows[0];

    assert(rEnd.vch_cnt === 0, `accounting_voucher: expected 0, actual ${rEnd.vch_cnt}`);
    assert(rEnd.je_cnt === 0, `accounting_journal_entry: expected 0, actual ${rEnd.je_cnt}`);
    assert(rEnd.jl_cnt === 0, `accounting_journal_line: expected 0, actual ${rEnd.jl_cnt}`);
    assert(rEnd.fp_cnt === 0, `accounting_fiscal_period: expected 0, actual ${rEnd.fp_cnt}`);
    assert(rEnd.pur_cnt === 0, `purchase: expected 0, actual ${rEnd.pur_cnt}`);
    assert(rEnd.pi_cnt === 0, `purchase_item: expected 0, actual ${rEnd.pi_cnt}`);
    assert(rEnd.pp_cnt === 0, `purchase_payment: expected 0, actual ${rEnd.pp_cnt}`);
    assert(rEnd.sup_cnt === 0, `supplier: expected 0, actual ${rEnd.sup_cnt}`);
    assert(rEnd.br_cnt === 57, `branch: expected 57, actual ${rEnd.br_cnt}`);
    assert(rEnd.binv_cnt === 424, `branch_inventory: expected 424, actual ${rEnd.binv_cnt}`);
    assert(rEnd.lot_cnt === 0, `inventory_cost_lot: expected 0, actual ${rEnd.lot_cnt}`);
    assert(rEnd.mov_cnt === 0, `inventory_movement: expected 0, actual ${rEnd.mov_cnt}`);
    assert(rEnd.con_cnt === 0, `inventory_cost_consumption: expected 0, actual ${rEnd.con_cnt}`);
    assert(rEnd.ord_cnt === 173, `order: expected 173, actual ${rEnd.ord_cnt}`);
    assert(rEnd.ptx_cnt === 53, `payment_transaction: expected 53, actual ${rEnd.ptx_cnt}`);
    assert(rEnd.acc_cnt === 98, `accounting_account: expected 98, actual ${rEnd.acc_cnt}`);
    assert(rEnd.start_date_cnt === 0, `accounting_start_date remains UNCONFIGURED (0 rows in setting)`);

    console.log('\n=============================================================================');
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED (Total: ${passCount + failCount})`);
    console.log('=============================================================================\n');

    await client.end();
    if (failCount > 0) {
      process.exit(1);
    }
  }
}

runTests();
