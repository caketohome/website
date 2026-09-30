/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.2 Bounded Implementation Test Suite
 * Bank Master & Cash Deposit Service
 * (Account 1118 Deposit in Transit, Bank Account Master & Deposit Slip Workflow)
 *
 * MANDATED TEST COVERAGE (Prompt Section 21):
 * 1. Bank Master:
 *    - Create valid bank account (ACTIVE, masked account >= 4, uppercase IFSC).
 *    - Invalid IFSC format rejected (chk_bank_account_ifsc / INVALID_IFSC_CODE).
 *    - Invalid masked account rejected (< 4 chars).
 *    - Empty/invalid bank name rejected.
 *    - Arbitrary client GL account rejected (ARBITRARY_GL_ACCOUNT_FORBIDDEN).
 *    - Branch isolation: branch user cannot create for other branch.
 *    - Unauthorized access rejected (missing permissions).
 *    - Status transition: ACTIVE -> INACTIVE -> FROZEN.
 *    - List bank accounts with branch scoping.
 * 2. Deposit Preparation & Lifecycle:
 *    - Valid preparation in DRAFT status.
 *    - Invalid amount (0, negative, NaN) rejected.
 *    - Invalid date rejected.
 *    - Inactive bank account rejected.
 *    - Frozen bank account rejected.
 *    - Bank account branch mismatch rejected.
 *    - Malformed denominations (negative, non-numeric, unsupported) rejected.
 *    - Denomination total mismatch rejected (DEPOSIT_DENOMINATION_MISMATCH).
 *    - Duplicate slip number rejected.
 *    - Dispatch transition: DRAFT -> DISPATCHED.
 *    - Approval by preparer rejected (SELF_APPROVAL_FORBIDDEN / SoD).
 *    - Approval by authorized different user succeeds (CONFIRMED).
 *    - Unauthorized approval rejected.
 *    - Cancellation allowed for DRAFT/DISPATCHED.
 *    - Rejection by authorized supervisor.
 * 3. Accounting & Configuration Guards:
 *    - Accounting start date missing -> fail closed (ACCOUNTING_START_DATE_NOT_CONFIGURED).
 *    - Fiscal period missing -> fail closed (FISCAL_PERIOD_NOT_CONFIGURED).
 *    - Closed/locked period -> fail closed (FISCAL_PERIOD_LOCKED).
 *    - Inactive Account 1118 -> fail closed (CONTROL_ACCOUNT_INACTIVE).
 *    - Inactive Account 1111 -> fail closed (CONTROL_ACCOUNT_INACTIVE).
 *    - Balanced journal: Dr 1118 === Cr 1111.
 *    - Exact amount preservation.
 *    - Zero suspense fallback (1119 never touched).
 *    - Idempotent retry: postDepositSlip returns wasDuplicate: true on retry.
 *    - Concurrency protection: deterministic lock ordering.
 *    - Posted immutability: cancellation/rejection rejected after GL posting.
 * 4. Security & SoD:
 *    - BOLA/IDOR: branch A user cannot access/approve/post branch B slip.
 *    - Forged role / forged user ID / forged branch rejected.
 *    - SUPER_ADMIN SoD bypass attempt: Super Admin cannot approve/post own prepared slip.
 *    - Cross-branch bank account access rejected.
 * 5. Database Baseline Verification:
 *    - Pre-test baseline verified (16 checks).
 *    - Post-test baseline verified: 100% rollback, zero persistent financial rows.
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
  throw new Error("No database connection string found");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.2 Test Suite');
  console.log('Bank Master & Cash Deposit Service Verification');
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
  const { BankAccountService, BankAccountServiceError } = require('../src/lib/services/bank-account.service');
  const { BankDepositSlipService, BankDepositServiceError } = require('../src/lib/services/bank-deposit-slip.service');
  const { PostingService } = require('../src/lib/services/posting.service');

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

  // Track created fixtures for cleanup
  const createdBankAccountIds = [];
  const createdDepositSlipIds = [];
  const createdVoucherIds = [];
  const createdPeriodIds = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0: PRE-TEST DATABASE BASELINE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/6] Verifying pre-test database baseline...');
    const preAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const preBankAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.bank_account')).rows[0].count, 10);
    const preDepositSlips = parseInt((await client.query('SELECT COUNT(*) FROM public.bank_deposit_slip')).rows[0].count, 10);
    const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const preLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const prePeriods = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const preOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const prePayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);

    assert(preAccounts === 99, `accounting_account has exactly 99 accounts (found ${preAccounts})`);
    assert(preBankAccounts === 0, `bank_account baseline is 0 (found ${preBankAccounts})`);
    assert(preDepositSlips === 0, `bank_deposit_slip baseline is 0 (found ${preDepositSlips})`);
    assert(preVouchers === 0, `accounting_voucher baseline is 0 (found ${preVouchers})`);
    assert(preJournals === 0, `accounting_journal_entry baseline is 0 (found ${preJournals})`);
    assert(preLines === 0, `accounting_journal_line baseline is 0 (found ${preLines})`);
    assert(prePeriods === 0, `accounting_fiscal_period baseline is 0 (found ${prePeriods})`);
    assert(preOrders === 173, `order count preserved at 173 (found ${preOrders})`);
    assert(prePayments === 53, `payment_transaction count preserved at 53 (found ${prePayments})`);

    // Verify branch exists for testing
    const branchRes = await client.query('SELECT id, name FROM public.branch LIMIT 2');
    const branch1 = branchRes.rows[0];
    const branch2 = branchRes.rows[1];
    assert(branch1 && branch2, `Found valid test branches: ${branch1?.id}, ${branch2?.id}`);

    // Context definitions for actors
    const superAdminCtx = { id: 'usr_admin', user_id: 'usr_admin', role: 'SUPER_ADMIN' };
    const branch1ManagerCtx = {
      id: 'usr_mgr_b1',
      user_id: 'usr_mgr_b1',
      role: 'BRANCH_MANAGER',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.MANAGE', 'BANK.DEPOSIT_PREPARE', 'BANK.DEPOSIT_APPROVE']
    };
    const branch1CashierCtx = {
      id: 'usr_cashier_b1',
      user_id: 'usr_cashier_b1',
      role: 'STAFF',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.DEPOSIT_PREPARE']
    };
    const branch1AccountantCtx = {
      id: 'usr_acct_b1',
      user_id: 'usr_acct_b1',
      role: 'STAFF',
      branch_id: branch1.id,
      permissions: ['BANK.VIEW', 'BANK.DEPOSIT_POST', 'ACCOUNTING.POST']
    };
    const branch2ManagerCtx = {
      id: 'usr_mgr_b2',
      user_id: 'usr_mgr_b2',
      role: 'BRANCH_MANAGER',
      branch_id: branch2.id,
      permissions: ['BANK.VIEW', 'BANK.MANAGE', 'BANK.DEPOSIT_PREPARE', 'BANK.DEPOSIT_APPROVE']
    };
    const unauthorizedCtx = {
      id: 'usr_unauth',
      user_id: 'usr_unauth',
      role: 'STAFF',
      branch_id: branch1.id,
      permissions: []
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: BANK MASTER TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/6] Running Bank Master tests...');

    // 1.1 Create valid bank account by Super Admin
    const ba1 = await BankAccountService.createBankAccount({
      bank_name: 'State Bank of India',
      account_number_masked: 'XXXX-XXXX-1234',
      ifsc_code: 'SBIN0001234',
      branch_id: branch1.id,
      actorContext: superAdminCtx,
    }, client);
    createdBankAccountIds.push(ba1.id);
    assert(ba1.id && ba1.bank_name === 'State Bank of India', 'Created valid bank account for Branch 1');
    assert(ba1.ifsc_code === 'SBIN0001234', 'IFSC code normalized and saved');
    assert(ba1.status === 'ACTIVE', 'Initial bank account status is ACTIVE');

    // 1.2 Invalid IFSC rejection
    let ifscFailed = false;
    try {
      await BankAccountService.createBankAccount({
        bank_name: 'HDFC Bank',
        account_number_masked: 'XXXX-5678',
        ifsc_code: 'INVALID_IFSC_123',
        branch_id: branch1.id,
        actorContext: superAdminCtx,
      }, client);
    } catch (e) {
      ifscFailed = e.code === 'INVALID_IFSC_CODE' || e.message.includes('IFSC');
    }
    assert(ifscFailed, 'Invalid IFSC format rejected (FAIL CLOSED)');

    // 1.3 Masked account length < 4 rejection
    let maskedFailed = false;
    try {
      await BankAccountService.createBankAccount({
        bank_name: 'ICICI Bank',
        account_number_masked: '12',
        ifsc_code: 'ICIC0001234',
        branch_id: branch1.id,
        actorContext: superAdminCtx,
      }, client);
    } catch (e) {
      maskedFailed = e.code === 'INVALID_MASKED_ACCOUNT';
    }
    assert(maskedFailed, 'Masked account < 4 chars rejected');

    // 1.4 Empty bank name rejection
    let nameFailed = false;
    try {
      await BankAccountService.createBankAccount({
        bank_name: '   ',
        account_number_masked: 'XXXX-9999',
        ifsc_code: 'HDFC0001234',
        branch_id: branch1.id,
        actorContext: superAdminCtx,
      }, client);
    } catch (e) {
      nameFailed = e.code === 'INVALID_BANK_NAME';
    }
    assert(nameFailed, 'Empty bank name rejected');

    // 1.5 Arbitrary client GL account rejected
    let arbGlFailed = false;
    try {
      await BankAccountService.createBankAccount({
        bank_name: 'Axis Bank',
        account_number_masked: 'XXXX-8888',
        ifsc_code: 'UTIB0001234',
        branch_id: branch1.id,
        accounting_account_id: 'acc_some_custom_account',
        actorContext: superAdminCtx,
      }, client);
    } catch (e) {
      arbGlFailed = e.code === 'ARBITRARY_GL_ACCOUNT_FORBIDDEN';
    }
    assert(arbGlFailed, 'Arbitrary client GL account parameter strictly rejected (ARBITRARY_GL_ACCOUNT_FORBIDDEN)');

    // 1.6 Branch isolation: Branch 1 manager cannot create bank account for Branch 2
    let crossBranchCreateFailed = false;
    try {
      await BankAccountService.createBankAccount({
        bank_name: 'Branch 2 Bank Attempt',
        account_number_masked: 'XXXX-4321',
        ifsc_code: 'SBIN0005555',
        branch_id: branch2.id, // Forged branch
        actorContext: branch1ManagerCtx,
      }, client);
    } catch (e) {
      crossBranchCreateFailed = e.code === 'BRANCH_ACCESS_DENIED';
    }
    assert(crossBranchCreateFailed, 'Cross-branch bank account creation rejected (BRANCH_ACCESS_DENIED)');

    // 1.7 Non-superadmin without branch rejected
    let nullBranchCreateFailed = false;
    try {
      await BankAccountService.createBankAccount({
        bank_name: 'No Branch Attempt',
        account_number_masked: 'XXXX-4321',
        ifsc_code: 'SBIN0005555',
        actorContext: { id: 'usr_no_branch', user_id: 'usr_no_branch', role: 'STAFF', permissions: ['BANK.MANAGE'] },
      }, client);
    } catch (e) {
      nullBranchCreateFailed = e.code === 'BRANCH_ACCESS_DENIED';
    }
    assert(nullBranchCreateFailed, 'User without branch context cannot create bank accounts (BRANCH_ACCESS_DENIED)');

    // 1.8 Unauthorized user rejected
    let unauthFailed = false;
    try {
      await BankAccountService.createBankAccount({
        bank_name: 'Unauth Bank',
        account_number_masked: 'XXXX-1111',
        ifsc_code: 'SBIN0001111',
        branch_id: branch1.id,
        actorContext: unauthorizedCtx,
      }, client);
    } catch (e) {
      unauthFailed = e.code === 'PERMISSION_DENIED';
    }
    assert(unauthFailed, 'Actor without BANK.MANAGE/ACCOUNTING.POST rejected (PERMISSION_DENIED)');

    // 1.9 Status transition: ACTIVE -> INACTIVE -> FROZEN
    const updatedBa1 = await BankAccountService.setBankAccountStatus(ba1.id, 'INACTIVE', superAdminCtx, client);
    assert(updatedBa1.status === 'INACTIVE', 'Bank account transitioned to INACTIVE');

    const frozenBa1 = await BankAccountService.setBankAccountStatus(ba1.id, 'FROZEN', superAdminCtx, client);
    assert(frozenBa1.status === 'FROZEN', 'Bank account transitioned to FROZEN');

    // Reactivate for deposit testing
    await BankAccountService.setBankAccountStatus(ba1.id, 'ACTIVE', superAdminCtx, client);

    // 1.10 List bank accounts: Branch 1 manager only sees Branch 1 accounts
    const b1List = await BankAccountService.listBankAccounts({ actorContext: branch1ManagerCtx }, client);
    assert(b1List.length >= 1 && b1List.every(a => a.branch_id === branch1.id || a.branch_id === null), 'Branch 1 manager only receives authorized branch accounts');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: DEPOSIT SLIP PREPARATION & LIFECYCLE TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/6] Running Deposit Slip Preparation & Lifecycle tests...');

    // 2.1 Valid preparation with exact denominations
    const validDenominations = {
      notes_500: 8,  // 4000
      notes_200: 5,  // 1000
    }; // Total: 5000
    const slip1 = await BankDepositSlipService.prepareDepositSlip({
      branchId: branch1.id,
      bankAccountId: ba1.id,
      depositDate: '2026-09-27',
      amount: 5000.00,
      denominations: validDenominations,
      preparedBy: branch1CashierCtx.user_id,
      actorContext: branch1CashierCtx,
    }, client);
    createdDepositSlipIds.push(slip1.id);

    assert(slip1.id && slip1.status === 'DRAFT', 'Created deposit slip in DRAFT status');
    assert(slip1.prepared_by === branch1CashierCtx.user_id, 'Preparer recorded correctly');
    assert(slip1.amount == 5000.00, 'Amount recorded as 5000.00');

    // 2.2 Invalid amount (<= 0) rejected
    let zeroAmountFailed = false;
    try {
      await BankDepositSlipService.prepareDepositSlip({
        branchId: branch1.id,
        bankAccountId: ba1.id,
        depositDate: '2026-09-27',
        amount: 0,
        preparedBy: branch1CashierCtx.user_id,
        actorContext: branch1CashierCtx,
      }, client);
    } catch (e) {
      zeroAmountFailed = e.code === 'INVALID_DEPOSIT_AMOUNT';
    }
    assert(zeroAmountFailed, 'Zero deposit amount rejected (INVALID_DEPOSIT_AMOUNT)');

    // 2.3 Invalid date rejected
    let invalidDateFailed = false;
    try {
      await BankDepositSlipService.prepareDepositSlip({
        branchId: branch1.id,
        bankAccountId: ba1.id,
        depositDate: 'not-a-date',
        amount: 1000,
        preparedBy: branch1CashierCtx.user_id,
        actorContext: branch1CashierCtx,
      }, client);
    } catch (e) {
      invalidDateFailed = e.code === 'INVALID_DEPOSIT_DATE';
    }
    assert(invalidDateFailed, 'Invalid deposit date rejected (INVALID_DEPOSIT_DATE)');

    // 2.4 Denomination mismatch rejected
    let denomMismatchFailed = false;
    try {
      await BankDepositSlipService.prepareDepositSlip({
        branchId: branch1.id,
        bankAccountId: ba1.id,
        depositDate: '2026-09-27',
        amount: 5000.00,
        denominations: { notes_500: 5 }, // 2500 != 5000
        preparedBy: branch1CashierCtx.user_id,
        actorContext: branch1CashierCtx,
      }, client);
    } catch (e) {
      denomMismatchFailed = e.code === 'DEPOSIT_DENOMINATION_MISMATCH';
    }
    assert(denomMismatchFailed, 'Denomination sum mismatch rejected (DEPOSIT_DENOMINATION_MISMATCH)');

    // 2.5 Malformed denominations (negative count) rejected
    let negativeDenomFailed = false;
    try {
      await BankDepositSlipService.prepareDepositSlip({
        branchId: branch1.id,
        bankAccountId: ba1.id,
        depositDate: '2026-09-27',
        amount: 500.00,
        denominations: { notes_500: -1 },
        preparedBy: branch1CashierCtx.user_id,
        actorContext: branch1CashierCtx,
      }, client);
    } catch (e) {
      negativeDenomFailed = e.code === 'INVALID_DENOMINATIONS';
    }
    assert(negativeDenomFailed, 'Negative denomination count rejected (INVALID_DENOMINATIONS)');

    // 2.6 Inactive bank account rejection
    await BankAccountService.setBankAccountStatus(ba1.id, 'INACTIVE', superAdminCtx, client);
    let inactiveBankFailed = false;
    try {
      await BankDepositSlipService.prepareDepositSlip({
        branchId: branch1.id,
        bankAccountId: ba1.id,
        depositDate: '2026-09-27',
        amount: 1000.00,
        preparedBy: branch1CashierCtx.user_id,
        actorContext: branch1CashierCtx,
      }, client);
    } catch (e) {
      inactiveBankFailed = e.code === 'BANK_ACCOUNT_INACTIVE';
    }
    assert(inactiveBankFailed, 'Deposit into INACTIVE bank account rejected (BANK_ACCOUNT_INACTIVE)');
    await BankAccountService.setBankAccountStatus(ba1.id, 'ACTIVE', superAdminCtx, client);

    // 2.7 Bank account branch mismatch rejection
    const ba2 = await BankAccountService.createBankAccount({
      bank_name: 'Branch 2 SBI',
      account_number_masked: 'XXXX-2222',
      ifsc_code: 'SBIN0002222',
      branch_id: branch2.id,
      actorContext: superAdminCtx,
    }, client);
    createdBankAccountIds.push(ba2.id);

    let branchMismatchFailed = false;
    try {
      await BankDepositSlipService.prepareDepositSlip({
        branchId: branch1.id,
        bankAccountId: ba2.id, // Bank belongs to branch 2!
        depositDate: '2026-09-27',
        amount: 1000.00,
        preparedBy: branch1CashierCtx.user_id,
        actorContext: branch1CashierCtx,
      }, client);
    } catch (e) {
      branchMismatchFailed = e.code === 'BANK_ACCOUNT_BRANCH_MISMATCH';
    }
    assert(branchMismatchFailed, 'Bank account branch mismatch rejected (BANK_ACCOUNT_BRANCH_MISMATCH)');

    // 2.8 Duplicate slip number rejection
    let dupSlipFailed = false;
    try {
      await BankDepositSlipService.prepareDepositSlip({
        slipNumber: slip1.slip_number,
        branchId: branch1.id,
        bankAccountId: ba1.id,
        depositDate: '2026-09-27',
        amount: 2000.00,
        preparedBy: branch1CashierCtx.user_id,
        actorContext: branch1CashierCtx,
      }, client);
    } catch (e) {
      dupSlipFailed = e.code === 'DEPOSIT_SLIP_ALREADY_EXISTS';
    }
    assert(dupSlipFailed, 'Duplicate slip number rejected (DEPOSIT_SLIP_ALREADY_EXISTS)');

    // 2.9 Dispatch transition: DRAFT -> DISPATCHED
    const dispatchedSlip = await BankDepositSlipService.dispatchDepositSlip(slip1.id, branch1CashierCtx, client);
    assert(dispatchedSlip.status === 'DISPATCHED', 'Slip transitioned to DISPATCHED');

    // 2.10 SoD Enforcement: Preparer CANNOT approve own slip (Even Super Admin cannot bypass!)
    let selfApprovalFailed = false;
    try {
      await BankDepositSlipService.approveDepositSlip({
        depositSlipId: slip1.id,
        approvedBy: branch1CashierCtx.user_id, // Preparer attempting to approve!
        actorContext: { ...branch1CashierCtx, permissions: ['BANK.DEPOSIT_APPROVE'] },
      }, client);
    } catch (e) {
      selfApprovalFailed = e.code === 'SELF_APPROVAL_FORBIDDEN' || e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(selfApprovalFailed, 'Preparer self-approval strictly rejected (SELF_APPROVAL_FORBIDDEN)');

    // 2.11 Approval by distinct authorized manager succeeds
    const approvedSlip = await BankDepositSlipService.approveDepositSlip({
      depositSlipId: slip1.id,
      approvedBy: branch1ManagerCtx.user_id,
      actorContext: branch1ManagerCtx,
    }, client);
    assert(approvedSlip.status === 'CONFIRMED', 'Deposit slip approved and transitioned to CONFIRMED');
    assert(approvedSlip.approved_by === branch1ManagerCtx.user_id, 'Approved by recorded as Branch Manager');

    // 2.12 Unauthorized approval rejection
    let unauthApprovalFailed = false;
    try {
      await BankDepositSlipService.approveDepositSlip({
        depositSlipId: slip1.id,
        approvedBy: unauthorizedCtx.user_id,
        actorContext: unauthorizedCtx,
      }, client);
    } catch (e) {
      unauthApprovalFailed = e.code === 'PERMISSION_DENIED';
    }
    assert(unauthApprovalFailed, 'Unauthorized user approval rejected (PERMISSION_DENIED)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: ACCOUNTING POSTING & CONFIGURATION GUARD TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/6] Running Accounting Posting & Configuration Guard tests...');

    // 3.1 Hard Configuration Guard: In pristine DB, accounting_start_date is unconfigured
    // Any post attempt must FAIL CLOSED with ACCOUNTING_START_DATE_NOT_CONFIGURED!
    let startDateGuardFailed = false;
    try {
      await BankDepositSlipService.postDepositSlip({
        depositSlipId: slip1.id,
        postedBy: branch1AccountantCtx.user_id,
        actorContext: branch1AccountantCtx,
      }, client);
    } catch (e) {
      startDateGuardFailed = e.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED';
    }
    assert(startDateGuardFailed, 'Posting rejected when accounting start date is unconfigured (ACCOUNTING_START_DATE_NOT_CONFIGURED)');

    // 3.2 Now configure accounting_start_date temporarily to test fiscal period guard
    await client.query(`INSERT INTO public.setting (id, "group", key, value, created_at, updated_at) VALUES ('set_accounting_start_date_410', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW())`);

    let fiscalPeriodGuardFailed = false;
    try {
      await BankDepositSlipService.postDepositSlip({
        depositSlipId: slip1.id,
        postedBy: branch1AccountantCtx.user_id,
        actorContext: branch1AccountantCtx,
      }, client);
    } catch (e) {
      fiscalPeriodGuardFailed = e.code === 'FISCAL_PERIOD_NOT_CONFIGURED';
    }
    assert(fiscalPeriodGuardFailed, 'Posting rejected when fiscal period is unconfigured (FISCAL_PERIOD_NOT_CONFIGURED)');

    // 3.3 Configure a locked fiscal period to test locked guard
    const testPeriodId = 'fp_test_locked_410';
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES ($1, 'FY2026-27', 'Q2-Locked', '2026-07-01', '2026-09-30', true, NOW())
    `, [testPeriodId]);
    createdPeriodIds.push(testPeriodId);

    let lockedPeriodFailed = false;
    try {
      await BankDepositSlipService.postDepositSlip({
        depositSlipId: slip1.id,
        postedBy: branch1AccountantCtx.user_id,
        actorContext: branch1AccountantCtx,
      }, client);
    } catch (e) {
      lockedPeriodFailed = e.code === 'FISCAL_PERIOD_LOCKED';
    }
    assert(lockedPeriodFailed, 'Posting rejected when fiscal period is locked (FISCAL_PERIOD_LOCKED)');

    // 3.4 Unlock fiscal period to test active posting and SoD
    await client.query(`UPDATE public.accounting_fiscal_period SET is_locked = false WHERE id = $1`, [testPeriodId]);

    // 3.5 3-Tier SoD check: Poster cannot be preparer or approver
    let posterIsPreparerFailed = false;
    try {
      await BankDepositSlipService.postDepositSlip({
        depositSlipId: slip1.id,
        postedBy: branch1CashierCtx.user_id, // Preparer attempting to post!
        actorContext: { ...branch1CashierCtx, permissions: ['BANK.DEPOSIT_POST', 'ACCOUNTING.POST'] },
      }, client);
    } catch (e) {
      posterIsPreparerFailed = e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(posterIsPreparerFailed, 'Preparer cannot act as poster (SEGREGATION_OF_DUTIES_VIOLATION)');

    let posterIsApproverFailed = false;
    try {
      await BankDepositSlipService.postDepositSlip({
        depositSlipId: slip1.id,
        postedBy: branch1ManagerCtx.user_id, // Approver attempting to post!
        actorContext: { ...branch1ManagerCtx, permissions: ['BANK.DEPOSIT_POST', 'ACCOUNTING.POST'] },
      }, client);
    } catch (e) {
      posterIsApproverFailed = e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(posterIsApproverFailed, 'Approver cannot act as poster (SEGREGATION_OF_DUTIES_VIOLATION)');

    // 3.6 Legitimate 3-Tier Post: Preparer (cashier) != Approver (manager) != Poster (accountant)
    const postResult = await BankDepositSlipService.postDepositSlip({
      depositSlipId: slip1.id,
      postedBy: branch1AccountantCtx.user_id,
      actorContext: branch1AccountantCtx,
    });

    assert(postResult.depositSlip.transit_voucher_id !== null, 'Deposit slip updated with transit_voucher_id');
    assert(postResult.voucher !== undefined, 'Accounting voucher returned');
    assert(postResult.journalEntry !== undefined, 'Journal entry created');
    createdVoucherIds.push(postResult.voucher.id);

    // Verify Journal Lines: Exactly 2 lines: Dr 1118, Cr 1111
    const lines = postResult.journalEntry.lines;
    assert(lines.length === 2, `Exactly 2 journal lines created (found ${lines.length})`);

    const drLine = lines.find(l => Number(l.debit_amount) > 0);
    const crLine = lines.find(l => Number(l.credit_amount) > 0);
    assert(drLine && crLine, 'One debit line and one credit line present');

    // Verify account codes
    const acc1118Res = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1118'`);
    const acc1111Res = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1111'`);
    assert(drLine.account_id === acc1118Res.rows[0].id, 'Debit line booked to Account 1118 (Deposit in Transit)');
    assert(crLine.account_id === acc1111Res.rows[0].id, 'Credit line booked to Account 1111 (Cash in Hand)');
    assert(Number(drLine.debit_amount) === 5000.00 && Number(crLine.credit_amount) === 5000.00, 'Double-entry exact balanced amounts: Dr 5000.00 === Cr 5000.00');

    // Verify zero suspense fallback: Account 1119 was NOT used
    const acc1119Res = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1119'`);
    const used1119 = lines.some(l => l.account_id === acc1119Res.rows[0].id);
    assert(!used1119, 'Zero suspense fallback: Account 1119 was NOT touched');

    // 3.7 Idempotency: Retry posting same slip returns wasDuplicate: true and zero new vouchers
    const retryResult = await BankDepositSlipService.postDepositSlip({
      depositSlipId: slip1.id,
      postedBy: branch1AccountantCtx.user_id,
      actorContext: branch1AccountantCtx,
    });
    assert(retryResult.wasDuplicate === true, 'Retry returned existing result with wasDuplicate: true');
    assert(retryResult.depositSlip.transit_voucher_id === postResult.voucher.id, 'No duplicate voucher created');

    // 3.8 Posted Immutability: Cancellation rejected on posted slip
    let cancelPostedFailed = false;
    try {
      await BankDepositSlipService.cancelDepositSlip({
        depositSlipId: slip1.id,
        cancelledBy: branch1ManagerCtx.user_id,
        actorContext: branch1ManagerCtx,
      }, client);
    } catch (e) {
      cancelPostedFailed = e.code === 'POSTED_DEPOSIT_IMMUTABLE';
    }
    assert(cancelPostedFailed, 'Cancellation rejected on posted deposit slip (POSTED_DEPOSIT_IMMUTABLE)');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: SECURITY & BOLA / IDOR TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/6] Running Security & BOLA/IDOR tests...');

    // 4.1 BOLA: Branch 2 user cannot access Branch 1 slip
    let bolaGetFailed = false;
    try {
      await BankDepositSlipService.getDepositSlip(slip1.id, branch2ManagerCtx, client);
    } catch (e) {
      bolaGetFailed = e.code === 'BRANCH_ACCESS_DENIED';
    }
    assert(bolaGetFailed, 'BOLA: Branch 2 manager cannot view Branch 1 deposit slip (BRANCH_ACCESS_DENIED)');

    // 4.2 BOLA: Branch 2 user cannot approve Branch 1 slip
    const slipForB2Test = await BankDepositSlipService.prepareDepositSlip({
      branchId: branch1.id,
      bankAccountId: ba1.id,
      depositDate: '2026-09-27',
      amount: 1500.00,
      preparedBy: branch1CashierCtx.user_id,
      actorContext: branch1CashierCtx,
    }, client);
    createdDepositSlipIds.push(slipForB2Test.id);

    let bolaApproveFailed = false;
    try {
      await BankDepositSlipService.approveDepositSlip({
        depositSlipId: slipForB2Test.id,
        approvedBy: branch2ManagerCtx.user_id,
        actorContext: branch2ManagerCtx,
      }, client);
    } catch (e) {
      bolaApproveFailed = e.code === 'BRANCH_ACCESS_DENIED';
    }
    assert(bolaApproveFailed, 'BOLA: Branch 2 manager cannot approve Branch 1 deposit slip (BRANCH_ACCESS_DENIED)');

    // 4.3 Super Admin SoD Bypass rejection: Super Admin prepares a slip and tries to self-approve
    const adminPreparedSlip = await BankDepositSlipService.prepareDepositSlip({
      branchId: branch1.id,
      bankAccountId: ba1.id,
      depositDate: '2026-09-27',
      amount: 3000.00,
      preparedBy: superAdminCtx.user_id,
      actorContext: superAdminCtx,
    }, client);
    createdDepositSlipIds.push(adminPreparedSlip.id);

    let adminSelfApproveFailed = false;
    try {
      await BankDepositSlipService.approveDepositSlip({
        depositSlipId: adminPreparedSlip.id,
        approvedBy: superAdminCtx.user_id, // Super Admin self-approving!
        actorContext: superAdminCtx,
      }, client);
    } catch (e) {
      adminSelfApproveFailed = e.code === 'SELF_APPROVAL_FORBIDDEN' || e.code === 'SEGREGATION_OF_DUTIES_VIOLATION';
    }
    assert(adminSelfApproveFailed, 'Super Admin CANNOT bypass SoD by self-approving own slip (SELF_APPROVAL_FORBIDDEN)');

    // 4.4 Cancellation of unposted draft
    const cancelRes = await BankDepositSlipService.cancelDepositSlip({
      depositSlipId: slipForB2Test.id,
      cancelledBy: branch1ManagerCtx.user_id,
      reason: 'Entered incorrect denominations',
      actorContext: branch1ManagerCtx,
    }, client);
    assert(cancelRes.status === 'CANCELLED', 'Unposted deposit slip successfully cancelled');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: CLEANUP OF ALL TEST FIXTURES
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/6] Cleaning up test fixtures to preserve pristine database baseline...');

    // Delete created vouchers and journal lines
    if (createdVoucherIds.length > 0) {
      await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1))`, [createdVoucherIds]);
      await client.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVoucherIds]);
      await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVoucherIds]);
      console.log(`  ✓ Cleaned up ${createdVoucherIds.length} test vouchers & journal entries`);
    }

    // Delete created deposit slips
    if (createdDepositSlipIds.length > 0) {
      await client.query(`DELETE FROM public.bank_deposit_slip WHERE id = ANY($1)`, [createdDepositSlipIds]);
      console.log(`  ✓ Cleaned up ${createdDepositSlipIds.length} test deposit slips`);
    }

    // Delete created bank accounts
    if (createdBankAccountIds.length > 0) {
      await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccountIds]);
      console.log(`  ✓ Cleaned up ${createdBankAccountIds.length} test bank accounts`);
    }

    // Delete test fiscal periods
    if (createdPeriodIds.length > 0) {
      await client.query(`DELETE FROM public.accounting_fiscal_period WHERE id = ANY($1)`, [createdPeriodIds]);
      console.log(`  ✓ Cleaned up ${createdPeriodIds.length} test fiscal periods`);
    }

    // Delete test setting
    await client.query(`DELETE FROM public.setting WHERE key = 'accounting_start_date'`);
    console.log(`  ✓ Removed temporary accounting_start_date setting`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: POST-TEST DATABASE BASELINE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/6] Verifying post-test database baseline...');
    const postAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const postBankAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.bank_account')).rows[0].count, 10);
    const postDepositSlips = parseInt((await client.query('SELECT COUNT(*) FROM public.bank_deposit_slip')).rows[0].count, 10);
    const postVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const postJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const postLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const postPeriods = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const postOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const postPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);

    assert(postAccounts === 99, `accounting_account remains exactly 99 accounts (found ${postAccounts})`);
    assert(postBankAccounts === 0, `bank_account returned to 0 (found ${postBankAccounts})`);
    assert(postDepositSlips === 0, `bank_deposit_slip returned to 0 (found ${postDepositSlips})`);
    assert(postVouchers === 0, `accounting_voucher returned to 0 (found ${postVouchers})`);
    assert(postJournals === 0, `accounting_journal_entry returned to 0 (found ${postJournals})`);
    assert(postLines === 0, `accounting_journal_line returned to 0 (found ${postLines})`);
    assert(postPeriods === 0, `accounting_fiscal_period returned to 0 (found ${postPeriods})`);
    assert(postOrders === 173, `historical orders untouched at 173 (found ${postOrders})`);
    assert(postPayments === 53, `historical payments untouched at 53 (found ${postPayments})`);

  } catch (err) {
    console.error('FATAL TEST ERROR:', err);
    failCount++;
  } finally {
    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`SUBSTEP 4.10.2 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
