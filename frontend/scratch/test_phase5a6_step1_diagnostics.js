/**
 * CakeToHome ERP — Phase 5A.6 Step 1: Pre-Close Diagnostics Engine Verification Suite
 *
 * RIGOROUS INVARIANTS:
 * 1. STRICTLY READ-ONLY IN STEP 1:
 *    - Zero period locking (is_locked untouched).
 *    - Zero closing voucher postings (no closing journals, no nominal zeroing).
 *    - Zero permanent database mutations.
 * 2. DATABASE AS ONLY SOURCE OF TRUTH:
 *    - Real PostgreSQL queries, real accounts, real ledger lines.
 *    - Zero mock / synthetic balancing plugs.
 * 3. PREREQUISITE MATRIX ENFORCEMENT:
 *    - Classifies checks into BLOCKING, WARNING, INFORMATIONAL.
 *    - can_close === true if and only if blocking_checks.length === 0.
 * 4. ALL 26 NOMINAL LEAF ACCOUNTS AUDITED:
 *    - 7 Revenue, 19 Expense leaf accounts.
 * 5. CRITICAL CAKE OPERATIONAL RULE PRESERVED.
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
  console.log('Phase 5A.6 Step 1 — Pre-Close Diagnostics Engine Verification');
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

  const { PeriodCloseService, PeriodCloseServiceError } = require('../src/lib/services/period-close.service');
  const { signAuthToken } = require('../src/lib/security/auth-session');

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
    // SECTION 0: PRE-TEST POSTGRESQL BASELINE AUDIT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('--- SECTION 0: PRE-TEST POSTGRESQL BASELINE AUDIT ---');
    const [v0, j0, l0, p0, s0, accts0, orders0, pay0, locks0] = await Promise.all([
      client.query('SELECT count(*) FROM public.accounting_voucher'),
      client.query('SELECT count(*) FROM public.accounting_journal_entry'),
      client.query('SELECT count(*) FROM public.accounting_journal_line'),
      client.query('SELECT count(*) FROM public.accounting_fiscal_period'),
      client.query("SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%'"),
      client.query('SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL'),
      client.query('SELECT count(*) FROM public.order WHERE deleted_at IS NULL'),
      client.query('SELECT count(*) FROM public.payment_transaction WHERE deleted_at IS NULL'),
      client.query("SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid()")
    ]);

    assert(parseInt(v0.rows[0].count, 10) === 0, `Baseline vouchers = 0 (actual: ${v0.rows[0].count})`);
    assert(parseInt(j0.rows[0].count, 10) === 0, `Baseline journal entries = 0 (actual: ${j0.rows[0].count})`);
    assert(parseInt(l0.rows[0].count, 10) === 0, `Baseline journal lines = 0 (actual: ${l0.rows[0].count})`);
    assert(parseInt(p0.rows[0].count, 10) === 0, `Baseline fiscal periods = 0 (actual: ${p0.rows[0].count})`);
    assert(parseInt(s0.rows[0].count, 10) === 0, `Baseline accounting settings = 0 (actual: ${s0.rows[0].count})`);
    assert(parseInt(accts0.rows[0].count, 10) === 99, `Baseline active CoA = 99 (actual: ${accts0.rows[0].count})`);
    assert(parseInt(orders0.rows[0].count, 10) === 173, `Baseline orders = 173 (actual: ${orders0.rows[0].count})`);
    assert(parseInt(pay0.rows[0].count, 10) === 53, `Baseline payments = 53 (actual: ${pay0.rows[0].count})`);
    assert(parseInt(locks0.rows[0].count, 10) === 0, `Active competing connections = 0 (actual: ${locks0.rows[0].count})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: SERVICE EXPORT & SIGNATURE SANITY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 1: SERVICE EXPORT & SIGNATURE SANITY ---');
    assert(typeof PeriodCloseService === 'function', 'PeriodCloseService class is exported');
    assert(typeof PeriodCloseService.runPreCloseDiagnostics === 'function', 'PeriodCloseService.runPreCloseDiagnostics is a static method');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: RBAC & BRANCH SECURITY CHECKS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 2: RBAC & BRANCH SECURITY CHECKS ---');

    // 2A: Staff with no ACCOUNTING.VIEW permission is rejected
    let deniedNoPerm = false;
    try {
      await PeriodCloseService.runPreCloseDiagnostics({
        fiscal_year: 'FY2425',
        session_user: {
          id: 'usr_staff_noperm',
          role: 'STAFF',
          branch_id: 'br_01',
          permissions: ['TELEMARKETING.VIEW'],
        },
      });
    } catch (err) {
      if (err instanceof PeriodCloseServiceError && err.code === 'PERMISSION_DENIED') {
        deniedNoPerm = true;
      }
    }
    assert(deniedNoPerm, 'Staff without ACCOUNTING.VIEW rejected with PERMISSION_DENIED');

    // 2B: Staff with ACCOUNTING.VIEW attempting to view another branch is rejected
    let deniedWrongBranch = false;
    try {
      await PeriodCloseService.runPreCloseDiagnostics({
        fiscal_year: 'FY2425',
        branch_id: 'br_02',
        session_user: {
          id: 'usr_staff_acct',
          role: 'STAFF',
          branch_id: 'br_01',
          permissions: ['ACCOUNTING.VIEW'],
        },
      });
    } catch (err) {
      if (err instanceof PeriodCloseServiceError && err.code === 'BRANCH_ACCESS_DENIED') {
        deniedWrongBranch = true;
      }
    }
    assert(deniedWrongBranch, 'Staff querying non-matching branch rejected with BRANCH_ACCESS_DENIED');

    // 2C: Super admin succeeds without restriction
    let superAdminAllowed = false;
    try {
      const res = await PeriodCloseService.runPreCloseDiagnostics({
        fiscal_year: 'FY2425',
        session_user: {
          id: 'usr_super_admin',
          role: 'SUPER_ADMIN',
          isSuperAdmin: true,
        },
      });
      if (res && res.fiscal_year === 'FY2425') superAdminAllowed = true;
    } catch (e) {
      console.error(e);
    }
    assert(superAdminAllowed, 'SUPER_ADMIN authorized for company-wide period close diagnostics');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: CALENDAR DATE DERIVATION (INDIAN FISCAL YEAR)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 3: CALENDAR DATE DERIVATION ---');
    const diagShort = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' });
    assert(diagShort.start_date === '2024-04-01', `FY2425 start_date = 2024-04-01 (actual: ${diagShort.start_date})`);
    assert(diagShort.end_date === '2025-03-31', `FY2425 end_date = 2025-03-31 (actual: ${diagShort.end_date})`);

    const diagLong = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: '2025-2026' });
    assert(diagLong.start_date === '2025-04-01', `2025-2026 start_date = 2025-04-01 (actual: ${diagLong.start_date})`);
    assert(diagLong.end_date === '2026-03-31', `2025-2026 end_date = 2026-03-31 (actual: ${diagLong.end_date})`);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: BASELINE EXECUTION ON CLEAN DATABASE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 4: BASELINE EXECUTION ON CLEAN DATABASE ---');
    const baselineDiag = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' });

    assert(baselineDiag.can_close === false, 'can_close is FALSE on clean database with unconfigured periods');
    assert(baselineDiag.summary.blocking_count >= 2, `Blocking count >= 2 (actual: ${baselineDiag.summary.blocking_count})`);

    const hasStartDateBlock = baselineDiag.blocking_checks.some(c => c.id === 'GATE_START_DATE_CONFIGURED');
    const hasPeriodsBlock = baselineDiag.blocking_checks.some(c => c.id === 'GATE_FISCAL_PERIOD_CONFIGURED');
    assert(hasStartDateBlock, 'GATE_START_DATE_CONFIGURED correctly blocks close when accounting_start_date is missing');
    assert(hasPeriodsBlock, 'GATE_FISCAL_PERIOD_CONFIGURED correctly blocks close when 0 periods exist');

    assert(baselineDiag.summary.is_balanced_tb === true, 'Trial Balance is mathematically balanced at zero state');
    assert(baselineDiag.summary.gross_revenue === 0, 'Gross revenue is ₹0.00 at baseline');
    assert(baselineDiag.summary.gross_expenses === 0, 'Gross expenses is ₹0.00 at baseline');
    assert(baselineDiag.summary.projected_net_profit === 0, 'Projected net profit is ₹0.00 at baseline');

    assert(baselineDiag.projected_equity.current_retained_earnings_3210 === 0, 'Current 3210 Retained Earnings is ₹0.00');
    assert(baselineDiag.projected_equity.projected_retained_earnings_3210 === 0, 'Projected 3210 Retained Earnings is ₹0.00');
    assert(baselineDiag.projected_equity.current_dynamic_3220 === 0, 'Current dynamic 3220 is ₹0.00');
    assert(baselineDiag.projected_equity.projected_dynamic_3220 === 0, 'Projected dynamic 3220 resets to ₹0.00');
    assert(baselineDiag.projected_equity.opening_balance_offset_3300 === 0, 'Opening Balance Offset 3300 is ₹0.00');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: NOMINAL ACCOUNTS TOPOLOGY (THE 26 LEAF ACCOUNTS)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 5: NOMINAL ACCOUNTS TOPOLOGY (26 LEAF ACCOUNTS) ---');
    const revAccounts = baselineDiag.nominal_accounts.revenues;
    const expAccounts = baselineDiag.nominal_accounts.expenses;

    assert(revAccounts.length === 7, `Exactly 7 Revenue leaf accounts returned (actual: ${revAccounts.length})`);
    assert(expAccounts.length === 19, `Exactly 19 Expense leaf accounts returned (actual: ${expAccounts.length})`);
    assert(revAccounts.length + expAccounts.length === 26, `Total nominal leaf accounts = 26 (actual: ${revAccounts.length + expAccounts.length})`);

    const expectedRevenues = ['4110', '4120', '4130', '4140', '4190', '4210', '4220'];
    const actualRevenues = revAccounts.map(a => a.code).sort();
    assert(JSON.stringify(actualRevenues) === JSON.stringify(expectedRevenues.sort()), 'All 7 Revenue account codes match exactly');

    const expectedExpenses = [
      '5110', '5120', '5130', '5140', '5190',
      '5210', '5220', '5230', '5240', '5250', '5260', '5270', '5280', '5290', '5295', '5299',
      '5310', '5320', '5330'
    ];
    const actualExpenses = expAccounts.map(a => a.code).sort();
    assert(JSON.stringify(actualExpenses) === JSON.stringify(expectedExpenses.sort()), 'All 19 Expense account codes match exactly');

    const acct4190 = revAccounts.find(a => a.code === '4190');
    assert(acct4190?.is_contra === true, 'Account 4190 is correctly identified as contra-revenue');

    const acct5190 = expAccounts.find(a => a.code === '5190');
    assert(acct5190?.is_contra === true, 'Account 5190 is correctly identified as contra-expense');

    const allNone = [...revAccounts, ...expAccounts].every(a => a.proposed_action === 'NONE');
    assert(allNone, 'Zero balance nominal accounts produce proposed_action = NONE');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: ISOLATED TRANSACTIONAL TESTS (GUARANTEED ROLLBACK)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 6: ISOLATED TRANSACTIONAL TESTS (GUARANTEED ROLLBACK) ---');

    // 6A: Accounting Start Date Boundary
    await client.query('BEGIN');
    try {
      await client.query(`
        INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
        VALUES ('set_test_01', 'accounting', 'accounting_start_date', '2024-05-01', NOW(), NOW())
      `);
      const diag6A = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' }, client);
      const boundaryBlock = diag6A.blocking_checks.find(c => c.name === 'Accounting Start Date Boundary');
      assert(!!boundaryBlock, 'GATE_START_DATE_CONFIGURED blocks when fiscal start date < accounting start date');
    } finally {
      await client.query('ROLLBACK');
    }

    // 6B: Unlocked Monthly Periods Lockdown
    await client.query('BEGIN');
    try {
      // Insert valid start date
      await client.query(`
        INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
        VALUES ('set_test_01', 'accounting', 'accounting_start_date', '2024-04-01', NOW(), NOW())
      `);
      // Insert 12 periods where 2 are unlocked
      const months = [
        ['P01', '2024-04-01', '2024-04-30', true],
        ['P02', '2024-05-01', '2024-05-31', true],
        ['P03', '2024-06-01', '2024-06-30', true],
        ['P04', '2024-07-01', '2024-07-31', true],
        ['P05', '2024-08-01', '2024-08-31', true],
        ['P06', '2024-09-01', '2024-09-30', true],
        ['P07', '2024-10-01', '2024-10-31', true],
        ['P08', '2024-11-01', '2024-11-30', true],
        ['P09', '2024-12-01', '2024-12-31', true],
        ['P10', '2025-01-01', '2025-01-31', true],
        ['P11', '2025-02-01', '2025-02-28', false], // Unlocked
        ['P12', '2025-03-01', '2025-03-31', false], // Unlocked
      ];
      for (const [pname, sdate, edate, locked] of months) {
        await client.query(`
          INSERT INTO public.accounting_fiscal_period 
            (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
          VALUES 
            ('FY2425', $1, $2::date, $3::date, $4, NOW())
        `, [pname, sdate, edate, locked]);
      }

      const diag6B = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' }, client);
      const unlockedBlock = diag6B.blocking_checks.find(c => c.id === 'GATE_PERIODS_LOCKED');
      assert(!!unlockedBlock, 'GATE_PERIODS_LOCKED blocks close when any monthly periods remain unlocked');
      assert(unlockedBlock?.details?.unlocked_periods?.length === 2, 'Accurately identifies exactly 2 unlocked periods');
    } finally {
      await client.query('ROLLBACK');
    }

    async function insertSimJournal(txClient, branchId, vId, vNo, date, lines, status = 'POSTED') {
      let totalDebit = 0;
      let totalCredit = 0;
      for (const l of lines) {
        totalDebit += Number(l.debit) || 0;
        totalCredit += Number(l.credit) || 0;
      }
      const amount = Math.max(totalDebit, totalCredit);
      const isPosted = status === 'POSTED';
      const createdBy = 'usr_creator';
      const approvedBy = isPosted ? 'usr_approver' : null;
      const postedBy = isPosted ? 'usr_poster' : null;

      await txClient.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, status, branch_id,
          fiscal_year, total_amount, currency, reference_event, narration,
          created_by, approved_by, posted_by, created_at, updated_at
        ) VALUES ($1, $2, 'JOURNAL', $3, $4, $5, 'FY2425', $6, 'INR', 'PRIMARY', 'Sim voucher', $7, $8, $9, NOW(), NOW())
      `, [vId, vNo, date, status, branchId, amount, createdBy, approvedBy, postedBy]);

      if (isPosted) {
        const jeId = `je_${vId}`;
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry (
            id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
            total_debit, total_credit, is_reversed, narration, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, 'FY2425', $6, $7, false, 'Sim journal', 'usr_creator', NOW())
        `, [jeId, `JE-${vNo}`, vId, date, branchId, totalDebit, totalCredit]);

        let lineIdx = 1;
        for (const l of lines) {
          await txClient.query(`
            INSERT INTO public.accounting_journal_line (
              id, journal_entry_id, branch_id, line_no, account_id,
              debit_amount, credit_amount, narration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Sim line')
          `, [`jl_${vId}_${lineIdx}`, jeId, branchId, lineIdx++, l.accountId, l.debit || 0, l.credit || 0]);
        }
      }
    }

    // 6C: Unposted Vouchers in Pipeline
    await client.query('BEGIN');
    try {
      const brRes = await client.query('SELECT id FROM public.branch LIMIT 1');
      const branchId = brRes.rows[0].id;

      await insertSimJournal(client, branchId, 'v_test_draft', 'V-DRAFT-001', '2024-06-15', [], 'DRAFT');

      const diag6C = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' }, client);
      const unpostedBlock = diag6C.blocking_checks.find(c => c.id === 'GATE_VOUCHERS_UNPOSTED');
      assert(!!unpostedBlock, 'GATE_VOUCHERS_UNPOSTED blocks close when DRAFT voucher exists');
      assert(unpostedBlock?.details?.draft_count === 1, 'Details record 1 draft voucher');
    } finally {
      await client.query('ROLLBACK');
    }

    // 6D: Uncleared Suspense 1119
    await client.query('BEGIN');
    try {
      const brRes = await client.query('SELECT id FROM public.branch LIMIT 1');
      const branchId = brRes.rows[0].id;
      const acct1119 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1119'")).rows[0].id;
      const acct1111 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1111'")).rows[0].id;

      await insertSimJournal(client, branchId, 'v_test_susp', 'V-SUSP-001', '2024-06-15', [
        { accountId: acct1119, debit: 500, credit: 0 },
        { accountId: acct1111, debit: 0, credit: 500 },
      ]);

      const diag6D = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' }, client);
      const suspBlock = diag6D.blocking_checks.find(c => c.id === 'GATE_SUSPENSE_CLEARED');
      assert(!!suspBlock, 'GATE_SUSPENSE_CLEARED blocks close when Account 1119 has non-zero balance');
      assert(suspBlock?.details?.uncleared_balance === 500, 'Uncleared balance ₹500 accurately captured');
    } finally {
      await client.query('ROLLBACK');
    }

    // 6E: Uncleared Deposit in Transit 1118
    await client.query('BEGIN');
    try {
      const brRes = await client.query('SELECT id FROM public.branch LIMIT 1');
      const branchId = brRes.rows[0].id;
      const acct1118 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1118'")).rows[0].id;
      const acct1111 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1111'")).rows[0].id;

      await insertSimJournal(client, branchId, 'v_test_dit', 'V-DIT-001', '2024-06-15', [
        { accountId: acct1118, debit: 750, credit: 0 },
        { accountId: acct1111, debit: 0, credit: 750 },
      ]);

      const diag6E = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' }, client);
      const transitBlock = diag6E.blocking_checks.find(c => c.id === 'GATE_TRANSIT_CLEARED');
      assert(!!transitBlock, 'GATE_TRANSIT_CLEARED blocks close when Account 1118 has non-zero balance');
      assert(transitBlock?.details?.uncleared_balance === 750, 'Uncleared transit balance ₹750 accurately captured');
    } finally {
      await client.query('ROLLBACK');
    }

    // 6F: Warning: Gateway Clearing 1113 & COD 1122
    await client.query('BEGIN');
    try {
      const brRes = await client.query('SELECT id FROM public.branch LIMIT 1');
      const branchId = brRes.rows[0].id;
      const acct1113 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1113'")).rows[0].id;
      const acct1122 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1122'")).rows[0].id;
      const acct1111 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1111'")).rows[0].id;

      await insertSimJournal(client, branchId, 'v_test_warn', 'V-WARN-001', '2024-06-15', [
        { accountId: acct1113, debit: 800, credit: 0 },
        { accountId: acct1122, debit: 400, credit: 0 },
        { accountId: acct1111, debit: 0, credit: 1200 },
      ]);

      const diag6F = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' }, client);
      const gwWarn = diag6F.warnings.find(w => w.id === 'WARN_GATEWAY_CLEARING');
      const codWarn = diag6F.warnings.find(w => w.id === 'WARN_UNDEPOSITED_COD');
      assert(!!gwWarn, 'WARN_GATEWAY_CLEARING raised for open gateway settlement balance');
      assert(!!codWarn, 'WARN_UNDEPOSITED_COD raised for open driver cash / undeposited COD');
    } finally {
      await client.query('ROLLBACK');
    }

    // 6G: Nominal Profit Computation & Proposed Closing Entries
    await client.query('BEGIN');
    try {
      const brRes = await client.query('SELECT id FROM public.branch LIMIT 1');
      const branchId = brRes.rows[0].id;
      const acct4110 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '4110'")).rows[0].id; // Revenue
      const acct4190 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '4190'")).rows[0].id; // Sales return
      const acct5210 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '5210'")).rows[0].id; // Rent Expense
      const acct5190 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '5190'")).rows[0].id; // Purchase discount
      const acct1111 = (await client.query("SELECT id FROM public.accounting_account WHERE code = '1111'")).rows[0].id; // Cash

      // Post revenue: Cr 4110 ₹50,000, Dr 1111 ₹50,000
      await insertSimJournal(client, branchId, 'v_test_rev', 'V-REV-001', '2024-06-15', [
        { accountId: acct4110, debit: 0, credit: 50000 },
        { accountId: acct1111, debit: 50000, credit: 0 },
      ]);

      // Post sales return: Dr 4190 ₹2,000, Cr 1111 ₹2,000
      await insertSimJournal(client, branchId, 'v_test_ret', 'V-RET-001', '2024-06-16', [
        { accountId: acct4190, debit: 2000, credit: 0 },
        { accountId: acct1111, debit: 0, credit: 2000 },
      ]);

      // Post expense: Dr 5210 ₹20,000, Cr 1111 ₹20,000
      await insertSimJournal(client, branchId, 'v_test_exp', 'V-EXP-001', '2024-06-17', [
        { accountId: acct5210, debit: 20000, credit: 0 },
        { accountId: acct1111, debit: 0, credit: 20000 },
      ]);

      // Post purchase discount: Cr 5190 ₹1,000, Dr 1111 ₹1,000
      await insertSimJournal(client, branchId, 'v_test_disc', 'V-DISC-001', '2024-06-18', [
        { accountId: acct5190, debit: 0, credit: 1000 },
        { accountId: acct1111, debit: 1000, credit: 0 },
      ]);

      const diag6G = await PeriodCloseService.runPreCloseDiagnostics({ fiscal_year: 'FY2425' }, client);

      assert(diag6G.summary.gross_revenue === 50000, `Gross revenue = ₹50,000 (actual: ${diag6G.summary.gross_revenue})`);
      assert(diag6G.summary.gross_expenses === 20000, `Gross expenses = ₹20,000 (actual: ${diag6G.summary.gross_expenses})`);

      // Net revenue = 50000 - 2000 = 48000
      // Net expenses = 20000 - 1000 = 19000
      // Net profit = 48000 - 19000 = 29000
      assert(diag6G.summary.projected_net_profit === 29000, `Projected Net Profit = ₹29,000 (actual: ${diag6G.summary.projected_net_profit})`);

      // Proposed closing action checks
      const line4110 = diag6G.nominal_accounts.revenues.find(a => a.code === '4110');
      assert(line4110?.proposed_action === 'DEBIT' && line4110?.closing_amount === 50000, '4110 proposed action = DEBIT ₹50,000 (to zero credit balance)');

      const line4190 = diag6G.nominal_accounts.revenues.find(a => a.code === '4190');
      assert(line4190?.proposed_action === 'CREDIT' && line4190?.closing_amount === 2000, '4190 proposed action = CREDIT ₹2,000 (to zero debit balance)');

      const line5210 = diag6G.nominal_accounts.expenses.find(a => a.code === '5210');
      assert(line5210?.proposed_action === 'CREDIT' && line5210?.closing_amount === 20000, '5210 proposed action = CREDIT ₹20,000 (to zero debit balance)');

      const line5190 = diag6G.nominal_accounts.expenses.find(a => a.code === '5190');
      assert(line5190?.proposed_action === 'DEBIT' && line5190?.closing_amount === 1000, '5190 proposed action = DEBIT ₹1,000 (to zero credit balance)');

      // Projected equity transition
      assert(diag6G.projected_equity.projected_retained_earnings_3210 === 29000, 'Projected 3210 Retained Earnings incorporates projected net profit ₹29,000');
      assert(diag6G.projected_equity.current_dynamic_3220 === 29000, 'Current dynamic 3220 reflects unclosed P&L ₹29,000');
      assert(diag6G.projected_equity.projected_dynamic_3220 === 0, 'Projected dynamic 3220 resets to ₹0.00 after simulated close');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7: INVARIANTS & POLICIES CHECK
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 7: INVARIANTS & POLICIES CHECK ---');
    const cakeCheck = baselineDiag.informational.find(i => i.id === 'INFO_CAKE_AVAILABILITY_RULE');
    assert(!!cakeCheck, 'Critical Cake Rule is explicitly declared in pre-close diagnostics');

    const profitInfo = baselineDiag.informational.find(i => i.id === 'INFO_PROJECTED_PROFIT');
    assert(!!profitInfo, 'INFO_PROJECTED_PROFIT is included in informational checks');

    const equityInfo = baselineDiag.informational.find(i => i.id === 'INFO_EQUITY_TRANSITION');
    assert(!!equityInfo, 'INFO_EQUITY_TRANSITION is included in informational checks');

    const obOffsetInfo = baselineDiag.informational.find(i => i.id === 'INFO_OPENING_BALANCE_EQUITY');
    assert(!!obOffsetInfo, 'INFO_OPENING_BALANCE_EQUITY confirms 3300 permanence');

    // Confirm that proposed design toggles are NOT active or polluting Step 1
    const pcloseCode = fs.readFileSync(path.join(__dirname, '../src/lib/services/period-close.service.ts'), 'utf8');
    assert(!pcloseCode.includes('close_drawings_to_retained_earnings'), 'close_drawings_to_retained_earnings is NOT silently active in Step 1');
    assert(!pcloseCode.includes('exclude_closing_vouchers'), 'exclude_closing_vouchers is NOT silently active in Step 1');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8: POST-TEST POSTGRESQL BASELINE AUDIT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 8: POST-TEST POSTGRESQL BASELINE AUDIT ---');
    const [v1, j1, l1, p1, s1, accts1, orders1, pay1, locks1] = await Promise.all([
      client.query('SELECT count(*) FROM public.accounting_voucher'),
      client.query('SELECT count(*) FROM public.accounting_journal_entry'),
      client.query('SELECT count(*) FROM public.accounting_journal_line'),
      client.query('SELECT count(*) FROM public.accounting_fiscal_period'),
      client.query("SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%'"),
      client.query('SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL'),
      client.query('SELECT count(*) FROM public.order WHERE deleted_at IS NULL'),
      client.query('SELECT count(*) FROM public.payment_transaction WHERE deleted_at IS NULL'),
      client.query("SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid()")
    ]);

    assert(parseInt(v1.rows[0].count, 10) === 0, `Post-test vouchers = 0 (actual: ${v1.rows[0].count})`);
    assert(parseInt(j1.rows[0].count, 10) === 0, `Post-test journal entries = 0 (actual: ${j1.rows[0].count})`);
    assert(parseInt(l1.rows[0].count, 10) === 0, `Post-test journal lines = 0 (actual: ${l1.rows[0].count})`);
    assert(parseInt(p1.rows[0].count, 10) === 0, `Post-test fiscal periods = 0 (actual: ${p1.rows[0].count})`);
    assert(parseInt(s1.rows[0].count, 10) === 0, `Post-test accounting settings = 0 (actual: ${s1.rows[0].count})`);
    assert(parseInt(accts1.rows[0].count, 10) === 99, `Post-test active CoA = 99 (actual: ${accts1.rows[0].count})`);
    assert(parseInt(orders1.rows[0].count, 10) === 173, `Post-test orders = 173 (actual: ${orders1.rows[0].count})`);
    assert(parseInt(pay1.rows[0].count, 10) === 53, `Post-test payments = 53 (actual: ${pay1.rows[0].count})`);
    assert(parseInt(locks1.rows[0].count, 10) === 0, `Active competing connections = 0 (actual: ${locks1.rows[0].count})`);

  } catch (err) {
    console.error('UNHANDLED TEST RUNNER ERROR:', err);
    failCount++;
    failures.push(err.message || String(err));
  } finally {
    await client.end();
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED:      ${passCount}`);
  console.log(`FAILED:      ${failCount}`);
  console.log('══════════════════════════════════════════════════════════════════');

  if (failCount > 0) {
    console.error('\nFAILURES:');
    for (const f of failures) {
      console.error(` - ${f}`);
    }
    process.exit(1);
  } else {
    console.log('\nSTATUS: ALL PHASE 5A.6 STEP 1 TESTS PASSED PERFECTLY 🔒');
    process.exit(0);
  }
}

runTests();
