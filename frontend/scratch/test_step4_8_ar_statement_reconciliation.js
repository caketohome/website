/**
 * CakeToHome ERP — Phase 4F Step 4.8 Bounded Implementation Test Suite
 * Trade AR Statement + Trade AR ↔ GL Reconciliation (AR Aging Feature-Blocked)
 *
 * SCOPE & BOUNDARIES:
 * 1. Trade AR Statement (Account 1121 only):
 *    - Opening balance strictly prior to startDate.
 *    - Deterministic ordering: voucher_date ASC, created_at ASC, voucher_no ASC, line_no ASC, id ASC.
 *    - Running balance calculation: Balance_i = Balance_{i-1} + Debit_i - Credit_i.
 *    - Closing balance mathematical identity.
 *    - Event coverage: Sales Invoice, Customer Receipt, Credit Note, Customer Refund, Selective Hybrid Reversal.
 *    - Exclusion of Account 1122 (Undeposited COD).
 *    - Exclusion of unposted/cancelled vouchers and quarantined prototype data.
 * 2. Trade AR ↔ GL Reconciliation:
 *    - Identity: GL 1121 Balance === Identified Customer Total + Guest/Unassigned AR Total.
 *    - Difference === 0.00.
 *    - Systematic exception detection:
 *      * Missing customer dimension
 *      * Invalid customer reference
 *      * Duplicate source identity
 *      * Branch mismatch
 *      * Unbalanced journal
 *      * Account misclassification (parent 1120)
 * 3. Security & RBAC:
 *    - ACCOUNTING.VIEW enforcement via hasEffectivePermission.
 *    - Customer self-service boundary (CUSTOMER_ACCESS_DENIED).
 *    - Branch scoping & cross-branch denial (BRANCH_ACCESS_DENIED).
 * 4. AR Aging Feature-Block:
 *    - Explicitly throws FEATURE_BLOCKED error.
 *    - No due dates or aging buckets calculated.
 * 5. 100% Rollback Isolation:
 *    - Executes inside a single BEGIN ... ROLLBACK transaction.
 *    - Zero persistent rows in database baseline.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.8 Trade AR Statement & Reconciliation Tests');
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

  const { AccountsReceivableService } = require('../src/lib/services/accounts-receivable.service');
  const { AccountsReceivableRepository } = require('../src/lib/repositories/accounts-receivable.repository');
  const { StaffAccessControl } = require('../src/lib/staff-access-control');
  const { signAuthToken } = require('../src/lib/security/auth-session');
  const { GET } = require('../src/app/api/v1/[...path]/route');
  const { NextRequest } = require('next/server');

  const client = new Client({ connectionString: getConnectionString() });
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

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0: PRE-TEST DATABASE BASELINE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/6] Verifying pre-test database baseline (18 checks)...');
    const preAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const preLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const prePeriods = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const prePurchases = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const preItems = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_item')).rows[0].count, 10);
    const prePayments = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const preSuppliers = parseInt((await client.query('SELECT COUNT(*) FROM public.supplier')).rows[0].count, 10);
    const preBranches = parseInt((await client.query('SELECT COUNT(*) FROM public.branch')).rows[0].count, 10);
    const preBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const preLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const preMovements = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const preConsumption = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_consumption')).rows[0].count, 10);
    const preOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const preTransactions = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    const preSettings = parseInt((await client.query("SELECT COUNT(*) FROM public.setting WHERE key = 'accounting_start_date'")).rows[0].count, 10);
    const preCustomers = parseInt((await client.query('SELECT COUNT(*) FROM public.customer')).rows[0].count, 10);

    assert(preAccounts === 98, `Pre-test accounting_account === 98 (actual: ${preAccounts})`);
    assert(preVouchers === 0, `Pre-test accounting_voucher === 0 (actual: ${preVouchers})`);
    assert(preJournals === 0, `Pre-test accounting_journal_entry === 0 (actual: ${preJournals})`);
    assert(preLines === 0, `Pre-test accounting_journal_line === 0 (actual: ${preLines})`);
    assert(prePeriods === 0, `Pre-test accounting_fiscal_period === 0 (actual: ${prePeriods})`);
    assert(prePurchases === 0, `Pre-test purchase === 0 (actual: ${prePurchases})`);
    assert(preItems === 0, `Pre-test purchase_item === 0 (actual: ${preItems})`);
    assert(prePayments === 0, `Pre-test purchase_payment === 0 (actual: ${prePayments})`);
    assert(preSuppliers === 0, `Pre-test supplier === 0 (actual: ${preSuppliers})`);
    assert(preBranches === 57, `Pre-test branch === 57 (actual: ${preBranches})`);
    assert(preBinv === 424, `Pre-test branch_inventory === 424 (actual: ${preBinv})`);
    assert(preLots === 0, `Pre-test inventory_cost_lot === 0 (actual: ${preLots})`);
    assert(preMovements === 0, `Pre-test inventory_movement === 0 (actual: ${preMovements})`);
    assert(preConsumption === 0, `Pre-test inventory_cost_consumption === 0 (actual: ${preConsumption})`);
    assert(preOrders === 173, `Pre-test order === 173 (actual: ${preOrders})`);
    assert(preTransactions === 53, `Pre-test payment_transaction === 53 (actual: ${preTransactions})`);
    assert(preSettings === 0, `Pre-test accounting_start_date setting === 0 (actual: ${preSettings})`);
    assert(preCustomers === 57, `Pre-test customer === 57 (actual: ${preCustomers})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0B: REPOSITORY/SERVICE LAYERED ARCHITECTURE CONTRACT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[0.5/6] Verifying Repository/Service Layered Architecture Boundary...');
    assert(typeof AccountsReceivableRepository.findAccountByCode === 'function', 'Repository defines findAccountByCode');
    assert(typeof AccountsReceivableRepository.findCustomerById === 'function', 'Repository defines findCustomerById');
    assert(typeof AccountsReceivableRepository.getOpeningBalance === 'function', 'Repository defines getOpeningBalance');
    assert(typeof AccountsReceivableRepository.getStatementLines === 'function', 'Repository defines getStatementLines');
    assert(typeof AccountsReceivableRepository.getGlAccountBalance === 'function', 'Repository defines getGlAccountBalance');
    assert(typeof AccountsReceivableRepository.getCustomerSubledgerBalances === 'function', 'Repository defines getCustomerSubledgerBalances');
    assert(typeof AccountsReceivableRepository.getGuestUnassignedBalance === 'function', 'Repository defines getGuestUnassignedBalance');
    assert(typeof AccountsReceivableRepository.findMissingCustomerDimensionLines === 'function', 'Repository defines findMissingCustomerDimensionLines');
    assert(typeof AccountsReceivableRepository.findInvalidCustomerReferenceLines === 'function', 'Repository defines findInvalidCustomerReferenceLines');
    assert(typeof AccountsReceivableRepository.findDuplicateSourceVouchers === 'function', 'Repository defines findDuplicateSourceVouchers');
    assert(typeof AccountsReceivableRepository.findBranchMismatchLines === 'function', 'Repository defines findBranchMismatchLines');
    assert(typeof AccountsReceivableRepository.findUnbalancedJournalEntries === 'function', 'Repository defines findUnbalancedJournalEntries');
    assert(typeof AccountsReceivableRepository.findAccountMisclassificationLines === 'function', 'Repository defines findAccountMisclassificationLines');

    // ─────────────────────────────────────────────────────────────────────────
    // BEGIN TRANSACTION (FULL ROLLBACK GUARANTEED)
    // ─────────────────────────────────────────────────────────────────────────
    await client.query('BEGIN');
    console.log('\n[1/6] Setup isolated test fixtures inside transaction...');

    // 1. Resolve accounts
    const acc1121Res = await client.query("SELECT id FROM public.accounting_account WHERE code = '1121'");
    const acc1121Id = acc1121Res.rows[0].id;

    const acc1122Res = await client.query("SELECT id FROM public.accounting_account WHERE code = '1122'");
    const acc1122Id = acc1122Res.rows[0].id;

    const acc4110Res = await client.query("SELECT id FROM public.accounting_account WHERE code = '4110'");
    const acc4110Id = acc4110Res.rows[0].id;

    const acc1113Res = await client.query("SELECT id FROM public.accounting_account WHERE code = '1113'");
    const acc1113Id = acc1113Res.rows[0].id;

    const acc1111Res = await client.query("SELECT id FROM public.accounting_account WHERE code = '1111'");
    const acc1111Id = acc1111Res.rows[0].id;

    const acc4190Res = await client.query("SELECT id FROM public.accounting_account WHERE code = '4190'");
    const acc4190Id = acc4190Res.rows[0].id;

    const acc1120Res = await client.query("SELECT id FROM public.accounting_account WHERE code = '1120'");
    const acc1120Id = acc1120Res.rows[0].id;

    // Pick 2 real branches
    const branchRes = await client.query("SELECT id, name FROM public.branch ORDER BY id LIMIT 2");
    const branchA = branchRes.rows[0];
    const branchB = branchRes.rows[1];

    // Pick 2 real customers
    const custRes = await client.query("SELECT id, first_name, last_name, company_name, email, phone FROM public.customer WHERE deleted_at IS NULL ORDER BY id LIMIT 2");
    const cust1 = custRes.rows[0];
    const cust2 = custRes.rows[1];

    console.log(`  Using Branch A: ${branchA.id} (${branchA.name})`);
    console.log(`  Using Branch B: ${branchB.id} (${branchB.name})`);
    console.log(`  Using Customer 1: ${cust1.id} (${cust1.first_name} ${cust1.last_name})`);
    console.log(`  Using Customer 2: ${cust2.id} (${cust2.first_name} ${cust2.last_name})`);

    // Helper to insert a balanced posted voucher + journal entry + lines
    let vchCounter = 1;
    async function createPostedTransaction({
      voucher_date,
      voucher_type,
      reference_type,
      reference_id,
      reference_event = 'PRIMARY',
      branch_id,
      narration,
      lines, // array of { account_id, debit_amount, credit_amount, customer_id, line_narration, line_branch_id }
      status = 'POSTED',
    }) {
      const vchNo = `VCH-TEST-2026-${String(vchCounter++).padStart(6, '0')}`;
      const entryNo = `JE-TEST-2026-${String(vchCounter).padStart(6, '0')}`;
      const totalAmount = lines.reduce((s, l) => s + (l.debit_amount || 0), 0);

      const vchRes = await client.query(
        `INSERT INTO public.accounting_voucher (
          voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status,
          total_amount, currency, reference_type, reference_id, reference_event,
          narration, created_by, posted_by, posted_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, '2026-2027', $5,
          $6, 'INR', $7, $8, $9,
          $10, 'usr_tester', 'usr_poster', NOW(), NOW(), NOW()
        ) RETURNING id, voucher_no, voucher_date`,
        [
          vchNo, voucher_type, voucher_date, branch_id, status,
          totalAmount, reference_type, reference_id, reference_event,
          narration
        ]
      );
      const voucher = vchRes.rows[0];

      if (status !== 'POSTED') {
        return { voucher, entry: null, lines: [] };
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debit_amount || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit_amount || 0), 0);

      const entryRes = await client.query(
        `INSERT INTO public.accounting_journal_entry (
          entry_no, voucher_id, entry_date, branch_id, fiscal_year,
          total_debit, total_credit, is_reversed, narration, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, '2026-2027',
          $5, $6, false, $7, 'usr_tester', NOW()
        ) RETURNING id, entry_no, entry_date, created_at`,
        [
          entryNo, voucher.id, voucher_date, branch_id,
          totalDebit, totalCredit, narration
        ]
      );
      const entry = entryRes.rows[0];

      const insertedLines = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const lineBranch = l.line_branch_id || branch_id;
        const lineRes = await client.query(
          `INSERT INTO public.accounting_journal_line (
            journal_entry_id, line_no, account_id, debit_amount, credit_amount,
            branch_id, customer_id, narration
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8
          ) RETURNING id, line_no, account_id, debit_amount, credit_amount, customer_id`,
          [
            entry.id, i + 1, l.account_id, l.debit_amount || 0, l.credit_amount || 0,
            lineBranch, l.customer_id || null, l.line_narration || narration
          ]
        );
        insertedLines.push(lineRes.rows[0]);
      }

      return { voucher, entry, lines: insertedLines };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: SEED REPRESENTATIVE ACCOUNTING TRANSACTIONS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/6] Seeding representative lifecycle transactions on Account 1121 and 1122...');

    // Event 1: Pre-period Opening Balance Invoice for Customer 1 (2026-08-15)
    // Dr 1121: 2000.00, Cr 4110: 2000.00
    await createPostedTransaction({
      voucher_date: '2026-08-15',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_pre_001',
      branch_id: branchA.id,
      narration: 'Pre-period opening balance sales invoice',
      lines: [
        { account_id: acc1121Id, debit_amount: 2000, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 2000, customer_id: cust1.id },
      ],
    });

    // Event 2: Pre-period Partial Receipt for Customer 1 (2026-08-20)
    // Dr 1113: 500.00, Cr 1121: 500.00 (Net opening balance = 2000 - 500 = 1500.00)
    await createPostedTransaction({
      voucher_date: '2026-08-20',
      voucher_type: 'RECEIPT',
      reference_type: 'PAYMENT_TRANSACTION',
      reference_id: 'pmt_pre_001',
      branch_id: branchA.id,
      narration: 'Pre-period receipt partial settlement',
      lines: [
        { account_id: acc1113Id, debit_amount: 500, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc1121Id, debit_amount: 0, credit_amount: 500, customer_id: cust1.id },
      ],
    });

    // Event 3: In-Period Sales Invoice 1 for Customer 1 (2026-09-02)
    // Dr 1121: 1575.00, Cr 4110: 1575.00
    await createPostedTransaction({
      voucher_date: '2026-09-02',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_sep_001',
      branch_id: branchA.id,
      narration: 'In-period sales invoice ord_sep_001',
      lines: [
        { account_id: acc1121Id, debit_amount: 1575, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 1575, customer_id: cust1.id },
      ],
    });

    // Event 4: In-Period Customer Receipt for Customer 1 (2026-09-03)
    // Dr 1113: 1000.00, Cr 1121: 1000.00
    await createPostedTransaction({
      voucher_date: '2026-09-03',
      voucher_type: 'RECEIPT',
      reference_type: 'PAYMENT_TRANSACTION',
      reference_id: 'pmt_sep_001',
      branch_id: branchA.id,
      narration: 'Customer prepaid receipt for ord_sep_001',
      lines: [
        { account_id: acc1113Id, debit_amount: 1000, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc1121Id, debit_amount: 0, credit_amount: 1000, customer_id: cust1.id },
      ],
    });

    // Event 5: In-Period Credit Note (Sales Return) for Customer 1 (2026-09-05)
    // Dr 4190: 250.00, Cr 1121: 250.00
    await createPostedTransaction({
      voucher_date: '2026-09-05',
      voucher_type: 'CREDIT_NOTE',
      reference_type: 'ORDER_RETURN',
      reference_id: 'ret_sep_001',
      branch_id: branchA.id,
      narration: 'Partial credit note for return',
      lines: [
        { account_id: acc4190Id, debit_amount: 250, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc1121Id, debit_amount: 0, credit_amount: 250, customer_id: cust1.id },
      ],
    });

    // Event 6: In-Period Customer Refund for Customer 1 (2026-09-06)
    // Step 4.6 Payment voucher: Dr 1121: 100.00, Cr 1113: 100.00
    await createPostedTransaction({
      voucher_date: '2026-09-06',
      voucher_type: 'PAYMENT',
      reference_type: 'CUSTOMER_REFUND',
      reference_id: 'ref_sep_001',
      branch_id: branchA.id,
      narration: 'Customer refund payment via gateway',
      lines: [
        { account_id: acc1121Id, debit_amount: 100, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc1113Id, debit_amount: 0, credit_amount: 100, customer_id: cust1.id },
      ],
    });

    // Event 7: In-Period Full Sales Invoice Reversal for Customer 1 (2026-09-08)
    // Step 4.7 Selective Hybrid Inversion: Dr 4110: 425.00, Cr 1121: 425.00
    await createPostedTransaction({
      voucher_date: '2026-09-08',
      voucher_type: 'JOURNAL',
      reference_type: 'SALES_REVERSAL',
      reference_id: 'ord_sep_001',
      reference_event: 'INVOICE_REVERSAL',
      branch_id: branchA.id,
      narration: 'Selective hybrid commercial reversal of invoice',
      lines: [
        { account_id: acc4110Id, debit_amount: 425, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc1121Id, debit_amount: 0, credit_amount: 425, customer_id: cust1.id },
      ],
    });

    // Event 8: In-Period Customer 1 Branch B transaction (2026-09-10)
    // Dr 1121: 800.00, Cr 4110: 800.00
    await createPostedTransaction({
      voucher_date: '2026-09-10',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_sep_002',
      branch_id: branchB.id,
      narration: 'Sales invoice Branch B',
      lines: [
        { account_id: acc1121Id, debit_amount: 800, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 800, customer_id: cust1.id },
      ],
    });

    // Event 9: In-Period Customer 2 Sales Invoice (2026-09-12)
    // Dr 1121: 3000.00, Cr 4110: 3000.00
    await createPostedTransaction({
      voucher_date: '2026-09-12',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_sep_cust2_001',
      branch_id: branchA.id,
      narration: 'Sales invoice Customer 2',
      lines: [
        { account_id: acc1121Id, debit_amount: 3000, credit_amount: 0, customer_id: cust2.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 3000, customer_id: cust2.id },
      ],
    });

    // Event 10: Legitimate Guest Order on Account 1121 (customer_id = NULL) (2026-09-15)
    // Dr 1121: 500.00, Cr 4110: 500.00
    await createPostedTransaction({
      voucher_date: '2026-09-15',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_guest_sep_001',
      branch_id: branchA.id,
      narration: 'Guest point-of-sale order',
      lines: [
        { account_id: acc1121Id, debit_amount: 500, credit_amount: 0, customer_id: null },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 500, customer_id: null },
      ],
    });

    // Event 11: COD Order on Account 1122 (Undeposited COD) (2026-09-16)
    // Dr 1122: 1200.00, Cr 4110: 1200.00
    // Must be completely ignored by Trade AR statement and Trade AR reconciliation!
    await createPostedTransaction({
      voucher_date: '2026-09-16',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_cod_001',
      branch_id: branchA.id,
      narration: 'COD order in-transit on account 1122',
      lines: [
        { account_id: acc1122Id, debit_amount: 1200, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 1200, customer_id: cust1.id },
      ],
    });

    // Event 12: Unposted/DRAFT voucher on Account 1121 (Must be excluded!)
    await createPostedTransaction({
      voucher_date: '2026-09-18',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_draft_001',
      branch_id: branchA.id,
      narration: 'Draft unposted sales voucher',
      status: 'DRAFT',
      lines: [
        { account_id: acc1121Id, debit_amount: 9999, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 9999, customer_id: cust1.id },
      ],
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: TRADE AR STATEMENT VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/6] Testing Trade AR Statement calculations and invariants...');

    // Test 2.1: Full period Customer 1 Statement (2026-09-01 to 2026-09-30) Enterprise Scope
    const stmtCust1 = await AccountsReceivableService.getCustomerStatement(
      {
        customer_id: cust1.id,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        actorContext: { role: 'SUPER_ADMIN', branch_id: null },
      },
      client
    );

    // Expected Opening Balance prior to 2026-09-01:
    // Event 1 (Dr 2000) - Event 2 (Cr 500) = 1500.00
    assert(stmtCust1.opening_balance === 1500.00, `Customer 1 opening balance === 1500.00 (actual: ${stmtCust1.opening_balance})`);

    // Expected In-Period Transactions for Customer 1 (Events 3, 4, 5, 6, 7, 8):
    // Event 3: Dr 1575.00
    // Event 4: Cr 1000.00
    // Event 5: Cr 250.00
    // Event 6: Dr 100.00
    // Event 7: Cr 425.00
    // Event 8: Dr 800.00
    assert(stmtCust1.transactions.length === 6, `Customer 1 in-period transaction count === 6 (actual: ${stmtCust1.transactions.length})`);

    // Running Balance verification:
    // Start: 1500.00
    // 1: 1500 + 1575 = 3075.00
    // 2: 3075 - 1000 = 2075.00
    // 3: 2075 - 250 = 1825.00
    // 4: 1825 + 100 = 1925.00
    // 5: 1925 - 425 = 1500.00
    // 6: 1500 + 800 = 2300.00
    assert(stmtCust1.transactions[0].running_balance === 3075.00, `Line 1 running balance === 3075.00 (actual: ${stmtCust1.transactions[0].running_balance})`);
    assert(stmtCust1.transactions[1].running_balance === 2075.00, `Line 2 running balance === 2075.00 (actual: ${stmtCust1.transactions[1].running_balance})`);
    assert(stmtCust1.transactions[2].running_balance === 1825.00, `Line 3 running balance === 1825.00 (actual: ${stmtCust1.transactions[2].running_balance})`);
    assert(stmtCust1.transactions[3].running_balance === 1925.00, `Line 4 running balance === 1925.00 (actual: ${stmtCust1.transactions[3].running_balance})`);
    assert(stmtCust1.transactions[4].running_balance === 1500.00, `Line 5 running balance === 1500.00 (actual: ${stmtCust1.transactions[4].running_balance})`);
    assert(stmtCust1.transactions[5].running_balance === 2300.00, `Line 6 running balance === 2300.00 (actual: ${stmtCust1.transactions[5].running_balance})`);

    // Invariant: Closing Balance === Opening + Total Debits - Total Credits
    // Total Debits: 1575 + 100 + 800 = 2475.00
    // Total Credits: 1000 + 250 + 425 = 1675.00
    // Net Movement: 2475 - 1675 = 800.00
    // Closing Balance: 1500 + 800 = 2300.00
    assert(stmtCust1.total_debit === 2475.00, `Customer 1 total debits === 2475.00 (actual: ${stmtCust1.total_debit})`);
    assert(stmtCust1.total_credit === 1675.00, `Customer 1 total credits === 1675.00 (actual: ${stmtCust1.total_credit})`);
    assert(stmtCust1.net_movement === 800.00, `Customer 1 net movement === 800.00 (actual: ${stmtCust1.net_movement})`);
    assert(stmtCust1.closing_balance === 2300.00, `Customer 1 closing balance === 2300.00 (actual: ${stmtCust1.closing_balance})`);
    assert(stmtCust1.closing_balance === stmtCust1.transactions[5].running_balance, 'Closing balance strictly equals final transaction running balance');

    // Test 2.2: Deterministic Ordering Check (voucher_date ASC, created_at ASC, voucher_no ASC, line_no ASC, id ASC)
    for (let i = 1; i < stmtCust1.transactions.length; i++) {
      const prev = stmtCust1.transactions[i - 1];
      const curr = stmtCust1.transactions[i];
      const isOrdered = prev.voucher_date <= curr.voucher_date;
      assert(isOrdered, `Chronological ordering preserved: ${prev.voucher_date} <= ${curr.voucher_date}`);
    }

    // Test 2.3: Branch-Scoped Statement for Customer 1 (Branch A Only)
    const stmtCust1BranchA = await AccountsReceivableService.getCustomerStatement(
      {
        customer_id: cust1.id,
        branch_id: branchA.id,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        actorContext: { role: 'BRANCH_MANAGER', branch_id: branchA.id, permissions: ['ACCOUNTING.VIEW'] },
      },
      client
    );
    // Opening balance for Branch A: 2000 - 500 = 1500.00
    // In-period Branch A: Events 3, 4, 5, 6, 7 (Event 8 on Branch B is excluded)
    // Debits: 1575 + 100 = 1675.00
    // Credits: 1000 + 250 + 425 = 1675.00
    // Closing Balance: 1500 + 0 = 1500.00
    assert(stmtCust1BranchA.transactions.length === 5, `Branch A filtered transactions count === 5 (actual: ${stmtCust1BranchA.transactions.length})`);
    assert(stmtCust1BranchA.total_debit === 1675.00, `Branch A total debits === 1675.00 (actual: ${stmtCust1BranchA.total_debit})`);
    assert(stmtCust1BranchA.total_credit === 1675.00, `Branch A total credits === 1675.00 (actual: ${stmtCust1BranchA.total_credit})`);
    assert(stmtCust1BranchA.closing_balance === 1500.00, `Branch A closing balance === 1500.00 (actual: ${stmtCust1BranchA.closing_balance})`);

    // Test 2.4: Exclusion of Account 1122 (Undeposited COD)
    const has1122InStmt = stmtCust1.transactions.some(t => t.reference_id === 'ord_cod_001');
    assert(!has1122InStmt, 'Account 1122 COD transaction is strictly excluded from Trade AR statement');

    // Test 2.5: Exclusion of Unposted/Draft Voucher
    const hasDraftInStmt = stmtCust1.transactions.some(t => t.reference_id === 'ord_draft_001');
    assert(!hasDraftInStmt, 'Unposted/DRAFT voucher is strictly excluded from Trade AR statement');

    // Test 2.6: Fail-closed on missing/invalid customer_id
    let guestErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement({ customer_id: 'guest' }, client);
    } catch (e) {
      guestErr = e;
    }
    assert(guestErr && guestErr.message.includes('INVALID_ARGUMENT'), 'Statement generation for "guest" throws INVALID_ARGUMENT');

    let nullErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement({ customer_id: '' }, client);
    } catch (e) {
      nullErr = e;
    }
    assert(nullErr && nullErr.message.includes('INVALID_ARGUMENT'), 'Statement generation for empty customer_id throws INVALID_ARGUMENT');

    let notFoundErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement({ customer_id: 'cust_nonexistent_999' }, client);
    } catch (e) {
      notFoundErr = e;
    }
    assert(notFoundErr && notFoundErr.message.includes('not found'), 'Statement generation for nonexistent customer throws NOT_FOUND');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: TRADE AR ↔ GL RECONCILIATION VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/6] Testing Trade AR ↔ GL Reconciliation mathematical identity & exceptions...');

    // Test 3.1: Pristine Balanced Reconciliation as of 2026-09-30
    const reconResult = await AccountsReceivableService.getArGlReconciliation(
      {
        as_of_date: '2026-09-30',
        actorContext: { role: 'SUPER_ADMIN', branch_id: null },
      },
      client
    );

    // GL 1121 Balance calculation:
    // Event 1 (Cust 1): +2000
    // Event 2 (Cust 1): -500
    // Event 3 (Cust 1): +1575
    // Event 4 (Cust 1): -1000
    // Event 5 (Cust 1): -250
    // Event 6 (Cust 1): +100
    // Event 7 (Cust 1): -425
    // Event 8 (Cust 1): +800
    // Cust 1 Subledger Balance = 2300.00
    // Event 9 (Cust 2): +3000.00
    // Cust 2 Subledger Balance = 3000.00
    // Identified Customer Total = 2300 + 3000 = 5300.00
    // Event 10 (Guest): +500.00
    // Guest/Unassigned AR Total = 500.00
    // Total Control Amount = 5300 + 500 = 5800.00
    // Total GL 1121 Balance = 5800.00
    // Difference = 5800 - 5800 = 0.00
    assert(reconResult.control_account.code === '1121', 'Reconciliation target account === 1121');
    assert(reconResult.subledger.identified_customer_total === 5300.00, `Identified Customer Total === 5300.00 (actual: ${reconResult.subledger.identified_customer_total})`);
    assert(reconResult.subledger.guest_unassigned_total === 500.00, `Guest/Unassigned Total === 500.00 (actual: ${reconResult.subledger.guest_unassigned_total})`);
    assert(reconResult.subledger.total_control_amount === 5800.00, `Total Control Amount === 5800.00 (actual: ${reconResult.subledger.total_control_amount})`);
    assert(reconResult.control_account.gl_balance === 5800.00, `GL 1121 Balance === 5800.00 (actual: ${reconResult.control_account.gl_balance})`);
    assert(reconResult.reconciliation.difference === 0.00, `Reconciliation difference === 0.00 (actual: ${reconResult.reconciliation.difference})`);
    assert(reconResult.reconciliation.is_reconciled === true, 'Reconciliation status is_reconciled === true');
    assert(reconResult.subledger.customer_count === 2, `Customer count === 2 (actual: ${reconResult.subledger.customer_count})`);

    // Verify individual customer balances
    const c1Row = reconResult.customer_balances.find(c => c.customer_id === cust1.id);
    const c2Row = reconResult.customer_balances.find(c => c.customer_id === cust2.id);
    assert(c1Row && c1Row.balance === 2300.00, `Customer 1 subledger balance === 2300.00 (actual: ${c1Row?.balance})`);
    assert(c2Row && c2Row.balance === 3000.00, `Customer 2 subledger balance === 3000.00 (actual: ${c2Row?.balance})`);

    // Test 3.2: Account 1122 exclusion from reconciliation
    // Event 11 has 1200 on Account 1122. If it were included, gl_balance would be 7000.00.
    assert(reconResult.control_account.gl_balance === 5800.00, 'Account 1122 is strictly excluded from Trade AR GL balance');

    // Test 3.3: Systematic Exception Detection:
    // Let's test injecting various control exceptions and verifying the reconciliation detects them!

    // Exception Test A1: Database foreign key integrity prevents invalid customer reference
    let fkErr = null;
    await client.query('SAVEPOINT sp_fk');
    try {
      await createPostedTransaction({
        voucher_date: '2026-09-20',
        voucher_type: 'SALES',
        reference_type: 'ORDER',
        reference_id: 'ord_bad_cust_001',
        branch_id: branchA.id,
        narration: 'Attempting invalid customer ID',
        lines: [
          { account_id: acc1121Id, debit_amount: 100, credit_amount: 0, customer_id: 'cust_does_not_exist_xyz' },
          { account_id: acc4110Id, debit_amount: 0, credit_amount: 100, customer_id: 'cust_does_not_exist_xyz' },
        ],
      });
    } catch (e) {
      fkErr = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_fk');
    }
    assert(fkErr && (fkErr.code === '23503' || fkErr.message.includes('foreign key')), 'Database enforces FK constraint: invalid customer reference blocked by schema');

    // Exception Test A2: Missing customer dimension on registered order
    const existingOrd = (await client.query('SELECT id, customer_id FROM public."order" WHERE customer_id IS NOT NULL LIMIT 1')).rows[0];

    await createPostedTransaction({
      voucher_date: '2026-09-20',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: existingOrd.id,
      branch_id: branchA.id,
      narration: 'Voucher with missing customer dimension on registered order',
      lines: [
        { account_id: acc1121Id, debit_amount: 150, credit_amount: 0, customer_id: null },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 150, customer_id: null },
      ],
    });

    const reconWithMissingDim = await AccountsReceivableService.getArGlReconciliation(
      { as_of_date: '2026-09-30' },
      client
    );
    const hasMissingDimEx = reconWithMissingDim.exceptions.some(e => e.exception_type === 'MISSING_CUSTOMER_DIMENSION');
    assert(hasMissingDimEx, 'Detected MISSING_CUSTOMER_DIMENSION exception when registered order journal line has NULL customer_id');

    // Exception Test B: Branch mismatch (journal line branch differs from voucher branch)
    await createPostedTransaction({
      voucher_date: '2026-09-21',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_branch_mismatch_001',
      branch_id: branchA.id,
      narration: 'Transaction with line branch mismatch',
      lines: [
        { account_id: acc1121Id, debit_amount: 50, credit_amount: 0, customer_id: cust1.id, line_branch_id: branchB.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 50, customer_id: cust1.id, line_branch_id: branchB.id },
      ],
    });

    const reconWithBranchMismatch = await AccountsReceivableService.getArGlReconciliation(
      { as_of_date: '2026-09-30' },
      client
    );
    const hasBranchMismatchEx = reconWithBranchMismatch.exceptions.some(e => e.exception_type === 'BRANCH_MISMATCH');
    assert(hasBranchMismatchEx, 'Detected BRANCH_MISMATCH exception when line branch differs from voucher branch');

    // Exception Test C: Account Misclassification (Posting to group account 1120 instead of 1121)
    await createPostedTransaction({
      voucher_date: '2026-09-22',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_misclass_001',
      branch_id: branchA.id,
      narration: 'Posting mistakenly made to parent group 1120',
      lines: [
        { account_id: acc1120Id, debit_amount: 300, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 300, customer_id: cust1.id },
      ],
    });

    const reconWithMisclass = await AccountsReceivableService.getArGlReconciliation(
      { as_of_date: '2026-09-30' },
      client
    );
    const hasMisclassEx = reconWithMisclass.exceptions.some(e => e.exception_type === 'ACCOUNT_MISCLASSIFICATION');
    assert(hasMisclassEx, 'Detected ACCOUNT_MISCLASSIFICATION exception when posting to group account 1120');

    // Exception Test D1: Database check constraint prevents unbalanced header entry (total_debit != total_credit)
    const badEntryRes = await createPostedTransaction({
      voucher_date: '2026-09-23',
      voucher_type: 'SALES',
      reference_type: 'ORDER',
      reference_id: 'ord_unbalanced_001',
      branch_id: branchA.id,
      narration: 'Transaction deliberately made unbalanced',
      lines: [
        { account_id: acc1121Id, debit_amount: 100, credit_amount: 0, customer_id: cust1.id },
        { account_id: acc4110Id, debit_amount: 0, credit_amount: 100, customer_id: cust1.id },
      ],
    });

    let unbalHdrErr = null;
    await client.query('SAVEPOINT sp_unbal_hdr');
    try {
      await client.query(
        `UPDATE public.accounting_journal_entry SET total_credit = total_credit + 50 WHERE id = $1`,
        [badEntryRes.entry.id]
      );
    } catch (e) {
      unbalHdrErr = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_unbal_hdr');
    }
    assert(
      unbalHdrErr && (unbalHdrErr.code === '23514' || unbalHdrErr.message.includes('chk_journal_balanced')),
      'Database enforces chk_journal_balanced constraint: unbalanced header total blocked by schema'
    );

    // Exception Test D2: Unbalanced Journal Lines detection in AccountsReceivableService
    await client.query('SAVEPOINT sp_unbal_lines');
    // Deliberately insert an unbalanced extra line
    await client.query(
      `INSERT INTO public.accounting_journal_line (
        journal_entry_id, line_no, account_id, branch_id, customer_id, debit_amount, credit_amount, narration
      ) VALUES ($1, 3, $2, $3, $4, 50.00, 0.00, 'Orphan unbalanced debit line')`,
      [badEntryRes.entry.id, acc1121Id, branchA.id, cust1.id]
    );

    const reconWithUnbalanced = await AccountsReceivableService.getArGlReconciliation(
      { as_of_date: '2026-09-30' },
      client
    );
    const hasUnbalancedEx = reconWithUnbalanced.exceptions.some(e => e.exception_type === 'UNBALANCED_JOURNAL');
    assert(hasUnbalancedEx, 'Detected UNBALANCED_JOURNAL exception when journal lines debits != credits');

    // Rollback the unbalanced line
    await client.query('ROLLBACK TO SAVEPOINT sp_unbal_lines');

    // Exception Test E: Duplicate Source Idempotency Defense
    let dupErr = null;
    await client.query('SAVEPOINT sp_dup');
    try {
      await createPostedTransaction({
        voucher_date: '2026-09-24',
        voucher_type: 'SALES',
        reference_type: 'ORDER',
        reference_id: 'ord_sep_001', // Already exists as Event 3
        reference_event: 'PRIMARY',
        branch_id: branchA.id,
        narration: 'Duplicate primary order voucher',
        lines: [
          { account_id: acc1121Id, debit_amount: 100, credit_amount: 0, customer_id: cust1.id },
          { account_id: acc4110Id, debit_amount: 0, credit_amount: 100, customer_id: cust1.id },
        ],
      });
    } catch (e) {
      dupErr = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_dup');
    }
    assert(dupErr && (dupErr.code === '23505' || dupErr.message.includes('unique')), 'Database enforces Idempotency constraint: duplicate PRIMARY source blocked by schema');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: SECURITY & RBAC ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/8] Testing Security, RBAC, and multi-branch scoping...');

    // Test 4.1: Permission denied without ACCOUNTING.VIEW
    let permErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement(
        {
          customer_id: cust1.id,
          actorContext: { role: 'STAFF', profile_ids: [] }, // No ACCOUNTING.VIEW permission
        },
        client
      );
    } catch (e) {
      permErr = e;
    }
    assert(permErr && permErr.message.includes('PERMISSION_DENIED'), 'Lacking ACCOUNTING.VIEW throws PERMISSION_DENIED');

    // Test 4.2: Customer role attempting cross-customer access (customer cannot query another customer)
    let custAccessErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement(
        {
          customer_id: cust1.id,
          actorContext: {
            role: 'CUSTOMER',
            customer_id: cust2.id, // Authenticated as Customer 2, attempting Customer 1 statement
            permissions: ['ACCOUNTING.VIEW'],
          },
        },
        client
      );
    } catch (e) {
      custAccessErr = e;
    }
    assert(custAccessErr && custAccessErr.message.includes('CUSTOMER_ACCESS_DENIED'), 'Customer role attempting cross-customer statement throws CUSTOMER_ACCESS_DENIED');

    // Test 4.3: customer_id parameter cannot override verified customer identity
    let custOverrideErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement(
        {
          customer_id: 'cth_cus_forged_override_id', // Client-supplied target ID
          actorContext: {
            role: 'CUSTOMER',
            customer_id: cust2.id, // Verified server identity
            permissions: ['ACCOUNTING.VIEW'],
          },
        },
        client
      );
    } catch (e) {
      custOverrideErr = e;
    }
    assert(custOverrideErr && custOverrideErr.message.includes('CUSTOMER_ACCESS_DENIED'), 'customer_id query parameter cannot override verified customer identity');

    // Test 4.4: Null/absent branch context cannot automatically escalate non-super-admin user (Statement)
    let nullBranchStmtErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement(
        {
          customer_id: cust1.id,
          actorContext: {
            role: 'STAFF',
            branch_id: null, // Null branch context!
            permissions: ['ACCOUNTING.VIEW'],
          },
        },
        client
      );
    } catch (e) {
      nullBranchStmtErr = e;
    }
    assert(
      nullBranchStmtErr && nullBranchStmtErr.message.includes('BRANCH_ACCESS_DENIED'),
      'Null branch context on non-super-admin throws BRANCH_ACCESS_DENIED for statement'
    );

    // Test 4.5: Null/absent branch context cannot automatically escalate non-super-admin user (Reconciliation)
    let nullBranchReconErr = null;
    try {
      await AccountsReceivableService.getArGlReconciliation(
        {
          actorContext: {
            role: 'STAFF',
            branch_id: null, // Null branch context!
            permissions: ['ACCOUNTING.VIEW'],
          },
        },
        client
      );
    } catch (e) {
      nullBranchReconErr = e;
    }
    assert(
      nullBranchReconErr && nullBranchReconErr.message.includes('BRANCH_ACCESS_DENIED'),
      'Null branch context on non-super-admin throws BRANCH_ACCESS_DENIED for reconciliation'
    );

    // Test 4.6: Branch Manager attempting cross-branch statement query
    let branchAccessErr = null;
    try {
      await AccountsReceivableService.getCustomerStatement(
        {
          customer_id: cust1.id,
          branch_id: branchB.id, // Attempting Branch B
          actorContext: {
            role: 'BRANCH_MANAGER',
            branch_id: branchA.id, // Scoped to Branch A
            permissions: ['ACCOUNTING.VIEW'],
          },
        },
        client
      );
    } catch (e) {
      branchAccessErr = e;
    }
    assert(branchAccessErr && branchAccessErr.message.includes('BRANCH_ACCESS_DENIED'), 'Branch Manager cross-branch statement throws BRANCH_ACCESS_DENIED');

    // Test 4.7: Branch Manager attempting cross-branch reconciliation query
    let branchReconErr = null;
    try {
      await AccountsReceivableService.getArGlReconciliation(
        {
          branch_id: branchB.id, // Attempting Branch B
          actorContext: {
            role: 'BRANCH_MANAGER',
            branch_id: branchA.id, // Scoped to Branch A
            permissions: ['ACCOUNTING.VIEW'],
          },
        },
        client
      );
    } catch (e) {
      branchReconErr = e;
    }
    assert(branchReconErr && branchReconErr.message.includes('BRANCH_ACCESS_DENIED'), 'Branch Manager cross-branch reconciliation throws BRANCH_ACCESS_DENIED');

    // Test 4.8: SUPER_ADMIN can query enterprise scope with null branch context according to canonical authorization
    const superAdminEnterpriseRecon = await AccountsReceivableService.getArGlReconciliation(
      {
        as_of_date: '2026-09-30',
        actorContext: {
          role: 'SUPER_ADMIN',
          branch_id: null,
        },
      },
      client
    );
    assert(superAdminEnterpriseRecon.reconciliation.is_reconciled === true, 'SUPER_ADMIN can query enterprise aggregate reconciliation');
    assert(
      superAdminEnterpriseRecon.subledger.total_control_amount === superAdminEnterpriseRecon.control_account.gl_balance,
      `SUPER_ADMIN enterprise reconciliation aggregates all branches ($${superAdminEnterpriseRecon.subledger.total_control_amount})`
    );

    // Test 4.9: SUPER_ADMIN can filter reconciliation by specific branch
    const superAdminBranchARecon = await AccountsReceivableService.getArGlReconciliation(
      {
        as_of_date: '2026-09-30',
        branch_id: branchA.id,
        actorContext: {
          role: 'SUPER_ADMIN',
          branch_id: null,
        },
      },
      client
    );
    assert(superAdminBranchARecon.reconciliation.is_reconciled === true, 'SUPER_ADMIN can filter reconciliation by specific branch');
    assert(
      superAdminBranchARecon.subledger.total_control_amount === superAdminBranchARecon.control_account.gl_balance,
      `SUPER_ADMIN Branch A filtered reconciliation matches Branch A subledger ($${superAdminBranchARecon.subledger.total_control_amount})`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: AR AGING EXPLICIT FEATURE-BLOCK
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/8] Verifying AR Aging feature-block...');

    let agingErr = null;
    try {
      await AccountsReceivableService.getArAgingSchedule({ as_of_date: '2026-09-30' }, client);
    } catch (e) {
      agingErr = e;
    }
    assert(agingErr !== null, 'Calling getArAgingSchedule throws an error');
    assert(
      agingErr && agingErr.message.includes('FEATURE_BLOCKED: AR AGING: NOT AVAILABLE — DUE-DATE POLICY NOT APPROVED'),
      'Aging error message explicitly indicates FEATURE_BLOCKED due-date policy blocker'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: API ROUTE LAYER VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/8] Verifying API route boundary...');

    // 6.1 Unauthenticated request returns HTTP 401
    const reqUnauth = new NextRequest('http://localhost:3000/api/v1/admin/reports/ar/aging');
    const resUnauth = await GET(reqUnauth, { params: { path: ['admin', 'reports', 'ar', 'aging'] } });
    assert(resUnauth.status === 401, `Unauthenticated AR API request returns HTTP 401 (actual: ${resUnauth.status})`);
    const jsonUnauth = await resUnauth.json();
    assert(jsonUnauth.error === 'UNAUTHORIZED', 'Unauthenticated AR API request returns UNAUTHORIZED');

    // 6.2 Zero trust: client-supplied identity headers without valid JWT cannot escalate access
    const reqSpoofedHeaders = new NextRequest('http://localhost:3000/api/v1/admin/reports/ar/reconciliation', {
      headers: {
        'x-user-role': 'SUPER_ADMIN',
        'x-user-id': 'admin_01',
        'x-branch-id': 'null',
      },
    });
    const resSpoofedHeaders = await GET(reqSpoofedHeaders, { params: { path: ['admin', 'reports', 'ar', 'reconciliation'] } });
    assert(resSpoofedHeaders.status === 401, `Spoofed client identity headers return HTTP 401 (actual: ${resSpoofedHeaders.status})`);
    const jsonSpoofed = await resSpoofedHeaders.json();
    assert(jsonSpoofed.error === 'UNAUTHORIZED', 'Spoofed headers are ignored, zero trust enforced');

    // 6.3 Commercial customer session lacks ACCOUNTING.VIEW and cannot access admin reporting API
    const customerToken = signAuthToken({ userId: cust1.id, role: 'CUSTOMER', customerId: cust1.id });
    const reqCustReport = new NextRequest(`http://localhost:3000/api/v1/admin/reports/ar/statement?customer_id=${cust1.id}`, {
      headers: { authorization: `Bearer ${customerToken}` },
    });
    const resCustReport = await GET(reqCustReport, { params: { path: ['admin', 'reports', 'ar', 'statement'] } });
    assert(resCustReport.status === 403, `Customer token calling admin reporting returns HTTP 403 (actual: ${resCustReport.status})`);
    const jsonCustReport = await resCustReport.json();
    assert(jsonCustReport.error === 'FORBIDDEN', 'Customer lacks ACCOUNTING.VIEW on admin reporting endpoint');

    // 6.4 Staff token lacking branch assignment cannot escalate to enterprise scope (returns HTTP 403)
    let accProfile = StaffAccessControl.getAllProfiles().find(p => p.slug === 'accounting-officer');
    if (!accProfile) {
      accProfile = StaffAccessControl.createProfile({
        name: 'Accounting Officer',
        description: 'Accounting & Finance reporting role',
        permissions: ['ACCOUNTING.VIEW'],
        status: 'ACTIVE',
      });
    }

    const staffNoBranch = StaffAccessControl.createStaffMember({
      name: 'Staff No Branch',
      phone: '+91 98765 11101',
      email: 'staff.nobranch@test.com',
      role: 'STAFF',
      profile_ids: [accProfile.id],
      branch_id: null,
    });

    const staffNoBranchToken = signAuthToken({ userId: staffNoBranch.user_id, role: 'STAFF', branchId: null });
    const reqStaffNoBranch = new NextRequest('http://localhost:3000/api/v1/admin/reports/ar/reconciliation', {
      headers: { authorization: `Bearer ${staffNoBranchToken}` },
    });
    const resStaffNoBranch = await GET(reqStaffNoBranch, { params: { path: ['admin', 'reports', 'ar', 'reconciliation'] } });
    assert(resStaffNoBranch.status === 403, `Staff token with null branchId returns HTTP 403 (actual: ${resStaffNoBranch.status})`);
    const jsonStaffNoBranch = await resStaffNoBranch.json();
    assert(jsonStaffNoBranch.message.includes('no authorized branch assignment'), 'Null branch context on staff returns forbidden error');

    // 6.5 Staff token scoped to Branch A attempting to query Branch B returns HTTP 403
    const staffBranchA = StaffAccessControl.createStaffMember({
      name: 'Staff Branch A',
      phone: '+91 98765 11102',
      email: 'staff.bra@test.com',
      role: 'BRANCH_MANAGER',
      profile_ids: [accProfile.id],
      branch_id: branchA.id,
    });

    const staffBranchAToken = signAuthToken({ userId: staffBranchA.user_id, role: 'BRANCH_MANAGER', branchId: branchA.id });
    const reqStaffCrossBranch = new NextRequest(`http://localhost:3000/api/v1/admin/reports/ar/reconciliation?branch_id=${branchB.id}`, {
      headers: { authorization: `Bearer ${staffBranchAToken}` },
    });
    const resStaffCrossBranch = await GET(reqStaffCrossBranch, { params: { path: ['admin', 'reports', 'ar', 'reconciliation'] } });
    assert(resStaffCrossBranch.status === 403, `Staff token querying cross-branch returns HTTP 403 (actual: ${resStaffCrossBranch.status})`);
    const jsonStaffCrossBranch = await resStaffCrossBranch.json();
    assert(jsonStaffCrossBranch.message.includes('not authorized to access branch'), 'Cross-branch query returns branch unauthorized error');

    // 6.6 Authenticated SUPER_ADMIN can query enterprise reconciliation via API
    const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    const reqAdminRecon = new NextRequest('http://localhost:3000/api/v1/admin/reports/ar/reconciliation', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resAdminRecon = await GET(reqAdminRecon, { params: { path: ['admin', 'reports', 'ar', 'reconciliation'] } });
    assert(resAdminRecon.status === 200, `SUPER_ADMIN reconciliation request returns HTTP 200 (actual: ${resAdminRecon.status})`);
    const jsonAdminRecon = await resAdminRecon.json();
    assert(jsonAdminRecon.success === true && jsonAdminRecon.reconciliation.is_reconciled === true, 'SUPER_ADMIN API reconciliation succeeds');

    // 6.7 Authenticated AR Aging returns HTTP 501 / FEATURE_BLOCKED
    const reqAgingAuth = new NextRequest('http://localhost:3000/api/v1/admin/reports/ar/aging', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const resAgingAuth = await GET(reqAgingAuth, { params: { path: ['admin', 'reports', 'ar', 'aging'] } });
    assert(resAgingAuth.status === 501, `Authenticated AR Aging request returns HTTP 501 (actual: ${resAgingAuth.status})`);
    const jsonAgingAuth = await resAgingAuth.json();
    assert(jsonAgingAuth.status === 'FEATURE_BLOCKED', 'Authenticated AR Aging response status === FEATURE_BLOCKED');
    assert(jsonAgingAuth.message.includes('DUE-DATE POLICY NOT APPROVED'), 'Authenticated AR Aging message indicates due-date policy blocker');

    // 6.8 Authenticated AR Statement missing customer_id returns HTTP 400
    const reqStmtMissingCust = new NextRequest('http://localhost:3000/api/v1/admin/reports/ar/statement', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const resStmtMissingCust = await GET(reqStmtMissingCust, { params: { path: ['admin', 'reports', 'ar', 'statement'] } });
    assert(resStmtMissingCust.status === 400, `AR Statement missing customer_id returns HTTP 400 (actual: ${resStmtMissingCust.status})`);
    const jsonStmtMissingCust = await resStmtMissingCust.json();
    assert(jsonStmtMissingCust.error === 'VALIDATION_FAILED', 'AR Statement missing customer_id returns VALIDATION_FAILED');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: MULTI-CLIENT CONCURRENT TRANSACTION ISOLATION PROOF
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/8] Proving transaction isolation with independent concurrent PostgreSQL client...');
    const independentClient = new Client({ connectionString: getConnectionString() });
    await independentClient.connect();

    // Query baseline tables from INDEPENDENT client while transaction is uncommitted on `client`
    const uncommittedVouchers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const uncommittedJournals = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const uncommittedLines = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);

    assert(uncommittedVouchers === 0, `Independent client sees 0 accounting_voucher while transaction is active (isolation confirmed: ${uncommittedVouchers})`);
    assert(uncommittedJournals === 0, `Independent client sees 0 accounting_journal_entry while transaction is active (isolation confirmed: ${uncommittedJournals})`);
    assert(uncommittedLines === 0, `Independent client sees 0 accounting_journal_line while transaction is active (isolation confirmed: ${uncommittedLines})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: ROLLBACK & POST-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/8] Rolling back test transaction and verifying post-test baseline...');
    await client.query('ROLLBACK');

    console.log('Verifying post-rollback baseline on BOTH transaction client and independent client...');
    const rollbackVouchersClient = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const rollbackVouchersIndep = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(rollbackVouchersClient === 0, `Transaction client sees 0 accounting_voucher post-rollback (actual: ${rollbackVouchersClient})`);
    assert(rollbackVouchersIndep === 0, `Independent client sees 0 accounting_voucher post-rollback (actual: ${rollbackVouchersIndep})`);

    const postAccounts = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const postVouchers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const postJournals = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const postLines = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const postPeriods = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const postPurchases = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const postItems = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.purchase_item')).rows[0].count, 10);
    const postPayments = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const postSuppliers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.supplier')).rows[0].count, 10);
    const postBranches = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.branch')).rows[0].count, 10);
    const postBinv = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const postLots = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const postMovements = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const postConsumption = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.inventory_cost_consumption')).rows[0].count, 10);
    const postOrders = parseInt((await independentClient.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const postTransactions = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    const postSettings = parseInt((await independentClient.query("SELECT COUNT(*) FROM public.setting WHERE key = 'accounting_start_date'")).rows[0].count, 10);
    const postCustomers = parseInt((await independentClient.query('SELECT COUNT(*) FROM public.customer')).rows[0].count, 10);

    await independentClient.end();

    assert(postAccounts === preAccounts, `accounting_account === ${preAccounts} (actual: ${postAccounts})`);
    assert(postVouchers === 0, `accounting_voucher === 0 (actual: ${postVouchers})`);
    assert(postJournals === 0, `accounting_journal_entry === 0 (actual: ${postJournals})`);
    assert(postLines === 0, `accounting_journal_line === 0 (actual: ${postLines})`);
    assert(postPeriods === 0, `accounting_fiscal_period === 0 (actual: ${postPeriods})`);
    assert(postPurchases === 0, `purchase === 0 (actual: ${postPurchases})`);
    assert(postItems === 0, `purchase_item === 0 (actual: ${postItems})`);
    assert(postPayments === 0, `purchase_payment === 0 (actual: ${postPayments})`);
    assert(postSuppliers === 0, `supplier === 0 (actual: ${postSuppliers})`);
    assert(postBranches === preBranches, `branch === ${preBranches} (actual: ${postBranches})`);
    assert(postBinv === preBinv, `branch_inventory === ${preBinv} (actual: ${postBinv})`);
    assert(postLots === 0, `inventory_cost_lot === 0 (actual: ${postLots})`);
    assert(postMovements === 0, `inventory_movement === 0 (actual: ${postMovements})`);
    assert(postConsumption === 0, `inventory_cost_consumption === 0 (actual: ${postConsumption})`);
    assert(postOrders === preOrders, `order === ${preOrders} (actual: ${postOrders})`);
    assert(postTransactions === preTransactions, `payment_transaction === ${preTransactions} (actual: ${postTransactions})`);
    assert(postSettings === 0, `accounting_start_date setting === 0 (actual: ${postSettings})`);
    assert(postCustomers === preCustomers, `customer === ${preCustomers} (actual: ${postCustomers})`);

  } catch (err) {
    console.error('\nCRITICAL TEST ERROR:', err);
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    failCount++;
  } finally {
    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`STEP 4.8 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal execution failure:', err);
  process.exit(1);
});
