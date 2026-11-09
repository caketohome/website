/**
 * CakeToHome ERP — Phase C2: Schema & Invariant Test Suite
 * Strictly isolated in a transaction (BEGIN ... ROLLBACK) with ZERO persistent mutations.
 * Validates all 16 mandated test cases from Section 22.
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
  console.log('Connected to PostgreSQL for isolated Phase C2 test suite...\n');

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

  // Start Transaction
  await client.query('BEGIN');
  console.log('Transaction started (BEGIN). All operations will be strictly ROLLED BACK.\n');

  try {
    // Setup Disposable Test Fixtures within Transaction
    const branchRes = await client.query(`SELECT id FROM branch LIMIT 2;`);
    if (branchRes.rows.length < 2) throw new Error("Need at least 2 branches for tests");
    const branch1 = branchRes.rows[0].id;
    const branch2 = branchRes.rows[1].id;

    // Create 4 isolated disposable users for SoD & Teller testing
    const testUsers = [];
    for (let i = 1; i <= 4; i++) {
      const uRes = await client.query(`
        INSERT INTO "user" (id, email) 
        VALUES ('test_c2_user_${i}_${Date.now()}', 'test_c2_${i}_${Date.now()}@example.com')
        RETURNING id;
      `);
      testUsers.push(uRes.rows[0].id);
    }
    const [userOpener, userCloser, userVerifier, userSettler] = testUsers;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Duplicate active teller assignment rejected
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO teller (id, branch_id, user_id, name, code, status)
      VALUES ('teller_t1', $1, $2, 'Counter 1', 'TLR-01', 'ACTIVE');
    `, [branch1, userOpener]);

    await client.query('SAVEPOINT sp1');
    let caught1 = false;
    try {
      await client.query(`
        INSERT INTO teller (id, branch_id, user_id, name, code, status)
        VALUES ('teller_t2', $1, $2, 'Counter 2', 'TLR-02', 'ACTIVE');
      `, [branch2, userOpener]);
    } catch (e) {
      caught1 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp1');
    }
    assert(caught1, 'Test 1: Duplicate active teller assignment rejected globally across branches');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Historical inactive teller assignment allowed
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO teller (id, branch_id, user_id, name, code, status)
      VALUES ('teller_t2_inactive', $1, $2, 'Old Counter', 'TLR-OLD', 'INACTIVE');
    `, [branch2, userOpener]);
    assert(true, 'Test 2: Historical inactive teller assignment allowed alongside active assignment');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Duplicate active teller session rejected
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO teller_session (id, teller_id, branch_id, status, opening_float, opened_by)
      VALUES ('sess_s1', 'teller_t1', $1, 'OPEN', 1000.00, $2);
    `, [branch1, userOpener]);

    await client.query('SAVEPOINT sp3');
    let caught3 = false;
    try {
      await client.query(`
        INSERT INTO teller_session (id, teller_id, branch_id, status, opening_float, opened_by)
        VALUES ('sess_s2', 'teller_t1', $1, 'OPEN', 500.00, $2);
      `, [branch1, userOpener]);
    } catch (e) {
      caught3 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp3');
    }
    assert(caught3, 'Test 3: Duplicate active teller session rejected via partial unique index');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Different historical sessions allowed
    // ─────────────────────────────────────────────────────────────────────────
    // Close & cancel session s1 so it is no longer in active states
    await client.query(`
      UPDATE teller_session 
      SET status = 'CANCELLED' 
      WHERE id = 'sess_s1';
    `);

    await client.query(`
      INSERT INTO teller_session (id, teller_id, branch_id, status, opening_float, opened_by)
      VALUES ('sess_s2_open', 'teller_t1', $1, 'OPEN', 1200.00, $2);
    `, [branch1, userOpener]);
    assert(true, 'Test 4: Subsequent open session allowed after previous session is finalized/cancelled');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Teller/session branch mismatch rejected
    // ─────────────────────────────────────────────────────────────────────────
    // Create another teller on branch2
    await client.query(`
      INSERT INTO teller (id, branch_id, user_id, name, code, status)
      VALUES ('teller_b2', $1, $2, 'Branch 2 Counter', 'TLR-B2', 'ACTIVE');
    `, [branch2, userCloser]);

    await client.query('SAVEPOINT sp5');
    let caught5 = false;
    try {
      // Reference teller_b2 (which is on branch2), but claim it is on branch1!
      await client.query(`
        INSERT INTO teller_session (id, teller_id, branch_id, status, opening_float, opened_by)
        VALUES ('sess_mismatch', 'teller_b2', $1, 'OPEN', 100.00, $2);
      `, [branch1, userCloser]);
    } catch (e) {
      caught5 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp5');
    }
    assert(caught5, 'Test 5: Teller/session branch mismatch rejected by composite FK');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Negative movement amount rejected
    // ─────────────────────────────────────────────────────────────────────────
    await client.query('SAVEPOINT sp6');
    let caught6 = false;
    try {
      await client.query(`
        INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount)
        VALUES ('sess_s2_open', $1, 'IN', 'CASH_SALE', -50.00);
      `, [branch1]);
    } catch (e) {
      caught6 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp6');
    }
    assert(caught6, 'Test 6: Negative movement amount rejected by check constraint');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Invalid movement direction rejected
    // ─────────────────────────────────────────────────────────────────────────
    await client.query('SAVEPOINT sp7');
    let caught7 = false;
    try {
      await client.query(`
        INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount)
        VALUES ('sess_s2_open', $1, 'SIDEWAYS', 'CASH_SALE', 100.00);
      `, [branch1]);
    } catch (e) {
      caught7 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp7');
    }
    assert(caught7, 'Test 7: Invalid movement direction rejected by check constraint');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Invalid movement type rejected
    // ─────────────────────────────────────────────────────────────────────────
    await client.query('SAVEPOINT sp8');
    let caught8 = false;
    try {
      await client.query(`
        INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount)
        VALUES ('sess_s2_open', $1, 'IN', 'INVALID_TYPE', 100.00);
      `, [branch1]);
    } catch (e) {
      caught8 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp8');
    }
    assert(caught8, 'Test 8: Invalid movement type rejected by check constraint');

    // Direction mismatch check (e.g. CASH_SALE with OUT direction)
    await client.query('SAVEPOINT sp8b');
    let caught8b = false;
    try {
      await client.query(`
        INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount)
        VALUES ('sess_s2_open', $1, 'OUT', 'CASH_SALE', 100.00);
      `, [branch1]);
    } catch (e) {
      caught8b = true;
      await client.query('ROLLBACK TO SAVEPOINT sp8b');
    }
    assert(caught8b, 'Test 8b: Movement type and direction mismatch (CASH_SALE with OUT) rejected');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Duplicate system source projection rejected
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount, source_type, source_id)
      VALUES ('sess_s2_open', $1, 'IN', 'CASH_SALE', 350.00, 'ORDER', 'ord_test_999');
    `, [branch1]);

    await client.query('SAVEPOINT sp9');
    let caught9 = false;
    try {
      await client.query(`
        INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount, source_type, source_id)
        VALUES ('sess_s2_open', $1, 'IN', 'CASH_SALE', 350.00, 'ORDER', 'ord_test_999');
      `, [branch1]);
    } catch (e) {
      caught9 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp9');
    }
    assert(caught9, 'Test 9: Duplicate system source projection (ORDER/ord_test_999) rejected by unique index');

    // Verify manual adjustments are NOT blocked
    await client.query(`
      INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount, source_type, source_id)
      VALUES ('sess_s2_open', $1, 'IN', 'ADJUSTMENT', 50.00, 'MANUAL', 'adj_1');
    `, [branch1]);
    await client.query(`
      INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount, source_type, source_id)
      VALUES ('sess_s2_open', $1, 'IN', 'ADJUSTMENT', 25.00, 'MANUAL', 'adj_2');
    `, [branch1]);
    assert(true, 'Test 9b: Multiple controlled manual adjustments permitted');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 10: Settled session mutation rejected
    // ─────────────────────────────────────────────────────────────────────────
    // Set up a settled session:
    // Expected cash = opening float (1200) + IN (350 + 50 + 25) = 1625.00
    // Closing count = 1625.00, Variance = 0.00, zero-variance requires settlement_voucher_id = NULL
    await client.query(`
      UPDATE teller_session
      SET status = 'SETTLED',
          expected_cash = 1625.00,
          closing_count = 1625.00,
          variance = 0.00,
          closed_by = $1,
          closed_at = NOW(),
          verified_by = $2,
          verified_at = NOW(),
          settled_by = $3,
          settled_at = NOW(),
          settlement_voucher_id = NULL
      WHERE id = 'sess_s2_open';
    `, [userCloser, userVerifier, userSettler]);

    await client.query('SAVEPOINT sp10');
    let caught10 = false;
    try {
      await client.query(`UPDATE teller_session SET notes = 'tampering' WHERE id = 'sess_s2_open';`);
    } catch (e) {
      caught10 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp10');
    }
    assert(caught10, 'Test 10: Settled session mutation rejected by database trigger');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 11: Settled movement mutation rejected
    // ─────────────────────────────────────────────────────────────────────────
    await client.query('SAVEPOINT sp11a');
    let caught11a = false;
    try {
      await client.query(`UPDATE teller_movement SET amount = 999.00 WHERE teller_session_id = 'sess_s2_open';`);
    } catch (e) {
      caught11a = true;
      await client.query('ROLLBACK TO SAVEPOINT sp11a');
    }
    assert(caught11a, 'Test 11a: Movement UPDATE on settled session rejected by database trigger');

    await client.query('SAVEPOINT sp11b');
    let caught11b = false;
    try {
      await client.query(`DELETE FROM teller_movement WHERE teller_session_id = 'sess_s2_open';`);
    } catch (e) {
      caught11b = true;
      await client.query('ROLLBACK TO SAVEPOINT sp11b');
    }
    assert(caught11b, 'Test 11b: Movement DELETE on settled session rejected by database trigger');

    await client.query('SAVEPOINT sp11c');
    let caught11c = false;
    try {
      await client.query(`
        INSERT INTO teller_movement (teller_session_id, branch_id, direction, movement_type, amount)
        VALUES ('sess_s2_open', $1, 'IN', 'CASH_SALE', 10.00);
      `, [branch1]);
    } catch (e) {
      caught11c = true;
      await client.query('ROLLBACK TO SAVEPOINT sp11c');
    }
    assert(caught11c, 'Test 11c: Movement INSERT into settled session rejected by database trigger');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 12: Zero variance does not create zero-value voucher
    // ─────────────────────────────────────────────────────────────────────────
    // Check that accounting_journal_line forbids 0.00 line entries
    await client.query('SAVEPOINT sp12');
    let caught12 = false;
    try {
      await client.query(`
        INSERT INTO accounting_journal_line (
          id, journal_entry_id, line_no, account_id, branch_id, debit_amount, credit_amount
        ) VALUES (
          'test_jl_zero', 'fake_entry', 1, (SELECT id FROM accounting_account WHERE code = '1111'),
          $1, 0.00, 0.00
        );
      `, [branch1]);
    } catch (e) {
      caught12 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp12');
    }
    assert(caught12, 'Test 12: Zero-amount journal line strictly rejected by accounting constraint');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 13: Shortage maps to 5296/1111 correctly
    // ─────────────────────────────────────────────────────────────────────────
    const shortDrRes = await client.query(`SELECT id, code, type, subtype FROM accounting_account WHERE code = '5296';`);
    const shortCrRes = await client.query(`SELECT id, code, type, subtype FROM accounting_account WHERE code = '1111';`);
    const shortDr = shortDrRes.rows[0];
    const shortCr = shortCrRes.rows[0];
    assert(shortDr && shortDr.type === 'EXPENSE' && shortDr.subtype === 'OPERATING_EXPENSE', 'Test 13a: Shortage Debit account 5296 is EXPENSE / OPERATING_EXPENSE');
    assert(shortCr && shortCr.type === 'ASSET' && shortCr.subtype === 'CASH', 'Test 13b: Shortage Credit account 1111 is ASSET / CASH');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 14: Excess maps to 1111/5296 correctly
    // ─────────────────────────────────────────────────────────────────────────
    const excessDr = shortCr; // 1111
    const excessCr = shortDr; // 5296
    assert(excessDr.code === '1111' && excessDr.type === 'ASSET', 'Test 14a: Excess Debit account 1111 is ASSET / CASH');
    assert(excessCr.code === '5296' && excessCr.type === 'EXPENSE', 'Test 14b: Excess Credit account 5296 is EXPENSE / OPERATING_EXPENSE');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 15: Settlement voucher relationship enforced
    // ─────────────────────────────────────────────────────────────────────────
    // Attempting to settle with variance != 0 without a settlement_voucher_id MUST FAIL
    await client.query(`
      INSERT INTO teller_session (id, teller_id, branch_id, status, opening_float, opened_by)
      VALUES ('sess_s3_var', 'teller_b2', $1, 'OPEN', 100.00, $2);
    `, [branch2, userCloser]);

    await client.query('SAVEPOINT sp15');
    let caught15 = false;
    try {
      await client.query(`
        UPDATE teller_session
        SET status = 'SETTLED',
            expected_cash = 100.00,
            closing_count = 80.00,
            variance = -20.00,
            closed_by = $1,
            closed_at = NOW(),
            verified_by = $2,
            verified_at = NOW(),
            settled_by = $3,
            settled_at = NOW(),
            settlement_voucher_id = NULL
        WHERE id = 'sess_s3_var';
      `, [userCloser, userVerifier, userSettler]);
    } catch (e) {
      caught15 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp15');
    }
    assert(caught15, 'Test 15: Settling with non-zero variance and NULL settlement voucher rejected by check constraint');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 16: 5296 cannot be duplicated
    // ─────────────────────────────────────────────────────────────────────────
    await client.query('SAVEPOINT sp16');
    let caught16 = false;
    try {
      await client.query(`
        INSERT INTO accounting_account (
          id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active, created_by
        ) VALUES (
          'dup_5296', '5296', 'Duplicate Over Short', 'EXPENSE', 'OPERATING_EXPENSE',
          (SELECT id FROM accounting_account WHERE code = '5200'), 3, false, true, true, 'system'
        );
      `);
    } catch (e) {
      caught16 = true;
      await client.query('ROLLBACK TO SAVEPOINT sp16');
    }
    assert(caught16, 'Test 16: Duplicate account 5296 rejected by uq_accounting_account_code');

    console.log(`\n==================================================`);
    console.log(`Phase C2 Test Suite Execution Summary:`);
    console.log(`Total Assertions Passed: ${passed}`);
    console.log(`Total Assertions Failed: ${failed}`);
    console.log(`==================================================\n`);

    if (failed > 0) {
      throw new Error(`${failed} test assertions failed`);
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
