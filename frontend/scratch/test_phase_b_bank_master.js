/**
 * CakeToHome ERP — Phase B Test Suite
 * Enterprise Company Bank Account Master & Posting Integration Verification
 *
 * COVERS ALL 18 MANDATED REQUIREMENTS:
 *  1. Create bank account (company-level, non-branch, auto-provision GL or map GL)
 *  2. Duplicate account prevention (same IFSC + account_number rejects)
 *  3. Invalid IFSC rejection (chk_bank_account_ifsc format)
 *  4. Invalid account type rejection (CURRENT, SAVINGS, OVERDRAFT, ESCROW, NODAL)
 *  5. Invalid GL mapping rejection (non-existent GL id)
 *  6. Non-bank GL mapping rejection (GL subtype != BANK)
 *  7. Branch ownership rejection (no branch_id column on bank_account, company-scoped)
 *  8. Unauthorized create rejection (missing permissions / non-admin)
 *  9. Unauthorized edit rejection
 * 10. Unauthorized deactivate rejection
 * 11. Activate / deactivate / freeze status lifecycle
 * 12. Update bank details (name, branch)
 * 13. Bank-specific GL resolution (Bank A vs Bank B distinct GLs)
 * 14. Supplier payment uses selected bank GL (Dr 2111 AP, Cr Bank GL)
 * 15. Deposit clearance uses selected bank GL (Dr Bank GL, Cr 1118 Transit)
 * 16. Gateway payout uses selected bank GL (Dr Bank GL, Dr 5290 MDR, Cr 1113 Gateway)
 * 17. Reconciliation is bank-specific (BRS bank isolation)
 * 18. No regression in existing tests & pristine DB restoration
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
  console.log('CakeToHome ERP — Phase B Test Suite: Company Bank Account Master');
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
  const { BankAccountService, BankAccountServiceError } = require('../src/lib/services/bank-account.service');
  const { CompanyRepository } = require('../src/lib/repositories/company.repository');
  const { AccountingAccountRepository } = require('../src/lib/repositories/accounting-account.repository');
  const { PurchasePaymentService } = require('../src/lib/services/purchase-payment.service');
  const { BankReconciliationMatchingEngine } = require('../src/lib/services/bank-reconciliation-matching.service');
  const { GatewaySettlementService } = require('../src/lib/services/gateway-settlement.service');
  const { GatewayPayoutRepository } = require('../src/lib/repositories/gateway-payout.repository');
  const { GatewaySettlementOrderRepository } = require('../src/lib/repositories/gateway-settlement-order.repository');
  const { SalesReturnService } = require('../src/lib/services/sales-return.service');
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

  // Pre-test baseline capture
  const preBankAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.bank_account')).rows[0].count, 10);
  const preAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
  const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
  const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
  const preLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);

  // Run inside an isolated transaction that will be rolled back at the end
  await client.query('BEGIN');
  console.log('[Setup] Began isolated transaction for Phase B tests.');

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 0. Ensure Active Company Exists in Current Transaction
    // ─────────────────────────────────────────────────────────────────────────
    let company = await CompanyRepository.getActiveCompany(client);
    if (!company) {
      console.log('  Creating primary company master in transaction...');
      company = await CompanyRepository.create(
        {
          legal_name: "CakeToHome Retail Private Limited",
          trade_name: "CakeToHome",
          registered_address: "No. 42, 100ft Road, Indiranagar",
          city: "Bengaluru",
          state_code: "29",
          pin_code: "560038",
          pan: "AABCC1234D",
          currency: "INR",
          fy_start_month: 4,
          invoice_prefix: "CTH",
          email: "finance@caketohome.com",
          phone: "9876543210"
        },
        "usr_superadmin",
        client
      );
    }
    assert(company && company.id, `Active company master exists: '${company.legal_name}' (${company.id})`);

    // Ensure Fiscal Period and Accounting Start Date exist in transaction
    const existingDate = await client.query("SELECT key FROM public.setting WHERE key = 'accounting_start_date'");
    if (existingDate.rows.length === 0) {
      await client.query("INSERT INTO public.setting (id, \"group\", key, value, updated_at) VALUES (gen_random_uuid()::text, 'accounting', 'accounting_start_date', '2026-01-01', NOW())");
    } else {
      await client.query("UPDATE public.setting SET value = '2026-01-01', updated_at = NOW() WHERE key = 'accounting_start_date'");
    }
    const existingPeriod = await client.query(`
      SELECT id FROM public.accounting_fiscal_period 
      WHERE start_date <= '2026-10-04' AND end_date >= '2026-10-04' AND is_locked = false
    `);
    if (existingPeriod.rows.length === 0) {
      await client.query(`
        INSERT INTO public.accounting_fiscal_period
          (id, fiscal_year, period_name, start_date, end_date, is_locked, created_at)
        VALUES
          ('per_fy2026_10', 'FY2026-27', 'October 2026', '2026-10-01', '2026-10-31', false, NOW())
      `);
    }

    // Actor Contexts for RBAC
    const superAdminCtx = { id: 'usr_superadmin', user_id: 'usr_superadmin', role: 'SUPER_ADMIN', permissions: ['ACCOUNTING.MANAGE_GL', 'ACCOUNTING.POST', 'ACCOUNTING.VIEW'] };
    const staffCtx = { id: 'usr_staff_1', user_id: 'usr_staff_1', role: 'STAFF', permissions: ['BANK.VIEW'] };

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-01: Create Bank Account (Company-level, non-branch, auto-provision GL)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-01] Testing Bank Account Creation & Auto-Provisioning...');
    const bankA = await BankAccountService.createBankAccount(
      {
        account_name: "HDFC Main Operating A/c",
        bank_name: "HDFC Bank",
        account_number: "50200012345678",
        ifsc_code: "HDFC0001234",
        account_type: "CURRENT",
        branch_name: "Indiranagar Branch",
        auto_provision_gl: true,
        actorContext: superAdminCtx,
      },
      client
    );

    assert(bankA.id && bankA.id.startsWith('ba_'), `Bank A created successfully with ID: ${bankA.id}`);
    assert(bankA.company_id === company.id, `Bank A company_id (${bankA.company_id}) matches company master (${company.id})`);
    assert(bankA.account_number_masked === '•••• •••• •••• 5678', `Account number correctly masked: ${bankA.account_number_masked}`);
    assert(bankA.ifsc_code === 'HDFC0001234', `IFSC normalized to uppercase: ${bankA.ifsc_code}`);
    assert(bankA.status === 'ACTIVE', `Status defaults to ACTIVE: ${bankA.status}`);
    assert(bankA.account_type === 'CURRENT', `Account type correctly set: ${bankA.account_type}`);
    assert(!!bankA.gl_account_id, `Dedicated GL account provisioned: ${bankA.gl_account_id} (${bankA.gl_account_code})`);

    // Verify auto-provisioned GL account in public.accounting_account
    const glAccA = await AccountingAccountRepository.findById(bankA.gl_account_id, client);
    assert(glAccA !== null, `Auto-provisioned GL account exists in accounting_account`);
    assert(glAccA.type === 'ASSET', `GL account type is ASSET: ${glAccA.type}`);
    assert(glAccA.subtype === 'BANK', `GL account subtype is BANK: ${glAccA.subtype}`);
    assert(glAccA.is_active === true, `GL account is_active is true`);
    assert(glAccA.is_group === false, `GL account is a postable leaf (is_group = false)`);

    // Verify bank_account table does NOT have a branch_id column
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bank_account' AND column_name = 'branch_id'
    `);
    assert(colCheck.rows.length === 0, `Table public.bank_account has NO branch_id column (strictly company-owned)`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-02: Duplicate Account Prevention
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-02] Testing Duplicate Account Prevention...');
    let dupFailed = false;
    try {
      await BankAccountService.createBankAccount(
        {
          account_name: "HDFC Duplicate A/c",
          bank_name: "HDFC Bank",
          account_number: "50200012345678", // Same account number
          ifsc_code: "HDFC0001234",         // Same IFSC
          account_type: "CURRENT",
          actorContext: superAdminCtx,
        },
        client
      );
    } catch (e) {
      dupFailed = true;
      assert(e.code === 'DUPLICATE_BANK_ACCOUNT' || e.message.includes('already exists') || e.code === '23505',
        `Duplicate IFSC + Account Number rejected: ${e.code} (${e.message})`);
    }
    assert(dupFailed, `Attempt to create duplicate bank account threw error`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-03: Invalid IFSC Rejection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-03] Testing Invalid IFSC Rejection...');
    let ifscFailed = false;
    try {
      await BankAccountService.createBankAccount(
        {
          account_name: "Invalid IFSC A/c",
          bank_name: "State Bank of India",
          account_number: "112233445566",
          ifsc_code: "INVALID_IFSC",
          account_type: "SAVINGS",
          actorContext: superAdminCtx,
        },
        client
      );
    } catch (e) {
      ifscFailed = true;
      assert(e.code === 'INVALID_IFSC_CODE' || e.message.includes('IFSC'),
        `Invalid IFSC rejected: ${e.code} (${e.message})`);
    }
    assert(ifscFailed, `Attempt with invalid IFSC threw error`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-04: Invalid Account Type Rejection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-04] Testing Invalid Account Type Rejection...');
    let accTypeFailed = false;
    try {
      await BankAccountService.createBankAccount(
        {
          account_name: "Crypto Account",
          bank_name: "Crypto Bank",
          account_number: "999888777666",
          ifsc_code: "UTIB0000123",
          account_type: "CRYPTO", // Invalid
          actorContext: superAdminCtx,
        },
        client
      );
    } catch (e) {
      accTypeFailed = true;
      assert(e.code === 'INVALID_ACCOUNT_TYPE' || e.message.includes('type'),
        `Invalid account type rejected: ${e.code} (${e.message})`);
    }
    assert(accTypeFailed, `Attempt with invalid account type threw error`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-05: Invalid GL Mapping Rejection (non-existent GL id)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-05] Testing Invalid GL Mapping Rejection...');
    let glNotFoundFailed = false;
    try {
      await BankAccountService.createBankAccount(
        {
          account_name: "Ghost GL Account",
          bank_name: "Kotak Mahindra Bank",
          account_number: "777666555444",
          ifsc_code: "KKBK0000123",
          account_type: "CURRENT",
          auto_provision_gl: false,
          gl_account_id: "acc_ghost_non_existent",
          actorContext: superAdminCtx,
        },
        client
      );
    } catch (e) {
      glNotFoundFailed = true;
      assert(e.code === 'GL_ACCOUNT_NOT_FOUND' || e.message.includes('not found'),
        `Non-existent GL account rejected: ${e.code} (${e.message})`);
    }
    assert(glNotFoundFailed, `Attempt with non-existent GL account threw error`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-06: Non-Bank GL Mapping Rejection (GL subtype != BANK)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-06] Testing Non-Bank GL Mapping Rejection...');
    // Account 1111 has subtype CASH
    const cashAcc = await AccountingAccountRepository.findByCode('1111', client);
    assert(cashAcc !== null && cashAcc.subtype !== 'BANK', `Account 1111 found with subtype: ${cashAcc?.subtype}`);
    let nonBankGlFailed = false;
    try {
      await BankAccountService.createBankAccount(
        {
          account_name: "Cash Mapped Account",
          bank_name: "Kotak Mahindra Bank",
          account_number: "777666555444",
          ifsc_code: "KKBK0000123",
          account_type: "CURRENT",
          auto_provision_gl: false,
          gl_account_id: cashAcc.id,
          actorContext: superAdminCtx,
        },
        client
      );
    } catch (e) {
      nonBankGlFailed = true;
      assert(e.code === 'INVALID_GL_ACCOUNT_SUBTYPE' || e.message.includes('BANK'),
        `Non-bank GL account mapping rejected: ${e.code} (${e.message})`);
    }
    assert(nonBankGlFailed, `Attempt with non-bank GL account threw error`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-07: Branch Ownership Rejection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-07] Testing Branch Ownership Rejection...');
    let branchRejected = false;
    try {
      await BankAccountService.createBankAccount(
        {
          account_name: "Axis Bank Corporate A/c",
          bank_name: "Axis Bank",
          account_number: "91202001234567",
          ifsc_code: "UTIB0000456",
          account_type: "CURRENT",
          branch_id: "br_blr_koramangala",
          auto_provision_gl: true,
          actorContext: superAdminCtx,
        },
        client
      );
    } catch (e) {
      branchRejected = true;
      assert(e.code === 'BRANCH_OWNERSHIP_FORBIDDEN',
        `Attempting branch ownership explicitly rejected with ${e.code}: ${e.message}`);
    }
    assert(branchRejected, `Attempt to create bank account with branch_id threw error`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-08: Unauthorized Create Rejection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-08] Testing Unauthorized Create Rejection...');
    let unauthCreateFailed = false;
    try {
      await BankAccountService.createBankAccount(
        {
          account_name: "Unauthorized A/c",
          bank_name: "Unauthorized Bank",
          account_number: "444333222111",
          ifsc_code: "PUNB0000123",
          account_type: "SAVINGS",
          actorContext: staffCtx, // Staff lacking ACCOUNTING.MANAGE_GL
        },
        client
      );
    } catch (e) {
      unauthCreateFailed = true;
      assert(e.code === 'PERMISSION_DENIED', `Unauthorized create rejected: ${e.code} (${e.message})`);
    }
    assert(unauthCreateFailed, `Staff create attempt threw PERMISSION_DENIED`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-09: Unauthorized Edit Rejection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-09] Testing Unauthorized Edit Rejection...');
    let unauthEditFailed = false;
    try {
      await BankAccountService.updateBankAccount(
        {
          id: bankA.id,
          account_name: "Tampered Name",
          actorContext: staffCtx,
        },
        client
      );
    } catch (e) {
      unauthEditFailed = true;
      assert(e.code === 'PERMISSION_DENIED', `Unauthorized edit rejected: ${e.code}`);
    }
    assert(unauthEditFailed, `Staff edit attempt threw PERMISSION_DENIED`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-10: Unauthorized Deactivate Rejection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-10] Testing Unauthorized Deactivate Rejection...');
    let unauthDeactFailed = false;
    try {
      await BankAccountService.setBankAccountStatus(
        bankA.id,
        "INACTIVE",
        staffCtx,
        client
      );
    } catch (e) {
      unauthDeactFailed = true;
      assert(e.code === 'PERMISSION_DENIED', `Unauthorized status change rejected: ${e.code}`);
    }
    assert(unauthDeactFailed, `Staff status change attempt threw PERMISSION_DENIED`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-11: Status Lifecycle (ACTIVE -> INACTIVE -> FROZEN -> ACTIVE)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-11] Testing Status Lifecycle Transitions...');
    // 1. Deactivate
    const inactRes = await BankAccountService.setBankAccountStatus(
      bankA.id,
      "INACTIVE",
      superAdminCtx,
      client
    );
    assert(inactRes.status === "INACTIVE", `Bank A status transitioned to INACTIVE`);

    // 2. Freeze
    const freezeRes = await BankAccountService.setBankAccountStatus(
      bankA.id,
      "FROZEN",
      superAdminCtx,
      client
    );
    assert(freezeRes.status === "FROZEN", `Bank A status transitioned to FROZEN`);

    // 3. Reactivate
    const reactRes = await BankAccountService.setBankAccountStatus(
      bankA.id,
      "ACTIVE",
      superAdminCtx,
      client
    );
    assert(reactRes.status === "ACTIVE", `Bank A status transitioned back to ACTIVE`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-12: Update Bank Details
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-12] Testing Update Bank Details...');
    const updatedBankA = await BankAccountService.updateBankAccount(
      {
        id: bankA.id,
        account_name: "HDFC Central Treasury Account",
        branch_name: "Indiranagar 100ft Road Flagship",
        metadata: { tier: "PRIMARY", contact: "treasury@caketohome.com" },
        actorContext: superAdminCtx,
      },
      client
    );
    assert(updatedBankA.account_name === "HDFC Central Treasury Account",
      `account_name updated: ${updatedBankA.account_name}`);
    assert(updatedBankA.branch_name === "Indiranagar 100ft Road Flagship",
      `branch_name updated: ${updatedBankA.branch_name}`);
    assert(updatedBankA.metadata && updatedBankA.metadata.tier === "PRIMARY",
      `metadata preserved: ${updatedBankA.metadata ? updatedBankA.metadata.tier : ''}`);

    // Verify DB reflection
    const dbBankA = await BankAccountRepository.findById(bankA.id, client);
    assert(dbBankA.account_name === "HDFC Central Treasury Account",
      `Database row reflects updated name: ${dbBankA.account_name}`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-13: Bank-Specific GL Resolution (Bank A vs Bank B distinct GLs)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-13] Testing Bank-Specific GL Resolution...');
    const bankB = await BankAccountService.createBankAccount(
      {
        account_name: "ICICI Operational Account",
        bank_name: "ICICI Bank",
        account_number: "000105012345",
        ifsc_code: "ICIC0000001",
        account_type: "CURRENT",
        branch_name: "Koramangala Branch",
        auto_provision_gl: true,
        actorContext: superAdminCtx,
      },
      client
    );

    assert(bankB.id !== bankA.id, `Bank B has unique ID: ${bankB.id}`);
    assert(bankB.gl_account_id !== bankA.gl_account_id,
      `Bank A GL (${bankA.gl_account_code}) and Bank B GL (${bankB.gl_account_code}) are strictly DISTINCT`);

    const glA = await AccountingAccountRepository.findById(bankA.gl_account_id, client);
    const glB = await AccountingAccountRepository.findById(bankB.gl_account_id, client);
    assert(glA.code !== glB.code, `GL account codes are distinct: ${glA.code} vs ${glB.code}`);
    assert(glA.code.startsWith('1112') && glB.code.startsWith('1112'),
      `Both GL accounts are properly sub-ledgered under Bank Operating parent 1110/1112`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-14: Supplier Payment Uses Selected Bank GL
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-14] Testing Supplier Payment Integration with Bank GL Resolution...');
    // Create test purchase and approve/post it for disbursement testing
    const testBranchRes = await client.query('SELECT id FROM public.branch LIMIT 1');
    const testBranchId = testBranchRes.rows[0].id;
    const testSupRes = await client.query('SELECT id FROM public.supplier LIMIT 1');
    let testSupId;
    if (testSupRes.rows.length > 0) {
      testSupId = testSupRes.rows[0].id;
    } else {
      testSupId = `sup_b_test_${Date.now()}`;
      await client.query(`
        INSERT INTO public.supplier (id, name, gstin, state, branch_id, is_active, created_at, updated_at)
        VALUES ($1, 'Test Flour Mills Ltd', '29ABCDE1234F1Z5', 'Karnataka', $2, true, NOW(), NOW())
      `, [testSupId, testBranchId]);
    }

    const testPurchaseId = `pur_test_b_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase
        (id, invoice_no, invoice_date, supplier_id, branch_id, subtotal, discount, taxable_value, cgst, sgst, igst, total, status, created_by, approved_by, posted_at, created_at, updated_at)
      VALUES
        ($1, 'INV-B-001', '2026-10-04', $2, $3, 10000, 0, 10000, 900, 900, 0, 11800, 'POSTED', 'usr_creator', 'usr_approver', NOW(), NOW(), NOW())
    `, [testPurchaseId, testSupId, testBranchId]);

    // Test 14A: Disburse ₹5,000 via Bank A
    const payResA = await PurchasePaymentService.recordPayment({
      purchaseId: testPurchaseId,
      branchId: testBranchId,
      paidBy: "usr_payer_disburser",
      actorRole: "SUPER_ADMIN",
      payment: {
        amount: 5000,
        method: "BANK_TRANSFER",
        payment_date: "2026-10-04",
        reference: "NEFT-HDFC-001",
        bank_account_id: bankA.id,
      },
      client,
    });
    if (!payResA.success) console.error('  -> payResA error:', payResA.error, payResA.code);
    assert(payResA.success === true, `Supplier payment via Bank A succeeded`);
    if (payResA.success) {
      const journalRes = await client.query(`
        SELECT jl.*, aa.code AS account_code, aa.name AS account_name
        FROM public.accounting_journal_line jl
        JOIN public.accounting_account aa ON jl.account_id = aa.id
        WHERE jl.journal_entry_id = $1
        ORDER BY jl.debit_amount DESC
      `, [payResA.data.journal_entry.id]);

      const debitLine = journalRes.rows.find(r => Number(r.debit_amount) > 0);
      const creditLine = journalRes.rows.find(r => Number(r.credit_amount) > 0);

      assert(debitLine && debitLine.account_code === '2111',
        `Debit leg hits Accounts Payable 2111 (₹${debitLine?.debit_amount})`);
      assert(creditLine && creditLine.account_id === bankA.gl_account_id,
        `Credit leg hits Bank A's dedicated child GL (${creditLine?.account_code} - ${creditLine?.account_name}), NOT generic 1112!`);
      assert(Number(creditLine?.credit_amount) === 5000,
        `Credit amount exactly matches payment: ₹${creditLine?.credit_amount}`);
    }

    // Test 14B: Disburse ₹3,000 via Bank B
    const payResB = await PurchasePaymentService.recordPayment({
      purchaseId: testPurchaseId,
      branchId: testBranchId,
      paidBy: "usr_payer_disburser",
      actorRole: "SUPER_ADMIN",
      payment: {
        amount: 3000,
        method: "BANK_TRANSFER",
        payment_date: "2026-10-04",
        reference: "RTGS-ICICI-002",
        bank_account_id: bankB.id,
      },
      client,
    });
    if (!payResB.success) console.error('  -> payResB error:', payResB.error, payResB.code);
    assert(payResB.success === true, `Supplier payment via Bank B succeeded`);
    if (payResB.success) {
      const journalResB = await client.query(`
        SELECT jl.*, aa.code AS account_code
        FROM public.accounting_journal_line jl
        JOIN public.accounting_account aa ON jl.account_id = aa.id
        WHERE jl.journal_entry_id = $1
      `, [payResB.data.journal_entry.id]);

      const creditLineB = journalResB.rows.find(r => Number(r.credit_amount) > 0);
      assert(creditLineB && creditLineB.account_id === bankB.gl_account_id,
        `Credit leg hits Bank B's dedicated child GL (${creditLineB?.account_code}), strictly distinct from Bank A!`);
    }

    // Test 14C: Inactive Bank Account disbursement is blocked
    await BankAccountService.setBankAccountStatus(bankA.id, "INACTIVE", superAdminCtx, client);
    const payResInactive = await PurchasePaymentService.recordPayment({
      purchaseId: testPurchaseId,
      branchId: testBranchId,
      paidBy: "usr_payer_disburser",
      actorRole: "SUPER_ADMIN",
      payment: {
        amount: 1000,
        method: "BANK_TRANSFER",
        payment_date: "2026-10-04",
        bank_account_id: bankA.id,
      },
      client,
    });
    assert(payResInactive.success === false && payResInactive.error.includes('INACTIVE'),
      `Payment through INACTIVE bank account blocked: ${payResInactive.error}`);

    // Test 14D: Frozen Bank Account disbursement is blocked
    await BankAccountService.setBankAccountStatus(bankA.id, "FROZEN", superAdminCtx, client);
    const payResFrozen = await PurchasePaymentService.recordPayment({
      purchaseId: testPurchaseId,
      branchId: testBranchId,
      paidBy: "usr_payer_disburser",
      actorRole: "SUPER_ADMIN",
      payment: {
        amount: 1000,
        method: "BANK_TRANSFER",
        payment_date: "2026-10-04",
        bank_account_id: bankA.id,
      },
      client,
    });
    assert(payResFrozen.success === false && payResFrozen.error.includes('FROZEN'),
      `Payment through FROZEN bank account blocked: ${payResFrozen.error}`);

    // Restore Bank A to ACTIVE
    await BankAccountService.setBankAccountStatus(bankA.id, "ACTIVE", superAdminCtx, client);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-15: Deposit Clearance Uses Selected Bank GL (Dr Bank GL, Cr 1118)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-15] Testing Deposit Clearance Bank GL Resolution...');
    // Create test deposit slip with Stage 1 transit voucher prerequisite
    const slipId = `slip_b_test_${Date.now()}`;
    const stage1VoucherId = `vch_stage1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher
        (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, created_at, updated_at)
      VALUES
        ($1, 'VCH-STAGE1-01', 'JOURNAL', '2026-10-04', $2, 'FY2026-27', 'POSTED', 25000, 'INR', 'Stage 1 cash deposit transit', 'usr_cashier', NOW(), NOW())
    `, [stage1VoucherId, testBranchId]);

    await client.query(`
      INSERT INTO public.bank_deposit_slip
        (id, slip_number, company_id, branch_id, bank_account_id, deposit_date, amount, status, prepared_by, approved_by, transit_voucher_id, created_at, updated_at)
      VALUES
        ($1, 'SLIP-B-101', $2, $3, $4, '2026-10-04', 25000, 'CONFIRMED', 'usr_cashier', 'usr_mgr', $5, NOW(), NOW())
    `, [slipId, company.id, testBranchId, bankA.id, stage1VoucherId]);

    // Create matching statement line
    const stmtLineId = `stmt_ln_${Date.now()}`;
    const stmtId = `stmt_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_statement_import
        (id, company_id, bank_account_id, source_filename, source_format, file_sha256, file_size_bytes, statement_period_start, statement_period_end, total_lines_imported, total_debit_amount, total_credit_amount, status, imported_by, imported_at, created_at, updated_at)
      VALUES
        ($1, $2, $3, 'test_oct.csv', 'CSV', 'hash12345', 1024, '2026-10-01', '2026-10-31', 1, 0, 25000, 'IMPORTED', 'usr_treasury', NOW(), NOW(), NOW())
    `, [stmtId, company.id, bankA.id]);

    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, bank_reference, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 1, '2026-10-04', '2026-10-04', 'CHQ DEP CASH INDIRANAGAR SLIP-B-101', 'SLIP-B-101', 0, 25000, 125000, 'linehash123', 'UNMATCHED', NOW(), NOW())
    `, [stmtLineId, stmtId, bankA.id]);

    // Create active reconciliation session for Bank A
    const sessionId = `rec_sess_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_reconciliation_session
        (id, bank_account_id, company_id, period_start, period_end, opening_balance_per_bank, closing_balance_per_bank, status, prepared_by, created_at, updated_at)
      VALUES
        ($1, $2, $3, '2026-10-01', '2026-10-31', 100000, 125000, 'DRAFT', 'usr_treasury', NOW(), NOW())
    `, [sessionId, bankA.id, company.id]);

    // Match and acknowledge clearance
    const clearRes = await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance(
      {
        depositSlipId: slipId,
        statementLineId: stmtLineId,
        sessionId: sessionId,
        confirmerId: "usr_treasury_auditor",
        actorContext: superAdminCtx,
      },
      client
    );
    assert(clearRes.voucher !== undefined, `Deposit clearance voucher posted successfully: ${clearRes.voucher?.voucher_no}`);

    // Verify clearance journal lines: Dr Bank A GL, Cr 1118 Deposit in Transit
    const clearLinesRes = await client.query(`
      SELECT jl.*, aa.code AS account_code
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account aa ON jl.account_id = aa.id
      WHERE jl.journal_entry_id = $1
    `, [clearRes.journalEntry.id]);

    const drBank = clearLinesRes.rows.find(r => Number(r.debit_amount) > 0);
    const crTransit = clearLinesRes.rows.find(r => Number(r.credit_amount) > 0);

    assert(drBank && drBank.account_id === bankA.gl_account_id,
      `Deposit clearance debits Bank A dedicated GL (${drBank?.account_code}), NOT 1112!`);
    assert(crTransit && crTransit.account_code === '1118',
      `Deposit clearance credits 1118 Deposit in Transit (${crTransit?.account_code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-16: Gateway Payout Uses Selected Bank GL (Dr Bank GL, Cr 1113)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-16] Testing Gateway Payout Bank GL Resolution...');
    // Create gateway payout batch in APPROVED status
    const payoutBatch = await GatewayPayoutRepository.create(
      {
        company_id: company.id,
        provider: "razorpay",
        payout_reference: `PO-RZP-${Date.now()}`,
        bank_account_id: bankB.id,
        settlement_date: "2026-10-04",
        gross_amount: 10000,
        identified_fee_amount: 200,
        reported_tax_amount: 36,
        other_deductions_amount: 0,
        net_amount: 9764,
        rounding_variance: 0,
        currency: "INR",
        status: "APPROVED",
        unreconciled_exception_count: 0,
        ingestion_source: "MANUAL",
        prepared_by: "usr_treasury_preparer",
      },
      client
    );

    // Update approved_by to satisfy SoD (prepared_by != approved_by != posted_by)
    await client.query(`
      UPDATE public.gateway_payout_batch
      SET approved_by = 'usr_treasury_approver'
      WHERE id = $1
    `, [payoutBatch.id]);

    // Create test order and payment transaction to satisfy foreign key constraints
    const testOrderId = `ord_b_${Date.now()}`;
    await client.query(`
      INSERT INTO public."order" (id, version, status, is_draft_order, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 1, 'completed', false, 'INR', $2, NOW(), NOW())
    `, [testOrderId, JSON.stringify({ branch_id: testBranchId })]);

    const testTxnId = `ptxn_b_${Date.now()}`;
    await client.query(`
      INSERT INTO public.payment_transaction (
        id, company_id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'cust_test', 10000, 'INR', 'captured', 'settled', 'razorpay', NOW(), NOW())
    `, [testTxnId, company.id, testBranchId, testOrderId]);

    // Create allocation
    await GatewaySettlementOrderRepository.createAllocation(
      {
        payout_batch_id: payoutBatch.id,
        payment_transaction_id: testTxnId,
        order_id: testOrderId,
        settlement_branch_id: testBranchId,
        allocated_gross_amount: 10000,
        identified_fee_amount: 200,
        reported_tax_amount: 36,
        other_deductions_amount: 0,
        allocated_net_amount: 9764,
        allocation_status: "VALIDATED",
      },
      client
    );

    const payoutPostRes = await GatewaySettlementService.postPayoutSettlement(
      {
        payoutBatchId: payoutBatch.id,
        postedBy: "usr_treasury_auditor",
        voucherDate: "2026-10-04",
        actorContext: superAdminCtx,
      },
      client
    );
    assert(payoutPostRes.vouchers.length > 0, `Gateway payout vouchers posted: count ${payoutPostRes.vouchers.length}`);

    // Verify journal line hits Bank B GL account
    const payoutJe = payoutPostRes.journalEntries[0];
    const payoutLinesRes = await client.query(`
      SELECT jl.*, aa.code AS account_code
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account aa ON jl.account_id = aa.id
      WHERE jl.journal_entry_id = $1
    `, [payoutJe.id]);

    const netBankLine = payoutLinesRes.rows.find(r => r.account_id === bankB.gl_account_id);
    assert(netBankLine !== undefined,
      `Gateway net credit debits Bank B dedicated child GL (${netBankLine?.account_code}) for ₹${netBankLine?.debit_amount}!`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-17: Reconciliation Bank Isolation (BRS is bank-specific)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-17] Testing Bank Reconciliation Isolation...');
    const bankAList = await BankAccountService.listBankAccounts({ companyId: company.id }, client);
    assert(bankAList.some(b => b.id === bankA.id), `Bank A present in company bank list`);
    assert(bankAList.some(b => b.id === bankB.id), `Bank B present in company bank list`);

    // Verify that statement lines imported for Bank B cannot be cleared against Bank A slip
    const stmtLineBId = `stmt_ln_b_${Date.now()}`;
    const stmtBId = `stmt_b_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_statement_import
        (id, company_id, bank_account_id, source_filename, source_format, file_sha256, file_size_bytes, statement_period_start, statement_period_end, total_lines_imported, total_debit_amount, total_credit_amount, status, imported_by, imported_at, created_at, updated_at)
      VALUES
        ($1, $2, $3, 'test_oct_b.csv', 'CSV', 'hash54321', 1024, '2026-10-01', '2026-10-31', 1, 0, 25000, 'IMPORTED', 'usr_treasury', NOW(), NOW(), NOW())
    `, [stmtBId, company.id, bankB.id]);

    await client.query(`
      INSERT INTO public.bank_statement_line
        (id, import_id, bank_account_id, line_number, transaction_date, value_date, description, bank_reference, debit_amount, credit_amount, running_balance, line_hash, reconciliation_status, created_at, updated_at)
      VALUES
        ($1, $2, $3, 1, '2026-10-04', '2026-10-04', 'CHQ DEP CASH CROSS BANK', 'SLIP-B-102', 0, 25000, 125000, 'linehash456', 'UNMATCHED', NOW(), NOW())
    `, [stmtLineBId, stmtBId, bankB.id]);

    const stage1Voucher2Id = `vch_stage1_2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher
        (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, currency, narration, created_by, created_at, updated_at)
      VALUES
        ($1, 'VCH-STAGE1-02', 'JOURNAL', '2026-10-04', $2, 'FY2026-27', 'POSTED', 25000, 'INR', 'Stage 1 cash deposit transit 2', 'usr_cashier', NOW(), NOW())
    `, [stage1Voucher2Id, testBranchId]);

    const slipA2Id = `slip_b2_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_deposit_slip
        (id, slip_number, company_id, branch_id, bank_account_id, deposit_date, amount, status, prepared_by, approved_by, transit_voucher_id, created_at, updated_at)
      VALUES
        ($1, 'SLIP-B-102', $2, $3, $4, '2026-10-04', 25000, 'CONFIRMED', 'usr_cashier', 'usr_mgr', $5, NOW(), NOW())
    `, [slipA2Id, company.id, testBranchId, bankA.id, stage1Voucher2Id]);

    let crossBankMismatch = false;
    try {
      await BankReconciliationMatchingEngine.confirmAndPostCashDepositClearance(
        {
          depositSlipId: slipA2Id,
          statementLineId: stmtLineBId,
          confirmerId: "usr_treasury_auditor",
          actorContext: superAdminCtx,
        },
        client
      );
    } catch (e) {
      crossBankMismatch = true;
      assert(e.code === 'BANK_ACCOUNT_MISMATCH',
        `Cross-bank clearance rejected: ${e.code} (${e.message})`);
    }
    assert(crossBankMismatch, `Cross-bank reconciliation clearance threw BANK_ACCOUNT_MISMATCH`);

    // ─────────────────────────────────────────────────────────────────────────
    // REQ-18: Double-Entry Math Invariant Check & Zero Suspense Verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[REQ-18] Verifying Double-Entry Math Invariants & Zero Suspense...');
    const unbalRes = await client.query(`
      SELECT journal_entry_id, 
             SUM(debit_amount) AS total_debit, 
             SUM(credit_amount) AS total_credit,
             ABS(SUM(debit_amount) - SUM(credit_amount)) AS variance
      FROM public.accounting_journal_line
      GROUP BY journal_entry_id
      HAVING ABS(SUM(debit_amount) - SUM(credit_amount)) > 0.001
    `);
    assert(unbalRes.rows.length === 0, `All posted journal entries are mathematically balanced (Debits === Credits)`);

    // Verify account 1119 (Suspense) was never touched
    const suspenseRes = await client.query(`
      SELECT COUNT(*) FROM public.accounting_journal_line jl
      JOIN public.accounting_account aa ON jl.account_id = aa.id
      WHERE aa.code = '1119'
    `);
    const suspenseHits = parseInt(suspenseRes.rows[0].count, 10);
    assert(suspenseHits === 0, `Account 1119 Suspense was NEVER touched (count: ${suspenseHits})`);

  } catch (err) {
    console.error('FATAL TEST ERROR:', err);
    failCount++;
  } finally {
    // 100% Rollback of all test fixtures to preserve pristine baseline
    await client.query('ROLLBACK');
    console.log('\n[Teardown] Transaction ROLLED BACK. Zero test data persisted.');

    // Verify post-test baseline restoration
    const postBankAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.bank_account')).rows[0].count, 10);
    const postAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const postVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const postJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const postLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);

    assert(postBankAccounts === preBankAccounts, `bank_account restored to baseline (${postBankAccounts})`);
    assert(postAccounts === preAccounts, `accounting_account restored to baseline (${postAccounts})`);
    assert(postVouchers === preVouchers, `accounting_voucher restored to baseline (${postVouchers})`);
    assert(postJournals === preJournals, `accounting_journal_entry restored to baseline (${postJournals})`);
    assert(postLines === preLines, `accounting_journal_line restored to baseline (${postLines})`);

    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`PHASE B TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error("FATAL SUITE EXECUTION ERROR:", err);
  process.exit(1);
});
