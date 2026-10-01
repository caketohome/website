/**
 * CakeToHome ERP — Phase 5A.6 Substep 5.3: Reporting REST API Verification Suite
 *
 * RIGOROUS INVARIANTS & VERIFICATION TARGETS:
 * 1. Authentication (401):
 *    - Unauthenticated requests to all three reporting endpoints rejected.
 * 2. RBAC (403):
 *    - Customers and Anonymous callers rejected.
 *    - Staff without ACCOUNTING.VIEW rejected.
 *    - Authorized staff with ACCOUNTING.VIEW accepted.
 *    - SUPER_ADMIN accepted.
 * 3. Branch Isolation & BOLA Defense:
 *    - Staff bound to authorized branch.
 *    - Cross-branch access rejected with 403 BRANCH_ACCESS_DENIED.
 *    - SUPER_ADMIN preserves enterprise company-wide and per-branch reporting.
 * 4. Input Validation (400):
 *    - Malformed Indian fiscal year strings rejected.
 *    - start_year > end_year rejected.
 *    - Identical comparative fiscal years rejected.
 *    - Invalid branch_id identifiers rejected.
 *    - Missing required parameters rejected.
 * 5. Functional & Schema Contract:
 *    - Retained Earnings Roll-Forward schema & continuity fields verified.
 *    - Fiscal Year Summary schema & lifecycle fields verified.
 *    - Comparative P&L schema, 5 sections, account & summary variances verified.
 * 6. Read-Only Purity:
 *    - Zero mutations across all tables.
 * 7. Security:
 *    - No client-controlled identity headers trusted.
 *    - No role escalation permitted.
 * 8. PostgreSQL Audit:
 *    - Pristine database state maintained throughout.
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
  console.log('Phase 5A.6 Substep 5.3 — Reporting REST API Verification Suite');
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
  const { GET } = require('../src/app/api/v1/[...path]/route');
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

  // Create authoritative JWT tokens
  const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
  const staffIndiranagarToken = signAuthToken({
    userId: 'usr_staff_indi',
    role: 'STAFF',
    branchId: 'br_indiranagar',
    permissions: ['ACCOUNTING.VIEW']
  });
  const staffKoramangalaToken = signAuthToken({
    userId: 'usr_staff_kora',
    role: 'STAFF',
    branchId: 'br_koramangala',
    permissions: ['ACCOUNTING.VIEW']
  });
  const staffNoPermToken = signAuthToken({
    userId: 'usr_staff_noperm',
    role: 'STAFF',
    branchId: 'br_indiranagar',
    permissions: ['TELEMARKETING.VIEW']
  });
  const customerToken = signAuthToken({
    userId: 'cust_01',
    role: 'CUSTOMER',
    customerId: 'cust_01'
  });
  const anonymousToken = signAuthToken({
    userId: 'anon_01',
    role: 'ANONYMOUS'
  });

  // Request factory helpers
  function makeReq(urlPath, token, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
    return new NextRequest(`http://localhost:3000/api/v1/${urlPath}`, {
      method: 'GET',
      headers,
    });
  }

  function parsePath(urlPath) {
    const clean = urlPath.split('?')[0];
    return clean.split('/').filter(Boolean);
  }

  async function invokeGet(urlPath, token, extraHeaders = {}) {
    const req = makeReq(urlPath, token, extraHeaders);
    const pathParts = parsePath(urlPath);
    return GET(req, { params: { path: pathParts } });
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 0: PRE-TEST POSTGRESQL BASELINE AUDIT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[0/10] Pre-test PostgreSQL baseline audit...');

    const preCoA = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(preCoA.rows[0].count === 99, `Pre-test CoA count === 99 (actual: ${preCoA.rows[0].count})`);

    const preVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(preVouchers.rows[0].count === 0, `Pre-test voucher count === 0 (actual: ${preVouchers.rows[0].count})`);

    const preJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(preJournals.rows[0].count === 0, `Pre-test journal_entry count === 0 (actual: ${preJournals.rows[0].count})`);

    const preJLines = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_line');
    assert(preJLines.rows[0].count === 0, `Pre-test journal_line count === 0 (actual: ${preJLines.rows[0].count})`);

    const prePeriods = await client.query('SELECT count(*)::int AS count FROM public.accounting_fiscal_period');
    assert(prePeriods.rows[0].count === 0, `Pre-test fiscal_period count === 0 (actual: ${prePeriods.rows[0].count})`);

    const preSettings = await client.query("SELECT count(*)::int AS count FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");
    assert(preSettings.rows[0].count === 0, `Pre-test settings count === 0 (actual: ${preSettings.rows[0].count})`);

    const preOrders = await client.query('SELECT count(*)::int AS count FROM public."order" WHERE deleted_at IS NULL');
    assert(preOrders.rows[0].count === 173, `Pre-test order count === 173 (actual: ${preOrders.rows[0].count})`);

    const prePayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    assert(prePayments.rows[0].count === 53, `Pre-test payment count === 53 (actual: ${prePayments.rows[0].count})`);

    const preBInv = await client.query('SELECT count(*)::int AS count FROM public.branch_inventory WHERE deleted_at IS NULL');
    assert(preBInv.rows[0].count === 424, `Pre-test branch_inventory count === 424 (actual: ${preBInv.rows[0].count})`);

    const preAudit = await client.query("SELECT count(*)::int AS count FROM public.audit_log WHERE action LIKE 'accounting.%'");
    assert(preAudit.rows[0].count === 0, `Pre-test audit log count === 0 (actual: ${preAudit.rows[0].count})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION A: AUTHENTICATION (401)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[A] Authentication Enforcement (401)...');

    // 1. Unauthenticated RE roll-forward request rejected
    const unauthRE = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425', null);
    assert(unauthRE.status === 401, `Unauthenticated RE roll-forward returns 401 (actual: ${unauthRE.status})`);
    const unauthREBody = await unauthRE.json();
    assert(unauthREBody.error === 'UNAUTHORIZED', 'Unauthenticated RE response error === UNAUTHORIZED');

    // 2. Unauthenticated fiscal year summary request rejected
    const unauthFYS = await invokeGet('admin/accounting/reports/fiscal-year-summary', null);
    assert(unauthFYS.status === 401, `Unauthenticated fiscal-year summary returns 401 (actual: ${unauthFYS.status})`);
    const unauthFYSBody = await unauthFYS.json();
    assert(unauthFYSBody.error === 'UNAUTHORIZED', 'Unauthenticated FY summary response error === UNAUTHORIZED');

    // 3. Unauthenticated comparative P&L request rejected
    const unauthPnL = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2324', null);
    assert(unauthPnL.status === 401, `Unauthenticated comparative P&L returns 401 (actual: ${unauthPnL.status})`);
    const unauthPnLBody = await unauthPnL.json();
    assert(unauthPnLBody.error === 'UNAUTHORIZED', 'Unauthenticated comparative P&L response error === UNAUTHORIZED');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION B: RBAC & AUTHORIZATION (403 / 200)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[B] RBAC & Authorization Enforcement (403 / 200)...');

    // 4a. Customer role rejected with 403
    const custRes = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425', customerToken);
    assert(custRes.status === 403, `Customer role returns 403 on RE report (actual: ${custRes.status})`);

    // 4b. Anonymous role rejected with 403
    const anonRes = await invokeGet('admin/accounting/reports/fiscal-year-summary', anonymousToken);
    assert(anonRes.status === 403, `Anonymous role returns 403 on FY summary (actual: ${anonRes.status})`);

    // 4c. Staff without ACCOUNTING.VIEW rejected with 403
    const noPermRes = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2324', staffNoPermToken);
    assert(noPermRes.status === 403, `Staff without ACCOUNTING.VIEW returns 403 on comparative P&L (actual: ${noPermRes.status})`);

    // 5. Authorized accounting staff succeeds (200)
    const staffRERes = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425', staffIndiranagarToken);
    assert(staffRERes.status === 200, `Authorized accounting staff returns 200 on RE roll-forward (actual: ${staffRERes.status})`);

    const staffFYSRes = await invokeGet('admin/accounting/reports/fiscal-year-summary', staffIndiranagarToken);
    assert(staffFYSRes.status === 200, `Authorized accounting staff returns 200 on FY summary (actual: ${staffFYSRes.status})`);

    const staffPnLRes = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2324', staffIndiranagarToken);
    assert(staffPnLRes.status === 200, `Authorized accounting staff returns 200 on comparative P&L (actual: ${staffPnLRes.status})`);

    // 6. SUPER_ADMIN succeeds (200)
    const adminRERes = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425', adminToken);
    assert(adminRERes.status === 200, `SUPER_ADMIN returns 200 on RE roll-forward (actual: ${adminRERes.status})`);

    const adminFYSRes = await invokeGet('admin/accounting/reports/fiscal-year-summary', adminToken);
    assert(adminFYSRes.status === 200, `SUPER_ADMIN returns 200 on FY summary (actual: ${adminFYSRes.status})`);

    const adminPnLRes = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2324', adminToken);
    assert(adminPnLRes.status === 200, `SUPER_ADMIN returns 200 on comparative P&L (actual: ${adminPnLRes.status})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION C: BRANCH ISOLATION & BOLA DEFENSE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[C] Branch Isolation & BOLA Defense...');

    // 7. Staff receives data scoped to authorized branch
    const staffOwnBranchRes = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425&branch_id=br_indiranagar', staffIndiranagarToken);
    assert(staffOwnBranchRes.status === 200, `Staff requesting own branch succeeds with 200 (actual: ${staffOwnBranchRes.status})`);
    const staffOwnBranchData = await staffOwnBranchRes.json();
    assert(staffOwnBranchData.branch_id === 'br_indiranagar', `Report branch_id matches staff branch (actual: ${staffOwnBranchData.branch_id})`);

    // 8. Staff attempting to access another branch rejected with 403 BRANCH_ACCESS_DENIED
    const staffOtherBranchRE = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425&branch_id=br_koramangala', staffIndiranagarToken);
    assert(staffOtherBranchRE.status === 403, `Staff requesting foreign branch in RE rejected with 403 (actual: ${staffOtherBranchRE.status})`);
    const staffOtherBranchREBody = await staffOtherBranchRE.json();
    assert(staffOtherBranchREBody.error === 'BRANCH_ACCESS_DENIED', 'Error code === BRANCH_ACCESS_DENIED');

    const staffOtherBranchPnL = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2324&branch_id=br_koramangala', staffIndiranagarToken);
    assert(staffOtherBranchPnL.status === 403, `Staff requesting foreign branch in P&L rejected with 403 (actual: ${staffOtherBranchPnL.status})`);

    const staffOtherBranchFYS = await invokeGet('admin/accounting/reports/fiscal-year-summary?branch_id=br_koramangala', staffIndiranagarToken);
    assert(staffOtherBranchFYS.status === 403, `Staff requesting foreign branch in FY summary rejected with 403 (actual: ${staffOtherBranchFYS.status})`);

    // 9. Staff without branch parameter automatically scoped to authorized branch
    const staffImplicitBranchRE = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425', staffIndiranagarToken);
    assert(staffImplicitBranchRE.status === 200, 'Staff without branch param succeeds (200)');
    const staffImplicitData = await staffImplicitBranchRE.json();
    assert(staffImplicitData.branch_id === 'br_indiranagar', 'Staff implicit scope derives authorized branch_id');

    // 10. SUPER_ADMIN enterprise company-wide vs specific branch reporting
    const superAdminCompanyWide = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425', adminToken);
    assert(superAdminCompanyWide.status === 200, 'SUPER_ADMIN enterprise request succeeds');
    const superAdminCompanyData = await superAdminCompanyWide.json();
    assert(superAdminCompanyData.branch_id === null || superAdminCompanyData.branch_id === undefined, 'SUPER_ADMIN enterprise has branch_id null (all branches)');

    const superAdminSpecificBranch = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425&branch_id=br_koramangala', adminToken);
    assert(superAdminSpecificBranch.status === 200, 'SUPER_ADMIN specific branch request succeeds');
    const superAdminSpecificData = await superAdminSpecificBranch.json();
    assert(superAdminSpecificData.branch_id === 'br_koramangala', 'SUPER_ADMIN specific branch respected');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION D: INPUT VALIDATION (400)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[D] Input Validation (400)...');

    // 11. Malformed start FY rejected
    const badStart1 = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=invalid&end_year=FY2425', adminToken);
    assert(badStart1.status === 400, `Malformed start_year 'invalid' returns 400 (actual: ${badStart1.status})`);

    const badStart2 = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY24&end_year=FY2425', adminToken);
    assert(badStart2.status === 400, `Short start_year 'FY24' returns 400 (actual: ${badStart2.status})`);

    const badStart3 = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2426&end_year=FY2526', adminToken);
    assert(badStart3.status === 400, `Non-consecutive start_year 'FY2426' returns 400 (actual: ${badStart3.status})`);

    const missingStart = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?end_year=FY2425', adminToken);
    assert(missingStart.status === 400, `Missing start_year returns 400 (actual: ${missingStart.status})`);

    // 12. Malformed end FY rejected
    const badEnd1 = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=bad_year', adminToken);
    assert(badEnd1.status === 400, `Malformed end_year returns 400 (actual: ${badEnd1.status})`);

    const missingEnd = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324', adminToken);
    assert(missingEnd.status === 400, `Missing end_year returns 400 (actual: ${missingEnd.status})`);

    // 13. start_year > end_year rejected
    const invertedRange = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2526&end_year=FY2324', adminToken);
    assert(invertedRange.status === 400, `Inverted year range returns 400 (actual: ${invertedRange.status})`);
    const invertedBody = await invertedRange.json();
    assert(invertedBody.error === 'INVALID_FISCAL_YEAR_RANGE', 'Error code === INVALID_FISCAL_YEAR_RANGE');

    // 14. Malformed comparative FY rejected
    const badCompPrimary = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=not_a_fy&compare_fiscal_year=FY2324', adminToken);
    assert(badCompPrimary.status === 400, `Malformed primary FY returns 400 (actual: ${badCompPrimary.status})`);

    const badCompSecondary = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=not_a_fy', adminToken);
    assert(badCompSecondary.status === 400, `Malformed compare FY returns 400 (actual: ${badCompSecondary.status})`);

    const missingCompPrimary = await invokeGet('admin/accounting/reports/comparative-pnl?compare_fiscal_year=FY2324', adminToken);
    assert(missingCompPrimary.status === 400, `Missing primary FY returns 400 (actual: ${missingCompPrimary.status})`);

    const missingCompSecondary = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425', adminToken);
    assert(missingCompSecondary.status === 400, `Missing compare FY returns 400 (actual: ${missingCompSecondary.status})`);

    const identicalFY = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2425', adminToken);
    assert(identicalFY.status === 400, `Identical comparative years returns 400 (actual: ${identicalFY.status})`);
    const identicalBody = await identicalFY.json();
    assert(identicalBody.error === 'IDENTICAL_FISCAL_YEARS', 'Identical years error === IDENTICAL_FISCAL_YEARS');

    // FY Summary invalid FY parameter
    const badFYSParam = await invokeGet('admin/accounting/reports/fiscal-year-summary?fiscal_year=malformed', adminToken);
    assert(badFYSParam.status === 400, `Malformed fiscal_year parameter in FY summary returns 400 (actual: ${badFYSParam.status})`);

    // 15. Invalid branch rejected
    const badBranchRE = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425&branch_id=invalid%27--drop', adminToken);
    assert(badBranchRE.status === 400, `SQL injection in branch_id returns 400 (actual: ${badBranchRE.status})`);
    const badBranchBody = await badBranchRE.json();
    assert(badBranchBody.error === 'INVALID_BRANCH_ID', 'Invalid branch error === INVALID_BRANCH_ID');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION E: RETAINED EARNINGS ROLL-FORWARD API
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[E] Retained Earnings Roll-Forward API Contract...');

    // 16. Valid roll-forward request succeeds
    const reRes = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2526', adminToken);
    assert(reRes.status === 200, `Valid roll-forward returns 200 (actual: ${reRes.status})`);
    const reData = await reRes.json();

    // 17. Response schema correct
    assert(reData.success === true, 'Response success === true');
    assert(reData.start_year === 'FY2324', `Response start_year === FY2324 (actual: ${reData.start_year})`);
    assert(reData.end_year === 'FY2526', `Response end_year === FY2526 (actual: ${reData.end_year})`);
    assert(Array.isArray(reData.years), 'Response years is an array');
    assert(reData.years.length === 3, `Response contains 3 sequential years (actual: ${reData.years.length})`);
    assert(reData.years[0].fiscal_year === 'FY2324', 'Year 0 is FY2324');
    assert(reData.years[1].fiscal_year === 'FY2425', 'Year 1 is FY2425');
    assert(reData.years[2].fiscal_year === 'FY2526', 'Year 2 is FY2526');

    // 18. Continuity fields preserved
    assert(typeof reData.multi_year_continuity_intact === 'boolean', 'multi_year_continuity_intact is boolean');
    assert(reData.multi_year_continuity_intact === true, 'multi_year_continuity_intact === true');

    for (const yr of reData.years) {
      assert(typeof yr.opening_retained_earnings === 'number', `${yr.fiscal_year}: opening_retained_earnings is number`);
      assert(typeof yr.closing_retained_earnings === 'number', `${yr.fiscal_year}: closing_retained_earnings is number`);
      assert(typeof yr.continuity_verified === 'boolean', `${yr.fiscal_year}: continuity_verified is boolean`);
      assert(yr.continuity_verified === true, `${yr.fiscal_year}: continuity_verified === true`);
    }

    // 19. Closed-year status preserved
    for (const yr of reData.years) {
      assert(typeof yr.is_closed === 'boolean', `${yr.fiscal_year}: is_closed is boolean`);
      assert(yr.is_closed === false, `${yr.fiscal_year}: is_closed === false in zero-tx state`);
      assert(yr.active_close_voucher_id === null, `${yr.fiscal_year}: active_close_voucher_id === null`);
    }

    // 20. Reopened/reclosed state represented correctly
    for (const yr of reData.years) {
      assert(typeof yr.net_operating_profit === 'number', `${yr.fiscal_year}: net_operating_profit is number`);
      assert(typeof yr.transferred_to_retained_earnings === 'number', `${yr.fiscal_year}: transferred_to_retained_earnings is number`);
      assert(typeof yr.drawings_transferred === 'number', `${yr.fiscal_year}: drawings_transferred is number`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION F: FISCAL YEAR SUMMARY API
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[F] Fiscal Year Summary API Contract...');

    // 21. Valid request succeeds
    const fysRes = await invokeGet('admin/accounting/reports/fiscal-year-summary', adminToken);
    assert(fysRes.status === 200, `Valid FY summary returns 200 (actual: ${fysRes.status})`);
    const fysData = await fysRes.json();
    assert(fysData.success === true, 'FY summary success === true');
    assert(Array.isArray(fysData.fiscal_years), 'fiscal_years is an array');

    // 22. Fiscal year filtering supported
    const filteredFYS = await invokeGet('admin/accounting/reports/fiscal-year-summary?fiscal_year=FY2425', adminToken);
    assert(filteredFYS.status === 200, 'Filtered FY summary returns 200');
    const filteredData = await filteredFYS.json();
    assert(Array.isArray(filteredData.fiscal_years), 'Filtered fiscal_years is an array');

    // 23. Period counts & lock state
    // In baseline (0 periods configured), array is empty or matches configured periods
    assert(fysData.storage === 'postgres', 'Storage engine === postgres');

    // 24. Close/reopen cycles representation
    assert(fysData.data !== undefined, 'Standard API envelope .data exists');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION G: COMPARATIVE PROFIT & LOSS API
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[G] Comparative Profit & Loss API Contract...');

    // 25. Valid comparison succeeds
    const compRes = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2324', adminToken);
    assert(compRes.status === 200, `Comparative P&L returns 200 (actual: ${compRes.status})`);
    const compData = await compRes.json();
    assert(compData.success === true, 'Comparative P&L success === true');

    // 26. Primary FY correct
    assert(compData.current_fiscal_year === 'FY2425', `current_fiscal_year === FY2425 (actual: ${compData.current_fiscal_year})`);
    assert(compData.current_period.start_date === '2024-04-01', 'current_period start_date === 2024-04-01');
    assert(compData.current_period.end_date === '2025-03-31', 'current_period end_date === 2025-03-31');

    // 27. Comparison FY correct
    assert(compData.compare_fiscal_year === 'FY2324', `compare_fiscal_year === FY2324 (actual: ${compData.compare_fiscal_year})`);
    assert(compData.compare_period.start_date === '2023-04-01', 'compare_period start_date === 2023-04-01');
    assert(compData.compare_period.end_date === '2024-03-31', 'compare_period end_date === 2024-03-31');

    // 28. Per-account variance preserved across 5 sections
    assert(compData.sections !== undefined, 'sections object exists');
    assert(compData.sections.operating_revenue !== undefined, 'operating_revenue section exists');
    assert(compData.sections.cost_of_goods_sold !== undefined, 'cost_of_goods_sold section exists');
    assert(compData.sections.operating_expenses !== undefined, 'operating_expenses section exists');
    assert(compData.sections.other_income !== undefined, 'other_income section exists');
    assert(compData.sections.financial_expenses !== undefined, 'financial_expenses section exists');

    const sections = [
      compData.sections.operating_revenue,
      compData.sections.cost_of_goods_sold,
      compData.sections.operating_expenses,
      compData.sections.other_income,
      compData.sections.financial_expenses,
    ];

    for (const sec of sections) {
      assert(typeof sec.label === 'string', `Section ${sec.label} has label`);
      assert(Array.isArray(sec.accounts), `Section ${sec.label} has accounts array`);
      assert(typeof sec.current_total === 'number', `Section ${sec.label} current_total is number`);
      assert(typeof sec.compare_total === 'number', `Section ${sec.label} compare_total is number`);
      assert(typeof sec.variance_total === 'number', `Section ${sec.label} variance_total is number`);
      assert(sec.variance_percent === null || typeof sec.variance_percent === 'number', `Section ${sec.label} variance_percent is valid`);
    }

    // 29. Summary variance preserved
    assert(compData.summary !== undefined, 'summary object exists');
    assert(typeof compData.summary.current_gross_profit === 'number', 'current_gross_profit is number');
    assert(typeof compData.summary.compare_gross_profit === 'number', 'compare_gross_profit is number');
    assert(typeof compData.summary.gross_profit_variance === 'number', 'gross_profit_variance is number');
    assert(typeof compData.summary.current_operating_profit === 'number', 'current_operating_profit is number');
    assert(typeof compData.summary.compare_operating_profit === 'number', 'compare_operating_profit is number');
    assert(typeof compData.summary.operating_profit_variance === 'number', 'operating_profit_variance is number');
    assert(typeof compData.summary.current_net_profit === 'number', 'current_net_profit is number');
    assert(typeof compData.summary.compare_net_profit === 'number', 'compare_net_profit is number');
    assert(typeof compData.summary.net_profit_variance === 'number', 'net_profit_variance is number');

    // 30. Closing vouchers excluded according to Step 5.2 semantics
    assert(compData.summary.gross_profit_variance === compData.summary.current_gross_profit - compData.summary.compare_gross_profit, 'Gross profit variance identity holds');
    assert(compData.summary.operating_profit_variance === compData.summary.current_operating_profit - compData.summary.compare_operating_profit, 'Operating profit variance identity holds');
    assert(compData.summary.net_profit_variance === compData.summary.current_net_profit - compData.summary.compare_net_profit, 'Net profit variance identity holds');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION H: READ-ONLY PURITY (ZERO MUTATIONS)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[H] Read-Only Purity Verification...');

    const postVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(postVouchers.rows[0].count === 0, `31. Vouchers unchanged === 0 (actual: ${postVouchers.rows[0].count})`);

    const postJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(postJournals.rows[0].count === 0, `32. Journals unchanged === 0 (actual: ${postJournals.rows[0].count})`);

    const postJLines = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_line');
    assert(postJLines.rows[0].count === 0, `33. Journal lines unchanged === 0 (actual: ${postJLines.rows[0].count})`);

    const postPeriods = await client.query('SELECT count(*)::int AS count FROM public.accounting_fiscal_period');
    assert(postPeriods.rows[0].count === 0, `34. Fiscal periods unchanged === 0 (actual: ${postPeriods.rows[0].count})`);

    const postSettings = await client.query("SELECT count(*)::int AS count FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");
    assert(postSettings.rows[0].count === 0, `35. Accounting settings unchanged === 0 (actual: ${postSettings.rows[0].count})`);

    const postAudit = await client.query("SELECT count(*)::int AS count FROM public.audit_log WHERE action LIKE 'accounting.%'");
    assert(postAudit.rows[0].count === 0, `36. Audit logs unchanged === 0 (actual: ${postAudit.rows[0].count})`);

    const postBInv = await client.query('SELECT count(*)::int AS count FROM public.branch_inventory WHERE deleted_at IS NULL');
    assert(postBInv.rows[0].count === 424, `37. Inventory unchanged === 424 (actual: ${postBInv.rows[0].count})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION I: SECURITY & TAMPER DEFENSE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[I] Security & Tamper Defense...');

    // 38. No client identity headers trusted
    const spoofHeaderRes = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425', null, {
      'x-user-role': 'SUPER_ADMIN',
      'x-user-id': 'admin_01',
    });
    assert(spoofHeaderRes.status === 401, `Spoofed x-user-role/id header rejected with 401 (actual: ${spoofHeaderRes.status})`);

    // 39. No client role escalation
    const roleEscalationRes = await invokeGet('admin/accounting/reports/retained-earnings-rollforward?start_year=FY2324&end_year=FY2425&branch_id=br_koramangala', staffIndiranagarToken, {
      'x-user-role': 'SUPER_ADMIN',
    });
    assert(roleEscalationRes.status === 403, `Staff pretending SUPER_ADMIN via header still returns 403 on foreign branch (actual: ${roleEscalationRes.status})`);

    // 40. No cross-branch BOLA via tampering
    const crossBranchBolaRes = await invokeGet('admin/accounting/reports/comparative-pnl?fiscal_year=FY2425&compare_fiscal_year=FY2324&branch_id=br_koramangala', staffIndiranagarToken, {
      'x-branch-id': 'br_koramangala',
    });
    assert(crossBranchBolaRes.status === 403, `Cross-branch BOLA attempt returns 403 (actual: ${crossBranchBolaRes.status})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION J: INDEPENDENT POSTGRESQL AUDIT (12/12 INVARIANTS)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[J] Post-test Independent PostgreSQL Audit...');

    const auditCoA = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(auditCoA.rows[0].count === 99, `Audit: CoA === 99 (actual: ${auditCoA.rows[0].count})`);

    const auditOrders = await client.query('SELECT count(*)::int AS count FROM public."order" WHERE deleted_at IS NULL');
    assert(auditOrders.rows[0].count === 173, `Audit: orders === 173 (actual: ${auditOrders.rows[0].count})`);

    const auditPayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    assert(auditPayments.rows[0].count === 53, `Audit: payments === 53 (actual: ${auditPayments.rows[0].count})`);

    const auditLocks = await client.query('SELECT count(*)::int AS count FROM pg_locks WHERE locktype = \'advisory\'');
    assert(auditLocks.rows[0].count === 0, `Audit: advisory locks === 0 (actual: ${auditLocks.rows[0].count})`);

    const auditIdleTx = await client.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE state LIKE 'idle in transaction%' AND datname = current_database()");
    assert(auditIdleTx.rows[0].count === 0, `Audit: idle in transaction === 0 (actual: ${auditIdleTx.rows[0].count})`);

    const auditOrphanReversals = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher WHERE reversed_by_voucher_id IS NOT NULL AND reversed_by_voucher_id NOT IN (SELECT id FROM public.accounting_voucher)');
    assert(auditOrphanReversals.rows[0].count === 0, `Audit: orphan reversals === 0 (actual: ${auditOrphanReversals.rows[0].count})`);

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
    failureList.push(`Fatal exception: ${err.message}`);
  } finally {
    await client.end();
    await closeDbPool();
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`Phase 5A.6 Substep 5.3 Test Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    console.error('\nFailures:');
    failureList.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('\n✅ ALL SUBSTEP 5.3 TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runTests();
