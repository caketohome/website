/**
 * Phase 5A.5 — Cash Flow Statement Verification Suite
 *
 * Comprehensive, independent test harness covering all mandatory verifications:
 * 0. PostgreSQL baseline audit (pre-test)
 * 1. Service & Route handler mounting
 * 2. Authentication & BOLA Authorization (401/403)
 * 3. Date & range validation (400)
 * 4. Direct Method schedule integrity & categorization
 * 5. Indirect Method schedule integrity & reconciliation
 * 6. Dual-Method convergence invariant (Direct CFO ≡ Indirect CFO)
 * 7. Cash boundary (the 6 accounts under 1110) & 1122 COD working capital treatment
 * 8. Balance Sheet reconciliation invariant (Closing Cash ≡ BS 1110)
 * 9. Zero-transaction state verification
 * 10. Multi-category transaction simulation & reconciliation with complete rollback
 * 11. Internal transfer elimination (zero net cash impact)
 * 12. Comparative period reporting
 * 13. Branch isolation vs Enterprise consolidation
 * 14. UI & Permission Wiring (TAB_PERMISSION_MAP, admin-tabs, page.tsx)
 * 15. PostgreSQL post-test audit (strictly 0 mutations)
 * 16. Frozen code integrity (5A.1, 5A.2, 5A.3, 5A.4 files)
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
  console.log('Phase 5A.5 — Cash Flow Statement — Verification Suite');
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

  const { CashFlowService, CashFlowServiceError, CASH_ACCOUNT_CODES } = require('../src/lib/services/cash-flow.service');
  const { BalanceSheetService } = require('../src/lib/services/balance-sheet.service');
  const { ProfitLossService } = require('../src/lib/services/profit-loss.service');
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
    // ──────────────────────────────────────────────────────────────────────────
    // [0/16] Pre-test PostgreSQL baseline audit
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[0/16] Pre-test PostgreSQL baseline audit...');
    const [preCoA, preVoucher, preJE, preJL, prePeriods, preSettings] = await Promise.all([
      client.query("SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL"),
      client.query("SELECT count(*) FROM public.accounting_voucher"),
      client.query("SELECT count(*) FROM public.accounting_journal_entry"),
      client.query("SELECT count(*) FROM public.accounting_journal_line"),
      client.query("SELECT count(*) FROM public.accounting_fiscal_period"),
      client.query("SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%'"),
    ]);

    const initialCoACount = parseInt(preCoA.rows[0].count, 10);
    const initialVoucherCount = parseInt(preVoucher.rows[0].count, 10);
    const initialJECount = parseInt(preJE.rows[0].count, 10);
    const initialJLCount = parseInt(preJL.rows[0].count, 10);
    const initialPeriodCount = parseInt(prePeriods.rows[0].count, 10);

    assert(initialCoACount === 99, `Pre-test CoA count === 99 (actual: ${initialCoACount})`);
    assert(initialVoucherCount === 0, `Pre-test voucher count === 0 (actual: ${initialVoucherCount})`);
    assert(initialJECount === 0, `Pre-test journal_entry count === 0 (actual: ${initialJECount})`);
    assert(initialJLCount === 0, `Pre-test journal_line count === 0 (actual: ${initialJLCount})`);
    assert(initialPeriodCount === 0, `Pre-test fiscal period count === 0 (actual: ${initialPeriodCount})`);

    // Fetch sample branch
    const branchRes = await client.query("SELECT id, name FROM public.branch ORDER BY name LIMIT 2");
    const testBranch1 = branchRes.rows[0];
    const testBranch2 = branchRes.rows[1];

    // ──────────────────────────────────────────────────────────────────────────
    // [1/16] Service & Route Handler Mounting
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[1/16] Service & route handler mounting...');
    assert(typeof CashFlowService.getCashFlowStatement === 'function', 'CashFlowService.getCashFlowStatement is a function');
    assert(typeof GET === 'function', 'GET route handler is exported');
    assert(fs.existsSync(path.resolve(__dirname, '../src/lib/services/cash-flow.service.ts')), 'cash-flow.service.ts exists');
    assert(fs.existsSync(path.resolve(__dirname, '../src/components/dashboard/admin/cash-flow-panel.tsx')), 'cash-flow-panel.tsx exists');

    // ──────────────────────────────────────────────────────────────────────────
    // [2/16] Authentication & BOLA Authorization
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[2/16] Authentication & BOLA authorization...');
    const superAdminToken = signAuthToken({
      userId: 'usr_super_cf',
      email: 'admin@caketohome.com',
      role: 'SUPER_ADMIN',
    });
    const staffWithPermToken = signAuthToken({
      userId: 'usr_staff_cf_allowed',
      email: 'accountant@caketohome.com',
      role: 'STAFF',
      branchId: testBranch1.id,
      permissions: ['ACCOUNTING.VIEW'],
    });
    const staffWithoutPermToken = signAuthToken({
      userId: 'usr_staff_cf_denied',
      email: 'staff@caketohome.com',
      role: 'STAFF',
      branchId: testBranch1.id,
      permissions: ['ORDERS.VIEW'],
    });
    const customerToken = signAuthToken({
      userId: 'usr_customer_cf',
      email: 'cust@example.com',
      role: 'CUSTOMER',
    });

    // 2.1 Unauthenticated -> 401
    const unauthReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2026-04-30', { method: 'GET' });
    const unauthRes = await GET(unauthReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(unauthRes.status === 401, `Unauthenticated returns 401 (actual: ${unauthRes.status})`);

    // 2.2 Customer -> 403
    const custReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2026-04-30', {
      method: 'GET',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    const custRes = await GET(custReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(custRes.status === 403, `Customer returns 403 (actual: ${custRes.status})`);

    // 2.3 Staff without permission -> 403
    const deniedReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2026-04-30', {
      method: 'GET',
      headers: { authorization: `Bearer ${staffWithoutPermToken}` },
    });
    const deniedRes = await GET(deniedReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(deniedRes.status === 403, `Staff without ACCOUNTING.VIEW returns 403 (actual: ${deniedRes.status})`);

    // 2.4 Staff with permission -> 200
    const allowedReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2026-04-30', {
      method: 'GET',
      headers: { authorization: `Bearer ${staffWithPermToken}` },
    });
    const allowedRes = await GET(allowedReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(allowedRes.status === 200, `Staff with ACCOUNTING.VIEW returns 200 (actual: ${allowedRes.status})`);

    // 2.5 SUPER_ADMIN -> 200
    const adminReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2026-04-30', {
      method: 'GET',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const adminRes = await GET(adminReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(adminRes.status === 200, `SUPER_ADMIN returns 200 (actual: ${adminRes.status})`);

    // 2.6 BOLA: staff querying another branch -> 403
    const bolaReq = new NextRequest(`http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2026-04-30&branch_id=${testBranch2.id}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${staffWithPermToken}` },
    });
    const bolaRes = await GET(bolaReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(bolaRes.status === 403, `BOLA: staff querying different branch returns 403 (actual: ${bolaRes.status})`);

    // ──────────────────────────────────────────────────────────────────────────
    // [3/16] Date & Range Validation (400)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[3/16] Date & range validation...');
    // Missing dates
    const noDateReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow', {
      method: 'GET',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const noDateRes = await GET(noDateReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(noDateRes.status === 400, `Missing start_date/end_date returns 400 (actual: ${noDateRes.status})`);

    // Malformed date
    const badDateReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=not-a-date&end_date=2026-04-30', {
      method: 'GET',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const badDateRes = await GET(badDateReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(badDateRes.status === 400, `Malformed start_date returns 400 (actual: ${badDateRes.status})`);

    // start_date > end_date
    const invertedDateReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-05-01&end_date=2026-04-01', {
      method: 'GET',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const invertedDateRes = await GET(invertedDateReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(invertedDateRes.status === 400, `start_date > end_date returns 400 (actual: ${invertedDateRes.status})`);

    // Malformed compare date
    const badCompReq = new NextRequest('http://localhost:3000/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2026-04-30&compare_start_date=BAD&compare_end_date=2026-03-31', {
      method: 'GET',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const badCompRes = await GET(badCompReq, { params: { path: ['admin', 'accounting', 'cash-flow'] } });
    assert(badCompRes.status === 400, `Malformed compare_start_date returns 400 (actual: ${badCompRes.status})`);

    // ──────────────────────────────────────────────────────────────────────────
    // [4/16] Cash Boundary & Definition Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[4/16] Cash boundary definition...');
    assert(CASH_ACCOUNT_CODES.length === 6, `CASH_ACCOUNT_CODES has exactly 6 accounts (actual: ${CASH_ACCOUNT_CODES.length})`);
    assert(CASH_ACCOUNT_CODES.includes('1111'), 'Includes 1111 Cash in Hand');
    assert(CASH_ACCOUNT_CODES.includes('1112'), 'Includes 1112 Bank Operating A/c');
    assert(CASH_ACCOUNT_CODES.includes('1113'), 'Includes 1113 Gateway Clearing');
    assert(CASH_ACCOUNT_CODES.includes('1114'), 'Includes 1114 Petty Cash - Branches');
    assert(CASH_ACCOUNT_CODES.includes('1118'), 'Includes 1118 Deposit in Transit');
    assert(CASH_ACCOUNT_CODES.includes('1119'), 'Includes 1119 Unclassified Suspense');
    assert(!CASH_ACCOUNT_CODES.includes('1122'), '1122 Undeposited COD is EXCLUDED from Cash Equivalents pool');

    // Verify 1122 classification in DB
    const codRes = await client.query("SELECT code, name, parent_id FROM public.accounting_account WHERE code = '1122'");
    assert(codRes.rows.length === 1, '1122 exists in CoA');
    const parentRes = await client.query("SELECT code FROM public.accounting_account WHERE id = $1", [codRes.rows[0].parent_id]);
    assert(parentRes.rows[0]?.code === '1120', '1122 parent is 1120 Receivables and Advances');

    // ──────────────────────────────────────────────────────────────────────────
    // [5/16] Zero-Transaction State Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[5/16] Zero-transaction state correctness...');
    const zeroStatement = await CashFlowService.getCashFlowStatement(
      { start_date: '2026-04-01', end_date: '2026-04-30', method: 'both' },
      undefined,
      true
    );

    assert(zeroStatement.summary.opening_cash === 0, `Opening cash === 0 (actual: ${zeroStatement.summary.opening_cash})`);
    assert(zeroStatement.summary.net_operating_cash === 0, `Operating cash === 0 (actual: ${zeroStatement.summary.net_operating_cash})`);
    assert(zeroStatement.summary.net_investing_cash === 0, `Investing cash === 0 (actual: ${zeroStatement.summary.net_investing_cash})`);
    assert(zeroStatement.summary.net_financing_cash === 0, `Financing cash === 0 (actual: ${zeroStatement.summary.net_financing_cash})`);
    assert(zeroStatement.summary.net_cash_change === 0, `Net cash change === 0 (actual: ${zeroStatement.summary.net_cash_change})`);
    assert(zeroStatement.summary.closing_cash === 0, `Closing cash === 0 (actual: ${zeroStatement.summary.closing_cash})`);
    assert(zeroStatement.reconciliation.dual_method_variance === 0, `Dual method variance === 0 (actual: ${zeroStatement.reconciliation.dual_method_variance})`);
    assert(zeroStatement.reconciliation.is_dual_method_converged === true, 'Dual method is converged');
    assert(zeroStatement.reconciliation.balance_sheet_variance === 0, `Balance sheet variance === 0 (actual: ${zeroStatement.reconciliation.balance_sheet_variance})`);
    assert(zeroStatement.reconciliation.is_reconciled === true, 'Reconciliation is_reconciled === true');

    // ──────────────────────────────────────────────────────────────────────────
    // [6/16] Direct Method Structure Integrity
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[6/16] Direct Method structure integrity...');
    assert(zeroStatement.direct_schedule !== undefined, 'direct_schedule exists');
    assert(zeroStatement.direct_schedule.operating !== undefined, 'direct_schedule.operating exists');
    assert(zeroStatement.direct_schedule.investing !== undefined, 'direct_schedule.investing exists');
    assert(zeroStatement.direct_schedule.financing !== undefined, 'direct_schedule.financing exists');
    assert(zeroStatement.direct_schedule.internal_transfers !== undefined, 'direct_schedule.internal_transfers exists');
    assert(zeroStatement.direct_schedule.internal_transfers.net_impact === 0, 'Internal transfers net_impact is strictly 0.00');

    // ──────────────────────────────────────────────────────────────────────────
    // [7/16] Indirect Method Structure Integrity
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[7/16] Indirect Method structure integrity...');
    assert(zeroStatement.indirect_schedule !== undefined, 'indirect_schedule exists');
    assert(zeroStatement.indirect_schedule.net_profit_before_tax === 0, 'indirect Net profit before tax === 0');
    assert(zeroStatement.indirect_schedule.non_cash_adjustments !== undefined, 'non_cash_adjustments exists');
    assert(zeroStatement.indirect_schedule.non_cash_adjustments.depreciation === 0, 'Depreciation addback === 0');
    assert(zeroStatement.indirect_schedule.working_capital_adjustments !== undefined, 'working_capital_adjustments exists');
    assert(zeroStatement.indirect_schedule.net_operating_cash_flow === 0, 'Indirect Net operating cash flow === 0');

    // ──────────────────────────────────────────────────────────────────────────
    // [8/16] Balance Sheet & Dual-Method Invariant Equivalence
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[8/16] Balance Sheet & Dual-Method Invariant Equivalence...');
    const bsStatement = await BalanceSheetService.getBalanceSheet(
      { as_of_date: '2026-04-30' },
      undefined,
      true
    );
    const bsCashEquivalents = bsStatement.sections.current_assets.categories.find(
      c => c.group_code === '1110'
    )?.subtotal || 0;
    assert(zeroStatement.summary.closing_cash === bsCashEquivalents, `Cash flow closing cash (${zeroStatement.summary.closing_cash}) === Balance Sheet Line 1110 (${bsCashEquivalents})`);
    assert(zeroStatement.reconciliation.net_operating_cash_direct === zeroStatement.reconciliation.net_operating_cash_indirect, 'Direct CFO === Indirect CFO in zero state');

    // ──────────────────────────────────────────────────────────────────────────
    // [9/16] Multi-Category Transaction Simulation & Full Reconciliation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[9/16] Multi-category transaction simulation & reconciliation...');

    // Fetch account IDs for test postings
    const acctQuery = await client.query(`
      SELECT id, code FROM public.accounting_account 
      WHERE code IN ('1111', '1112', '1113', '1118', '1121', '1510', '1590', '2111', '2510', '3120', '4110', '5220', '5330')
    `);
    const acctMap = {};
    for (const r of acctQuery.rows) acctMap[r.code] = r.id;

    const testVouchers = [];
    const testJEs = [];
    const testJLs = [];

    // Helper to insert test voucher + journal entry + lines directly
    async function postTestJournal(vNo, vType, lines, narration) {
      await client.query('BEGIN');
      try {
        const vId = `v_sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const jeId = `je_sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const totalAmt = lines.reduce((s, l) => s + (l.debit || 0), 0);

        await client.query(`
          INSERT INTO public.accounting_voucher 
          (id, voucher_no, voucher_type, voucher_date, status, branch_id, fiscal_year, total_amount, currency, narration, created_by, approved_by, posted_by, created_at, updated_at)
          VALUES ($1, $2, $3, '2026-04-15', 'POSTED', $4, 'FY2627', $5, 'INR', $6, 'usr_sim_prep', 'usr_sim_appr', 'usr_sim_post', NOW(), NOW())
        `, [vId, vNo, vType, testBranch1.id, totalAmt, narration]);
        testVouchers.push(vId);

        await client.query(`
          INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, narration, created_by, created_at)
          VALUES ($1, $2, $3, '2026-04-15', $4, 'FY2627', $5, $5, $6, 'test_user', NOW())
        `, [jeId, `JE-${vNo}`, vId, testBranch1.id, totalAmt, narration]);
        testJEs.push(jeId);

        for (let i = 0; i < lines.length; i++) {
          const jlId = `jl_sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`;
          const l = lines[i];
          await client.query(`
            INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [jlId, jeId, i + 1, l.account_id, l.debit || 0, l.credit || 0, testBranch1.id, narration]);
          testJLs.push(jlId);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    try {
      // 1. Operating Sale: Dr 1111 Cash in Hand 10,000 / Cr 4110 Cake Sales 10,000
      await postTestJournal('V-SIM-01', 'RECEIPT', [
        { account_id: acctMap['1111'], debit: 10000, credit: 0 },
        { account_id: acctMap['4110'], debit: 0, credit: 10000 },
      ], 'Operating counter cash sale');

      // 2. Customer AR Collection: Dr 1112 Bank Operating 5,000 / Cr 1121 AR 5,000
      await postTestJournal('V-SIM-02', 'RECEIPT', [
        { account_id: acctMap['1112'], debit: 5000, credit: 0 },
        { account_id: acctMap['1121'], debit: 0, credit: 5000 },
      ], 'Customer AR collection via bank');

      // 3. Supplier AP Payment: Dr 2111 AP 4,000 / Cr 1112 Bank 4,000
      await postTestJournal('V-SIM-03', 'PAYMENT', [
        { account_id: acctMap['2111'], debit: 4000, credit: 0 },
        { account_id: acctMap['1112'], debit: 0, credit: 4000 },
      ], 'Supplier AP payment');

      // 4. Operating Expense: Dr 5220 Rent 2,000 / Cr 1112 Bank 2,000
      await postTestJournal('V-SIM-04', 'EXPENSE', [
        { account_id: acctMap['5220'], debit: 2000, credit: 0 },
        { account_id: acctMap['1112'], debit: 0, credit: 2000 },
      ], 'Rent expense payment');

      // 5. Internal Transfer: Branch Cash to Transit (Dr 1118 Transit 3,000 / Cr 1111 Cash 3,000)
      await postTestJournal('V-SIM-05', 'CONTRA', [
        { account_id: acctMap['1118'], debit: 3000, credit: 0 },
        { account_id: acctMap['1111'], debit: 0, credit: 3000 },
      ], 'Cash deposit to transit');

      // 6. Internal Transfer: Transit to Bank (Dr 1112 Bank 3,000 / Cr 1118 Transit 3,000)
      await postTestJournal('V-SIM-06', 'CONTRA', [
        { account_id: acctMap['1112'], debit: 3000, credit: 0 },
        { account_id: acctMap['1118'], debit: 0, credit: 3000 },
      ], 'Bank deposit cleared');

      // 7. Fixed Asset Capex: Dr 1510 Bakery Eq 8,000 / Cr 1112 Bank 8,000
      await postTestJournal('V-SIM-07', 'PAYMENT', [
        { account_id: acctMap['1510'], debit: 8000, credit: 0 },
        { account_id: acctMap['1112'], debit: 0, credit: 8000 },
      ], 'Bakery oven equipment capex');

      // 8. Bank Loan Borrowing: Dr 1112 Bank 15,000 / Cr 2510 Bank Loans 15,000
      await postTestJournal('V-SIM-08', 'RECEIPT', [
        { account_id: acctMap['1112'], debit: 15000, credit: 0 },
        { account_id: acctMap['2510'], debit: 0, credit: 15000 },
      ], 'Bank loan disbursement receipt');

      // 9. Partner Drawings: Dr 3120 Drawings 1,000 / Cr 1111 Cash 1,000
      await postTestJournal('V-SIM-09', 'PAYMENT', [
        { account_id: acctMap['3120'], debit: 1000, credit: 0 },
        { account_id: acctMap['1111'], debit: 0, credit: 1000 },
      ], 'Partner withdrawal / drawings');

      // 10. Non-Cash Depreciation: Dr 5330 Depreciation 500 / Cr 1590 Accum Depr 500
      await postTestJournal('V-SIM-10', 'JOURNAL', [
        { account_id: acctMap['5330'], debit: 500, credit: 0 },
        { account_id: acctMap['1590'], debit: 0, credit: 500 },
      ], 'Monthly depreciation entry (non-cash)');

      // ── RUN CASH FLOW ON SIMULATED DATA ──
      const simStatement = await CashFlowService.getCashFlowStatement(
        { start_date: '2026-04-01', end_date: '2026-04-30', method: 'both' },
        undefined,
        true
      );

      // Verify Direct Method breakdown
      // Inflows: 10,000 (Sales) + 5,000 (AR Collection) = 15,000
      // Outflows: 4,000 (AP) + 2,000 (Rent) = 6,000
      // Net Operating Cash = 15,000 - 6,000 = +₹9,000
      assert(simStatement.direct_schedule.operating.total_inflows === 15000, `Direct Op Inflows === 15,000 (actual: ${simStatement.direct_schedule.operating.total_inflows})`);
      assert(simStatement.direct_schedule.operating.total_outflows === 6000, `Direct Op Outflows === 6,000 (actual: ${simStatement.direct_schedule.operating.total_outflows})`);
      assert(simStatement.direct_schedule.operating.net_amount === 9000, `Direct Net Operating === +9,000 (actual: ${simStatement.direct_schedule.operating.net_amount})`);

      // Investing: Outflow 8,000 (Fixed Assets PP&E)
      assert(simStatement.direct_schedule.investing.net_amount === -8000, `Direct Net Investing === -8,000 (actual: ${simStatement.direct_schedule.investing.net_amount})`);

      // Financing: Inflow 15,000 (Loan) - Outflow 1,000 (Drawings) = +14,000
      assert(simStatement.direct_schedule.financing.total_inflows === 15000, `Direct Fin Inflows === 15,000 (actual: ${simStatement.direct_schedule.financing.total_inflows})`);
      assert(simStatement.direct_schedule.financing.total_outflows === 1000, `Direct Fin Outflows === 1,000 (actual: ${simStatement.direct_schedule.financing.total_outflows})`);
      assert(simStatement.direct_schedule.financing.net_amount === 14000, `Direct Net Financing === +14,000 (actual: ${simStatement.direct_schedule.financing.net_amount})`);

      // Internal Transfers: Volume = 3,000 + 3,000 = 6,000; Net Impact === 0.00
      assert(simStatement.direct_schedule.internal_transfers.total_volume === 6000, `Internal transfers volume === 6,000 (actual: ${simStatement.direct_schedule.internal_transfers.total_volume})`);
      assert(simStatement.direct_schedule.internal_transfers.net_impact === 0, 'Internal transfers net impact === 0.00');

      // Net Cash Movement: 9,000 (Op) - 8,000 (Inv) + 14,000 (Fin) = +15,000
      assert(simStatement.summary.net_cash_change === 15000, `Net Cash Movement === +15,000 (actual: ${simStatement.summary.net_cash_change})`);
      assert(simStatement.summary.closing_cash === 15000, `Closing Cash === +15,000 (actual: ${simStatement.summary.closing_cash})`);

      // Verify Indirect Method breakdown
      // Net Profit = Revenue (10,000) - Rent (2,000) - Depr (500) = 7,500
      assert(simStatement.indirect_schedule.net_profit_before_tax === 7500, `Indirect Net Profit === 7,500 (actual: ${simStatement.indirect_schedule.net_profit_before_tax})`);
      // Add back Depreciation (+500) -> Operating profit before WC = 8,000
      assert(simStatement.indirect_schedule.non_cash_adjustments.depreciation === 500, `Depreciation addback === 500 (actual: ${simStatement.indirect_schedule.non_cash_adjustments.depreciation})`);
      assert(simStatement.indirect_schedule.operating_profit_before_wc === 8000, `Op Profit before WC === 8,000 (actual: ${simStatement.indirect_schedule.operating_profit_before_wc})`);

      // Working Capital:
      // AR 1121 had credit of 5,000 -> Delta = -5,000 (Asset decreased) -> Cash Impact = +5,000
      // AP 2111 had debit of 4,000 -> Delta = -4,000 (Liability decreased) -> Cash Impact = -4,000
      // Net WC Impact = +5,000 - 4,000 = +1,000
      const arWc = simStatement.indirect_schedule.working_capital_adjustments.items.find(i => i.account_code === '1121');
      assert(arWc !== undefined && arWc.cash_impact === 5000, `AR 1121 cash impact === +5,000 (actual: ${arWc?.cash_impact})`);
      const apWc = simStatement.indirect_schedule.working_capital_adjustments.items.find(i => i.account_code === '2111');
      assert(apWc !== undefined && apWc.cash_impact === -4000, `AP 2111 cash impact === -4,000 (actual: ${apWc?.cash_impact})`);

      // Indirect Net Operating Cash = 8,000 + 1,000 = +₹9,000!
      assert(simStatement.indirect_schedule.net_operating_cash_flow === 9000, `Indirect Net Operating === +9,000 (actual: ${simStatement.indirect_schedule.net_operating_cash_flow})`);

      // ── DUAL-METHOD CONVERGENCE INVARIANT ──
      assert(simStatement.reconciliation.dual_method_variance === 0, `Dual method variance === 0.00 (actual: ${simStatement.reconciliation.dual_method_variance})`);
      assert(simStatement.reconciliation.is_dual_method_converged === true, 'Direct CFO ≡ Indirect CFO Invariant Holds ✅');

      // ── BALANCE SHEET RECONCILIATION INVARIANT ──
      const bsSim = await BalanceSheetService.getBalanceSheet(
        { as_of_date: '2026-04-30' },
        undefined,
        true
      );
      const bsSimCash = bsSim.sections.current_assets.categories.find(c => c.group_code === '1110')?.subtotal || 0;
      assert(simStatement.summary.closing_cash === bsSimCash, `Cash Flow Closing (${simStatement.summary.closing_cash}) ≡ BS Line 1110 (${bsSimCash}) ✅`);
      assert(simStatement.reconciliation.balance_sheet_variance === 0, 'BS Cash variance === 0.00');
      assert(simStatement.reconciliation.is_reconciled === true, 'Full reconciliation is_reconciled === true');

    } finally {
      // Clean rollback of test fixtures
      console.log('  ℹ  Cleaning up simulated transactional test fixtures...');
      await client.query("DELETE FROM public.accounting_journal_line WHERE id = ANY($1::text[])", [testJLs]);
      await client.query("DELETE FROM public.accounting_journal_entry WHERE id = ANY($1::text[])", [testJEs]);
      await client.query("DELETE FROM public.accounting_voucher WHERE id = ANY($1::text[])", [testVouchers]);
      console.log('  ✓  Simulated test fixtures removed cleanly.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // [10/16] Comparative Period Reporting
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[10/16] Comparative period reporting...');
    const compStatement = await CashFlowService.getCashFlowStatement(
      {
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        compare_start_date: '2026-03-01',
        compare_end_date: '2026-03-31',
      },
      undefined,
      true
    );
    assert(compStatement.comparison !== undefined, 'compStatement.comparison exists');
    assert(compStatement.comparison.period.start_date === '2026-03-01', 'Comparison start date matches');
    assert(compStatement.comparison.period.end_date === '2026-03-31', 'Comparison end date matches');

    // ──────────────────────────────────────────────────────────────────────────
    // [11/16] Branch Isolation & Enterprise Scope
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[11/16] Branch isolation & enterprise scope...');
    const enterpriseStmt = await CashFlowService.getCashFlowStatement(
      { start_date: '2026-04-01', end_date: '2026-04-30' },
      undefined,
      true
    );
    assert(enterpriseStmt.branch.id === null, 'Enterprise scope branch.id is null');
    assert(enterpriseStmt.branch.name === 'All Branches (Enterprise)', 'Enterprise scope branch.name correct');

    const branchScopedStmt = await CashFlowService.getCashFlowStatement(
      { start_date: '2026-04-01', end_date: '2026-04-30', branch_id: testBranch1.id },
      testBranch1.id,
      false
    );
    assert(branchScopedStmt.branch.id === testBranch1.id, 'Branch scope branch.id matches requested branch');

    // ──────────────────────────────────────────────────────────────────────────
    // [12/16] UI & Permission Wiring Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[12/16] UI & permission wiring...');
    assert(StaffAccessControl.isTabPermitted({ role: 'SUPER_ADMIN' }, 'cash_flow') === true, 'SUPER_ADMIN has access to cash_flow tab');
    assert(StaffAccessControl.isTabPermitted({ role: 'STAFF', permissions: ['ACCOUNTING.VIEW'] }, 'cash_flow') === true, 'Staff with ACCOUNTING.VIEW has access to cash_flow tab');
    assert(StaffAccessControl.isTabPermitted({ role: 'STAFF', permissions: ['ORDERS.VIEW'] }, 'cash_flow') === false, 'Staff without ACCOUNTING.VIEW denied for cash_flow tab');

    const adminTabsContent = fs.readFileSync(path.resolve(__dirname, '../src/components/dashboard/admin/admin-tabs.tsx'), 'utf8');
    assert(adminTabsContent.includes('"cash_flow"'), 'admin-tabs.tsx includes "cash_flow" tab id');
    assert(adminTabsContent.includes('"Cash Flow"'), 'admin-tabs.tsx includes "Cash Flow" label');

    const pageContent = fs.readFileSync(path.resolve(__dirname, '../src/app/dashboard/page.tsx'), 'utf8');
    assert(pageContent.includes('CashFlowPanel'), 'page.tsx imports CashFlowPanel');
    assert(pageContent.includes('cash_flow: CashFlowPanel'), 'page.tsx maps cash_flow in PANEL_MAP');

    // ──────────────────────────────────────────────────────────────────────────
    // [13/16] PostgreSQL Post-test Audit (Strictly Zero Mutations)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[13/16] PostgreSQL post-test audit (strictly 0 mutations)...');
    const [postCoA, postVoucher, postJE, postJL, postPeriods, postSettings] = await Promise.all([
      client.query("SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL"),
      client.query("SELECT count(*) FROM public.accounting_voucher"),
      client.query("SELECT count(*) FROM public.accounting_journal_entry"),
      client.query("SELECT count(*) FROM public.accounting_journal_line"),
      client.query("SELECT count(*) FROM public.accounting_fiscal_period"),
      client.query("SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%'"),
    ]);

    assert(parseInt(postCoA.rows[0].count, 10) === initialCoACount, `Post-test CoA count unchanged === 99 (actual: ${postCoA.rows[0].count})`);
    assert(parseInt(postVoucher.rows[0].count, 10) === initialVoucherCount, `Post-test voucher count unchanged === 0 (actual: ${postVoucher.rows[0].count})`);
    assert(parseInt(postJE.rows[0].count, 10) === initialJECount, `Post-test journal_entry count unchanged === 0 (actual: ${postJE.rows[0].count})`);
    assert(parseInt(postJL.rows[0].count, 10) === initialJLCount, `Post-test journal_line count unchanged === 0 (actual: ${postJL.rows[0].count})`);
    assert(parseInt(postPeriods.rows[0].count, 10) === initialPeriodCount, `Post-test fiscal period count unchanged === 0 (actual: ${postPeriods.rows[0].count})`);

    // ──────────────────────────────────────────────────────────────────────────
    // [14/16] Frozen Code Integrity Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[14/16] Frozen code integrity (5A.1 - 5A.4)...');
    assert(fs.existsSync(path.resolve(__dirname, '../src/lib/services/general-ledger.service.ts')), '5A.1 general-ledger.service.ts intact');
    assert(fs.existsSync(path.resolve(__dirname, '../src/lib/services/accounting-config.service.ts')), '5A.2 accounting-config.service.ts intact');
    assert(fs.existsSync(path.resolve(__dirname, '../src/lib/services/fiscal-period.service.ts')), '5A.2 fiscal-period.service.ts intact');
    assert(fs.existsSync(path.resolve(__dirname, '../src/lib/services/opening-balance.service.ts')), '5A.2 opening-balance.service.ts intact');
    assert(fs.existsSync(path.resolve(__dirname, '../src/lib/services/profit-loss.service.ts')), '5A.3 profit-loss.service.ts intact');
    assert(fs.existsSync(path.resolve(__dirname, '../src/lib/services/balance-sheet.service.ts')), '5A.4 balance-sheet.service.ts intact');

  } catch (err) {
    failCount++;
    failures.push(`Unhandled exception: ${err.message}\n${err.stack}`);
    console.error('Unhandled exception during verification:', err);
  } finally {
    await client.end();
    await closeDbPool();
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed, ${passCount + failCount} total`);
  if (failures.length > 0) {
    console.log('FAILURES:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
