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

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

// Register TypeScript transpile hook for .ts and .tsx imports
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
require.extensions['.tsx'] = require.extensions['.ts'];

// Map @frontend alias
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

const pool = new Pool({ connectionString: connStr });

async function runC73Suite() {
  const client = await pool.connect();
  console.log('==================================================================');
  console.log('  CAKETOHOME ERP — PHASE C7.3 PAYMENT & TELLER INTEGRATION SUITE');
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

  const { BillsPayableService, BillsPayableError } = require('../src/lib/services/bills-payable.service');
  const { BranchCashService, BranchCashServiceError } = require('../src/lib/services/branch-cash.service');

  // Tracking fixtures for teardown
  const createdPurchases = [];
  const createdPayments = [];
  const createdAllocations = [];
  const createdVouchers = [];
  const createdJournalEntries = [];
  const createdJournalLines = [];
  const createdSuppliers = [];
  const createdBankAccounts = [];
  const createdTellers = [];
  const createdTellerSessions = [];
  const createdTellerMovements = [];
  const createdCompanies = [];

  let initialDr = 0;
  let initialCr = 0;

  try {
    // ── Pre-flight Check: Baseline DB State ────────────────────────────────
    console.log('[Baseline Check] Auditing pristine baseline...');
    const coaRes = await client.query('SELECT count(*)::int as cnt FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(coaRes.rows[0].cnt === 100, `Baseline CoA count is exactly 100 (got ${coaRes.rows[0].cnt})`);

    const tbRes = await client.query(`
      SELECT 
        ROUND(COALESCE(SUM(debit_amount), 0), 2) as total_debit,
        ROUND(COALESCE(SUM(credit_amount), 0), 2) as total_credit
      FROM public.accounting_journal_line
    `);
    initialDr = Number(tbRes.rows[0].total_debit);
    initialCr = Number(tbRes.rows[0].total_credit);
    assert(initialDr === initialCr, `Baseline Trial Balance balanced: Dr ₹${initialDr} = Cr ₹${initialCr}`);

    // Resolve existing active users for teller association
    const userRes = await client.query(`SELECT id FROM public.user LIMIT 4`);
    const validUserId = userRes.rows[0]?.id || 'user_01KY29WECB2VKDVVAT8J6FH90F';
    const validUserId2 = userRes.rows[1]?.id || 'user_01KY2P5955X24AT3X5R94H1G59';
    const validUserId3 = userRes.rows[2]?.id || 'usr_c5_1791194160560';

    // ── Setup: Test Entities ───────────────────────────────────────────────
    console.log('\n[Setup] Provisioning isolated test fixtures...');
    const branchRes = await client.query(`SELECT id, name FROM public.branch ORDER BY name LIMIT 1`);
    const branchId = branchRes.rows[0]?.id || 'br_indiranagar';

    // Second branch for cross-branch SoD testing
    const branch2Res = await client.query(`SELECT id, name FROM public.branch WHERE id != $1 LIMIT 1`, [branchId]);
    const branch2Id = branch2Res.rows[0]?.id;

    let compRes = await client.query(`SELECT id FROM public.company LIMIT 1`);
    let compId = compRes.rows[0]?.id;
    if (!compId) {
      compId = `comp_c73_${Date.now()}`;
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

    const supId1 = `sup_c73_flour_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, phone, branch_id, is_active, created_at, updated_at)
      VALUES ($1, 'C7.3 Master Flour Mills', '29AABCT1332L1Z1', '9876543210', $2, true, NOW(), NOW())
    `, [supId1, branchId]);
    createdSuppliers.push(supId1);

    // Bank Account Master (pointing to GL 1112)
    let bankAccRes = await client.query(`SELECT id FROM public.bank_account WHERE status = 'ACTIVE' LIMIT 1`);
    let bankAccId = bankAccRes.rows[0]?.id;
    if (!bankAccId) {
      bankAccId = `bank_c73_${Date.now()}`;
      await client.query(`
        INSERT INTO public.bank_account (
          id, company_id, bank_name, account_number_masked, ifsc_code, status,
          account_name, account_number, gl_account_id, branch_name, created_at, updated_at
        )
        VALUES (
          $1, $2, 'HDFC Bank C7.3', 'XXXX9988', 'HDFC0001234', 'ACTIVE',
          'CakeToHome C7.3 Bank Account', '50200099887766',
          (SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1),
          'Indiranagar', NOW(), NOW()
        )
      `, [bankAccId, compId]);
      createdBankAccounts.push(bankAccId);
    }

    // Teller Master & Session (Opening Float: ₹2,000.00)
    const tellerId = `tel_c73_${Date.now()}`;
    await client.query(`
      INSERT INTO public.teller (id, name, code, branch_id, user_id, status, created_at, updated_at)
      VALUES ($1, 'C7.3 Lead Cashier Till 1', 'TILL-C73-01', $2, $3, 'ACTIVE', NOW(), NOW())
    `, [tellerId, branchId, validUserId]);
    createdTellers.push(tellerId);

    const sessionId = `ts_c73_${Date.now()}`;
    await client.query(`
      INSERT INTO public.teller_session (
        id, teller_id, branch_id, opened_by, opened_at, opening_float,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, NOW(), 2000.00,
        'OPEN', NOW(), NOW()
      )
    `, [sessionId, tellerId, branchId, validUserId]);
    createdTellerSessions.push(sessionId);

    // ── Test 1: Settle Bill via CASH with Active Teller Session (Partial) ───
    console.log('\n[Suite 1] Testing Partial Cash Settlement with Active Teller Session...');

    // Create posted purchase invoice for ₹3,000.00
    const p1Id = `pur_c73_1_${Date.now()}`;
    const invNo1 = `INV-C73-001-${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date, due_date,
        subtotal, taxable_value, cgst, sgst, total, payment_method, status,
        created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days',
        2857.14, 2857.14, 71.43, 71.43, 3000.00, 'CREDIT', 'POSTED',
        'creator_clerk_1', 'approver_mgr_1', NOW(), NOW()
      )
    `, [p1Id, supId1, branchId, invNo1]);
    createdPurchases.push(p1Id);

    // Create the purchase voucher in GL: Dr 1131 ₹2857.14, Dr 1141 ₹142.86, Cr 2111 ₹3000.00
    const vPur1Id = `v_c73_pur1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
        status, total_amount, reference_type, reference_id, reference_event,
        narration, created_by, approved_by, posted_by, created_at, updated_at
      ) VALUES (
        $1, 'JV-C73-P1', 'JOURNAL', CURRENT_DATE, $2, 'FY2026-27',
        'POSTED', 3000.00, 'PURCHASE', $3, 'INVOICE_POSTED',
        'Credit purchase flour liability', 'creator_clerk_1', 'approver_mgr_1', 'finance_ctrl', NOW(), NOW()
      )
    `, [vPur1Id, branchId, p1Id]);
    createdVouchers.push(vPur1Id);

    // Link voucher to purchase
    await client.query(`UPDATE public.purchase SET voucher_id = $1 WHERE id = $2`, [vPur1Id, p1Id]);

    const jePur1Id = `je_c73_pur1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_entry (
        id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
        total_debit, total_credit, narration, created_by, created_at
      ) VALUES (
        $1, 'JE-C73-P1', $2, CURRENT_DATE, $3, 'FY2026-27',
        3000.00, 3000.00, 'Purchase AP entry', 'finance_ctrl', NOW()
      )
    `, [jePur1Id, vPur1Id, branchId]);
    createdJournalEntries.push(jePur1Id);

    await client.query(`
      INSERT INTO public.accounting_journal_line (
        id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration
      ) VALUES
        ($1, $2, 1, (SELECT id FROM public.accounting_account WHERE code = '1131'), 2857.14, 0.00, $3, NULL, 'Raw material inventory'),
        ($4, $2, 2, (SELECT id FROM public.accounting_account WHERE code = '1141'), 142.86, 0.00, $3, NULL, 'Input GST'),
        ($5, $2, 3, (SELECT id FROM public.accounting_account WHERE code = '2111'), 0.00, 3000.00, $3, $6, 'Trade AP liability')
    `, [`jl_c73_1_${Date.now()}`, jePur1Id, branchId, `jl_c73_2_${Date.now()}`, `jl_c73_3_${Date.now()}`, supId1]);

    // Perform partial settlement: Disburse ₹1,200.00 in CASH from active teller session
    const disburseActor = {
      userId: 'disbursing_officer_1',
      role: 'SUPER_ADMIN',
      branchId,
    };

    const settleRes1 = await BillsPayableService.settleBills({
      supplierId: supId1,
      branchId,
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().split('T')[0],
      tellerSessionId: sessionId,
      reference: 'CV-C73-001',
      narration: 'Partial cash payment for flour bill',
      paidBy: disburseActor.userId,
      actorRole: disburseActor.role,
      actorSession: { user: { id: disburseActor.userId, role: disburseActor.role } },
      allocations: [{ purchaseId: p1Id, amount: 1200.00 }],
    });

    createdPayments.push(settleRes1.payment.id);
    if (settleRes1.allocations && settleRes1.allocations[0]) {
      createdAllocations.push(settleRes1.allocations[0].id);
    }
    if (settleRes1.voucher) {
      createdVouchers.push(settleRes1.voucher.id);
    }

    assert(Number(settleRes1.payment.amount) === 1200.00, '1.1 Payment amount recorded as ₹1,200.00');
    assert(settleRes1.payment.method === 'CASH', '1.2 Payment method is CASH');
    assert(settleRes1.payment.teller_session_id === sessionId, `1.3 purchase_payment.teller_session_id links to active session ${sessionId}`);

    // Verify atomic teller movement was projected
    assert(settleRes1.teller_movement !== null, '1.4 Projected teller movement returned in result');
    assert(settleRes1.teller_movement.direction === 'OUT', '1.5 Teller movement direction is OUT');
    assert(settleRes1.teller_movement.movement_type === 'EXPENSE_PAYMENT', '1.6 Teller movement type is EXPENSE_PAYMENT');
    assert(settleRes1.teller_movement.source_type === 'PURCHASE_PAYMENT', '1.7 Teller movement source_type is PURCHASE_PAYMENT');
    assert(settleRes1.teller_movement.source_id === settleRes1.payment.id, '1.8 Teller movement source_id matches payment.id');
    assert(Number(settleRes1.teller_movement.amount) === 1200.00, '1.9 Teller movement amount is ₹1,200.00');
    createdTellerMovements.push(settleRes1.teller_movement.id);

    // Verify physical teller session expected cash decreased
    const tillSessionCheck = await client.query(`
      SELECT 
        s.opening_float,
        ROUND(COALESCE((
          SELECT SUM(CASE WHEN m.direction = 'IN' THEN m.amount ELSE -m.amount END)
          FROM public.teller_movement m
          WHERE m.teller_session_id = s.id
        ), 0), 2) as net_movements
      FROM public.teller_session s
      WHERE s.id = $1
    `, [sessionId]);

    const openingFloat = Number(tillSessionCheck.rows[0].opening_float);
    const netMovements = Number(tillSessionCheck.rows[0].net_movements);
    const expectedPhysicalCash = openingFloat + netMovements;
    assert(netMovements === -1200.00, `1.10 Net movements on teller till is -₹1,200.00 (got ${netMovements})`);
    assert(expectedPhysicalCash === 800.00, `1.11 Expected physical cash in drawer decremented from ₹2,000.00 to ₹800.00 (got ${expectedPhysicalCash})`);

    // Verify Double-Entry Journal: Dr 2111 (Accounts Payable) ₹1,200 / Cr 1111 (Cash in Hand) ₹1,200
    const jlCheck = await client.query(`
      SELECT 
        jl.account_id,
        acc.code,
        jl.debit_amount,
        jl.credit_amount,
        jl.supplier_id,
        jl.branch_id
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account acc ON acc.id = jl.account_id
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      WHERE je.voucher_id = $1
      ORDER BY jl.line_no
    `, [settleRes1.voucher.id]);

    assert(jlCheck.rows.length === 2, '1.12 Exactly 2 balanced journal lines posted for disbursement');
    const drLine = jlCheck.rows.find(r => Number(r.debit_amount) > 0);
    const crLine = jlCheck.rows.find(r => Number(r.credit_amount) > 0);
    assert(drLine && drLine.code === '2111', '1.13 Debited Trade Accounts Payable (2111)');
    assert(drLine && drLine.supplier_id === supId1, '1.14 AP debit line tagged with supplier dimension');
    assert(crLine && crLine.code === '1111', '1.15 Credited Cash in Hand (1111)');
    assert(crLine && crLine.branch_id === branchId, '1.16 Cash credit line tagged with branch dimension');

    // Verify Bill status is now PARTIALLY_PAID with outstanding balance ₹1,800.00
    const billDetail1 = await BillsPayableService.getBillDetail(p1Id, disburseActor);
    assert(billDetail1.bill.status === 'PARTIALLY_PAID', `1.17 Bill status transitioned to PARTIALLY_PAID (got ${billDetail1.bill.status})`);
    assert(Number(billDetail1.bill.paid_amount) === 1200.00, '1.18 Bill paid amount reflects ₹1,200.00');
    assert(Number(billDetail1.bill.outstanding_amount) === 1800.00, '1.19 Bill outstanding balance reflects ₹1,800.00');

    // ── Test 2: Full Settlement of Remaining Balance via Cash ─────────────
    console.log('\n[Suite 2] Testing Full Settlement of Remaining Balance via Cash...');
    const settleRes2 = await BillsPayableService.settleBills({
      supplierId: supId1,
      branchId,
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().split('T')[0],
      tellerSessionId: sessionId,
      reference: 'CV-C73-002',
      narration: 'Final cash settlement for flour bill',
      paidBy: disburseActor.userId,
      actorRole: disburseActor.role,
      actorSession: { user: { id: disburseActor.userId, role: disburseActor.role } },
      allocations: [{ purchaseId: p1Id, amount: 1800.00 }],
    });

    createdPayments.push(settleRes2.payment.id);
    if (settleRes2.allocations && settleRes2.allocations[0]) {
      createdAllocations.push(settleRes2.allocations[0].id);
    }
    if (settleRes2.voucher) {
      createdVouchers.push(settleRes2.voucher.id);
    }
    if (settleRes2.teller_movement) {
      createdTellerMovements.push(settleRes2.teller_movement.id);
    }

    assert(Number(settleRes2.payment.amount) === 1800.00, '2.1 Second payment recorded as ₹1,800.00');
    assert(settleRes2.teller_movement.direction === 'OUT', '2.2 Second teller movement OUT created');
    assert(Number(settleRes2.teller_movement.amount) === 1800.00, '2.3 Second teller movement amount is ₹1,800.00');

    const billDetail2 = await BillsPayableService.getBillDetail(p1Id, disburseActor);
    assert(billDetail2.bill.status === 'PAID', `2.4 Bill status transitioned to PAID (got ${billDetail2.bill.status})`);
    assert(Number(billDetail2.bill.paid_amount) === 3000.00, '2.5 Bill total paid amount is ₹3,000.00');
    assert(Number(billDetail2.bill.outstanding_amount) === 0.00, '2.6 Bill outstanding amount reduced to ₹0.00');
    assert(billDetail2.payments.length === 2, '2.7 Exactly 2 historical allocations linked to this bill');

    // Till drawer net cash should now be 2000 - 1200 - 1800 = -1000
    const tillSessionCheck2 = await client.query(`
      SELECT 
        s.opening_float,
        ROUND(COALESCE((
          SELECT SUM(CASE WHEN m.direction = 'IN' THEN m.amount ELSE -m.amount END)
          FROM public.teller_movement m
          WHERE m.teller_session_id = s.id
        ), 0), 2) as net_movements
      FROM public.teller_session s
      WHERE s.id = $1
    `, [sessionId]);
    const expected2 = Number(tillSessionCheck2.rows[0].opening_float) + Number(tillSessionCheck2.rows[0].net_movements);
    assert(expected2 === -1000.00, `2.8 Drawer cumulative physical expected cash reflects both payouts: ₹${expected2}`);

    // ── Test 3: Bank Payment vs Teller Isolation ──────────────────────────
    console.log('\n[Suite 3] Testing Bank Payment Leaves Teller Drawer Untouched...');
    const p2Id = `pur_c73_2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date, due_date,
        subtotal, taxable_value, cgst, sgst, total, payment_method, status,
        created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
        1428.57, 1428.57, 35.71, 35.71, 1500.00, 'CREDIT', 'POSTED',
        'creator_clerk_2', 'approver_mgr_2', NOW(), NOW()
      )
    `, [p2Id, supId1, branchId, `INV-C73-002-${Date.now()}`]);
    createdPurchases.push(p2Id);

    const vPur2Id = `v_c73_pur2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
        status, total_amount, reference_type, reference_id, reference_event,
        narration, created_by, approved_by, posted_by, created_at, updated_at
      ) VALUES (
        $1, 'JV-C73-P2', 'JOURNAL', CURRENT_DATE, $2, 'FY2026-27',
        'POSTED', 1500.00, 'PURCHASE', $3, 'INVOICE_POSTED',
        'Credit purchase bill 2', 'creator_clerk_2', 'approver_mgr_2', 'finance_ctrl', NOW(), NOW()
      )
    `, [vPur2Id, branchId, p2Id]);
    createdVouchers.push(vPur2Id);
    await client.query(`UPDATE public.purchase SET voucher_id = $1 WHERE id = $2`, [vPur2Id, p2Id]);

    const settleResBank = await BillsPayableService.settleBills({
      supplierId: supId1,
      branchId,
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: bankAccId,
      paymentDate: new Date().toISOString().split('T')[0],
      reference: 'UTR9988776655',
      narration: 'Electronic bank payment for flour bill 2',
      paidBy: disburseActor.userId,
      actorRole: disburseActor.role,
      actorSession: { user: { id: disburseActor.userId, role: disburseActor.role } },
      allocations: [{ purchaseId: p2Id, amount: 1500.00 }],
    });

    createdPayments.push(settleResBank.payment.id);
    if (settleResBank.allocations && settleResBank.allocations[0]) {
      createdAllocations.push(settleResBank.allocations[0].id);
    }
    if (settleResBank.voucher) {
      createdVouchers.push(settleResBank.voucher.id);
    }

    assert(settleResBank.payment.method === 'BANK_TRANSFER', '3.1 Payment method is BANK_TRANSFER');
    assert(settleResBank.payment.teller_session_id === null, '3.2 Bank payment teller_session_id is null');
    assert(settleResBank.teller_movement === null, '3.3 No teller movement created for bank payment');

    // Verify GL credited dedicated bank account GL (1112)
    const bankJlCheck = await client.query(`
      SELECT acc.code, jl.debit_amount, jl.credit_amount
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account acc ON acc.id = jl.account_id
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      WHERE je.voucher_id = $1
    `, [settleResBank.voucher.id]);
    const bankCr = bankJlCheck.rows.find(r => Number(r.credit_amount) > 0);
    assert(bankCr && bankCr.code === '1112', '3.4 Bank payment credits dedicated bank asset account (1112)');

    // ── Test 4: Cash Payment Without Teller Session (Branch Safe Fallback) ──
    console.log('\n[Suite 4] Testing Cash Payment without Open Till Session (Safe Fallback)...');
    const safeBranchId = branch2Id || branchId;
    const supIdSafe = `sup_c73_safe_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, phone, branch_id, is_active, created_at, updated_at)
      VALUES ($1, 'C7.3 Safe Supplier', '29AABCT1332L1Z2', '9876543211', $2, true, NOW(), NOW())
    `, [supIdSafe, safeBranchId]);
    createdSuppliers.push(supIdSafe);

    const p3Id = `pur_c73_3_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date, due_date,
        subtotal, taxable_value, cgst, sgst, total, payment_method, status,
        created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
        476.19, 476.19, 11.90, 11.91, 500.00, 'CREDIT', 'POSTED',
        'creator_clerk_3', 'approver_mgr_3', NOW(), NOW()
      )
    `, [p3Id, supIdSafe, safeBranchId, `INV-C73-003-${Date.now()}`]);
    createdPurchases.push(p3Id);

    const vPur3Id = `v_c73_pur3_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
        status, total_amount, reference_type, reference_id, reference_event,
        narration, created_by, approved_by, posted_by, created_at, updated_at
      ) VALUES (
        $1, 'JV-C73-P3', 'JOURNAL', CURRENT_DATE, $2, 'FY2026-27',
        'POSTED', 500.00, 'PURCHASE', $3, 'INVOICE_POSTED',
        'Credit purchase bill 3', 'creator_clerk_3', 'approver_mgr_3', 'finance_ctrl', NOW(), NOW()
      )
    `, [vPur3Id, safeBranchId, p3Id]);
    createdVouchers.push(vPur3Id);
    await client.query(`UPDATE public.purchase SET voucher_id = $1 WHERE id = $2`, [vPur3Id, p3Id]);

    const settleResSafe = await BillsPayableService.settleBills({
      supplierId: supIdSafe,
      branchId: safeBranchId,
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().split('T')[0],
      reference: 'CV-SAFE-001',
      narration: 'Safe cash payout for flour bill 3',
      paidBy: disburseActor.userId,
      actorRole: disburseActor.role,
      actorSession: { user: { id: disburseActor.userId, role: disburseActor.role } },
      allocations: [{ purchaseId: p3Id, amount: 500.00 }],
    });

    createdPayments.push(settleResSafe.payment.id);
    if (settleResSafe.allocations && settleResSafe.allocations[0]) {
      createdAllocations.push(settleResSafe.allocations[0].id);
    }
    if (settleResSafe.voucher) {
      createdVouchers.push(settleResSafe.voucher.id);
    }

    assert(settleResSafe.payment.method === 'CASH', '4.1 Safe fallback payment method is CASH');
    assert(settleResSafe.payment.teller_session_id === null, '4.2 Safe fallback payment teller_session_id is null');
    assert(settleResSafe.teller_movement === null, '4.3 Zero till movements when no drawer session is open');

    // ── Test 5: Security / Validation / Four-Eyes Guards ───────────────────
    console.log('\n[Suite 5] Testing Security & Four-Eyes Segregation of Duties...');

    // 5.1 Purchase creator cannot settle bill (even if they have SUPER_ADMIN role)
    const pSodId = `pur_c73_sod_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date, due_date,
        subtotal, taxable_value, cgst, sgst, total, payment_method, status,
        created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days',
        952.38, 952.38, 23.81, 23.81, 1000.00, 'CREDIT', 'POSTED',
        'sod_creator_user', 'approver_mgr_sod', NOW(), NOW()
      )
    `, [pSodId, supId1, branchId, `INV-C73-SOD-${Date.now()}`]);
    createdPurchases.push(pSodId);

    let sodCreatorBlocked = false;
    try {
      await BillsPayableService.settleBills({
        supplierId: supId1,
        branchId,
        paymentMethod: 'CASH',
        paymentDate: new Date().toISOString().split('T')[0],
        paidBy: 'sod_creator_user',
        actorRole: 'SUPER_ADMIN',
        actorSession: { user: { id: 'sod_creator_user', role: 'SUPER_ADMIN' } },
        allocations: [{ purchaseId: pSodId, amount: 100.00 }],
      });
    } catch (err) {
      sodCreatorBlocked = err.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(sodCreatorBlocked, '5.1 Segregation of Duties protects purchase creator from disbursing payment');

    // 5.2 Non-open (CLOSING) teller session rejection
    const closedTellerId = `tel_c73_cl_${Date.now()}`;
    await client.query(`
      INSERT INTO public.teller (id, name, code, branch_id, user_id, status, created_at, updated_at)
      VALUES ($1, 'C7.3 Closed Till', 'TILL-C73-CL', $2, $3, 'ACTIVE', NOW(), NOW())
    `, [closedTellerId, branchId, validUserId2]);
    createdTellers.push(closedTellerId);

    const closedSessionId = `ts_c73_closed_${Date.now()}`;
    await client.query(`
      INSERT INTO public.teller_session (id, teller_id, branch_id, opened_by, opened_at, opening_float, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), 500.00, 'CLOSING', NOW(), NOW())
    `, [closedSessionId, closedTellerId, branchId, validUserId2]);
    createdTellerSessions.push(closedSessionId);

    let closedSessionRejected = false;
    try {
      await BillsPayableService.settleBills({
        supplierId: supId1,
        branchId,
        paymentMethod: 'CASH',
        paymentDate: new Date().toISOString().split('T')[0],
        tellerSessionId: closedSessionId,
        paidBy: disburseActor.userId,
        actorRole: disburseActor.role,
        actorSession: { user: { id: disburseActor.userId, role: disburseActor.role } },
        allocations: [{ purchaseId: pSodId, amount: 100.00 }],
      });
    } catch (err) {
      closedSessionRejected = err.code === 'INVALID_SESSION_STATE';
    }
    assert(closedSessionRejected, '5.2 Settle with non-open (CLOSING) teller session rejected with INVALID_SESSION_STATE');

    // 5.3 Cross-branch session rejection
    if (branch2Id) {
      const teller2Id = `tel_c73_b2_${Date.now()}`;
      await client.query(`
        INSERT INTO public.teller (id, name, code, branch_id, user_id, status, created_at, updated_at)
        VALUES ($1, 'C7.3 Branch 2 Teller', 'TILL-C73-02', $2, $3, 'ACTIVE', NOW(), NOW())
      `, [teller2Id, branch2Id, validUserId3]);
      createdTellers.push(teller2Id);

      const crossBranchSessionId = `ts_c73_cross_${Date.now()}`;
      await client.query(`
        INSERT INTO public.teller_session (id, teller_id, branch_id, opened_by, opened_at, opening_float, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), 500.00, 'OPEN', NOW(), NOW())
      `, [crossBranchSessionId, teller2Id, branch2Id, validUserId3]);
      createdTellerSessions.push(crossBranchSessionId);

      let crossBranchRejected = false;
      try {
        await BillsPayableService.settleBills({
          supplierId: supId1,
          branchId, // Payment for branch 1
          paymentMethod: 'CASH',
          paymentDate: new Date().toISOString().split('T')[0],
          tellerSessionId: crossBranchSessionId, // Session belongs to branch 2
          paidBy: disburseActor.userId,
          actorRole: disburseActor.role,
          actorSession: { user: { id: disburseActor.userId, role: disburseActor.role } },
          allocations: [{ purchaseId: pSodId, amount: 100.00 }],
        });
      } catch (err) {
        crossBranchRejected = err.code === 'BRANCH_ACCESS_DENIED';
      }
      assert(crossBranchRejected, '5.3 Cross-branch teller session payout rejected with BRANCH_ACCESS_DENIED');
    } else {
      console.log('  - SKIP: Only one branch exists in database for cross-branch test.');
    }

    // ── Test 6: Branch Cash Position Service & Aggregation ─────────────────
    console.log('\n[Suite 6] Testing Branch Cash Position Service & Aggregation...');
    const superAdminCtx = { role: 'SUPER_ADMIN', userId: 'admin_01', isSuperAdmin: true };
    const cashSummary = await BranchCashService.getBranchCashSummary({ actorContext: superAdminCtx });

    assert(cashSummary !== null, '6.1 Branch cash summary returned successfully');
    assert(Array.isArray(cashSummary.branches), '6.2 Branches breakdown array returned');
    assert(cashSummary.branches_count === cashSummary.branches.length, '6.3 Branches count matches array length');

    // Check sum consistency
    const calcSumGlCash = cashSummary.branches.reduce((sum, b) => sum + b.gl_cash_in_hand, 0);
    const calcSumGlPetty = cashSummary.branches.reduce((sum, b) => sum + b.gl_petty_cash, 0);
    const calcSumDrawer = cashSummary.branches.reduce((sum, b) => sum + b.active_drawer_cash, 0);

    assert(Math.abs(cashSummary.total_gl_cash_in_hand - calcSumGlCash) < 0.05, '6.4 Total GL Cash matches sum of individual branches');
    assert(Math.abs(cashSummary.total_gl_petty_cash - calcSumGlPetty) < 0.05, '6.5 Total GL Petty Cash matches sum of individual branches');
    assert(Math.abs(cashSummary.total_active_drawer_cash - calcSumDrawer) < 0.05, '6.6 Total Active Drawer Cash matches sum of open branch till floats');
    assert(cashSummary.total_cash_position === Math.round((cashSummary.total_gl_cash_in_hand + cashSummary.total_gl_petty_cash) * 100) / 100, '6.7 Total Cash Position = GL Cash + GL Petty Cash');

    // Deep branch reconciliation verification
    const branchRecon = await BranchCashService.getBranchCashReconciliation(branchId, superAdminCtx);
    assert(branchRecon.branch_id === branchId, `6.8 Reconciliation returned for branch ${branchId}`);
    assert(Array.isArray(branchRecon.active_sessions), '6.9 Active sessions array populated');
    assert(Array.isArray(branchRecon.recent_cash_movements), '6.10 Recent cash movements array populated');

    const purchaseMovements = branchRecon.recent_cash_movements.filter(m => m.source_type === 'PURCHASE_PAYMENT');
    assert(purchaseMovements.length >= 2, `6.11 Recent movements includes both PURCHASE_PAYMENT disbursements (found ${purchaseMovements.length})`);

    // Verify BOLA defense: Non-superadmin cannot inspect other branches
    const branchStaffCtx = { role: 'BRANCH_MANAGER', userId: 'mgr_indiranagar', branchId };
    if (branch2Id) {
      let bolaBlocked = false;
      try {
        await BranchCashService.getBranchCashReconciliation(branch2Id, branchStaffCtx);
      } catch (err) {
        bolaBlocked = err.code === 'BRANCH_ACCESS_DENIED';
      }
      assert(bolaBlocked, '6.12 BOLA defense: Branch manager cannot access another branch cash reconciliation');
    }

  } catch (err) {
    console.error('UNEXPECTED SUITE FAILURE:', err);
    failed++;
  } finally {
    // ── Teardown & Baseline Audit ──────────────────────────────────────────
    console.log('\n[Teardown] Purging test fixtures...');

    // Delete created allocations
    if (createdAllocations.length > 0) {
      await client.query(`DELETE FROM public.purchase_payment_allocation WHERE id = ANY($1)`, [createdAllocations]);
    }
    // Delete created payments
    if (createdPayments.length > 0) {
      await client.query(`DELETE FROM public.purchase_payment WHERE id = ANY($1)`, [createdPayments]);
    }
    // Delete created teller movements
    if (createdTellerSessions.length > 0) {
      await client.query(`DELETE FROM public.teller_movement WHERE teller_session_id = ANY($1)`, [createdTellerSessions]);
    }
    if (createdTellerMovements.length > 0) {
      await client.query(`DELETE FROM public.teller_movement WHERE id = ANY($1)`, [createdTellerMovements]);
    }
    // Delete created teller sessions
    if (createdTellerSessions.length > 0) {
      await client.query(`DELETE FROM public.teller_session WHERE id = ANY($1)`, [createdTellerSessions]);
    }
    // Delete created tellers
    if (createdTellers.length > 0) {
      await client.query(`DELETE FROM public.teller WHERE id = ANY($1)`, [createdTellers]);
    }
    // Delete created purchases
    if (createdPurchases.length > 0) {
      await client.query(`DELETE FROM public.purchase WHERE id = ANY($1)`, [createdPurchases]);
    }
    // Delete created vouchers and cascading GL entries/lines
    if (createdVouchers.length > 0) {
      await client.query(`
        DELETE FROM public.accounting_journal_line
        WHERE journal_entry_id IN (
          SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)
        )
      `, [createdVouchers]);
      await client.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVouchers]);
      await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVouchers]);
    }
    // Delete journal lines referencing created suppliers
    if (createdSuppliers.length > 0) {
      await client.query(`DELETE FROM public.accounting_journal_line WHERE supplier_id = ANY($1)`, [createdSuppliers]);
    }
    // Delete created suppliers
    if (createdSuppliers.length > 0) {
      await client.query(`DELETE FROM public.supplier WHERE id = ANY($1)`, [createdSuppliers]);
    }
    // Delete created bank accounts
    if (createdBankAccounts.length > 0) {
      await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccounts]);
    }
    // Delete created companies
    if (createdCompanies.length > 0) {
      await client.query(`DELETE FROM public.company WHERE id = ANY($1)`, [createdCompanies]);
    }

    console.log('  ✓ Test fixtures successfully purged.');

    // ── Post-verification Baseline Audit ───────────────────────────────────
    console.log('\n[Post-Audit] Verifying database integrity & Trial Balance baseline...');
    const postTb = await client.query(`
      SELECT 
        ROUND(COALESCE(SUM(debit_amount), 0), 2) as total_debit,
        ROUND(COALESCE(SUM(credit_amount), 0), 2) as total_credit
      FROM public.accounting_journal_line
    `);
    const finalDr = Number(postTb.rows[0].total_debit);
    const finalCr = Number(postTb.rows[0].total_credit);

    assert(finalDr === initialDr && finalCr === initialCr, `Trial balance returned exactly to baseline: Dr ₹${finalDr} = Cr ₹${finalCr}`);
    assert(finalDr === finalCr, `Dr and Cr exactly match (difference: ₹${Math.abs(finalDr - finalCr)})`);

    const orphanCheck = await client.query(`
      SELECT count(*)::int as orphans FROM (
        SELECT id FROM public.accounting_journal_line WHERE journal_entry_id NOT IN (SELECT id FROM public.accounting_journal_entry)
        UNION ALL
        SELECT id FROM public.accounting_journal_entry WHERE voucher_id NOT IN (SELECT id FROM public.accounting_voucher)
      ) sub
    `);
    assert(orphanCheck.rows[0].orphans === 0, `Zero accounting orphans in database (got ${orphanCheck.rows[0].orphans})`);

    const lockCheck = await client.query(`
      SELECT count(*)::int as locks FROM pg_locks WHERE NOT granted
    `);
    assert(lockCheck.rows[0].locks === 0, `Zero ungranted database locks (got ${lockCheck.rows[0].locks})`);

    client.release();
    await pool.end();

    console.log('\n==================================================================');
    console.log(`  PHASE C7.3 VERIFICATION RESULT: ${passed} PASSED / ${failed} FAILED`);
    console.log('==================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runC73Suite().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
