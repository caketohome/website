/**
 * CakeToHome ERP — Phase 4F Step 4.10.5-A Schema & DTO Tests
 * Bank Statement Reconciliation: Additive Schema Foundation
 *
 * Test domains:
 * 1. Schema existence and structure verification
 * 2. CHECK constraint enforcement
 * 3. FK constraint enforcement
 * 4. UNIQUE constraint enforcement (deduplication)
 * 5. SoD constraint enforcement
 * 6. Baseline safety verification (zero financial postings)
 * 7. Historical quarantine verification (173 orders, 53 payments untouched)
 * 8. Evidence-only design verification (no vouchers/journals created)
 *
 * CLEANUP: All test data is cleaned up at the end (LIFO order respecting FKs).
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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
  const rootEnvPath = path.join(__dirname, '../../backend/.env');
  if (fs.existsSync(rootEnvPath)) {
    const envContent = fs.readFileSync(rootEnvPath, 'utf8');
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
  throw new Error('No DATABASE_URL found');
}

let client;
let passed = 0;
let failed = 0;
const failures = [];
// Track test-created IDs for cleanup
const testBankAccountId = `test_ba_4_10_5a_${Date.now()}`;
const testImportId = `test_bsi_4_10_5a_${Date.now()}`;
const testLineId1 = `test_bsl_4_10_5a_1_${Date.now()}`;
const testLineId2 = `test_bsl_4_10_5a_2_${Date.now()}`;
const testSessionId = `test_brs_4_10_5a_${Date.now()}`;
const testMatchId = `test_brm_4_10_5a_${Date.now()}`;

function assert(testName, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ ${testName}: ${detail || 'FAILED'}`);
    failed++;
    failures.push(testName);
  }
}

async function expectConstraintViolation(testName, queryFn, expectedPattern) {
  try {
    await queryFn();
    assert(testName, false, 'Expected constraint violation but query succeeded');
  } catch (err) {
    const matches = expectedPattern ? err.message.includes(expectedPattern) || err.code === '23514' || err.code === '23505' || err.code === '23503' : true;
    assert(testName, matches, `Error: ${err.message}`);
  }
}

async function setup() {
  // Create a test bank account for FK references
  await client.query(`
    INSERT INTO bank_account (id, company_id, bank_name, account_number_masked, ifsc_code, status)
    VALUES ($1, 'company_default', 'Test Bank 4.10.5-A', 'XXXX1234', 'TSTB0000001', 'ACTIVE')
  `, [testBankAccountId]);
}

async function cleanup() {
  console.log('\n[CLEANUP] Removing all test data in LIFO order...');
  // Reverse FK order: matches -> sessions -> lines -> imports -> bank_accounts
  await client.query(`DELETE FROM bank_reconciliation_match WHERE id LIKE 'test_brm_4_10_5a_%'`);
  await client.query(`DELETE FROM bank_reconciliation_session WHERE id LIKE 'test_brs_4_10_5a_%'`);
  await client.query(`DELETE FROM bank_statement_line WHERE id LIKE 'test_bsl_4_10_5a_%'`);
  await client.query(`DELETE FROM bank_statement_import WHERE id LIKE 'test_bsi_4_10_5a_%'`);
  await client.query(`DELETE FROM bank_account WHERE id LIKE 'test_ba_4_10_5a_%'`);
  console.log('  ✓ Cleanup complete.');
}

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10.5-A Schema & DTO Tests');
  console.log('Bank Statement Reconciliation: Additive Schema Foundation');
  console.log('=============================================================================\n');

  client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    await setup();

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 1: Schema Existence & Structure
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 1: Schema Existence & Structure ---');

    const tables = ['bank_statement_import', 'bank_statement_line', 'bank_reconciliation_session', 'bank_reconciliation_match'];
    for (const t of tables) {
      const res = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`, [t]);
      assert(`Table ${t} exists`, res.rows[0].exists);
    }

    // Verify column counts
    const bsiCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'bank_statement_import' ORDER BY ordinal_position`);
    assert('bank_statement_import has expected columns', bsiCols.rows.length >= 17, `Found ${bsiCols.rows.length} columns`);

    const bslCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'bank_statement_line' ORDER BY ordinal_position`);
    assert('bank_statement_line has expected columns', bslCols.rows.length >= 14, `Found ${bslCols.rows.length} columns`);

    const brsCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'bank_reconciliation_session' ORDER BY ordinal_position`);
    assert('bank_reconciliation_session has expected columns', brsCols.rows.length >= 17, `Found ${brsCols.rows.length} columns`);

    const brmCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'bank_reconciliation_match' ORDER BY ordinal_position`);
    assert('bank_reconciliation_match has expected columns', brmCols.rows.length >= 15, `Found ${brmCols.rows.length} columns`);

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 2: Valid Insertions
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 2: Valid Insertions ---');

    // Insert a valid bank_statement_import
    const importRes = await client.query(`
      INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, total_lines_imported, imported_by)
      VALUES ($1, $2, 'statement_2025_01.csv', 'CSV', 'abc123def456', '2025-01-01', '2025-01-31', 0, 'test_user_preparer')
      RETURNING *
    `, [testImportId, testBankAccountId]);
    assert('Valid bank_statement_import insertion', importRes.rows.length === 1);
    assert('Import status defaults to IMPORTED', importRes.rows[0].status === 'IMPORTED');
    assert('Import source_format is CSV', importRes.rows[0].source_format === 'CSV');

    // Insert valid bank_statement_lines
    const line1Res = await client.query(`
      INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, bank_reference, debit_amount, credit_amount, running_balance, line_hash)
      VALUES ($1, $2, $3, 1, '2025-01-05', '2025-01-06', 'NEFT DEPOSIT REF123', 'UTR001', 0.00, 15000.00, 115000.00, 'hash_line_1')
      RETURNING *
    `, [testLineId1, testImportId, testBankAccountId]);
    assert('Valid credit line insertion', line1Res.rows.length === 1);
    assert('Line reconciliation_status defaults to UNMATCHED', line1Res.rows[0].reconciliation_status === 'UNMATCHED');
    assert('Value date preserved separately from transaction date', line1Res.rows[0].value_date !== line1Res.rows[0].transaction_date);

    const line2Res = await client.query(`
      INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash)
      VALUES ($1, $2, $3, 2, '2025-01-10', 'BANK CHARGES', 250.00, 0.00, 'hash_line_2')
      RETURNING *
    `, [testLineId2, testImportId, testBankAccountId]);
    assert('Valid debit line insertion', line2Res.rows.length === 1);
    assert('Debit line has null value_date (not fabricated)', line2Res.rows[0].value_date === null);

    // Insert valid reconciliation session
    const sessionRes = await client.query(`
      INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, opening_balance_per_bank, closing_balance_per_bank, prepared_by)
      VALUES ($1, $2, '2025-01-01', '2025-01-31', 100000.00, 114750.00, 'test_user_preparer')
      RETURNING *
    `, [testSessionId, testBankAccountId]);
    assert('Valid reconciliation session insertion', sessionRes.rows.length === 1);
    assert('Session status defaults to DRAFT', sessionRes.rows[0].status === 'DRAFT');
    assert('Session counters default to 0', sessionRes.rows[0].total_matched_count === 0 && sessionRes.rows[0].total_unmatched_count === 0);

    // Insert valid reconciliation match
    const matchRes = await client.query(`
      INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, match_type, matched_amount, matched_by)
      VALUES ($1, $2, $3, 'BANK_DEPOSIT_SLIP', 'test_bds_ref_001', 'EXACT', 15000.00, 'test_user_matcher')
      RETURNING *
    `, [testMatchId, testSessionId, testLineId1]);
    assert('Valid reconciliation match insertion', matchRes.rows.length === 1);
    assert('Match status defaults to PROPOSED', matchRes.rows[0].match_status === 'PROPOSED');
    assert('Match variance defaults to 0', parseFloat(matchRes.rows[0].variance_amount) === 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 3: CHECK Constraint Enforcement
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 3: CHECK Constraint Enforcement ---');

    // bank_statement_import constraints
    await expectConstraintViolation(
      'Reject invalid import status',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by, status) VALUES ('test_chk1', $1, 'f.csv', 'CSV', 'sha1', '2025-01-01', '2025-01-31', 'u', 'INVALID_STATUS')`, [testBankAccountId]),
      'chk_bsi_status'
    );

    await expectConstraintViolation(
      'Reject invalid source format',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by) VALUES ('test_chk2', $1, 'f.csv', 'EXCEL', 'sha2', '2025-01-01', '2025-01-31', 'u')`, [testBankAccountId]),
      'chk_bsi_source_format'
    );

    await expectConstraintViolation(
      'Reject empty filename',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by) VALUES ('test_chk3', $1, '  ', 'CSV', 'sha3', '2025-01-01', '2025-01-31', 'u')`, [testBankAccountId]),
      'chk_bsi_filename_nonempty'
    );

    await expectConstraintViolation(
      'Reject empty SHA256',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by) VALUES ('test_chk4', $1, 'f.csv', 'CSV', '  ', '2025-01-01', '2025-01-31', 'u')`, [testBankAccountId]),
      'chk_bsi_sha256_nonempty'
    );

    await expectConstraintViolation(
      'Reject period_start > period_end',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by) VALUES ('test_chk5', $1, 'f.csv', 'CSV', 'sha5', '2025-02-01', '2025-01-31', 'u')`, [testBankAccountId]),
      'chk_bsi_period_valid'
    );

    await expectConstraintViolation(
      'Reject negative total_lines_imported',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by, total_lines_imported) VALUES ('test_chk6', $1, 'f.csv', 'CSV', 'sha6', '2025-01-01', '2025-01-31', 'u', -1)`, [testBankAccountId]),
      'chk_bsi_total_lines_nonneg'
    );

    // bank_statement_line constraints
    await expectConstraintViolation(
      'Reject both-sided line (debit AND credit > 0)',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash) VALUES ('test_chk7', $1, $2, 99, '2025-01-15', 'desc', 100.00, 200.00, 'hash_chk7')`, [testImportId, testBankAccountId]),
      'chk_bsl_single_sided'
    );

    await expectConstraintViolation(
      'Reject zero-amount line (debit=0 AND credit=0)',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash) VALUES ('test_chk8', $1, $2, 99, '2025-01-15', 'desc', 0.00, 0.00, 'hash_chk8')`, [testImportId, testBankAccountId]),
      'chk_bsl_nonzero_amount'
    );

    await expectConstraintViolation(
      'Reject negative debit amount',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash) VALUES ('test_chk9', $1, $2, 99, '2025-01-15', 'desc', -100.00, 0.00, 'hash_chk9')`, [testImportId, testBankAccountId]),
      'chk_bsl_debit_nonneg'
    );

    await expectConstraintViolation(
      'Reject line_number <= 0',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash) VALUES ('test_chk10', $1, $2, 0, '2025-01-15', 'desc', 100.00, 0.00, 'hash_chk10')`, [testImportId, testBankAccountId]),
      'chk_bsl_line_number_pos'
    );

    await expectConstraintViolation(
      'Reject invalid reconciliation status',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash, reconciliation_status) VALUES ('test_chk11', $1, $2, 99, '2025-01-15', 'desc', 100.00, 0.00, 'hash_chk11', 'RECONCILED')`, [testImportId, testBankAccountId]),
      'chk_bsl_reconciliation_status'
    );

    // bank_reconciliation_session constraints
    await expectConstraintViolation(
      'Reject invalid session status',
      () => client.query(`INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, prepared_by, status) VALUES ('test_chk12', $1, '2025-01-01', '2025-01-31', 'u', 'FINALIZED')`, [testBankAccountId]),
      'chk_brs_status'
    );

    await expectConstraintViolation(
      'Reject session period_start > period_end',
      () => client.query(`INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, prepared_by) VALUES ('test_chk13', $1, '2025-02-01', '2025-01-31', 'u')`, [testBankAccountId]),
      'chk_brs_period_valid'
    );

    // bank_reconciliation_match constraints
    await expectConstraintViolation(
      'Reject invalid match_source_type',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by) VALUES ('test_chk14', $1, $2, 'SALARY_PAYMENT', 'ref', 100.00, 'u')`, [testSessionId, testLineId1]),
      'chk_brm_source_type'
    );

    await expectConstraintViolation(
      'Reject invalid match_type',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, match_type, matched_amount, matched_by) VALUES ('test_chk15', $1, $2, 'BANK_DEPOSIT_SLIP', 'ref', 'AUTO', 100.00, 'u')`, [testSessionId, testLineId1]),
      'chk_brm_match_type'
    );

    await expectConstraintViolation(
      'Reject invalid match_status',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, match_status, matched_by) VALUES ('test_chk16', $1, $2, 'BANK_DEPOSIT_SLIP', 'ref2', 100.00, 'PENDING', 'u')`, [testSessionId, testLineId1]),
      'chk_brm_match_status'
    );

    await expectConstraintViolation(
      'Reject zero matched_amount',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by) VALUES ('test_chk17', $1, $2, 'BANK_DEPOSIT_SLIP', 'ref3', 0.00, 'u')`, [testSessionId, testLineId2]),
      'chk_brm_matched_amount_pos'
    );

    await expectConstraintViolation(
      'Reject empty match_source_id',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by) VALUES ('test_chk18', $1, $2, 'BANK_DEPOSIT_SLIP', '  ', 100.00, 'u')`, [testSessionId, testLineId2]),
      'chk_brm_source_id_nonempty'
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 4: FK Constraint Enforcement
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 4: FK Constraint Enforcement ---');

    await expectConstraintViolation(
      'Reject import with nonexistent bank_account_id',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by) VALUES ('test_fk1', 'nonexistent_ba', 'f.csv', 'CSV', 'sha_fk1', '2025-01-01', '2025-01-31', 'u')`),
      '23503'
    );

    await expectConstraintViolation(
      'Reject line with nonexistent import_id',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash) VALUES ('test_fk2', 'nonexistent_import', $1, 1, '2025-01-15', 'desc', 100.00, 0.00, 'hash_fk2')`, [testBankAccountId]),
      '23503'
    );

    await expectConstraintViolation(
      'Reject session with nonexistent bank_account_id',
      () => client.query(`INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, prepared_by) VALUES ('test_fk3', 'nonexistent_ba', '2025-01-01', '2025-01-31', 'u')`),
      '23503'
    );

    await expectConstraintViolation(
      'Reject match with nonexistent session_id',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by) VALUES ('test_fk4', 'nonexistent_session', $1, 'BANK_DEPOSIT_SLIP', 'ref', 100.00, 'u')`, [testLineId1]),
      '23503'
    );

    await expectConstraintViolation(
      'Reject match with nonexistent statement_line_id',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by) VALUES ('test_fk5', $1, 'nonexistent_line', 'BANK_DEPOSIT_SLIP', 'ref', 100.00, 'u')`, [testSessionId]),
      '23503'
    );

    // ON DELETE RESTRICT: cannot delete parent with children
    await expectConstraintViolation(
      'Cannot delete import with existing lines (ON DELETE RESTRICT)',
      () => client.query(`DELETE FROM bank_statement_import WHERE id = $1`, [testImportId]),
      '23503'
    );

    await expectConstraintViolation(
      'Cannot delete session with existing matches (ON DELETE RESTRICT)',
      () => client.query(`DELETE FROM bank_reconciliation_session WHERE id = $1`, [testSessionId]),
      '23503'
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 5: UNIQUE Constraint / Deduplication
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 5: UNIQUE Constraint / Deduplication ---');

    await expectConstraintViolation(
      'Reject duplicate file SHA256 for same bank account (deduplication)',
      () => client.query(`INSERT INTO bank_statement_import (id, bank_account_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, imported_by) VALUES ('test_uq1', $1, 'f2.csv', 'CSV', 'abc123def456', '2025-01-01', '2025-01-31', 'u')`, [testBankAccountId]),
      '23505'
    );

    await expectConstraintViolation(
      'Reject duplicate line_number within same import',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash) VALUES ('test_uq2', $1, $2, 1, '2025-01-15', 'dup', 100.00, 0.00, 'hash_uq2')`, [testImportId, testBankAccountId]),
      '23505'
    );

    await expectConstraintViolation(
      'Reject duplicate line_hash within same import',
      () => client.query(`INSERT INTO bank_statement_line (id, import_id, bank_account_id, line_number, transaction_date, description, debit_amount, credit_amount, line_hash) VALUES ('test_uq3', $1, $2, 99, '2025-01-15', 'dup', 100.00, 0.00, 'hash_line_1')`, [testImportId, testBankAccountId]),
      '23505'
    );

    await expectConstraintViolation(
      'Reject duplicate match (session+line+source_type+source_id)',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by) VALUES ('test_uq4', $1, $2, 'BANK_DEPOSIT_SLIP', 'test_bds_ref_001', 100.00, 'u')`, [testSessionId, testLineId1]),
      '23505'
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 6: Segregation of Duties (SoD)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 6: Segregation of Duties (SoD) ---');

    // Session: preparer ≠ reviewer
    await expectConstraintViolation(
      'Session: preparer cannot be reviewer (SoD)',
      () => client.query(`INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, prepared_by, reviewed_by) VALUES ('test_sod1', $1, '2025-02-01', '2025-02-28', 'same_user', 'same_user')`, [testBankAccountId]),
      'chk_brs_sod_preparer_reviewer'
    );

    // Session: preparer ≠ approver
    await expectConstraintViolation(
      'Session: preparer cannot be approver (SoD)',
      () => client.query(`INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, prepared_by, approved_by) VALUES ('test_sod2', $1, '2025-02-01', '2025-02-28', 'same_user', 'same_user')`, [testBankAccountId]),
      'chk_brs_sod_preparer_approver'
    );

    // Session: reviewer ≠ approver
    await expectConstraintViolation(
      'Session: reviewer cannot be approver (SoD)',
      () => client.query(`INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, prepared_by, reviewed_by, approved_by) VALUES ('test_sod3', $1, '2025-02-01', '2025-02-28', 'user_a', 'user_b', 'user_b')`, [testBankAccountId]),
      'chk_brs_sod_reviewer_approver'
    );

    // Match: matcher ≠ confirmer
    await expectConstraintViolation(
      'Match: matcher cannot be confirmer (SoD)',
      () => client.query(`INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by, confirmed_by) VALUES ('test_sod4', $1, $2, 'GATEWAY_PAYOUT_BATCH', 'gpb_ref', 250.00, 'same_user', 'same_user')`, [testSessionId, testLineId2]),
      'chk_brm_sod_matcher_confirmer'
    );

    // Valid 3-tier SoD: all different users
    const validSodRes = await client.query(`
      INSERT INTO bank_reconciliation_session (id, bank_account_id, period_start, period_end, prepared_by, reviewed_by, approved_by)
      VALUES ('test_sod_valid', $1, '2025-03-01', '2025-03-31', 'preparer', 'reviewer', 'approver')
      RETURNING id
    `, [testBankAccountId]);
    assert('Valid 3-tier SoD (preparer ≠ reviewer ≠ approver)', validSodRes.rows.length === 1);
    await client.query(`DELETE FROM bank_reconciliation_session WHERE id = 'test_sod_valid'`);

    // Valid 2-tier SoD for match
    const validMatchSodRes = await client.query(`
      INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by, confirmed_by)
      VALUES ('test_sod_valid_m', $1, $2, 'GATEWAY_PAYOUT_BATCH', 'gpb_ref_valid', 250.00, 'matcher', 'confirmer')
      RETURNING id
    `, [testSessionId, testLineId2]);
    assert('Valid 2-tier SoD for match (matcher ≠ confirmer)', validMatchSodRes.rows.length === 1);
    await client.query(`DELETE FROM bank_reconciliation_match WHERE id = 'test_sod_valid_m'`);

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 7: Match Source Type Coverage
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 7: Match Source Type Coverage ---');

    const sourceTypes = ['BANK_DEPOSIT_SLIP', 'GATEWAY_PAYOUT_BATCH', 'PURCHASE_PAYMENT', 'CUSTOMER_REFUND', 'DIRECT_BANK_ENTRY', 'OTHER'];
    for (let i = 0; i < sourceTypes.length; i++) {
      const st = sourceTypes[i];
      const matchId = `test_brm_st_${i}_${Date.now()}`;
      try {
        await client.query(`
          INSERT INTO bank_reconciliation_match (id, session_id, statement_line_id, match_source_type, match_source_id, matched_amount, matched_by)
          VALUES ($1, $2, $3, $4, $5, 100.00, 'test_user')
        `, [matchId, testSessionId, testLineId2, st, `ref_${st}_${i}`]);
        assert(`Match source type ${st} accepted`, true);
        await client.query(`DELETE FROM bank_reconciliation_match WHERE id = $1`, [matchId]);
      } catch (err) {
        assert(`Match source type ${st} accepted`, false, err.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 8: Baseline Safety & Historical Quarantine
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 8: Baseline Safety & Historical Quarantine ---');

    const baselineChecks = {
      accounting_account: 99,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      accounting_fiscal_period: 0,
      gateway_payout_batch: 0,
      gateway_settlement_order: 0,
    };

    for (const [table, expected] of Object.entries(baselineChecks)) {
      const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      const actual = parseInt(res.rows[0].count, 10);
      assert(`${table} = ${expected} (zero financial postings)`, actual === expected, `Found ${actual}`);
    }

    // Historical quarantine
    const orderCount = parseInt((await client.query('SELECT COUNT(*) FROM "order"')).rows[0].count, 10);
    assert('Historical orders untouched (173)', orderCount === 173, `Found ${orderCount}`);

    const txnCount = parseInt((await client.query('SELECT COUNT(*) FROM payment_transaction')).rows[0].count, 10);
    assert('Historical payment transactions untouched (53)', txnCount === 53, `Found ${txnCount}`);

    // Verify zero accounting_start_date
    const startDateCount = parseInt((await client.query("SELECT COUNT(*) FROM setting WHERE key = 'accounting_start_date'")).rows[0].count, 10);
    assert('No accounting_start_date configured (0)', startDateCount === 0, `Found ${startDateCount}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 9: Evidence-Only Design Verification
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 9: Evidence-Only Design ---');

    // Verify no FK from new tables to accounting_voucher or accounting_journal_entry
    const voucherFkQuery = await client.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name as foreign_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('bank_statement_import', 'bank_statement_line', 'bank_reconciliation_session', 'bank_reconciliation_match')
        AND ccu.table_name IN ('accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line')
    `);
    assert('No FK from reconciliation tables to accounting voucher/journal tables', voucherFkQuery.rows.length === 0, `Found ${voucherFkQuery.rows.length} FKs`);

    // Verify no column named 'voucher_id' or 'journal_entry_id' in new tables
    const voucherColQuery = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_name IN ('bank_statement_import', 'bank_statement_line', 'bank_reconciliation_session', 'bank_reconciliation_match')
        AND column_name IN ('voucher_id', 'journal_entry_id', 'journal_line_id')
    `);
    assert('No voucher/journal columns in reconciliation tables', voucherColQuery.rows.length === 0, `Found columns: ${JSON.stringify(voucherColQuery.rows)}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN 10: Index Verification
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- DOMAIN 10: Index Verification ---');

    const indexQuery = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE tablename IN ('bank_statement_import', 'bank_statement_line', 'bank_reconciliation_session', 'bank_reconciliation_match')
      ORDER BY tablename, indexname
    `);

    const indexesByTable = {};
    for (const idx of indexQuery.rows) {
      if (!indexesByTable[idx.tablename]) indexesByTable[idx.tablename] = [];
      indexesByTable[idx.tablename].push(idx.indexname);
    }

    assert('bank_statement_import has indexes', (indexesByTable['bank_statement_import'] || []).length >= 4, `Found ${(indexesByTable['bank_statement_import'] || []).length}`);
    assert('bank_statement_line has indexes', (indexesByTable['bank_statement_line'] || []).length >= 6, `Found ${(indexesByTable['bank_statement_line'] || []).length}`);
    assert('bank_reconciliation_session has indexes', (indexesByTable['bank_reconciliation_session'] || []).length >= 3, `Found ${(indexesByTable['bank_reconciliation_session'] || []).length}`);
    assert('bank_reconciliation_match has indexes', (indexesByTable['bank_reconciliation_match'] || []).length >= 4, `Found ${(indexesByTable['bank_reconciliation_match'] || []).length}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // CLEANUP & SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════
    await cleanup();

    // Final post-cleanup baseline verification
    console.log('\n--- Post-Cleanup Baseline Verification ---');
    for (const t of ['bank_statement_import', 'bank_statement_line', 'bank_reconciliation_session', 'bank_reconciliation_match']) {
      const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      const cnt = parseInt(res.rows[0].count, 10);
      assert(`${t} = 0 after cleanup`, cnt === 0, `Found ${cnt}`);
    }
    const bankAccCleanup = parseInt((await client.query(`SELECT COUNT(*) FROM bank_account`)).rows[0].count, 10);
    assert('bank_account = 0 after cleanup', bankAccCleanup === 0, `Found ${bankAccCleanup}`);

    console.log('\n=============================================================================');
    console.log(`STEP 4.10.5-A SCHEMA TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    if (failures.length > 0) {
      console.log(`FAILURES: ${failures.join(', ')}`);
    }
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST SUITE ERROR:', err.message);
    console.error(err.stack);
    // Attempt cleanup even on error
    try { await cleanup(); } catch (cleanupErr) { console.error('Cleanup error:', cleanupErr.message); }
    throw err;
  } finally {
    await client.end();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
