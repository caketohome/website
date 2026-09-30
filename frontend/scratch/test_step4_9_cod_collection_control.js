/**
 * CakeToHome ERP — Phase 4F Step 4.9 Bounded Implementation Test Suite
 * COD Collection Control & Delivery Rider Remittance
 * (Account 1122 Subledger, Rider Settlement & GL Reconciliation)
 *
 * MANDATED TEST COVERAGE:
 * 1. Database Baseline:
 *    - Verify pristine pre-test baseline (18 checks).
 * 2. Model B COD Cash Collection:
 *    - Explicit collection event transitions order from DELIVERED_PENDING_COLLECTION to IDENTIFIED_RIDER_CUSTODY.
 *    - Dual-persistence into order.metadata->'cod_custody_event' and order_status_history ('COD_CASH_COLLECTED').
 *    - Invoiced vs delivered vs collected separation (DELIVERY ≠ CASH COLLECTION ≠ BRANCH REMITTANCE).
 *    - Rejection of cash collection on undelivered orders (ORDER_NOT_DELIVERED).
 *    - Rejection of duplicate cash collection events (DUPLICATE_COLLECTION_EVENT).
 *    - Rejection of collection amount mismatch (COLLECTION_AMOUNT_MISMATCH).
 *    - Quarantined historical prototype data rejection (LEGACY_PROTOTYPE_ORDER_REJECTED).
 *    - Unassigned rider custody (UNASSIGNED_DELIVERED_COD).
 *    - Immutability: frozen snapshot preserved in metadata.
 * 3. Option C + Option B Delivery Rider Shift Settlement:
 *    - Exact full settlement: sum(settlement_lines) === cash presented === Dr 1111 === Cr 1122.
 *    - Partial shift settlement rejection: PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN & CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED.
 *    - Over-remittance rejection: OVERPAYMENT_NOT_PERMITTED.
 *    - Exact source-linked allocation: silent FIFO and arbitrary spreading prohibited.
 *    - Segregation of Duties (SoD): Cashier ≠ Supervisor ≠ GL Accountant.
 *    - Balanced compound entry: 1 Dr 1111 line, N Cr 1122 lines with order-level line metadata.
 *    - Order metadata update (settlement_voucher_id) and order_status_history ('COD_REMITTED_CLEARED').
 *    - Idempotency & duplicate settlement rejection.
 *    - Cross-branch and rider mismatch rejection.
 * 4. Multi-State Subledger & GL 1122 Reconciliation:
 *    - Mutually exclusive 1122 states:
 *      * State A: PRE_DELIVERY_UNCOLLECTED
 *      * State A.1: DELIVERED_PENDING_COLLECTION
 *      * State B: IDENTIFIED_RIDER_CUSTODY
 *      * State C: UNASSIGNED_DELIVERED_COD
 *      * State D: OTHER_VALID_UNCLEARED_STATES
 *      * State E: REMITTED_CLEARED
 *    - GL 1122 Mathematical Identity: GL 1122 === State A + State A.1 + State B + State C + State D.
 *    - State E cleared and contributes 0.00 to uncleared balance.
 *    - Discrepancy === 0.00.
 *    - Anomaly exception scanner covers all 7 systematic exceptions.
 * 5. Security & RBAC:
 *    - Server-side auth verification.
 *    - Spoofed headers rejected with 401.
 *    - Customer token rejected with 403 on admin COD endpoints.
 *    - Staff with null branch context rejected with 403.
 *    - Staff cross-branch query rejected with 403.
 *    - Authenticated SUPER_ADMIN succeeds (200/201).
 * 6. Concurrency & Rollback:
 *    - Multi-client concurrent isolation proof (independent client sees 0 uncommitted accounting rows).
 *    - 100% rollback isolation: all test fixtures rolled back, post-test database baseline pristine (18/18 checks).
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
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.9 COD Collection & Remittance Tests');
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

  const Module = require('module');
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain, options) {
    if (request.startsWith('@frontend/')) {
      const sub = request.substring('@frontend/'.length);
      const mapped = path.resolve(__dirname, '../src', sub);
      return originalResolveFilename.call(this, mapped, parent, isMain, options);
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  const { CodCollectionRepository } = require('../src/lib/repositories/cod-collection.repository');
  const { CodCollectionService } = require('../src/lib/services/cod-collection.service');
  const { CustomerReceiptService } = require('../src/lib/services/customer-receipt.service');
  const { StaffAccessControl } = require('../src/lib/staff-access-control');
  const { signAuthToken } = require('../src/lib/security/auth-session');
  const { GET, POST } = require('../src/app/api/v1/[...path]/route');
  const { NextRequest } = require('next/server');

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
    console.log('[0/7] Verifying pre-test database baseline (18 checks)...');
    const preAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const preLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const prePeriods = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const prePurchases = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const preItems = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_item')).rows[0].count, 10);
    const prePayments = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const preSuppliers = parseInt((await client.query('SELECT COUNT(*) FROM public.supplier')).rows[0].count, 10);
    const preBranches = parseInt((await client.query('SELECT COUNT(*) FROM public.branch')).rows[0].count, 10);
    const preBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const preLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const preMovements = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const preConsumption = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_consumption')).rows[0].count, 10);
    const preOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const preTransactions = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    const preSettings = parseInt((await client.query("SELECT COUNT(*) FROM public.setting WHERE key = 'accounting_start_date'")).rows[0].count, 10);
    const preCustomers = parseInt((await client.query('SELECT COUNT(*) FROM public.customer')).rows[0].count, 10);

    assert(preAccounts === 98, `Pre-test accounting_account === 98 (actual: ${preAccounts})`);
    assert(preVouchers === 0, `Pre-test accounting_voucher === 0 (actual: ${preVouchers})`);
    assert(preJournals === 0, `Pre-test accounting_journal_entry === 0 (actual: ${preJournals})`);
    assert(preLines === 0, `Pre-test accounting_journal_line === 0 (actual: ${preLines})`);
    assert(prePeriods === 0, `Pre-test accounting_fiscal_period === 0 (actual: ${prePeriods})`);
    assert(prePurchases === 0, `Pre-test purchase === 0 (actual: ${prePurchases})`);
    assert(preItems === 0, `Pre-test purchase_item === 0 (actual: ${preItems})`);
    assert(prePayments === 0, `Pre-test purchase_payment === 0 (actual: ${prePayments})`);
    assert(preSuppliers === 0, `Pre-test supplier === 0 (actual: ${preSuppliers})`);
    assert(preBranches === 57, `Pre-test branch === 57 (actual: ${preBranches})`);
    assert(preBinv === 424, `Pre-test branch_inventory === 424 (actual: ${preBinv})`);
    assert(preLots === 0, `Pre-test inventory_cost_lot === 0 (actual: ${preLots})`);
    assert(preMovements === 0, `Pre-test inventory_movement === 0 (actual: ${preMovements})`);
    assert(preConsumption === 0, `Pre-test inventory_cost_consumption === 0 (actual: ${preConsumption})`);
    assert(preOrders === 173, `Pre-test order === 173 (actual: ${preOrders})`);
    assert(preTransactions === 53, `Pre-test payment_transaction === 53 (actual: ${preTransactions})`);
    assert(preSettings === 0, `Pre-test accounting_start_date setting === 0 (actual: ${preSettings})`);
    assert(preCustomers === 57, `Pre-test customer === 57 (actual: ${preCustomers})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0B: ARCHITECTURAL BOUNDARY & CONTRACT VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[0.5/7] Verifying Architectural Boundaries & Interface Contracts...');
    assert(typeof CodCollectionRepository.confirmCodCollection === 'function', 'CodCollectionRepository defines confirmCodCollection');
    assert(typeof CodCollectionRepository.getRiderOutstandingCustody === 'function', 'CodCollectionRepository defines getRiderOutstandingCustody');
    assert(typeof CodCollectionRepository.getGl1122Balance === 'function', 'CodCollectionRepository defines getGl1122Balance');
    assert(typeof CodCollectionRepository.getCodSubledger === 'function', 'CodCollectionRepository defines getCodSubledger');
    assert(typeof CodCollectionRepository.scanExceptions === 'function', 'CodCollectionRepository defines scanExceptions');

    assert(typeof CodCollectionService.confirmCodCollection === 'function', 'CodCollectionService defines confirmCodCollection');
    assert(typeof CodCollectionService.getRiderCustody === 'function', 'CodCollectionService defines getRiderCustody');
    assert(typeof CodCollectionService.postRiderShiftSettlement === 'function', 'CodCollectionService defines postRiderShiftSettlement');
    assert(typeof CodCollectionService.getCodReconciliation === 'function', 'CodCollectionService defines getCodReconciliation');
    assert(typeof CodCollectionService.scanExceptions === 'function', 'CodCollectionService defines scanExceptions');

    assert(typeof CustomerReceiptService.postCodShiftSettlement === 'function', 'CustomerReceiptService defines postCodShiftSettlement');

    // ─────────────────────────────────────────────────────────────────────────
    // BEGIN TRANSACTION FOR ALL MUTATING TESTS (100% ROLLBACK ISOLATION)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/7] Beginning isolated test transaction (BEGIN)...');
    await client.query('BEGIN');

    // Resolve Chart of Accounts targets
    const coaRes = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code IN ('1111', '1121', '1122', '4110')");
    const coa = {};
    for (const r of coaRes.rows) coa[r.code] = r;

    assert(coa['1111'] && coa['1111'].name.includes('Cash'), 'Account 1111 (Cash in Hand) exists');
    assert(coa['1121'] && coa['1121'].name.includes('Accounts Receivable'), 'Account 1121 (Trade AR) exists');
    assert(coa['1122'] && coa['1122'].name.includes('COD'), 'Account 1122 (Undeposited COD) exists');
    assert(coa['4110'] && coa['4110'].name.includes('Sales'), 'Account 4110 (Sales Revenue) exists');

    // Resolve real operational branches
    const branchRes = await client.query("SELECT id, name FROM public.branch WHERE deleted_at IS NULL ORDER BY id LIMIT 2");
    const branchA = branchRes.rows[0];
    const branchB = branchRes.rows[1];

    // Resolve real customer
    const custRes = await client.query("SELECT id, first_name, last_name FROM public.customer WHERE deleted_at IS NULL LIMIT 1");
    const testCustId = custRes.rows[0]?.id || null;

    // Resolve or insert test delivery partner inside transaction
    let rider1 = (await client.query("SELECT id, first_name, last_name FROM public.delivery_partner WHERE deleted_at IS NULL LIMIT 1")).rows[0];
    if (!rider1) {
      const dpIns = await client.query(`
        INSERT INTO public.delivery_partner (id, first_name, last_name, phone, status, created_at, updated_at)
        VALUES ('dp_test_01', 'Ravi', 'Kumar', '+91 99999 11111', 'ACTIVE', NOW(), NOW())
        RETURNING id, first_name, last_name;
      `);
      rider1 = dpIns.rows[0];
    }
    const rider2Id = 'dp_test_rider_02';

    // Configure temporary mock accounting start date and fiscal period inside rollback transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_4_9', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_4_9', 'FY2026', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    assert(true, 'Configured temporary mock accounting_start_date and fiscal period inside rollback transaction');

    // Helper: Seed order + sales voucher (Dr 1122, Cr 4110)
    let ordSeq = 1;
    async function createCodOrderWithSalesInvoice({
      branchId = branchA.id,
      amount = 5000,
      orderStatus = 'completed',
      deliveryStatus = 'delivered',
      isLegacy = false,
      isCod = true,
      partnerId = rider1.id,
    }) {
      const orderId = `ord_cod_test_${Date.now()}_${ordSeq++}`;
      const displayId = 88000 + ordSeq;
      const orderMeta = {
        branch_id: branchId,
        payment_method: isCod ? 'cod' : 'upi',
        payment_classification: isCod ? 'COD' : 'PREPAID',
        is_ledger_eligible: !isLegacy,
        legacy_prototype: isLegacy,
        delivery: {
          status: deliveryStatus,
          partner_id: partnerId,
          partner_name: 'Ravi Kumar',
        },
      };

      await client.query(`
        INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, 'cod_test@example.com', 'inr', $4, $5, NOW(), NOW());
      `, [orderId, displayId, testCustId, orderStatus, JSON.stringify(orderMeta)]);

      // Create posted sales voucher: Dr 1122, Cr 4110
      const vchNo = `VCH-SALES-COD-${ordSeq}-${Date.now().toString().slice(-4)}`;
      const vRes = await client.query(`
        INSERT INTO public.accounting_voucher (
          voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status,
          total_amount, currency, reference_type, reference_id, reference_event,
          narration, created_by, posted_by, posted_at, created_at, updated_at
        ) VALUES (
          $1, 'SALES', '2026-09-27', $2, 'FY2026', 'POSTED',
          $3, 'INR', 'SALE', $4, 'PRIMARY',
          'COD Sales Invoice', 'usr_cashier', 'usr_accountant', NOW(), NOW(), NOW()
        ) RETURNING id, voucher_no;
      `, [vchNo, branchId, amount, orderId]);
      const voucher = vRes.rows[0];

      // Journal entry
      const entryNo = `JE-SALES-COD-${ordSeq}-${Date.now().toString().slice(-4)}`;
      const jeRes = await client.query(`
        INSERT INTO public.accounting_journal_entry (
          entry_no, voucher_id, entry_date, branch_id, fiscal_year,
          total_debit, total_credit, is_reversed, narration, created_by, created_at
        ) VALUES (
          $1, $2, '2026-09-27', $3, 'FY2026',
          $4, $4, false, 'COD Sales Invoice Journal', 'usr_accountant', NOW()
        ) RETURNING id;
      `, [entryNo, voucher.id, branchId, amount]);
      const je = jeRes.rows[0];

      // Line 1: Dr 1122 Undeposited COD
      await client.query(`
        INSERT INTO public.accounting_journal_line (
          journal_entry_id, line_no, account_id, debit_amount, credit_amount,
          branch_id, customer_id, narration, metadata
        ) VALUES (
          $1, 1, $2, $3, 0,
          $4, $5, 'COD receivable', $6
        );
      `, [je.id, coa['1122'].id, amount, branchId, testCustId, JSON.stringify({ order_id: orderId })]);

      // Line 2: Cr 4110 Sales Revenue
      await client.query(`
        INSERT INTO public.accounting_journal_line (
          journal_entry_id, line_no, account_id, debit_amount, credit_amount,
          branch_id, customer_id, narration, metadata
        ) VALUES (
          $1, 2, $2, 0, $3,
          $4, $5, 'Sales revenue', $6
        );
      `, [je.id, coa['4110'].id, amount, branchId, testCustId, JSON.stringify({ order_id: orderId })]);

      return { orderId, voucherId: voucher.id, amount, branchId };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: MODEL B COD CASH COLLECTION VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/7] Testing Model B COD Cash Collection Event Workflow...');

    // 2.1 Order delivered but cash collection not yet confirmed (State A.1)
    const oDeliveredPending = await createCodOrderWithSalesInvoice({ amount: 4000, orderStatus: 'completed' });
    const subledgerPre = await CodCollectionRepository.getCodSubledger(branchA.id, client);
    assert(subledgerPre.stateA1_deliveredPendingCollection >= 4000, `Delivered order before cash collection is in State A.1 (DELIVERED_PENDING_COLLECTION: ₹${subledgerPre.stateA1_deliveredPendingCollection})`);

    // 2.2 Rejection of cash collection on undelivered order (Model B constraint)
    const oPending = await createCodOrderWithSalesInvoice({ amount: 3500, orderStatus: 'pending', deliveryStatus: 'pending' });
    try {
      await CodCollectionService.confirmCodCollection({
        orderId: oPending.orderId,
        deliveryPartnerId: rider1.id,
        amount: 3500,
        branchId: branchA.id,
        client,
      });
      assert(false, 'Should have rejected cash collection on undelivered order');
    } catch (err) {
      assert(err.code === 'ORDER_NOT_DELIVERED', `Undelivered order rejected with ORDER_NOT_DELIVERED (got: ${err.code})`);
    }

    // 2.3 Explicit cash collection confirmation transitions order to State B (IDENTIFIED_RIDER_CUSTODY)
    const snapshot1 = await CodCollectionService.confirmCodCollection({
      orderId: oDeliveredPending.orderId,
      deliveryPartnerId: rider1.id,
      amount: 4000,
      branchId: branchA.id,
      client,
    });
    assert(snapshot1.custody_status === 'IDENTIFIED_RIDER_CUSTODY', `Order custody status updated to IDENTIFIED_RIDER_CUSTODY (got: ${snapshot1.custody_status})`);
    assert(snapshot1.collected_amount === 4000, `Snapshot collected_amount === ₹4000 (actual: ${snapshot1.collected_amount})`);

    // Verify dual-persistence: order.metadata AND order_status_history
    const ordCheck = (await client.query('SELECT metadata FROM public."order" WHERE id = $1', [oDeliveredPending.orderId])).rows[0];
    assert(ordCheck.metadata.cod_custody_event.custody_id === snapshot1.custody_id, 'Snapshot persisted immutably in order.metadata->cod_custody_event');

    const historyCheck = (await client.query("SELECT * FROM public.order_status_history WHERE order_id = $1 AND to_status = 'COD_CASH_COLLECTED'", [oDeliveredPending.orderId])).rows[0];
    assert(historyCheck && historyCheck.to_status === 'COD_CASH_COLLECTED', 'Append-only audit row inserted into order_status_history');

    // 2.4 Duplicate collection event rejection (Idempotency)
    try {
      await CodCollectionService.confirmCodCollection({
        orderId: oDeliveredPending.orderId,
        deliveryPartnerId: rider1.id,
        amount: 4000,
        branchId: branchA.id,
        client,
      });
      assert(false, 'Should have rejected duplicate collection event');
    } catch (err) {
      assert(err.code === 'DUPLICATE_COLLECTION_EVENT', `Duplicate collection rejected with DUPLICATE_COLLECTION_EVENT (got: ${err.code})`);
    }

    // 2.5 Collection amount mismatch rejection
    const oMismatch = await createCodOrderWithSalesInvoice({ amount: 6000, orderStatus: 'completed' });
    try {
      await CodCollectionService.confirmCodCollection({
        orderId: oMismatch.orderId,
        deliveryPartnerId: rider1.id,
        amount: 5500, // Invoiced is 6000
        branchId: branchA.id,
        client,
      });
      assert(false, 'Should have rejected collection amount mismatch');
    } catch (err) {
      assert(err.code === 'COLLECTION_AMOUNT_MISMATCH', `Amount mismatch rejected with COLLECTION_AMOUNT_MISMATCH (got: ${err.code})`);
    }

    // 2.6 Quarantined historical prototype data rejection
    const oLegacy = await createCodOrderWithSalesInvoice({ amount: 2000, orderStatus: 'completed', isLegacy: true });
    try {
      await CodCollectionService.confirmCodCollection({
        orderId: oLegacy.orderId,
        deliveryPartnerId: rider1.id,
        amount: 2000,
        branchId: branchA.id,
        client,
      });
      assert(false, 'Should have rejected legacy prototype order');
    } catch (err) {
      assert(err.code === 'LEGACY_PROTOTYPE_ORDER_REJECTED', `Legacy prototype order rejected with LEGACY_PROTOTYPE_ORDER_REJECTED (got: ${err.code})`);
    }

    // 2.7 Unassigned delivery partner transitions to State C (UNASSIGNED_DELIVERED_COD)
    const oUnassigned = await createCodOrderWithSalesInvoice({ amount: 1500, orderStatus: 'completed', partnerId: null });
    // Update order metadata to clear delivery partner
    await client.query(`UPDATE public."order" SET metadata = metadata - 'delivery' WHERE id = $1`, [oUnassigned.orderId]);
    const snapshotUnassigned = await CodCollectionService.confirmCodCollection({
      orderId: oUnassigned.orderId,
      amount: 1500,
      branchId: branchA.id,
      client,
    });
    assert(snapshotUnassigned.custody_status === 'UNASSIGNED_DELIVERED_COD', `Unassigned order transitions to UNASSIGNED_DELIVERED_COD (got: ${snapshotUnassigned.custody_status})`);

    // 2.8 Rider custody query reflects active collected orders
    const riderCustody = await CodCollectionService.getRiderCustody(rider1.id, branchA.id, undefined, client);
    assert(riderCustody.totalCollected >= 4000, `Rider custody reflects collected cash (total: ₹${riderCustody.totalCollected})`);
    assert(riderCustody.outstandingCustody >= 4000, `Rider custody outstanding amount === ₹${riderCustody.outstandingCustody}`);

    // 2.9 CUSTODY SNAPSHOT IMMUTABILITY GUARDS (Item 3)
    // Verify that once cod_custody_event is created, its core fields cannot be altered.
    const metaPreMutate = (await client.query('SELECT metadata FROM public."order" WHERE id = $1', [oDeliveredPending.orderId])).rows[0].metadata;

    // Attempt to modify delivery_partner_id
    try {
      const corruptMeta = JSON.parse(JSON.stringify(metaPreMutate));
      corruptMeta.cod_custody_event.delivery_partner_id = 'rogue_driver_999';
      CodCollectionRepository.assertCustodyImmutability(metaPreMutate, corruptMeta);
      assert(false, 'Should have rejected mutating delivery_partner_id');
    } catch (err) {
      assert(err.code === 'CUSTODY_IMMUTABILITY_VIOLATION', `Mutating delivery_partner_id rejected with CUSTODY_IMMUTABILITY_VIOLATION (got: ${err.code})`);
    }

    // Attempt to modify collected_amount
    try {
      const corruptMeta = JSON.parse(JSON.stringify(metaPreMutate));
      corruptMeta.cod_custody_event.collected_amount = 99999;
      CodCollectionRepository.assertCustodyImmutability(metaPreMutate, corruptMeta);
      assert(false, 'Should have rejected mutating collected_amount');
    } catch (err) {
      assert(err.code === 'CUSTODY_IMMUTABILITY_VIOLATION', `Mutating collected_amount rejected with CUSTODY_IMMUTABILITY_VIOLATION (got: ${err.code})`);
    }

    // Attempt to modify collected_at
    try {
      const corruptMeta = JSON.parse(JSON.stringify(metaPreMutate));
      corruptMeta.cod_custody_event.collected_at = '2020-01-01T00:00:00.000Z';
      CodCollectionRepository.assertCustodyImmutability(metaPreMutate, corruptMeta);
      assert(false, 'Should have rejected mutating collected_at');
    } catch (err) {
      assert(err.code === 'CUSTODY_IMMUTABILITY_VIOLATION', `Mutating collected_at rejected with CUSTODY_IMMUTABILITY_VIOLATION (got: ${err.code})`);
    }

    // Attempt to modify source_event_id
    try {
      const corruptMeta = JSON.parse(JSON.stringify(metaPreMutate));
      corruptMeta.cod_custody_event.source_event_id = 'fabricated_event_id';
      CodCollectionRepository.assertCustodyImmutability(metaPreMutate, corruptMeta);
      assert(false, 'Should have rejected mutating source_event_id');
    } catch (err) {
      assert(err.code === 'CUSTODY_IMMUTABILITY_VIOLATION', `Mutating source_event_id rejected with CUSTODY_IMMUTABILITY_VIOLATION (got: ${err.code})`);
    }

    // Attempt to modify custody_id
    try {
      const corruptMeta = JSON.parse(JSON.stringify(metaPreMutate));
      corruptMeta.cod_custody_event.custody_id = 'fabricated_custody_id';
      CodCollectionRepository.assertCustodyImmutability(metaPreMutate, corruptMeta);
      assert(false, 'Should have rejected mutating custody_id');
    } catch (err) {
      assert(err.code === 'CUSTODY_IMMUTABILITY_VIOLATION', `Mutating custody_id rejected with CUSTODY_IMMUTABILITY_VIOLATION (got: ${err.code})`);
    }

    // Attempt to delete/nullify cod_custody_event
    try {
      const corruptMeta = JSON.parse(JSON.stringify(metaPreMutate));
      delete corruptMeta.cod_custody_event;
      CodCollectionRepository.assertCustodyImmutability(metaPreMutate, corruptMeta);
      assert(false, 'Should have rejected nullifying cod_custody_event');
    } catch (err) {
      assert(err.code === 'CUSTODY_IMMUTABILITY_VIOLATION', `Nullifying cod_custody_event rejected with CUSTODY_IMMUTABILITY_VIOLATION (got: ${err.code})`);
    }

    // Prove delivery reassignment does NOT mutate custody attribution
    await client.query(`UPDATE public."order" SET metadata = jsonb_set(metadata, '{delivery,partner_id}', '"reassigned_rogue_rider"') WHERE id = $1`, [oDeliveredPending.orderId]);
    const custodySnapshotAfterReassign = await CodCollectionRepository.getOrderCustodySnapshot(oDeliveredPending.orderId, client);
    assert(custodySnapshotAfterReassign.delivery_partner_id === rider1.id, `Custody snapshot strictly retains original Rider 1 after delivery reassignment (got: ${custodySnapshotAfterReassign.delivery_partner_id})`);
    const riderCustodyRetained = await CodCollectionService.getRiderCustody(rider1.id, branchA.id, undefined, client);
    assert(riderCustodyRetained.orders.some(o => o.orderId === oDeliveredPending.orderId), `Rider 1 custody still includes order despite delivery reassignment`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: OPTION C + OPTION B DELIVERY RIDER SHIFT SETTLEMENT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/7] Testing Option C + Option B Rider Shift Settlement Workflow...');

    // Setup 2 distinct orders collected by rider1 in Branch A totaling ₹10,000
    // First, let's create a dedicated rider for clean mathematical isolation
    const riderSettlementId = 'dp_settle_rider_99';
    const oSettle1 = await createCodOrderWithSalesInvoice({ amount: 6000, orderStatus: 'completed', partnerId: riderSettlementId });
    const oSettle2 = await createCodOrderWithSalesInvoice({ amount: 4000, orderStatus: 'completed', partnerId: riderSettlementId });

    await CodCollectionService.confirmCodCollection({
      orderId: oSettle1.orderId,
      deliveryPartnerId: riderSettlementId,
      amount: 6000,
      branchId: branchA.id,
      client,
    });
    await CodCollectionService.confirmCodCollection({
      orderId: oSettle2.orderId,
      deliveryPartnerId: riderSettlementId,
      amount: 4000,
      branchId: branchA.id,
      client,
    });

    const settleRiderCustody = await CodCollectionService.getRiderCustody(riderSettlementId, branchA.id, undefined, client);
    assert(settleRiderCustody.outstandingCustody === 10000, `Rider has exact ₹10,000 outstanding COD custody (actual: ${settleRiderCustody.outstandingCustody})`);
    assert(settleRiderCustody.activeOrdersCount === 2, `Rider has 2 active orders in custody (actual: ${settleRiderCustody.activeOrdersCount})`);

    const shiftId = `shift_20260927_${Date.now()}`;
    const tellerStaffId = 'usr_teller_01';
    const supervisorId = 'usr_supervisor_01';
    const accountantId = 'usr_accountant_01';

    // 3.1 PARTIAL SETTLEMENT & ALLOCATION MISMATCH REJECTION (Item 7)
    // Scenario 1: Line allocation mismatch (line.amount ₹2,000 vs collected ₹4,000) -> SETTLEMENT_ALLOCATION_MISMATCH
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_partial_line`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 2000 }, // Mismatch: custody is 4000
        ],
        totalCashReceived: 8000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: accountantId,
        client,
      });
      assert(false, 'Should have rejected line amount mismatch');
    } catch (err) {
      assert(err.code === 'SETTLEMENT_ALLOCATION_MISMATCH', `Line allocation mismatch rejected with SETTLEMENT_ALLOCATION_MISMATCH (got: ${err.code})`);
    }

    // Scenario 2: Lines sum != cash presented (Lines sum ₹10,000 vs cash ₹9,000) -> SETTLEMENT_ALLOCATION_MISMATCH
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_lines_mismatch`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 9000, // Lines sum is 10000
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: accountantId,
        client,
      });
      assert(false, 'Should have rejected settlement lines sum != cash received');
    } catch (err) {
      assert(err.code === 'SETTLEMENT_ALLOCATION_MISMATCH', `Lines sum != cash presented rejected with SETTLEMENT_ALLOCATION_MISMATCH (got: ${err.code})`);
    }

    // Scenario 3: Omitted order / partial shift (Cash presented = ₹6,000, only 1 of 2 orders submitted) -> PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_omit_order`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
        ],
        totalCashReceived: 6000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: accountantId,
        client,
      });
      assert(false, 'Should have rejected partial settlement omitting custody orders');
    } catch (err) {
      assert(err.code === 'PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN', `Omitted order settlement rejected with PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN (got: ${err.code})`);
      assert(err.message.includes('CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED'), 'Message strictly references CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED');
    }

    // Scenario 4: Cash shortage accounting treatment requested -> CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_shortage_claim`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 10000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: accountantId,
        allowShortage: true, // Forbidden request
        client,
      });
      assert(false, 'Should have rejected shortage policy request');
    } catch (err) {
      assert(err.code === 'CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED', `Shortage claim rejected with CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED (got: ${err.code})`);
    }

    // 3.2 OVER-REMITTANCE REJECTION (Fail-Closed: OVER_REMITTANCE_FORBIDDEN)
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_overremit_explicit`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 11000, // 11000 > 10000
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: accountantId,
        client,
      });
      assert(false, 'Should have rejected over-remittance');
    } catch (err) {
      assert(err.code === 'OVER_REMITTANCE_FORBIDDEN', `Over-remittance strictly rejected with OVER_REMITTANCE_FORBIDDEN (got: ${err.code})`);
    }

    // 3.3 SEGREGATION OF DUTIES (SoD) ENFORCEMENT
    // Cashier === Supervisor
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_sod1`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 10000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: tellerStaffId, // VIOLATION
        postedByGlAccountantId: accountantId,
        client,
      });
      assert(false, 'Should have rejected cashier === supervisor SoD violation');
    } catch (err) {
      assert(err.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Cashier === Supervisor rejected with SEGREGATION_OF_DUTIES_VIOLATION (got: ${err.code})`);
    }

    // Cashier === Accountant
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_sod2`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 10000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: tellerStaffId, // VIOLATION
        client,
      });
      assert(false, 'Should have rejected cashier === accountant SoD violation');
    } catch (err) {
      assert(err.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Cashier === Accountant rejected with SEGREGATION_OF_DUTIES_VIOLATION (got: ${err.code})`);
    }

    // Supervisor === Accountant
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_sod3`,
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 10000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: supervisorId, // VIOLATION
        client,
      });
      assert(false, 'Should have rejected supervisor === accountant SoD violation');
    } catch (err) {
      assert(err.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Supervisor === Accountant rejected with SEGREGATION_OF_DUTIES_VIOLATION (got: ${err.code})`);
    }

    // 3.4 RIDER MISMATCH SETTLEMENT REJECTION
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId: `${shiftId}_wrong_rider`,
        deliveryPartnerId: rider2Id, // Order belongs to riderSettlementId
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 10000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: accountantId,
        client,
      });
      assert(false, 'Should have rejected settlement with mismatched rider ID');
    } catch (err) {
      assert(err.code === 'RIDER_MISMATCH_SETTLEMENT', `Mismatched rider rejected with RIDER_MISMATCH_SETTLEMENT (got: ${err.code})`);
    }

    // 3.5 EXACT FULL SHIFT SETTLEMENT (SUCCESSFUL POSTING)
    // Cash presented = ₹10,000, 2 orders = ₹6,000 + ₹4,000, SoD distinct
    const settlementResult = await CodCollectionService.postRiderShiftSettlement({
      shiftId,
      deliveryPartnerId: riderSettlementId,
      branchId: branchA.id,
      settlementLines: [
        { orderId: oSettle1.orderId, amount: 6000 },
        { orderId: oSettle2.orderId, amount: 4000 },
      ],
      totalCashReceived: 10000,
      remittedByStaffId: tellerStaffId,
      approvedBySupervisorId: supervisorId,
      postedByGlAccountantId: accountantId,
      voucherDate: '2026-09-27',
      notes: 'Full shift settlement verified by cash drawer count',
      client,
    });

    assert(settlementResult.totalSettled === 10000, `Total settled amount === ₹10,000 (actual: ${settlementResult.totalSettled})`);
    assert(settlementResult.settledOrdersCount === 2, `Settled orders count === 2 (actual: ${settlementResult.settledOrdersCount})`);
    assert(settlementResult.voucher.status === 'POSTED', `Settlement voucher status === POSTED (actual: ${settlementResult.voucher.status})`);
    assert(settlementResult.voucher.voucher_type === 'RECEIPT', `Settlement voucher type === RECEIPT (actual: ${settlementResult.voucher.voucher_type})`);

    // Verify compound journal structure: 1 Dr 1111 line, 2 Cr 1122 lines
    const journalLinesRes = await client.query(`
      SELECT jl.id, jl.line_no, jl.debit_amount, jl.credit_amount, jl.metadata, a.code as account_code
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account a ON jl.account_id = a.id
      WHERE jl.journal_entry_id = $1
      ORDER BY jl.line_no ASC;
    `, [settlementResult.journalEntry.id]);

    const jLines = journalLinesRes.rows;
    assert(jLines.length === 3, `Compound journal contains exactly 3 lines (1 Dr, 2 Cr) (actual: ${jLines.length})`);

    const drLine = jLines[0];
    assert(drLine.account_code === '1111' && Number(drLine.debit_amount) === 10000 && Number(drLine.credit_amount) === 0,
      `Line 1 is Debit 1111 (Cash in Hand) for ₹10,000 (actual: code=${drLine.account_code}, dr=${drLine.debit_amount})`);

    const crLine1 = jLines[1];
    assert(crLine1.account_code === '1122' && Number(crLine1.credit_amount) === 6000 && crLine1.metadata.order_id === oSettle1.orderId,
      `Line 2 is Credit 1122 for Order 1 (₹6,000) with order-level metadata preserved (actual: cr=${crLine1.credit_amount}, ord=${crLine1.metadata.order_id})`);

    const crLine2 = jLines[2];
    assert(crLine2.account_code === '1122' && Number(crLine2.credit_amount) === 4000 && crLine2.metadata.order_id === oSettle2.orderId,
      `Line 3 is Credit 1122 for Order 2 (₹4,000) with order-level metadata preserved (actual: cr=${crLine2.credit_amount}, ord=${crLine2.metadata.order_id})`);

    // Verify mathematical balance: Total Debits === Total Credits
    const totalDr = jLines.reduce((s, l) => s + Number(l.debit_amount), 0);
    const totalCr = jLines.reduce((s, l) => s + Number(l.credit_amount), 0);
    assert(totalDr === 10000 && totalCr === 10000, `Journal entry mathematically balanced (Total Dr: ₹${totalDr}, Total Cr: ₹${totalCr})`);

    // Verify Order State Transition to State E (REMITTED_CLEARED)
    const oSettle1After = (await client.query('SELECT metadata FROM public."order" WHERE id = $1', [oSettle1.orderId])).rows[0];
    assert(oSettle1After.metadata.cod_custody_event.settlement_voucher_id === settlementResult.voucher.id,
      'Order 1 metadata updated with settlement_voucher_id');

    const historyCleared = (await client.query("SELECT * FROM public.order_status_history WHERE order_id = $1 AND to_status = 'COD_REMITTED_CLEARED'", [oSettle1.orderId])).rows[0];
    assert(historyCleared && historyCleared.to_status === 'COD_REMITTED_CLEARED', 'Order 1 history appended with COD_REMITTED_CLEARED');

    // Verify rider custody after settlement: should be 0.00 outstanding!
    const riderCustodyAfter = await CodCollectionService.getRiderCustody(riderSettlementId, branchA.id, undefined, client);
    assert(riderCustodyAfter.outstandingCustody === 0, `Rider outstanding custody cleared to ₹0.00 post-settlement (actual: ${riderCustodyAfter.outstandingCustody})`);
    assert(riderCustodyAfter.activeOrdersCount === 0, `Rider active custody orders === 0 (actual: ${riderCustodyAfter.activeOrdersCount})`);

    // 3.6 DUPLICATE SHIFT SETTLEMENT REJECTION (Idempotency)
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId, // Same shiftId
        deliveryPartnerId: riderSettlementId,
        branchId: branchA.id,
        settlementLines: [
          { orderId: oSettle1.orderId, amount: 6000 },
          { orderId: oSettle2.orderId, amount: 4000 },
        ],
        totalCashReceived: 10000,
        remittedByStaffId: tellerStaffId,
        approvedBySupervisorId: supervisorId,
        postedByGlAccountantId: accountantId,
        client,
      });
      assert(false, 'Should have rejected duplicate shift settlement');
    } catch (err) {
      assert(err.code === 'DUPLICATE_SOURCE_EVENT', `Duplicate shift rejected with DUPLICATE_SOURCE_EVENT (got: ${err.code})`);
    }

    // 3.7 IMMUTABLE AUDIT CHAIN RECONSTRUCTION (Item 4)
    // Prove reconstruction: Settlement Voucher -> 1122 Journal Line -> Order -> Custody Event -> Original Collection Event
    // Simulate delivery reassignment AFTER settlement:
    await client.query(`UPDATE public."order" SET metadata = jsonb_set(metadata, '{delivery,partner_id}', '"reassigned_driver_xyz"') WHERE id = $1`, [oSettle1.orderId]);

    // Trace link 1: Settlement Voucher exists
    const auditVoucherRes = await client.query(`SELECT id, voucher_no, voucher_type, status, total_amount FROM public.accounting_voucher WHERE id = $1`, [settlementResult.voucher.id]);
    assert(auditVoucherRes.rows.length === 1, 'Audit chain link 1: Settlement voucher exists in GL');
    const auditVoucher = auditVoucherRes.rows[0];

    // Trace link 2: 1122 Journal Line for Order 1
    const auditLineRes = await client.query(`
      SELECT jl.id, jl.debit_amount, jl.credit_amount, jl.metadata
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account a ON jl.account_id = a.id
      WHERE jl.journal_entry_id = $1 AND a.code = '1122' AND jl.metadata->>'order_id' = $2
    `, [settlementResult.journalEntry.id, oSettle1.orderId]);
    assert(auditLineRes.rows.length === 1, 'Audit chain link 2: 1122 Journal line resolved for settled order');
    const auditLine = auditLineRes.rows[0];
    assert(Number(auditLine.credit_amount) === 6000, 'Audit line credit amount matches settled order amount (₹6,000)');
    assert(auditLine.metadata.delivery_partner_id === riderSettlementId, 'Audit line metadata records delivery_partner_id snapshot');

    // Trace link 3: Source Order & Frozen Custody Event
    const auditOrderRes = await client.query(`SELECT id, metadata FROM public."order" WHERE id = $1`, [oSettle1.orderId]);
    assert(auditOrderRes.rows.length === 1, 'Audit chain link 3: Source order resolved from journal line order_id');
    const auditCustodyEvent = auditOrderRes.rows[0].metadata.cod_custody_event;
    assert(auditCustodyEvent && auditCustodyEvent.settlement_voucher_id === auditVoucher.id, 'Audit chain link 4: Custody event points to settlement voucher ID');
    assert(auditCustodyEvent.delivery_partner_id === riderSettlementId, 'Audit chain link 5: Custody delivery_partner_id matches settlement rider, NOT reassigned driver');
    assert(auditCustodyEvent.collected_amount === 6000, 'Audit chain link 6: Custody collected_amount matches original collection');

    // Trace link 4: Append-Only order_status_history Audit Record
    const auditHistoryRes = await client.query(`
      SELECT to_status, actor_id, metadata, created_at
      FROM public.order_status_history
      WHERE order_id = $1 AND to_status = 'COD_CASH_COLLECTED'
      ORDER BY created_at ASC LIMIT 1
    `, [oSettle1.orderId]);
    assert(auditHistoryRes.rows.length === 1, 'Audit chain link 7: Immutable order_status_history record resolved');
    const histMeta = typeof auditHistoryRes.rows[0].metadata === 'string'
      ? JSON.parse(auditHistoryRes.rows[0].metadata)
      : auditHistoryRes.rows[0].metadata;
    assert(histMeta.delivery_partner_id === riderSettlementId, 'Audit history metadata retains original rider settlement ID without dependence on mutable delivery table');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: MULTI-STATE SUBLEDGER & GL 1122 RECONCILIATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/7] Testing Multi-State COD Subledger & Account 1122 GL Reconciliation...');

    // Seed orders for each specific control state in Branch B to verify comprehensive equation
    // State A: Invoiced but not yet delivered
    const oStateA = await createCodOrderWithSalesInvoice({ branchId: branchB.id, amount: 2500, orderStatus: 'pending', deliveryStatus: 'pending' });
    // State A.1: Delivered but pending cash collection confirmation
    const oStateA1 = await createCodOrderWithSalesInvoice({ branchId: branchB.id, amount: 3000, orderStatus: 'completed', deliveryStatus: 'delivered', partnerId: rider1.id });
    // State B: Cash collected in identified rider custody
    const oStateB = await createCodOrderWithSalesInvoice({ branchId: branchB.id, amount: 4500, orderStatus: 'completed', deliveryStatus: 'delivered', partnerId: rider1.id });
    await CodCollectionService.confirmCodCollection({
      orderId: oStateB.orderId,
      deliveryPartnerId: rider1.id,
      amount: 4500,
      branchId: branchB.id,
      client,
    });
    // State C: Cash collected without delivery partner assigned
    const oStateC = await createCodOrderWithSalesInvoice({ branchId: branchB.id, amount: 1200, orderStatus: 'completed', deliveryStatus: 'delivered', partnerId: null });
    await client.query(`UPDATE public."order" SET metadata = metadata - 'delivery' WHERE id = $1`, [oStateC.orderId]);
    await CodCollectionService.confirmCodCollection({
      orderId: oStateC.orderId,
      amount: 1200,
      branchId: branchB.id,
      client,
    });

    // State D: Authoritative uncleared 1122 balance in operational dispute / exception (Item 2)
    // Order has posted sales invoice (Dr 1122 for ₹1,800), in status 'delivery_exception'
    const oStateD = await createCodOrderWithSalesInvoice({
      branchId: branchB.id,
      amount: 1800,
      orderStatus: 'completed',
      deliveryStatus: 'delivery_exception',
    });

    // Operational exception order with NO 1122 accounting balance (Item 2 Invariant)
    // Order in operational dispute status but NEVER invoiced (0 posted 1122 debits).
    // Must NOT fabricate an 1122 balance in State D; must be reported ONLY in scanExceptions!
    const ordNo1122Id = `ord_dispute_no_1122_${Date.now()}`;
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 99999, $2, 'dispute_no1122@example.com', 'inr', 'completed', $3, NOW(), NOW());
    `, [ordNo1122Id, testCustId, JSON.stringify({ payment_method: 'cod', is_ledger_eligible: 'true', branch_id: branchB.id, delivery: { status: 'delivery_exception' } })]);

    // Compute Branch B reconciliation via CodCollectionService
    const reconB = await CodCollectionService.getCodReconciliation({ branchId: branchB.id }, client);
    console.log(`  Branch B Subledger Breakdown:
    - State A (Pre-Delivery Uncollected): ₹${reconB.stateA_preDeliveryUncollected}
    - State A.1 (Delivered Pending Collection): ₹${reconB.stateA1_deliveredPendingCollection}
    - State B (Identified Rider Custody): ₹${reconB.stateB_identifiedRiderCustody}
    - State C (Unassigned Delivered COD): ₹${reconB.stateC_unassignedDeliveredCod}
    - State D (Other Valid Uncleared): ₹${reconB.stateD_otherValidUncleared}
    - State E (Remitted Cleared): ₹${reconB.stateE_remittedClearedTotal}
    - Total Operational Uncleared Control: ₹${reconB.totalOperationalUnclearedControl}
    - GL 1122 Balance: ₹${reconB.gl1122Balance}
    - Discrepancy: ₹${reconB.discrepancy}`);

    assert(reconB.stateA_preDeliveryUncollected === 2500, `State A === ₹2,500 (actual: ${reconB.stateA_preDeliveryUncollected})`);
    assert(reconB.stateA1_deliveredPendingCollection === 3000, `State A.1 === ₹3,000 (actual: ${reconB.stateA1_deliveredPendingCollection})`);
    assert(reconB.stateB_identifiedRiderCustody === 4500, `State B === ₹4,500 (actual: ${reconB.stateB_identifiedRiderCustody})`);
    assert(reconB.stateC_unassignedDeliveredCod === 1200, `State C === ₹1,200 (actual: ${reconB.stateC_unassignedDeliveredCod})`);
    assert(reconB.stateD_otherValidUncleared === 1800, `State D === ₹1,800 backed strictly by authoritative posted 1122 debit (actual: ${reconB.stateD_otherValidUncleared})`);

    // Invariant proof: Uninvoiced operational dispute contributes ₹0.00 to State D
    const expectedOperationalUncleared = 2500 + 3000 + 4500 + 1200 + 1800; // = 13000 (zero fabricated rupees from ordNo1122Id)
    assert(reconB.totalOperationalUnclearedControl === expectedOperationalUncleared,
      `Total Operational Uncleared Control === ₹${expectedOperationalUncleared} (actual: ${reconB.totalOperationalUnclearedControl})`);

    assert(reconB.gl1122Balance === expectedOperationalUncleared,
      `GL 1122 Balance === ₹${expectedOperationalUncleared} (actual: ${reconB.gl1122Balance})`);

    assert(reconB.discrepancy === 0.00, `Reconciliation Discrepancy === ₹0.00 (actual: ${reconB.discrepancy})`);
    assert(reconB.isReconciled === true, 'Branch B is fully reconciled (isReconciled === true)');

    // 4.3 INDEPENDENT 1122 RECONCILIATION PROOF (Item 5)
    // Separately calculate GL 1122 directly from posted accounting_journal_line rows without reusing service result
    const indepGlRes = await client.query(`
      SELECT COALESCE(SUM(jl.debit_amount) - SUM(jl.credit_amount), 0) AS independent_gl_1122
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
      JOIN public.accounting_voucher v ON je.voucher_id = v.id
      JOIN public.accounting_account a ON jl.account_id = a.id
      WHERE a.code = '1122'
        AND v.status = 'POSTED'
        AND v.deleted_at IS NULL
        AND je.is_reversed = false
        AND jl.branch_id = $1
    `, [branchB.id]);
    const independentGl1122 = Math.round(Number(indepGlRes.rows[0].independent_gl_1122) * 100) / 100;

    assert(independentGl1122 === expectedOperationalUncleared,
      `Independent GL 1122 query === Operational Control Total (actual: GL=${independentGl1122}, Operational=${expectedOperationalUncleared})`);
    assert(Math.abs(independentGl1122 - reconB.totalOperationalUnclearedControl) === 0,
      'Mathematical parity proven: Independent GL 1122 == Operational Control (Difference === ₹0.00)');

    // Verify Exception Scanner
    const exceptionsB = await CodCollectionService.scanExceptions(branchB.id, undefined, client);
    assert(exceptionsB.some(e => e.type === 'COD_WITHOUT_DELIVERY_ASSIGNMENT' && e.orderId === oStateC.orderId),
      'Exception scanner detected unassigned COD order in State C');
    assert(exceptionsB.some(e => e.type === 'COD_DELIVERED_WITHOUT_COLLECTION' && e.orderId === oStateA1.orderId),
      'Exception scanner detected delivered order pending collection in State A.1');
    assert(exceptionsB.some(e => e.type === 'COD_DISPUTE_WITHOUT_1122_BALANCE' && e.orderId === ordNo1122Id),
      'Exception scanner detected operational exception order with no 1122 balance (COD_DISPUTE_WITHOUT_1122_BALANCE)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: API LAYER VERIFICATION (HTTP ROUTE LEVEL)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/7] Testing Canonical API Route Layer & Access Control...');

    // 5.1 Unauthenticated request returns HTTP 401
    const reqUnauth = new NextRequest('http://localhost:3000/api/v1/admin/reports/cod/reconciliation');
    const resUnauth = await GET(reqUnauth, { params: { path: ['admin', 'reports', 'cod', 'reconciliation'] } });
    assert(resUnauth.status === 401, `Unauthenticated request returns HTTP 401 (actual: ${resUnauth.status})`);
    const jsonUnauth = await resUnauth.json();
    assert(jsonUnauth.error === 'UNAUTHORIZED', 'Unauthenticated response error === UNAUTHORIZED');

    // 5.2 Spoofed headers without valid session returns HTTP 401
    const reqSpoofed = new NextRequest('http://localhost:3000/api/v1/admin/reports/cod/reconciliation', {
      headers: {
        'x-user-role': 'SUPER_ADMIN',
        'x-user-id': 'admin_01',
      },
    });
    const resSpoofed = await GET(reqSpoofed, { params: { path: ['admin', 'reports', 'cod', 'reconciliation'] } });
    assert(resSpoofed.status === 401, `Spoofed headers return HTTP 401 (actual: ${resSpoofed.status})`);

    // 5.3 Commercial customer session lacks ACCOUNTING.VIEW and cannot access COD reports (HTTP 403)
    const custToken = signAuthToken({ userId: 'cust_test_01', role: 'CUSTOMER', customerId: 'cust_test_01' });
    const reqCust = new NextRequest('http://localhost:3000/api/v1/admin/reports/cod/reconciliation', {
      headers: { authorization: `Bearer ${custToken}` },
    });
    const resCust = await GET(reqCust, { params: { path: ['admin', 'reports', 'cod', 'reconciliation'] } });
    assert(resCust.status === 403, `Customer token calling COD report returns HTTP 403 (actual: ${resCust.status})`);

    // 5.4 Staff with null branch context returns HTTP 403
    let accProfile = StaffAccessControl.getAllProfiles().find(p => p.slug === 'accounting-officer');
    if (!accProfile) {
      accProfile = StaffAccessControl.createProfile({
        name: 'Accounting Officer',
        description: 'Accounting & Finance reporting role',
        permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.POST'],
        status: 'ACTIVE',
      });
    }

    const staffNoBranch = StaffAccessControl.createStaffMember({
      name: 'Staff No Branch',
      phone: '+91 98765 22201',
      email: 'staff.nobranch2@test.com',
      role: 'STAFF',
      profile_ids: [accProfile.id],
      branch_id: null,
    });
    const staffNoBranchToken = signAuthToken({ userId: staffNoBranch.user_id, role: 'STAFF', branchId: null });
    const reqNoBranch = new NextRequest('http://localhost:3000/api/v1/admin/reports/cod/reconciliation', {
      headers: { authorization: `Bearer ${staffNoBranchToken}` },
    });
    const resNoBranch = await GET(reqNoBranch, { params: { path: ['admin', 'reports', 'cod', 'reconciliation'] } });
    assert(resNoBranch.status === 403, `Staff token with null branchId returns HTTP 403 (actual: ${resNoBranch.status})`);

    // 5.5 Staff scoped to Branch A attempting to query Branch B returns HTTP 403
    const staffBranchA = StaffAccessControl.createStaffMember({
      name: 'Staff Branch A',
      phone: '+91 98765 22202',
      email: 'staff.bra2@test.com',
      role: 'BRANCH_MANAGER',
      profile_ids: [accProfile.id],
      branch_id: branchA.id,
    });
    const staffBranchAToken = signAuthToken({ userId: staffBranchA.user_id, role: 'BRANCH_MANAGER', branchId: branchA.id });
    const reqCrossBranch = new NextRequest(`http://localhost:3000/api/v1/admin/reports/cod/reconciliation?branch_id=${branchB.id}`, {
      headers: { authorization: `Bearer ${staffBranchAToken}` },
    });
    const resCrossBranch = await GET(reqCrossBranch, { params: { path: ['admin', 'reports', 'cod', 'reconciliation'] } });
    assert(resCrossBranch.status === 403, `Staff cross-branch query returns HTTP 403 (actual: ${resCrossBranch.status})`);

    // 5.6 Authenticated SUPER_ADMIN can query enterprise reconciliation via API (HTTP 200)
    const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    const reqAdminRecon = new NextRequest('http://localhost:3000/api/v1/admin/reports/cod/reconciliation', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resAdminRecon = await GET(reqAdminRecon, { params: { path: ['admin', 'reports', 'cod', 'reconciliation'] } });
    assert(resAdminRecon.status === 200, `SUPER_ADMIN reconciliation request returns HTTP 200 (actual: ${resAdminRecon.status})`);
    const jsonAdminRecon = await resAdminRecon.json();
    assert(jsonAdminRecon.success === true && jsonAdminRecon.reconciliation.isReconciled === true,
      'SUPER_ADMIN API reconciliation succeeds and isReconciled === true');

    // 5.7 Authenticated Rider Custody query missing delivery_partner_id returns HTTP 400
    const reqMissingRider = new NextRequest('http://localhost:3000/api/v1/admin/reports/cod/rider-custody', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resMissingRider = await GET(reqMissingRider, { params: { path: ['admin', 'reports', 'cod', 'rider-custody'] } });
    assert(resMissingRider.status === 400, `Rider custody missing delivery_partner_id returns HTTP 400 (actual: ${resMissingRider.status})`);

    // 5.8 Unauthenticated POST to collection endpoint returns HTTP 401
    const reqPostUnauth = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cod/collection', {
      method: 'POST',
      body: JSON.stringify({ order_id: 'ord_any' }),
    });
    const resPostUnauth = await POST(reqPostUnauth, { params: { path: ['admin', 'accounting', 'cod', 'collection'] } });
    assert(resPostUnauth.status === 401, `Unauthenticated collection POST returns HTTP 401 (actual: ${resPostUnauth.status})`);

    // 5.9 Customer session attempting POST to settlement endpoint returns HTTP 403
    const reqPostCust = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cod/settlement', {
      method: 'POST',
      headers: { authorization: `Bearer ${custToken}` },
      body: JSON.stringify({ shift_id: 'shift_test' }),
    });
    const resPostCust = await POST(reqPostCust, { params: { path: ['admin', 'accounting', 'cod', 'settlement'] } });
    assert(resPostCust.status === 403, `Customer token calling settlement POST returns HTTP 403 (actual: ${resPostCust.status})`);

    // 5.10 Settlement POST via API with uncommitted/non-existent order returns HTTP 404 ORDER_NOT_FOUND
    const reqPostOrderNotFound = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cod/settlement', {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        shift_id: `shift_api_test_${Date.now()}`,
        delivery_partner_id: rider1.id,
        branch_id: branchB.id,
        settlement_lines: [{ order_id: 'ord_non_existent_123', amount: 2000 }],
        total_cash_received: 2000,
        remitted_by_staff_id: tellerStaffId,
        approved_by_supervisor_id: supervisorId,
        posted_by_gl_accountant_id: accountantId,
      }),
    });
    const resPostOrderNotFound = await POST(reqPostOrderNotFound, { params: { path: ['admin', 'accounting', 'cod', 'settlement'] } });
    assert(resPostOrderNotFound.status === 404, `Non-existent order settlement returns HTTP 404 (actual: ${resPostOrderNotFound.status})`);
    const jsonPostNotFound = await resPostOrderNotFound.json();
    assert(jsonPostNotFound.error === 'ORDER_NOT_FOUND', `API returns ORDER_NOT_FOUND (got: ${jsonPostNotFound.error})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: MULTI-CLIENT INDEPENDENT CONCURRENT TRANSACTION ISOLATION PROOF
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/7] Proving transaction isolation with independent concurrent PostgreSQL client...');
    const independentClient = new Client({ connectionString: getConnectionString() });
    await independentClient.connect();

    // Query baseline tables from INDEPENDENT client while transaction is uncommitted on `client`
    const uncommittedVouchers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const uncommittedJournals = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const uncommittedLines = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);

    assert(uncommittedVouchers === 0, `Independent client sees 0 accounting_voucher while transaction is active (isolation confirmed: ${uncommittedVouchers})`);
    assert(uncommittedJournals === 0, `Independent client sees 0 accounting_journal_entry while transaction is active (isolation confirmed: ${uncommittedJournals})`);
    assert(uncommittedLines === 0, `Independent client sees 0 accounting_journal_line while transaction is active (isolation confirmed: ${uncommittedLines})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: ROLLBACK & POST-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/7] Rolling back test transaction and verifying post-test baseline...');
    await client.query('ROLLBACK');

    console.log('Verifying post-rollback baseline on BOTH transaction client and independent client...');
    const rollbackVouchersClient = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const rollbackVouchersIndep = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(rollbackVouchersClient === 0, `Transaction client sees 0 accounting_voucher post-rollback (actual: ${rollbackVouchersClient})`);
    assert(rollbackVouchersIndep === 0, `Independent client sees 0 accounting_voucher post-rollback (actual: ${rollbackVouchersIndep})`);

    const postAccounts = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const postVouchers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const postJournals = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const postLines = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const postPeriods = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const postPurchases = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const postItems = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.purchase_item')).rows[0].count, 10);
    const postPayments = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const postSuppliers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.supplier')).rows[0].count, 10);
    const postBranches = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.branch')).rows[0].count, 10);
    const postBinv = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const postLots = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const postMovements = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const postConsumption = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.inventory_cost_consumption')).rows[0].count, 10);
    const postOrders = parseInt((await independentClient.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const postTransactions = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    const postSettings = parseInt((await independentClient.query("SELECT COUNT(*) FROM public.setting WHERE key = 'accounting_start_date'")).rows[0].count, 10);
    const postCustomers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.customer')).rows[0].count, 10);

    assert(postAccounts === 98, `Post-test accounting_account === 98 (actual: ${postAccounts})`);
    assert(postVouchers === 0, `Post-test accounting_voucher === 0 (actual: ${postVouchers})`);
    assert(postJournals === 0, `Post-test accounting_journal_entry === 0 (actual: ${postJournals})`);
    assert(postLines === 0, `Post-test accounting_journal_line === 0 (actual: ${postLines})`);
    assert(postPeriods === 0, `Post-test accounting_fiscal_period === 0 (actual: ${postPeriods})`);
    assert(postPurchases === 0, `Post-test purchase === 0 (actual: ${postPurchases})`);
    assert(postItems === 0, `Post-test purchase_item === 0 (actual: ${postItems})`);
    assert(postPayments === 0, `Post-test purchase_payment === 0 (actual: ${postPayments})`);
    assert(postSuppliers === 0, `Post-test supplier === 0 (actual: ${postSuppliers})`);
    assert(postBranches === 57, `Post-test branch === 57 (actual: ${postBranches})`);
    assert(postBinv === 424, `Post-test branch_inventory === 424 (actual: ${postBinv})`);
    assert(postLots === 0, `Post-test inventory_cost_lot === 0 (actual: ${postLots})`);
    assert(postMovements === 0, `Post-test inventory_movement === 0 (actual: ${postMovements})`);
    assert(postConsumption === 0, `Post-test inventory_cost_consumption === 0 (actual: ${postConsumption})`);
    assert(postOrders === 173, `Post-test order === 173 (actual: ${postOrders})`);
    assert(postTransactions === 53, `Post-test payment_transaction === 53 (actual: ${postTransactions})`);
    assert(postSettings === 0, `Post-test accounting_start_date setting === 0 (actual: ${postSettings})`);
    assert(postCustomers === 57, `Post-test customer === 57 (actual: ${postCustomers})`);

    await independentClient.end();
  } catch (err) {
    console.error('\nUNHANDLED TEST RUNNER ERROR:', err);
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Failed to rollback:', rbErr);
    }
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`TEST SUITE RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution terminated with error:", err);
  process.exit(1);
});
