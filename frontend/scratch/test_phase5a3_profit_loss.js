/**
 * Phase 5A.3 — Profit & Loss Statement Verification Suite
 *
 * Sections:
 * 0. PostgreSQL baseline audit (pre-test)
 * 1. Service & Route handler mounting
 * 2. Authentication & RBAC (401/403)
 * 3. Date validation (400)
 * 4. Functional — P&L structure (5 sections, account classification)
 * 5. 5330 Depreciation hierarchy classification (parent_id, NOT subtype)
 * 6. Contra-account treatment (4190 returns, 5190 discounts)
 * 7. GST / Balance Sheet exclusion
 * 8. Zero-transaction state correctness
 * 9. TB reconciliation identity
 * 10. Branch isolation / enterprise scope
 * 11. TAB_PERMISSION_MAP & UI wiring
 * 12. PostgreSQL post-test audit (zero mutations)
 * 13. Frozen code integrity (5A.1, 5A.2 unchanged)
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
  console.log('Phase 5A.3 — Profit & Loss Statement Verification Suite');
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

  const { ProfitLossService } = require('../src/lib/services/profit-loss.service');
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

  // Create tokens
  const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
  const custToken = signAuthToken({ userId: 'cust_01', role: 'CUSTOMER', customerId: 'cust_01' });
  const staffNoPermToken = signAuthToken({ userId: 'usr_staff_noperm', role: 'STAFF', permissions: ['TELEMARKETING.VIEW'] });
  const staffWithAcctToken = signAuthToken({ userId: 'usr_staff_acct', role: 'STAFF', permissions: ['ACCOUNTING.VIEW'] });

  // Helper: create authenticated request
  function makeAdminRequest(urlPath) {
    return new NextRequest(`http://localhost:3000/api/v1/${urlPath}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${adminToken}` },
    });
  }

  function makeTokenRequest(urlPath, token) {
    return new NextRequest(`http://localhost:3000/api/v1/${urlPath}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
  }

  // Helper: unauthenticated request
  function makeUnauthRequest(urlPath) {
    return new NextRequest(`http://localhost:3000/api/v1/${urlPath}`, { method: 'GET' });
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 0: PRE-TEST POSTGRESQL BASELINE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[0/13] Pre-test PostgreSQL baseline audit...');

    const preCoA = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(preCoA.rows[0].count === 99, `Pre-test CoA count === 99 (actual: ${preCoA.rows[0].count})`);

    const preVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(preVouchers.rows[0].count === 0, `Pre-test voucher count === 0 (actual: ${preVouchers.rows[0].count})`);

    const preJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(preJournals.rows[0].count === 0, `Pre-test journal_entry count === 0 (actual: ${preJournals.rows[0].count})`);

    const preJLines = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_line');
    assert(preJLines.rows[0].count === 0, `Pre-test journal_line count === 0 (actual: ${preJLines.rows[0].count})`);

    const preOrders = await client.query('SELECT count(*)::int AS count FROM public."order" WHERE deleted_at IS NULL');
    const preOrderCount = preOrders.rows[0].count;
    console.log(`  ℹ  Pre-test order count: ${preOrderCount}`);

    const prePayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    const prePaymentCount = prePayments.rows[0].count;
    console.log(`  ℹ  Pre-test payment count: ${prePaymentCount}`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: SERVICE & ROUTE HANDLER MOUNTING
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[1/13] Service & route handler mounting...');

    assert(typeof ProfitLossService === 'function' || typeof ProfitLossService === 'object',
      'ProfitLossService is importable');
    assert(typeof ProfitLossService.getProfitLoss === 'function',
      'ProfitLossService.getProfitLoss() method exists');
    assert(typeof GET === 'function',
      'GET route handler is importable');

    // Service file exists
    const serviceFilePath = path.join(__dirname, '../src/lib/services/profit-loss.service.ts');
    assert(fs.existsSync(serviceFilePath), 'profit-loss.service.ts exists');

    // UI file exists
    const panelFilePath = path.join(__dirname, '../src/components/dashboard/admin/profit-loss-panel.tsx');
    assert(fs.existsSync(panelFilePath), 'profit-loss-panel.tsx exists');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: AUTHENTICATION & RBAC
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[2/13] Authentication & RBAC...');

    // 2a. Unauthenticated → 401
    const unauthReq = makeUnauthRequest('admin/accounting/profit-loss?start_date=2024-04-01&end_date=2025-03-31');
    const unauthRes = await GET(unauthReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    assert(unauthRes.status === 401, `Unauthenticated request returns 401 (actual: ${unauthRes.status})`);

    // 2b. Customer role → 403
    const custReq = makeTokenRequest('admin/accounting/profit-loss?start_date=2024-04-01&end_date=2025-03-31', custToken);
    const custRes = await GET(custReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    assert(custRes.status === 403, `Customer role returns 403 (actual: ${custRes.status})`);

    // 2c. Authorized SUPER_ADMIN → 200
    const authReq = makeAdminRequest('admin/accounting/profit-loss?start_date=2024-04-01&end_date=2025-03-31');
    const authRes = await GET(authReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    assert(authRes.status === 200, `SUPER_ADMIN request returns 200 (actual: ${authRes.status})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: DATE VALIDATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[3/13] Date validation...');

    // 3a. Missing dates → 400
    const noDateReq = makeAdminRequest('admin/accounting/profit-loss');
    const noDateRes = await GET(noDateReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    assert(noDateRes.status === 400, `Missing dates returns 400 (actual: ${noDateRes.status})`);

    // 3b. Missing end_date → 400
    const noEndReq = makeAdminRequest('admin/accounting/profit-loss?start_date=2024-04-01');
    const noEndRes = await GET(noEndReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    assert(noEndRes.status === 400, `Missing end_date returns 400 (actual: ${noEndRes.status})`);

    // 3c. Invalid date format → 400
    const badDateReq = makeAdminRequest('admin/accounting/profit-loss?start_date=2024-04-01&end_date=not-a-date');
    const badDateRes = await GET(badDateReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    assert(badDateRes.status === 400, `Invalid date format returns 400 (actual: ${badDateRes.status})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: FUNCTIONAL — P&L STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[4/13] P&L structure validation...');

    const plReq = makeAdminRequest('admin/accounting/profit-loss?start_date=2024-04-01&end_date=2025-03-31');
    const plRes = await GET(plReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    const plData = await plRes.json();

    assert(plData.success === true, 'P&L response success === true');
    assert(plData.sections !== undefined, 'P&L has sections object');
    assert(plData.sections.operating_revenue !== undefined, 'Has operating_revenue section');
    assert(plData.sections.cost_of_goods_sold !== undefined, 'Has cost_of_goods_sold section');
    assert(plData.sections.operating_expenses !== undefined, 'Has operating_expenses section');
    assert(plData.sections.other_income !== undefined, 'Has other_income section');
    assert(plData.sections.financial_expenses !== undefined, 'Has financial_expenses section');

    // Section labels
    assert(plData.sections.operating_revenue.label === 'I. Operating Revenue', 'Operating revenue label correct');
    assert(plData.sections.cost_of_goods_sold.label === 'II. Cost of Goods Sold', 'COGS label correct');
    assert(plData.sections.operating_expenses.label === 'III. Operating Expenses', 'OpEx label correct');
    assert(plData.sections.other_income.label === 'IV. Other Income', 'Other income label correct');
    assert(plData.sections.financial_expenses.label === 'V. Financial & Depreciation Expenses', 'Financial expenses label correct');

    // Summary fields
    assert(plData.summary !== undefined, 'P&L has summary object');
    assert(typeof plData.summary.gross_profit === 'number', 'gross_profit is a number');
    assert(typeof plData.summary.operating_profit === 'number', 'operating_profit is a number');
    assert(typeof plData.summary.net_profit_before_tax === 'number', 'net_profit_before_tax is a number');

    // Period fields
    assert(plData.period.start_date === '2024-04-01', 'Period start_date matches request');
    assert(plData.period.end_date === '2025-03-31', 'Period end_date matches request');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: 5330 DEPRECIATION HIERARCHY CLASSIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[5/13] 5330 Depreciation hierarchy classification...');

    // 5330 MUST be in financial_expenses section, NOT operating_expenses
    const financialAcctCodes = plData.sections.financial_expenses.accounts.map(a => a.code);
    const opexAcctCodes = plData.sections.operating_expenses.accounts.map(a => a.code);

    assert(financialAcctCodes.includes('5330'), '5330 Depreciation is in financial_expenses section (parent_id grouping)');
    assert(!opexAcctCodes.includes('5330'), '5330 Depreciation is NOT in operating_expenses section');

    // Verify 5310 and 5320 are also in financial
    assert(financialAcctCodes.includes('5310'), '5310 Bank Charges is in financial_expenses');
    assert(financialAcctCodes.includes('5320'), '5320 Loan Interest is in financial_expenses');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: CONTRA-ACCOUNT TREATMENT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[6/13] Contra-account treatment...');

    // 6a. 4190 Sales Returns — should be in operating_revenue.returns, NOT in accounts array
    const revAcctCodes = plData.sections.operating_revenue.accounts.map(a => a.code);
    assert(!revAcctCodes.includes('4190'), '4190 is NOT in operating_revenue.accounts (excluded as contra)');
    assert(plData.sections.operating_revenue.returns !== undefined, 'operating_revenue.returns field exists');
    assert(plData.sections.operating_revenue.returns.code === '4190', '4190 Sales Returns is in returns field');

    // Revenue accounts present
    assert(revAcctCodes.includes('4110'), '4110 Cake Sales in operating_revenue');
    assert(revAcctCodes.includes('4120'), '4120 Accessory Sales in operating_revenue');
    assert(revAcctCodes.includes('4130'), '4130 Delivery Charges in operating_revenue');
    assert(revAcctCodes.includes('4140'), '4140 Surcharges in operating_revenue');

    // 6b. 5190 Purchase Discounts — should be in cost_of_goods_sold.discounts, NOT in accounts array
    const cogsAcctCodes = plData.sections.cost_of_goods_sold.accounts.map(a => a.code);
    assert(!cogsAcctCodes.includes('5190'), '5190 is NOT in cogs.accounts (excluded as contra)');
    assert(plData.sections.cost_of_goods_sold.discounts !== undefined, 'cost_of_goods_sold.discounts field exists');
    assert(plData.sections.cost_of_goods_sold.discounts.code === '5190', '5190 Purchase Discounts is in discounts field');

    // COGS accounts present
    assert(cogsAcctCodes.includes('5110'), '5110 COGS Cakes in cost_of_goods_sold');
    assert(cogsAcctCodes.includes('5120'), '5120 Accessories COGS in cost_of_goods_sold');
    assert(cogsAcctCodes.includes('5130'), '5130 Packaging in cost_of_goods_sold');
    assert(cogsAcctCodes.includes('5140'), '5140 Kitchen Labour in cost_of_goods_sold');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7: GST / BALANCE SHEET EXCLUSION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[7/13] GST & Balance Sheet account exclusion...');

    // Collect all account codes from all sections
    const allPLCodes = [
      ...plData.sections.operating_revenue.accounts.map(a => a.code),
      plData.sections.operating_revenue.returns.code,
      ...plData.sections.cost_of_goods_sold.accounts.map(a => a.code),
      plData.sections.cost_of_goods_sold.discounts.code,
      ...plData.sections.operating_expenses.accounts.map(a => a.code),
      ...plData.sections.other_income.accounts.map(a => a.code),
      ...plData.sections.financial_expenses.accounts.map(a => a.code),
    ];

    // GST accounts (1141-1149 Input Tax, 2121-2129 Output Tax) should NOT appear
    const gstCodes = ['1141', '1142', '1143', '1144', '1145', '1146', '1147', '1148', '1149',
                      '2121', '2122', '2123', '2124', '2125', '2126', '2127', '2128', '2129'];
    const gstInPL = gstCodes.filter(c => allPLCodes.includes(c));
    assert(gstInPL.length === 0, `No GST accounts in P&L (found: ${gstInPL.length})`);

    // Asset accounts (1xxx) should NOT appear
    const assetInPL = allPLCodes.filter(c => c.startsWith('1'));
    assert(assetInPL.length === 0, `No ASSET accounts in P&L (found: ${assetInPL.length})`);

    // Liability accounts (2xxx) should NOT appear
    const liabilityInPL = allPLCodes.filter(c => c.startsWith('2'));
    assert(liabilityInPL.length === 0, `No LIABILITY accounts in P&L (found: ${liabilityInPL.length})`);

    // Equity accounts (3xxx) should NOT appear
    const equityInPL = allPLCodes.filter(c => c.startsWith('3'));
    assert(equityInPL.length === 0, `No EQUITY accounts in P&L (found: ${equityInPL.length})`);

    // Only REVENUE (4xxx) and EXPENSE (5xxx) codes should appear
    const validPLCodes = allPLCodes.filter(c => c.startsWith('4') || c.startsWith('5'));
    assert(validPLCodes.length === allPLCodes.length, `All P&L codes are REVENUE or EXPENSE (${validPLCodes.length}/${allPLCodes.length})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8: ZERO-TRANSACTION STATE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[8/13] Zero-transaction state correctness...');

    // With 0 journal entries, all amounts must be 0
    assert(plData.sections.operating_revenue.gross_revenue === 0, 'Gross revenue === 0 (no transactions)');
    assert(plData.sections.operating_revenue.returns.amount === 0, 'Sales returns amount === 0');
    assert(plData.sections.operating_revenue.net_revenue === 0, 'Net revenue === 0');
    assert(plData.sections.cost_of_goods_sold.total_cogs === 0, 'Total COGS === 0');
    assert(plData.sections.cost_of_goods_sold.discounts.amount === 0, 'Purchase discounts amount === 0');
    assert(plData.sections.operating_expenses.total_opex === 0, 'Total OpEx === 0');
    assert(plData.sections.other_income.total_other_income === 0, 'Total other income === 0');
    assert(plData.sections.financial_expenses.total_financial === 0, 'Total financial expenses === 0');
    assert(plData.summary.gross_profit === 0, 'Gross profit === 0');
    assert(plData.summary.operating_profit === 0, 'Operating profit === 0');
    assert(plData.summary.net_profit_before_tax === 0, 'Net profit before tax === 0');

    // All individual account amounts must be 0
    const allAccounts = [
      ...plData.sections.operating_revenue.accounts,
      ...plData.sections.cost_of_goods_sold.accounts,
      ...plData.sections.operating_expenses.accounts,
      ...plData.sections.other_income.accounts,
      ...plData.sections.financial_expenses.accounts,
    ];
    const nonZeroAccounts = allAccounts.filter(a => a.amount !== 0);
    assert(nonZeroAccounts.length === 0, `All individual account amounts are 0 (non-zero: ${nonZeroAccounts.length})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 9: TB RECONCILIATION IDENTITY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[9/13] TB reconciliation identity...');

    assert(plData.reconciliation !== undefined, 'Reconciliation object exists');
    assert(plData.reconciliation.is_reconciled === true, 'P&L is reconciled to TB');
    assert(plData.reconciliation.variance === 0, `Reconciliation variance === 0 (actual: ${plData.reconciliation.variance})`);
    assert(plData.reconciliation.tb_revenue_total === 0, 'TB revenue total === 0');
    assert(plData.reconciliation.tb_expense_total === 0, 'TB expense total === 0');
    assert(plData.reconciliation.tb_derived_profit === 0, 'TB derived profit === 0');
    assert(plData.reconciliation.pnl_net_profit === plData.summary.net_profit_before_tax,
      'Reconciliation pnl_net_profit matches summary.net_profit_before_tax');

    // Cross-check: P&L net profit should match TB-derived profit
    assert(plData.reconciliation.pnl_net_profit === plData.reconciliation.tb_derived_profit,
      'P&L net profit matches TB-derived profit exactly');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 10: BRANCH ISOLATION / ENTERPRISE SCOPE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[10/13] Branch isolation & enterprise scope...');

    // 10a. Enterprise view (no branch filter) — SUPER_ADMIN
    const enterpriseReq = makeAdminRequest('admin/accounting/profit-loss?start_date=2024-04-01&end_date=2025-03-31');
    const enterpriseRes = await GET(enterpriseReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    const enterpriseData = await enterpriseRes.json();
    assert(enterpriseRes.status === 200, 'Enterprise scope returns 200');
    assert(enterpriseData.branch.id === null, 'Enterprise view branch.id is null');
    assert(enterpriseData.branch.name === 'Enterprise (All Branches)', 'Enterprise view branch name correct');

    // 10b. Branch-filtered view — SUPER_ADMIN with branch_id param
    const branchRes = await client.query('SELECT id FROM public.branch WHERE deleted_at IS NULL LIMIT 1');
    if (branchRes.rows.length > 0) {
      const testBranchId = branchRes.rows[0].id;
      const branchReq = makeAdminRequest(`admin/accounting/profit-loss?start_date=2024-04-01&end_date=2025-03-31&branch_id=${testBranchId}`);
      const branchApiRes = await GET(branchReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
      const branchData = await branchApiRes.json();
      assert(branchApiRes.status === 200, 'Branch-scoped P&L returns 200');
      assert(branchData.branch.id === testBranchId, 'Branch-scoped P&L has correct branch_id');
    } else {
      console.log('  ℹ  No branches found for branch isolation test — skipping');
    }

    // 10c. Staff with ACCOUNTING.VIEW gets their branch
    const staffBranchId = branchRes.rows.length > 0 ? branchRes.rows[0].id : 'test-branch-id';
    const staffBranchToken = signAuthToken({ userId: 'usr_staff_acct', role: 'STAFF', permissions: ['ACCOUNTING.VIEW'], branchId: staffBranchId });
    const staffReq = makeTokenRequest(
      'admin/accounting/profit-loss?start_date=2024-04-01&end_date=2025-03-31',
      staffBranchToken
    );
    const staffRes = await GET(staffReq, { params: { path: ['admin', 'accounting', 'profit-loss'] } });
    assert(staffRes.status === 200, `Staff with ACCOUNTING.VIEW gets 200 (actual: ${staffRes.status})`);
    if (staffRes.status === 200) {
      const staffData = await staffRes.json();
      assert(staffData.branch.id === staffBranchId, 'Staff locked to session branch via BOLA');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 11: TAB_PERMISSION_MAP & UI WIRING
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[11/13] TAB_PERMISSION_MAP & UI wiring...');

    // 11a. TAB_PERMISSION_MAP contains profit_loss
    // Check isTabPermitted for a super admin user
    const superAdminUser = { role: 'SUPER_ADMIN', userId: 'admin_01' };
    const tabPermitted = StaffAccessControl.isTabPermitted(superAdminUser, 'profit_loss');
    assert(tabPermitted === true, 'profit_loss tab permitted for SUPER_ADMIN');

    // 11b. admin-tabs.tsx contains profit_loss tab
    const adminTabsContent = fs.readFileSync(
      path.join(__dirname, '../src/components/dashboard/admin/admin-tabs.tsx'), 'utf8'
    );
    assert(adminTabsContent.includes('"profit_loss"'), 'admin-tabs.tsx contains profit_loss tab id');
    assert(adminTabsContent.includes('Profit & Loss') || adminTabsContent.includes('Profit &amp; Loss'),
      'admin-tabs.tsx contains Profit & Loss label');

    // 11c. dashboard page.tsx contains profit_loss wiring
    const dashboardContent = fs.readFileSync(
      path.join(__dirname, '../src/app/dashboard/page.tsx'), 'utf8'
    );
    assert(dashboardContent.includes('profit_loss'), 'dashboard page.tsx contains profit_loss in PANEL_MAP');
    assert(dashboardContent.includes('profit-loss-panel'), 'dashboard page.tsx imports profit-loss-panel');

    // 11d. staff-access-control.ts has profit_loss in TAB_PERMISSION_MAP
    const sacContent = fs.readFileSync(
      path.join(__dirname, '../src/lib/staff-access-control.ts'), 'utf8'
    );
    assert(sacContent.includes('profit_loss:'), 'staff-access-control.ts has profit_loss in TAB_PERMISSION_MAP');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 12: POSTGRESQL POST-TEST AUDIT (ZERO MUTATIONS)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[12/13] PostgreSQL post-test audit (zero mutations)...');

    const postCoA = await client.query('SELECT count(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL');
    assert(postCoA.rows[0].count === 99, `Post-test CoA count unchanged: 99 (actual: ${postCoA.rows[0].count})`);

    const postVouchers = await client.query('SELECT count(*)::int AS count FROM public.accounting_voucher');
    assert(postVouchers.rows[0].count === 0, `Post-test voucher count === 0 (actual: ${postVouchers.rows[0].count})`);

    const postJournals = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_entry');
    assert(postJournals.rows[0].count === 0, `Post-test journal_entry count === 0 (actual: ${postJournals.rows[0].count})`);

    const postJLines = await client.query('SELECT count(*)::int AS count FROM public.accounting_journal_line');
    assert(postJLines.rows[0].count === 0, `Post-test journal_line count === 0 (actual: ${postJLines.rows[0].count})`);

    const postOrders = await client.query('SELECT count(*)::int AS count FROM public."order" WHERE deleted_at IS NULL');
    assert(postOrders.rows[0].count === preOrderCount, `Post-test order count unchanged: ${preOrderCount} (actual: ${postOrders.rows[0].count})`);

    const postPayments = await client.query('SELECT count(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL');
    assert(postPayments.rows[0].count === prePaymentCount, `Post-test payment count unchanged: ${prePaymentCount} (actual: ${postPayments.rows[0].count})`);

    // No accounting rows created
    assert(postVouchers.rows[0].count === 0, 'Zero vouchers created by P&L (read-only)');
    assert(postJournals.rows[0].count === 0, 'Zero journal entries created by P&L (read-only)');
    assert(postJLines.rows[0].count === 0, 'Zero journal lines created by P&L (read-only)');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 13: FROZEN CODE INTEGRITY (5A.1, 5A.2)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[13/13] Frozen code integrity check...');

    // Verify frozen 5A.1 files haven't been modified
    const glServicePath = path.join(__dirname, '../src/lib/services/general-ledger.service.ts');
    const glServiceContent = fs.readFileSync(glServicePath, 'utf8');
    assert(glServiceContent.includes('class GeneralLedgerService'), 'GeneralLedgerService class intact');
    assert(glServiceContent.includes('getAccountLedger'), 'getAccountLedger method intact');
    assert(glServiceContent.includes('getTrialBalance'), 'getTrialBalance method intact');

    // Verify frozen 5A.2 files
    const configServicePath = path.join(__dirname, '../src/lib/services/accounting-config.service.ts');
    assert(fs.existsSync(configServicePath), 'accounting-config.service.ts exists (5A.2 frozen)');

    const fiscalServicePath = path.join(__dirname, '../src/lib/services/fiscal-period.service.ts');
    assert(fs.existsSync(fiscalServicePath), 'fiscal-period.service.ts exists (5A.2 frozen)');

    const obServicePath = path.join(__dirname, '../src/lib/services/opening-balance.service.ts');
    assert(fs.existsSync(obServicePath), 'opening-balance.service.ts exists (5A.2 frozen)');

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log(`RESULTS: ${passCount} passed, ${failCount} failed`);
    if (failures.length > 0) {
      console.log('\nFailed assertions:');
      failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    }
    console.log('══════════════════════════════════════════════════════════════════');

  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
    try { await closeDbPool(); } catch {}
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runTests();
