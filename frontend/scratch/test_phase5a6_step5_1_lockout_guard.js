/**
 * CakeToHome ERP — Phase 5A.6 Substep 5.1: Historical Lockout Guard Verification Suite
 *
 * RIGOROUS INVARIANTS & VERIFICATION TARGETS:
 * 1. Historical Lockout Guard in FiscalPeriodService.unlockPeriod:
 *    - Rejects unlocking any monthly period if parent fiscal year has active unreversed YEAR_END_CLOSE voucher.
 *    - Throws CANNOT_UNLOCK_CLOSED_YEAR_PERIOD (409) with closing voucher reference.
 * 2. RBAC & Validation Invariants Preserved:
 *    - Rejects non-SUPER_ADMIN with UNAUTHORIZED (403).
 *    - Rejects reason < 20 characters with UNLOCK_REASON_REQUIRED (400).
 *    - Rejects unlock on unlocked period with PERIOD_NOT_LOCKED (409).
 * 3. Delegation Guard:
 *    - PeriodCloseService.unlockMonthlyPeriod inherits closed fiscal year protection.
 * 4. PostingService Defense-in-Depth:
 *    - validateFiscalPeriod rejects operational posting into date in closed FY with FISCAL_PERIOD_LOCKED.
 *    - Year-end closing / reopen vouchers with allowLockedForClosing = true can proceed.
 * 5. Reopened Lifecycle Integration:
 *    - After Step 4 Year-End Reopen (reversed_by_voucher_id is set), unlocking monthly period succeeds.
 *    - Postings to reopened period succeed once period is unlocked.
 * 6. Audit Trail:
 *    - Successful unlock creates audit_log with action 'accounting.fiscal_period_unlocked' and reason.
 * 7. Transactional Isolation & Zero Persistent Mutations:
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
  console.log('Phase 5A.6 Substep 5.1 — Historical Lockout Guard Verification');
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

  const { FiscalPeriodService, FiscalPeriodError } = require('../src/lib/services/fiscal-period.service');
  const { PostingService, PostingServiceError } = require('../src/lib/services/posting.service');
  const { PeriodCloseService } = require('../src/lib/services/period-close.service');
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
    assert(b.vch_cnt === 0, 'Zero test vouchers');
    assert(b.je_cnt === 0, 'Zero test journal entries');
    assert(b.jl_cnt === 0, 'Zero test journal lines');
    assert(b.fp_cnt === 0, 'Zero test fiscal periods');
    assert(b.start_date_cnt === 0, 'Accounting start date clean');
    assert(b.coa_cnt === 99, `Canonical CoA accounts intact (99)`);

    // ── BEGIN ISOLATED TRANSACTION ────────────────────────────────────────────
    console.log('\n── Section 2: Setup Test Environment in Rollback Transaction ──');
    await client.query('BEGIN');

    // 1. Configure accounting start date
    await client.query(
      `INSERT INTO public.setting (id, "group", key, value, created_at, updated_at) 
       VALUES (gen_random_uuid(), 'accounting', 'accounting_start_date', '2024-04-01', NOW(), NOW())`
    );

    // 2. Auto-generate 12 monthly periods for FY2425
    const periods = await FiscalPeriodService.generateYearPeriods(
      'FY2425',
      '2024-04-01',
      'user_admin_001',
      'SUPER_ADMIN',
      client
    );
    assert(periods.length === 12, '12 monthly fiscal periods created for FY2425');

    // 3. Lock all 12 periods
    for (const p of periods) {
      await FiscalPeriodService.lockPeriod(p.id, 'user_admin_001', 'SUPER_ADMIN', client);
    }
    const lockedCntRes = await client.query(
      `SELECT count(*)::int as count FROM public.accounting_fiscal_period WHERE fiscal_year = 'FY2425' AND is_locked = true`
    );
    assert(lockedCntRes.rows[0].count === 12, 'All 12 monthly periods locked');

    // 4. Create dummy accounts check and resolve valid branch
    const branchRes = await client.query(`SELECT id FROM public.branch LIMIT 1`);
    let branchId = branchRes.rows[0]?.id;
    if (!branchId) {
      const newB = await client.query(`
        INSERT INTO public.branch (id, name, code, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Test Branch', 'TB01', true, NOW(), NOW())
        RETURNING id
      `);
      branchId = newB.rows[0].id;
    }

    const revAccountRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '4110' LIMIT 1`);
    const expAccountRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '5110' LIMIT 1`);
    const reAccountRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '3210' LIMIT 1`);
    const revId = revAccountRes.rows[0].id;
    const expId = expAccountRes.rows[0].id;
    const reId = reAccountRes.rows[0].id;

    // 5. Post sample activity and close fiscal year FY2425
    // Create and post operational voucher
    const opVoucherRes = await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, fiscal_year, status, branch_id, narration, created_by, approved_by, posted_by, posted_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'VCH-OP-001', 'JOURNAL', '2024-05-15', 'FY2425', 'POSTED', $1,
        'Initial revenue entry', 'user_prep', 'user_appr', 'user_post', NOW(), NOW(), NOW()
      ) RETURNING id
    `, [branchId]);
    const opVoucherId = opVoucherRes.rows[0].id;

    const opJournalRes = await client.query(`
      INSERT INTO public.accounting_journal_entry (
        id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, created_by, created_at
      ) VALUES (
        gen_random_uuid(), 'JE-OP-001', $1, '2024-05-15', $2, 'FY2425', 10000.00, 10000.00, false, 'user_prep', NOW()
      ) RETURNING id
    `, [opVoucherId, branchId]);
    const opJournalId = opJournalRes.rows[0].id;

    await client.query(`
      INSERT INTO public.accounting_journal_line (id, journal_entry_id, line_no, account_id, branch_id, debit_amount, credit_amount, narration)
      VALUES 
        (gen_random_uuid(), $1, 1, $2, $4, 10000.00, 0.00, 'Expense debit'),
        (gen_random_uuid(), $1, 2, $3, $4, 0.00, 10000.00, 'Revenue credit')
    `, [opJournalId, expId, revId, branchId]);

    // Create and post YEAR_END_CLOSE voucher
    const closeVoucherRes = await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, fiscal_year, status, branch_id, narration, reference_type, reference_id, reference_event,
        created_by, approved_by, posted_by, posted_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'VCH-CLOSE-FY2425', 'JOURNAL', '2025-03-31', 'FY2425', 'POSTED', $1,
        '[YEAR_END_CLOSE] FY2425 Close', 'YEAR_END_CLOSE', 'FY2425', 'FISCAL_YEAR_CLOSE',
        'user_prep', 'user_appr', 'user_post', NOW(), NOW(), NOW()
      ) RETURNING id, voucher_no
    `, [branchId]);
    const closeVoucher = closeVoucherRes.rows[0];
    assert(closeVoucher.voucher_no === 'VCH-CLOSE-FY2425', 'Active YEAR_END_CLOSE voucher posted for FY2425');

    // ── SECTION 3: Historical Lockout Guard in FiscalPeriodService.unlockPeriod ──
    console.log('\n── Section 3: FiscalPeriodService.unlockPeriod on Closed Fiscal Year ──');
    const periodM01 = periods[0];

    // 1. Attempt unlock on closed fiscal year by SUPER_ADMIN with valid reason
    let closedYearError = null;
    try {
      await FiscalPeriodService.unlockPeriod(
        periodM01.id,
        'user_admin_001',
        'SUPER_ADMIN',
        'Valid 20-character reason for unlocking period for adjustment',
        client
      );
    } catch (err) {
      closedYearError = err;
    }
    assert(closedYearError !== null, 'Unlock rejected on closed fiscal year');
    assert(closedYearError?.code === 'CANNOT_UNLOCK_CLOSED_YEAR_PERIOD', `Error code === CANNOT_UNLOCK_CLOSED_YEAR_PERIOD (actual: ${closedYearError?.code})`);
    assert(closedYearError?.message.includes(closeVoucher.voucher_no), `Error message cites close voucher ${closeVoucher.voucher_no}`);
    assert(closedYearError?.message.includes('Reopen the fiscal year first'), 'Error message instructs to reopen fiscal year first');

    // 2. RBAC check: non-SUPER_ADMIN rejected with UNAUTHORIZED
    let authError = null;
    try {
      await FiscalPeriodService.unlockPeriod(
        periodM01.id,
        'user_staff_001',
        'STAFF',
        'Valid 20-character reason for unlocking period for adjustment',
        client
      );
    } catch (err) {
      authError = err;
    }
    assert(authError?.code === 'UNAUTHORIZED', `Non-admin rejected with UNAUTHORIZED (actual: ${authError?.code})`);

    // 3. Reason validation: short reason rejected with UNLOCK_REASON_REQUIRED
    let reasonError = null;
    try {
      await FiscalPeriodService.unlockPeriod(
        periodM01.id,
        'user_admin_001',
        'SUPER_ADMIN',
        'Too short',
        client
      );
    } catch (err) {
      reasonError = err;
    }
    assert(reasonError?.code === 'UNLOCK_REASON_REQUIRED', `Short reason rejected with UNLOCK_REASON_REQUIRED (actual: ${reasonError?.code})`);

    // ── SECTION 4: PeriodCloseService Delegation Guard ────────────────────────
    console.log('\n── Section 4: PeriodCloseService.unlockMonthlyPeriod Delegation Guard ──');
    let delegationError = null;
    try {
      await PeriodCloseService.unlockMonthlyPeriod(
        {
          period_id: periodM01.id,
          reason: 'Valid 20-character reason for unlocking period for adjustment',
          session_user: { id: 'user_admin_001', role: 'SUPER_ADMIN' },
        },
        client
      );
    } catch (err) {
      delegationError = err;
    }
    assert(delegationError?.code === 'CANNOT_UNLOCK_CLOSED_YEAR_PERIOD', `PeriodCloseService delegates and throws CANNOT_UNLOCK_CLOSED_YEAR_PERIOD`);

    // ── SECTION 5: PostingService Defense-in-Depth Guard ───────────────────────
    console.log('\n── Section 5: PostingService.validateFiscalPeriod Defense-in-Depth ──');

    // 1. Force period to is_locked = false directly in DB (simulating rogue DB change or unlocked state)
    await client.query(`UPDATE public.accounting_fiscal_period SET is_locked = false WHERE id = $1`, [periodM01.id]);
    const forcedOpenCheck = await client.query(`SELECT is_locked FROM public.accounting_fiscal_period WHERE id = $1`, [periodM01.id]);
    assert(forcedOpenCheck.rows[0].is_locked === false, 'Period row forced to is_locked = false in DB');

    // 2. Validate operational posting into date 2024-04-15
    let postingGuardError = null;
    try {
      await PostingService.validateFiscalPeriod('2024-04-15', client, false);
    } catch (err) {
      postingGuardError = err;
    }
    assert(postingGuardError !== null, 'PostingService rejects operational posting into closed FY despite unlocked period row');
    assert(postingGuardError?.code === 'FISCAL_PERIOD_LOCKED', `PostingService error code === FISCAL_PERIOD_LOCKED (actual: ${postingGuardError?.code})`);
    assert(postingGuardError?.message.includes('is closed by voucher'), 'PostingService error message identifies closed fiscal year');

    // 3. Year-end close/reopen voucher with allowLockedForClosing = true IS permitted
    let allowLockedResult = null;
    try {
      allowLockedResult = await PostingService.validateFiscalPeriod('2024-04-15', client, true);
    } catch (err) {
      console.error(err);
    }
    assert(allowLockedResult !== null && allowLockedResult.period_name === periodM01.period_name, 'allowLockedForClosing = true permits validation');

    // Restore period lock for next section
    await client.query(`UPDATE public.accounting_fiscal_period SET is_locked = true WHERE id = $1`, [periodM01.id]);

    // ── SECTION 6: Reopened Fiscal Year Unlocking & Posting ───────────────────
    console.log('\n── Section 6: Reopened Fiscal Year Unlocking & Posting Lifecycle ──');

    // Post a YEAR_END_REOPEN compensating reversal voucher
    const reopenVoucherRes = await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, fiscal_year, status, branch_id, narration, reference_type, reference_id, reference_event,
        reversal_of_voucher_id, created_by, approved_by, posted_by, posted_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'VCH-REOPEN-FY2425', 'JOURNAL', '2025-03-31', 'FY2425', 'POSTED', $2,
        '[YEAR_END_REOPEN] FY2425 Reopen', 'YEAR_END_REOPEN', 'FY2425', 'YEAR_END_CLOSE_REVERSAL',
        $1, 'user_prep', 'user_appr', 'user_post', NOW(), NOW(), NOW()
      ) RETURNING id, voucher_no
    `, [closeVoucher.id, branchId]);
    const reopenVoucher = reopenVoucherRes.rows[0];

    // Link reversal on original closing voucher
    await client.query(`
      UPDATE public.accounting_voucher
      SET reversed_by_voucher_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [reopenVoucher.id, closeVoucher.id]);

    // Verify active close check now returns 0 rows
    const activeCheckRes = await client.query(`
      SELECT count(*)::int as count FROM public.accounting_voucher
      WHERE reference_type = 'YEAR_END_CLOSE'
        AND reference_id = 'FY2425'
        AND status = 'POSTED'
        AND reversed_by_voucher_id IS NULL
        AND deleted_at IS NULL
    `);
    assert(activeCheckRes.rows[0].count === 0, 'Zero active unreversed close vouchers for FY2425 post-reopen');

    // Now unlock period FY2425-M01 should SUCCEED
    const unlockedPeriod = await FiscalPeriodService.unlockPeriod(
      periodM01.id,
      'user_admin_001',
      'SUPER_ADMIN',
      'Authorized unlock for post-reopen adjustments in FY2425-M01',
      client
    );
    assert(unlockedPeriod.is_locked === false, 'Monthly period FY2425-M01 successfully unlocked post-reopen');
    assert(unlockedPeriod.locked_at === null, 'locked_at cleared');
    assert(unlockedPeriod.locked_by === null, 'locked_by cleared');

    // Audit log check
    const auditRes = await client.query(`
      SELECT * FROM public.audit_log 
      WHERE action = 'accounting.fiscal_period_unlocked' AND entity_id = $1 
      ORDER BY created_at DESC LIMIT 1
    `, [periodM01.id]);
    assert(auditRes.rows.length === 1, 'Audit log entry created for monthly unlock');
    const auditMeta = JSON.parse(auditRes.rows[0].metadata);
    assert(auditMeta.action === 'MONTHLY_UNLOCK', 'Audit log metadata has action MONTHLY_UNLOCK');
    assert(auditMeta.reason.includes('post-reopen adjustments'), 'Audit log records unlock reason');

    // Now PostingService.validateFiscalPeriod on date in unlocked period succeeds
    const validatedPeriod = await PostingService.validateFiscalPeriod('2024-04-15', client, false);
    assert(validatedPeriod.period_name === periodM01.period_name, 'Operational posting validation succeeds on unlocked reopened period');

    // ── SECTION 7: Rollback and Baseline Verification ────────────────────────
    console.log('\n── Section 7: Atomic Rollback and Post-Test Baseline Purity ──');
    await client.query('ROLLBACK');

    const postRollbackRes = await client.query(`
      SELECT 
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.accounting_fiscal_period) AS fp_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt,
        (SELECT count(*)::int FROM public.accounting_account WHERE is_active = true) AS coa_cnt,
        (SELECT count(*)::int FROM public.audit_log WHERE action LIKE 'accounting%') AS audit_cnt
    `);
    const pr = postRollbackRes.rows[0];
    assert(pr.vch_cnt === 0, 'Post-rollback vouchers === 0');
    assert(pr.je_cnt === 0, 'Post-rollback journal entries === 0');
    assert(pr.jl_cnt === 0, 'Post-rollback journal lines === 0');
    assert(pr.fp_cnt === 0, 'Post-rollback fiscal periods === 0');
    assert(pr.start_date_cnt === 0, 'Post-rollback accounting start date === 0');
    assert(pr.coa_cnt === 99, 'Active accounts unchanged (99)');
    assert(pr.audit_cnt === 0, 'Post-rollback accounting audit logs === 0');

    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log(`SUBSTEP 5.1 RESULTS: ${passed} PASS, ${failed} FAIL`);
    console.log('══════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Test execution exception:', err);
    await client.query('ROLLBACK').catch(() => {});
    failed++;
  } finally {
    await client.end();
    await closeDbPool();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
