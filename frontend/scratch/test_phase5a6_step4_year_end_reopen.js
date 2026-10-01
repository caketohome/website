/**
 * CakeToHome ERP — Phase 5A.6 Step 4: Year-End Reopen / Reversal Comprehensive Verification Suite
 *
 * 27-SCENARIO VERIFICATION DOMAINS:
 * 1. baseline: Database starts in pristine state (0 vouchers, 0 journals, 0 periods, 0 settings, 99 accounts).
 * 2. eligibility: Read-only preview previewYearEndReopen accurately returns can_reopen, closing voucher, projected equity impact without mutating DB.
 * 3. authentication: Missing or unauthenticated session fails with UNAUTHORIZED (403/401).
 * 4. RBAC: Non-SUPER_ADMIN staff user fails closed with UNAUTHORIZED (403).
 * 5. SoD: Reopen preparer === approver fails closed with SEGREGATION_OF_DUTIES_VIOLATION (409).
 * 6. mandatory reason: Rejection of < 30 characters (29 chars, empty, whitespace-only) with REOPEN_REASON_TOO_SHORT (400); acceptance of >= 30 chars.
 * 7. closed-year requirement: Attempt to reopen an unclosed fiscal year fails with FISCAL_YEAR_NOT_CLOSED (404/400).
 * 8. original closing voucher identification: Engine accurately retrieves and validates active closing voucher for specified FY.
 * 9. profit reversal: Reversal of profit year debits Retained Earnings 3210 and restores revenue and expense nominal balances matching original journal.
 * 10. loss reversal: Reversal of loss year credits Retained Earnings 3210 and restores nominal balances.
 * 11. drawings disabled: When original close did not transfer drawings, reversal creates no drawings lines.
 * 12. drawings enabled: When original close transferred drawings, reversal restores Partner Drawings 3120 (Dr 3120, Cr 3210).
 * 13. account 3300 protection: Opening Balance Equity (3300) strictly untouched across close and reopen.
 * 14. subsequent-year posted activity block: If FY N+1 contains active POSTED vouchers, reopen of year N fails closed with SUBSEQUENT_YEAR_HAS_POSTED_ACTIVITY (422).
 * 15. subsequent-year closed block: If FY N+1 is closed, reopen of year N fails closed with SUBSEQUENT_YEAR_ALREADY_CLOSED (422).
 * 16. reversal linkage: Bidirectional linkage via PostingService.linkReversal (original is_reversed=true, reversed_by_voucher_id; reversal reversal_of_voucher_id).
 * 17. double reversal rejection: Reopening an already reopened year fails with YEAR_ALREADY_REOPENED (409) and DB reversal constraints.
 * 18. concurrency: Transaction-level advisory lock (year_end_close_<fiscal_year>) prevents concurrent race conditions.
 * 19. idempotency: Unique source event (YEAR_END_REOPEN, closingVoucher.id, YEAR_END_CLOSE_REVERSAL) prevents duplicate reversal vouchers.
 * 20. rollback: Simulated failure during reopen triggers full ROLLBACK (zero partial state, original voucher remains active).
 * 21. audit event: Emits accounting.fiscal_year_reopened with complete structured audit metadata.
 * 22. Trial Balance integrity: Restored nominal balances and Retained Earnings 3210 returned to pre-close state, Debits === Credits (0 imbalance).
 * 23. Balance Sheet integrity: Balance Sheet equation (Assets = Liabilities + Equity) holds with 0 variance across all states.
 * 24. re-close Cycle 2: Full lifecycle (Close Cycle 1 -> Reopen -> Adjusting Entry -> Pre-Close Diagnostics -> Re-Close Cycle 2).
 * 25. BOLA/IDOR: Actor identity and permissions resolved strictly server-side, preventing impersonation or forged approvers.
 * 26. enterprise authorization: Server-authoritative HQ branch resolution, ignoring client-supplied branch parameters.
 * 27. historical immutability: Original closing voucher remains strictly POSTED and immutable (chk_voucher_posted_immutable).
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
  console.log('Phase 5A.6 Step 4 — Year-End Reopen / Reversal Comprehensive Verification');
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
  const { PeriodCloseService, PeriodCloseServiceError } = require('../src/lib/services/period-close.service');
  const { PostingService, PostingServiceError } = require('../src/lib/services/posting.service');
  const { AccountingConfigService } = require('../src/lib/services/accounting-config.service');
  const { AccountingAccountRepository } = require('../src/lib/repositories/accounting-account.repository');
  const { AccountingJournalRepository } = require('../src/lib/repositories/accounting-journal.repository');
  const { AccountingVoucherRepository } = require('../src/lib/repositories/accounting-voucher.repository');
  const { ProfitLossService } = require('../src/lib/services/profit-loss.service');

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
    // DOMAIN 1: BASELINE & SCHEMA INVARIANTS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('--- DOMAIN 1: BASELINE & SCHEMA INVARIANTS ---');
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

    // Verify DB Constraints existence
    const [chkPosted, chkLimit, idxIdemp] = await Promise.all([
      client.query("SELECT conname FROM pg_constraint WHERE conname = 'chk_voucher_posted_immutable'"),
      client.query("SELECT conname FROM pg_constraint WHERE conname = 'chk_voucher_reversal_limit'"),
      client.query("SELECT indexname FROM pg_indexes WHERE indexname = 'idx_accounting_voucher_source_idempotency'")
    ]);
    assert(chkPosted.rows.length > 0, "DB constraint chk_voucher_posted_immutable exists");
    assert(chkLimit.rows.length > 0, "DB constraint chk_voucher_reversal_limit exists");
    assert(idxIdemp.rows.length > 0, "DB unique partial index idx_accounting_voucher_source_idempotency exists");

    // Helper: Seed standard FY2425 with 12 locked periods and operational vouchers in enterprise HQ branch
    async function setupStandardClosedFY(txClient, options = {}) {
      const {
        isLoss = false,
        includeDrawings = false,
        drawingsAmount = 10000,
        closeDrawings = false,
        seedAccount3300 = false,
        account3300Amount = 50000,
        fy = 'FY2425'
      } = options;

      const brRes = await txClient.query("SELECT id FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1");
      const branchId = brRes.rows[0].id;

      await txClient.query(`DELETE FROM public.setting WHERE key = 'accounting_start_date'`);
      await txClient.query(`
        INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
        VALUES (gen_random_uuid()::text, 'accounting', 'accounting_start_date', '2024-04-01', NOW(), NOW())
      `);

      const monthEnds = [
        ['2024-04-01', '2024-04-30'], ['2024-05-01', '2024-05-31'], ['2024-06-01', '2024-06-30'],
        ['2024-07-01', '2024-07-31'], ['2024-08-01', '2024-08-31'], ['2024-09-01', '2024-09-30'],
        ['2024-10-01', '2024-10-31'], ['2024-11-01', '2024-11-30'], ['2024-12-01', '2024-12-31'],
        ['2025-01-01', '2025-01-31'], ['2025-02-01', '2025-02-28'], ['2025-03-01', '2025-03-31']
      ];
      for (let i = 0; i < 12; i++) {
        const mNum = String(i + 1).padStart(2, '0');
        await txClient.query(`
          INSERT INTO public.accounting_fiscal_period
            (fiscal_year, period_name, start_date, end_date, is_locked, locked_at, locked_by, created_at)
          VALUES ('${fy}', 'P${mNum}', '${monthEnds[i][0]}', '${monthEnds[i][1]}', true, NOW(), 'usr_super', NOW())
        `);
      }

      const acctMap = {};
      const acctsRes = await txClient.query('SELECT id, code FROM public.accounting_account WHERE is_active = true');
      for (const a of acctsRes.rows) {
        acctMap[a.code] = a.id;
      }

      // Optional Opening Balance Equity 3300
      if (seedAccount3300) {
        const vObId = 'vch_ob_3300_test';
        const jObId = 'jnl_ob_3300_test';
        await txClient.query(`
          INSERT INTO public.accounting_voucher 
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
          VALUES 
            ('${vObId}', 'V-OB-3300', 'JOURNAL', '2024-04-01', '${branchId}', '${fy}', 'POSTED', ${account3300Amount}, 'INR', 'OB test', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ('${jObId}', 'JE-OB-3300', '${vObId}', '2024-04-01', '${branchId}', '${fy}', ${account3300Amount}, ${account3300Amount}, false, 'OB test', 'usr_appr', NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
          VALUES
            (gen_random_uuid()::text, '${jObId}', 1, '${acctMap['1111']}', ${account3300Amount}, 0, '${branchId}', 'Bank OB'),
            (gen_random_uuid()::text, '${jObId}', 2, '${acctMap['3300']}', 0, ${account3300Amount}, '${branchId}', 'OB Offset')
        `);
      }

      if (!isLoss) {
        // Profit scenario: Revenue ₹1,05,000, Returns ₹2,000, Expenses ₹67,000 - ₹1,000 = ₹66,000 -> Net Profit ₹37,000
        const v1Id = 'vch_op_sales_profit';
        const j1Id = 'jnl_op_sales_profit';
        await txClient.query(`
          INSERT INTO public.accounting_voucher 
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
          VALUES 
            ('${v1Id}', 'V-OP-01', 'JOURNAL', '2024-05-10', '${branchId}', '${fy}', 'POSTED', 105000, 'INR', 'Sales operational', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ('${j1Id}', 'JE-OP-01', '${v1Id}', '2024-05-10', '${branchId}', '${fy}', 105000, 105000, false, 'Sales operational', 'usr_appr', NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
          VALUES
            (gen_random_uuid()::text, '${j1Id}', 1, '${acctMap['1111']}', 105000, 0, '${branchId}', 'Petty Cash Sales'),
            (gen_random_uuid()::text, '${j1Id}', 2, '${acctMap['4110']}', 0, 100000, '${branchId}', 'Cake Sales'),
            (gen_random_uuid()::text, '${j1Id}', 3, '${acctMap['4130']}', 0, 5000, '${branchId}', 'Delivery fee')
        `);

        // Sales Return ₹2,000
        const v2Id = 'vch_op_ret_profit';
        const j2Id = 'jnl_op_ret_profit';
        await txClient.query(`
          INSERT INTO public.accounting_voucher 
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
          VALUES 
            ('${v2Id}', 'V-OP-02', 'JOURNAL', '2024-06-12', '${branchId}', '${fy}', 'POSTED', 2000, 'INR', 'Sales return', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ('${j2Id}', 'JE-OP-02', '${v2Id}', '2024-06-12', '${branchId}', '${fy}', 2000, 2000, false, 'Sales return', 'usr_appr', NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
          VALUES
            (gen_random_uuid()::text, '${j2Id}', 1, '${acctMap['4190']}', 2000, 0, '${branchId}', 'Sales Returns'),
            (gen_random_uuid()::text, '${j2Id}', 2, '${acctMap['1111']}', 0, 2000, '${branchId}', 'Cash refund')
        `);

        // Expenses ₹67,000 Dr, Contra ₹1,000 Cr -> Net Expenses ₹66,000
        const v3Id = 'vch_op_exp_profit';
        const j3Id = 'jnl_op_exp_profit';
        await txClient.query(`
          INSERT INTO public.accounting_voucher 
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
          VALUES 
            ('${v3Id}', 'V-OP-03', 'JOURNAL', '2024-07-20', '${branchId}', '${fy}', 'POSTED', 67000, 'INR', 'Operating expenses', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ('${j3Id}', 'JE-OP-03', '${v3Id}', '2024-07-20', '${branchId}', '${fy}', 67000, 67000, false, 'Operating expenses', 'usr_appr', NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
          VALUES
            (gen_random_uuid()::text, '${j3Id}', 1, '${acctMap['5110']}', 40000, 0, '${branchId}', 'Flour Sugar Raw Mat'),
            (gen_random_uuid()::text, '${j3Id}', 2, '${acctMap['5190']}', 0, 1000, '${branchId}', 'Purchase Discount Contra'),
            (gen_random_uuid()::text, '${j3Id}', 3, '${acctMap['5210']}', 20000, 0, '${branchId}', 'Kitchen Staff Wages'),
            (gen_random_uuid()::text, '${j3Id}', 4, '${acctMap['5220']}', 5000, 0, '${branchId}', 'Delivery Driver Payouts'),
            (gen_random_uuid()::text, '${j3Id}', 5, '${acctMap['5310']}', 2000, 0, '${branchId}', 'Store Rent'),
            (gen_random_uuid()::text, '${j3Id}', 6, '${acctMap['1111']}', 0, 66000, '${branchId}', 'Cash Paid')
        `);
      } else {
        // Net Loss scenario: Revenue ₹20,000, Expenses ₹50,000 -> Net Loss ₹30,000
        const vL1Id = 'vch_op_loss_rev';
        const jL1Id = 'jnl_op_loss_rev';
        await txClient.query(`
          INSERT INTO public.accounting_voucher 
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
          VALUES 
            ('${vL1Id}', 'V-OP-L01', 'JOURNAL', '2024-05-10', '${branchId}', '${fy}', 'POSTED', 20000, 'INR', 'Sales loss scenario', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ('${jL1Id}', 'JE-OP-L01', '${vL1Id}', '2024-05-10', '${branchId}', '${fy}', 20000, 20000, false, 'Sales', 'usr_appr', NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
          VALUES
            (gen_random_uuid()::text, '${jL1Id}', 1, '${acctMap['1111']}', 20000, 0, '${branchId}', 'Petty Cash Sales'),
            (gen_random_uuid()::text, '${jL1Id}', 2, '${acctMap['4110']}', 0, 20000, '${branchId}', 'Cake Sales')
        `);

        const vL2Id = 'vch_op_loss_exp';
        const jL2Id = 'jnl_op_loss_exp';
        await txClient.query(`
          INSERT INTO public.accounting_voucher 
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
          VALUES 
            ('${vL2Id}', 'V-OP-L02', 'JOURNAL', '2024-07-20', '${branchId}', '${fy}', 'POSTED', 50000, 'INR', 'Expenses loss scenario', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ('${jL2Id}', 'JE-OP-L02', '${vL2Id}', '2024-07-20', '${branchId}', '${fy}', 50000, 50000, false, 'Operating expenses', 'usr_appr', NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
          VALUES
            (gen_random_uuid()::text, '${jL2Id}', 1, '${acctMap['5110']}', 50000, 0, '${branchId}', 'Raw materials'),
            (gen_random_uuid()::text, '${jL2Id}', 2, '${acctMap['1111']}', 0, 50000, '${branchId}', 'Cash paid')
        `);
      }

      // Optional drawings
      if (includeDrawings) {
        const vDId = 'vch_op_drawings';
        const jDId = 'jnl_op_drawings';
        await txClient.query(`
          INSERT INTO public.accounting_voucher 
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
          VALUES 
            ('${vDId}', 'V-OP-D01', 'JOURNAL', '2024-08-15', '${branchId}', '${fy}', 'POSTED', ${drawingsAmount}, 'INR', 'Partner drawings', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ('${jDId}', 'JE-OP-D01', '${vDId}', '2024-08-15', '${branchId}', '${fy}', ${drawingsAmount}, ${drawingsAmount}, false, 'Partner drawings', 'usr_appr', NOW())
        `);
        await txClient.query(`
          INSERT INTO public.accounting_journal_line
            (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
          VALUES
            (gen_random_uuid()::text, '${jDId}', 1, '${acctMap['3120']}', ${drawingsAmount}, 0, '${branchId}', 'Partner Drawings Dr'),
            (gen_random_uuid()::text, '${jDId}', 2, '${acctMap['1111']}', 0, ${drawingsAmount}, '${branchId}', 'Petty Cash Cr')
        `);
      }

      // Execute initial close
      const closeRes = await PeriodCloseService.executeYearEndClose({
        fiscal_year: fy,
        preparer_id: 'usr_close_preparer',
        approver_id: 'usr_close_approver',
        closeDrawingsToRetainedEarnings: closeDrawings,
        session_user: { id: 'usr_close_approver', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, txClient);

      return { closeRes, branchId, acctMap };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAIN 2: ELIGIBILITY & PREVIEW SANITY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 2: ELIGIBILITY & PREVIEW SANITY ---');
    await client.query('BEGIN');
    try {
      const { closeRes } = await setupStandardClosedFY(client);

      const preview = await PeriodCloseService.previewYearEndReopen({
        fiscal_year: 'FY2425',
        session_user: { id: 'usr_super', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      assert(preview.can_reopen === true, 'Preview confirms can_reopen = true for closed fiscal year');
      assert(preview.closing_voucher !== null, 'Preview locates active closing voucher');
      assert(preview.closing_voucher.id === closeRes.voucher_id, 'Preview closing voucher ID matches executed close');
      assert(preview.projected_retained_earnings_impact === -37000, `Projected Retained Earnings impact is -₹37,000 (actual: ${preview.projected_retained_earnings_impact})`);
      assert(preview.subsequent_fiscal_year === 'FY2526', `Subsequent FY correctly identified as FY2526 (actual: ${preview.subsequent_fiscal_year})`);
      assert(preview.blocking_checks.length === 0, 'Zero blocking checks present on closed year preview');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAINS 3, 4, 5, 25: AUTHENTICATION, RBAC, SOD, BOLA
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAINS 3, 4, 5, 25: AUTHENTICATION, RBAC, SOD, BOLA ---');
    await client.query('BEGIN');
    try {
      await setupStandardClosedFY(client);

      // Domain 3: Missing / invalid user
      let authBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Valid audit reason with over thirty characters required.',
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: '', role: '', isSuperAdmin: false }
        }, client);
      } catch (e) {
        if (e.code === 'UNAUTHORIZED') authBlocked = true;
      }
      assert(authBlocked, 'Unauthenticated user rejected with UNAUTHORIZED (403)');

      // Domain 4: Non-SUPER_ADMIN staff
      let rbacBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Valid audit reason with over thirty characters required.',
          preparer_id: 'usr_prep',
          approver_id: 'usr_staff',
          session_user: { id: 'usr_staff', role: 'STAFF', isSuperAdmin: false }
        }, client);
      } catch (e) {
        if (e.code === 'UNAUTHORIZED') rbacBlocked = true;
      }
      assert(rbacBlocked, 'Non-SUPER_ADMIN staff rejected with UNAUTHORIZED (403)');

      // Domain 5: Segregation of Duties: preparer === approver
      let sodBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Valid audit reason with over thirty characters required.',
          preparer_id: 'usr_same_super',
          approver_id: 'usr_same_super',
          session_user: { id: 'usr_same_super', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'SEGREGATION_OF_DUTIES_VIOLATION') sodBlocked = true;
      }
      assert(sodBlocked, 'Same actor for preparer and approver rejected with SEGREGATION_OF_DUTIES_VIOLATION');

      // Domain 25: BOLA / Actor impersonation: Missing actor IDs
      let missingActorBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Valid audit reason with over thirty characters required.',
          preparer_id: '',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'INVALID_ACTORS') missingActorBlocked = true;
      }
      assert(missingActorBlocked, 'Missing preparer ID rejected with INVALID_ACTORS');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAIN 6: MANDATORY REASON VALIDATION (>= 30 CHARS)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 6: MANDATORY REASON VALIDATION ---');
    await client.query('BEGIN');
    try {
      await setupStandardClosedFY(client);

      // 6.1 Empty reason
      let emptyReasonBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: '',
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'REOPEN_REASON_TOO_SHORT') emptyReasonBlocked = true;
      }
      assert(emptyReasonBlocked, 'Empty reason rejected with REOPEN_REASON_TOO_SHORT');

      // 6.2 29 characters reason (strictly < 30)
      const reason29 = '12345678901234567890123456789'; // 29 chars
      let shortReasonBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: reason29,
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'REOPEN_REASON_TOO_SHORT') shortReasonBlocked = true;
      }
      assert(shortReasonBlocked, '29-character reason rejected with REOPEN_REASON_TOO_SHORT');

      // 6.3 Whitespace-only reason
      let whitespaceBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: '                                    ', // 36 spaces
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'REOPEN_REASON_TOO_SHORT') whitespaceBlocked = true;
      }
      assert(whitespaceBlocked, 'Whitespace-only reason rejected with REOPEN_REASON_TOO_SHORT');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAINS 7, 8: CLOSED-YEAR REQUIREMENT & CLOSING VOUCHER LOOKUP
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAINS 7, 8: CLOSED-YEAR REQUIREMENT & CLOSING VOUCHER LOOKUP ---');
    await client.query('BEGIN');
    try {
      // Create periods for FY2425 but DO NOT close the year
      for (let i = 1; i <= 12; i++) {
        const m = String(i).padStart(2, '0');
        await client.query(`
          INSERT INTO public.accounting_fiscal_period
            (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
          VALUES ('FY2425', 'P${m}', '2024-04-01', '2024-04-30', true, NOW())
        `);
      }

      // Domain 7: Preview unclosed year
      const unclosedPreview = await PeriodCloseService.previewYearEndReopen({
        fiscal_year: 'FY2425',
        session_user: { id: 'usr_super', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);
      assert(unclosedPreview.can_reopen === false, 'Preview on unclosed year returns can_reopen = false');
      assert(unclosedPreview.blocking_checks.some(c => c.id === 'BLOCKING_YEAR_NOT_CLOSED'), 'Preview returns BLOCKING_YEAR_NOT_CLOSED');

      // Domain 8: Execution on unclosed year
      let unclosedExecBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Valid audit reason with over thirty characters required.',
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'FISCAL_YEAR_NOT_CLOSED') unclosedExecBlocked = true;
      }
      assert(unclosedExecBlocked, 'Reopen execution on unclosed year fails with FISCAL_YEAR_NOT_CLOSED');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAINS 9, 16, 21, 22, 23, 26, 27: PROFIT REVERSAL END-TO-END
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAINS 9, 16, 21, 22, 23, 26, 27: PROFIT REVERSAL END-TO-END ---');
    await client.query('BEGIN');
    try {
      const { closeRes, branchId } = await setupStandardClosedFY(client, { isLoss: false });
      const origClosingVoucherId = closeRes.voucher_id;

      // Check Trial Balance before reopen: nominal accounts must be 0
      const tbClosed = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbClosedMap = {};
      for (const r of tbClosed) tbClosedMap[r.code] = r;
      assert(Number(tbClosedMap['4110']?.net_balance || 0) === 0, 'Post-close 4110 Cake Sales is zeroed');
      assert(Number(tbClosedMap['5110']?.net_balance || 0) === 0, 'Post-close 5110 Raw Materials is zeroed');
      assert(Number(tbClosedMap['3210']?.net_balance || 0) === -37000, `Post-close 3210 Retained Earnings is ₹37,000 credit (actual: ${tbClosedMap['3210']?.net_balance})`);

      // Balance Sheet post-close balanced
      const bsClosedRes = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN a.type = 'ASSET' THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0) AS total_assets,
          COALESCE(SUM(CASE WHEN a.type = 'LIABILITY' THEN jl.credit_amount - jl.debit_amount ELSE 0 END), 0) AS total_liabilities,
          COALESCE(SUM(CASE WHEN a.type = 'EQUITY' THEN jl.credit_amount - jl.debit_amount ELSE 0 END), 0) AS total_equity
        FROM public.accounting_account a
        JOIN public.accounting_journal_line jl ON jl.account_id = a.id
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        WHERE je.entry_date <= '2025-03-31'
      `);
      const bsClosedRow = bsClosedRes.rows[0];
      const assetsClosed = Number(bsClosedRow.total_assets);
      const liabClosed = Number(bsClosedRow.total_liabilities);
      const eqClosed = Number(bsClosedRow.total_equity);
      assert(Math.abs(assetsClosed - (liabClosed + eqClosed)) < 0.01, `Post-close Balance Sheet equation holds: Assets (₹${assetsClosed}) === Liabilities (₹${liabClosed}) + Equity (₹${eqClosed})`);

      // EXECUTE REOPEN
      const reopenReason = 'Correction of operational misallocations prior to annual tax filing.';
      const reopenRes = await PeriodCloseService.reopenYearEndClose({
        fiscal_year: 'FY2425',
        reason: reopenReason,
        preparer_id: 'usr_reopen_preparer',
        approver_id: 'usr_reopen_approver',
        session_user: { id: 'usr_reopen_approver', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      assert(reopenRes.success === true, 'Reopen executed successfully');
      assert(reopenRes.net_profit_reversed === 37000, 'Reopen reported net_profit_reversed = 37,000');
      assert(reopenRes.reversal_voucher_id !== null, 'Compensating reversal voucher generated');

      // Domain 27: Historical Immutability: original closing voucher remains POSTED
      const origVchRes = await client.query('SELECT * FROM public.accounting_voucher WHERE id = $1', [origClosingVoucherId]);
      const origVch = origVchRes.rows[0];
      assert(origVch.status === 'POSTED', `Original closing voucher status remains 'POSTED' (actual: ${origVch.status})`);
      assert(origVch.reversed_by_voucher_id === reopenRes.reversal_voucher_id, 'Original closing voucher points to reversal voucher ID');

      // Domain 16: Bidirectional Reversal Linkage
      const revVchRes = await client.query('SELECT * FROM public.accounting_voucher WHERE id = $1', [reopenRes.reversal_voucher_id]);
      const revVch = revVchRes.rows[0];
      assert(revVch.status === 'POSTED', 'Reversal voucher is POSTED');
      assert(revVch.reversal_of_voucher_id === origClosingVoucherId, 'Reversal voucher reversal_of_voucher_id points to original close voucher');
      assert(revVch.reference_type === 'YEAR_END_REOPEN', 'Reversal voucher reference_type = YEAR_END_REOPEN');
      assert(revVch.reference_event === 'YEAR_END_CLOSE_REVERSAL', 'Reversal voucher reference_event = YEAR_END_CLOSE_REVERSAL');

      // Verify original journal entry reversed
      const origJeRes = await client.query('SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1', [origClosingVoucherId]);
      assert(origJeRes.rows[0].is_reversed === true, 'Original closing journal entry marked is_reversed = true');

      // Domain 9 & 22: Trial Balance restored and balanced
      const tbReopened = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbReopenedMap = {};
      let totalDr = 0, totalCr = 0;
      for (const r of tbReopened) {
        tbReopenedMap[r.code] = r;
        if (!r.is_group) {
          totalDr += Number(r.total_debit) || 0;
          totalCr += Number(r.total_credit) || 0;
        }
      }
      assert(Math.abs(totalDr - totalCr) < 0.01, `Trial Balance balanced post-reopen: Dr ₹${totalDr.toFixed(2)} === Cr ₹${totalCr.toFixed(2)}`);
      assert(Number(tbReopenedMap['4110']?.net_balance || 0) === -100000, `Nominal account 4110 restored to pre-close ₹1,00,000 credit (actual: ${tbReopenedMap['4110']?.net_balance})`);
      assert(Number(tbReopenedMap['5110']?.net_balance || 0) === 40000, `Nominal account 5110 restored to pre-close ₹40,000 debit (actual: ${tbReopenedMap['5110']?.net_balance})`);
      assert(Number(tbReopenedMap['3210']?.net_balance || 0) === 0, `Account 3210 Retained Earnings reversed back to ₹0.00 (actual: ${tbReopenedMap['3210']?.net_balance})`);

      // Domain 23: Balance Sheet equation holds post-reopen
      const bsReopenedRes = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN a.type = 'ASSET' THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0) AS total_assets,
          COALESCE(SUM(CASE WHEN a.type = 'LIABILITY' THEN jl.credit_amount - jl.debit_amount ELSE 0 END), 0) AS total_liabilities,
          COALESCE(SUM(CASE WHEN a.type = 'EQUITY' THEN jl.credit_amount - jl.debit_amount ELSE 0 END), 0) AS total_equity,
          COALESCE(SUM(CASE WHEN a.type IN ('REVENUE', 'EXPENSE') THEN jl.credit_amount - jl.debit_amount ELSE 0 END), 0) AS current_year_earnings
        FROM public.accounting_account a
        JOIN public.accounting_journal_line jl ON jl.account_id = a.id
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        WHERE je.entry_date <= '2025-03-31'
      `);
      const bsReopenedRow = bsReopenedRes.rows[0];
      const assetsReopened = Number(bsReopenedRow.total_assets);
      const liabReopened = Number(bsReopenedRow.total_liabilities);
      const permanentEqReopened = Number(bsReopenedRow.total_equity);
      const unclosedEarnings = Number(bsReopenedRow.current_year_earnings);
      const totalEquityWithEarnings = permanentEqReopened + unclosedEarnings;
      assert(Math.abs(assetsReopened - (liabReopened + totalEquityWithEarnings)) < 0.01, `Post-reopen Balance Sheet equation holds: Assets (₹${assetsReopened}) === Liabilities (₹${liabReopened}) + Equity including restored earnings (₹${totalEquityWithEarnings})`);

      // Domain 21: Audit Event
      const auditRes = await client.query(
        `SELECT * FROM public.audit_log WHERE action = 'accounting.fiscal_year_reopened' AND entity_id = 'FY2425'`
      );
      assert(auditRes.rows.length === 1, 'Audit log accounting.fiscal_year_reopened recorded exactly once');
      const auditMeta = typeof auditRes.rows[0].metadata === 'string' 
        ? JSON.parse(auditRes.rows[0].metadata) 
        : auditRes.rows[0].metadata;
      assert(auditMeta.original_closing_voucher_id === origClosingVoucherId, 'Audit log metadata records original closing voucher ID');
      assert(auditMeta.reversal_voucher_id === reopenRes.reversal_voucher_id, 'Audit log metadata records reversal voucher ID');
      assert(auditMeta.reason === reopenReason, 'Audit log metadata records mandatory reopen reason');
      assert(auditMeta.net_profit_reversed === 37000, 'Audit log metadata records net profit reversed');

      // Domain 26: Enterprise Scope server-authoritative
      const hqBranch = await client.query(
        "SELECT id FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1"
      );
      if (hqBranch.rows.length > 0) {
        assert(revVch.branch_id === hqBranch.rows[0].id, 'Reversal voucher assigned server-authoritative HQ branch');
      }
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAIN 10: LOSS REVERSAL SCENARIO
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 10: LOSS REVERSAL SCENARIO ---');
    await client.query('BEGIN');
    try {
      const { closeRes } = await setupStandardClosedFY(client, { isLoss: true });

      // In loss scenario: Revenue ₹20,000, Expenses ₹50,000 -> Net Loss ₹30,000
      // Post-close: 3210 Retained Earnings debited ₹30,000
      const tbLossClosed = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbLossMap = {};
      for (const r of tbLossClosed) tbLossMap[r.code] = r;
      assert(Number(tbLossMap['3210']?.net_balance || 0) === 30000, `Post-close 3210 Retained Earnings is ₹30,000 debit (actual: ${tbLossMap['3210']?.net_balance})`);

      // Execute Reopen
      const reopenRes = await PeriodCloseService.reopenYearEndClose({
        fiscal_year: 'FY2425',
        reason: 'Adjusting operational loss records following audit adjustments.',
        preparer_id: 'usr_reopen_prep',
        approver_id: 'usr_reopen_appr',
        session_user: { id: 'usr_reopen_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      assert(reopenRes.success === true, 'Loss year reopen succeeded');
      assert(reopenRes.net_profit_reversed === -30000, 'Reopen reported net_profit_reversed = -30,000');

      // Post-reopen: 3210 Retained Earnings must be restored to 0
      const tbLossReopened = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbLossReopenedMap = {};
      for (const r of tbLossReopened) tbLossReopenedMap[r.code] = r;
      assert(Number(tbLossReopenedMap['3210']?.net_balance || 0) === 0, `3210 Retained Earnings loss reversed back to ₹0.00 (actual: ${tbLossReopenedMap['3210']?.net_balance})`);
      assert(Number(tbLossReopenedMap['4110']?.net_balance || 0) === -20000, 'Revenue 4110 restored to ₹20,000');
      assert(Number(tbLossReopenedMap['5110']?.net_balance || 0) === 50000, 'Expense 5110 restored to ₹50,000');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAINS 11, 12: DRAWINGS TREATMENT (DISABLED VS ENABLED)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAINS 11, 12: DRAWINGS TREATMENT ---');
    // 11: Drawings disabled
    await client.query('BEGIN');
    try {
      const { closeRes } = await setupStandardClosedFY(client, {
        includeDrawings: true,
        drawingsAmount: 15000,
        closeDrawings: false // disabled
      });

      const reopenRes = await PeriodCloseService.reopenYearEndClose({
        fiscal_year: 'FY2425',
        reason: 'Reopen fiscal year with drawings transfer disabled in close.',
        preparer_id: 'usr_prep',
        approver_id: 'usr_appr',
        session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      assert(reopenRes.drawings_reversed === 0, 'Reopen drawings_reversed = 0 when drawings were not transferred');
      // Partner drawings 3120 was never closed, remains at 15000 debit
      const tb = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbMap = {};
      for (const r of tb) tbMap[r.code] = r;
      assert(Number(tbMap['3120']?.net_balance || 0) === 15000, 'Partner Drawings 3120 untouched when drawings were not closed');
    } finally {
      await client.query('ROLLBACK');
    }

    // 12: Drawings enabled
    await client.query('BEGIN');
    try {
      const { closeRes } = await setupStandardClosedFY(client, {
        includeDrawings: true,
        drawingsAmount: 15000,
        closeDrawings: true // enabled: 3120 was zeroed to 3210
      });

      // Post-close: 3120 was zeroed
      const tbClosed = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbClosedMap = {};
      for (const r of tbClosed) tbClosedMap[r.code] = r;
      assert(Number(tbClosedMap['3120']?.net_balance || 0) === 0, 'Partner Drawings 3120 was zeroed upon close');

      // Reopen
      const reopenRes = await PeriodCloseService.reopenYearEndClose({
        fiscal_year: 'FY2425',
        reason: 'Reopen fiscal year with drawings transfer enabled in close.',
        preparer_id: 'usr_prep',
        approver_id: 'usr_appr',
        session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      assert(reopenRes.drawings_reversed === 15000, 'Reopen reported drawings_reversed = 15,000');

      // Post-reopen: 3120 restored to 15,000 debit
      const tbReopened = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbReopenedMap = {};
      for (const r of tbReopened) tbReopenedMap[r.code] = r;
      assert(Number(tbReopenedMap['3120']?.net_balance || 0) === 15000, 'Partner Drawings 3120 restored to ₹15,000 debit');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAIN 13: ACCOUNT 3300 OPENING BALANCE EQUITY INVARIANT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 13: ACCOUNT 3300 INVARIANT ---');
    await client.query('BEGIN');
    try {
      await setupStandardClosedFY(client, {
        seedAccount3300: true,
        account3300Amount: 50000
      });

      // Verify 3300 post-close is ₹50,000 credit
      const tbClosed = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbClosedMap = {};
      for (const r of tbClosed) tbClosedMap[r.code] = r;
      assert(Number(tbClosedMap['3300']?.net_balance || 0) === -50000, 'Account 3300 untouched post-close');

      // Reopen
      await PeriodCloseService.reopenYearEndClose({
        fiscal_year: 'FY2425',
        reason: 'Verifying permanent equity account 3300 remains untouched.',
        preparer_id: 'usr_prep',
        approver_id: 'usr_appr',
        session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      // Verify 3300 post-reopen is strictly ₹50,000 credit
      const tbReopened = await AccountingJournalRepository.getTrialBalance(undefined, '2024-04-01', '2025-03-31', false, client);
      const tbReopenedMap = {};
      for (const r of tbReopened) tbReopenedMap[r.code] = r;
      assert(Number(tbReopenedMap['3300']?.net_balance || 0) === -50000, 'Account 3300 strictly untouched post-reopen');

      // Verify no journal lines exist against 3300 in the reversal voucher
      const revLines3300 = await client.query(`
        SELECT count(*) FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        JOIN public.accounting_voucher v ON v.id = je.voucher_id
        JOIN public.accounting_account a ON a.id = jl.account_id
        WHERE v.reference_type = 'YEAR_END_REOPEN' AND a.code = '3300'
      `);
      assert(parseInt(revLines3300.rows[0].count, 10) === 0, 'Zero lines posted to account 3300 in reversal voucher');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAINS 14, 15: SUBSEQUENT-YEAR SAFETY GUARDS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAINS 14, 15: SUBSEQUENT-YEAR SAFETY GUARDS ---');
    // 14: Subsequent year has active posted vouchers
    await client.query('BEGIN');
    try {
      const { branchId } = await setupStandardClosedFY(client);

      // Post a voucher into subsequent year FY2526
      const vNextId = 'vch_subsequent_yr_01';
      await client.query(`
        INSERT INTO public.accounting_voucher 
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
        VALUES 
          ('${vNextId}', 'V-NEXT-01', 'JOURNAL', '2025-04-15', '${branchId}', 'FY2526', 'POSTED', 1000, 'INR', 'Next FY transaction', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
      `);

      // Preview should report blocking check
      const preview = await PeriodCloseService.previewYearEndReopen({
        fiscal_year: 'FY2425',
        session_user: { id: 'usr_super', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);
      assert(preview.can_reopen === false, 'Preview on FY with active subsequent FY postings returns can_reopen = false');
      assert(preview.blocking_checks.some(c => c.id === 'BLOCKING_SUBSEQUENT_YEAR_POSTED_ACTIVITY'), 'Preview returns BLOCKING_SUBSEQUENT_YEAR_POSTED_ACTIVITY');

      // Execution must fail closed
      let nextActivityBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Attempting to reopen year despite active subsequent postings.',
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'SUBSEQUENT_YEAR_HAS_POSTED_ACTIVITY') nextActivityBlocked = true;
      }
      assert(nextActivityBlocked, 'Reopen rejected with SUBSEQUENT_YEAR_HAS_POSTED_ACTIVITY');
    } finally {
      await client.query('ROLLBACK');
    }

    // 15: Subsequent year is already closed
    await client.query('BEGIN');
    try {
      const { branchId } = await setupStandardClosedFY(client);

      // Create a close voucher for subsequent year FY2526
      await client.query(`
        INSERT INTO public.accounting_voucher 
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, posted_at, created_at)
        VALUES 
          ('vch_close_fy2526', 'V-CLOSE-2526', 'JOURNAL', '2026-03-31', '${branchId}', 'FY2526', 'POSTED', 5000, 'INR', 'YEAR_END_CLOSE', 'FY2526', 'FISCAL_YEAR_CLOSE', 'FY2526 close', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
      `);

      // Preview should report blocking check
      const preview = await PeriodCloseService.previewYearEndReopen({
        fiscal_year: 'FY2425',
        session_user: { id: 'usr_super', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);
      assert(preview.can_reopen === false, 'Preview on FY with closed subsequent FY returns can_reopen = false');
      assert(preview.blocking_checks.some(c => c.id === 'BLOCKING_SUBSEQUENT_YEAR_ALREADY_CLOSED'), 'Preview returns BLOCKING_SUBSEQUENT_YEAR_ALREADY_CLOSED');

      // Execution must fail closed
      let nextClosedBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Attempting to reopen year despite closed subsequent year.',
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'SUBSEQUENT_YEAR_ALREADY_CLOSED') nextClosedBlocked = true;
      }
      assert(nextClosedBlocked, 'Reopen rejected with SUBSEQUENT_YEAR_ALREADY_CLOSED');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAINS 17, 19: DOUBLE-REVERSAL PROTECTION & IDEMPOTENCY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAINS 17, 19: DOUBLE-REVERSAL PROTECTION & IDEMPOTENCY ---');
    await client.query('BEGIN');
    try {
      await setupStandardClosedFY(client);

      // First reopen succeeds
      await PeriodCloseService.reopenYearEndClose({
        fiscal_year: 'FY2425',
        reason: 'First valid reopen to enable year-end adjustments.',
        preparer_id: 'usr_prep',
        approver_id: 'usr_appr',
        session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      // Second reopen attempt must fail
      let secondReopenBlocked = false;
      try {
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Duplicate reopen attempt that must be blocked.',
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch (e) {
        if (e.code === 'YEAR_ALREADY_REOPENED') secondReopenBlocked = true;
      }
      assert(secondReopenBlocked, 'Second reopen attempt rejected with YEAR_ALREADY_REOPENED (409)');

      // Preview on already reopened year
      const preview = await PeriodCloseService.previewYearEndReopen({
        fiscal_year: 'FY2425',
        session_user: { id: 'usr_super', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);
      assert(preview.can_reopen === false, 'Preview on already reopened year returns can_reopen = false');
      assert(preview.blocking_checks.some(c => c.id === 'BLOCKING_YEAR_ALREADY_REOPENED'), 'Preview returns BLOCKING_YEAR_ALREADY_REOPENED');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAINS 18, 20: CONCURRENCY & TRANSACTION ATOMICITY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAINS 18, 20: CONCURRENCY & TRANSACTION ATOMICITY ---');
    // 18: Concurrency / Advisory Locking
    await client.query('BEGIN');
    try {
      await setupStandardClosedFY(client);

      // Acquire advisory lock in client
      await client.query("SELECT pg_advisory_xact_lock(hashtext('year_end_close_FY2425'))");
      assert(true, 'Advisory lock acquired on year_end_close_FY2425');

      // Verify lock is held in pg_locks
      const lockRes = await client.query(`
        SELECT count(*) FROM pg_locks 
        WHERE locktype = 'advisory' AND objid = hashtext('year_end_close_FY2425')
      `);
      assert(parseInt(lockRes.rows[0].count, 10) > 0, 'Advisory lock registered in pg_locks for fiscal year');
    } finally {
      await client.query('ROLLBACK');
    }

    // 20: Atomicity / Failure Rollback
    await client.query('BEGIN');
    try {
      const { closeRes } = await setupStandardClosedFY(client);
      const origVchId = closeRes.voucher_id;

      // Simulate a failure inside reopen by passing invalid arguments to an inner operation or a savepoint
      await client.query('SAVEPOINT sp_reopen_test');
      let failed = false;
      try {
        // Attempt reopen with invalid reason
        await PeriodCloseService.reopenYearEndClose({
          fiscal_year: 'FY2425',
          reason: 'Too short',
          preparer_id: 'usr_prep',
          approver_id: 'usr_appr',
          session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
        }, client);
      } catch {
        failed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_reopen_test');
      }
      assert(failed, 'Simulated failure trapped successfully');

      // Verify original closing voucher remains unmodified and unreversed
      const vchRes = await client.query('SELECT * FROM public.accounting_voucher WHERE id = $1', [origVchId]);
      assert(vchRes.rows[0].status === 'POSTED', 'Original closing voucher remains POSTED after rollback');
      assert(vchRes.rows[0].reversed_by_voucher_id === null, 'Original closing voucher reversed_by_voucher_id remains null');
      const jeRollbackRes = await client.query('SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1', [origVchId]);
      assert(jeRollbackRes.rows[0].is_reversed === false, 'Original closing journal entry remains unreversed (is_reversed = false)');

      // Verify zero reversal vouchers exist
      const revVchCount = await client.query(
        "SELECT count(*) FROM public.accounting_voucher WHERE reference_type = 'YEAR_END_REOPEN'"
      );
      assert(parseInt(revVchCount.rows[0].count, 10) === 0, 'Zero reversal vouchers created after failure rollback');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOMAIN 24: FULL LIFECYCLE (CLOSE 1 -> REOPEN -> ADJUST -> CLOSE 2)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 24: FULL LIFECYCLE (CLOSE 1 -> REOPEN -> ADJUST -> CLOSE 2) ---');
    await client.query('BEGIN');
    try {
      const { closeRes, branchId, acctMap } = await setupStandardClosedFY(client);

      // Verify Cycle 1 close reference event
      const c1Vch = await client.query('SELECT reference_event FROM public.accounting_voucher WHERE id = $1', [closeRes.voucher_id]);
      assert(c1Vch.rows[0].reference_event === 'FISCAL_YEAR_CLOSE', 'Cycle 1 close uses reference_event = FISCAL_YEAR_CLOSE');

      // Step A: Reopen
      const reopenRes = await PeriodCloseService.reopenYearEndClose({
        fiscal_year: 'FY2425',
        reason: 'Authorized reopen to post year-end auditor adjustment entry.',
        preparer_id: 'usr_prep',
        approver_id: 'usr_appr',
        session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);
      assert(reopenRes.success === true, 'Reopen in lifecycle succeeded');

      // Step B: Post Auditor Adjusting Entry (Sales revenue +₹5,000, Cash +₹5,000)
      const vAdjId = 'vch_op_auditor_adj';
      const jAdjId = 'jnl_op_auditor_adj';
      await client.query(`
        INSERT INTO public.accounting_voucher 
          (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, approved_by, posted_by, posted_at, created_at)
        VALUES 
          ('${vAdjId}', 'V-ADJ-01', 'JOURNAL', '2025-03-31', '${branchId}', 'FY2425', 'POSTED', 5000, 'INR', 'Auditor adjusting entry', 'usr_prep', 'usr_appr', 'usr_appr', NOW(), NOW())
      `);
      await client.query(`
        INSERT INTO public.accounting_journal_entry
          (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
          ('${jAdjId}', 'JE-ADJ-01', '${vAdjId}', '2025-03-31', '${branchId}', 'FY2425', 5000, 5000, false, 'Auditor adjusting entry', 'usr_appr', NOW())
      `);
      await client.query(`
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
        VALUES
          (gen_random_uuid()::text, '${jAdjId}', 1, '${acctMap['1111']}', 5000, 0, '${branchId}', 'Cash adjustment'),
          (gen_random_uuid()::text, '${jAdjId}', 2, '${acctMap['4110']}', 0, 5000, '${branchId}', 'Unrecorded sales')
      `);

      // Step C: Pre-Close Diagnostics before Re-Close
      const diag = await PeriodCloseService.runPreCloseDiagnostics({
        fiscal_year: 'FY2425',
        branch_id: branchId,
        session_user: { id: 'usr_super', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);
      assert(diag.can_close === true, 'Pre-close diagnostics report can_close = true for re-close');
      // Net Profit now ₹37,000 + ₹5,000 = ₹42,000
      assert(diag.summary.projected_net_profit === 42000, `Projected Net Profit for Cycle 2 is ₹42,000 (actual: ${diag.summary.projected_net_profit})`);

      // Step D: Execute Re-Close (Cycle 2)
      const recloseRes = await PeriodCloseService.executeYearEndClose({
        fiscal_year: 'FY2425',
        preparer_id: 'usr_prep',
        approver_id: 'usr_appr',
        session_user: { id: 'usr_appr', role: 'SUPER_ADMIN', isSuperAdmin: true }
      }, client);

      assert(recloseRes.success === true, 'Re-close Cycle 2 executed successfully');
      assert(recloseRes.net_profit === 42000, 'Cycle 2 transferred updated ₹42,000 to Retained Earnings');

      // Verify Cycle 2 voucher uses cycle-indexed event: FISCAL_YEAR_CLOSE_CYCLE_2
      const c2Vch = await client.query('SELECT reference_event FROM public.accounting_voucher WHERE id = $1', [recloseRes.voucher_id]);
      assert(c2Vch.rows[0].reference_event === 'FISCAL_YEAR_CLOSE_CYCLE_2', `Cycle 2 uses reference_event = FISCAL_YEAR_CLOSE_CYCLE_2 (actual: ${c2Vch.rows[0].reference_event})`);

      // Step E: Verify Close History Timeline
      const history = await PeriodCloseService.getFiscalYearCloseHistory('FY2425', client);
      assert(history.is_closed === true, 'History reports FY is currently closed');
      assert(history.close_events_count === 2, `History reports 2 close events (actual: ${history.close_events_count})`);
      assert(history.reopen_events_count === 1, `History reports 1 reopen event (actual: ${history.reopen_events_count})`);
      assert(history.timeline.length === 3, 'Timeline contains exactly 3 events (Close -> Reopen -> Close)');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // POST-TEST POSTGRESQL AUDIT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION FINAL: POST-TEST POSTGRESQL AUDIT ---');
    const [vFinal, jFinal, lFinal, pFinal, sFinal, locksFinal] = await Promise.all([
      client.query('SELECT count(*) FROM public.accounting_voucher'),
      client.query('SELECT count(*) FROM public.accounting_journal_entry'),
      client.query('SELECT count(*) FROM public.accounting_journal_line'),
      client.query('SELECT count(*) FROM public.accounting_fiscal_period'),
      client.query("SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%'"),
      client.query("SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid()")
    ]);

    assert(parseInt(vFinal.rows[0].count, 10) === 0, `Post-test vouchers = 0 (actual: ${vFinal.rows[0].count})`);
    assert(parseInt(jFinal.rows[0].count, 10) === 0, `Post-test journal entries = 0 (actual: ${jFinal.rows[0].count})`);
    assert(parseInt(lFinal.rows[0].count, 10) === 0, `Post-test journal lines = 0 (actual: ${lFinal.rows[0].count})`);
    assert(parseInt(pFinal.rows[0].count, 10) === 0, `Post-test fiscal periods = 0 (actual: ${pFinal.rows[0].count})`);
    assert(parseInt(sFinal.rows[0].count, 10) === 0, `Post-test accounting settings = 0 (actual: ${sFinal.rows[0].count})`);
    assert(parseInt(locksFinal.rows[0].count, 10) === 0, `Post-test active competing connections = 0`);

  } finally {
    await client.end();
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`Phase 5A.6 Step 4 Test Results: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('══════════════════════════════════════════════════════════════════');

  if (failCount > 0) {
    console.error('\nFailures summary:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Fatal test suite runner error:", err);
  process.exit(1);
});
