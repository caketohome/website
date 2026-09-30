/**
 * Phase 5A.1 — GL Account Ledger & Trial Balance Verification Suite
 * Uses the same direct-import + NextRequest pattern as the frozen BRS API test suite.
 *
 * Sections:
 * 0. PostgreSQL baseline audit (pre-test)
 * 1. Route handler mounting
 * 2. Authentication & RBAC
 * 3. Functional — Trial Balance
 * 4. Functional — Account Ledger
 * 5. Functional — Accounts List
 * 6. Accounting integrity (TB debit === credit)
 * 7. PostgreSQL post-test audit (zero mutations)
 * 8. TAB_PERMISSION_MAP verification
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
  throw new Error("No database connection string found");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('Phase 5A.1 — GL Account Ledger & Trial Balance Verification');
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

  const { GeneralLedgerService } = require('../src/lib/services/general-ledger.service');
  const { StaffAccessControl } = require('../src/lib/staff-access-control');
  const { signAuthToken } = require('../src/lib/security/auth-session');
  const { GET } = require('../src/app/api/v1/[...path]/route');
  const { NextRequest } = require('next/server');
  const { closeDbPool } = require('../src/lib/db');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passCount = 0;
  let failCount = 0;
  const failures = [];

  function assert(condition, message) {
    if (condition) {
      passCount++;
      console.log(`  ✓ PASS: ${message}`);
    } else {
      failCount++;
      failures.push(message);
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 0: PRE-TEST POSTGRESQL BASELINE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[0/8] Pre-test PostgreSQL baseline audit...');

    const preCoA = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(preCoA.rows[0].count === 99, `Pre-test CoA count === 99 (actual: ${preCoA.rows[0].count})`);

    const preVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(preVouchers.rows[0].count === 0, `Pre-test voucher count === 0 (actual: ${preVouchers.rows[0].count})`);

    const preJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(preJournals.rows[0].count === 0, `Pre-test journal_entry count === 0 (actual: ${preJournals.rows[0].count})`);

    const preJLines = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_line');
    assert(preJLines.rows[0].count === 0, `Pre-test journal_line count === 0 (actual: ${preJLines.rows[0].count})`);

    const preOrders = await client.query('SELECT count(*)::int AS count FROM public.order WHERE deleted_at IS NULL');
    const preOrderCount = preOrders.rows[0].count;
    console.log(`  ℹ  Pre-test order count: ${preOrderCount}`);

    const prePayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    const prePaymentCount = prePayments.rows[0].count;
    console.log(`  ℹ  Pre-test payment count: ${prePaymentCount}`);

    const preFiscal = await client.query(`SELECT count(*)::int AS count FROM public.accounting_fiscal_period`);
    const preFiscalCount = preFiscal.rows[0].count;
    console.log(`  ℹ  Pre-test fiscal period count: ${preFiscalCount}`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: ROUTE HANDLER MOUNTING
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[1/8] Route handler & service mounting...');
    assert(typeof GET === 'function', 'GET route handler is exported');
    assert(typeof GeneralLedgerService.getAccountLedger === 'function', 'GeneralLedgerService.getAccountLedger exists');
    assert(typeof GeneralLedgerService.getTrialBalance === 'function', 'GeneralLedgerService.getTrialBalance exists');
    assert(typeof GeneralLedgerService.listAccounts === 'function', 'GeneralLedgerService.listAccounts exists');

    // Create tokens
    const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    const custToken = signAuthToken({ userId: 'cust_01', role: 'CUSTOMER', customerId: 'cust_01' });
    const staffNoPermToken = signAuthToken({ userId: 'usr_staff_noperm', role: 'STAFF', permissions: ['TELEMARKETING.VIEW'] });
    const staffWithAcctToken = signAuthToken({ userId: 'usr_staff_acct', role: 'STAFF', permissions: ['ACCOUNTING.VIEW'] });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: AUTHENTICATION & RBAC
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[2/8] Authentication & RBAC enforcement...');

    // 2.1 No auth → 401 on ledger
    const reqAnon1 = new NextRequest('http://localhost:3000/api/v1/admin/accounting/ledger?account_id=test');
    const resAnon1 = await GET(reqAnon1, { params: { path: ['admin', 'accounting', 'ledger'] } });
    assert(resAnon1.status === 401, `Unauthenticated ledger returns 401 (actual: ${resAnon1.status})`);

    // 2.2 No auth → 401 on trial-balance
    const reqAnon2 = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance');
    const resAnon2 = await GET(reqAnon2, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resAnon2.status === 401, `Unauthenticated trial-balance returns 401 (actual: ${resAnon2.status})`);

    // 2.3 No auth → 401 on accounts
    const reqAnon3 = new NextRequest('http://localhost:3000/api/v1/admin/accounting/accounts');
    const resAnon3 = await GET(reqAnon3, { params: { path: ['admin', 'accounting', 'accounts'] } });
    assert(resAnon3.status === 401, `Unauthenticated accounts returns 401 (actual: ${resAnon3.status})`);

    // 2.4 Customer → 403
    const reqCust = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance', {
      headers: { authorization: `Bearer ${custToken}` },
    });
    const resCust = await GET(reqCust, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resCust.status === 403, `Customer returns 403 on trial-balance (actual: ${resCust.status})`);

    // 2.5 Staff without ACCOUNTING.VIEW → 403
    const reqNoPerm = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance', {
      headers: { authorization: `Bearer ${staffNoPermToken}` },
    });
    const resNoPerm = await GET(reqNoPerm, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resNoPerm.status === 403, `Staff without ACCOUNTING.VIEW returns 403 (actual: ${resNoPerm.status})`);

    // 2.6 Staff WITH ACCOUNTING.VIEW → 200
    const reqWithPerm = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance', {
      headers: { authorization: `Bearer ${staffWithAcctToken}` },
    });
    const resWithPerm = await GET(reqWithPerm, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resWithPerm.status === 200, `Staff with ACCOUNTING.VIEW returns 200 (actual: ${resWithPerm.status})`);

    // 2.7 SUPER_ADMIN → 200
    const reqAdmin = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resAdmin = await GET(reqAdmin, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resAdmin.status === 200, `SUPER_ADMIN returns 200 on trial-balance (actual: ${resAdmin.status})`);

    // 2.8 Spoofed headers without valid session → 401
    const reqSpoof = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance', {
      headers: { 'x-user-role': 'SUPER_ADMIN', 'x-user-id': 'admin_01' },
    });
    const resSpoof = await GET(reqSpoof, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resSpoof.status === 401, `Spoofed headers return 401 (actual: ${resSpoof.status})`);

    // 2.9 Unknown endpoint → 404
    const reqUnknown = new NextRequest('http://localhost:3000/api/v1/admin/accounting/nonexistent', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resUnknown = await GET(reqUnknown, { params: { path: ['admin', 'accounting', 'nonexistent'] } });
    assert(resUnknown.status === 404, `Unknown accounting endpoint returns 404 (actual: ${resUnknown.status})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: TRIAL BALANCE FUNCTIONAL
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[3/8] Trial Balance functional tests...');

    const tbJson = await resAdmin.json();
    assert(tbJson.success === true, 'TB response has success: true');
    assert(Array.isArray(tbJson.rows), 'TB has rows array');
    assert(tbJson.summary && typeof tbJson.summary.total_debit === 'number', 'TB has summary with total_debit');
    assert(tbJson.summary && typeof tbJson.summary.total_credit === 'number', 'TB has summary with total_credit');
    assert(typeof tbJson.summary.is_balanced === 'boolean', 'TB has is_balanced flag');
    assert(typeof tbJson.summary.imbalance === 'number', 'TB has imbalance amount');
    assert(tbJson.filters !== undefined, 'TB has filters object');

    // TB with date range
    const reqTbDate = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance?startDate=2024-01-01&endDate=2030-12-31', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resTbDate = await GET(reqTbDate, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resTbDate.status === 200, `TB with date range returns 200 (actual: ${resTbDate.status})`);

    // TB with invalid date → 400
    const reqTbBadDate = new NextRequest('http://localhost:3000/api/v1/admin/accounting/trial-balance?startDate=BADDATE', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resTbBadDate = await GET(reqTbBadDate, { params: { path: ['admin', 'accounting', 'trial-balance'] } });
    assert(resTbBadDate.status === 400, `TB with invalid date returns 400 (actual: ${resTbBadDate.status})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: ACCOUNT LEDGER FUNCTIONAL
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[4/8] Account Ledger functional tests...');

    // 4.1 Missing account_id → 400
    const reqNoAcct = new NextRequest('http://localhost:3000/api/v1/admin/accounting/ledger', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resNoAcct = await GET(reqNoAcct, { params: { path: ['admin', 'accounting', 'ledger'] } });
    assert(resNoAcct.status === 400, `Ledger without account_id returns 400 (actual: ${resNoAcct.status})`);

    // 4.2 Non-existent account → 404
    const reqBadAcct = new NextRequest('http://localhost:3000/api/v1/admin/accounting/ledger?account_id=nonexistent_xyz', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resBadAcct = await GET(reqBadAcct, { params: { path: ['admin', 'accounting', 'ledger'] } });
    assert(resBadAcct.status === 404, `Ledger with non-existent account returns 404 (actual: ${resBadAcct.status})`);

    // 4.3 Get a real account from DB
    const acctRes = await client.query("SELECT id, code, name, type FROM public.accounting_account WHERE is_group = false AND deleted_at IS NULL LIMIT 1");
    if (acctRes.rows.length > 0) {
      const acct = acctRes.rows[0];
      console.log(`  ℹ  Using account: ${acct.code} — ${acct.name} (${acct.type})`);

      // 4.4 Valid account → 200 with correct structure
      const reqValid = new NextRequest(`http://localhost:3000/api/v1/admin/accounting/ledger?account_id=${acct.id}`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const resValid = await GET(reqValid, { params: { path: ['admin', 'accounting', 'ledger'] } });
      assert(resValid.status === 200, `Ledger for valid account returns 200 (actual: ${resValid.status})`);

      const ledgerJson = await resValid.json();
      assert(ledgerJson.success === true, 'Ledger has success: true');
      assert(ledgerJson.account && ledgerJson.account.id === acct.id, 'Ledger account.id matches request');
      assert(ledgerJson.account && ledgerJson.account.code === acct.code, 'Ledger account.code matches');
      assert(typeof ledgerJson.opening_balance === 'number', 'Ledger has opening_balance (number)');
      assert(typeof ledgerJson.closing_balance === 'number', 'Ledger has closing_balance (number)');
      assert(typeof ledgerJson.total_debit === 'number', 'Ledger has total_debit (number)');
      assert(typeof ledgerJson.total_credit === 'number', 'Ledger has total_credit (number)');
      assert(Array.isArray(ledgerJson.lines), 'Ledger has lines array');
      assert(typeof ledgerJson.page === 'number', 'Ledger has page');
      assert(typeof ledgerJson.totalPages === 'number', 'Ledger has totalPages');
      assert(typeof ledgerJson.total === 'number', 'Ledger has total count');
      assert(typeof ledgerJson.limit === 'number', 'Ledger has limit');

      // 4.5 Normal balance convention
      const expectedNormal = (acct.type === 'ASSET' || acct.type === 'EXPENSE') ? 'DEBIT' : 'CREDIT';
      assert(ledgerJson.account.normal_balance === expectedNormal, `Normal balance correct: ${acct.type} → ${expectedNormal} (got: ${ledgerJson.account.normal_balance})`);

      // 4.6 Closing balance = opening + net (accounting identity)
      const isDebitNormal = ledgerJson.account.normal_balance === 'DEBIT';
      const expectedClosing = isDebitNormal
        ? ledgerJson.opening_balance + ledgerJson.total_debit - ledgerJson.total_credit
        : ledgerJson.opening_balance + ledgerJson.total_credit - ledgerJson.total_debit;
      const closingDiff = Math.abs(expectedClosing - ledgerJson.closing_balance);
      assert(closingDiff < 0.01, `Closing balance identity: opening(${ledgerJson.opening_balance}) + net = closing(${ledgerJson.closing_balance}), diff=${closingDiff.toFixed(4)}`);

      // 4.7 Ledger with date range
      const reqDateRange = new NextRequest(`http://localhost:3000/api/v1/admin/accounting/ledger?account_id=${acct.id}&startDate=2024-01-01&endDate=2030-12-31`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const resDateRange = await GET(reqDateRange, { params: { path: ['admin', 'accounting', 'ledger'] } });
      assert(resDateRange.status === 200, `Ledger with date range returns 200 (actual: ${resDateRange.status})`);

      // 4.8 Pagination
      const reqPage = new NextRequest(`http://localhost:3000/api/v1/admin/accounting/ledger?account_id=${acct.id}&limit=5&page=1`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const resPage = await GET(reqPage, { params: { path: ['admin', 'accounting', 'ledger'] } });
      const pageJson = await resPage.json();
      assert(resPage.status === 200, 'Paginated ledger returns 200');
      assert(pageJson.limit === 5, `Limit respected: expected 5, got ${pageJson.limit}`);

      // 4.9 Invalid startDate → 400
      const reqBadDate = new NextRequest(`http://localhost:3000/api/v1/admin/accounting/ledger?account_id=${acct.id}&startDate=INVALID`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const resBadDate = await GET(reqBadDate, { params: { path: ['admin', 'accounting', 'ledger'] } });
      assert(resBadDate.status === 400, `Ledger with invalid startDate returns 400 (actual: ${resBadDate.status})`);
    } else {
      assert(false, 'SKIP: No non-group accounts found in CoA');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: ACCOUNTS LIST
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[5/8] Accounts list endpoint tests...');

    const reqAccts = new NextRequest('http://localhost:3000/api/v1/admin/accounting/accounts', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resAccts = await GET(reqAccts, { params: { path: ['admin', 'accounting', 'accounts'] } });
    assert(resAccts.status === 200, `Accounts list returns 200 (actual: ${resAccts.status})`);
    const acctsJson = await resAccts.json();
    assert(Array.isArray(acctsJson.accounts), 'Accounts is array');
    assert(acctsJson.accounts.length > 0, `Accounts not empty: ${acctsJson.accounts.length}`);

    if (acctsJson.accounts.length > 0) {
      const a = acctsJson.accounts[0];
      assert(typeof a.id === 'string', 'Account has id');
      assert(typeof a.code === 'string', 'Account has code');
      assert(typeof a.name === 'string', 'Account has name');
      assert(typeof a.type === 'string', 'Account has type');
    }

    // Search
    const reqSearch = new NextRequest('http://localhost:3000/api/v1/admin/accounting/accounts?search=Cash', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resSearch = await GET(reqSearch, { params: { path: ['admin', 'accounting', 'accounts'] } });
    assert(resSearch.status === 200, 'Accounts search returns 200');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: ACCOUNTING INTEGRITY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[6/8] Accounting integrity verification...');

    // TB debit === credit check via independent DB query
    const tbIndependent = await client.query(`
      SELECT
        COALESCE(SUM(debit_amount), 0)::numeric AS total_debit,
        COALESCE(SUM(credit_amount), 0)::numeric AS total_credit
      FROM public.accounting_journal_line
    `);
    const dbDebit = parseFloat(tbIndependent.rows[0].total_debit) || 0;
    const dbCredit = parseFloat(tbIndependent.rows[0].total_credit) || 0;
    const dbDiff = Math.abs(dbDebit - dbCredit);
    assert(dbDiff < 0.01, `Independent DB query: total_debit(${dbDebit}) === total_credit(${dbCredit}), diff=${dbDiff}`);

    // Compare API TB summary with independent query
    if (tbJson.summary) {
      const apiDebit = tbJson.summary.total_debit;
      const apiCredit = tbJson.summary.total_credit;
      const apiDbDebitDiff = Math.abs(apiDebit - dbDebit);
      const apiDbCreditDiff = Math.abs(apiCredit - dbCredit);
      assert(apiDbDebitDiff < 0.01, `API TB debit matches DB: API=${apiDebit}, DB=${dbDebit}`);
      assert(apiDbCreditDiff < 0.01, `API TB credit matches DB: API=${apiCredit}, DB=${dbCredit}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7: POSTGRESQL POST-TEST AUDIT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[7/8] PostgreSQL post-test audit (zero mutations)...');

    const postCoA = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(postCoA.rows[0].count === 99, `Post-test CoA count unchanged === 99 (actual: ${postCoA.rows[0].count})`);

    const postVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(postVouchers.rows[0].count === 0, `Post-test voucher count unchanged === 0 (actual: ${postVouchers.rows[0].count})`);

    const postJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(postJournals.rows[0].count === 0, `Post-test journal_entry count unchanged === 0 (actual: ${postJournals.rows[0].count})`);

    const postJLines = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_line');
    assert(postJLines.rows[0].count === 0, `Post-test journal_line count unchanged === 0 (actual: ${postJLines.rows[0].count})`);

    const postOrders = await client.query('SELECT count(*)::int AS count FROM public.order WHERE deleted_at IS NULL');
    assert(postOrders.rows[0].count === preOrderCount, `Post-test order count unchanged === ${preOrderCount} (actual: ${postOrders.rows[0].count})`);

    const postPayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    assert(postPayments.rows[0].count === prePaymentCount, `Post-test payment count unchanged === ${prePaymentCount} (actual: ${postPayments.rows[0].count})`);

    const postFiscal = await client.query('SELECT count(*)::int AS count FROM public.accounting_fiscal_period');
    assert(postFiscal.rows[0].count === preFiscalCount, `Post-test fiscal period count unchanged === ${preFiscalCount} (actual: ${postFiscal.rows[0].count})`);

    // No lingering transactions or locks
    const locks = await client.query(`SELECT count(*)::int AS count FROM pg_locks WHERE pid = pg_backend_pid() AND granted = false`);
    assert(locks.rows[0].count === 0, `No lingering locks (actual: ${locks.rows[0].count})`);

    // No new tables created
    const newTables = await client.query(`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name LIKE '%general_ledger%' OR table_name LIKE '%trial_balance%'
    `);
    assert(newTables.rows[0].count === 0, `No new GL/TB tables created (actual: ${newTables.rows[0].count})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8: TAB_PERMISSION_MAP
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[8/8] TAB_PERMISSION_MAP & sidebar wiring...');

    const authorizedStaff = { role: 'STAFF', permissions: ['ACCOUNTING.VIEW'] };
    const unauthorizedStaff = { role: 'STAFF', permissions: ['ORDERS.VIEW'] };
    const superAdmin = { role: 'SUPER_ADMIN' };

    assert(StaffAccessControl.isTabPermitted(authorizedStaff, 'general_ledger') === true, 'Staff with ACCOUNTING.VIEW permitted for general_ledger tab');
    assert(StaffAccessControl.isTabPermitted(unauthorizedStaff, 'general_ledger') === false, 'Staff without ACCOUNTING.VIEW denied for general_ledger tab');
    assert(StaffAccessControl.isTabPermitted(superAdmin, 'general_ledger') === true, 'SUPER_ADMIN permitted for general_ledger tab');

    // Verify component file exists
    const panelPath = path.resolve(__dirname, '../src/components/dashboard/admin/general-ledger-panel.tsx');
    assert(fs.existsSync(panelPath), 'general-ledger-panel.tsx exists');

  } catch (err) {
    console.error('\n  ✗ FATAL ERROR:', err.message);
    console.error(err.stack);
    failCount++;
  } finally {
    await client.end();
    try { await closeDbPool(); } catch {}
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed, ${passCount + failCount} total`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  console.log('══════════════════════════════════════════════════════════════════\n');
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
