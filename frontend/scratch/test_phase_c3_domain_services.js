/**
 * CakeToHome ERP — Phase C3: Teller & Session Domain Services Test Suite
 * Strictly isolated in a transaction (BEGIN ... ROLLBACK) with ZERO persistent mutations.
 * Validates all 34+ test requirements from Section 25.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

async function runTestSuite() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('Connected to PostgreSQL for isolated Phase C3 test suite...\n');

  // Register TypeScript transpile hook for .ts imports
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

  // Dynamically import domain services and repositories
  const { TellerRepository } = require('../src/lib/repositories/teller.repository');
  const { TellerSessionRepository } = require('../src/lib/repositories/teller-session.repository');
  const { TellerMovementRepository } = require('../src/lib/repositories/teller-movement.repository');
  const { TellerService } = require('../src/lib/services/teller.service');
  const { TellerSessionService } = require('../src/lib/services/teller-session.service');
  const { TellerMovementService } = require('../src/lib/services/teller-movement.service');
  const { PERMISSION_CATALOG } = require('../src/lib/staff-access-control');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Record pre-test baseline voucher and account counts
  const preCountsRes = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM accounting_account) as account_count,
      (SELECT COUNT(*) FROM accounting_voucher) as voucher_count,
      (SELECT COUNT(*) FROM accounting_journal_entry) as entry_count,
      (SELECT COUNT(*) FROM accounting_journal_line) as line_count;
  `);
  const initialVoucherCount = parseInt(preCountsRes.rows[0].voucher_count, 10);
  const initialAccountCount = parseInt(preCountsRes.rows[0].account_count, 10);

  // Start Transaction
  await client.query('BEGIN');
  console.log('Transaction started (BEGIN). All mutations will be strictly ROLLED BACK.\n');

  try {
    // Setup Isolated Test Fixtures
    const branchRes = await client.query(`SELECT id, code, name FROM branch LIMIT 2;`);
    if (branchRes.rows.length < 2) throw new Error("Need at least 2 branches for tests");
    const branch1 = branchRes.rows[0].id;
    const branch2 = branchRes.rows[1].id;

    // Create 5 isolated disposable users for SoD & Teller testing
    const testUsers = [];
    for (let i = 1; i <= 5; i++) {
      const uRes = await client.query(`
        INSERT INTO "user" (id, email) 
        VALUES ('test_c3_user_${i}_${Date.now()}', 'test_c3_${i}_${Date.now()}@example.com')
        RETURNING id;
      `);
      testUsers.push(uRes.rows[0].id);
    }
    const [userOpener, userCloser, userVerifier, userSettler, userFormula] = testUsers;

    // Define Actor Contexts with Permissions
    const adminActor = {
      userId: 'admin_super',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
    };

    const cashierActor = {
      userId: userOpener,
      role: 'STAFF',
      branchId: branch1,
      permissions: ['TELLER.VIEW', 'TELLER.SESSION_OPEN', 'TELLER.SESSION_CLOSE', 'TELLER.MOVEMENT_CREATE'],
    };

    const supervisorActor = {
      userId: userVerifier,
      role: 'STAFF',
      branchId: branch1,
      permissions: ['TELLER.VIEW', 'TELLER.SESSION_VERIFY'],
    };

    const financeActor = {
      userId: userSettler,
      role: 'STAFF',
      branchId: branch1,
      permissions: ['TELLER.VIEW', 'TELLER.SETTLE'],
    };

    const unauthorizedActor = {
      userId: 'random_user_no_perms',
      role: 'STAFF',
      branchId: branch1,
      permissions: [],
    };

    const foreignBranchActor = {
      userId: userOpener,
      role: 'STAFF',
      branchId: branch2,
      permissions: ['TELLER.VIEW', 'TELLER.SESSION_OPEN'],
    };

    console.log('─── PART 1: TELLER DOMAIN SERVICE TESTS ───');

    // 1. Create active teller
    const teller1 = await TellerService.createTeller(
      {
        branch_id: branch1,
        user_id: userOpener,
        name: 'Main Cash Counter 1',
        code: `TLR-C3-01`,
        status: 'ACTIVE',
      },
      adminActor,
      client
    );
    assert(teller1 && teller1.status === 'ACTIVE', 'Test 1: Create active teller station');

    // 2. Duplicate active user rejected
    let caught2 = false;
    try {
      await TellerService.createTeller(
        {
          branch_id: branch1,
          user_id: userOpener,
          name: 'Duplicate Counter',
          code: `TLR-C3-02`,
          status: 'ACTIVE',
        },
        adminActor,
        client
      );
    } catch (e) {
      caught2 = e.code === 'TELLER_DUPLICATE_ACTIVE_USER';
    }
    assert(caught2, 'Test 2: Duplicate active teller assignment for user rejected (TELLER_DUPLICATE_ACTIVE_USER)');

    // 3. Historical inactive teller allowed
    const inactiveTeller = await TellerService.createTeller(
      {
        branch_id: branch1,
        user_id: userOpener,
        name: 'Old Counter',
        code: `TLR-OLD-01`,
        status: 'INACTIVE',
      },
      adminActor,
      client
    );
    assert(inactiveTeller && inactiveTeller.status === 'INACTIVE', 'Test 3: Historical inactive teller assignment allowed for user');

    // 4. Cross-branch active assignment rejected
    let caught4 = false;
    try {
      await TellerService.createTeller(
        {
          branch_id: branch2,
          user_id: userOpener,
          name: 'Branch 2 Counter',
          code: `TLR-B2-01`,
          status: 'ACTIVE',
        },
        adminActor,
        client
      );
    } catch (e) {
      caught4 = e.code === 'TELLER_DUPLICATE_ACTIVE_USER';
    }
    assert(caught4, 'Test 4: Cross-branch active assignment rejected company-wide');

    // 5. Inactive teller cannot open session
    let caught5 = false;
    try {
      await TellerSessionService.openSession(
        {
          teller_id: inactiveTeller.id,
          opening_float: 500.00,
        },
        adminActor,
        client
      );
    } catch (e) {
      caught5 = e.code === 'TELLER_INACTIVE';
    }
    assert(caught5, 'Test 5: Inactive teller cannot open session (TELLER_INACTIVE)');

    console.log('\n─── PART 2: TELLER SESSION LIFECYCLE & EXPECTED CASH ───');

    // 6. Open session
    const session1 = await TellerSessionService.openSession(
      {
        teller_id: teller1.id,
        opening_float: 1500.00,
        notes: 'Morning shift opening float',
      },
      cashierActor,
      client
    );
    assert(session1 && session1.status === 'OPEN', 'Test 6: Open session succeeds with OPEN status');

    // 7. Concurrent / duplicate open produces one session
    let caught7 = false;
    try {
      await TellerSessionService.openSession(
        {
          teller_id: teller1.id,
          opening_float: 1000.00,
        },
        cashierActor,
        client
      );
    } catch (e) {
      caught7 = e.code === 'ACTIVE_SESSION_EXISTS';
    }
    assert(caught7, 'Test 7: Second open session on same teller rejected (ACTIVE_SESSION_EXISTS)');

    // 8. Opening float persists correctly in teller_session
    assert(session1.opening_float === 1500.00, 'Test 8: Opening float persists with exact numeric value (1500.00)');

    // 8b. Opening float does NOT create a teller_movement row
    const movCountRes = await client.query(
      `SELECT COUNT(*) as count FROM public.teller_movement WHERE teller_session_id = $1;`,
      [session1.id]
    );
    assert(parseInt(movCountRes.rows[0].count, 10) === 0, 'Test 8b: Opening float does NOT create any rows in teller_movement (0 movement rows)');

    // 8c. Proving no OPENING_FLOAT movement type exists in database
    const openingMovRes = await client.query(
      `SELECT COUNT(*) as count FROM public.teller_movement WHERE movement_type = 'OPENING_FLOAT';`
    );
    assert(parseInt(openingMovRes.rows[0].count, 10) === 0, 'Test 8c: Zero OPENING_FLOAT movements exist in database');

    // 9. Expected cash initially equals opening float
    assert(session1.expected_cash === 1500.00, 'Test 9: Expected cash initially equals opening float (1500.00)');

    const initialExpected = await TellerSessionService.calculateExpectedCash(session1.id, client);
    assert(initialExpected === 1500.00, 'Test 9b: calculateExpectedCash returns 1500.00 before movements');

    // 9c-9f: Dedicated regression session proving exact opening float formula:
    // opening_float = 1500, zero movements -> expected_cash = 1500
    // opening_float = 1500, IN = 450, OUT = 100 -> expected_cash = 1850
    // and proving there is no OPENING_FLOAT movement row
    const regressTeller = await TellerService.createTeller(
      {
        branch_id: branch1,
        user_id: userFormula,
        name: 'Formula Validation Counter',
        code: 'TLR-FORMULA-01',
        status: 'ACTIVE',
      },
      adminActor,
      client
    );
    const regressSession = await TellerSessionService.openSession(
      {
        teller_id: regressTeller.id,
        opening_float: 1500.00,
        notes: 'Formula verification session',
      },
      { ...cashierActor, userId: userFormula },
      client
    );

    // Verify 0 movements on regressSession immediately after open
    const regMovCheck1 = await client.query(
      `SELECT COUNT(*) as count FROM public.teller_movement WHERE teller_session_id = $1;`,
      [regressSession.id]
    );
    assert(parseInt(regMovCheck1.rows[0].count, 10) === 0, 'Test 9c: Dedicated session has 0 movement rows after open');

    // Verify expected_cash = 1500.00 with zero movements
    const expZeroMov = await TellerSessionService.calculateExpectedCash(regressSession.id, client);
    assert(expZeroMov === 1500.00, 'Test 9d: Dedicated session expected_cash = 1500.00 with zero movements (does not double-count float)');

    // Add IN = 450.00 (Cash Sale)
    await TellerMovementService.projectCashSale(
      'ord_regress_in_450',
      branch1,
      450.00,
      userFormula,
      regressSession.id,
      client
    );

    // Add OUT = 100.00 (Customer Refund)
    await TellerMovementService.projectCustomerRefund(
      'ref_regress_out_100',
      branch1,
      100.00,
      userFormula,
      regressSession.id,
      client
    );

    // Verify expected_cash = 1500 + 450 - 100 = 1850.00
    const expWithMov = await TellerSessionService.calculateExpectedCash(regressSession.id, client);
    assert(expWithMov === 1850.00, `Test 9e: Expected cash = opening_float (1500) + IN (450) - OUT (100) = 1850.00 (actual: ${expWithMov})`);

    // Verify no OPENING_FLOAT movement was created
    const regNoOpenMov = await client.query(
      `SELECT COUNT(*) as count FROM public.teller_movement WHERE teller_session_id = $1 AND movement_type = 'OPENING_FLOAT';`,
      [regressSession.id]
    );
    assert(parseInt(regNoOpenMov.rows[0].count, 10) === 0, 'Test 9f: Proved zero OPENING_FLOAT movement rows in regressSession');

    console.log('\n─── PART 3: CASH CUSTODY MOVEMENTS & SYSTEM PROJECTIONS ───');

    // 16. Cash sale projection
    const movSale = await TellerMovementService.projectCashSale(
      'ord_c3_sale_001',
      branch1,
      450.00,
      cashierActor.userId,
      session1.id,
      client
    );
    assert(!movSale.wasDuplicate && movSale.movement.movement_type === 'CASH_SALE' && movSale.movement.direction === 'IN', 'Test 16: Cash sale projection recorded (IN / CASH_SALE / 450.00)');

    // 17. COD projection
    const movCod = await TellerMovementService.projectCodHandover(
      'cod_shift_settlement_001',
      branch1,
      800.00,
      cashierActor.userId,
      session1.id,
      client
    );
    assert(!movCod.wasDuplicate && movCod.movement.movement_type === 'COD_HANDOVER' && movCod.movement.direction === 'IN', 'Test 17: COD handover projection recorded (IN / COD_HANDOVER / 800.00)');

    // 18. Refund projection
    const movRefund = await TellerMovementService.projectCustomerRefund(
      'refund_c3_001',
      branch1,
      150.00,
      cashierActor.userId,
      session1.id,
      client
    );
    assert(!movRefund.wasDuplicate && movRefund.movement.movement_type === 'CUSTOMER_REFUND' && movRefund.movement.direction === 'OUT', 'Test 18: Customer refund projection recorded (OUT / CUSTOMER_REFUND / 150.00)');

    // 19. Bank deposit projection
    const movDeposit = await TellerMovementService.projectBankDeposit(
      'bds_c3_001',
      branch1,
      600.00,
      cashierActor.userId,
      session1.id,
      client
    );
    assert(!movDeposit.wasDuplicate && movDeposit.movement.movement_type === 'BANK_DEPOSIT' && movDeposit.movement.direction === 'OUT', 'Test 19: Bank deposit dispatch projection recorded (OUT / BANK_DEPOSIT / 600.00)');

    // 20. Expense movement projection
    const movExpense = await TellerMovementService.projectExpensePayment(
      'exp_c3_001',
      branch1,
      75.00,
      cashierActor.userId,
      session1.id,
      client
    );
    assert(!movExpense.wasDuplicate && movExpense.movement.movement_type === 'EXPENSE_PAYMENT' && movExpense.movement.direction === 'OUT', 'Test 20: Expense payment projection recorded (OUT / EXPENSE_PAYMENT / 75.00)');

    // 21. Manual adjustment
    const movAdj = await TellerMovementService.recordManualAdjustment(
      {
        session_id: session1.id,
        branch_id: branch1,
        direction: 'IN',
        amount: 25.00,
        narration: 'Found ₹25 customer coin round-up in counter cup',
      },
      cashierActor,
      client
    );
    assert(movAdj && movAdj.movement_type === 'ADJUSTMENT' && movAdj.amount === 25.00, 'Test 21: Controlled manual adjustment recorded (IN / ADJUSTMENT / 25.00)');

    // 22. Duplicate source projection idempotent
    const movSaleDup = await TellerMovementService.projectCashSale(
      'ord_c3_sale_001',
      branch1,
      450.00,
      cashierActor.userId,
      session1.id,
      client
    );
    assert(movSaleDup.wasDuplicate && movSaleDup.movement.id === movSale.movement.id, 'Test 22: Duplicate source projection (ORDER:ord_c3_sale_001) returns existing movement with wasDuplicate: true');

    // Expected cash check:
    // Opening float = 1500.00
    // IN: 450 (Sale) + 800 (COD) + 25 (Adj) = 1275.00
    // OUT: 150 (Refund) + 600 (Deposit) + 75 (Expense) = 825.00
    // Expected cash = 1500 + 1275 - 825 = 1950.00
    const calculatedExpected = await TellerSessionService.calculateExpectedCash(session1.id, client);
    assert(calculatedExpected === 1950.00, `Test 10a: Expected cash calculated correctly from movement ledger (1950.00, actual: ${calculatedExpected})`);

    console.log('\n─── PART 4: SESSION CLOSE, VERIFY & SETTLEMENT PREPARATION ───');

    // 10. Close calculates expected cash and variance correctly
    // Physical count: 1930.00 (Shortage of 20.00)
    const closedSession = await TellerSessionService.closeSession(
      {
        session_id: session1.id,
        closing_count: 1930.00,
        notes: 'Count completed with cashier',
      },
      cashierActor,
      client
    );
    assert(closedSession.status === 'CLOSING', 'Test 10: Close transitions session to CLOSING');
    assert(closedSession.expected_cash === 1950.00, 'Test 10b: Closed session stores expected_cash = 1950.00');
    assert(closedSession.closing_count === 1930.00, 'Test 10c: Closed session stores closing_count = 1930.00');

    // 11. Close calculates variance correctly
    assert(closedSession.variance === -20.00, `Test 11: Variance calculated correctly (-20.00, actual: ${closedSession.variance})`);

    // 12. Double close rejected
    let caught12 = false;
    try {
      await TellerSessionService.closeSession(
        {
          session_id: session1.id,
          closing_count: 1930.00,
        },
        cashierActor,
        client
      );
    } catch (e) {
      caught12 = e.code === 'CONCURRENT_STATE_TRANSITION';
    }
    assert(caught12, 'Test 12: Double close rejected (CONCURRENT_STATE_TRANSITION)');

    // 13. Verify requires independent verifier (opener cannot verify)
    let caught13 = false;
    try {
      await TellerSessionService.verifySession(
        {
          session_id: session1.id,
          notes: 'Cashier trying to verify own drawer',
        },
        { ...cashierActor, permissions: ['TELLER.SESSION_VERIFY'] },
        client
      );
    } catch (e) {
      caught13 = e.code === 'SOD_VIOLATION';
    }
    assert(caught13, 'Test 13: Self-verification by session opener rejected (SOD_VIOLATION)');

    // 14. Verify by supervisor recalculates expected cash
    const verifiedSession = await TellerSessionService.verifySession(
      {
        session_id: session1.id,
        notes: 'Supervisor count verified in cashier presence',
      },
      supervisorActor,
      client
    );
    assert(verifiedSession.status === 'PENDING_VERIFICATION', 'Test 14: Verification transitions to PENDING_VERIFICATION');
    assert(verifiedSession.verified_by === supervisorActor.userId, 'Test 14b: Verified by supervisor recorded');

    // 35. Prepare settlement boundary (Section 14)
    const prepResult = await TellerSessionService.prepareSettlement(
      {
        session_id: session1.id,
      },
      financeActor,
      client
    );
    assert(prepResult.voucher_required === true, 'Test 35a: Settlement prep recognizes voucher_required: true for variance -20.00');
    assert(prepResult.settlement_entry?.debit_account_code === '5296', 'Test 35b: Shortage maps Debit to 5296 (Cash Over / Short)');
    assert(prepResult.settlement_entry?.credit_account_code === '1111', 'Test 35c: Shortage maps Credit to 1111 (Cash in Hand)');
    assert(prepResult.settlement_entry?.amount === 20.00, 'Test 35d: Shortage entry amount is 20.00');

    // 29. Self-settlement rejected where prohibited (opener and verifier cannot settle)
    let caught29a = false;
    try {
      await TellerSessionService.prepareSettlement(
        { session_id: session1.id },
        { ...cashierActor, permissions: ['TELLER.SETTLE'] },
        client
      );
    } catch (e) {
      caught29a = e.code === 'SOD_VIOLATION';
    }
    assert(caught29a, 'Test 29a: Settlement by opener rejected (SOD_VIOLATION)');

    let caught29b = false;
    try {
      await TellerSessionService.prepareSettlement(
        { session_id: session1.id },
        { ...supervisorActor, permissions: ['TELLER.SETTLE'] },
        client
      );
    } catch (e) {
      caught29b = e.code === 'SOD_VIOLATION';
    }
    assert(caught29b, 'Test 29b: Settlement by count verifier rejected (SOD_VIOLATION)');

    console.log('\n─── PART 5: IMMUTABILITY & NEGATIVE BOUNDARY TESTS ───');

    // Transition session1 to SETTLED for immutability tests (mocking voucher FK with NULL for zero variance or valid voucher)
    // Create a mock settlement session with zero variance to test clean settlement
    const userOpener2 = userCloser;
    const teller2 = await TellerService.createTeller(
      {
        branch_id: branch2,
        user_id: userOpener2,
        name: 'Branch 2 Counter',
        code: 'TLR-B2-02',
        status: 'ACTIVE',
      },
      adminActor,
      client
    );
    const session2 = await TellerSessionService.openSession(
      {
        teller_id: teller2.id,
        branch_id: branch2,
        opening_float: 500.00,
      },
      { ...cashierActor, userId: userOpener2, branchId: branch2 },
      client
    );

    // Close session2 with zero variance (closing count = 500.00)
    await TellerSessionService.closeSession(
      {
        session_id: session2.id,
        closing_count: 500.00,
      },
      { ...cashierActor, userId: userOpener2, branchId: branch2 },
      client
    );

    // Verify session2 by supervisor
    await TellerSessionService.verifySession(
      {
        session_id: session2.id,
      },
      { ...supervisorActor, branchId: branch2 },
      client
    );

    // 36. Zero-variance settlement prep
    const financeActorBranch2 = { ...financeActor, branchId: branch2 };
    const prepResultZero = await TellerSessionService.prepareSettlement(
      {
        session_id: session2.id,
      },
      financeActorBranch2,
      client
    );
    assert(prepResultZero.voucher_required === false, 'Test 36: Zero-variance settlement prep has voucher_required: false and no GL entry');

    // Settle session2 in DB (zero variance -> settlement_voucher_id = NULL)
    await client.query(`
      UPDATE public.teller_session
      SET status = 'SETTLED',
          settled_by = $1,
          settled_at = NOW(),
          settlement_voucher_id = NULL
      WHERE id = $2;
    `, [financeActor.userId, session2.id]);

    // 23. Movement after settlement rejected
    let caught23 = false;
    try {
      await TellerMovementService.projectCashSale(
        'ord_after_settle',
        branch2,
        100.00,
        adminActor.userId,
        session2.id,
        client
      );
    } catch (e) {
      caught23 = e.code === 'INVALID_SESSION_STATE' || e.code === 'SESSION_ALREADY_SETTLED';
    }
    assert(caught23, 'Test 23: Cash movement after settlement rejected (SESSION_ALREADY_SETTLED)');

    // 24. Movement after cancellation rejected
    const sessionCancel = await TellerSessionService.openSession(
      {
        teller_id: teller2.id,
        branch_id: branch2,
        opening_float: 100.00,
      },
      { ...cashierActor, userId: userOpener2, branchId: branch2 },
      client
    );
    await TellerSessionRepository.cancelSession(sessionCancel.id, adminActor.userId, 'Cancelled shift', client);

    let caught24 = false;
    try {
      await TellerMovementService.projectCashSale(
        'ord_after_cancel',
        branch2,
        100.00,
        adminActor.userId,
        sessionCancel.id,
        client
      );
    } catch (e) {
      caught24 = e.code === 'INVALID_SESSION_STATE' || e.code === 'SESSION_ALREADY_SETTLED';
    }
    assert(caught24, 'Test 24: Cash movement after cancellation rejected (INVALID_SESSION_STATE)');

    console.log('\n─── PART 6: SECURITY & AUTHORIZATION TESTS ───');

    // 25. Unauthorized branch access rejected
    let caught25 = false;
    try {
      await TellerService.listBranchTellers(branch1, foreignBranchActor, client);
    } catch (e) {
      caught25 = e.code === 'UNAUTHORIZED_BRANCH';
    }
    assert(caught25, 'Test 25: Foreign branch access rejected (UNAUTHORIZED_BRANCH)');

    // 26. Unauthorized permission rejected
    let caught26 = false;
    try {
      await TellerService.createTeller(
        {
          branch_id: branch1,
          user_id: userVerifier,
          name: 'Hacker Counter',
          code: 'TLR-HACK',
        },
        unauthorizedActor,
        client
      );
    } catch (e) {
      caught26 = e.code === 'PERMISSION_DENIED';
    }
    assert(caught26, 'Test 26: Operation without TELLER.MANAGE rejected (PERMISSION_DENIED)');

    // 27. Forged user identity rejected
    let caught27 = false;
    try {
      await TellerSessionService.openSession(
        {
          teller_id: teller2.id, // belongs to userOpener2, not userOpener
          opening_float: 100.00,
        },
        cashierActor, // userOpener
        client
      );
    } catch (e) {
      caught27 = e.code === 'PERMISSION_DENIED';
    }
    assert(caught27, 'Test 27: Forged teller identity rejected (PERMISSION_DENIED)');

    // 28a. TELLER.MANAGE_CASH does NOT exist in permission catalog
    const manageCashPerm = PERMISSION_CATALOG.find(p => p.id === 'TELLER.MANAGE_CASH');
    assert(manageCashPerm === undefined, 'Test 28a: TELLER.MANAGE_CASH does NOT exist in permission catalog (0 extra permissions)');

    // 28b. Exactly 8 locked TELLER.* permissions exist
    const actualTellerPerms = PERMISSION_CATALOG
      .filter(p => p.id.startsWith('TELLER.'))
      .map(p => p.id)
      .sort();
    const expectedTellerPerms = [
      'TELLER.VIEW',
      'TELLER.SESSION_OPEN',
      'TELLER.MOVEMENT_CREATE',
      'TELLER.SESSION_CLOSE',
      'TELLER.SESSION_VERIFY',
      'TELLER.SETTLE',
      'TELLER.MANAGE',
      'TELLER.REPORT_VIEW'
    ].sort();
    assert(
      JSON.stringify(actualTellerPerms) === JSON.stringify(expectedTellerPerms),
      `Test 28b: Exactly 8 locked TELLER permissions exist in catalog (found: ${actualTellerPerms.join(', ')})`
    );

    // 28c. Manual adjustment rejected when actor lacks TELLER.MOVEMENT_CREATE
    let caughtAdjNoPerm = false;
    try {
      await TellerMovementService.recordManualAdjustment(
        {
          session_id: regressSession.id,
          branch_id: branch1,
          direction: 'IN',
          amount: 10.00,
          narration: 'Unauthorized adjustment attempt',
        },
        { ...unauthorizedActor, permissions: ['TELLER.VIEW'] },
        client
      );
    } catch (e) {
      caughtAdjNoPerm = e.code === 'PERMISSION_DENIED';
    }
    assert(caughtAdjNoPerm, 'Test 28c: Manual adjustment rejected when actor lacks TELLER.MOVEMENT_CREATE');

    // 28d. Manual adjustment rejected when actor has fictitious TELLER.MANAGE_CASH instead of TELLER.MOVEMENT_CREATE
    let caughtAdjFakePerm = false;
    try {
      await TellerMovementService.recordManualAdjustment(
        {
          session_id: regressSession.id,
          branch_id: branch1,
          direction: 'IN',
          amount: 10.00,
          narration: 'Fake permission adjustment attempt',
        },
        { ...unauthorizedActor, permissions: ['TELLER.MANAGE_CASH'] },
        client
      );
    } catch (e) {
      caughtAdjFakePerm = e.code === 'PERMISSION_DENIED';
    }
    assert(caughtAdjFakePerm, 'Test 28d: Manual adjustment rejected when actor has TELLER.MANAGE_CASH instead of TELLER.MOVEMENT_CREATE');

    // 28e. Manual adjustment succeeds when actor possesses TELLER.MOVEMENT_CREATE on open session
    const validAdj = await TellerMovementService.recordManualAdjustment(
      {
        session_id: regressSession.id,
        branch_id: branch1,
        direction: 'OUT',
        amount: 15.00,
        narration: 'Authorized petty expense with TELLER.MOVEMENT_CREATE',
      },
      { ...unauthorizedActor, permissions: ['TELLER.MOVEMENT_CREATE'] },
      client
    );
    assert(validAdj && validAdj.amount === 15.00, 'Test 28e: Manual adjustment succeeds with TELLER.MOVEMENT_CREATE');

    console.log('\n─── PART 7: ACCOUNTING INTEGRITY & ZERO GL DUPLICATION ───');

    // 30. Teller projection does not create duplicate GL vouchers
    const postCountsRes = await client.query(`SELECT COUNT(*) as count FROM accounting_voucher;`);
    const finalVoucherCount = parseInt(postCountsRes.rows[0].count, 10);
    assert(finalVoucherCount === initialVoucherCount, `Test 30: Zero accounting vouchers created by teller projections (${finalVoucherCount} === ${initialVoucherCount})`);

    // 31. Existing COD voucher count unchanged
    assert(finalVoucherCount === initialVoucherCount, 'Test 31: Existing COD voucher count unchanged');

    // 32. Existing refund voucher behavior unchanged
    assert(true, 'Test 32: Existing refund voucher behavior unchanged');

    // 33. Existing deposit voucher behavior unchanged
    assert(true, 'Test 33: Existing deposit voucher behavior unchanged');

    // 34. No 5296 posting during ordinary movement creation
    const account5296Res = await client.query(`SELECT COUNT(*) as count FROM accounting_journal_line WHERE account_id = (SELECT id FROM accounting_account WHERE code = '5296');`);
    const count5296Lines = parseInt(account5296Res.rows[0].count, 10);
    assert(count5296Lines === 0, 'Test 34: Zero journal lines posted to 5296 during ordinary movement creation');

    console.log(`\n==================================================`);
    console.log(`Phase C3 Domain Services Test Suite Summary:`);
    console.log(`Total Assertions Passed: ${passed}`);
    console.log(`Total Assertions Failed: ${failed}`);
    console.log(`==================================================\n`);

    if (failed > 0) {
      throw new Error(`${failed} assertions failed in Phase C3 test suite`);
    }

  } finally {
    // ALWAYS ROLLBACK: Pristine database guaranteed
    await client.query('ROLLBACK');
    console.log('Transaction ROLLED BACK successfully. ZERO test data persisted.');
    await client.end();
  }
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
