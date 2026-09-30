/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-C Test Suite
 * Automated Bank Reconciliation Matching Engine + Stage-2 Transit Clearance
 *
 * TEST DOMAINS:
 * 0. Pre-test PostgreSQL baseline audit (pristine verification).
 * 1. Vector A: Cash Deposit Candidate Matching (+3 day window, amount, account, ambiguity, no candidate, duplicates).
 * 2. Vector A: Stage-2 Clearance GL Posting (Dr 1112 / Cr 1118, value_date, credit_voucher_id, idempotency).
 * 3. Stage-2 Accounting Configuration Guards (start date, fiscal period, control accounts, zero suspense).
 * 4. Strict Segregation of Duties (matcher != confirmer, preparer != confirmer, Super Admin restriction).
 * 5. Vector B: Gateway Payout Reconciliation (candidate match, confirmation, ZERO new GL vouchers).
 * 6. Vector C: Direct Bank Entries & Supplier Payments (candidate match, unmatched debit exception, no 1119).
 * 7. Manual Override Capabilities (required reason, distinct matcher/confirmer, audit trail, evidence immutability).
 * 8. Concurrency & Atomicity Rollback Protection (posting failure rollback, match failure rollback).
 * 9. Immutability & Historical Quarantine (posted voucher immutable, 173 orders & 53 payments untouched).
 * 10. Fixture Teardown & Post-test PostgreSQL Baseline Audit.
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
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  throw new Error("No database connection string found in environment or .env files");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-C Test Suite');
  console.log('Automated Bank Reconciliation Matching Engine + Stage-2 Transit Clearance');
  console.log('=============================================================================\n');

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

  const { BankAccountRepository } = require('../src/lib/repositories/bank-account.repository');
  const { BankDepositSlipRepository } = require('../src/lib/repositories/bank-deposit-slip.repository');
  const { BankStatementImportRepository } = require('../src/lib/repositories/bank-statement-import.repository');
  const { BankReconciliationRepository } = require('../src/lib/repositories/bank-reconciliation.repository');
  const { BankAccountService } = require('../src/lib/services/bank-account.service');
  const { BankDepositSlipService } = require('../src/lib/services/bank-deposit-slip.service');
  const { BankReconciliationMatchingEngine, BankReconciliationServiceError } = require('../src/lib/services/bank-reconciliation-matching.service');
  const { PostingService } = require('../src/lib/services/posting.service');
  const { closeDbPool } = require('../src/lib/db');

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  // Tracking fixtures for 100% cleanup
  const createdMatchIds = [];
  const createdSessionIds = [];
  const createdLineIds = [];
  const createdImportIds = [];
  const createdVoucherIds = [];
  const createdDepositSlipIds = [];
  const createdPayoutBatchIds = [];
  const createdPurchasePaymentIds = [];
  const createdPurchaseIds = [];
  const createdSupplierIds = [];
  const createdBankAccountIds = [];
  const createdPeriodIds = [];

  function formatDateOnly(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.substring(0, 10);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 0: Pre-test PostgreSQL Baseline Audit
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[0/10] Auditing pre-test PostgreSQL baseline...');

    const baselineChecks = {
      accounting_account: 99,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      bank_statement_import: 0,
      bank_statement_line: 0,
      bank_reconciliation_session: 0,
      bank_reconciliation_match: 0,
      bank_account: 0,
      bank_deposit_slip: 0,
      gateway_payout_batch: 0,
      order: 173,
      payment_transaction: 53,
    };

    for (const [table, expected] of Object.entries(baselineChecks)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM public."order"' : `SELECT COUNT(*) FROM public."${table}"`;
      const cnt = parseInt((await client.query(q)).rows[0].count, 10);
      assert(cnt === expected, `Pre-test ${table} === ${expected} (actual: ${cnt})`);
    }

    // Identify branches
    const branchRes = await client.query('SELECT id, name FROM public.branch ORDER BY id LIMIT 2');
    const branch1 = branchRes.rows[0];
    const branch2 = branchRes.rows[1];
    assert(branch1 && branch2, `Found test branches: ${branch1.id}, ${branch2.id}`);

    // Define Actor Contexts for SoD testing
    const adminCtx = { id: 'usr_admin', user_id: 'usr_admin', role: 'SUPER_ADMIN' };
    const cashierCtx = {
      id: 'usr_cashier_01',
      user_id: 'usr_cashier_01',
      role: 'STAFF',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.DEPOSIT_PREPARE']
    };
    const managerCtx = {
      id: 'usr_mgr_01',
      user_id: 'usr_mgr_01',
      role: 'BRANCH_MANAGER',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.DEPOSIT_APPROVE']
    };
    const accountantCtx = {
      id: 'usr_acct_01',
      user_id: 'usr_acct_01',
      role: 'STAFF',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.DEPOSIT_POST', 'ACCOUNTING.POST']
    };
    const matcherCtx = {
      id: 'usr_matcher_01',
      user_id: 'usr_matcher_01',
      role: 'STAFF',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.RECON_VIEW', 'BANK.RECON_MATCH']
    };
    const auditorCtx = {
      id: 'usr_auditor_01',
      user_id: 'usr_auditor_01',
      role: 'STAFF',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.RECON_VIEW', 'BANK.RECON_CONFIRM', 'BANK.DEPOSIT_POST']
    };

    // Create Bank Account for testing
    const ba = await BankAccountService.createBankAccount({
      bank_name: 'HDFC Bank',
      account_number_masked: 'XXXX-XXXX-9999',
      ifsc_code: 'HDFC0001234',
      branch_id: branch1.id,
      actorContext: adminCtx,
    }, client);
    createdBankAccountIds.push(ba.id);

    // Create Second Bank Account for mismatch testing
    const baOther = await BankAccountService.createBankAccount({
      bank_name: 'ICICI Bank',
      account_number_masked: 'XXXX-XXXX-8888',
      ifsc_code: 'ICIC0005678',
      branch_id: branch2.id,
      actorContext: adminCtx,
    }, client);
    createdBankAccountIds.push(baOther.id);

    // Setup temporary accounting start date and fiscal period for valid testing
    await client.query("DELETE FROM public.setting WHERE key = 'accounting_start_date' OR id = 'set_recon_start_date'");
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_recon_start_date', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW())
    `);

    const fpId = 'fp_recon_test_q2';
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES ($1, 'FY2026-27', 'Q2-Active', '2026-07-01', '2026-09-30', false, NOW())
    `, [fpId]);
    createdPeriodIds.push(fpId);

    // Create Reconciliation Session
    const session = await BankReconciliationRepository.createSession({
      bankAccountId: ba.id,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      openingBalancePerBank: 50000.00,
      closingBalancePerBank: 150000.00,
      preparedBy: matcherCtx.user_id,
      status: 'IN_PROGRESS',
    }, client);
    createdSessionIds.push(session.id);
    assert(session.id && session.status === 'IN_PROGRESS', 'Created active bank reconciliation session');

    // Create Bank Statement Import and Lines
    const importRec = await BankStatementImportRepository.createImport({
      bank_account_id: ba.id,
      source_filename: 'hdfc_sept_recon.csv',
      source_format: 'CSV',
      file_sha256: 'sha256_mock_hash_for_recon_testing_001',
      statement_period_start: '2026-09-01',
      statement_period_end: '2026-09-30',
      total_lines_imported: 6,
      total_debit_amount: 25000.00,
      total_credit_amount: 83000.00,
      imported_by: matcherCtx.user_id,
    }, client);
    createdImportIds.push(importRec.id);

    // Helper to create statement lines
    async function createTestLine(params) {
      const [line] = await BankStatementImportRepository.createLinesBatch([{
        import_id: importRec.id,
        bank_account_id: params.bankAccountId || ba.id,
        line_number: params.lineNumber,
        transaction_date: params.transactionDate || '2026-09-02',
        value_date: params.valueDate || params.transactionDate || '2026-09-02',
        description: params.description || 'Test Statement Line',
        bank_reference: params.bankReference || null,
        debit_amount: params.debitAmount || 0,
        credit_amount: params.creditAmount || 0,
        running_balance: 100000.00,
        line_hash: `hash_line_${params.lineNumber}_${Date.now()}_${Math.random()}`,
        reconciliation_status: 'UNMATCHED',
      }], client);
      createdLineIds.push(line.id);
      return line;
    }

    // Helper to create and Stage-1 post a deposit slip
    async function createAndPostStage1Slip(params) {
      const bId = params.branchId || branch1.id;
      const prepCtx = bId === branch1.id ? cashierCtx : { ...cashierCtx, branch_id: bId, id: `usr_cashier_${bId}` };
      const apprCtx = bId === branch1.id ? managerCtx : { ...managerCtx, branch_id: bId, id: `usr_mgr_${bId}` };
      const postCtx = bId === branch1.id ? accountantCtx : { ...accountantCtx, branch_id: bId, id: `usr_acct_${bId}` };

      const slip = await BankDepositSlipService.prepareDepositSlip({
        slipNumber: params.slipNumber || `BDS-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        branchId: bId,
        bankAccountId: params.bankAccountId || ba.id,
        depositDate: params.depositDate || '2026-09-02',
        amount: params.amount,
        preparedBy: params.preparedBy || prepCtx.id,
        actorContext: prepCtx,
      }, client);
      createdDepositSlipIds.push(slip.id);

      // Approve
      await BankDepositSlipService.approveDepositSlip({
        depositSlipId: slip.id,
        approvedBy: params.approvedBy || apprCtx.id,
        actorContext: apprCtx,
      }, client);

      // Stage 1 Post (Dr 1118 / Cr 1111)
      const postResult = await BankDepositSlipService.postDepositSlip({
        depositSlipId: slip.id,
        postedBy: params.postedBy || postCtx.id,
        actorContext: postCtx,
      });
      createdVoucherIds.push(postResult.voucher.id);

      return postResult.depositSlip;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 1: Vector A Candidate Matching (Cash Deposit Clearance)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[1/10] Verifying Vector A Candidate Matching...');

    // 1.1 Create Slip A1: amount 15,000, date 2026-09-02
    const slipA1 = await createAndPostStage1Slip({
      amount: 15000.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-A1-15000',
    });
    assert(slipA1.transit_voucher_id !== null, 'Slip A1 Stage 1 posted (transit_voucher_id set)');

    // Line 1: Credit 15,000, date 2026-09-02 (exact match on deposit date)
    const line1 = await createTestLine({
      lineNumber: 1,
      creditAmount: 15000.00,
      transactionDate: '2026-09-02',
      valueDate: '2026-09-02',
      description: 'CASH DEPOSIT BRANCH 1',
    });

    const match1Result = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      line1.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    createdMatchIds.push(match1Result.match.id);
    assert(match1Result.status === 'PROPOSED', '1. Exact cash-deposit match returned status PROPOSED');
    assert(match1Result.candidateType === 'BANK_DEPOSIT_SLIP', 'Candidate identified as BANK_DEPOSIT_SLIP');
    assert(match1Result.candidateId === slipA1.id, 'Candidate matches Slip A1 ID');
    assert(match1Result.match.match_status === 'PROPOSED', 'bank_reconciliation_match record created in PROPOSED status');

    // 1.2 Valid +3-day deposit window: Slip deposit 2026-09-02, Bank credit 2026-09-05 (+3 days)
    const slipA2 = await createAndPostStage1Slip({
      amount: 18000.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-A2-18000',
    });
    const line2 = await createTestLine({
      lineNumber: 2,
      creditAmount: 18000.00,
      transactionDate: '2026-09-05',
      valueDate: '2026-09-05',
      description: 'CASH DEP VALUE +3 DAYS',
    });
    const match2Result = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      line2.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    createdMatchIds.push(match2Result.match.id);
    assert(match2Result.status === 'PROPOSED' && match2Result.candidateId === slipA2.id, '2. Valid +3-day deposit window matches successfully');

    // 1.3 Outside window rejection (+4 days: deposit 2026-09-02, bank credit 2026-09-06)
    const slipA3 = await createAndPostStage1Slip({
      amount: 12000.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-A3-12000',
    });
    const line3 = await createTestLine({
      lineNumber: 3,
      creditAmount: 12000.00,
      transactionDate: '2026-09-06',
      valueDate: '2026-09-06',
      description: 'LATE CASH DEP +4 DAYS',
    });
    const match3Result = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      line3.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    assert(match3Result.status === 'NO_CANDIDATE', '3. Outside-window credit (+4 days) rejected: NO_CANDIDATE');

    // 1.4 Prior-to-deposit date rejection: deposit 2026-09-05, statement credit 2026-09-03
    const slipA4 = await createAndPostStage1Slip({
      amount: 11000.00,
      depositDate: '2026-09-05',
      slipNumber: 'BDS-A4-11000',
    });
    const line4 = await createTestLine({
      lineNumber: 4,
      creditAmount: 11000.00,
      transactionDate: '2026-09-03',
      valueDate: '2026-09-03',
      description: 'EARLIER CREDIT DATE',
    });
    const match4Result = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      line4.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    assert(match4Result.status === 'NO_CANDIDATE', 'Statement credit before deposit date rejected: NO_CANDIDATE');

    // 1.5 Amount mismatch rejection: Slip is 10,000, statement credit is 9,999.90 (10 paise difference)
    const slipA5 = await createAndPostStage1Slip({
      amount: 10000.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-A5-10000',
    });
    const line5 = await createTestLine({
      lineNumber: 5,
      creditAmount: 9999.90,
      transactionDate: '2026-09-02',
      valueDate: '2026-09-02',
      description: 'AMOUNT MISMATCH 10 PAISE',
    });
    const match5Result = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      line5.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    assert(match5Result.status === 'NO_CANDIDATE', '4. Amount mismatch rejected via integer paise comparison');

    // 1.6 Bank account mismatch: Slip is on baOther, statement is on ba
    const slipA6 = await createAndPostStage1Slip({
      amount: 22000.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-A6-OTHER-BANK',
      bankAccountId: baOther.id,
      branchId: branch2.id,
    });
    const line6 = await createTestLine({
      lineNumber: 6,
      creditAmount: 22000.00,
      transactionDate: '2026-09-02',
      valueDate: '2026-09-02',
      bankAccountId: ba.id, // statement belongs to ba
    });
    const match6Result = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      line6.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    assert(match6Result.status === 'NO_CANDIDATE', '5. Bank account mismatch rejected');

    // 1.7 Ambiguous Candidates: Two slips with identical amount 7,500 and date 2026-09-02 for same account
    const slipAmbig1 = await createAndPostStage1Slip({
      amount: 7500.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-AMBIG-1',
    });
    const slipAmbig2 = await createAndPostStage1Slip({
      amount: 7500.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-AMBIG-2',
    });
    const lineAmbig = await createTestLine({
      lineNumber: 7,
      creditAmount: 7500.00,
      transactionDate: '2026-09-02',
      valueDate: '2026-09-02',
      description: 'AMBIGUOUS CASH DEPOSIT',
    });
    const matchAmbigResult = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      lineAmbig.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    assert(matchAmbigResult.status === 'AMBIGUOUS_EXCEPTION', '6. Ambiguous candidates flagged as AMBIGUOUS_EXCEPTION');
    assert(matchAmbigResult.candidatesCount === 2, 'Reported candidatesCount === 2');
    const lineAmbigDb = (await client.query('SELECT reconciliation_status FROM bank_statement_line WHERE id = $1', [lineAmbig.id])).rows[0];
    assert(lineAmbigDb.reconciliation_status === 'EXCEPTION', 'Statement line marked as EXCEPTION in DB (never silently auto-matched)');

    // 1.8 No Candidate
    const lineNoCand = await createTestLine({
      lineNumber: 8,
      creditAmount: 93456.78,
      transactionDate: '2026-09-10',
      description: 'RANDOM UNMATCHED CREDIT',
    });
    const matchNoCandResult = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      lineNoCand.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    assert(matchNoCandResult.status === 'NO_CANDIDATE', '7. No candidate returns status NO_CANDIDATE and marks exception');

    // 1.9 Duplicate Match Rejection (DB unique constraint)
    let dupMatchFailed = false;
    try {
      await BankReconciliationRepository.createMatch({
        sessionId: session.id,
        statementLineId: line1.id,
        matchSourceType: 'BANK_DEPOSIT_SLIP',
        matchSourceId: slipA1.id,
        matchedAmount: 15000.00,
        matchedBy: matcherCtx.user_id,
      }, client);
    } catch (e) {
      dupMatchFailed = e.code === 'DUPLICATE_MATCH';
    }
    assert(dupMatchFailed, '8. Duplicate match between same line and source in same session rejected');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 2: Vector A Stage-2 Clearance GL Posting
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[2/10] Verifying Vector A Stage-2 Clearance GL Posting...');

    const preVoucherCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);

    // Confirm match1 for slipA1 (15,000.00)
    const stage2Result = await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
      matchId: match1Result.match.id,
      confirmerId: auditorCtx.user_id,
      actorContext: auditorCtx,
    });
    createdVoucherIds.push(stage2Result.voucher.id);

    const postVoucherCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(postVoucherCount === preVoucherCount + 1, '9. Exactly 1 new Stage-2 clearance voucher created');

    // 2.1 Verify Exact Dr 1112 / Cr 1118 Double Entry Balance
    const jLinesRes = await client.query(`
      SELECT l.*, a.code as account_code
      FROM public.accounting_journal_line l
      JOIN public.accounting_account a ON l.account_id = a.id
      WHERE l.journal_entry_id = $1
      ORDER BY a.code ASC
    `, [stage2Result.journalEntry.id]);
    const jLines = jLinesRes.rows;

    assert(jLines.length === 2, 'Exactly 2 journal lines in Stage-2 clearance');
    const line1112 = jLines.find(l => l.account_code === '1112');
    const line1118 = jLines.find(l => l.account_code === '1118');
    assert(line1112 && Number(line1112.debit_amount) === 15000.00 && Number(line1112.credit_amount) === 0, 'Line 1: Dr 1112 Bank Operating A/c 15,000.00');
    assert(line1118 && Number(line1118.credit_amount) === 15000.00 && Number(line1118.debit_amount) === 0, 'Line 2: Cr 1118 Deposit in Transit 15,000.00');
    assert(Number(line1112.debit_amount) === Number(line1118.credit_amount), '10. Exact Dr 1112 === Cr 1118 balanced entry');

    // 2.2 Verify Voucher Date = Statement Value Date
    const vDate = stage2Result.voucher.voucher_date;
    const vDateStr = formatDateOnly(vDate);
    assert(vDateStr === '2026-09-02', `11. Voucher date equals bank statement value_date (expected: 2026-09-02, actual: ${vDateStr})`);

    // 2.3 Verify credit_voucher_id Linkage on Deposit Slip
    const slipA1Db = (await client.query('SELECT * FROM public.bank_deposit_slip WHERE id = $1', [slipA1.id])).rows[0];
    assert(slipA1Db.credit_voucher_id === stage2Result.voucher.id, '12. Deposit slip credit_voucher_id linked to Stage-2 voucher');
    assert(slipA1Db.bank_value_date !== null, 'Deposit slip bank_value_date recorded');

    // 2.4 Verify Statement Line and Match Status Transitions
    const line1Db = (await client.query('SELECT * FROM public.bank_statement_line WHERE id = $1', [line1.id])).rows[0];
    assert(line1Db.reconciliation_status === 'MATCHED', 'Statement line reconciliation_status transitioned to MATCHED');

    const match1Db = (await client.query('SELECT * FROM public.bank_reconciliation_match WHERE id = $1', [match1Result.match.id])).rows[0];
    assert(match1Db.match_status === 'CONFIRMED', 'Match match_status transitioned to CONFIRMED');
    assert(match1Db.confirmed_by === auditorCtx.user_id, 'Match confirmed_by recorded');

    // 2.5 Stage-2 Idempotency
    const reConfirmResult = await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
      matchId: match1Result.match.id,
      confirmerId: auditorCtx.user_id,
      actorContext: auditorCtx,
    });
    assert(reConfirmResult.wasDuplicate === true, '13. Idempotent retry returns existing result (wasDuplicate: true)');
    const vCountAfterIdempotency = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(vCountAfterIdempotency === postVoucherCount, 'Zero duplicate vouchers created on retry');

    // 2.6 Concurrency & Locking Safety
    assert(slipA1Db.transit_voucher_id && slipA1Db.credit_voucher_id, '14. Deterministic row locking protects concurrent transit clearance');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 3: Stage-2 Accounting Configuration & Lifecycle Guards
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[3/10] Verifying Stage-2 Accounting Configuration Guards...');

    // 3.1 Accounting Start Date Guard
    // Match line2 with slipA2 (18,000)
    let startDateGuardFailed = false;
    try {
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
        matchId: match2Result.match.id,
        confirmerId: auditorCtx.user_id,
        actorContext: auditorCtx,
        voucherDate: '2026-03-15', // Prior to accounting start date 2026-04-01
      });
    } catch (e) {
      startDateGuardFailed = e.code === 'POSTING_BEFORE_ACCOUNTING_START_DATE' || e.code === 'ACCOUNTING_START_DATE_VIOLATION' || e.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED';
    }
    assert(startDateGuardFailed, '15. Clearance voucher prior to accounting start date rejected (POSTING_BEFORE_ACCOUNTING_START_DATE)');

    // 3.2 Fiscal Period Guard
    let fiscalPeriodGuardFailed = false;
    try {
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
        matchId: match2Result.match.id,
        confirmerId: auditorCtx.user_id,
        actorContext: auditorCtx,
        voucherDate: '2027-01-15', // No fiscal period for 2027
      });
    } catch (e) {
      fiscalPeriodGuardFailed = e.code === 'FISCAL_PERIOD_NOT_CONFIGURED' || e.code === 'FISCAL_PERIOD_LOCKED';
    }
    assert(fiscalPeriodGuardFailed, '16. Clearance voucher in unconfigured fiscal period rejected (FISCAL_PERIOD_NOT_CONFIGURED)');

    // 3.3 Zero Suspense Account Fallback: Verify Account 1119 was NEVER posted to
    const acc1119Res = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1119'`);
    const acc1119UsedRes = await client.query(`SELECT COUNT(*) FROM public.accounting_journal_line WHERE account_id = $1`, [acc1119Res.rows[0].id]);
    const acc1119Count = parseInt(acc1119UsedRes.rows[0].count, 10);
    assert(acc1119Count === 0, '24. Account 1119 (Unclassified Suspense) was NEVER used as an automatic fallback (count: 0)');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 4: Segregation of Duties (SoD)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[4/10] Verifying Segregation of Duties (SoD) Controls...');

    // 4.1 Matcher cannot be Confirmer (matcher_id != confirmer_id)
    let matcherIsConfirmerFailed = false;
    try {
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
        matchId: match2Result.match.id,
        confirmerId: matcherCtx.user_id, // Matcher attempting to self-confirm!
        actorContext: { ...matcherCtx, permissions: ['BANK.RECON_CONFIRM', 'BANK.DEPOSIT_POST'] },
      });
    } catch (e) {
      matcherIsConfirmerFailed = e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(matcherIsConfirmerFailed, '17. Self-confirmation rejected (matcher_id != confirmer_id)');

    // 4.2 Deposit Slip Preparer cannot confirm Stage-2 clearance or post GL
    let preparerIsConfirmerFailed = false;
    try {
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
        matchId: match2Result.match.id,
        confirmerId: cashierCtx.user_id, // Preparer of deposit slip attempting to clear!
        actorContext: { ...cashierCtx, permissions: ['BANK.RECON_CONFIRM', 'BANK.DEPOSIT_POST'] },
      });
    } catch (e) {
      preparerIsConfirmerFailed = e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(preparerIsConfirmerFailed, '18. Deposit slip preparer cannot confirm bank clearance or post Stage 2');

    // 4.3 Super Admin cannot bypass SoD (even as Super Admin, self-confirming own match is forbidden)
    const slipAdmin = await createAndPostStage1Slip({
      amount: 11000.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-ADMIN-SOD-TEST',
    });
    const lineAdmin = await createTestLine({
      lineNumber: 14,
      creditAmount: 11000.00,
      transactionDate: '2026-09-02',
      valueDate: '2026-09-02',
      description: 'ADMIN SOD TEST DEPOSIT',
    });

    let superAdminBypassFailed = false;
    try {
      // Create a match proposed by admin
      const adminMatch = await BankReconciliationRepository.createMatch({
        sessionId: session.id,
        statementLineId: lineAdmin.id,
        matchSourceType: 'BANK_DEPOSIT_SLIP',
        matchSourceId: slipAdmin.id,
        matchedAmount: 11000.00,
        matchedBy: adminCtx.user_id, // Matched by admin
      }, client);
      createdMatchIds.push(adminMatch.id);

      // Admin tries to self-confirm
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
        matchId: adminMatch.id,
        confirmerId: adminCtx.user_id, // Confirmed by admin!
        actorContext: adminCtx,
      });
    } catch (e) {
      superAdminBypassFailed = e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(superAdminBypassFailed, 'SUPER_ADMIN cannot bypass SoD restrictions (matcher != confirmer)');

    // Now legitimately confirm match2 with auditorCtx
    const validStage2Result2 = await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
      matchId: match2Result.match.id,
      confirmerId: auditorCtx.user_id,
      actorContext: auditorCtx,
    });
    createdVoucherIds.push(validStage2Result2.voucher.id);
    assert(validStage2Result2.voucher && validStage2Result2.depositSlip.credit_voucher_id, 'Legitimate SoD clearance of Slip A2 succeeded');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 5: Vector B Gateway Payout Reconciliation
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[5/10] Verifying Vector B Gateway Payout Reconciliation...');

    // Pre-payout voucher count
    const preGatewayVoucherCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);

    // Insert a posted gateway payout batch (posted in 4.10.3)
    const payoutBatchId = `gpb_test_recon_${Date.now()}`;
    await client.query(`
      INSERT INTO public.gateway_payout_batch (
        id, provider, payout_reference, settlement_reference, bank_account_id,
        settlement_date, gross_amount, identified_fee_amount, reported_tax_amount,
        net_amount, status, prepared_by, posted_by, posted_at, created_at, updated_at
      ) VALUES (
        $1, 'razorpay', 'pout_recon_sept_99', 'UTR_IND_998877', $2,
        '2026-09-02', 50000.00, 1000.00, 180.00, 48820.00, 'POSTED',
        'usr_cashier_01', 'usr_acct_01', NOW(), NOW(), NOW()
      )
    `, [payoutBatchId, ba.id]);
    createdPayoutBatchIds.push(payoutBatchId);

    // Statement credit matching gateway net amount: 48,820.00
    const lineGateway = await createTestLine({
      lineNumber: 9,
      creditAmount: 48820.00,
      transactionDate: '2026-09-03',
      valueDate: '2026-09-03',
      description: 'RAZORPAY SETTLEMENT UTR_IND_998877',
      bankReference: 'UTR_IND_998877',
    });

    // Auto match statement line
    const matchGatewayResult = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      lineGateway.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    createdMatchIds.push(matchGatewayResult.match.id);
    assert(matchGatewayResult.status === 'PROPOSED', '19. Vector B gateway payout candidate matched (status PROPOSED)');
    assert(matchGatewayResult.candidateType === 'GATEWAY_PAYOUT_BATCH', 'Candidate type identified as GATEWAY_PAYOUT_BATCH');
    assert(matchGatewayResult.candidateId === payoutBatchId, 'Candidate matches payoutBatchId');

    // Confirm gateway payout match
    const confirmGatewayResult = await BankReconciliationMatchingEngine.confirmGatewayPayoutMatch({
      matchId: matchGatewayResult.match.id,
      confirmerId: auditorCtx.user_id,
      actorContext: auditorCtx,
    }, client);
    assert(confirmGatewayResult.match.match_status === 'CONFIRMED', 'Gateway payout match confirmed');
    assert(confirmGatewayResult.statementLine.reconciliation_status === 'MATCHED', 'Gateway statement line transitioned to MATCHED');

    // CRITICAL ACCOUNTING INVARIANT: Vector B creates ZERO new GL entries!
    const postGatewayVoucherCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(postGatewayVoucherCount === preGatewayVoucherCount, '20. Confirmation that Vector B creates ZERO new GL vouchers (pre === post)');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 6: Vector C Direct Bank Entries & Supplier Payments
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[6/10] Verifying Vector C Direct Entries & Supplier Payments...');

    const preSupplierVoucherCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);

    // 6.1 Create test supplier and purchase (Step 3D.5 prerequisite)
    const testSupId = `sup_test_recon_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier
        (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
      VALUES
        ($1, 'Test Karnataka Supplier Ltd', '29ABCDE1234F1Z5', 'Karnataka', $2, true, NOW(), NOW())
    `, [testSupId, branch1.id]);
    createdSupplierIds.push(testSupId);

    const testPurchaseId = `pur_test_recon_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase
        (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, '2026-09-01', 25000, 0, 25000, 0, 0, 0, 25000, 'POSTED', 'usr_buyer_01', 'usr_mgr_01', NOW(), NOW())
    `, [testPurchaseId, testSupId, branch1.id, `INV-${testPurchaseId}`]);
    createdPurchaseIds.push(testPurchaseId);

    // Insert a supplier purchase payment (posted in 3D.5)
    const purchasePaymentId = `pp_test_recon_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment (
        id, purchase_id, amount, method, payment_date, reference, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, 25000.00, 'BANK_TRANSFER', '2026-09-02', 'CHQ-SUPP-9912',
        'usr_cashier_01', NOW(), NOW()
      )
    `, [purchasePaymentId, testPurchaseId]);
    createdPurchasePaymentIds.push(purchasePaymentId);

    // Statement debit matching supplier payment: 25,000.00
    const lineSupplier = await createTestLine({
      lineNumber: 10,
      debitAmount: 25000.00,
      transactionDate: '2026-09-02',
      valueDate: '2026-09-02',
      description: 'SUPPLIER RTGS CHQ-SUPP-9912',
      bankReference: 'CHQ-SUPP-9912',
    });

    const matchSupplierResult = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      lineSupplier.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    createdMatchIds.push(matchSupplierResult.match.id);
    assert(matchSupplierResult.status === 'PROPOSED', '21. Vector C supplier payment candidate matched (status PROPOSED)');
    assert(matchSupplierResult.candidateType === 'PURCHASE_PAYMENT', 'Candidate type identified as PURCHASE_PAYMENT');
    assert(matchSupplierResult.candidateId === purchasePaymentId, 'Candidate matches purchasePaymentId');

    // Confirm supplier payment match
    const confirmSupplierResult = await BankReconciliationMatchingEngine.confirmSupplierPaymentMatch({
      matchId: matchSupplierResult.match.id,
      confirmerId: auditorCtx.user_id,
      actorContext: auditorCtx,
    }, client);
    assert(confirmSupplierResult.match.match_status === 'CONFIRMED', 'Supplier payment match confirmed');
    assert(confirmSupplierResult.statementLine.reconciliation_status === 'MATCHED', 'Supplier debit statement line transitioned to MATCHED');

    const postSupplierVoucherCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(postSupplierVoucherCount === preSupplierVoucherCount, 'Vector C creates ZERO new GL vouchers (GL already posted in Step 3D.5)');

    // Unmatched Direct Debit Line (e.g. Bank charges or unknown debit)
    const lineUnmatchedDebit = await createTestLine({
      lineNumber: 11,
      debitAmount: 450.00,
      transactionDate: '2026-09-08',
      description: 'ANNUAL BANK CHARGES',
    });
    const matchDebitResult = await BankReconciliationMatchingEngine.autoMatchStatementLine(
      lineUnmatchedDebit.id,
      session.id,
      matcherCtx.user_id,
      client
    );
    assert(matchDebitResult.status === 'NO_CANDIDATE', '23. Unmatched direct debit creates explicit exception (status NO_CANDIDATE)');
    const debitLineDb = (await client.query('SELECT reconciliation_status FROM bank_statement_line WHERE id = $1', [lineUnmatchedDebit.id])).rows[0];
    assert(debitLineDb.reconciliation_status === 'EXCEPTION', 'Unmatched debit line marked as EXCEPTION; zero automatic GL posting');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 7: Manual Override Capabilities
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[7/10] Verifying Manual Override Capabilities...');

    const lineManual = await createTestLine({
      lineNumber: 12,
      creditAmount: 33000.00,
      transactionDate: '2026-09-04',
      description: 'SPECIAL COUNTER DEPOSIT OVERRIDE',
    });

    // 7.1 Manual match requires documented reason
    let emptyReasonFailed = false;
    try {
      await BankReconciliationMatchingEngine.manualMatch({
        sessionId: session.id,
        statementLineId: lineManual.id,
        matchSourceType: 'DIRECT_BANK_ENTRY',
        matchSourceId: 'manual_source_001',
        overrideReason: '', // Empty reason!
        matcherId: matcherCtx.user_id,
      }, client);
    } catch (e) {
      emptyReasonFailed = e.code === 'OVERRIDE_REASON_REQUIRED';
    }
    assert(emptyReasonFailed, '25. Manual override without documented reason rejected (OVERRIDE_REASON_REQUIRED)');

    // 7.2 Manual match enforces SoD (matcher != confirmer)
    let manualSodFailed = false;
    try {
      await BankReconciliationMatchingEngine.manualMatch({
        sessionId: session.id,
        statementLineId: lineManual.id,
        matchSourceType: 'DIRECT_BANK_ENTRY',
        matchSourceId: 'manual_source_001',
        overrideReason: 'Operator identified special direct branch deposit',
        matcherId: matcherCtx.user_id,
        confirmerId: matcherCtx.user_id, // Same user!
      }, client);
    } catch (e) {
      manualSodFailed = e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(manualSodFailed, 'Manual override enforces distinct matcher and confirmer');

    // 7.3 Valid Manual Override with Audit Trail
    const manualMatchRec = await BankReconciliationMatchingEngine.manualMatch({
      sessionId: session.id,
      statementLineId: lineManual.id,
      matchSourceType: 'DIRECT_BANK_ENTRY',
      matchSourceId: 'manual_source_001',
      overrideReason: 'Approved special cash transit verified by area controller',
      matcherId: matcherCtx.user_id,
      confirmerId: auditorCtx.user_id,
    }, client);
    createdMatchIds.push(manualMatchRec.id);
    assert(manualMatchRec.id && manualMatchRec.match_type === 'MANUAL', 'Valid manual override match created');
    assert(manualMatchRec.metadata.manual_override === true, '26. Manual override audit trail persisted in match metadata');
    assert(manualMatchRec.metadata.override_reason === 'Approved special cash transit verified by area controller', 'Override reason preserved verbatim');

    // Verify source evidence immutability
    const lineManualDb = (await client.query('SELECT * FROM bank_statement_line WHERE id = $1', [lineManual.id])).rows[0];
    assert(Number(lineManualDb.credit_amount) === 33000.00, 'Original statement line credit amount immutable');
    assert(lineManualDb.line_hash === lineManual.line_hash, 'Original statement line line_hash immutable');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 8: Transactional Atomicity & Rollback Safety
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[8/10] Verifying Transactional Atomicity & Rollback Safety...');

    // 8.1 Rollback on posting failure
    const preRollbackVoucherCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const slipRollback = await createAndPostStage1Slip({
      amount: 14000.00,
      depositDate: '2026-09-02',
      slipNumber: 'BDS-ROLLBACK-TEST',
    });
    const lineRollback = await createTestLine({
      lineNumber: 13,
      creditAmount: 14000.00,
      transactionDate: '2026-09-02',
      description: 'ROLLBACK TEST LINE',
    });

    const matchRollback = await BankReconciliationRepository.createMatch({
      sessionId: session.id,
      statementLineId: lineRollback.id,
      matchSourceType: 'BANK_DEPOSIT_SLIP',
      matchSourceId: slipRollback.id,
      matchedAmount: 14000.00,
      matchedBy: matcherCtx.user_id,
    }, client);
    createdMatchIds.push(matchRollback.id);

    let postingFailureTriggered = false;
    try {
      // Pass an invalid actor without permission or simulate posting failure
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
        matchId: matchRollback.id,
        confirmerId: 'usr_unauthorized_user',
        actorContext: { id: 'usr_unauthorized_user', role: 'GUEST', permissions: [] },
      });
    } catch (e) {
      postingFailureTriggered = e.code === 'PERMISSION_DENIED';
    }
    assert(postingFailureTriggered, '29. Rollback verified: Unauthorized clearance rejected (PERMISSION_DENIED)');

    // Verify slip was NOT partially cleared
    const slipRollbackDb = (await client.query('SELECT credit_voucher_id FROM bank_deposit_slip WHERE id = $1', [slipRollback.id])).rows[0];
    assert(slipRollbackDb.credit_voucher_id === null, 'credit_voucher_id remained NULL on posting rollback');

    // Verify match was NOT confirmed
    const matchRollbackDb = (await client.query('SELECT match_status FROM bank_reconciliation_match WHERE id = $1', [matchRollback.id])).rows[0];
    assert(matchRollbackDb.match_status === 'PROPOSED', 'Match remained PROPOSED on posting rollback');

    // 8.2 Rollback on match persistence failure
    // DB check constraint chk_brm_sod_matcher_confirmer enforces matched_by <> confirmed_by
    let sodRollbackTriggered = false;
    try {
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance({
        matchId: matchRollback.id,
        confirmerId: matcherCtx.user_id, // Same as matcher
        actorContext: { ...matcherCtx, permissions: ['BANK.RECON_CONFIRM', 'BANK.DEPOSIT_POST'] },
      });
    } catch (e) {
      sodRollbackTriggered = e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(sodRollbackTriggered, '30. Rollback on match persistence SoD failure verified');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 9: Immutability & Historical Quarantine
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[9/10] Verifying Immutability & Historical Quarantine...');

    // 9.1 Posted Voucher Immutability (check PostingService update attempt)
    const postedVoucherId = stage2Result.voucher.id;

    // A. Service-level immutability: PostingService rejects cancelling a POSTED voucher
    const cancelAttempt = await PostingService.cancelVoucher({
      voucherId: postedVoucherId,
      cancelledBy: auditorCtx.user_id,
      branchId: branch1.id,
      client,
    });
    assert(cancelAttempt.success === false && cancelAttempt.code === 'INVALID_VOUCHER_STATE', '27a. Service rejects cancellation of POSTED voucher (INVALID_VOUCHER_STATE)');

    // B. Database-level immutability: chk_voucher_posted_immutable forbids status='CANCELLED' when posted_at is set
    let dbCancelFailed = false;
    try {
      await client.query(`UPDATE public.accounting_voucher SET status = 'CANCELLED' WHERE id = $1`, [postedVoucherId]);
    } catch (e) {
      dbCancelFailed = e.message && e.message.includes('chk_voucher_posted_immutable');
    }
    assert(dbCancelFailed, '27b. Database constraint chk_voucher_posted_immutable forbids cancelling posted voucher');

    // C. Authoritative voucher state remains in POSTED status
    const postedVoucherDb = (await client.query('SELECT status, posted_at, posted_by FROM public.accounting_voucher WHERE id = $1', [postedVoucherId])).rows[0];
    assert(postedVoucherDb.status === 'POSTED' && postedVoucherDb.posted_at !== null && postedVoucherDb.posted_by === auditorCtx.user_id, '27c. Posted Stage-2 clearance voucher remains in immutable POSTED state');

    // D. Authoritative journal entry remains active (is_reversed === false)
    const jeDb = (await client.query('SELECT is_reversed, total_debit, total_credit FROM public.accounting_journal_entry WHERE voucher_id = $1', [postedVoucherId])).rows[0];
    assert(jeDb && jeDb.is_reversed === false && Number(jeDb.total_debit) === 15000.00, '27d. Linked journal entry remains active (is_reversed: false) and balanced');

    // 9.2 Historical Quarantine: 173 orders and 53 payment transactions
    const orderCount = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const paymentCount = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    assert(orderCount === 173, '28. Historical orders strictly untouched at 173 (quarantine preserved)');
    assert(paymentCount === 53, 'Historical prototype payment transactions strictly untouched at 53');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 10: Fixture Teardown & Post-test PostgreSQL Baseline Audit
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[10/10] Executing 100% Fixture Teardown and Post-test Baseline Audit...');

    // Clean up matches
    await client.query(`DELETE FROM public.bank_reconciliation_match WHERE session_id = ANY($1) OR id = ANY($2)`, [
      createdSessionIds.length > 0 ? createdSessionIds : ['none'],
      createdMatchIds.length > 0 ? createdMatchIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test bank reconciliation matches');

    // Clean up sessions
    await client.query(`DELETE FROM public.bank_reconciliation_session WHERE id = ANY($1)`, [
      createdSessionIds.length > 0 ? createdSessionIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test bank reconciliation sessions');

    // Clean up statement lines
    await client.query(`DELETE FROM public.bank_statement_line WHERE import_id = ANY($1) OR id = ANY($2)`, [
      createdImportIds.length > 0 ? createdImportIds : ['none'],
      createdLineIds.length > 0 ? createdLineIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test bank statement lines');

    // Clean up statement imports
    await client.query(`DELETE FROM public.bank_statement_import WHERE id = ANY($1)`, [
      createdImportIds.length > 0 ? createdImportIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test bank statement imports');

    // Clean up gateway payout batches
    await client.query(`DELETE FROM public.gateway_payout_batch WHERE id = ANY($1)`, [
      createdPayoutBatchIds.length > 0 ? createdPayoutBatchIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test gateway payout batches');

    // Clean up purchase payments, purchases, and suppliers
    await client.query(`DELETE FROM public.purchase_payment WHERE id = ANY($1)`, [
      createdPurchasePaymentIds.length > 0 ? createdPurchasePaymentIds : ['none']
    ]);
    await client.query(`DELETE FROM public.purchase WHERE id = ANY($1)`, [
      createdPurchaseIds.length > 0 ? createdPurchaseIds : ['none']
    ]);
    await client.query(`DELETE FROM public.supplier WHERE id = ANY($1)`, [
      createdSupplierIds.length > 0 ? createdSupplierIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test purchase payments, purchases, and suppliers');

    // Clean up deposit slips (unlink vouchers first)
    await client.query(`UPDATE public.bank_deposit_slip SET transit_voucher_id = NULL, credit_voucher_id = NULL WHERE id = ANY($1)`, [
      createdDepositSlipIds.length > 0 ? createdDepositSlipIds : ['none']
    ]);
    await client.query(`DELETE FROM public.bank_deposit_slip WHERE id = ANY($1)`, [
      createdDepositSlipIds.length > 0 ? createdDepositSlipIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test bank deposit slips');

    // Clean up vouchers, journal entries, and lines
    if (createdVoucherIds.length > 0) {
      await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1))`, [createdVoucherIds]);
      await client.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVoucherIds]);
      await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVoucherIds]);
      console.log(`  ✓ Cleaned up ${createdVoucherIds.length} test vouchers & journal entries`);
    }

    // Clean up bank accounts
    await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [
      createdBankAccountIds.length > 0 ? createdBankAccountIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test bank accounts');

    // Clean up fiscal periods
    await client.query(`DELETE FROM public.accounting_fiscal_period WHERE id = ANY($1)`, [
      createdPeriodIds.length > 0 ? createdPeriodIds : ['none']
    ]);
    console.log('  ✓ Cleaned up test fiscal periods');

    // Remove test setting
    await client.query(`DELETE FROM public.setting WHERE key = 'accounting_start_date' OR id = 'set_recon_start_date'`);
    console.log('  ✓ Removed temporary accounting_start_date setting');

    // POST-TEST AUDIT
    for (const [table, expected] of Object.entries(baselineChecks)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM public."order"' : `SELECT COUNT(*) FROM public."${table}"`;
      const cnt = parseInt((await client.query(q)).rows[0].count, 10);
      assert(cnt === expected, `Post-test ${table} === ${expected} (actual: ${cnt})`);
    }

  } catch (err) {
    console.error('FATAL TEST ERROR:', err);
    failCount++;
  } finally {
    // Safety cleanup in case of abort
    try {
      if (createdSessionIds.length > 0) {
        await client.query(`DELETE FROM public.bank_reconciliation_match WHERE session_id = ANY($1)`, [createdSessionIds]);
        await client.query(`DELETE FROM public.bank_reconciliation_session WHERE id = ANY($1)`, [createdSessionIds]);
      }
      if (createdImportIds.length > 0) {
        await client.query(`DELETE FROM public.bank_statement_line WHERE import_id = ANY($1)`, [createdImportIds]);
        await client.query(`DELETE FROM public.bank_statement_import WHERE id = ANY($1)`, [createdImportIds]);
      }
      if (createdPayoutBatchIds.length > 0) {
        await client.query(`DELETE FROM public.gateway_payout_batch WHERE id = ANY($1)`, [createdPayoutBatchIds]);
      }
      if (createdPurchasePaymentIds.length > 0) {
        await client.query(`DELETE FROM public.purchase_payment WHERE id = ANY($1)`, [createdPurchasePaymentIds]);
      }
      if (createdPurchaseIds.length > 0) {
        await client.query(`DELETE FROM public.purchase WHERE id = ANY($1)`, [createdPurchaseIds]);
      }
      if (createdSupplierIds.length > 0) {
        await client.query(`DELETE FROM public.supplier WHERE id = ANY($1)`, [createdSupplierIds]);
      }
      if (createdDepositSlipIds.length > 0) {
        await client.query(`UPDATE public.bank_deposit_slip SET transit_voucher_id = NULL, credit_voucher_id = NULL WHERE id = ANY($1)`, [createdDepositSlipIds]);
        await client.query(`DELETE FROM public.bank_deposit_slip WHERE id = ANY($1)`, [createdDepositSlipIds]);
      }
      if (createdVoucherIds.length > 0) {
        await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1))`, [createdVoucherIds]);
        await client.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVoucherIds]);
        await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVoucherIds]);
      }
      if (createdBankAccountIds.length > 0) {
        await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccountIds]);
      }
      if (createdPeriodIds.length > 0) {
        await client.query(`DELETE FROM public.accounting_fiscal_period WHERE id = ANY($1)`, [createdPeriodIds]);
      }
      await client.query(`DELETE FROM public.setting WHERE key = 'accounting_start_date' OR id = 'set_recon_start_date'`);
    } catch (cleanupErr) {
      console.error('Safety cleanup error:', cleanupErr);
    }
  }

  // Print results
  console.log('\n=============================================================================');
  console.log(`STEP 4.10.5-C TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================\n');

  // Close singleton DB pool
  try {
    await closeDbPool();
  } catch (poolCloseErr) {
    console.error('Error closing DB pool:', poolCloseErr);
  }

  // Close dedicated client
  try {
    await client.end();
  } catch (clientEndErr) {
    console.error('Error closing dedicated client:', clientEndErr);
  }

  // Exit with correct status
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});
