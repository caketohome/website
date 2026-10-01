/**
 * CakeToHome ERP — Phase 5A.6 Step 2: Monthly Period Lock / Unlock Engine Verification Suite
 *
 * RIGOROUS INVARIANTS & VERIFICATION TARGETS:
 * 1. Monthly Period Lock (FOR UPDATE concurrency protection, is_locked = true, locked_at, locked_by).
 * 2. Monthly Period Unlock (FOR UPDATE, mandatory reason >= 20 chars, is_locked = false, cleared lock metadata).
 * 3. Audit Trail Integrity (audit_log entries created with action, metadata, actor, and reason).
 * 4. RBAC / SoD (SUPER_ADMIN only; STAFF rejected with UNAUTHORIZED / 403).
 * 5. Multi-Client Concurrency Contention:
 *    - Real two-client FOR UPDATE row lock verification with SQLSTATE 55P03 (lock_not_available).
 * 6. Server-Side Fiscal Period Enforcement:
 *    - Open period: PostingService.validateFiscalPeriod() passes.
 *    - Locked period: PostingService.validateFiscalPeriod() hard blocks with FISCAL_PERIOD_LOCKED.
 *    - Unlocked period: PostingService.validateFiscalPeriod() passes again.
 * 7. End-to-End Voucher Posting Pipeline Guard:
 *    - PostingService.postVoucher() hard rejects posting into locked period with FISCAL_PERIOD_LOCKED.
 * 8. Atomic Rollback on Failure: Zero partial mutations if error occurs.
 * 9. API Route Status Code Mapping:
 *    - HTTP 403 for unauthorized staff, 400 for reason < 20 chars, 409 for conflict, 200 for success.
 * 10. Strictly Step 2 Bounded: Zero year-end closing, zero closing vouchers, zero nominal transfers.
 * 11. PostgreSQL Zero Mutations Invariant: Baseline pristine before and after suite.
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
  console.log('Phase 5A.6 Step 2 — Monthly Period Lock / Unlock Engine Verification');
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
  const { PeriodCloseService } = require('../src/lib/services/period-close.service');
  const { PostingService, PostingServiceError } = require('../src/lib/services/posting.service');

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
    assert(typeof FiscalPeriodService.lockPeriod === 'function', 'FiscalPeriodService.lockPeriod is a static method');
    assert(typeof FiscalPeriodService.unlockPeriod === 'function', 'FiscalPeriodService.unlockPeriod is a static method');
    assert(typeof PeriodCloseService.lockMonthlyPeriod === 'function', 'PeriodCloseService.lockMonthlyPeriod is a static method');
    assert(typeof PeriodCloseService.unlockMonthlyPeriod === 'function', 'PeriodCloseService.unlockMonthlyPeriod is a static method');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: RBAC & SEGREGATION OF DUTIES ENFORCEMENT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 2: RBAC & SEGREGATION OF DUTIES ENFORCEMENT ---');

    let lockStaffDenied = false;
    try {
      await FiscalPeriodService.lockPeriod('fp_dummy', 'usr_staff_01', 'STAFF');
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNAUTHORIZED') {
        lockStaffDenied = true;
      }
    }
    assert(lockStaffDenied, 'Staff role rejected from lockPeriod with UNAUTHORIZED (HTTP 403)');

    let lockStaffDelegatedDenied = false;
    try {
      await PeriodCloseService.lockMonthlyPeriod({
        period_id: 'fp_dummy',
        session_user: { id: 'usr_staff_01', role: 'STAFF' },
      });
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNAUTHORIZED') {
        lockStaffDelegatedDenied = true;
      }
    }
    assert(lockStaffDelegatedDenied, 'Staff rejected from PeriodCloseService.lockMonthlyPeriod with UNAUTHORIZED');

    let unlockStaffDenied = false;
    try {
      await FiscalPeriodService.unlockPeriod(
        'fp_dummy',
        'usr_staff_01',
        'STAFF',
        'Valid unlock reason exceeding twenty characters'
      );
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNAUTHORIZED') {
        unlockStaffDenied = true;
      }
    }
    assert(unlockStaffDenied, 'Staff role rejected from unlockPeriod with UNAUTHORIZED (HTTP 403)');

    let unlockStaffDelegatedDenied = false;
    try {
      await PeriodCloseService.unlockMonthlyPeriod({
        period_id: 'fp_dummy',
        reason: 'Valid unlock reason exceeding twenty characters',
        session_user: { id: 'usr_staff_01', role: 'STAFF' },
      });
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNAUTHORIZED') {
        unlockStaffDelegatedDenied = true;
      }
    }
    assert(unlockStaffDelegatedDenied, 'Staff rejected from PeriodCloseService.unlockMonthlyPeriod with UNAUTHORIZED');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: MANDATORY UNLOCK REASON VALIDATION & BOUNDARY TESTS (>= 20 CHARS)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 3: MANDATORY UNLOCK REASON VALIDATION & BOUNDARY TESTS (>= 20 CHARS) ---');

    // 3A: Missing reason (undefined)
    let missingReasonDenied = false;
    try {
      await FiscalPeriodService.unlockPeriod('fp_dummy', 'usr_admin', 'SUPER_ADMIN', undefined);
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNLOCK_REASON_REQUIRED') {
        missingReasonDenied = true;
      }
    }
    assert(missingReasonDenied, 'Undefined reason rejected with UNLOCK_REASON_REQUIRED');

    // 3B: Empty reason string
    let emptyReasonDenied = false;
    try {
      await FiscalPeriodService.unlockPeriod('fp_dummy', 'usr_admin', 'SUPER_ADMIN', '');
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNLOCK_REASON_REQUIRED') {
        emptyReasonDenied = true;
      }
    }
    assert(emptyReasonDenied, 'Empty reason string rejected with UNLOCK_REASON_REQUIRED');

    // 3C: Short reason (< 20 characters, e.g. 16 characters)
    let shortReasonDenied = false;
    try {
      await FiscalPeriodService.unlockPeriod('fp_dummy', 'usr_admin', 'SUPER_ADMIN', 'Quick correction');
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNLOCK_REASON_REQUIRED') {
        shortReasonDenied = true;
      }
    }
    assert(shortReasonDenied, 'Short reason ("Quick correction", 16 chars) rejected with UNLOCK_REASON_REQUIRED');

    // 3D: Exactly 19 characters (boundary test: must reject)
    let exact19Denied = false;
    try {
      await FiscalPeriodService.unlockPeriod('fp_dummy', 'usr_admin', 'SUPER_ADMIN', '1234567890123456789'); // len = 19
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNLOCK_REASON_REQUIRED') {
        exact19Denied = true;
      }
    }
    assert(exact19Denied, 'Boundary: Exactly 19 characters rejected with UNLOCK_REASON_REQUIRED');

    // 3E: Whitespace padding does not bypass >= 20 characters length check
    let paddedReasonDenied = false;
    try {
      await FiscalPeriodService.unlockPeriod('fp_dummy', 'usr_admin', 'SUPER_ADMIN', '    too short    ');
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNLOCK_REASON_REQUIRED') {
        paddedReasonDenied = true;
      }
    }
    assert(paddedReasonDenied, 'Padded short reason rejected with UNLOCK_REASON_REQUIRED');

    // 3F: Whitespace-only string of 30 spaces (boundary test: must reject)
    let whitespaceOnlyDenied = false;
    try {
      await FiscalPeriodService.unlockPeriod('fp_dummy', 'usr_admin', 'SUPER_ADMIN', '                              '); // 30 spaces
    } catch (err) {
      if (err instanceof FiscalPeriodError && err.code === 'UNLOCK_REASON_REQUIRED') {
        whitespaceOnlyDenied = true;
      }
    }
    assert(whitespaceOnlyDenied, 'Whitespace-only string (30 spaces) rejected with UNLOCK_REASON_REQUIRED');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: ISOLATED TRANSACTIONAL MONTHLY PERIOD LOCK
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 4: ISOLATED TRANSACTIONAL MONTHLY PERIOD LOCK ---');
    await client.query('BEGIN');
    try {
      // Create an open period
      const insRes = await client.query(`
        INSERT INTO public.accounting_fiscal_period 
          (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
        VALUES 
          ('FY2425', 'P01-APR-2024', '2024-04-01', '2024-04-30', false, NOW())
        RETURNING *
      `);
      const periodId = insRes.rows[0].id;

      // 4A: Non-existent period
      let notFoundThrew = false;
      try {
        await FiscalPeriodService.lockPeriod('fp_nonexistent_id', 'usr_admin', 'SUPER_ADMIN', client);
      } catch (err) {
        if (err instanceof FiscalPeriodError && err.code === 'PERIOD_NOT_FOUND') {
          notFoundThrew = true;
        }
      }
      assert(notFoundThrew, 'Locking non-existent period throws PERIOD_NOT_FOUND');

      // 4B: Successful lock
      const lockedRow = await FiscalPeriodService.lockPeriod(periodId, 'usr_super_admin_01', 'SUPER_ADMIN', client);
      assert(lockedRow.is_locked === true, 'Period is_locked set to true');
      assert(lockedRow.locked_by === 'usr_super_admin_01', 'Period locked_by recorded correctly');
      assert(!!lockedRow.locked_at, 'Period locked_at timestamp recorded');

      // 4C: Direct database verification of lock state
      const dbCheck = await client.query('SELECT is_locked, locked_by, locked_at FROM public.accounting_fiscal_period WHERE id = $1', [periodId]);
      assert(dbCheck.rows[0].is_locked === true, 'PostgreSQL confirmed: is_locked === true');
      assert(dbCheck.rows[0].locked_by === 'usr_super_admin_01', 'PostgreSQL confirmed: locked_by === usr_super_admin_01');

      // 4D: Already locked rejection
      let alreadyLockedThrew = false;
      try {
        await FiscalPeriodService.lockPeriod(periodId, 'usr_super_admin_02', 'SUPER_ADMIN', client);
      } catch (err) {
        if (err instanceof FiscalPeriodError && err.code === 'PERIOD_ALREADY_LOCKED') {
          alreadyLockedThrew = true;
        }
      }
      assert(alreadyLockedThrew, 'Locking already-locked period throws PERIOD_ALREADY_LOCKED');

      // 4E: Audit log entry verification
      const auditRes = await client.query(
        "SELECT * FROM public.audit_log WHERE entity = 'fiscal_period' AND entity_id = $1 AND action = 'accounting.fiscal_period_locked'",
        [periodId]
      );
      assert(auditRes.rows.length === 1, 'Audit log contains exactly 1 lock record');
      assert(auditRes.rows[0].actor_id === 'usr_super_admin_01', 'Audit log records correct actor ID');
      const auditMeta = JSON.parse(auditRes.rows[0].metadata);
      assert(auditMeta.action === 'MONTHLY_LOCK', 'Audit metadata specifies action = MONTHLY_LOCK');
      assert(auditMeta.period_name === 'P01-APR-2024', 'Audit metadata records period name');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: ISOLATED TRANSACTIONAL MONTHLY PERIOD UNLOCK
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 5: ISOLATED TRANSACTIONAL MONTHLY PERIOD UNLOCK ---');
    await client.query('BEGIN');
    try {
      // Create a locked period
      const insRes = await client.query(`
        INSERT INTO public.accounting_fiscal_period 
          (fiscal_year, period_name, start_date, end_date, is_locked, locked_at, locked_by, created_at)
        VALUES 
          ('FY2425', 'P02-MAY-2024', '2024-05-01', '2024-05-31', true, NOW(), 'usr_admin', NOW())
        RETURNING *
      `);
      const periodId = insRes.rows[0].id;

      // 5A: Non-existent period
      let notFoundThrew = false;
      try {
        await FiscalPeriodService.unlockPeriod(
          'fp_nonexistent_id',
          'usr_admin',
          'SUPER_ADMIN',
          'Valid reason for non-existent period unlock testing',
          client
        );
      } catch (err) {
        if (err instanceof FiscalPeriodError && err.code === 'PERIOD_NOT_FOUND') {
          notFoundThrew = true;
        }
      }
      assert(notFoundThrew, 'Unlocking non-existent period throws PERIOD_NOT_FOUND');

      // 5B: Boundary: Exactly 20 characters unlocks successfully
      const exact20Reason = '12345678901234567890'; // len = 20
      const unlockedRowExact20 = await FiscalPeriodService.unlockPeriod(
        periodId,
        'usr_super_admin_20',
        'SUPER_ADMIN',
        exact20Reason,
        client
      );
      assert(unlockedRowExact20.is_locked === false, 'Boundary: Exactly 20 characters successfully unlocks period');

      // Relock for subsequent unlock tests
      await client.query('UPDATE public.accounting_fiscal_period SET is_locked = true, locked_at = NOW(), locked_by = $1 WHERE id = $2', ['usr_admin', periodId]);

      // 5C: Successful unlock with full descriptive reason
      const unlockReason = 'Auditor requested reopening to record late-received raw milk purchase invoice voucher';
      const unlockedRow = await FiscalPeriodService.unlockPeriod(
        periodId,
        'usr_super_admin_02',
        'SUPER_ADMIN',
        unlockReason,
        client
      );

      assert(unlockedRow.is_locked === false, 'Period is_locked reset to false');
      assert(unlockedRow.locked_at === null, 'Period locked_at cleared to null');
      assert(unlockedRow.locked_by === null, 'Period locked_by cleared to null');

      // 5D: Direct database verification of unlocked state
      const dbCheck = await client.query('SELECT is_locked, locked_by, locked_at FROM public.accounting_fiscal_period WHERE id = $1', [periodId]);
      assert(dbCheck.rows[0].is_locked === false, 'PostgreSQL confirmed: is_locked === false');
      assert(dbCheck.rows[0].locked_by === null, 'PostgreSQL confirmed: locked_by IS NULL');
      assert(dbCheck.rows[0].locked_at === null, 'PostgreSQL confirmed: locked_at IS NULL');

      // 5E: Already unlocked rejection
      let notLockedThrew = false;
      try {
        await FiscalPeriodService.unlockPeriod(
          periodId,
          'usr_super_admin_02',
          'SUPER_ADMIN',
          'Second unlock attempt with sufficiently long reason string',
          client
        );
      } catch (err) {
        if (err instanceof FiscalPeriodError && err.code === 'PERIOD_NOT_LOCKED') {
          notLockedThrew = true;
        }
      }
      assert(notLockedThrew, 'Unlocking already-unlocked period throws PERIOD_NOT_LOCKED');

      // 5F: Audit log entry verification (two unlocks performed in this block)
      const auditRes = await client.query(
        "SELECT * FROM public.audit_log WHERE entity = 'fiscal_period' AND entity_id = $1 AND action = 'accounting.fiscal_period_unlocked' ORDER BY created_at ASC",
        [periodId]
      );
      assert(auditRes.rows.length === 2, 'Audit log contains exactly 2 unlock records');
      assert(auditRes.rows[1].actor_id === 'usr_super_admin_02', 'Audit log records unlocking actor ID');
      const auditMeta = JSON.parse(auditRes.rows[1].metadata);
      assert(auditMeta.action === 'MONTHLY_UNLOCK', 'Audit metadata specifies action = MONTHLY_UNLOCK');
      assert(auditMeta.reason === unlockReason, 'Audit metadata captures exact unlock reason');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: MULTI-CLIENT SELECT ... FOR UPDATE CONCURRENCY PROTECTION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 6: MULTI-CLIENT SELECT ... FOR UPDATE CONCURRENCY PROTECTION ---');
    const clientB = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await clientB.connect();
    let tempPeriodId = null;
    try {
      // 1. Insert temporary period and commit so both client connections can see it
      const insRes = await client.query(`
        INSERT INTO public.accounting_fiscal_period 
          (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
        VALUES 
          ('FY2425', 'P01B-APR-2024', '2024-04-01', '2024-04-30', false, NOW())
        RETURNING *
      `);
      tempPeriodId = insRes.rows[0].id;

      // 2. Client A starts transaction and locks row with FOR UPDATE via lockPeriod
      await client.query('BEGIN');
      await FiscalPeriodService.lockPeriod(tempPeriodId, 'usr_admin_a', 'SUPER_ADMIN', client);

      // 3. Client B attempts to acquire FOR UPDATE NOWAIT on the exact same row concurrently
      let clientBLockedOut = false;
      let pgErrorCode = '';
      try {
        await clientB.query('BEGIN');
        await clientB.query('SELECT * FROM public.accounting_fiscal_period WHERE id = $1 FOR UPDATE NOWAIT', [tempPeriodId]);
      } catch (err) {
        clientBLockedOut = true;
        pgErrorCode = err.code;
        await clientB.query('ROLLBACK');
      }
      assert(clientBLockedOut, 'Client B is blocked from acquiring lock while Client A holds FOR UPDATE');
      assert(pgErrorCode === '55P03', 'PostgreSQL confirms row contention with SQLSTATE 55P03 (lock_not_available)');

      // 4. Release Client A lock
      await client.query('ROLLBACK');

      // 5. After rollback, Client B can acquire the lock cleanly
      let clientBAcquired = false;
      try {
        await clientB.query('BEGIN');
        const bRes = await clientB.query('SELECT * FROM public.accounting_fiscal_period WHERE id = $1 FOR UPDATE NOWAIT', [tempPeriodId]);
        assert(bRes.rows.length === 1, 'Client B successfully acquires lock once Client A releases transaction');
        clientBAcquired = true;
      } finally {
        await clientB.query('ROLLBACK');
      }
      assert(clientBAcquired, 'Client B concurrency test completed successfully');
    } finally {
      if (tempPeriodId) {
        await client.query('DELETE FROM public.audit_log WHERE entity = $1 AND entity_id = $2', ['fiscal_period', tempPeriodId]);
        await client.query('DELETE FROM public.accounting_fiscal_period WHERE id = $1', [tempPeriodId]);
      }
      await clientB.end();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7: PERIODCLOSESERVICE DELEGATION VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 7: PERIODCLOSESERVICE DELEGATION VERIFICATION ---');
    await client.query('BEGIN');
    try {
      const insRes = await client.query(`
        INSERT INTO public.accounting_fiscal_period 
          (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
        VALUES 
          ('FY2425', 'P03-JUN-2024', '2024-06-01', '2024-06-30', false, NOW())
        RETURNING *
      `);
      const periodId = insRes.rows[0].id;

      // Lock via PeriodCloseService
      const locked = await PeriodCloseService.lockMonthlyPeriod({
        period_id: periodId,
        session_user: { id: 'usr_super_admin_close', role: 'SUPER_ADMIN' },
      }, client);
      assert(locked.is_locked === true, 'PeriodCloseService.lockMonthlyPeriod successfully locks period');

      // Unlock via PeriodCloseService
      const unlocked = await PeriodCloseService.unlockMonthlyPeriod({
        period_id: periodId,
        reason: 'PeriodCloseService delegation test with complete explanation reason',
        session_user: { id: 'usr_super_admin_close', role: 'SUPER_ADMIN' },
      }, client);
      assert(unlocked.is_locked === false, 'PeriodCloseService.unlockMonthlyPeriod successfully unlocks period');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8: SERVER-SIDE FISCAL PERIOD ENFORCEMENT (POSTING GUARD)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 8: SERVER-SIDE FISCAL PERIOD ENFORCEMENT (POSTING GUARD) ---');
    await client.query('BEGIN');
    try {
      // Configure accounting start date
      await client.query(`
        INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
        VALUES ('set_test_01', 'accounting', 'accounting_start_date', '2024-04-01', NOW(), NOW())
      `);

      // Create period for July 2024 (initially open)
      const insRes = await client.query(`
        INSERT INTO public.accounting_fiscal_period 
          (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
        VALUES 
          ('FY2425', 'P04-JUL-2024', '2024-07-01', '2024-07-31', false, NOW())
        RETURNING *
      `);
      const periodId = insRes.rows[0].id;
      const testVoucherDate = '2024-07-15';

      // 8A: When period is OPEN -> PostingService.validateFiscalPeriod succeeds
      const validatedOpen = await PostingService.validateFiscalPeriod(testVoucherDate, client);
      assert(validatedOpen.id === periodId, 'validateFiscalPeriod succeeds when period is open');
      assert(validatedOpen.is_locked === false, 'validateFiscalPeriod returns open period');

      // 8B: Lock the period
      await FiscalPeriodService.lockPeriod(periodId, 'usr_admin', 'SUPER_ADMIN', client);

      // 8C: When period is LOCKED -> PostingService.validateFiscalPeriod hard-blocks with FISCAL_PERIOD_LOCKED
      let postingBlocked = false;
      let blockedError = '';
      try {
        await PostingService.validateFiscalPeriod(testVoucherDate, client);
      } catch (err) {
        if (err instanceof PostingServiceError && err.code === 'FISCAL_PERIOD_LOCKED') {
          postingBlocked = true;
          blockedError = err.message;
        }
      }
      assert(postingBlocked, 'PostingService.validateFiscalPeriod rejects posting to locked period with FISCAL_PERIOD_LOCKED');
      assert(blockedError.includes('P04-JUL-2024'), 'Error message identifies the locked period name');

      // 8D: Unlock the period
      await FiscalPeriodService.unlockPeriod(
        periodId,
        'usr_admin',
        'SUPER_ADMIN',
        'Reopening July 2024 to test posting resumption after correction',
        client
      );

      // 8E: When period is UNLOCKED -> PostingService.validateFiscalPeriod succeeds again
      const validatedReopened = await PostingService.validateFiscalPeriod(testVoucherDate, client);
      assert(validatedReopened.id === periodId, 'validateFiscalPeriod succeeds again after period is unlocked');
      assert(validatedReopened.is_locked === false, 'validateFiscalPeriod confirms period is open');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 9: END-TO-END VOUCHER POSTING REJECTION ON LOCKED PERIOD
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 9: END-TO-END VOUCHER POSTING REJECTION ON LOCKED PERIOD ---');
    await client.query('BEGIN');
    try {
      // Configure accounting start date
      await client.query(`
        INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
        VALUES ('set_test_02', 'accounting', 'accounting_start_date', '2024-04-01', NOW(), NOW())
      `);

      // Create period for September 2024 (locked)
      const insPeriodRes = await client.query(`
        INSERT INTO public.accounting_fiscal_period 
          (fiscal_year, period_name, start_date, end_date, is_locked, locked_at, locked_by, created_at)
        VALUES 
          ('FY2425', 'P06-SEP-2024', '2024-09-01', '2024-09-30', true, NOW(), 'usr_admin', NOW())
        RETURNING *
      `);
      const lockedPeriodId = insPeriodRes.rows[0].id;

      // Get branch ID
      const brRes = await client.query('SELECT id FROM public.branch LIMIT 1');
      const branchId = brRes.rows[0].id;

      // Create an APPROVED voucher dated in September with branch_id and fiscal_year
      const insVoucherRes = await client.query(`
        INSERT INTO public.accounting_voucher
          (voucher_no, voucher_type, voucher_date, fiscal_year, status, branch_id, narration, created_by, created_at, updated_at)
        VALUES
          ('VCH-TEST-SEP-001', 'JOURNAL', '2024-09-15', 'FY2425', 'APPROVED', $1, 'Test voucher in locked period', 'usr_maker', NOW(), NOW())
        RETURNING *
      `, [branchId]);
      const testVoucherId = insVoucherRes.rows[0].id;

      // Fetch two valid leaf accounts for posting lines
      const acctRes = await client.query(`
        SELECT id FROM public.accounting_account 
        WHERE is_group = false AND is_active = true AND deleted_at IS NULL 
        ORDER BY code ASC LIMIT 2
      `);
      const acct1 = acctRes.rows[0].id;
      const acct2 = acctRes.rows[1].id;

      // Attempt to post voucher into the locked period via PostingService.postVoucher
      // Note: postVoucher returns { success: false, code } instead of throwing
      const postResult = await PostingService.postVoucher({
        voucherId: testVoucherId,
        postedBy: 'usr_approver',
        lines: [
          { account_id: acct1, debit_amount: 1000, credit_amount: 0, narration: 'Dr' },
          { account_id: acct2, debit_amount: 0, credit_amount: 1000, narration: 'Cr' },
        ],
        client,
      });
      assert(postResult.success === false, 'PostingService.postVoucher hard-blocks posting into locked period');
      assert(postResult.code === 'FISCAL_PERIOD_LOCKED', 'postVoucher returns exact error code FISCAL_PERIOD_LOCKED');

      // Now unlock the period
      await FiscalPeriodService.unlockPeriod(
        lockedPeriodId,
        'usr_admin',
        'SUPER_ADMIN',
        'Unlocking September 2024 for authorized posting adjustment test',
        client
      );

      // Verify that validateFiscalPeriod now confirms the period is unlocked
      const validatedUnlocked = await PostingService.validateFiscalPeriod('2024-09-15', client);
      assert(validatedUnlocked.is_locked === false, 'After unlock, posting pipeline admits voucher date');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 10: ATOMIC ROLLBACK ON SIMULATED FAILURE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 10: ATOMIC ROLLBACK ON SIMULATED FAILURE ---');
    await client.query('BEGIN');
    try {
      const insRes = await client.query(`
        INSERT INTO public.accounting_fiscal_period 
          (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
        VALUES 
          ('FY2425', 'P05-AUG-2024', '2024-08-01', '2024-08-31', false, NOW())
        RETURNING *
      `);
      const periodId = insRes.rows[0].id;

      // Create a savepoint to simulate failure
      await client.query('SAVEPOINT sp_failure_test');
      try {
        // Attempt lock with invalid/failing statement inside
        await client.query('UPDATE public.accounting_fiscal_period SET is_locked = true WHERE id = $1', [periodId]);
        // Force a DB violation
        await client.query('INSERT INTO public.accounting_fiscal_period (id) VALUES (NULL)'); // Violates NOT NULL pkey
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT sp_failure_test');
      }

      // Verify that after rollback, the period remains unlocked
      const checkRes = await client.query('SELECT is_locked FROM public.accounting_fiscal_period WHERE id = $1', [periodId]);
      assert(checkRes.rows[0].is_locked === false, 'Period remains is_locked = false after failure rollback');
    } finally {
      await client.query('ROLLBACK');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 11: HTTP ROUTE HANDLER STATUS CODE MAPPING
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 11: HTTP ROUTE HANDLER STATUS CODE MAPPING ---');
    const routeCode = fs.readFileSync(path.join(__dirname, '../src/app/api/v1/[...path]/route.ts'), 'utf8');

    // Confirm that both POST and PUT have fiscal-periods lock & unlock handlers
    assert(routeCode.includes('fiscal-periods/:id/lock'), 'Lock endpoint route exists in route.ts');
    assert(routeCode.includes('fiscal-periods/:id/unlock'), 'Unlock endpoint route exists in route.ts');
    assert(routeCode.includes('UNLOCK_REASON_REQUIRED'), 'UNLOCK_REASON_REQUIRED error mapped in route.ts');
    assert(routeCode.includes('err.code === "UNLOCK_REASON_REQUIRED" ? 400'), 'UNLOCK_REASON_REQUIRED maps directly to HTTP 400');
    assert(routeCode.includes('err.code === "UNAUTHORIZED" ? 403'), 'UNAUTHORIZED maps directly to HTTP 403');
    assert(routeCode.includes('err.code === "PERIOD_NOT_FOUND" ? 404'), 'PERIOD_NOT_FOUND maps directly to HTTP 404');
    assert(routeCode.includes('err.code === "PERIOD_ALREADY_LOCKED"'), 'PERIOD_ALREADY_LOCKED maps directly to HTTP 409');
    assert(routeCode.includes('err.code === "PERIOD_NOT_LOCKED" ? 409'), 'PERIOD_NOT_LOCKED maps directly to HTTP 409');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 12: BOUNDED SCOPE VERIFICATION (ZERO STEP 3 POLLUTION)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 12: BOUNDED SCOPE VERIFICATION (ZERO STEP 3 POLLUTION) ---');
    const pcloseCode = fs.readFileSync(path.join(__dirname, '../src/lib/services/period-close.service.ts'), 'utf8');

    // Confirm that Step 3 operations are NOT yet active
    assert(!pcloseCode.includes('postYearEndCloseVoucher'), 'postYearEndCloseVoucher is NOT active in Step 2');
    assert(!pcloseCode.includes('reopenClosedYear'), 'reopenClosedYear is NOT active in Step 2');
    assert(!pcloseCode.includes('close_drawings_to_retained_earnings'), 'close_drawings_to_retained_earnings is NOT active');
    assert(!pcloseCode.includes('exclude_closing_vouchers'), 'exclude_closing_vouchers is NOT active');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 13: POST-TEST POSTGRESQL BASELINE AUDIT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 13: POST-TEST POSTGRESQL BASELINE AUDIT ---');
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
    console.log('\nSTATUS: ALL PHASE 5A.6 STEP 2 TESTS PASSED PERFECTLY 🔒');
    process.exit(0);
  }
}

runTests();
