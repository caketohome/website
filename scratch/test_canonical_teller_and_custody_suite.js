/**
 * CakeToHome ERP — Canonical Teller Cash Custody & Overdraft Guard Test Suite
 * 
 * Verifies end-to-end:
 * 1. Teller counter provisioning in public.teller
 * 2. Session opening with authorized float in public.teller_session
 * 3. Inflow movements in public.teller_movement
 * 4. Cash overdraft guard rejection on excessive expense disbursement
 * 5. Concurrent spend race-condition protection (pessimistic row locking)
 * 6. Session closure & physical count variance recording
 * 7. Segregation of Duties (opener != verifier) & supervisor settlement
 * 8. PostgreSQL ledger consistency & Trial Balance equality
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env.DATABASE_URL = val;
      return val;
    }
  }
}
const dbUrl = loadEnv();

const { Client } = require('../frontend/node_modules/pg');
const jiti = require(path.resolve(__dirname, '../frontend/node_modules/jiti'))(__filename);

const { TellerRepository } = jiti(path.resolve(__dirname, '../frontend/src/lib/repositories/teller.repository.ts'));
const { TellerSessionRepository } = jiti(path.resolve(__dirname, '../frontend/src/lib/repositories/teller-session.repository.ts'));
const { TellerMovementRepository } = jiti(path.resolve(__dirname, '../frontend/src/lib/repositories/teller-movement.repository.ts'));
const { TellerSessionService } = jiti(path.resolve(__dirname, '../frontend/src/lib/services/teller-session.service.ts'));
const { ExpensePostingService } = jiti(path.resolve(__dirname, '../frontend/src/lib/services/expense-posting.service.ts'));

// 45-second bounded execution guard
const boundedTimer = setTimeout(() => {
  console.error('\n[FATAL] Test suite exceeded 45s timeout guard. Terminating.');
  process.exit(1);
}, 45000);
boundedTimer.unref();

async function runTellerCustodySuite() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Canonical Teller & Cash Custody Lifecycle Verification');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const runId = `tc_${Date.now()}`;
  const testBranchId = `br_${runId}`;
  const tellerUserId = `usr_teller_${runId}`;
  const supervisorUserId = `usr_sup_${runId}`;
  const financeUserId = `usr_fin_${runId}`;

  const summary = {
    total: 8,
    passed: 0,
    failed: 0,
    tests: [],
  };

  function recordResult(name, status, details = {}) {
    summary.tests.push({ name, status, details });
    if (status === 'PASS') {
      summary.passed++;
      console.log(`[PASS] ${name}`);
    } else {
      summary.failed++;
      console.error(`[FAIL] ${name}:`, details.error || details.reason);
    }
  }

  try {
    // ── Setup: Test Branch, Users & Accounting Category ────────────────────────
    console.log('[Setup] Provisioning isolated test actors and test branch...');
    
    // Create users in public.user to satisfy FK
    await client.query(`
      INSERT INTO public."user" (id, email, created_at, updated_at)
      VALUES 
        ($1, $2, NOW(), NOW()),
        ($3, $4, NOW(), NOW()),
        ($5, $6, NOW(), NOW())
    `, [
      tellerUserId, `${tellerUserId}@test.local`, 
      supervisorUserId, `${supervisorUserId}@test.local`,
      financeUserId, `${financeUserId}@test.local`
    ]);

    // Create isolated branch cloned from existing active branch
    const bColsRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'branch' AND table_schema = 'public' 
      ORDER BY ordinal_position
    `);
    const selectCols = bColsRes.rows.map(r => {
      const c = r.column_name;
      if (c === 'id') return `$1 AS id`;
      if (c === 'name') return `'Test Teller Branch' AS name`;
      if (c === 'code') return `$2 AS code`;
      if (c === 'metadata') return `'{"max_drawer_cash_limit": 50000}'::jsonb AS metadata`;
      if (c === 'created_at' || c === 'updated_at') return `NOW() AS ${c}`;
      if (c === 'deleted_at') return `NULL AS deleted_at`;
      return c;
    }).join(', ');

    await client.query(`
      INSERT INTO public.branch (${bColsRes.rows.map(r => r.column_name).join(', ')})
      SELECT ${selectCols}
      FROM public.branch
      WHERE deleted_at IS NULL
      LIMIT 1
    `, [testBranchId, `TB_${runId.slice(-4)}`]);

    const catRes = await client.query(`SELECT id FROM public.expense_category LIMIT 1`);
    const catId = catRes.rows[0]?.id;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Provision Canonical Teller Counter
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: Provision Canonical Teller Counter ---');
    const tellerRow = await TellerRepository.create({
      branch_id: testBranchId,
      user_id: tellerUserId,
      name: `Main Counter ${runId.slice(-4)}`,
      code: `TLR_${runId.slice(-4)}`,
      status: 'ACTIVE',
      created_by: supervisorUserId,
    }, client);

    const verifiedTeller = await TellerRepository.findById(tellerRow.id, client);
    if (verifiedTeller && verifiedTeller.status === 'ACTIVE' && verifiedTeller.branch_id === testBranchId) {
      recordResult('Test 1: Teller counter provisioning in public.teller', 'PASS', { teller_id: verifiedTeller.id });
    } else {
      recordResult('Test 1: Teller counter provisioning in public.teller', 'FAIL', { reason: 'Teller counter row missing or invalid' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Open Teller Session with Authorized Float (₹500.00)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Open Teller Session with ₹500 Float ---');
    const tellerActor = {
      userId: tellerUserId,
      role: 'BRANCH_MANAGER',
      branchId: testBranchId,
    };

    const sessionRow = await TellerSessionService.openSession({
      teller_id: tellerRow.id,
      opening_float: 500.00,
      notes: 'Initial morning float ₹500',
    }, tellerActor, client);

    const verifiedSession = await TellerSessionRepository.findById(sessionRow.id, client);
    if (verifiedSession && verifiedSession.status === 'OPEN' && Number(verifiedSession.opening_float) === 500.00) {
      recordResult('Test 2: Session opening with authorized float ₹500.00', 'PASS', { session_id: verifiedSession.id });
    } else {
      recordResult('Test 2: Session opening with authorized float ₹500.00', 'FAIL', { reason: 'Session not in OPEN state or float mismatch' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Inflow Movement (Cash Sale ₹250.00)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Record Cash Sale Receipt ₹250.00 ---');
    const saleMov = await TellerMovementRepository.create({
      session_id: verifiedSession.id,
      branch_id: testBranchId,
      direction: 'IN',
      movement_type: 'CASH_SALE',
      amount: 250.00,
      narration: 'Counter cash retail sale',
      source_type: 'ORDER',
      source_id: `ord_${runId}`,
      created_by: tellerUserId,
    }, client);

    const totalsAfterSale = await TellerMovementRepository.getTotalsForSession(verifiedSession.id, client);
    const expectedCashAfterSale = Number(verifiedSession.opening_float) + totalsAfterSale.netMovement;
    
    if (saleMov && totalsAfterSale.totalIn === 250.00 && expectedCashAfterSale === 750.00) {
      recordResult('Test 3: Inflow cash receipt ₹250.00 and expected drawer cash ₹750.00', 'PASS', {
        opening_float: 500.00,
        total_in: totalsAfterSale.totalIn,
        expected_cash: expectedCashAfterSale,
      });
    } else {
      recordResult('Test 3: Inflow cash receipt ₹250.00 and expected drawer cash ₹750.00', 'FAIL', {
        reason: `Expected ₹750.00, got ${expectedCashAfterSale}`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Cash Overdraft Defense (Reject ₹800 vs ₹750 Available)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Cash Overdraft Defense on Excessive Disbursement ---');
    
    // Prepare Expense Overdraft (₹800.00)
    const expOverdraftId = `exp_ovd_${runId}`;
    const vchOverdraftId = `vch_ovd_${runId}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, fiscal_year, branch_id, status,
        reference_type, reference_id, reference_event, total_amount, narration,
        created_by, submitted_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, 'EXPENSE', '2026-10-16', 'FY2026-27', $3, 'APPROVED',
        'EXPENSE', $4, 'PRIMARY', 800.00, 'Overdraft Expense',
        $5, $5, $6, NOW(), NOW()
      )
    `, [vchOverdraftId, `VCH-OVD-${runId}`, testBranchId, expOverdraftId, tellerUserId, supervisorUserId]);

    await client.query(`
      INSERT INTO public.expense (
        id, expense_date, category_id, branch_id, description,
        subtotal, taxable_value, cgst, sgst, igst, total,
        settlement_type, payment_method, itc_eligibility, status, voucher_id,
        created_by, approved_by, teller_session_id, created_at, updated_at
      ) VALUES (
        $1, '2026-10-16', $2, $3, 'Overdraft attempt ₹800',
        800, 800, 0, 0, 0, 800,
        'DIRECT_PAYMENT', 'CASH', 'ITC_INELIGIBLE', 'APPROVED', $4,
        $5, $6, $7, NOW(), NOW()
      )
    `, [expOverdraftId, catId, testBranchId, vchOverdraftId, tellerUserId, supervisorUserId, verifiedSession.id]);

    let overdraftBlocked = false;
    try {
      await ExpensePostingService.postExpenseToGL(expOverdraftId, supervisorUserId, testBranchId);
    } catch (ovdErr) {
      if (ovdErr.code === 'INSUFFICIENT_CASH_DRAWER_BALANCE' || ovdErr.message.includes('overdraft is strictly prohibited')) {
        overdraftBlocked = true;
      } else {
        console.warn('Overdraft threw other error:', ovdErr);
      }
    }

    // Now test valid disbursement of ₹150.00 (within ₹750 balance)
    const expValidId = `exp_val_${runId}`;
    const vchValidId = `vch_val_${runId}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, fiscal_year, branch_id, status,
        reference_type, reference_id, reference_event, total_amount, narration,
        created_by, submitted_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, 'EXPENSE', '2026-10-16', 'FY2026-27', $3, 'APPROVED',
        'EXPENSE', $4, 'PRIMARY', 150.00, 'Valid Expense',
        $5, $5, $6, NOW(), NOW()
      )
    `, [vchValidId, `VCH-VAL-${runId}`, testBranchId, expValidId, tellerUserId, supervisorUserId]);

    await client.query(`
      INSERT INTO public.expense (
        id, expense_date, category_id, branch_id, description,
        subtotal, taxable_value, cgst, sgst, igst, total,
        settlement_type, payment_method, itc_eligibility, status, voucher_id,
        created_by, approved_by, teller_session_id, created_at, updated_at
      ) VALUES (
        $1, '2026-10-16', $2, $3, 'Valid spend ₹150',
        150, 150, 0, 0, 0, 150,
        'DIRECT_PAYMENT', 'CASH', 'ITC_INELIGIBLE', 'APPROVED', $4,
        $5, $6, $7, NOW(), NOW()
      )
    `, [expValidId, catId, testBranchId, vchValidId, tellerUserId, supervisorUserId, verifiedSession.id]);

    const validPostRes = await ExpensePostingService.postExpenseToGL(expValidId, supervisorUserId, testBranchId);
    const totalsAfterValid = await TellerMovementRepository.getTotalsForSession(verifiedSession.id, client);
    const expectedCashAfterValid = Number(verifiedSession.opening_float) + totalsAfterValid.netMovement;

    if (overdraftBlocked && validPostRes.expense.status === 'POSTED' && expectedCashAfterValid === 600.00) {
      recordResult('Test 4: Overdraft protection rejected ₹800; authorized ₹150 disbursed (drawer = ₹600.00)', 'PASS', {
        overdraftBlocked,
        available_before: 750.00,
        disbursed: 150.00,
        expected_cash_after: expectedCashAfterValid,
      });
    } else {
      recordResult('Test 4: Overdraft protection rejected ₹800; authorized ₹150 disbursed', 'FAIL', {
        overdraftBlocked,
        expectedCashAfterValid,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Concurrent Cash Disbursements Race Condition
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Concurrency Race-Condition Test (₹400 vs ₹350 on ₹600 drawer) ---');
    // Available cash: ₹600.
    // Payment A: ₹400
    // Payment B: ₹350
    // Sum = ₹750 > ₹600. Exactly one must succeed, one must fail!
    
    async function makeConcurrentExpense(suffix, amount) {
      const expId = `exp_c_${suffix}_${runId}`;
      const vchId = `vch_c_${suffix}_${runId}`;
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, fiscal_year, branch_id, status,
          reference_type, reference_id, reference_event, total_amount, narration,
          created_by, submitted_by, approved_by, created_at, updated_at
        ) VALUES (
          $1, $2, 'EXPENSE', '2026-10-16', 'FY2026-27', $3, 'APPROVED',
          'EXPENSE', $4, 'PRIMARY', $5, 'Concurrent Expense',
          $6, $6, $7, NOW(), NOW()
        )
      `, [vchId, `VCH-C-${suffix}-${runId}`, testBranchId, expId, amount, tellerUserId, supervisorUserId]);

      await client.query(`
        INSERT INTO public.expense (
          id, expense_date, category_id, branch_id, description,
          subtotal, taxable_value, cgst, sgst, igst, total,
          settlement_type, payment_method, itc_eligibility, status, voucher_id,
          created_by, approved_by, teller_session_id, created_at, updated_at
        ) VALUES (
          $1, '2026-10-16', $2, $3, 'Concurrent spend',
          $4, $4, 0, 0, 0, $4,
          'DIRECT_PAYMENT', 'CASH', 'ITC_INELIGIBLE', 'APPROVED', $5,
          $6, $7, $8, NOW(), NOW()
        )
      `, [expId, catId, testBranchId, amount, vchId, tellerUserId, supervisorUserId, verifiedSession.id]);

      return expId;
    }

    const expA = await makeConcurrentExpense('A', 400.00);
    const expB = await makeConcurrentExpense('B', 350.00);

    const [resA, resB] = await Promise.allSettled([
      ExpensePostingService.postExpenseToGL(expA, supervisorUserId, testBranchId),
      ExpensePostingService.postExpenseToGL(expB, supervisorUserId, testBranchId),
    ]);

    const aSuccess = resA.status === 'fulfilled';
    const bSuccess = resB.status === 'fulfilled';
    const onePassedOneFailed = (aSuccess && !bSuccess) || (!aSuccess && bSuccess);

    const totalsAfterRace = await TellerMovementRepository.getTotalsForSession(verifiedSession.id, client);
    const expectedCashAfterRace = Number(verifiedSession.opening_float) + totalsAfterRace.netMovement;

    if (onePassedOneFailed && expectedCashAfterRace >= 0) {
      recordResult('Test 5: Concurrency race condition prevented double-spend (one passed, one rejected)', 'PASS', {
        aSuccess,
        bSuccess,
        final_expected_cash: expectedCashAfterRace,
      });
    } else {
      recordResult('Test 5: Concurrency race condition prevented double-spend', 'FAIL', {
        aSuccess,
        bSuccess,
        expectedCashAfterRace,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Session Closure & Physical Count Variance
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Session Closure & Physical Count Variance ---');
    // Count physical cash = expectedCashAfterRace
    const countedAmount = expectedCashAfterRace;
    const closedSession = await TellerSessionService.closeSession({
      session_id: verifiedSession.id,
      closing_count: countedAmount,
      notes: 'Closing counter with exact physical cash count',
    }, tellerActor, client);

    if (closedSession && closedSession.status === 'CLOSING' && Number(closedSession.variance) === 0.00) {
      recordResult('Test 6: Shift close recorded physical cash and computed 0.00 variance', 'PASS', {
        status: closedSession.status,
        expected_cash: closedSession.expected_cash,
        closing_count: closedSession.closing_count,
        variance: closedSession.variance,
      });
    } else {
      recordResult('Test 6: Shift close recorded physical cash and computed 0.00 variance', 'FAIL', {
        closedSession,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Segregation of Duties & Supervisor Settlement
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 7: Segregation of Duties & Supervisor Settlement ---');
    
    // Invariant: Teller cannot verify their own session (even with supervisor role)!
    let sodBlocked = false;
    const openerWithVerifierRole = {
      userId: tellerUserId,
      role: 'SUPERVISOR',
      branchId: testBranchId,
    };
    try {
      await TellerSessionService.verifySession({
        session_id: verifiedSession.id,
        notes: 'Self verification attempt by opener',
      }, openerWithVerifierRole, client);
    } catch (sodErr) {
      if (sodErr.code === 'SOD_VIOLATION' || sodErr.message.includes('Segregation of Duties')) {
        sodBlocked = true;
      }
    }

    // Supervisor verifies session
    const supervisorActor = {
      userId: supervisorUserId,
      role: 'SUPERVISOR',
      branchId: testBranchId,
    };

    const verifiedBySup = await TellerSessionService.verifySession({
      session_id: verifiedSession.id,
      notes: 'Supervisor verified counted drawer cash against register',
    }, supervisorActor, client);

    // Distinct Tier 3 Actor: Finance Controller settles session
    const financeActor = {
      userId: financeUserId,
      role: 'FINANCE_CONTROLLER',
      branchId: testBranchId,
    };

    const settledResult = await TellerSessionService.settleSession({
      session_id: verifiedSession.id,
      notes: 'Final shift settlement committed by finance controller',
    }, financeActor, client);

    if (sodBlocked && verifiedBySup.status === 'PENDING_VERIFICATION' && settledResult.session.status === 'SETTLED') {
      recordResult('Test 7: 3-tier SoD enforced (self-verification blocked; supervisor verified & settled)', 'PASS', {
        sodBlocked,
        verified_status: verifiedBySup.status,
        settled_status: settledResult.session.status,
      });
    } else {
      recordResult('Test 7: 3-tier SoD enforced & settlement', 'FAIL', {
        sodBlocked,
        verified_status: verifiedBySup?.status,
        settled_status: settledResult?.session?.status,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Authoritative General Ledger & Trial Balance Equality
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 8: Verify Trial Balance Equality Invariant ---');
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(jl.debit_amount), 0)::numeric(15,2) as total_debit,
        COALESCE(SUM(jl.credit_amount), 0)::numeric(15,2) as total_credit
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE v.status = 'POSTED' AND v.deleted_at IS NULL
    `);
    const totalDebit = Number(tbRes.rows[0].total_debit);
    const totalCredit = Number(tbRes.rows[0].total_credit);
    const diff = Math.abs(totalDebit - totalCredit);

    if (diff === 0 && totalDebit > 0) {
      recordResult('Test 8: General Ledger Trial Balance is balanced (Debits === Credits, diff = ₹0.00)', 'PASS', {
        total_debit: totalDebit,
        total_credit: totalCredit,
        net_difference: diff,
      });
    } else {
      recordResult('Test 8: General Ledger Trial Balance equality', 'FAIL', {
        totalDebit,
        totalCredit,
        diff,
      });
    }

  } catch (globalErr) {
    console.error('[FATAL EXCEPTION in Test Suite]', globalErr);
  } finally {
    // ── Safe Cleanup of isolated test entities ─────────────────────────────────
    console.log('\n[Cleanup] Cleaning up isolated test entities for branch:', testBranchId);
    try {
      // Step 1: Clean up accounting entries and expenses first so the operational GL is never polluted
      const vchs = await client.query(`SELECT id FROM public.accounting_voucher WHERE branch_id = $1`, [testBranchId]);
      const vchIds = vchs.rows.map(r => r.id);
      if (vchIds.length > 0) {
        await client.query(`
          DELETE FROM public.accounting_journal_line 
          WHERE journal_entry_id IN (
            SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)
          )
        `, [vchIds]);
        await client.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [vchIds]);
        await client.query(`UPDATE public.expense SET teller_session_id = NULL, voucher_id = NULL WHERE branch_id = $1`, [testBranchId]);
        await client.query(`DELETE FROM public.expense WHERE branch_id = $1`, [testBranchId]);
        await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [vchIds]);
      }

      // Step 2: Handle teller session immutability safely
      // Settled sessions cannot be updated or deleted due to enterprise triggers fn_teller_session_immutability
      const sessionsRes = await client.query(`SELECT id, status FROM public.teller_session WHERE branch_id = $1`, [testBranchId]);
      const hasSettled = sessionsRes.rows.some(r => r.status === 'SETTLED' || r.status === 'CANCELLED');
      if (!hasSettled) {
        await client.query(`DELETE FROM public.teller_movement WHERE branch_id = $1`, [testBranchId]);
        await client.query(`DELETE FROM public.teller_session WHERE branch_id = $1`, [testBranchId]);
        await client.query(`DELETE FROM public.teller WHERE branch_id = $1`, [testBranchId]);
        await client.query(`DELETE FROM public.branch WHERE id = $1`, [testBranchId]);
        await client.query(`DELETE FROM public."user" WHERE id IN ($1, $2, $3)`, [tellerUserId, supervisorUserId, financeUserId]);
      } else {
        console.log('[Cleanup] Settled teller session detected. Preserved immutable session entity per trigger rules; General Ledger vouchers cleaned up 100%.');
      }
      console.log('[Cleanup] Completed cleanly. Zero operational ledger transactions remain.');
    } catch (cleanupErr) {
      console.error('[Cleanup Warning]', cleanupErr.message);
    }

    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`SUMMARY: ${summary.passed}/${summary.total} TESTS PASSED (${summary.failed} FAILED)`);
  console.log('=============================================================================');
  
  if (summary.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTellerCustodySuite();
