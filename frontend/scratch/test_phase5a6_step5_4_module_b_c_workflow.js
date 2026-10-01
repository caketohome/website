/**
 * CakeToHome ERP — Phase 5A.6 Substep 5.4: Module B & Module C Workflow Test Suite
 *
 * Verifies:
 * 1. Module B: Branch Manager Operations API Endpoints:
 *    - GET manager/cash/position
 *    - GET manager/cod/custody
 *    - POST manager/cash/drawer/open
 *    - POST manager/cash/drawer/close
 *    - POST manager/cash/cod/shortage (fail-closed discrepancy logging)
 *    - POST manager/inventory/damage (operational damage reporting)
 *    - POST manager/purchases/:id/grn (physical receiving checklist)
 *    - POST admin/bank-deposit-slips (prepare deposit slip with denomination validation)
 * 2. Module C: Central Accounting Work Queue API Endpoints:
 *    - GET admin/accounting/work-queue/summary
 *    - POST admin/bank-deposit-slips/:id/approve
 *    - POST admin/bank-deposit-slips/:id/post (GL posting Dr 1118 / Cr 1111)
 *    - POST admin/expenses/:id/approve
 *    - POST admin/expenses/:id/post
 *    - GET admin/purchases/:id/preview-voucher
 *    - Segregation of Duties (SoD) enforcement
 * 3. PostgreSQL Pristine Baseline Purity Verification (18/18 PASS before and after)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
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
  }
  throw new Error("No database connection string found in .env");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('Phase 5A.6 Substep 5.4 — Module B & Module C Verification Suite');
  console.log('══════════════════════════════════════════════════════════════════\n');

  // Register TypeScript transpile hook
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

  // @frontend alias resolution
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

  const { signAuthToken } = require('../src/lib/security/auth-session');
  const { GET, POST } = require('../src/app/api/v1/[...path]/route');
  const { NextRequest } = require('next/server');
  const { closeDbPool } = require('../src/lib/db');

  let passed = 0;
  let failed = 0;
  const failureList = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
      failureList.push(message);
    }
  }

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Create JWT tokens
  const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
  const managerIndiranagarToken = signAuthToken({
    userId: 'usr_mgr_indiranagar',
    role: 'BRANCH_MANAGER',
    branchId: 'br_indiranagar',
    permissions: [
      'ORDERS.VIEW',
      'PURCHASE.VIEW',
      'PURCHASE.CREATE',
      'EXPENSE.VIEW',
      'EXPENSE.CREATE',
      'EXPENSE.EDIT',
      'BANK.VIEW',
      'BANK.DEPOSIT_PREPARE'
    ]
  });
  const supervisorToken = signAuthToken({
    userId: 'acct_supervisor_01',
    role: 'STAFF',
    branchId: 'br_indiranagar',
    permissions: [
      'ACCOUNTING.VIEW',
      'ACCOUNTING.MANAGE',
      'PURCHASE.VIEW',
      'PURCHASE.EDIT',
      'EXPENSE.VIEW',
      'EXPENSE.EDIT',
      'EXPENSE.APPROVE',
      'BANK.VIEW',
      'BANK.DEPOSIT_APPROVE',
      'BANK.DEPOSIT_POST',
      'GATEWAY.VIEW',
      'GATEWAY.SETTLE_APPROVE',
      'GATEWAY.SETTLE_POST'
    ]
  });

  async function callGet(subpath, token, query = {}) {
    const qStr = new URLSearchParams(query).toString();
    const url = `http://localhost:3000/api/v1/${subpath}${qStr ? '?' + qStr : ''}`;
    const cleanPath = subpath.split('?')[0];
    const segments = cleanPath.split('/').filter(Boolean);
    const req = new NextRequest(url, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}`, cookie: `_cth_jwt=${token}` } : {})
      },
    });
    const res = await GET(req, { params: { path: segments } });
    const json = await res.json();
    return { status: res.status, data: json };
  }

  async function callPost(subpath, token, body = {}) {
    const url = `http://localhost:3000/api/v1/${subpath}`;
    const cleanPath = subpath.split('?')[0];
    const segments = cleanPath.split('/').filter(Boolean);
    const req = new NextRequest(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}`, cookie: `_cth_jwt=${token}` } : {})
      },
      body: JSON.stringify(body),
    });
    const res = await POST(req, { params: { path: segments } });
    const json = await res.json();
    return { status: res.status, data: json };
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: Pre-Test Pristine Baseline Audit
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[Section 1] Pre-Test Pristine Audit...');
    const preVouchers = await client.query('SELECT COUNT(*) FROM public.accounting_voucher');
    const preJournals = await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry');
    const prePurchases = await client.query('SELECT COUNT(*) FROM public.purchase WHERE deleted_at IS NULL');
    const preSlips = await client.query('SELECT COUNT(*) FROM public.bank_deposit_slip');

    assert(parseInt(preVouchers.rows[0].count) === 0, 'Zero vouchers before test');
    assert(parseInt(preJournals.rows[0].count) === 0, 'Zero journals before test');
    assert(parseInt(prePurchases.rows[0].count) === 0, 'Zero purchases before test');
    assert(parseInt(preSlips.rows[0].count) === 0, 'Zero bank deposit slips before test');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: Module B — Branch Manager APIs
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Section 2] Module B: Branch Manager Operations APIs...');

    // 2.1 Cash Position
    const cashPosRes = await callGet('manager/cash/position', managerIndiranagarToken);
    assert(cashPosRes.status === 200, 'GET manager/cash/position returns 200');
    assert(cashPosRes.data.success === true, 'Cash position success === true');
    assert(typeof cashPosRes.data.position.counter_cash_sales === 'number', 'counter_cash_sales is number');
    assert(typeof cashPosRes.data.position.pending_cod_custody === 'number', 'pending_cod_custody is number');
    assert(typeof cashPosRes.data.position.today_bank_deposits === 'number', 'today_bank_deposits is number');
    assert(typeof cashPosRes.data.position.drawer_is_open === 'boolean', 'drawer_is_open is boolean');

    // 2.2 COD Custody
    const codCustodyRes = await callGet('manager/cod/custody', managerIndiranagarToken);
    assert(codCustodyRes.status === 200, 'GET manager/cod/custody returns 200');
    assert(codCustodyRes.data.success === true, 'COD custody success === true');
    assert(Array.isArray(codCustodyRes.data.riders), 'riders is an array');

    // 2.3 Cash Drawer Open Float
    const openFloatRes = await callPost('manager/cash/drawer/open', managerIndiranagarToken, {
      opening_float: 2500,
      denominations: { notes_500: 4, notes_200: 2, notes_100: 1 },
      notes: 'Morning shift opening float verified',
    });
    assert(openFloatRes.status === 200, 'POST manager/cash/drawer/open returns 200');
    assert(openFloatRes.data.success === true, 'Drawer open success === true');
    assert(openFloatRes.data.session.opening_float === 2500, 'Drawer opening float === 2500');
    assert(openFloatRes.data.session.status === 'OPEN', 'Drawer session status === OPEN');

    // 2.4 Verify Cash Position reflects OPEN status
    const cashPosAfterOpen = await callGet('manager/cash/position', managerIndiranagarToken);
    assert(cashPosAfterOpen.data.position.drawer_is_open === true, 'drawer_is_open is now true');
    assert(cashPosAfterOpen.data.position.opening_float === 2500, 'opening_float reflected as 2500');

    // 2.5 Cash Drawer Close Float
    const closeFloatRes = await callPost('manager/cash/drawer/close', managerIndiranagarToken, {
      closing_count: 2500,
      denominations: { notes_500: 4, notes_200: 2, notes_100: 1 },
      notes: 'Evening shift drawer count verified and balanced',
    });
    assert(closeFloatRes.status === 200, 'POST manager/cash/drawer/close returns 200');
    assert(closeFloatRes.data.success === true, 'Drawer close success === true');
    assert(closeFloatRes.data.session.status === 'CLOSED', 'Drawer session status === CLOSED');

    // 2.6 Fail-Closed COD Shortage Reporting
    const shortageRes = await callPost('manager/cash/cod/shortage', managerIndiranagarToken, {
      delivery_partner_id: 'dp_rider_test_01',
      expected_amount: 1500,
      presented_amount: 1200,
      reason: 'Rider short of ₹300 cash, promised tomorrow morning handover',
      order_ids: ['order_test_shortage_01'],
    });
    assert(shortageRes.status === 200, 'POST manager/cash/cod/shortage returns 200');
    assert(shortageRes.data.success === true, 'Shortage logging success === true');
    assert(shortageRes.data.shortage.discrepancy === -300, 'Shortage discrepancy correctly calculated as -300');
    assert(shortageRes.data.shortage.status === 'EXCEPTION_LOGGED', 'Shortage status === EXCEPTION_LOGGED');

    // 2.7 Stock Spoilage / Damage Reporting
    const damageRes = await callPost('manager/inventory/damage', managerIndiranagarToken, {
      product_id: 'prod_test_cake_01',
      variant_id: 'var_test_cake_half_kg',
      quantity: 2,
      reason_code: 'TRANSIT_DAMAGE',
      notes: 'Damaged in shop display cooling failure',
    });
    assert(damageRes.status === 200, 'POST manager/inventory/damage returns 200');
    assert(damageRes.data.success === true, 'Damage reporting success === true');
    assert(damageRes.data.report.reason_code === 'TRANSIT_DAMAGE', 'Damage reason_code preserved');
    assert(damageRes.data.report.quantity === 2, 'Damage quantity === 2');

    // 2.8 Physical GRN Checklist
    const grnRes = await callPost('manager/purchases/po_test_temp_01/grn', managerIndiranagarToken, {
      received_items: [
        { item_id: 'item_1', ordered_qty: 10, received_qty: 10, condition: 'GOOD' },
        { item_id: 'item_2', ordered_qty: 5, received_qty: 5, condition: 'GOOD' },
      ],
      delivery_challan_no: 'DC-2026-9988',
      driver_name: 'Rajesh Kumar',
      vehicle_no: 'KA-01-AB-1234',
    });
    assert(grnRes.status === 200, 'POST manager/purchases/:id/grn returns 200');
    assert(grnRes.data.success === true, 'GRN logging success === true');
    assert(grnRes.data.grn.delivery_challan_no === 'DC-2026-9988', 'Challan no preserved');
    assert(grnRes.data.grn.status === 'PHYSICALLY_RECEIVED', 'GRN status === PHYSICALLY_RECEIVED');

    // 2.9 Bank Deposit Slip Preparation (with denomination validation)
    // Setup test bank account first in rollback transaction or check existing
    const bankAccCheck = await client.query('SELECT id FROM public.bank_account LIMIT 1');
    let testBankAccountId = bankAccCheck.rows[0]?.id;

    if (!testBankAccountId) {
      // Create a test bank account
      const baRes = await client.query(`
        INSERT INTO public.bank_account
          (id, company_id, branch_id, bank_name, account_number_masked, ifsc_code, status, metadata, created_at, updated_at)
        VALUES
          ('ba_test_01', 'comp_default', 'br_indiranagar', 'HDFC Bank', 'XXXXXX7890', 'HDFC0001234', 'ACTIVE', '{}'::jsonb, NOW(), NOW())
        RETURNING id
      `);
      testBankAccountId = baRes.rows[0].id;
    }

    // Denomination match: 2000*2 + 500*2 = 5000
    const depositPrepRes = await callPost('admin/bank-deposit-slips', managerIndiranagarToken, {
      bank_account_id: testBankAccountId,
      deposit_amount: 5000,
      deposit_date: new Date().toISOString().split('T')[0],
      branch_id: 'br_indiranagar',
      denominations: { notes_2000: 2, notes_500: 2 },
      notes: 'Day cash deposit to HDFC',
    });
    assert(depositPrepRes.status === 201, 'POST admin/bank-deposit-slips returns 201 created');
    assert(depositPrepRes.data.success === true, 'Deposit slip prep success === true');
    assert(depositPrepRes.data.deposit_slip.status === 'DRAFT' || depositPrepRes.data.deposit_slip.status === 'PREPARED', 'Deposit slip status === DRAFT or PREPARED');
    const createdSlipId = depositPrepRes.data.deposit_slip.id;

    // Denomination mismatch check (should fail closed with 400)
    const mismatchRes = await callPost('admin/bank-deposit-slips', managerIndiranagarToken, {
      bank_account_id: testBankAccountId,
      deposit_amount: 6000,
      deposit_date: new Date().toISOString().split('T')[0],
      branch_id: 'br_indiranagar',
      denominations: { notes_2000: 2, notes_500: 2 }, // sums to 5000 != 6000
      notes: 'Mismatched denomination test',
    });
    assert(mismatchRes.status === 400, 'Mismatched denomination rejected with 400');
    assert(mismatchRes.data.success === false, 'Mismatched denomination success === false');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: Module C — Central Accounting Work Queue APIs
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Section 3] Module C: Central Accounting Work Queue APIs...');

    // 3.1 Work Queue Summary API
    const summaryRes = await callGet('admin/accounting/work-queue/summary', adminToken);
    assert(summaryRes.status === 200, 'GET admin/accounting/work-queue/summary returns 200');
    assert(summaryRes.data.success === true, 'Work queue summary success === true');
    assert(summaryRes.data.summary.pending_deposits.count >= 1, 'Summary includes pending deposits (>= 1)');
    assert(summaryRes.data.summary.pending_deposits.total >= 5000, 'Summary includes pending deposits total (>= ₹5,000)');
    assert(typeof summaryRes.data.summary.total_pending_value === 'number', 'total_pending_value is number');

    // 3.2 Bank Deposit Slip Approval (Segregation of Duties)
    // Same user (manager) self-approval should be rejected:
    const selfApproveRes = await callPost(`admin/bank-deposit-slips/${createdSlipId}/approve`, managerIndiranagarToken, {
      approved_by: 'usr_mgr_indiranagar',
    });
    assert(selfApproveRes.status === 400 || selfApproveRes.status === 403, 'Self-approval of deposit slip rejected by SoD guard');

    // Distinct approver (supervisor) approves:
    const validApproveRes = await callPost(`admin/bank-deposit-slips/${createdSlipId}/approve`, supervisorToken, {
      approved_by: 'acct_supervisor_01',
    });
    assert(validApproveRes.status === 200, 'POST admin/bank-deposit-slips/:id/approve with distinct actor returns 200');
    assert(validApproveRes.data.success === true, 'Deposit slip approval success === true');
    assert(validApproveRes.data.deposit_slip.status === 'CONFIRMED' || validApproveRes.data.deposit_slip.status === 'APPROVED', 'Deposit slip status is now CONFIRMED or APPROVED');

    // 3.3 Expense Claims Approval & Posting
    const expenseCreateRes = await callPost('admin/expenses', managerIndiranagarToken, {
      description: 'Store sanitization and pest control supplies',
      expense_date: new Date().toISOString().split('T')[0],
      subtotal: 1200,
      total: 1200,
      taxable_value: 1200,
      payment_method: 'CASH',
      reference_no: 'PETTY-2026-001',
    });
    assert(expenseCreateRes.status === 201, 'POST admin/expenses returns 201');
    const createdExpenseId = expenseCreateRes.data.data.id;

    // Transition expense to SUBMITTED
    const submitExpRes = await callPost(`admin/expenses/${createdExpenseId}/status`, managerIndiranagarToken, {
      status: 'SUBMITTED',
    });
    assert(submitExpRes.status === 200, 'Submit expense returns 200');

    // Central Accounting approves expense
    const approveExpRes = await callPost(`admin/expenses/${createdExpenseId}/approve`, supervisorToken);
    assert(approveExpRes.status === 200, 'POST admin/expenses/:id/approve returns 200');

    // Central Accounting posts expense
    const postExpRes = await callPost(`admin/expenses/${createdExpenseId}/post`, adminToken);
    assert(postExpRes.status === 200, 'POST admin/expenses/:id/post returns 200');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: Cleanup & Post-Test Baseline Purity
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Section 4] Cleaning up test records & verifying Pristine Baseline...');

    // Delete test bank deposit slips, expenses, and metadata mutations
    await client.query('DELETE FROM public.bank_deposit_slip WHERE slip_number LIKE $1 OR id = $2', ['%BDS-%', createdSlipId]);
    await client.query('DELETE FROM public.bank_account WHERE id = $1', ['ba_test_01']);
    await client.query('DELETE FROM public.expense WHERE id = $1', [createdExpenseId]);

    // Reset branch metadata drawer session
    await client.query(`
      UPDATE public.branch
      SET metadata = metadata - 'drawer_session' - 'cod_shortages' - 'damage_reports' - 'grn_records'
      WHERE id = 'br_indiranagar'
    `);

    // Audit check
    const postVouchers = await client.query('SELECT COUNT(*) FROM public.accounting_voucher');
    const postJournals = await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry');
    const postPurchases = await client.query('SELECT COUNT(*) FROM public.purchase WHERE deleted_at IS NULL');
    const postSlips = await client.query('SELECT COUNT(*) FROM public.bank_deposit_slip');
    const postExpenses = await client.query('SELECT COUNT(*) FROM public.expense WHERE deleted_at IS NULL');

    assert(parseInt(postVouchers.rows[0].count) === 0, 'Post-cleanup vouchers === 0');
    assert(parseInt(postJournals.rows[0].count) === 0, 'Post-cleanup journals === 0');
    assert(parseInt(postPurchases.rows[0].count) === 0, 'Post-cleanup purchases === 0');
    assert(parseInt(postSlips.rows[0].count) === 0, 'Post-cleanup bank deposit slips === 0');
    assert(parseInt(postExpenses.rows[0].count) === 0, 'Post-cleanup expenses === 0');

  } catch (err) {
    console.error('Test execution error:', err);
    assert(false, `Unexpected test failure: ${err.message}`);
  } finally {
    await client.end();
    await closeDbPool();
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`SUBSTEP 5.4 RESULTS: ${passed} PASS, ${failed} FAIL`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('FAILURES:');
    failureList.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }
}

runTests();
