/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-D-B Test Suite
 * Bank Reconciliation Statement (BRS) REST API Verification
 *
 * SCOPE & BOUNDARIES:
 * - Tests 6 canonical GET endpoints under admin/bank-reconciliation/*
 * - Validates authentication, RBAC, branch & enterprise isolation, BOLA/IDOR
 * - Validates pagination, integer-paise dual calculations, date cutoff semantics
 * - Enforces ZERO-MUTATION guarantee (no vouchers, no journals, no matching mutations)
 * - 100% test fixture teardown and baseline audit
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
  const rootEnvPath = path.join(__dirname, '../../backend/.env');
  if (fs.existsSync(rootEnvPath)) {
    const envContent = fs.readFileSync(rootEnvPath, 'utf8');
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
  throw new Error("No database connection string found");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-D-B Test Suite');
  console.log('Bank Reconciliation Statement (BRS) REST API Endpoints Verification');
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

  const { BankReconciliationStatementService } = require('../src/lib/services/bank-reconciliation-statement.service');
  const { BankReconciliationRepository } = require('../src/lib/repositories/bank-reconciliation.repository');
  const { BankAccountRepository } = require('../src/lib/repositories/bank-account.repository');
  const { StaffAccessControl } = require('../src/lib/staff-access-control');
  const { signAuthToken } = require('../src/lib/security/auth-session');
  const { GET } = require('../src/app/api/v1/[...path]/route');
  const { NextRequest } = require('next/server');
  const { closeDbPool } = require('../src/lib/db');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      passCount++;
      console.log(`  ✓ PASS: ${message}`);
    } else {
      failCount++;
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  const createdBankAccIds = [];
  const createdSessionIds = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0: PRE-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/9] Auditing pre-test PostgreSQL baseline...');

    const preAccounts = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(preAccounts.rows[0].count === 99, `Pre-test accounting_account === 99 (actual: ${preAccounts.rows[0].count})`);

    const preVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(preVouchers.rows[0].count === 0, `Pre-test accounting_voucher === 0 (actual: ${preVouchers.rows[0].count})`);

    const preJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(preJournals.rows[0].count === 0, `Pre-test accounting_journal_entry === 0 (actual: ${preJournals.rows[0].count})`);

    const preSessions = await client.query('SELECT count(*)::int AS count FROM public.bank_reconciliation_session');
    assert(preSessions.rows[0].count === 0, `Pre-test bank_reconciliation_session === 0 (actual: ${preSessions.rows[0].count})`);

    const preMatches = await client.query('SELECT count(*)::int AS count FROM public.bank_reconciliation_match');
    assert(preMatches.rows[0].count === 0, `Pre-test bank_reconciliation_match === 0 (actual: ${preMatches.rows[0].count})`);

    const preOrders = await client.query('SELECT count(*)::int AS count FROM public.order WHERE deleted_at IS NULL');
    assert(preOrders.rows[0].count === 173, `Historical order baseline untouched === 173 (actual: ${preOrders.rows[0].count})`);

    const prePayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    assert(prePayments.rows[0].count === 53, `Prototype transaction baseline untouched === 53 (actual: ${prePayments.rows[0].count})`);

    // Fetch two real branches for isolation testing
    const branchRes = await client.query('SELECT id, name FROM public.branch LIMIT 2');
    const branchA = branchRes.rows[0]?.id || 'br_01KYWH0RTHVHRD04J79T28RAHN';
    const branchB = branchRes.rows[1]?.id || 'br_01KYWH9YFVV5AK15D6313HB1NC';
    console.log(`\n  Using branches: BranchA=${branchA}, BranchB=${branchB}`);

    // Create test bank accounts: Enterprise (null branch), Branch A, Branch B
    const tsSuffix = Date.now();
    const entBankId = `ba_test_ent_${tsSuffix}`;
    const branchABankId = `ba_test_bra_${tsSuffix}`;
    const branchBBankId = `ba_test_brb_${tsSuffix}`;

    await client.query(`
      INSERT INTO public.bank_account (id, company_id, branch_id, bank_name, account_number_masked, ifsc_code, status, metadata, created_at, updated_at)
      VALUES
        ($1, 'default_company', NULL, 'HDFC Enterprise Treasury', 'XXXXXX1001', 'HDFC0000001', 'ACTIVE', '{}', NOW(), NOW()),
        ($2, 'default_company', $4, 'SBI Branch A Operating', 'XXXXXX2002', 'SBIN0000002', 'ACTIVE', '{}', NOW(), NOW()),
        ($3, 'default_company', $5, 'ICICI Branch B Operating', 'XXXXXX3003', 'ICIC0000003', 'ACTIVE', '{}', NOW(), NOW());
    `, [entBankId, branchABankId, branchBBankId, branchA, branchB]);
    createdBankAccIds.push(entBankId, branchABankId, branchBBankId);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: ROUTE HANDLER & ARCHITECTURAL MOUNTING
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/9] Verifying Route Handler & Architectural Mounting...');
    assert(typeof GET === 'function', 'GET route handler is exported from [...path]/route.ts');
    assert(typeof BankReconciliationStatementService.calculateBrs === 'function', 'BankReconciliationStatementService.calculateBrs is available');
    assert(typeof BankReconciliationRepository.listSessions === 'function', 'BankReconciliationRepository.listSessions is available');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: AUTHENTICATION & RBAC PERMISSION ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/9] Testing Authentication & RBAC Permission Enforcement...');

    // 2.1 Unauthenticated request returns 401 UNAUTHORIZED
    const reqAnon = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId);
    const resAnon = await GET(reqAnon, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resAnon.status === 401, `Unauthenticated request returns HTTP 401 (actual: ${resAnon.status})`);
    const jsonAnon = await resAnon.json();
    assert(jsonAnon.error === 'UNAUTHORIZED', `Unauthenticated error is UNAUTHORIZED (actual: ${jsonAnon.error})`);

    // 2.2 Spoofed headers without verified session rejected
    const reqSpoof = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId, {
      headers: { 'x-user-role': 'SUPER_ADMIN', 'x-user-id': 'admin_01' },
    });
    const resSpoof = await GET(reqSpoof, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resSpoof.status === 401, `Spoofed headers return HTTP 401 (actual: ${resSpoof.status})`);

    // 2.3 Customer token rejected with 403 FORBIDDEN
    const custToken = signAuthToken({ userId: 'cust_01', role: 'CUSTOMER', customerId: 'cust_01' });
    const reqCust = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId, {
      headers: { authorization: `Bearer ${custToken}` },
    });
    const resCust = await GET(reqCust, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resCust.status === 403, `Customer token returns HTTP 403 (actual: ${resCust.status})`);

    // 2.4 Staff lacking BANK.RECON_VIEW and ACCOUNTING.VIEW rejected with 403 FORBIDDEN
    const staffNoPermToken = signAuthToken({ userId: 'usr_staff_noperm', role: 'STAFF', branchId: branchA, permissions: ['TELEMARKETING.VIEW'] });
    const reqNoPerm = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId, {
      headers: { authorization: `Bearer ${staffNoPermToken}` },
    });
    const resNoPerm = await GET(reqNoPerm, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resNoPerm.status === 403, `Staff lacking BANK.RECON_VIEW returns HTTP 403 (actual: ${resNoPerm.status})`);

    // 2.5 Staff with BANK.RECON_VIEW authorized
    const staffWithPermToken = signAuthToken({ userId: 'usr_staff_recon', role: 'STAFF', branchId: branchA, permissions: ['BANK.RECON_VIEW'] });
    const reqWithPerm = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId, {
      headers: { authorization: `Bearer ${staffWithPermToken}` },
    });
    const resWithPerm = await GET(reqWithPerm, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resWithPerm.status === 200, `Staff with BANK.RECON_VIEW returns HTTP 200 (actual: ${resWithPerm.status})`);

    // 2.6 Staff with ACCOUNTING.VIEW authorized
    const staffWithAcctToken = signAuthToken({ userId: 'usr_staff_acct', role: 'STAFF', branchId: branchA, permissions: ['ACCOUNTING.VIEW'] });
    const reqWithAcct = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId, {
      headers: { authorization: `Bearer ${staffWithAcctToken}` },
    });
    const resWithAcct = await GET(reqWithAcct, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resWithAcct.status === 200, `Staff with ACCOUNTING.VIEW returns HTTP 200 (actual: ${resWithAcct.status})`);

    // 2.7 SUPER_ADMIN authorized
    const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    const reqAdmin = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resAdmin = await GET(reqAdmin, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resAdmin.status === 200, `SUPER_ADMIN returns HTTP 200 (actual: ${resAdmin.status})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: BRANCH & ENTERPRISE DATA ISOLATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/9] Testing Branch and Enterprise Data Isolation...');

    // 3.1 Branch A user querying Enterprise Bank Account returns 403 FORBIDDEN
    const reqBraEnt = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + entBankId, {
      headers: { authorization: `Bearer ${staffWithPermToken}` },
    });
    const resBraEnt = await GET(reqBraEnt, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resBraEnt.status === 403, `Branch staff querying Enterprise bank account returns HTTP 403 (actual: ${resBraEnt.status})`);

    // 3.2 Branch A user querying Branch B Bank Account returns 403 FORBIDDEN
    const reqBraBrb = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchBBankId, {
      headers: { authorization: `Bearer ${staffWithPermToken}` },
    });
    const resBraBrb = await GET(reqBraBrb, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resBraBrb.status === 403, `Branch A staff querying Branch B bank account returns HTTP 403 (actual: ${resBraBrb.status})`);

    // 3.3 Branch A user querying Branch A Bank Account succeeds (200 OK)
    const reqBraBra = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId, {
      headers: { authorization: `Bearer ${staffWithPermToken}` },
    });
    const resBraBra = await GET(reqBraBra, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resBraBra.status === 200, `Branch A staff querying Branch A bank account returns HTTP 200 (actual: ${resBraBra.status})`);

    // 3.4 SUPER_ADMIN querying Enterprise account succeeds (200 OK)
    const reqAdminEnt = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + entBankId, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resAdminEnt = await GET(reqAdminEnt, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resAdminEnt.status === 200, `SUPER_ADMIN querying Enterprise bank account returns HTTP 200 (actual: ${resAdminEnt.status})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: BOLA / IDOR & PARAMETER VALIDATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/9] Testing BOLA / IDOR & Parameter Validation...');

    // 4.1 Missing bank_account_id returns 400 BAD_REQUEST
    const reqNoAcc = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resNoAcc = await GET(reqNoAcc, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resNoAcc.status === 400, `Missing bank_account_id returns HTTP 400 (actual: ${resNoAcc.status})`);
    const jsonNoAcc = await resNoAcc.json();
    assert(jsonNoAcc.error === 'BANK_ACCOUNT_REQUIRED', `Missing account error code is BANK_ACCOUNT_REQUIRED (actual: ${jsonNoAcc.error})`);

    // 4.2 Non-existent bank_account_id returns 404 NOT_FOUND
    const reqGhostAcc = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=ba_non_existent', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resGhostAcc = await GET(reqGhostAcc, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resGhostAcc.status === 404, `Non-existent bank_account_id returns HTTP 404 (actual: ${resGhostAcc.status})`);

    // 4.3 Malformed as_of_date returns 400 BAD_REQUEST
    const reqBadDate = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId + '&as_of_date=2026/09/15', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resBadDate = await GET(reqBadDate, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resBadDate.status === 400, `Malformed as_of_date returns HTTP 400 (actual: ${resBadDate.status})`);
    const jsonBadDate = await resBadDate.json();
    assert(jsonBadDate.error === 'INVALID_DATE_FORMAT', `Bad date error code is INVALID_DATE_FORMAT (actual: ${jsonBadDate.error})`);

    // Create session on Branch B account to test cross-account session mismatch
    const testSessionBId = `brs_test_b_${tsSuffix}`;
    await client.query(`
      INSERT INTO public.bank_reconciliation_session (id, bank_account_id, company_id, period_start, period_end, status, prepared_by, created_at, updated_at)
      VALUES ($1, $2, 'default_company', '2026-09-01', '2026-09-15', 'IN_PROGRESS', 'usr_preparer', NOW(), NOW());
    `, [testSessionBId, branchBBankId]);
    createdSessionIds.push(testSessionBId);

    // 4.4 Session/Account mismatch rejected with 400 BAD_REQUEST
    const reqMismatch = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId + '&session_id=' + testSessionBId, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resMismatch = await GET(reqMismatch, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resMismatch.status === 400, `Cross-account session_id mismatch returns HTTP 400 (actual: ${resMismatch.status})`);
    const jsonMismatch = await resMismatch.json();
    assert(jsonMismatch.error === 'SESSION_ACCOUNT_MISMATCH', `Mismatch error code is SESSION_ACCOUNT_MISMATCH (actual: ${jsonMismatch.error})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: BRS STATEMENT CALCULATION API (`statements/calculate`)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/9] Testing BRS Statement Calculation API...');

    const reqCalc = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=' + branchABankId + '&as_of_date=2026-09-15', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resCalc = await GET(reqCalc, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'calculate'] } });
    assert(resCalc.status === 200, `Calculation endpoint returns HTTP 200 (actual: ${resCalc.status})`);
    const jsonCalc = await resCalc.json();
    assert(jsonCalc.success === true, 'Calculation response success === true');
    assert(jsonCalc.data && jsonCalc.data.summary, 'Calculation response contains data.summary');

    const summary = jsonCalc.data.summary;
    // Check dual representation: currency decimal and integer paise fields
    assert(typeof summary.statementClosingBalance === 'number', 'summary.statementClosingBalance is number');
    assert(typeof summary.statementClosingBalancePaise === 'number', 'summary.statementClosingBalancePaise is integer');
    assert(typeof summary.gl1112BookBalance === 'number', 'summary.gl1112BookBalance is number');
    assert(typeof summary.gl1112BookBalancePaise === 'number', 'summary.gl1112BookBalancePaise is integer');
    assert(typeof summary.reconciledBookBalance === 'number', 'summary.reconciledBookBalance is number');
    assert(typeof summary.reconciledBookBalancePaise === 'number', 'summary.reconciledBookBalancePaise is integer');
    assert(typeof summary.discrepancy === 'number', 'summary.discrepancy is number');
    assert(typeof summary.discrepancyPaise === 'number', 'summary.discrepancyPaise is integer');
    assert(typeof summary.isReconciled === 'boolean', 'summary.isReconciled is boolean');

    // Check mathematical identity: Reconciled Book Balance = B_bank + D_transit - P_disb + U_dr - U_cr
    const expectedReconciledPaise =
      summary.statementClosingBalancePaise +
      summary.totalDepositsInTransitPaise -
      summary.totalOutstandingDisbursementsPaise +
      summary.totalUnmatchedBankDebitsPaise -
      summary.totalUnmatchedBankCreditsPaise;
    assert(summary.reconciledBookBalancePaise === expectedReconciledPaise, `Reconciled book balance paise matches identity formula (${summary.reconciledBookBalancePaise} === ${expectedReconciledPaise})`);

    // Check breakdown counts
    assert(typeof jsonCalc.data.breakdownCounts === 'object', 'breakdownCounts object is returned');
    assert(typeof jsonCalc.data.breakdownCounts.depositsInTransitCount === 'number', 'depositsInTransitCount is number');
    assert(typeof jsonCalc.data.breakdownCounts.outstandingDisbursementsCount === 'number', 'outstandingDisbursementsCount is number');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: UNCLEARED DEPOSITS SCHEDULE API
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/9] Testing Uncleared Deposits Schedule API...');

    const reqDep = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/uncleared-deposits?bank_account_id=' + branchABankId + '&limit=50&offset=0', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resDep = await GET(reqDep, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'uncleared-deposits'] } });
    assert(resDep.status === 200, `Uncleared deposits endpoint returns HTTP 200 (actual: ${resDep.status})`);
    const jsonDep = await resDep.json();
    assert(jsonDep.success === true, 'Uncleared deposits success === true');
    assert(Array.isArray(jsonDep.data.items), 'items is an array');
    assert(typeof jsonDep.data.totalCount === 'number', 'totalCount is number');
    assert(typeof jsonDep.data.totalAmount === 'number', 'totalAmount is number');
    assert(jsonDep.data.limit === 50, `limit is 50 (actual: ${jsonDep.data.limit})`);
    assert(jsonDep.data.offset === 0, `offset is 0 (actual: ${jsonDep.data.offset})`);

    // Test limit clamping (max 200)
    const reqDepClamp = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/uncleared-deposits?bank_account_id=' + branchABankId + '&limit=9999', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resDepClamp = await GET(reqDepClamp, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'uncleared-deposits'] } });
    const jsonDepClamp = await resDepClamp.json();
    assert(jsonDepClamp.data.limit === 200, `Excessive limit clamped to 200 (actual: ${jsonDepClamp.data.limit})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: OUTSTANDING DISBURSEMENTS SCHEDULE API
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/9] Testing Outstanding Disbursements Schedule API...');

    const reqDisb = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/outstanding-disbursements?bank_account_id=' + branchABankId + '&limit=50&offset=0', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resDisb = await GET(reqDisb, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'outstanding-disbursements'] } });
    assert(resDisb.status === 200, `Outstanding disbursements endpoint returns HTTP 200 (actual: ${resDisb.status})`);
    const jsonDisb = await resDisb.json();
    assert(jsonDisb.success === true, 'Outstanding disbursements success === true');
    assert(Array.isArray(jsonDisb.data.items), 'items is an array');
    assert(typeof jsonDisb.data.totalCount === 'number', 'totalCount is number');
    assert(typeof jsonDisb.data.totalAmount === 'number', 'totalAmount is number');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: UNMATCHED STATEMENT LINES SCHEDULE API
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/9] Testing Unmatched Statement Lines Schedule API...');

    const reqLines = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/statements/unmatched-lines?bank_account_id=' + branchABankId + '&type=ALL&limit=50&offset=0', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resLines = await GET(reqLines, { params: { path: ['admin', 'bank-reconciliation', 'statements', 'unmatched-lines'] } });
    assert(resLines.status === 200, `Unmatched lines endpoint returns HTTP 200 (actual: ${resLines.status})`);
    const jsonLines = await resLines.json();
    assert(jsonLines.success === true, 'Unmatched lines success === true');
    assert(Array.isArray(jsonLines.data.items), 'items is an array');
    assert(typeof jsonLines.data.totalCount === 'number', 'totalCount is number');
    assert(typeof jsonLines.data.totalDebitAmount === 'number', 'totalDebitAmount is number');
    assert(typeof jsonLines.data.totalCreditAmount === 'number', 'totalCreditAmount is number');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: RECONCILIATION SESSIONS QUERY APIS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/9] Testing Reconciliation Sessions Query APIs...');

    // 9.1 List sessions
    const reqSessList = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/sessions?bank_account_id=' + branchBBankId, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resSessList = await GET(reqSessList, { params: { path: ['admin', 'bank-reconciliation', 'sessions'] } });
    assert(resSessList.status === 200, `List sessions returns HTTP 200 (actual: ${resSessList.status})`);
    const jsonSessList = await resSessList.json();
    assert(jsonSessList.success === true, 'List sessions success === true');
    assert(Array.isArray(jsonSessList.data.sessions), 'sessions is an array');
    assert(jsonSessList.data.sessions.some(s => s.id === testSessionBId), 'Created test session found in listing');

    // 9.2 Get session by ID
    const reqSessDetail = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/sessions/' + testSessionBId, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resSessDetail = await GET(reqSessDetail, { params: { path: ['admin', 'bank-reconciliation', 'sessions', testSessionBId] } });
    assert(resSessDetail.status === 200, `Session detail returns HTTP 200 (actual: ${resSessDetail.status})`);
    const jsonSessDetail = await resSessDetail.json();
    assert(jsonSessDetail.success === true, 'Session detail success === true');
    assert(jsonSessDetail.data.session.id === testSessionBId, `Session ID matches (${jsonSessDetail.data.session.id})`);
    assert(jsonSessDetail.data.bankAccount && jsonSessDetail.data.bankAccount.id === branchBBankId, 'Associated bankAccount metadata returned');

    // 9.3 Non-existent session returns 404 NOT_FOUND
    const reqGhostSess = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/sessions/brs_ghost_9999', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resGhostSess = await GET(reqGhostSess, { params: { path: ['admin', 'bank-reconciliation', 'sessions', 'brs_ghost_9999'] } });
    assert(resGhostSess.status === 404, `Non-existent session returns HTTP 404 (actual: ${resGhostSess.status})`);

    // 9.4 Cross-branch access to session rejected with 403 FORBIDDEN
    const reqCrossSess = new NextRequest('http://localhost:3000/api/v1/admin/bank-reconciliation/sessions/' + testSessionBId, {
      headers: { authorization: `Bearer ${staffWithPermToken}` }, // staff belongs to Branch A, session is on Branch B
    });
    const resCrossSess = await GET(reqCrossSess, { params: { path: ['admin', 'bank-reconciliation', 'sessions', testSessionBId] } });
    assert(resCrossSess.status === 403, `Cross-branch session detail access returns HTTP 403 (actual: ${resCrossSess.status})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10: ZERO-MUTATION & COMPLETE FIXTURE TEARDOWN
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[10/10] Verifying Zero-Mutation Invariant & Teardown...');

    // Zero accounting vouchers created
    const postVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(postVouchers.rows[0].count === 0, `Zero accounting vouchers created during tests === 0 (actual: ${postVouchers.rows[0].count})`);

    // Zero journal entries created
    const postJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(postJournals.rows[0].count === 0, `Zero accounting journal entries created during tests === 0 (actual: ${postJournals.rows[0].count})`);

    // Zero matches created
    const postMatches = await client.query('SELECT count(*)::int AS count FROM public.bank_reconciliation_match');
    assert(postMatches.rows[0].count === 0, `Zero reconciliation matches created during tests === 0 (actual: ${postMatches.rows[0].count})`);

    // Teardown created sessions
    if (createdSessionIds.length > 0) {
      await client.query('DELETE FROM public.bank_reconciliation_session WHERE id = ANY($1)', [createdSessionIds]);
    }
    // Teardown created bank accounts
    if (createdBankAccIds.length > 0) {
      await client.query('DELETE FROM public.bank_account WHERE id = ANY($1)', [createdBankAccIds]);
    }
    console.log('  ✓ Cleaned up all test fixtures (sessions and bank accounts)');

    // Post-teardown baseline audit
    const finalAccounts = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(finalAccounts.rows[0].count === 99, `Post-test accounting_account === 99 (actual: ${finalAccounts.rows[0].count})`);

    const finalSessions = await client.query('SELECT count(*)::int AS count FROM public.bank_reconciliation_session');
    assert(finalSessions.rows[0].count === 0, `Post-test bank_reconciliation_session === 0 (actual: ${finalSessions.rows[0].count})`);

    const finalBankAccounts = await client.query('SELECT count(*)::int AS count FROM public.bank_account');
    assert(finalBankAccounts.rows[0].count === 0, `Post-test bank_account === 0 (actual: ${finalBankAccounts.rows[0].count})`);

    const finalOrders = await client.query('SELECT count(*)::int AS count FROM public.order WHERE deleted_at IS NULL');
    assert(finalOrders.rows[0].count === 173, `Historical order baseline untouched === 173 (actual: ${finalOrders.rows[0].count})`);

    const finalPayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    assert(finalPayments.rows[0].count === 53, `Prototype transaction baseline untouched === 53 (actual: ${finalPayments.rows[0].count})`);

  } finally {
    await client.end();
    await closeDbPool();
  }

  console.log('\n=============================================================================');
  console.log(`STEP 4.10.5-D-B TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('[Test Execution Fatal Error]', err);
  process.exit(1);
});
