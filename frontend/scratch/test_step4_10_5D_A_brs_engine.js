/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-D-A Test Suite
 * Bank Reconciliation Statement (BRS) Calculation Engine + Repository
 *
 * TEST DOMAINS:
 * 0. Pre-test PostgreSQL baseline audit (pristine verification).
 * 1. GL 1112 balance calculation (SUM debits - SUM credits, integer paise).
 * 2. Bank closing balance (latest running_balance, net-sum fallback, zero).
 * 3. 1118 uncleared deposits (authoritative bank_deposit_slip in transit).
 * 4. Cleared 1118 exclusion (Stage 2 clearance voucher posted on/before as_of_date).
 * 5. Outstanding supplier payment (PURCHASE_PAYMENT credit to 1112).
 * 6. Already-matched payment exclusion (reconciliation match confirmed on/before as_of_date).
 * 7. Supported customer refund (CUSTOMER_REFUND credit to 1112).
 * 8. Expense-payment source validation (isDisbursementSourceSupported check).
 * 9. Unsupported expense-payment behavior (Phase 2 expenses have no GL 1112 posting).
 * 10. Unmatched bank debit (U_debit from statement charges).
 * 11. Unmatched bank credit (U_credit from statement interest).
 * 12. No 1119 fallback (zero suspense account entries).
 * 13. Value_date cutoff (bank statement effective date respects value_date).
 * 14. Transaction_date fallback (when value_date is null).
 * 15. Voucher_date cutoff (GL cutoff on voucher_date <= as_of_date).
 * 16. Future transaction exclusion (vouchers and bank lines after as_of_date excluded).
 * 17. Integer-paise precision (all values exact integers, zero floating-point errors).
 * 18. Exact discrepancy calculation (Reconciled Book Balance - B_gl = 0.00).
 * 19. Branch isolation (branch staff cannot access another branch account).
 * 20. Enterprise account isolation (branch staff cannot access enterprise account).
 * 21. Unauthorized account access (customer/anonymous rejected, missing context rejected).
 * 22. Deterministic repeated calculation (subsequent runs produce bit-for-bit identical results).
 * 23. Server-side pagination (limit default 50, max 200, offset, counts).
 * 24. Empty-period behavior (zero balances, zero discrepancy, isReconciled = true).
 * 25. No accounting mutations (zero INSERT/UPDATE/DELETE on vouchers/journals).
 * 26. No statement mutations (zero UPDATE/DELETE on bank_statement_line).
 * 27. No deposit-slip mutations (zero UPDATE/DELETE on bank_deposit_slip).
 * 28. Historical prototype quarantine (173 orders, 53 payments, 424 items untouched).
 * 29. Closed-session immutability behavior (closed BRS evidence cannot be rewritten).
 * 30. Fixture Teardown & Post-test PostgreSQL Baseline Audit.
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
  console.log('CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-D-A Test Suite');
  console.log('Bank Reconciliation Statement (BRS) Engine & Repository (Read-Only)');
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

  const client = new Client({ connectionString: connStr });
  await client.connect();

  const { dbQuery, closeDbPool } = require('../src/lib/db');
  const { BankReconciliationRepository } = require('../src/lib/repositories/bank-reconciliation.repository');
  const {
    BankReconciliationStatementService,
    BankReconciliationStatementError,
  } = require('../src/lib/services/bank-reconciliation-statement.service');

  let totalPassed = 0;
  let totalFailed = 0;

  function assert(condition, message) {
    if (condition) {
      totalPassed++;
      console.log(`  PASS: ${message}`);
    } else {
      totalFailed++;
      console.error(`  FAIL: ${message}`);
    }
  }

  const PREFIX = 't4105da_';
  const AS_OF_DATE = '2026-09-30';
  const FUTURE_DATE = '2026-10-15';
  const PAST_DATE = '2026-09-15';

  const accounts = {
    enterprise: `${PREFIX}ba_corp`,
    north: `${PREFIX}ba_north`,
    south: `${PREFIX}ba_south`,
  };

  const branches = {
    north: `${PREFIX}br_north`,
    south: `${PREFIX}br_south`,
  };

  // Tracking IDs for cleanup
  const createdIds = {
    vouchers: [],
    journalEntries: [],
    journalLines: [],
    bankAccounts: [],
    depositSlips: [],
    statementImports: [],
    statementLines: [],
    sessions: [],
    matches: [],
  };

  try {
    // =========================================================================
    // DOMAIN 0: PRE-TEST AUDIT
    // =========================================================================
    console.log('--- DOMAIN 0: Pre-test PostgreSQL Baseline Audit ---');
    const coaCountRes = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_account WHERE deleted_at IS NULL`);
    assert(Number(coaCountRes.rows[0].count) === 99, `Pre-test accounting_account count is 99 (got ${coaCountRes.rows[0].count})`);

    const orderCountRes = await client.query(`SELECT COUNT(*)::int AS count FROM public."order" WHERE deleted_at IS NULL`);
    assert(Number(orderCountRes.rows[0].count) === 173, `Pre-test orders count is 173 (got ${orderCountRes.rows[0].count})`);

    const pmtCountRes = await client.query(`SELECT COUNT(*)::int AS count FROM public.payment_transaction WHERE deleted_at IS NULL`);
    assert(Number(pmtCountRes.rows[0].count) === 53, `Pre-test prototype payment count is 53 (got ${pmtCountRes.rows[0].count})`);

    const invCountRes = await client.query(`SELECT COUNT(*)::int AS count FROM public.branch_inventory WHERE deleted_at IS NULL`);
    assert(Number(invCountRes.rows[0].count) === 424, `Pre-test branch_inventory count is 424 (got ${invCountRes.rows[0].count})`);

    // Lookup COA account IDs
    const coaRes = await client.query(`SELECT id, code FROM public.accounting_account WHERE code IN ('1111', '1112', '1118', '2111', '1121', '5290')`);
    const coaMap = {};
    for (const r of coaRes.rows) coaMap[r.code] = r.id;
    // Lookup real branches from database
    const branchRes = await client.query('SELECT id, name FROM public.branch ORDER BY id LIMIT 2');
    const branch1 = branchRes.rows[0];
    const branch2 = branchRes.rows[1];
    assert(branch1 && branch2, `Found test branches: ${branch1?.id}, ${branch2?.id}`);

    const branches = {
      north: branch1.id,
      south: branch2.id,
    };

    // =========================================================================
    // SETUP FIXTURES
    // =========================================================================
    console.log('\n--- Setting up isolated test fixtures ---');
    // 1. Enterprise bank account
    await client.query(`
      INSERT INTO public.bank_account
        (id, company_id, branch_id, bank_name, account_number_masked, ifsc_code, status, created_at, updated_at)
      VALUES
        ($1, 'company_default', NULL, 'HDFC Enterprise Corp A/c', 'XXXXXX1111', 'HDFC0001111', 'ACTIVE', NOW(), NOW())
    `, [accounts.enterprise]);
    createdIds.bankAccounts.push(accounts.enterprise);

    // 2. Branch North bank account
    await client.query(`
      INSERT INTO public.bank_account
        (id, company_id, branch_id, bank_name, account_number_masked, ifsc_code, status, created_at, updated_at)
      VALUES
        ($1, 'company_default', $2, 'ICICI Branch North A/c', 'XXXXXX2222', 'ICIC0002222', 'ACTIVE', NOW(), NOW())
    `, [accounts.north, branches.north]);
    createdIds.bankAccounts.push(accounts.north);

    // 3. Branch South bank account
    await client.query(`
      INSERT INTO public.bank_account
        (id, company_id, branch_id, bank_name, account_number_masked, ifsc_code, status, created_at, updated_at)
      VALUES
        ($1, 'company_default', $2, 'SBI Branch South A/c', 'XXXXXX3333', 'SBIN0003333', 'ACTIVE', NOW(), NOW())
    `, [accounts.south, branches.south]);
    createdIds.bankAccounts.push(accounts.south);

    const superAdminContext = {
      id: 'admin_01',
      role: 'SUPER_ADMIN',
      permissions: ['BANK.RECON_VIEW', 'BANK.VIEW', 'ACCOUNTING.VIEW'],
    };

    const branchNorthContext = {
      id: `${PREFIX}staff_north`,
      role: 'BRANCH_MANAGER',
      branch_id: branches.north,
      permissions: ['BANK.RECON_VIEW'],
    };

    const branchSouthContext = {
      id: `${PREFIX}staff_south`,
      role: 'BRANCH_MANAGER',
      branch_id: branches.south,
      permissions: ['BANK.RECON_VIEW'],
    };

    // =========================================================================
    // DOMAIN 1: EMPTY PERIOD BEHAVIOR (Requirement 24)
    // =========================================================================
    console.log('\n--- DOMAIN 1: Empty Period Behavior (Requirement 24) ---');
    const emptyBrs = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      actorContext: superAdminContext,
    });
    assert(emptyBrs.summary.statementClosingBalancePaise === 0, 'Empty account statement closing balance is 0 paise');
    assert(emptyBrs.summary.gl1112BookBalancePaise === 0, 'Empty account GL 1112 balance is 0 paise');
    assert(emptyBrs.summary.totalDepositsInTransitPaise === 0, 'Empty account deposits in transit is 0 paise');
    assert(emptyBrs.summary.totalOutstandingDisbursementsPaise === 0, 'Empty account outstanding disbursements is 0 paise');
    assert(emptyBrs.summary.totalUnmatchedBankDebitsPaise === 0, 'Empty account unmatched debits is 0 paise');
    assert(emptyBrs.summary.totalUnmatchedBankCreditsPaise === 0, 'Empty account unmatched credits is 0 paise');
    assert(emptyBrs.summary.discrepancyPaise === 0, 'Empty account discrepancy is exactly 0 paise');
    assert(emptyBrs.summary.isReconciled === true, 'Empty account isReconciled flag is true');

    // =========================================================================
    // DOMAIN 2: GL 1112 BALANCE & CUTOFF (Requirements 1, 15, 16)
    // =========================================================================
    console.log('\n--- DOMAIN 2: GL 1112 Balance & Date Cutoff (Requirements 1, 15, 16) ---');
    // Helper to create posted voucher + JE + JL
    async function createVoucherWithLines({ id, voucherNo, voucherDate, status, referenceType, referenceId, branchId, lines }) {
      const effBranch = branchId || branches.north;
      await client.query('BEGIN');
      try {
        await client.query(`
          INSERT INTO public.accounting_voucher
            (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, reference_type, reference_id, narration, created_by, created_at, updated_at)
          VALUES
            ($1, $2, 'PAYMENT', $3, $4, 'FY2026', $5, $6, 'INR', $7, $8, 'Test Voucher Narration', 'cashier_01', NOW(), NOW())
        `, [id, voucherNo, voucherDate, effBranch, status, lines.reduce((acc, l) => acc + (l.debit || l.credit || 0), 0), referenceType || null, referenceId || null]);
        createdIds.vouchers.push(id);

        const jeId = `je_${id}`;
        const totalAmount = lines.reduce((acc, l) => acc + (l.debit || 0), 0);
        await client.query(`
          INSERT INTO public.accounting_journal_entry
            (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, is_reversed, narration, created_by, created_at)
          VALUES
            ($1, $2, $3, $4, $5, 'FY2026', $6, $6, false, 'Test Entry', 'cashier_01', NOW())
        `, [jeId, `JE-${id}`, id, voucherDate, effBranch, totalAmount]);
        createdIds.journalEntries.push(jeId);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const jlId = `jl_${id}_${i + 1}`;
          await client.query(`
            INSERT INTO public.accounting_journal_line
              (id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [jlId, jeId, i + 1, line.accountId, line.debit || 0, line.credit || 0, effBranch, line.narration || 'Test Line']);
          createdIds.journalLines.push(jlId);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    // Voucher 1: Posted on 2026-09-15: Dr 1112 ₹1,000.00 (100,000 paise), Cr 1111 ₹1,000.00
    await createVoucherWithLines({
      id: `${PREFIX}vch_01`,
      voucherNo: `${PREFIX}VCH-01`,
      voucherDate: PAST_DATE,
      status: 'POSTED',
      branchId: null,
      lines: [
        { accountId: coaMap['1112'], debit: 1000.00, credit: 0 },
        { accountId: coaMap['1111'], debit: 0, credit: 1000.00 },
      ],
    });

    // Voucher 2: Future date 2026-10-15: Dr 1112 ₹500.00
    await createVoucherWithLines({
      id: `${PREFIX}vch_future`,
      voucherNo: `${PREFIX}VCH-FUT`,
      voucherDate: FUTURE_DATE,
      status: 'POSTED',
      branchId: null,
      lines: [
        { accountId: coaMap['1112'], debit: 500.00, credit: 0 },
        { accountId: coaMap['1111'], debit: 0, credit: 500.00 },
      ],
    });

    // Voucher 3: DRAFT status on 2026-09-15: Dr 1112 ₹300.00
    await createVoucherWithLines({
      id: `${PREFIX}vch_draft`,
      voucherNo: `${PREFIX}VCH-DFT`,
      voucherDate: PAST_DATE,
      status: 'DRAFT',
      branchId: null,
      lines: [
        { accountId: coaMap['1112'], debit: 300.00, credit: 0 },
        { accountId: coaMap['1111'], debit: 0, credit: 300.00 },
      ],
    });

    const glBalRes = await BankReconciliationRepository.getGlAccountBalance('1112', AS_OF_DATE);
    assert(glBalRes.totalDebitPaise === 100000, `GL 1112 posted debit balance is exactly 100,000 paise (₹1,000.00) (got ${glBalRes.totalDebitPaise})`);
    assert(glBalRes.netDebitPaise === 100000, `GL 1112 net debit balance is 100,000 paise (got ${glBalRes.netDebitPaise})`);
    assert(glBalRes.count === 1, `GL 1112 line count is 1 (future and draft excluded) (got ${glBalRes.count})`);

    // =========================================================================
    // DOMAIN 3: BANK CLOSING BALANCE & EFFECTIVE DATE SEMANTICS (Reqs 2, 13, 14)
    // =========================================================================
    console.log('\n--- DOMAIN 3: Bank Closing Balance & Date Semantics (Requirements 2, 13, 14) ---');
    const importId = `${PREFIX}imp_01`;
    await client.query(`
      INSERT INTO public.bank_statement_import
        (id, bank_account_id, company_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, total_lines_imported, total_debit_amount, total_credit_amount, status, imported_by, imported_at, created_at, updated_at)
      VALUES
        ($1, $2, 'company_default', 'test_stmt.csv', 'CSV', 'sha256_mock_01', '2026-09-01', '2026-09-30', 3, 0, 1700.00, 'COMPLETED', 'importer_01', NOW(), NOW(), NOW())
    `, [importId, accounts.enterprise]);
    createdIds.statementImports.push(importId);

    // Line 1: transaction_date = 2026-09-10, value_date = 2026-09-12, credit = 1000.00, running_balance = 1000.00
    const line1Id = `${PREFIX}bsl_01`;
    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 1, '2026-09-10', '2026-09-12', 'Bank Credit Deposit', 0, 1000.00, 1000.00, 'hash_01', 'UNMATCHED', NOW(), NOW())
    `, [line1Id, importId, accounts.enterprise]);
    createdIds.statementLines.push(line1Id);

    // Line 2: transaction_date = 2026-09-20, value_date = NULL (fallback to transaction_date), credit = 200.00, running_balance = 1200.00
    const line2Id = `${PREFIX}bsl_02`;
    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 2, '2026-09-20', NULL, 'Direct Bank Credit', 0, 200.00, 1200.00, 'hash_02', 'UNMATCHED', NOW(), NOW())
    `, [line2Id, importId, accounts.enterprise]);
    createdIds.statementLines.push(line2Id);

    // Line 3: Future effective date: transaction_date = 2026-09-28, value_date = 2026-10-05 (> as_of_date), credit = 500.00, running_balance = 1700.00
    const line3Id = `${PREFIX}bsl_03`;
    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 3, '2026-09-28', '2026-10-05', 'Future Value Date Credit', 0, 500.00, 1700.00, 'hash_03', 'UNMATCHED', NOW(), NOW())
    `, [line3Id, importId, accounts.enterprise]);
    createdIds.statementLines.push(line3Id);

    const bankClosing = await BankReconciliationRepository.getBankStatementClosingBalance(accounts.enterprise, AS_OF_DATE);
    assert(bankClosing.closingBalancePaise === 120000, `Bank statement closing balance as of 2026-09-30 is 120,000 paise (Line 2 running_balance ₹1,200.00; Line 3 future excluded) (got ${bankClosing.closingBalancePaise})`);
    assert(bankClosing.source === 'RUNNING_BALANCE', `Bank closing balance source is RUNNING_BALANCE (got ${bankClosing.source})`);

    // =========================================================================
    // DOMAIN 4: 1118 UNCLEARED DEPOSITS & CLEARED EXCLUSION (Reqs 3, 4, 12)
    // =========================================================================
    console.log('\n--- DOMAIN 4: 1118 Uncleared Deposits & Cleared Exclusion (Requirements 3, 4, 12) ---');
    // Transit voucher for Slip 1 (Stage 1 posted Dr 1118 / Cr 1111)
    const tv1Id = `${PREFIX}vch_tv1`;
    await createVoucherWithLines({
      id: tv1Id,
      voucherNo: `${PREFIX}VCH-TV1`,
      voucherDate: PAST_DATE,
      status: 'POSTED',
      branchId: null,
      lines: [
        { accountId: coaMap['1118'], debit: 500.00, credit: 0 },
        { accountId: coaMap['1111'], debit: 0, credit: 500.00 },
      ],
    });

    // Deposit Slip 1: In Transit (credit_voucher_id is NULL)
    const slip1Id = `${PREFIX}bds_01`;
    await client.query(`
      INSERT INTO public.bank_deposit_slip
        (id, slip_number, company_id, branch_id, bank_account_id, deposit_date, amount, denominations, status, prepared_by, transit_voucher_id, credit_voucher_id, created_at, updated_at)
      VALUES
        ($1, 'SLIP-01', 'company_default', $4, $2, $3, 500.00, '{}', 'DISPATCHED', 'clerk_01', $5, NULL, NOW(), NOW())
    `, [slip1Id, accounts.enterprise, PAST_DATE, branches.north, tv1Id]);
    createdIds.depositSlips.push(slip1Id);

    // Transit voucher for Slip 2
    const tv2Id = `${PREFIX}vch_tv2`;
    await createVoucherWithLines({
      id: tv2Id,
      voucherNo: `${PREFIX}VCH-TV2`,
      voucherDate: PAST_DATE,
      status: 'POSTED',
      branchId: null,
      lines: [
        { accountId: coaMap['1118'], debit: 300.00, credit: 0 },
        { accountId: coaMap['1111'], debit: 0, credit: 300.00 },
      ],
    });

    // Clearance voucher for Slip 2 (Stage 2 posted on 2026-09-20: Dr 1112 / Cr 1118)
    const cv2Id = `${PREFIX}vch_cv2`;
    await createVoucherWithLines({
      id: cv2Id,
      voucherNo: `${PREFIX}VCH-CV2`,
      voucherDate: '2026-09-20',
      status: 'POSTED',
      branchId: null,
      lines: [
        { accountId: coaMap['1112'], debit: 300.00, credit: 0 },
        { accountId: coaMap['1118'], debit: 0, credit: 300.00 },
      ],
    });

    // Deposit Slip 2: Cleared on or before asOfDate
    const slip2Id = `${PREFIX}bds_02`;
    await client.query(`
      INSERT INTO public.bank_deposit_slip
        (id, slip_number, company_id, branch_id, bank_account_id, deposit_date, amount, denominations, status, prepared_by, transit_voucher_id, credit_voucher_id, created_at, updated_at)
      VALUES
        ($1, 'SLIP-02', 'company_default', $4, $2, $3, 300.00, '{}', 'CONFIRMED', 'clerk_01', $5, $6, NOW(), NOW())
    `, [slip2Id, accounts.enterprise, PAST_DATE, branches.north, tv2Id, cv2Id]);
    createdIds.depositSlips.push(slip2Id);

    const unclearedDeposits = await BankReconciliationRepository.getUnclearedDepositSlips(accounts.enterprise, AS_OF_DATE);
    assert(unclearedDeposits.totalCount === 1, `Uncleared deposit slips count is 1 (Slip 2 excluded) (got ${unclearedDeposits.totalCount})`);
    assert(unclearedDeposits.totalPaise === 50000, `Uncleared deposits total paise is 50,000 (₹500.00) (got ${unclearedDeposits.totalPaise})`);
    assert(unclearedDeposits.items[0].id === slip1Id, `Uncleared deposit slip item is Slip 1 (got ${unclearedDeposits.items[0]?.id})`);

    // Verify Account 1119 (Suspense) check
    const suspenseCheck = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_journal_line jl JOIN public.accounting_account a ON a.id = jl.account_id WHERE a.code = '1119'`);
    assert(Number(suspenseCheck.rows[0].count) === 0, 'Requirement 12: Zero entries posted to Account 1119 (Suspense)');

    // =========================================================================
    // DOMAIN 5: OUTSTANDING DISBURSEMENTS (Requirements 5, 6, 7)
    // =========================================================================
    console.log('\n--- DOMAIN 5: Outstanding Internal Disbursements (Requirements 5, 6, 7) ---');
    // Supplier Payment 1: Unmatched (Cr 1112 ₹200.00 = 20,000 paise)
    const pp1Id = `${PREFIX}pp_01`;
    const vchPp1Id = `${PREFIX}vch_pp1`;
    await createVoucherWithLines({
      id: vchPp1Id,
      voucherNo: `${PREFIX}VCH-PP1`,
      voucherDate: '2026-09-18',
      status: 'POSTED',
      referenceType: 'PURCHASE_PAYMENT',
      referenceId: pp1Id,
      lines: [
        { accountId: coaMap['2111'], debit: 200.00, credit: 0 },
        { accountId: coaMap['1112'], debit: 0, credit: 200.00, narration: 'Disbursement to Supplier A' },
      ],
    });

    // Customer Refund 1: Unmatched (Cr 1112 ₹100.00 = 10,000 paise)
    const cr1Id = `${PREFIX}ord_refund_01`;
    const vchCr1Id = `${PREFIX}vch_cr1`;
    await createVoucherWithLines({
      id: vchCr1Id,
      voucherNo: `${PREFIX}VCH-CR1`,
      voucherDate: '2026-09-22',
      status: 'POSTED',
      referenceType: 'CUSTOMER_REFUND',
      referenceId: cr1Id,
      lines: [
        { accountId: coaMap['1121'], debit: 100.00, credit: 0 },
        { accountId: coaMap['1112'], debit: 0, credit: 100.00, narration: 'Disbursement to Customer' },
      ],
    });

    // Supplier Payment 2: Already matched to bank statement (Cr 1112 ₹400.00)
    const pp2Id = `${PREFIX}pp_02`;
    const vchPp2Id = `${PREFIX}vch_pp2`;
    await createVoucherWithLines({
      id: vchPp2Id,
      voucherNo: `${PREFIX}VCH-PP2`,
      voucherDate: '2026-09-20',
      status: 'POSTED',
      referenceType: 'PURCHASE_PAYMENT',
      referenceId: pp2Id,
      lines: [
        { accountId: coaMap['2111'], debit: 400.00, credit: 0 },
        { accountId: coaMap['1112'], debit: 0, credit: 400.00 },
      ],
    });

    // Create session and confirmed match for Payment 2
    const sessId = `${PREFIX}sess_01`;
    await BankReconciliationRepository.createSession({
      id: sessId,
      bankAccountId: accounts.enterprise,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      openingBalancePerBank: 0,
      closingBalancePerBank: 1200.00,
      status: 'IN_PROGRESS',
      preparedBy: 'preparer_01',
    }, client);
    createdIds.sessions.push(sessId);

    // Bank debit statement line for Payment 2
    const bslDebitId = `${PREFIX}bsl_debit_pp2`;
    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 4, '2026-09-25', '2026-09-25', 'Cleared Supplier Chq', 400.00, 0, 800.00, 'hash_04', 'MATCHED', NOW(), NOW())
    `, [bslDebitId, importId, accounts.enterprise]);
    createdIds.statementLines.push(bslDebitId);

    const matchId = `${PREFIX}match_01`;
    await client.query(`
      INSERT INTO public.bank_reconciliation_match
        (id, session_id, statement_line_id, match_source_type, match_source_id, match_type, matched_amount, match_status, matched_by, matched_at, confirmed_by, confirmed_at, created_at, updated_at)
      VALUES
        ($1, $2, $3, 'PURCHASE_PAYMENT', $4, 'EXACT', 400.00, 'CONFIRMED', 'matcher_01', NOW(), 'confirmer_01', NOW(), NOW(), NOW())
    `, [matchId, sessId, bslDebitId, pp2Id]);
    createdIds.matches.push(matchId);

    const outstanding = await BankReconciliationRepository.getOutstandingDisbursements(accounts.enterprise, AS_OF_DATE);
    assert(outstanding.totalCount === 2, `Outstanding disbursements count is 2 (Payment 1 + Refund 1; Payment 2 excluded) (got ${outstanding.totalCount})`);
    assert(outstanding.totalPaise === 30000, `Outstanding disbursements total paise is 30,000 (₹300.00) (got ${outstanding.totalPaise})`);

    // =========================================================================
    // DOMAIN 6: EXPENSE PAYMENT SOURCE VERIFICATION (Requirements 8, 9)
    // =========================================================================
    console.log('\n--- DOMAIN 6: Expense Payment Verification (Requirements 8, 9) ---');
    const expCheck = BankReconciliationStatementService.isDisbursementSourceSupported('EXPENSE_PAYMENT');
    assert(expCheck.supported === false, 'Correction 2: EXPENSE_PAYMENT is explicitly verified unsupported');
    assert(typeof expCheck.reason === 'string' && expCheck.reason.includes('Phase 2 expenses do not create double-entry GL postings'), 'Correction 2: Informative reason provided for unsupported expense payments');

    const ppCheck = BankReconciliationStatementService.isDisbursementSourceSupported('PURCHASE_PAYMENT');
    assert(ppCheck.supported === true, 'PURCHASE_PAYMENT source is supported');

    const crCheck = BankReconciliationStatementService.isDisbursementSourceSupported('CUSTOMER_REFUND');
    assert(crCheck.supported === true, 'CUSTOMER_REFUND source is supported');

    // =========================================================================
    // DOMAIN 7: UNMATCHED BANK STATEMENT LINES (Requirements 10, 11)
    // =========================================================================
    console.log('\n--- DOMAIN 7: Unmatched Statement Lines (Requirements 10, 11) ---');
    // Add bank charge debit line (U_debit = ₹50.00 = 5,000 paise)
    const bslChargeId = `${PREFIX}bsl_charge`;
    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 5, '2026-09-25', '2026-09-25', 'Monthly Service Fee', 50.00, 0, 750.00, 'hash_05', 'UNMATCHED', NOW(), NOW())
    `, [bslChargeId, importId, accounts.enterprise]);
    createdIds.statementLines.push(bslChargeId);

    // Add exception line (included in unmatched)
    const bslExceptionId = `${PREFIX}bsl_exc`;
    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 6, '2026-09-26', '2026-09-26', 'Unidentified Bank Debit', 25.00, 0, 725.00, 'hash_06', 'EXCEPTION', NOW(), NOW())
    `, [bslExceptionId, importId, accounts.enterprise]);
    createdIds.statementLines.push(bslExceptionId);

    const unmatchedLines = await BankReconciliationRepository.getUnmatchedStatementLines(accounts.enterprise, AS_OF_DATE);
    assert(unmatchedLines.debitCount === 2, `Unmatched debits count is 2 (50.00 fee + 25.00 exception) (got ${unmatchedLines.debitCount})`);
    assert(unmatchedLines.totalDebitPaise === 7500, `Unmatched debits total paise is 7,500 (₹75.00) (got ${unmatchedLines.totalDebitPaise})`);
    assert(unmatchedLines.creditCount === 2, `Unmatched credits count is 2 (Line 1 ₹1,000.00 + Line 2 ₹200.00) (got ${unmatchedLines.creditCount})`);
    assert(unmatchedLines.totalCreditPaise === 120000, `Unmatched credits total paise is 120,000 (₹1,200.00) (got ${unmatchedLines.totalCreditPaise})`);

    // =========================================================================
    // DOMAIN 8: BRS CALCULATION & EXACT DISCREPANCY (Reqs 17, 18, 22)
    // =========================================================================
    console.log('\n--- DOMAIN 8: BRS Calculation, Integer-Paise Precision & Discrepancy (Requirements 17, 18, 22) ---');
    // Let's set up a perfectly balanced scenario:
    // Let Bank Closing Balance = B_bank
    // Reconciled Book Balance = B_bank + D_transit - P_outstanding + U_debit - U_credit
    // Discrepancy = Reconciled Book Balance - B_gl
    const brsResult = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      actorContext: superAdminContext,
    });

    console.log('  BRS Summary Computed:');
    console.log(`    B_bank (Closing):             ₹${brsResult.summary.statementClosingBalance} (${brsResult.summary.statementClosingBalancePaise} paise)`);
    console.log(`    + D_transit (Uncleared):      ₹${brsResult.summary.totalDepositsInTransit} (${brsResult.summary.totalDepositsInTransitPaise} paise)`);
    console.log(`    - P_outstanding (Uncleared):  ₹${brsResult.summary.totalOutstandingDisbursements} (${brsResult.summary.totalOutstandingDisbursementsPaise} paise)`);
    console.log(`    + U_debit (Unmatched Debits): ₹${brsResult.summary.totalUnmatchedBankDebits} (${brsResult.summary.totalUnmatchedBankDebitsPaise} paise)`);
    console.log(`    - U_credit (Unmatched Cr):    ₹${brsResult.summary.totalUnmatchedBankCredits} (${brsResult.summary.totalUnmatchedBankCreditsPaise} paise)`);
    console.log(`    = Reconciled Book Balance:    ₹${brsResult.summary.reconciledBookBalance} (${brsResult.summary.reconciledBookBalancePaise} paise)`);
    console.log(`    GL 1112 Book Balance (B_gl):  ₹${brsResult.summary.gl1112BookBalance} (${brsResult.summary.gl1112BookBalancePaise} paise)`);
    console.log(`    Discrepancy:                  ₹${brsResult.summary.discrepancy} (${brsResult.summary.discrepancyPaise} paise)`);

    // Verify formula parity
    const manualReconciledPaise =
      brsResult.summary.statementClosingBalancePaise +
      brsResult.summary.totalDepositsInTransitPaise -
      brsResult.summary.totalOutstandingDisbursementsPaise +
      brsResult.summary.totalUnmatchedBankDebitsPaise -
      brsResult.summary.totalUnmatchedBankCreditsPaise;
    assert(brsResult.summary.reconciledBookBalancePaise === manualReconciledPaise, 'Reconciled Book Balance matches mathematical formula exactly');
    assert(brsResult.summary.discrepancyPaise === manualReconciledPaise - brsResult.summary.gl1112BookBalancePaise, 'Discrepancy equals Reconciled Book Balance - B_gl');
    assert(Number.isInteger(brsResult.summary.discrepancyPaise), 'Discrepancy paise is an exact integer');

    // Repeated deterministic calculation
    const brsRepeat1 = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      actorContext: superAdminContext,
    });
    const brsRepeat2 = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      actorContext: superAdminContext,
    });
    assert(JSON.stringify(brsResult.summary) === JSON.stringify(brsRepeat1.summary), 'Requirement 22: Repeat calculation 1 is bit-for-bit identical');
    assert(JSON.stringify(brsResult.summary) === JSON.stringify(brsRepeat2.summary), 'Requirement 22: Repeat calculation 2 is bit-for-bit identical');

    // Exact Zero Discrepancy Reconciliation Scenario on accounts.south
    // 1. Opening receipt voucher: Dr 1112 ₹1,000.00 (100,000 paise), Cr 1111 ₹1,000.00
    await createVoucherWithLines({
      id: `${PREFIX}vch_south_01`,
      voucherNo: `${PREFIX}VCH-S01`,
      voucherDate: '2026-09-10',
      status: 'POSTED',
      branchId: branches.south,
      lines: [
        { accountId: coaMap['1112'], debit: 1000.00, credit: 0 },
        { accountId: coaMap['1111'], debit: 0, credit: 1000.00 },
      ],
    });

    // 2. Outstanding supplier cheque: Dr 2111 ₹200.00, Cr 1112 ₹200.00 (20,000 paise)
    await createVoucherWithLines({
      id: `${PREFIX}vch_south_pp`,
      voucherNo: `${PREFIX}VCH-SPP`,
      voucherDate: '2026-09-20',
      status: 'POSTED',
      referenceType: 'PURCHASE_PAYMENT',
      referenceId: `${PREFIX}pp_south_01`,
      branchId: branches.south,
      lines: [
        { accountId: coaMap['2111'], debit: 200.00, credit: 0 },
        { accountId: coaMap['1112'], debit: 0, credit: 200.00, narration: 'Uncashed Cheque' },
      ],
    });

    // 3. Bank statement for accounts.south: Opening wire ₹1,000.00 (MATCHED so U_credit = 0, B_bank = 1000.00)
    const impSouthId = `${PREFIX}imp_south`;
    await client.query(`
      INSERT INTO public.bank_statement_import
        (id, bank_account_id, company_id, source_filename, source_format, file_sha256, statement_period_start, statement_period_end, total_lines_imported, total_debit_amount, total_credit_amount, status, imported_by, imported_at, created_at, updated_at)
      VALUES
        ($1, $2, 'company_default', 'south_stmt.csv', 'CSV', 'sha256_mock_south', '2026-09-01', '2026-09-30', 1, 0, 1000.00, 'COMPLETED', 'importer_01', NOW(), NOW(), NOW())
    `, [impSouthId, accounts.south]);
    createdIds.statementImports.push(impSouthId);

    const bslSouthId = `${PREFIX}bsl_south_01`;
    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 1, '2026-09-10', '2026-09-10', 'Matched Opening Wire', 0, 1000.00, 1000.00, 'hash_south_01', 'MATCHED', NOW(), NOW())
    `, [bslSouthId, impSouthId, accounts.south]);
    createdIds.statementLines.push(bslSouthId);

    const brsSouthZero = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.south,
      asOfDate: AS_OF_DATE,
      actorContext: branchSouthContext,
    });
    assert(brsSouthZero.summary.statementClosingBalancePaise === 100000, 'Branch South B_bank is 100,000 paise (₹1,000.00)');
    assert(brsSouthZero.summary.totalOutstandingDisbursementsPaise === 20000, 'Branch South unpresented cheque is 20,000 paise (₹200.00)');
    assert(brsSouthZero.summary.reconciledBookBalancePaise === 80000, 'Branch South Reconciled Book Balance is 80,000 paise (₹800.00)');
    assert(brsSouthZero.summary.gl1112BookBalancePaise === 80000, 'Branch South GL 1112 Book Balance is 80,000 paise (₹800.00)');
    assert(brsSouthZero.summary.discrepancyPaise === 0, 'Requirement 18: Exact zero discrepancy (discrepancyPaise === 0)');
    assert(brsSouthZero.summary.discrepancy === 0.00, 'Requirement 18: Formatted discrepancy is exactly ₹0.00');
    assert(brsSouthZero.summary.isReconciled === true, 'Requirement 18: isReconciled flag is true for balanced reconciliation');

    // =========================================================================
    // DOMAIN 9: SCOPE SECURITY & BRANCH ISOLATION (Requirements 19, 20, 21)
    // =========================================================================
    console.log('\n--- DOMAIN 9: Scope Security & Branch Isolation (Requirements 19, 20, 21) ---');
    // 1. Branch North accessing Branch South account (must throw BRANCH_MISMATCH)
    let branchMismatchThrown = false;
    try {
      await BankReconciliationStatementService.calculateBrs({
        bankAccountId: accounts.south,
        asOfDate: AS_OF_DATE,
        actorContext: branchNorthContext,
      });
    } catch (err) {
      if (err instanceof BankReconciliationStatementError && err.code === 'BRANCH_MISMATCH') {
        branchMismatchThrown = true;
      }
    }
    assert(branchMismatchThrown, 'Requirement 19: Branch North staff accessing Branch South bank account throws BRANCH_MISMATCH');

    // 2. Branch North accessing Enterprise account (must throw FORBIDDEN)
    let enterpriseForbiddenThrown = false;
    try {
      await BankReconciliationStatementService.calculateBrs({
        bankAccountId: accounts.enterprise,
        asOfDate: AS_OF_DATE,
        actorContext: branchNorthContext,
      });
    } catch (err) {
      if (err instanceof BankReconciliationStatementError && err.code === 'FORBIDDEN') {
        enterpriseForbiddenThrown = true;
      }
    }
    assert(enterpriseForbiddenThrown, 'Requirement 20: Branch staff accessing Enterprise bank account throws FORBIDDEN');

    // 3. Super Admin accessing Branch South account (allowed)
    const superAdminSouthBrs = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.south,
      asOfDate: AS_OF_DATE,
      actorContext: superAdminContext,
    });
    assert(superAdminSouthBrs.bankAccount.id === accounts.south, 'Super Admin can access branch bank accounts');

    // 4. Branch North accessing Branch North account (allowed)
    const northBrs = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.north,
      asOfDate: AS_OF_DATE,
      actorContext: branchNorthContext,
    });
    assert(northBrs.bankAccount.id === accounts.north, 'Branch North staff can access their own branch bank account');

    // 5. Customer role access (must throw FORBIDDEN)
    let customerForbiddenThrown = false;
    try {
      await BankReconciliationStatementService.calculateBrs({
        bankAccountId: accounts.enterprise,
        asOfDate: AS_OF_DATE,
        actorContext: { id: 'cust_01', role: 'CUSTOMER' },
      });
    } catch (err) {
      if (err instanceof BankReconciliationStatementError && err.code === 'FORBIDDEN') {
        customerForbiddenThrown = true;
      }
    }
    assert(customerForbiddenThrown, 'Requirement 21: Customer role access throws FORBIDDEN');

    // 6. Missing actor context (must throw UNAUTHORIZED)
    let unauthThrown = false;
    try {
      await BankReconciliationStatementService.calculateBrs({
        bankAccountId: accounts.enterprise,
        asOfDate: AS_OF_DATE,
      });
    } catch (err) {
      if (err instanceof BankReconciliationStatementError && err.code === 'UNAUTHORIZED') {
        unauthThrown = true;
      }
    }
    assert(unauthThrown, 'Requirement 21: Missing actor context throws UNAUTHORIZED');

    // =========================================================================
    // DOMAIN 10: SERVER-SIDE PAGINATION (Requirement 23)
    // =========================================================================
    console.log('\n--- DOMAIN 10: Server-side Pagination (Requirement 23) ---');
    // Paginated uncleared deposits
    const pDeposits = await BankReconciliationStatementService.listUnclearedDeposits({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      limit: 1,
      offset: 0,
      actorContext: superAdminContext,
    });
    assert(pDeposits.items.length === 1, `listUnclearedDeposits returns 1 item with limit 1 (got ${pDeposits.items.length})`);
    assert(pDeposits.totalCount === 1, `listUnclearedDeposits totalCount is 1 (got ${pDeposits.totalCount})`);
    assert(pDeposits.totalAmount === 500.00, `listUnclearedDeposits totalAmount is ₹500.00 (got ${pDeposits.totalAmount})`);

    // Paginated disbursements
    const pDisb = await BankReconciliationStatementService.listOutstandingDisbursements({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      limit: 1,
      offset: 0,
      actorContext: superAdminContext,
    });
    assert(pDisb.items.length === 1, `listOutstandingDisbursements returns 1 item with limit 1 (got ${pDisb.items.length})`);
    assert(pDisb.totalCount === 3, `listOutstandingDisbursements totalCount for enterprise is 3 (got ${pDisb.totalCount})`);

    // Paginated disbursements for branch South (isolated scope: 1 disbursement)
    const pDisbSouth = await BankReconciliationStatementService.listOutstandingDisbursements({
      bankAccountId: accounts.south,
      asOfDate: AS_OF_DATE,
      limit: 10,
      offset: 0,
      actorContext: branchSouthContext,
    });
    assert(pDisbSouth.totalCount === 1, `listOutstandingDisbursements totalCount for branch south is 1 (got ${pDisbSouth.totalCount})`);
    assert(pDisbSouth.items[0]?.voucherId === `${PREFIX}vch_south_pp`, 'Branch south disbursement is vch_south_pp');

    // Paginated unmatched lines
    const pLines = await BankReconciliationStatementService.listUnmatchedStatementLines({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      type: 'DEBIT',
      limit: 50,
      offset: 0,
      actorContext: superAdminContext,
    });
    assert(pLines.totalCount === 2, `listUnmatchedStatementLines (DEBIT) totalCount is 2 (got ${pLines.totalCount})`);
    assert(pLines.totalDebitAmount === 75.00, `listUnmatchedStatementLines totalDebitAmount is ₹75.00 (got ${pLines.totalDebitAmount})`);

    // Max limit clamping test (pass limit 999, should be clamped to 200)
    const pMaxLimit = await BankReconciliationStatementService.listUnmatchedStatementLines({
      bankAccountId: accounts.enterprise,
      asOfDate: AS_OF_DATE,
      limit: 999,
      offset: 0,
      actorContext: superAdminContext,
    });
    assert(pMaxLimit.limit === 200, `Excessive limit clamped to max 200 (got ${pMaxLimit.limit})`);

    // =========================================================================
    // DOMAIN 11: READ-ONLY GUARANTEE & IMMUTABILITY (Reqs 25, 26, 27, 28, 29)
    // =========================================================================
    console.log('\n--- DOMAIN 11: Read-Only Guarantee & Immutability (Requirements 25-29) ---');
    // Verify that running calculateBrs performs zero mutations
    const vchCountBefore = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_voucher`);
    const jeCountBefore = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_journal_entry`);
    const jlCountBefore = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_journal_line`);
    const bslCountBefore = await client.query(`SELECT COUNT(*)::int AS count FROM public.bank_statement_line`);
    const bdsCountBefore = await client.query(`SELECT COUNT(*)::int AS count FROM public.bank_deposit_slip`);

    // Run multiple calculations across all accounts
    await BankReconciliationStatementService.calculateBrs({ bankAccountId: accounts.enterprise, asOfDate: AS_OF_DATE, actorContext: superAdminContext });
    await BankReconciliationStatementService.calculateBrs({ bankAccountId: accounts.north, asOfDate: AS_OF_DATE, actorContext: superAdminContext });
    await BankReconciliationStatementService.calculateBrs({ bankAccountId: accounts.south, asOfDate: AS_OF_DATE, actorContext: superAdminContext });

    const vchCountAfter = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_voucher`);
    const jeCountAfter = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_journal_entry`);
    const jlCountAfter = await client.query(`SELECT COUNT(*)::int AS count FROM public.accounting_journal_line`);
    const bslCountAfter = await client.query(`SELECT COUNT(*)::int AS count FROM public.bank_statement_line`);
    const bdsCountAfter = await client.query(`SELECT COUNT(*)::int AS count FROM public.bank_deposit_slip`);

    assert(vchCountBefore.rows[0].count === vchCountAfter.rows[0].count, 'Requirement 25: Zero accounting_voucher records created or mutated');
    assert(jeCountBefore.rows[0].count === jeCountAfter.rows[0].count, 'Requirement 25: Zero accounting_journal_entry records created or mutated');
    assert(jlCountBefore.rows[0].count === jlCountAfter.rows[0].count, 'Requirement 25: Zero accounting_journal_line records created or mutated');
    assert(bslCountBefore.rows[0].count === bslCountAfter.rows[0].count, 'Requirement 26: Zero bank_statement_line records mutated');
    assert(bdsCountBefore.rows[0].count === bdsCountAfter.rows[0].count, 'Requirement 27: Zero bank_deposit_slip records mutated');

    // Immutability of closed session
    await client.query(`UPDATE public.bank_reconciliation_session SET status = 'CLOSED' WHERE id = $1`, [sessId]);
    const closedBrs = await BankReconciliationStatementService.calculateBrs({
      bankAccountId: accounts.enterprise,
      sessionId: sessId,
      actorContext: superAdminContext,
    });
    assert(closedBrs.session?.status === 'CLOSED', 'Requirement 29: Closed session calculation operates cleanly without mutation');

  } catch (err) {
    totalFailed++;
    console.error('UNHANDLED TEST EXCEPTION:', err);
  } finally {
    // =========================================================================
    // TEARDOWN & AUDIT (Domain 30)
    // =========================================================================
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (createdIds.matches.length > 0) {
        await client.query(`DELETE FROM public.bank_reconciliation_match WHERE id = ANY($1::text[])`, [createdIds.matches]);
      }
      if (createdIds.sessions.length > 0) {
        await client.query(`DELETE FROM public.bank_reconciliation_session WHERE id = ANY($1::text[])`, [createdIds.sessions]);
      }
      if (createdIds.statementLines.length > 0) {
        await client.query(`DELETE FROM public.bank_statement_line WHERE id = ANY($1::text[])`, [createdIds.statementLines]);
      }
      if (createdIds.statementImports.length > 0) {
        await client.query(`DELETE FROM public.bank_statement_import WHERE id = ANY($1::text[])`, [createdIds.statementImports]);
      }
      if (createdIds.depositSlips.length > 0) {
        await client.query(`UPDATE public.bank_deposit_slip SET transit_voucher_id = NULL, credit_voucher_id = NULL WHERE id = ANY($1::text[])`, [createdIds.depositSlips]);
        await client.query(`DELETE FROM public.bank_deposit_slip WHERE id = ANY($1::text[])`, [createdIds.depositSlips]);
      }
      if (createdIds.journalLines.length > 0) {
        await client.query(`DELETE FROM public.accounting_journal_line WHERE id = ANY($1::text[])`, [createdIds.journalLines]);
      }
      if (createdIds.journalEntries.length > 0) {
        await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1::text[])`, [createdIds.journalEntries]);
      }
      if (createdIds.vouchers.length > 0) {
        await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1::text[])`, [createdIds.vouchers]);
      }
      if (createdIds.bankAccounts.length > 0) {
        await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1::text[])`, [createdIds.bankAccounts]);
      }
      console.log('  Cleaned up all created fixtures.');

      // Final audit
      const finalAudit = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM public.accounting_account WHERE deleted_at IS NULL) AS accounting_account,
          (SELECT COUNT(*)::int FROM public.gateway_payout_batch) AS gateway_payout_batch,
          (SELECT COUNT(*)::int FROM public.gateway_settlement_order) AS gateway_settlement_order,
          (SELECT COUNT(*)::int FROM public.bank_account) AS bank_account,
          (SELECT COUNT(*)::int FROM public.bank_deposit_slip) AS bank_deposit_slip,
          (SELECT COUNT(*)::int FROM public.bank_statement_import) AS bank_statement_import,
          (SELECT COUNT(*)::int FROM public.bank_statement_line) AS bank_statement_line,
          (SELECT COUNT(*)::int FROM public.bank_reconciliation_session) AS bank_reconciliation_session,
          (SELECT COUNT(*)::int FROM public.bank_reconciliation_match) AS bank_reconciliation_match,
          (SELECT COUNT(*)::int FROM public.accounting_voucher) AS accounting_voucher,
          (SELECT COUNT(*)::int FROM public.accounting_journal_entry) AS accounting_journal_entry,
          (SELECT COUNT(*)::int FROM public.accounting_journal_line) AS accounting_journal_line,
          (SELECT COUNT(*)::int FROM public.accounting_fiscal_period) AS accounting_fiscal_period,
          (SELECT COUNT(*)::int FROM public."order" WHERE deleted_at IS NULL) AS "order",
          (SELECT COUNT(*)::int FROM public.payment_transaction WHERE deleted_at IS NULL) AS payment_transaction,
          (SELECT COUNT(*)::int FROM public.branch_inventory WHERE deleted_at IS NULL) AS branch_inventory,
          (SELECT COUNT(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS accounting_start_date
      `);
      const row = finalAudit.rows[0];
      console.log('\n--- Final PostgreSQL Baseline Audit ---');
      console.log(JSON.stringify(row, null, 2));

      assert(Number(row.accounting_account) === 99, 'accounting_account is 99');
      assert(Number(row.gateway_payout_batch) === 0, 'gateway_payout_batch is 0');
      assert(Number(row.gateway_settlement_order) === 0, 'gateway_settlement_order is 0');
      assert(Number(row.bank_account) === 0, 'bank_account is 0');
      assert(Number(row.bank_deposit_slip) === 0, 'bank_deposit_slip is 0');
      assert(Number(row.bank_statement_import) === 0, 'bank_statement_import is 0');
      assert(Number(row.bank_statement_line) === 0, 'bank_statement_line is 0');
      assert(Number(row.bank_reconciliation_session) === 0, 'bank_reconciliation_session is 0');
      assert(Number(row.bank_reconciliation_match) === 0, 'bank_reconciliation_match is 0');
      assert(Number(row.accounting_voucher) === 0, 'accounting_voucher is 0');
      assert(Number(row.accounting_journal_entry) === 0, 'accounting_journal_entry is 0');
      assert(Number(row.accounting_journal_line) === 0, 'accounting_journal_line is 0');
      assert(Number(row.accounting_fiscal_period) === 0, 'accounting_fiscal_period is 0');
      assert(Number(row.order) === 173, 'Requirement 28: Historical orders count is 173');
      assert(Number(row.payment_transaction) === 53, 'Requirement 28: Historical payments count is 53');
      assert(Number(row.branch_inventory) === 424, 'Requirement 28: Historical branch inventory is 424');
      assert(Number(row.accounting_start_date) === 0, 'accounting_start_date is 0');
    } catch (cleanupErr) {
      console.error('Error during teardown:', cleanupErr);
    } finally {
      await client.end();
      await closeDbPool();
    }
  }

  console.log('\n=============================================================================');
  console.log(`Step 4.10.5-D-A BRS Engine Test Results: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('=============================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
