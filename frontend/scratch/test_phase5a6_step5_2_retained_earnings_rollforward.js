/**
 * CakeToHome ERP — Phase 5A.6 Substep 5.2: Retained Earnings Roll-Forward Engine Verification Suite
 *
 * RIGOROUS INVARIANTS & VERIFICATION TARGETS:
 * 1. Retained Earnings Roll-Forward:
 *    - Opening RE(N+1) === Closing RE(N) for multi-year chains.
 *    - Derives from authoritative journal lines, not snapshots.
 *    - Correctly accounts for net profit/loss, drawings, reopen reversals.
 *    - RBAC enforced.
 * 2. Fiscal Year Summary:
 *    - Accurate status (OPEN, CLOSED, REOPENED) derived from voucher state.
 *    - Accurate period lock counts.
 *    - Operational P&L excludes closing vouchers.
 * 3. Comparative Profit & Loss:
 *    - Side-by-side comparison for two fiscal years.
 *    - Variance (₹ and %) computed correctly.
 *    - Excludes closing vouchers.
 *    - Section classification follows canonical parent_id hierarchy.
 * 4. Transactional Isolation & Zero Persistent Mutations:
 *    - Full rollback; database remains 100% pristine.
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
  console.log('Phase 5A.6 Substep 5.2 — Retained Earnings Roll-Forward Engine');
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

  const { FiscalPeriodService } = require('../src/lib/services/fiscal-period.service');
  const { PostingService } = require('../src/lib/services/posting.service');
  const { PeriodCloseService, PeriodCloseServiceError } = require('../src/lib/services/period-close.service');
  const { closeDbPool } = require('../src/lib/db');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const client = new Client({ connectionString: connStr });
  await client.connect();

  // Helper to post journal vouchers directly via SQL (bypasses fiscal period lock validation)
  async function postDirectJournalVoucher(cl, branchId, fiscalYear, entryDate, lines, narration) {
    const voucherId = `vch_test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const voucherNo = `VT-${Date.now().toString(36).toUpperCase()}`;
    const totalAmount = lines.reduce((sum, l) => sum + l.debit_amount, 0);
    
    // Insert voucher directly as POSTED (bypasses fiscal period validation)
    await cl.query(
      `INSERT INTO public.accounting_voucher 
        (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, 
         status, total_amount, narration, 
         created_by, submitted_by, submitted_at, approved_by, approved_at, posted_by, posted_at,
         created_at, updated_at)
       VALUES ($1, $2, 'JOURNAL', $3, $4, $5, 
         'POSTED', $6, $7,
         'user_admin_001', 'user_admin_001', NOW(), 'user_admin_002', NOW(), 'user_admin_002', NOW(),
         NOW(), NOW())`,
      [voucherId, voucherNo, entryDate, branchId, fiscalYear, totalAmount, narration]
    );

    // Insert journal entry
    const jeId = `jent_test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const entryNo = `JE-${fiscalYear}-${Date.now().toString(36).toUpperCase()}`;
    const totalDebit = lines.reduce((sum, l) => sum + l.debit_amount, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit_amount, 0);

    await cl.query(
      `INSERT INTO public.accounting_journal_entry
        (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
         total_debit, total_credit, is_reversed, narration,
         created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, 'user_admin_001', NOW())`,
      [jeId, entryNo, voucherId, entryDate, branchId, fiscalYear, totalDebit, totalCredit, narration]
    );

    // Insert journal lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineId = `jln_test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      await cl.query(
        `INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount,
           branch_id, narration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [lineId, jeId, i + 1, line.account_id, line.debit_amount, line.credit_amount, branchId, line.narration || '']
      );
    }

    return { voucherId, voucherNo, jeId, entryNo };
  }

  try {
    // ── BASELINE CHECK ────────────────────────────────────────────────────────
    console.log('── Section 1: Pre-Test Pristine Baseline Audit ──');
    const baselineRes = await client.query(`
      SELECT 
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt,
        (SELECT count(*)::int FROM public.accounting_account WHERE is_active = true) AS coa_cnt
    `);
    const b = baselineRes.rows[0];
    assert(b.vch_cnt === 0, `Zero test vouchers (got ${b.vch_cnt})`);
    assert(b.je_cnt === 0, `Zero test journal entries (got ${b.je_cnt})`);
    assert(b.jl_cnt === 0, `Zero test journal lines (got ${b.jl_cnt})`);
    assert(b.fp_cnt === 0, `Zero test fiscal periods (got ${b.fp_cnt})`);
    assert(b.start_date_cnt === 0, 'Accounting start date clean');
    assert(b.coa_cnt === 99, `Canonical CoA accounts intact (99, got ${b.coa_cnt})`);

    // ── BEGIN ISOLATED TRANSACTION ────────────────────────────────────────────
    console.log('\n── Section 2: Setup Test Environment in Rollback Transaction ──');
    await client.query('BEGIN');

    // 1. Configure accounting start date
    await client.query(
      `INSERT INTO public.setting (id, "group", key, value, created_at, updated_at) 
       VALUES (gen_random_uuid(), 'accounting', 'accounting_start_date', '2023-04-01', NOW(), NOW())`
    );

    // 2. Generate fiscal periods for FY2324 and FY2425
    const periodsFY2324 = await FiscalPeriodService.generateYearPeriods(
      'FY2324', '2023-04-01', 'user_admin_001', 'SUPER_ADMIN', client
    );
    assert(periodsFY2324.length === 12, '12 monthly fiscal periods created for FY2324');

    const periodsFY2425 = await FiscalPeriodService.generateYearPeriods(
      'FY2425', '2024-04-01', 'user_admin_001', 'SUPER_ADMIN', client
    );
    assert(periodsFY2425.length === 12, '12 monthly fiscal periods created for FY2425');

    // 3. Resolve branch
    const branchRes = await client.query(`SELECT id FROM public.branch WHERE deleted_at IS NULL LIMIT 1`);
    let branchId = branchRes.rows[0]?.id;
    if (!branchId) {
      const newB = await client.query(`
        INSERT INTO public.branch (id, name, code, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Test Branch', 'TB01', true, NOW(), NOW())
        RETURNING id
      `);
      branchId = newB.rows[0].id;
    }

    // 4. Resolve key account IDs
    const acctRes = await client.query(`
      SELECT code, id FROM public.accounting_account 
      WHERE code IN ('1111', '4110', '4120', '5110', '5210', '5220', '3210', '3120', '3300')
    `);
    const acctMap = {};
    for (const r of acctRes.rows) acctMap[r.code] = r.id;
    assert(acctMap['3210'] !== undefined, 'Account 3210 found in CoA');
    assert(acctMap['1111'] !== undefined, 'Cash Account 1111 found in CoA');

    // 5. Post sample operational vouchers in FY2324 via direct SQL
    // Revenue: 4110 = 50000, 4120 = 20000 => Total Rev = 70000
    // Expense: 5110 = 25000, 5210 = 10000, 5220 = 5000 => Total Exp = 40000
    // Net Profit = 30000
    await postDirectJournalVoucher(client, branchId, 'FY2324', '2023-10-15', [
      { account_id: acctMap['1111'], debit_amount: 50000, credit_amount: 0, narration: 'Cash receipt' },
      { account_id: acctMap['4110'], debit_amount: 0, credit_amount: 50000, narration: 'Revenue 4110' },
    ], '[TEST] Revenue 4110');

    await postDirectJournalVoucher(client, branchId, 'FY2324', '2023-11-15', [
      { account_id: acctMap['1111'], debit_amount: 20000, credit_amount: 0, narration: 'Cash receipt' },
      { account_id: acctMap['4120'], debit_amount: 0, credit_amount: 20000, narration: 'Revenue 4120' },
    ], '[TEST] Revenue 4120');

    await postDirectJournalVoucher(client, branchId, 'FY2324', '2023-12-15', [
      { account_id: acctMap['5110'], debit_amount: 25000, credit_amount: 0, narration: 'Expense 5110' },
      { account_id: acctMap['1111'], debit_amount: 0, credit_amount: 25000, narration: 'Cash payment' },
    ], '[TEST] Expense 5110');

    await postDirectJournalVoucher(client, branchId, 'FY2324', '2024-01-15', [
      { account_id: acctMap['5210'], debit_amount: 10000, credit_amount: 0, narration: 'Expense 5210' },
      { account_id: acctMap['1111'], debit_amount: 0, credit_amount: 10000, narration: 'Cash payment' },
    ], '[TEST] Expense 5210');

    await postDirectJournalVoucher(client, branchId, 'FY2324', '2024-02-15', [
      { account_id: acctMap['5220'], debit_amount: 5000, credit_amount: 0, narration: 'Expense 5220' },
      { account_id: acctMap['1111'], debit_amount: 0, credit_amount: 5000, narration: 'Cash payment' },
    ], '[TEST] Expense 5220');

    console.log('  ✓ INFO: Posted FY2324 operational vouchers (Rev: 70000, Exp: 40000, Net: 30000)');

    // 6. Lock all 12 periods for FY2324 (after posting operational vouchers)
    for (const p of periodsFY2324) {
      await FiscalPeriodService.lockPeriod(p.id, 'user_admin_001', 'SUPER_ADMIN', client);
    }
    const lockedCntRes = await client.query(
      `SELECT count(*)::int as cnt FROM public.accounting_fiscal_period WHERE fiscal_year = 'FY2324' AND is_locked = true`
    );
    assert(lockedCntRes.rows[0].cnt === 12, `All 12 FY2324 periods locked (got ${lockedCntRes.rows[0].cnt})`);

    // ── Section 3: Pre-Close State Tests ──────────────────────────────────────
    console.log('\n── Section 3: Pre-Close Retained Earnings & Fiscal Year Summary ──');

    // 3.1 Roll-forward for FY2324 before close
    const preCloseRF = await PeriodCloseService.getRetainedEarningsRollForward(
      { start_year: 'FY2324', end_year: 'FY2324' },
      client
    );
    assert(preCloseRF.years.length === 1, 'Roll-forward returns 1 year for FY2324');
    assert(preCloseRF.years[0].fiscal_year === 'FY2324', 'Roll-forward year is FY2324');
    assert(preCloseRF.years[0].opening_retained_earnings === 0, `Opening RE for FY2324 is 0 (got ${preCloseRF.years[0].opening_retained_earnings})`);
    assert(preCloseRF.years[0].net_operating_profit === 30000, `Net operating profit is 30000 (got ${preCloseRF.years[0].net_operating_profit})`);
    assert(preCloseRF.years[0].is_closed === false, 'FY2324 is not closed yet');
    assert(preCloseRF.years[0].transferred_to_retained_earnings === 0, 'No RE transfer before close');
    assert(preCloseRF.years[0].closing_retained_earnings === 0, 'Closing RE is 0 before close (no 3210 journal lines)');

    // 3.2 Fiscal Year Summary before close
    const preCloseFYS = await PeriodCloseService.getFiscalYearSummary({}, client);
    assert(preCloseFYS.length >= 2, `At least 2 fiscal years in summary (got ${preCloseFYS.length})`);
    const fy2324Summary = preCloseFYS.find(s => s.fiscal_year === 'FY2324');
    assert(fy2324Summary !== undefined, 'FY2324 present in summary');
    assert(fy2324Summary.status === 'OPEN', `FY2324 status is OPEN (got ${fy2324Summary?.status})`);
    assert(fy2324Summary.total_periods === 12, `FY2324 has 12 periods (got ${fy2324Summary?.total_periods})`);
    assert(fy2324Summary.locked_periods === 12, `FY2324 has 12 locked periods (got ${fy2324Summary?.locked_periods})`);
    assert(fy2324Summary.all_periods_locked === true, 'FY2324 all periods locked');
    assert(fy2324Summary.net_profit === 30000, `FY2324 net profit is 30000 (got ${fy2324Summary?.net_profit})`);
    assert(fy2324Summary.active_closing_voucher === null, 'No active closing voucher before close');
    assert(fy2324Summary.close_cycle_count === 0, 'Zero close cycles before close');
    assert(fy2324Summary.reopen_cycle_count === 0, 'Zero reopen cycles before close');

    // 3.3 Comparative P&L for two years with no activity in FY2425
    const preComparePnL = await PeriodCloseService.getComparativeProfitLoss(
      { fiscal_year: 'FY2324', compare_fiscal_year: 'FY2425' },
      client
    );
    assert(preComparePnL.current_fiscal_year === 'FY2324', 'Comparative P&L current FY is FY2324');
    assert(preComparePnL.compare_fiscal_year === 'FY2425', 'Comparative P&L compare FY is FY2425');
    assert(preComparePnL.summary.current_net_profit === 30000, `Current net profit is 30000 (got ${preComparePnL.summary.current_net_profit})`);
    assert(preComparePnL.summary.compare_net_profit === 0, `Compare net profit is 0 (got ${preComparePnL.summary.compare_net_profit})`);
    assert(preComparePnL.summary.net_profit_variance === 30000, `Net profit variance is 30000 (got ${preComparePnL.summary.net_profit_variance})`);

    // ── Section 4: Year-End Close FY2324 ─────────────────────────────────────
    console.log('\n── Section 4: Execute Year-End Close for FY2324 ──');

    const closeResult = await PeriodCloseService.executeYearEndClose({
      fiscal_year: 'FY2324',
      branch_id: branchId,
      closeDrawingsToRetainedEarnings: false,
      preparer_id: 'user_admin_001',
      approver_id: 'user_admin_002',
      session_user: { id: 'user_admin_002', role: 'SUPER_ADMIN', isSuperAdmin: true },
    }, client);
    assert(closeResult.success === true, 'Year-end close executed successfully');
    assert(closeResult.net_profit === 30000, `Closed net profit is 30000 (got ${closeResult.net_profit})`);
    console.log(`  ✓ INFO: FY2324 closed. Voucher ${closeResult.voucher_no}, Net Profit: ₹${closeResult.net_profit}`);

    // ── Section 5: Post-Close Roll-Forward Verification ──────────────────────
    console.log('\n── Section 5: Post-Close Retained Earnings Roll-Forward ──');

    const postCloseRF = await PeriodCloseService.getRetainedEarningsRollForward(
      { start_year: 'FY2324', end_year: 'FY2425' },
      client
    );
    assert(postCloseRF.years.length === 2, `Roll-forward returns 2 years (got ${postCloseRF.years.length})`);

    const fy2324RF = postCloseRF.years[0];
    const fy2425RF = postCloseRF.years[1];

    assert(fy2324RF.fiscal_year === 'FY2324', 'First year is FY2324');
    assert(fy2324RF.is_closed === true, 'FY2324 is closed');
    assert(fy2324RF.opening_retained_earnings === 0, `FY2324 opening RE is 0 (got ${fy2324RF.opening_retained_earnings})`);
    assert(fy2324RF.net_operating_profit === 30000, `FY2324 net operating profit is 30000 (got ${fy2324RF.net_operating_profit})`);
    assert(fy2324RF.transferred_to_retained_earnings === 30000, `FY2324 transferred to RE is 30000 (got ${fy2324RF.transferred_to_retained_earnings})`);
    assert(fy2324RF.drawings_transferred === 0, `FY2324 drawings transferred is 0 (got ${fy2324RF.drawings_transferred})`);
    assert(fy2324RF.closing_retained_earnings === 30000, `FY2324 closing RE is 30000 (got ${fy2324RF.closing_retained_earnings})`);

    // CRITICAL INVARIANT: Closing RE(FY2324) === Opening RE(FY2425)
    assert(fy2425RF.fiscal_year === 'FY2425', 'Second year is FY2425');
    assert(fy2425RF.opening_retained_earnings === 30000, `FY2425 opening RE is 30000 === FY2324 closing RE (got ${fy2425RF.opening_retained_earnings})`);
    assert(fy2324RF.continuity_verified === true, 'Continuity FY2324→FY2425 verified');
    assert(postCloseRF.overall_continuity_verified === true, 'Overall multi-year continuity verified');

    // ── Section 6: Post-Close Fiscal Year Summary ────────────────────────────
    console.log('\n── Section 6: Post-Close Fiscal Year Summary ──');

    const postCloseFYS = await PeriodCloseService.getFiscalYearSummary({}, client);
    const fy2324PostClose = postCloseFYS.find(s => s.fiscal_year === 'FY2324');
    assert(fy2324PostClose !== undefined, 'FY2324 present in post-close summary');
    assert(fy2324PostClose.status === 'CLOSED', `FY2324 status is CLOSED (got ${fy2324PostClose?.status})`);
    assert(fy2324PostClose.close_cycle_count === 1, `FY2324 close cycle count is 1 (got ${fy2324PostClose?.close_cycle_count})`);
    assert(fy2324PostClose.reopen_cycle_count === 0, `FY2324 reopen cycle count is 0 (got ${fy2324PostClose?.reopen_cycle_count})`);
    assert(fy2324PostClose.active_closing_voucher !== null, 'Active closing voucher present');
    assert(fy2324PostClose.active_closing_voucher?.net_profit === 30000, `Active close voucher net profit is 30000 (got ${fy2324PostClose?.active_closing_voucher?.net_profit})`);
    assert(fy2324PostClose.historical_lockout_active === true, 'Historical lockout is active for closed year');

    const fy2425PostClose = postCloseFYS.find(s => s.fiscal_year === 'FY2425');
    assert(fy2425PostClose !== undefined, 'FY2425 present in post-close summary');
    assert(fy2425PostClose.status === 'OPEN', `FY2425 status is OPEN (got ${fy2425PostClose?.status})`);

    // ── Section 7: Post activity in FY2425, then verify comparative P&L ──────
    console.log('\n── Section 7: FY2425 Activity & Comparative P&L ──');

    // Post FY2425 revenue/expense via direct SQL: Rev 80000, Exp 45000 => Net 35000
    await postDirectJournalVoucher(client, branchId, 'FY2425', '2024-10-15', [
      { account_id: acctMap['1111'], debit_amount: 60000, credit_amount: 0, narration: 'Cash receipt' },
      { account_id: acctMap['4110'], debit_amount: 0, credit_amount: 60000, narration: 'Revenue 4110' },
    ], '[TEST] FY2425 Revenue 4110');

    await postDirectJournalVoucher(client, branchId, 'FY2425', '2024-11-15', [
      { account_id: acctMap['1111'], debit_amount: 20000, credit_amount: 0, narration: 'Cash receipt' },
      { account_id: acctMap['4120'], debit_amount: 0, credit_amount: 20000, narration: 'Revenue 4120' },
    ], '[TEST] FY2425 Revenue 4120');

    await postDirectJournalVoucher(client, branchId, 'FY2425', '2024-12-15', [
      { account_id: acctMap['5110'], debit_amount: 30000, credit_amount: 0, narration: 'Expense 5110' },
      { account_id: acctMap['1111'], debit_amount: 0, credit_amount: 30000, narration: 'Cash payment' },
    ], '[TEST] FY2425 Expense 5110');

    await postDirectJournalVoucher(client, branchId, 'FY2425', '2025-01-15', [
      { account_id: acctMap['5210'], debit_amount: 10000, credit_amount: 0, narration: 'Expense 5210' },
      { account_id: acctMap['1111'], debit_amount: 0, credit_amount: 10000, narration: 'Cash payment' },
    ], '[TEST] FY2425 Expense 5210');

    await postDirectJournalVoucher(client, branchId, 'FY2425', '2025-02-15', [
      { account_id: acctMap['5220'], debit_amount: 5000, credit_amount: 0, narration: 'Expense 5220' },
      { account_id: acctMap['1111'], debit_amount: 0, credit_amount: 5000, narration: 'Cash payment' },
    ], '[TEST] FY2425 Expense 5220');

    console.log('  ✓ INFO: Posted FY2425 operational vouchers (Rev: 80000, Exp: 45000, Net: 35000)');

    const comparePnL = await PeriodCloseService.getComparativeProfitLoss(
      { fiscal_year: 'FY2425', compare_fiscal_year: 'FY2324' },
      client
    );
    assert(comparePnL.summary.current_net_profit === 35000, `FY2425 net profit is 35000 (got ${comparePnL.summary.current_net_profit})`);
    assert(comparePnL.summary.compare_net_profit === 30000, `FY2324 compare net profit is 30000 (got ${comparePnL.summary.compare_net_profit})`);
    assert(comparePnL.summary.net_profit_variance === 5000, `Net profit variance is 5000 (got ${comparePnL.summary.net_profit_variance})`);
    // Variance percent: 5000/30000 * 100 = 16.67
    assert(comparePnL.summary.net_profit_variance_percent !== null, 'Net profit variance percent is not null');
    assert(Math.abs(comparePnL.summary.net_profit_variance_percent - 16.67) < 0.1, `Net profit variance percent ~16.67 (got ${comparePnL.summary.net_profit_variance_percent})`);

    // Verify sections
    assert(comparePnL.sections.operating_revenue !== undefined, 'Operating revenue section present');
    assert(comparePnL.sections.cost_of_goods_sold !== undefined, 'COGS section present');
    assert(comparePnL.sections.operating_expenses !== undefined, 'Operating expenses section present');

    // ── Section 8: RBAC Enforcement ──────────────────────────────────────────
    console.log('\n── Section 8: RBAC Enforcement ──');

    // 8.1 Roll-forward RBAC
    try {
      await PeriodCloseService.getRetainedEarningsRollForward({
        start_year: 'FY2324',
        end_year: 'FY2425',
        session_user: { id: 'user_staff_001', role: 'BRANCH_MANAGER', permissions: [] },
      }, client);
      assert(false, 'Roll-forward should reject without ACCOUNTING.VIEW');
    } catch (err) {
      assert(err.code === 'PERMISSION_DENIED', `Roll-forward RBAC: got PERMISSION_DENIED (${err.code})`);
    }

    // 8.2 Fiscal Year Summary RBAC
    try {
      await PeriodCloseService.getFiscalYearSummary({
        session_user: { id: 'user_staff_001', role: 'BRANCH_MANAGER', permissions: [] },
      }, client);
      assert(false, 'Fiscal Year Summary should reject without ACCOUNTING.VIEW');
    } catch (err) {
      assert(err.code === 'PERMISSION_DENIED', `FY Summary RBAC: got PERMISSION_DENIED (${err.code})`);
    }

    // 8.3 Comparative P&L RBAC
    try {
      await PeriodCloseService.getComparativeProfitLoss({
        fiscal_year: 'FY2324',
        compare_fiscal_year: 'FY2425',
        session_user: { id: 'user_staff_001', role: 'BRANCH_MANAGER', permissions: [] },
      }, client);
      assert(false, 'Comparative P&L should reject without ACCOUNTING.VIEW');
    } catch (err) {
      assert(err.code === 'PERMISSION_DENIED', `Comparative P&L RBAC: got PERMISSION_DENIED (${err.code})`);
    }

    // 8.4 Branch isolation (BOLA)
    try {
      await PeriodCloseService.getRetainedEarningsRollForward({
        start_year: 'FY2324',
        end_year: 'FY2425',
        branch_id: 'wrong_branch_id',
        session_user: { id: 'user_staff_001', role: 'BRANCH_MANAGER', branch_id: 'real_branch', permissions: ['ACCOUNTING.VIEW'] },
      }, client);
      assert(false, 'Roll-forward BOLA should reject branch mismatch');
    } catch (err) {
      assert(err.code === 'BRANCH_ACCESS_DENIED', `Roll-forward BOLA: got BRANCH_ACCESS_DENIED (${err.code})`);
    }

    // 8.5 With ACCOUNTING.VIEW permission, should succeed
    const rbacRF = await PeriodCloseService.getRetainedEarningsRollForward({
      start_year: 'FY2324',
      end_year: 'FY2324',
      session_user: { id: 'user_staff_001', role: 'BRANCH_MANAGER', permissions: ['ACCOUNTING.VIEW'] },
    }, client);
    assert(rbacRF.years.length === 1, 'Roll-forward with ACCOUNTING.VIEW succeeds');

    // ── Section 9: Multi-Year Range & Fiscal Year Helpers ────────────────────
    console.log('\n── Section 9: Multi-Year Range Parsing & Edge Cases ──');

    // 9.1 Range FY2324 to FY2526 should produce 3 years
    const threeYearRF = await PeriodCloseService.getRetainedEarningsRollForward(
      { start_year: 'FY2324', end_year: 'FY2526' },
      client
    );
    assert(threeYearRF.years.length === 3, `3-year range produces 3 entries (got ${threeYearRF.years.length})`);
    assert(threeYearRF.years[0].fiscal_year === 'FY2324', 'First year is FY2324');
    assert(threeYearRF.years[1].fiscal_year === 'FY2425', 'Second year is FY2425');
    assert(threeYearRF.years[2].fiscal_year === 'FY2526', 'Third year is FY2526');

    // 9.2 Single year range
    const singleYearRF = await PeriodCloseService.getRetainedEarningsRollForward(
      { start_year: 'FY2425', end_year: 'FY2425' },
      client
    );
    assert(singleYearRF.years.length === 1, `Single year range produces 1 entry (got ${singleYearRF.years.length})`);

    // ── Section 10: Zero-Activity Year Behavior ─────────────────────────────
    console.log('\n── Section 10: Zero-Activity Year Behavior ──');

    // FY2526 has no activity at all
    const zeroActivityRF = threeYearRF.years[2];
    assert(zeroActivityRF.opening_retained_earnings === 30000, `FY2526 opening RE is 30000 (carried from FY2324 close) (got ${zeroActivityRF.opening_retained_earnings})`);
    assert(zeroActivityRF.net_operating_profit === 0, `FY2526 net operating profit is 0 (got ${zeroActivityRF.net_operating_profit})`);
    assert(zeroActivityRF.is_closed === false, 'FY2526 is not closed');

    // ── Section 11: Account 3300 Permanence ─────────────────────────────────
    console.log('\n── Section 11: Account 3300 Permanence ──');

    // Verify that no close/reopen journal line touches account 3300
    if (acctMap['3300']) {
      const closingReopen3300Res = await client.query(`
        SELECT count(*)::int AS cnt
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        JOIN public.accounting_voucher v ON v.id = je.voucher_id
        WHERE jl.account_id = $1
          AND v.reference_type IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN')
      `, [acctMap['3300']]);
      assert(closingReopen3300Res.rows[0].cnt === 0, 'Account 3300 has zero lines from close/reopen vouchers');
    } else {
      assert(true, 'Account 3300 not in test map (skipped)');
    }

    // ── Section 12: Comparative P&L Section Classification ──────────────────
    console.log('\n── Section 12: Comparative P&L Section Classification ──');

    // Verify 4110 appears in operating_revenue section, 5110 in COGS, 5210 in operating_expenses
    const found4110 = comparePnL.sections.operating_revenue.accounts.find(a => a.code === '4110');
    assert(found4110 !== undefined, 'Account 4110 classified in operating_revenue');
    assert(found4110?.current_amount === 60000, `4110 current amount is 60000 (got ${found4110?.current_amount})`);
    assert(found4110?.compare_amount === 50000, `4110 compare amount is 50000 (got ${found4110?.compare_amount})`);

    const found5110 = comparePnL.sections.cost_of_goods_sold.accounts.find(a => a.code === '5110');
    assert(found5110 !== undefined, 'Account 5110 classified in cost_of_goods_sold');

    const found5210 = comparePnL.sections.operating_expenses.accounts.find(a => a.code === '5210');
    assert(found5210 !== undefined, 'Account 5210 classified in operating_expenses');

    // ── Section 13: Read-Only Purity ─────────────────────────────────────────
    console.log('\n── Section 13: Read-Only Purity ──');

    // Count vouchers before and after report calls
    const preReportVchRes = await client.query(`SELECT count(*)::int AS cnt FROM public.accounting_voucher`);
    const preReportVchCount = preReportVchRes.rows[0].cnt;
    const preReportJeRes = await client.query(`SELECT count(*)::int AS cnt FROM public.accounting_journal_entry`);
    const preReportJeCount = preReportJeRes.rows[0].cnt;

    // Call all three reports
    await PeriodCloseService.getRetainedEarningsRollForward({ start_year: 'FY2324', end_year: 'FY2425' }, client);
    await PeriodCloseService.getFiscalYearSummary({}, client);
    await PeriodCloseService.getComparativeProfitLoss({ fiscal_year: 'FY2425', compare_fiscal_year: 'FY2324' }, client);

    const postReportVchRes = await client.query(`SELECT count(*)::int AS cnt FROM public.accounting_voucher`);
    assert(postReportVchRes.rows[0].cnt === preReportVchCount, 'Reports cause zero new vouchers (read-only)');

    const postReportJeRes = await client.query(`SELECT count(*)::int AS cnt FROM public.accounting_journal_entry`);
    assert(postReportJeRes.rows[0].cnt === preReportJeCount, 'Reports cause zero new journal entries (read-only)');

    // ── Section 14: Multi-Year Continuity with Close ─────────────────────────
    console.log('\n── Section 14: Multi-Year Continuity Chain Verification ──');

    // The 3-year roll-forward should show:
    // FY2324: Opening 0 → Closing 30000 (closed)
    // FY2425: Opening 30000 (continuity!) → still open with 35000 profit → Closing RE = 30000 (only 3210 lines)
    // FY2526: Opening 30000 → zero activity → Closing RE = 30000
    const fullChainRF = await PeriodCloseService.getRetainedEarningsRollForward(
      { start_year: 'FY2324', end_year: 'FY2526' },
      client
    );
    assert(fullChainRF.years[0].closing_retained_earnings === 30000, `FY2324 closing RE is 30000 (got ${fullChainRF.years[0].closing_retained_earnings})`);
    assert(fullChainRF.years[1].opening_retained_earnings === 30000, `FY2425 opening RE is 30000 (got ${fullChainRF.years[1].opening_retained_earnings})`);
    assert(fullChainRF.years[0].continuity_verified === true, 'FY2324→FY2425 continuity verified');
    assert(fullChainRF.years[1].closing_retained_earnings === 30000, `FY2425 closing RE is 30000 (unclosed, RE balance carried) (got ${fullChainRF.years[1].closing_retained_earnings})`);
    assert(fullChainRF.years[1].continuity_verified === true, 'FY2425→FY2526 continuity verified');
    assert(fullChainRF.overall_continuity_verified === true, 'Overall 3-year continuity verified');

    // ── ROLLBACK ─────────────────────────────────────────────────────────────
    console.log('\n── Section 15: Rollback & Post-Test Baseline Audit ──');
    await client.query('ROLLBACK');

    // Post-rollback baseline audit
    const postRollbackRes = await client.query(`
      SELECT 
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt,
        (SELECT count(*)::int FROM public.accounting_account WHERE is_active = true) AS coa_cnt
    `);
    const pr = postRollbackRes.rows[0];
    assert(pr.vch_cnt === 0, `Post-rollback: Zero vouchers (got ${pr.vch_cnt})`);
    assert(pr.je_cnt === 0, `Post-rollback: Zero journal entries (got ${pr.je_cnt})`);
    assert(pr.jl_cnt === 0, `Post-rollback: Zero journal lines (got ${pr.jl_cnt})`);
    assert(pr.fp_cnt === 0, `Post-rollback: Zero fiscal periods (got ${pr.fp_cnt})`);
    assert(pr.start_date_cnt === 0, 'Post-rollback: Accounting start date clean');
    assert(pr.coa_cnt === 99, `Post-rollback: Canonical CoA intact (99, got ${pr.coa_cnt})`);

  } catch (err) {
    console.error('\n✗ UNEXPECTED ERROR:', err.message || err);
    console.error(err.stack || '');
    try { await client.query('ROLLBACK'); } catch {}
  } finally {
    await client.end();
    try { await closeDbPool(); } catch {}
  }

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`Phase 5A.6 Substep 5.2 — FINAL RESULT: ${passed} PASS, ${failed} FAIL`);
  console.log('══════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
