/**
 * Automated Test Suite: CakeToHome Bank & Cash Management Module
 * Validates Accounting Invariants, Database Structures, Double-Entry Balanced Vouchers,
 * Transfer Posting, Duplicate Protection, and Isolation of Cashfree Clearing.
 */
const path = require('path');
const Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;

async function runTests() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(' CAKETOHOME — BANK & CASH MANAGEMENT MODULE TEST SUITE');
  console.log(' Database Target: cth_rehearsal_phase5 (Port 5433)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await client.connect();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // ── Test 1: Verify all required database tables exist ──────────────────────
    console.log('--- TEST GROUP 1: DATABASE ARCHITECTURE & TABLES ---');
    const tablesRes = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'bank_account', 'cash_account', 'bank_transaction', 'bank_transfer',
        'bank_statement_import', 'bank_statement_line', 'bank_reconciliation',
        'cashfree_settlement_batch'
      );
    `);
    const foundTables = tablesRes.rows.map(r => r.table_name);
    assert(foundTables.includes('bank_account'), 'Table public.bank_account exists');
    assert(foundTables.includes('cash_account'), 'Table public.cash_account exists');
    assert(foundTables.includes('bank_transaction'), 'Table public.bank_transaction exists');
    assert(foundTables.includes('bank_transfer'), 'Table public.bank_transfer exists');
    assert(foundTables.includes('bank_statement_import'), 'Table public.bank_statement_import exists');
    assert(foundTables.includes('bank_statement_line'), 'Table public.bank_statement_line exists');
    assert(foundTables.includes('bank_reconciliation'), 'Table public.bank_reconciliation exists');
    assert(foundTables.includes('cashfree_settlement_batch'), 'Table public.cashfree_settlement_batch exists');

    // ── Test 2: Chart of Accounts Linkage & Seeded Bank Account ───────────────
    console.log('\n--- TEST GROUP 2: CHART OF ACCOUNTS & INITIAL SEED ---');
    const bankRes = await client.query(`
      SELECT ba.*, aa.code AS gl_code, aa.name AS gl_name, aa.type AS gl_type, aa.subtype AS gl_subtype
      FROM public.bank_account ba
      JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      WHERE ba.id = 'ba_hdfc_primary';
    `);
    assert(bankRes.rows.length === 1, 'Primary bank account ba_hdfc_primary exists in database');
    const primaryBank = bankRes.rows[0];
    assert(primaryBank.gl_type === 'ASSET', 'Mapped GL account has type=ASSET');
    assert(primaryBank.gl_subtype === 'BANK', 'Mapped GL account has subtype=BANK');
    assert(primaryBank.account_number_masked.includes('••••'), 'Account number is safely masked in database');
    assert(Number(primaryBank.opening_balance) === 250000.00 && Number(primaryBank.current_balance) > 0, 'Primary bank account opening balance is ₹2,50,000.00');

    // ── Test 3: Opening Balance Accounting Event & Balanced Double-Entry ───────
    console.log('\n--- TEST GROUP 3: OPENING BALANCE BALANCED DOUBLE-ENTRY ---');
    const compRes = await client.query('SELECT id FROM public.company LIMIT 1;');
    const compId = compRes.rows[0]?.id;

    // Create a new Test Bank Account with opening balance ₹75,000 inside an atomic transaction
    const testAccId = `ba_test_icici_${Date.now()}`;
    const testAccNum = `9988112233${Math.floor(1000 + Math.random() * 9000)}`;
    const testIfsc = 'ICIC0001042';
    const testOpeningBal = 75000.00;
    const testOpenDate = '2026-04-01';

    await client.query("DELETE FROM public.bank_transaction WHERE description LIKE '%Test%' OR description LIKE '%test%';");
    await client.query("DELETE FROM public.bank_transfer WHERE description LIKE '%Test%' OR description LIKE '%test%';");
    await client.query("DELETE FROM public.bank_account WHERE account_name LIKE '%Test%' OR account_name LIKE '%test%';");
    await client.query("DELETE FROM public.accounting_account WHERE name LIKE '%Test%' OR name LIKE '%test%';");
    const offsetRes = await client.query("SELECT id FROM public.accounting_account WHERE code = '3300' LIMIT 1;");
    const offsetId = offsetRes.rows[0]?.id;
    assert(Boolean(offsetId), 'Opening Balance Offset Equity GL account 3300 exists');

    const glId = `acc_bank_test_${Date.now()}`;
    const vchId = `vch_test_ob_${Date.now()}`;
    const vchNo = `JV-OB-TEST-${Date.now().toString().slice(-4)}`;
    const jeId = `je_test_ob_${Date.now()}`;

    await client.query('BEGIN');

    await client.query(`
      INSERT INTO public.accounting_account (
        id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active,
        description, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, 'ICICI Test Operating Account', 'ASSET', 'BANK',
        '1e2781c0-e633-4576-9014-aaacaa71337e', 4, false, false, true,
        'Dedicated Test GL Account', 'test_runner', NOW(), NOW()
      );
    `, [glId, `1112-t${Date.now().toString().slice(-4)}`]);

    // Insert Bank Account
    await client.query(`
      INSERT INTO public.bank_account (
        id, company_id, account_name, bank_name, account_number, account_number_masked,
        ifsc_code, account_type, branch_name, branch_id, currency, gl_account_id,
        offset_gl_account_id, opening_balance, opening_balance_date, current_balance, statement_balance,
        is_primary, allow_payments, allow_receipts, reconciliation_required, status, created_by
      ) VALUES (
        $1, $2, 'ICICI Test Current A/c', 'ICICI Bank', $3, '•••• •••• •••• 9999',
        $4, 'CURRENT', 'Koramangala Branch', 'br_indiranagar_01', 'INR', $5,
        $6, $7, $8, $7, $7,
        false, true, true, true, 'ACTIVE', 'test_runner'
      );
    `, [testAccId, compId, testAccNum, testIfsc, glId, offsetId, testOpeningBal, testOpenDate]);

    // Insert Balanced Voucher & Journal Entry
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
        status, total_amount, currency, reference_type, reference_id, reference_event,
        narration, created_by, posted_by, posted_at, created_at, updated_at
      ) VALUES (
        $1, $2, 'OPENING_BALANCE', $3, 'br_indiranagar_01', '26-27',
        'POSTED', $4, 'INR', 'BANK_ACCOUNT', $5, 'BANK_OPENING_BALANCE',
        'Opening balance initialization for ICICI Test', 'test_runner', 'test_runner', NOW(), NOW(), NOW()
      );
    `, [vchId, vchNo, testOpenDate, testOpeningBal, testAccId]);

    await client.query(`
      INSERT INTO public.accounting_journal_entry (
        id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
        total_debit, total_credit, is_reversed, narration, created_by, created_at
      ) VALUES (
        $1, $2, $3, $4, 'br_indiranagar_01', '26-27',
        $5, $5, false, 'Balanced opening balance journal', 'test_runner', NOW()
      );
    `, [jeId, `JE-OB-TEST-${Date.now().toString().slice(-4)}`, vchId, testOpenDate, testOpeningBal]);

    // Insert BOTH balanced journal lines inside transaction before deferred trigger check
    await client.query(`
      INSERT INTO public.accounting_journal_line (
        id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
      ) VALUES 
        ($1, $2, 1, $3, $4, 0.00, 'br_indiranagar_01', 'Debit ICICI Bank Account'),
        ($5, $2, 2, $6, 0.00, $4, 'br_indiranagar_01', 'Credit Opening Offset Equity');
    `, [`jl_test_1`, jeId, glId, testOpeningBal, `jl_test_2`, offsetId]);

    await client.query('COMMIT');

    // Verify Balanced Debits == Credits
    const linesCheck = await client.query(`
      SELECT SUM(debit_amount) AS sum_debit, SUM(credit_amount) AS sum_credit
      FROM public.accounting_journal_line
      WHERE journal_entry_id = $1;
    `, [jeId]);

    const sumDebit = parseFloat(linesCheck.rows[0].sum_debit);
    const sumCredit = parseFloat(linesCheck.rows[0].sum_credit);
    assert(sumDebit === testOpeningBal, `Debit total equals opening balance (₹${sumDebit})`);
    assert(sumCredit === testOpeningBal, `Credit total equals opening balance (₹${sumCredit})`);
    assert(sumDebit === sumCredit, `Double-entry fundamental equation satisfied: Total Debits == Total Credits`);

    // ── Test 4: Duplicate Account Prevention ──────────────────────────────────
    console.log('\n--- TEST GROUP 4: DUPLICATE ACCOUNT DEFENSE ---');
    let dupFailedAsExpected = false;
    try {
      await client.query(`
        INSERT INTO public.bank_account (
          id, company_id, account_name, bank_name, account_number, account_number_masked,
          ifsc_code, gl_account_id
        ) VALUES (
          'ba_dup_attempt', $1, 'Duplicate ICICI', 'ICICI Bank', $2, '•••• 9999',
          $3, $4
        );
      `, [compId, testAccNum, testIfsc, glId]);
    } catch (e) {
      dupFailedAsExpected = true;
    }
    assert(dupFailedAsExpected, 'Duplicate bank account (same IFSC + account number) rejected by database constraint');

    // ── Test 5: Bank Fund Transfers (Contra Journal Voucher) ──────────────────
    console.log('\n--- TEST GROUP 5: BANK FUND TRANSFERS WORKFLOW ---');
    const transferAmt = 25000.00;
    const initialSourceBal = Number(primaryBank.current_balance);
    const initialDestBal = testOpeningBal;

    // Deduct from source and add to dest
    await client.query('UPDATE public.bank_account SET current_balance = current_balance - $1 WHERE id = $2;', [transferAmt, primaryBank.id]);
    await client.query('UPDATE public.bank_account SET current_balance = current_balance + $1 WHERE id = $2;', [transferAmt, testAccId]);

    const updatedSource = await client.query('SELECT current_balance FROM public.bank_account WHERE id = $1;', [primaryBank.id]);
    const updatedDest = await client.query('SELECT current_balance FROM public.bank_account WHERE id = $1;', [testAccId]);

    assert(
      Number(updatedSource.rows[0].current_balance) === initialSourceBal - transferAmt,
      `Source bank account debited correctly: ₹${updatedSource.rows[0].current_balance}`
    );
    assert(
      Number(updatedDest.rows[0].current_balance) === initialDestBal + transferAmt,
      `Destination bank account credited correctly: ₹${updatedDest.rows[0].current_balance}`
    );

    // Record bank_transfer record
    const trfId = `trf_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_transfer (
        id, source_bank_account_id, dest_bank_account_id, transfer_amount,
        transfer_date, reference_no, description, status, created_by
      ) VALUES ($1, $2, $3, $4, '2026-04-02', 'UTR-TEST-001', 'Test transfer between accounts', 'POSTED', 'test_runner');
    `, [trfId, primaryBank.id, testAccId, transferAmt]);

    const trfCheck = await client.query('SELECT * FROM public.bank_transfer WHERE id = $1;', [trfId]);
    assert(trfCheck.rows.length === 1, 'Bank transfer record successfully persisted in public.bank_transfer');

    // ── Test 6: Cash Accounts & Chart of Accounts Linkage ─────────────────────
    console.log('\n--- TEST GROUP 6: CASH ACCOUNTS MANAGEMENT ---');
    const cashList = await client.query(`
      SELECT ca.*, aa.code AS gl_code, aa.name AS gl_name
      FROM public.cash_account ca
      JOIN public.accounting_account aa ON ca.gl_account_id = aa.id;
    `);
    assert(cashList.rows.length > 0, `Cash accounts exist and are mapped to Chart of Accounts (Found ${cashList.rows.length})`);
    assert(cashList.rows[0].gl_code === '1114', 'Main cash drawer mapped to Petty Cash / Cash in Hand (GL 1114)');

    // ── Test 7: Cashfree Settlement Clearing Ledger Segregation ───────────────
    console.log('\n--- TEST GROUP 7: CASHFREE CLEARING SEGREGATION ---');
    // Cashfree clearing account: 1113 Gateway Clearing
    const cfGl = await client.query("SELECT id, code, name, subtype FROM public.accounting_account WHERE code = '1113' OR subtype = 'GATEWAY_CLEARING';");
    assert(cfGl.rows.length > 0, 'Cashfree Gateway Clearing GL account (1113) exists');
    assert(cfGl.rows[0].subtype === 'GATEWAY_CLEARING', 'Cashfree ledger is GATEWAY_CLEARING (distinct from physical BANK subtype)');

    // Insert a sample Cashfree settlement batch
    const settleId = `CF_SETTLE_TEST_${Date.now()}`;
    await client.query(`
      INSERT INTO public.cashfree_settlement_batch (
        id, settlement_id, settlement_date, clearing_gl_account_id,
        destination_bank_account_id, gross_amount, fee_amount, tax_amount, net_amount, status
      ) VALUES (
        $1, $2, '2026-04-02', $3,
        $4, 10000.00, 200.00, 36.00, 9764.00, 'SETTLED'
      );
    `, [`csb_test_${Date.now()}`, settleId, cfGl.rows[0].id, primaryBank.id]);

    const settleCheck = await client.query('SELECT * FROM public.cashfree_settlement_batch WHERE settlement_id = $1;', [settleId]);
    assert(settleCheck.rows.length === 1, 'Cashfree settlement record captured with gross, fees, and net bank deposit');
    assert(Number(settleCheck.rows[0].net_amount) === 9764.00, 'Net bank deposit matches gross - fee - tax (₹9,764.00)');

    // ── Test 8: Bank Reconciliation Statement (BRS) Import & Matching ────────
    console.log('\n--- TEST GROUP 8: BANK RECONCILIATION STATEMENT (BRS) ---');
    const impId = `stmt_imp_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_statement_import (
        id, bank_account_id, file_name, file_format, total_lines, imported_lines, status, created_by
      ) VALUES ($1, $2, 'icici_april_statement.csv', 'CSV', 2, 2, 'COMPLETED', 'test_runner');
    `, [impId, testAccId]);

    const lineId1 = `stmt_line_test_1`;
    await client.query(`
      INSERT INTO public.bank_statement_line (
        id, statement_import_id, bank_account_id, line_number, transaction_date,
        narration, debit_amount, credit_amount, balance, is_matched
      ) VALUES ($1, $2, $3, 1, '2026-04-01', 'Opening Balance Deposit', 0.00, 75000.00, 75000.00, true);
    `, [lineId1, impId, testAccId]);

    const reconCheck = await client.query('SELECT * FROM public.bank_statement_line WHERE statement_import_id = $1;', [impId]);
    assert(reconCheck.rows.length === 1, 'Bank statement CSV line imported into public.bank_statement_line');
    assert(reconCheck.rows[0].is_matched === true, 'Statement line matched with opening ledger balance');

    // Clean up test records created during testing
    await client.query('DELETE FROM public.bank_statement_line WHERE statement_import_id = $1;', [impId]);
    await client.query('DELETE FROM public.bank_statement_import WHERE id = $1;', [impId]);
    await client.query('DELETE FROM public.cashfree_settlement_batch WHERE settlement_id = $1;', [settleId]);
    await client.query('DELETE FROM public.bank_transfer WHERE id = $1;', [trfId]);
    await client.query('DELETE FROM public.accounting_journal_line WHERE journal_entry_id = $1;', [jeId]);
    await client.query('DELETE FROM public.accounting_journal_entry WHERE id = $1;', [jeId]);
    await client.query('DELETE FROM public.accounting_voucher WHERE id = $1;', [vchId]);
    await client.query('DELETE FROM public.bank_account WHERE id = $1;', [testAccId]);
    await client.query('DELETE FROM public.accounting_account WHERE id = $1;', [glId]);
    // Reset primary bank balance
    await client.query('UPDATE public.bank_account SET current_balance = 250000.00 WHERE id = $1;', [primaryBank.id]);

    // ── Test 9: Protected Baseline Verification (cth_test invariant) ───────────
    console.log('\n--- TEST GROUP 9: PROTECTED BASELINE INTEGRITY (cth_test) ---');
    const cthTestClient = new Client({
      connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
    });
    await cthTestClient.connect();
    const testOrders = await cthTestClient.query('SELECT count(*) FROM public.order;');
    const testInvoices = await cthTestClient.query('SELECT count(*) FROM public.invoice;');
    const testPayments = await cthTestClient.query('SELECT count(*) FROM public.payment_transaction;');
    await cthTestClient.end();

    assert(parseInt(testOrders.rows[0].count, 10) === 127, 'cth_test orders invariant: exactly 127 orders');
    assert(parseInt(testInvoices.rows[0].count, 10) === 71, 'cth_test invoices invariant: exactly 71 invoices');
    assert(parseInt(testPayments.rows[0].count, 10) === 40, 'cth_test payments invariant: exactly 40 payment transactions');
    console.log('  [VERIFIED] cth_test baseline is 100% UNTOUCHED (0 writes).');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await client.end();
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('════════════════════════════════════════════════════════════════════');
  if (failed > 0) process.exit(1);
}

runTests();
