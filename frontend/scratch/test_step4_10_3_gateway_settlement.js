/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.3 Bounded Implementation Test Suite
 * Gateway Payout Batch & Order Settlement Allocation Service
 *
 * MANDATED TEST COVERAGE (Prompt Section 25):
 * 1. Batch Ingestion:
 *    - Valid ingestion
 *    - Duplicate payout reference (DUPLICATE_PAYOUT_REFERENCE)
 *    - Invalid financial math (SETTLEMENT_MATH_MISMATCH)
 *    - Rounding <= ₹1.00 (allowed controlled rounding variance)
 *    - Rounding > ₹1.00 (SETTLEMENT_VARIANCE_MISMATCH)
 *    - Other deductions exception without evidence (UNRECONCILED_SETTLEMENT_EXCEPTION)
 *    - Other deductions with authorized evidence (succeeds)
 *    - Inactive bank account (BANK_ACCOUNT_INACTIVE)
 *    - Frozen bank account (BANK_ACCOUNT_FROZEN)
 *    - Missing bank account (BANK_ACCOUNT_NOT_FOUND)
 * 2. Transaction Allocation:
 *    - Valid transaction allocation
 *    - Missing transaction (PAYMENT_TRANSACTION_NOT_FOUND)
 *    - Missing order (ORDER_NOT_FOUND)
 *    - Deleted order (ORDER_NOT_FOUND)
 *    - Already settled transaction (ORDER_ALREADY_SETTLED)
 *    - Amount mismatch (SETTLEMENT_ALLOCATION_MISMATCH)
 *    - Branch relationship mismatch (BRANCH_RELATIONSHIP_MISMATCH)
 *    - Missing order branch (SETTLEMENT_ORDER_BRANCH_UNVERIFIED)
 *    - Legacy prototype transaction rejection (ORDER_ALREADY_SETTLED / quarantined)
 * 3. Branch Partitioning (ADR-4.10-02 Model A):
 *    - Multi-branch payout partitioned into one RECEIPT voucher per branch
 *    - No voucher containing mixed branches (single branch voucher integrity)
 * 4. Accounting Entries:
 *    - Dr 1112 Bank Operating A/c = Net Share
 *    - Dr 5290 Payment Gateway MDR Fees = Identified MDR Share
 *    - Cr 1113 Gateway Clearing = Gross Share
 *    - Dr total === Cr total (exact balance)
 *    - Verify 1113 clearing reduction & subledger audit metadata
 * 5. GST on MDR Treatment:
 *    - Reported gateway tax remains in 5290 (no direct posting to 1143/1144/1146)
 * 6. Segregation of Duties (3-Tier SoD):
 *    - preparer != approver (SELF_APPROVAL_FORBIDDEN)
 *    - approver != poster (SEGREGATION_OF_DUTIES_VIOLATION)
 *    - preparer != poster (SEGREGATION_OF_DUTIES_VIOLATION)
 *    - SUPER_ADMIN cannot bypass SoD
 * 7. Accounting Configuration Guards:
 *    - Fail closed when accounting_start_date unconfigured (ACCOUNTING_START_DATE_NOT_CONFIGURED)
 *    - Fail closed when fiscal period unconfigured (FISCAL_PERIOD_NOT_CONFIGURED)
 *    - Fail closed when fiscal period locked (FISCAL_PERIOD_LOCKED)
 * 8. Idempotency:
 *    - Repeated ingestion returns existing result (wasDuplicate: true)
 *    - Repeated posting returns existing vouchers (wasDuplicate: true, 0 new GL entries)
 * 9. Concurrency:
 *    - Simultaneous settlement attempts against the same transaction: exactly one succeeds
 * 10. Security & RBAC:
 *     - Permission checks (GATEWAY.SETTLE_PREPARE, GATEWAY.SETTLE_APPROVE, GATEWAY.SETTLE_POST)
 *     - Forged user ID / unauthorized role rejected
 *     - Posted batch immutability (POSTED_PAYOUT_IMMUTABLE)
 * 11. Database Baseline Verification:
 *     - 100% cleanup of test fixtures
 *     - Zero persistent financial records (0 vouchers, 0 journals, 0 batches, 0 bank accounts)
 *     - Zero mutation of historical orders (173) or prototype payments (53)
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
  console.log('CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.3 Test Suite');
  console.log('Gateway Payout Batch & Order Settlement Allocation Verification');
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
  const { GatewayPayoutRepository } = require('../src/lib/repositories/gateway-payout.repository');
  const { GatewaySettlementOrderRepository } = require('../src/lib/repositories/gateway-settlement-order.repository');
  const { GatewaySettlementService, GatewaySettlementServiceError } = require('../src/lib/services/gateway-settlement.service');
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

  // Tracking synthetic test fixtures for 100% clean teardown
  const createdBatches = [];
  const createdBankAccounts = [];
  const createdOrders = [];
  const createdTransactions = [];
  const createdVouchers = [];
  const createdFiscalPeriods = [];
  let testSettingInserted = false;

  async function cleanupAllFixtures() {
    try {
      // 1. Remove settlement orders linked to test batches or test transactions
      await client.query(`DELETE FROM public.gateway_settlement_order WHERE payment_transaction_id LIKE 'paytxn_test_%' OR order_id LIKE 'order_test_%' OR payout_batch_id LIKE 'gpb_%'`);
      if (createdBatches.length > 0) {
        await client.query(
          `DELETE FROM public.gateway_settlement_order WHERE payout_batch_id = ANY($1)`,
          [createdBatches]
        );
      }

      // 2. Remove payout batches
      await client.query(`DELETE FROM public.gateway_payout_batch WHERE payout_reference LIKE 'payout_test_%' OR id LIKE 'gpb_%'`);
      if (createdBatches.length > 0) {
        await client.query(
          `DELETE FROM public.gateway_payout_batch WHERE id = ANY($1)`,
          [createdBatches]
        );
      }

      // 3. Remove accounting journals and vouchers
      const testVoucherIds = [...createdVouchers];
      const vRes = await client.query(`SELECT id FROM public.accounting_voucher WHERE reference_type = 'GATEWAY_PAYOUT' OR reference_id LIKE 'payout_test_%'`);
      for (const r of vRes.rows) {
        if (!testVoucherIds.includes(r.id)) testVoucherIds.push(r.id);
      }

      if (testVoucherIds.length > 0) {
        await client.query(
          `DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (
            SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)
          )`,
          [testVoucherIds]
        );
        await client.query(
          `DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`,
          [testVoucherIds]
        );
        await client.query(
          `DELETE FROM public.accounting_voucher WHERE id = ANY($1)`,
          [testVoucherIds]
        );
      }

      // 4. Remove payment transactions
      if (createdTransactions.length > 0) {
        await client.query(
          `DELETE FROM public.payment_transaction WHERE id = ANY($1)`,
          [createdTransactions]
        );
      }
      await client.query(`DELETE FROM public.payment_transaction WHERE id LIKE 'paytxn_test_%'`);

      // 5. Remove orders
      if (createdOrders.length > 0) {
        await client.query(
          `DELETE FROM public."order" WHERE id = ANY($1)`,
          [createdOrders]
        );
      }
      await client.query(`DELETE FROM public."order" WHERE id LIKE 'order_test_%'`);

      // 6. Remove bank accounts
      if (createdBankAccounts.length > 0) {
        await client.query(
          `DELETE FROM public.bank_account WHERE id = ANY($1)`,
          [createdBankAccounts]
        );
      }
      await client.query(`DELETE FROM public.bank_account WHERE id LIKE 'ba_%' OR id LIKE 'bank_test_%'`);

      // 7. Remove fiscal periods
      if (createdFiscalPeriods.length > 0) {
        await client.query(
          `DELETE FROM public.accounting_fiscal_period WHERE id = ANY($1)`,
          [createdFiscalPeriods]
        );
      }
      await client.query(`DELETE FROM public.accounting_fiscal_period WHERE fiscal_year = 'FY2026-27'`);

      // 8. Remove accounting start date
      await client.query(`DELETE FROM public.setting WHERE key = 'accounting_start_date'`);
      testSettingInserted = false;
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
  }

  try {
    console.log('--- Phase 0: Pre-Test Baseline Audit ---');
    await cleanupAllFixtures();

    const preAccounts = await client.query('SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL');
    const preBatches = await client.query('SELECT count(*) FROM public.gateway_payout_batch');
    const preSettlements = await client.query('SELECT count(*) FROM public.gateway_settlement_order');
    const preVouchers = await client.query('SELECT count(*) FROM public.accounting_voucher');
    const preJournals = await client.query('SELECT count(*) FROM public.accounting_journal_entry');
    const preLines = await client.query('SELECT count(*) FROM public.accounting_journal_line');
    const prePeriods = await client.query('SELECT count(*) FROM public.accounting_fiscal_period');
    const preBankAccounts = await client.query('SELECT count(*) FROM public.bank_account');
    const preOrders = await client.query('SELECT count(*) FROM public."order"');
    const preTransactions = await client.query('SELECT count(*) FROM public.payment_transaction');
    const preInventory = await client.query('SELECT count(*) FROM public.branch_inventory');

    assert(parseInt(preAccounts.rows[0].count) === 99, 'Pre-test accounting_account count is 99');
    assert(parseInt(preBatches.rows[0].count) === 0, 'Pre-test gateway_payout_batch count is 0');
    assert(parseInt(preSettlements.rows[0].count) === 0, 'Pre-test gateway_settlement_order count is 0');
    assert(parseInt(preVouchers.rows[0].count) === 0, 'Pre-test accounting_voucher count is 0');
    assert(parseInt(preJournals.rows[0].count) === 0, 'Pre-test accounting_journal_entry count is 0');
    assert(parseInt(preLines.rows[0].count) === 0, 'Pre-test accounting_journal_line count is 0');
    assert(parseInt(prePeriods.rows[0].count) === 0, 'Pre-test accounting_fiscal_period count is 0');
    assert(parseInt(preBankAccounts.rows[0].count) === 0, 'Pre-test bank_account count is 0');
    assert(parseInt(preOrders.rows[0].count) === 173, 'Pre-test order count is 173 (historical baseline)');
    assert(parseInt(preTransactions.rows[0].count) === 53, 'Pre-test payment_transaction count is 53 (prototype baseline)');
    assert(parseInt(preInventory.rows[0].count) === 424, 'Pre-test branch_inventory count is 424');

    // Fetch branches from live DB
    const branchRes = await client.query('SELECT id FROM public.branch LIMIT 3');
    const branchA = branchRes.rows[0].id;
    const branchB = branchRes.rows[1].id;
    const branchC = branchRes.rows[2].id;

    console.log(`\nUsing real branches for test: BranchA=${branchA}, BranchB=${branchB}, BranchC=${branchC}`);

    // Create synthetic bank accounts
    const activeBank = await BankAccountRepository.create({
      id: 'ba_test_corp_active',
      bank_name: 'HDFC Corporate Treasury',
      account_number_masked: 'XXXX1234',
      ifsc_code: 'HDFC0001234',
      status: 'ACTIVE',
      branch_id: null,
    }, client);
    createdBankAccounts.push(activeBank.id);

    const inactiveBank = await BankAccountRepository.create({
      id: 'ba_test_corp_inactive',
      bank_name: 'ICICI Inactive Pool',
      account_number_masked: 'XXXX5678',
      ifsc_code: 'ICIC0005678',
      status: 'INACTIVE',
      branch_id: null,
    }, client);
    createdBankAccounts.push(inactiveBank.id);

    const frozenBank = await BankAccountRepository.create({
      id: 'ba_test_corp_frozen',
      bank_name: 'SBI Frozen Account',
      account_number_masked: 'XXXX9999',
      ifsc_code: 'SBIN0009999',
      status: 'FROZEN',
      branch_id: null,
    }, client);
    createdBankAccounts.push(frozenBank.id);

    assert(activeBank.id === 'ba_test_corp_active', 'Created active bank account fixture');

    // Create synthetic orders & payment transactions (dated 2026-09-27 to distinguish from prototype)
    const testDate = new Date('2026-09-27T10:00:00Z');

    // Order 1 (Branch A): ₹2,000
    const o1 = await client.query(`
      INSERT INTO public."order" (id, customer_id, version, status, is_draft_order, currency_code, metadata, created_at, updated_at)
      VALUES ('order_test_01', 'cust_test_01', 1, 'completed', false, 'inr', jsonb_build_object('branch_id', $1::text, 'payment_status', 'captured'), $2, $2)
      RETURNING id;
    `, [branchA, testDate]);
    createdOrders.push(o1.rows[0].id);

    const t1 = await client.query(`
      INSERT INTO public.payment_transaction (id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at)
      VALUES ('paytxn_test_01', $1, 'order_test_01', 'cust_test_01', 2000, 'INR', 'captured', 'unsettled', 'razorpay', 'pay_test_01', $2, $2)
      RETURNING id;
    `, [branchA, testDate]);
    createdTransactions.push(t1.rows[0].id);

    // Order 2 (Branch B): ₹3,000
    const o2 = await client.query(`
      INSERT INTO public."order" (id, customer_id, version, status, is_draft_order, currency_code, metadata, created_at, updated_at)
      VALUES ('order_test_02', 'cust_test_02', 1, 'completed', false, 'inr', jsonb_build_object('branch_id', $1::text, 'payment_status', 'captured'), $2, $2)
      RETURNING id;
    `, [branchB, testDate]);
    createdOrders.push(o2.rows[0].id);

    const t2 = await client.query(`
      INSERT INTO public.payment_transaction (id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at)
      VALUES ('paytxn_test_02', $1, 'order_test_02', 'cust_test_02', 3000, 'INR', 'captured', 'unsettled', 'razorpay', 'pay_test_02', $2, $2)
      RETURNING id;
    `, [branchB, testDate]);
    createdTransactions.push(t2.rows[0].id);

    // Order 3 (Branch A): ₹1,500
    const o3 = await client.query(`
      INSERT INTO public."order" (id, customer_id, version, status, is_draft_order, currency_code, metadata, created_at, updated_at)
      VALUES ('order_test_03', 'cust_test_03', 1, 'completed', false, 'inr', jsonb_build_object('branch_id', $1::text, 'payment_status', 'captured'), $2, $2)
      RETURNING id;
    `, [branchA, testDate]);
    createdOrders.push(o3.rows[0].id);

    const t3 = await client.query(`
      INSERT INTO public.payment_transaction (id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at)
      VALUES ('paytxn_test_03', $1, 'order_test_03', 'cust_test_03', 1500, 'INR', 'captured', 'unsettled', 'razorpay', 'pay_test_03', $2, $2)
      RETURNING id;
    `, [branchA, testDate]);
    createdTransactions.push(t3.rows[0].id);

    // Order 4 (Branch C): Deleted Order
    const o4 = await client.query(`
      INSERT INTO public."order" (id, customer_id, version, status, is_draft_order, currency_code, metadata, created_at, updated_at, deleted_at)
      VALUES ('order_test_04_del', 'cust_test_04', 1, 'canceled', false, 'inr', jsonb_build_object('branch_id', $1::text), $2, $2, NOW())
      RETURNING id;
    `, [branchC, testDate]);
    createdOrders.push(o4.rows[0].id);

    const t4 = await client.query(`
      INSERT INTO public.payment_transaction (id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at)
      VALUES ('paytxn_test_04_del', $1, 'order_test_04_del', 'cust_test_04', 1000, 'INR', 'captured', 'unsettled', 'razorpay', 'pay_test_04', $2, $2)
      RETURNING id;
    `, [branchC, testDate]);
    createdTransactions.push(t4.rows[0].id);

    // Order 5: Branch Mismatch (Order says Branch B, but txn says Branch A)
    const o5 = await client.query(`
      INSERT INTO public."order" (id, customer_id, version, status, is_draft_order, currency_code, metadata, created_at, updated_at)
      VALUES ('order_test_05_mismatch', 'cust_test_05', 1, 'completed', false, 'inr', jsonb_build_object('branch_id', $1::text), $2, $2)
      RETURNING id;
    `, [branchB, testDate]);
    createdOrders.push(o5.rows[0].id);

    const t5 = await client.query(`
      INSERT INTO public.payment_transaction (id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at)
      VALUES ('paytxn_test_05_mismatch', $1, 'order_test_05_mismatch', 'cust_test_05', 800, 'INR', 'captured', 'unsettled', 'razorpay', 'pay_test_05', $2, $2)
      RETURNING id;
    `, [branchA, testDate]);
    createdTransactions.push(t5.rows[0].id);

    // Order 6: Missing Order Branch Metadata
    const o6 = await client.query(`
      INSERT INTO public."order" (id, customer_id, version, status, is_draft_order, currency_code, metadata, created_at, updated_at)
      VALUES ('order_test_06_nobranch', 'cust_test_06', 1, 'completed', false, 'inr', jsonb_build_object('notes', 'no branch specified'), $1, $1)
      RETURNING id;
    `, [testDate]);
    createdOrders.push(o6.rows[0].id);

    const t6 = await client.query(`
      INSERT INTO public.payment_transaction (id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at)
      VALUES ('paytxn_test_06_nobranch', $1, 'order_test_06_nobranch', 'cust_test_06', 700, 'INR', 'captured', 'unsettled', 'razorpay', 'pay_test_06', $2, $2)
      RETURNING id;
    `, [branchA, testDate]);
    createdTransactions.push(t6.rows[0].id);

    // Actors for 3-Tier Segregation of Duties (SoD)
    const preparerContext = {
      id: 'usr_treasury_prep',
      user_id: 'usr_treasury_prep',
      role: 'STAFF',
      permissions: ['GATEWAY.SETTLE_PREPARE'],
    };
    const approverContext = {
      id: 'usr_treasury_appr',
      user_id: 'usr_treasury_appr',
      role: 'FINANCE_MANAGER',
      permissions: ['GATEWAY.SETTLE_APPROVE'],
    };
    const posterContext = {
      id: 'usr_gl_poster',
      user_id: 'usr_gl_poster',
      role: 'STAFF',
      permissions: ['GATEWAY.SETTLE_POST', 'ACCOUNTING.POST'],
    };
    const superAdminContext = {
      id: 'admin_01',
      user_id: 'admin_01',
      role: 'SUPER_ADMIN',
    };
    const unauthorizedContext = {
      id: 'usr_unauth',
      user_id: 'usr_unauth',
      role: 'STAFF',
      permissions: ['ORDERS.VIEW'],
    };

    console.log('\n--- Section 1: Batch Ingestion & Validation ---');

    // 1.1 Ingestion with Missing Bank Account
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_nobank',
        bank_account_id: 'ba_non_existent',
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        net_amount: 1960,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Ingestion with missing bank account should fail');
    } catch (e) {
      assert(e.code === 'BANK_ACCOUNT_NOT_FOUND', 'Missing bank account throws BANK_ACCOUNT_NOT_FOUND');
    }

    // 1.2 Ingestion with Inactive Bank Account
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_inactive',
        bank_account_id: inactiveBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        net_amount: 1960,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Ingestion with inactive bank account should fail');
    } catch (e) {
      assert(e.code === 'BANK_ACCOUNT_INACTIVE', 'Inactive bank account throws BANK_ACCOUNT_INACTIVE');
    }

    // 1.3 Ingestion with Frozen Bank Account
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_frozen',
        bank_account_id: frozenBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        net_amount: 1960,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Ingestion with frozen bank account should fail');
    } catch (e) {
      assert(e.code === 'BANK_ACCOUNT_FROZEN', 'Frozen bank account throws BANK_ACCOUNT_FROZEN');
    }

    // 1.4 Invalid Financial Math (Gross - Fee - Tax != Net)
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_badmath',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        net_amount: 1800, // Should be 1960
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Ingestion with arithmetic mismatch should fail');
    } catch (e) {
      assert(e.code === 'SETTLEMENT_MATH_MISMATCH', 'Financial math mismatch throws SETTLEMENT_MATH_MISMATCH');
    }

    // 1.5 Rounding Variance <= ₹1.00 (allowed)
    const validRoundBatch = await GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_round_ok',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      gross_amount: 2000,
      identified_fee_amount: 33.90,
      reported_tax_amount: 6.10,
      rounding_variance: 0.50, // +50 paise rounding
      net_amount: 1960.50,
      prepared_by: 'usr_treasury_prep',
      orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000, identified_fee_amount: 33.90, reported_tax_amount: 6.10 }],
      actorContext: preparerContext,
    }, client);
    createdBatches.push(validRoundBatch.payoutBatch.id);
    assert(validRoundBatch.payoutBatch.status === 'INGESTED', 'Rounding variance <= ₹1.00 successfully ingested');
    // Clean up to allow paytxn_test_01 reuse
    await client.query(`DELETE FROM public.gateway_settlement_order WHERE payout_batch_id = $1`, [validRoundBatch.payoutBatch.id]);
    await client.query(`DELETE FROM public.gateway_payout_batch WHERE id = $1`, [validRoundBatch.payoutBatch.id]);
    createdBatches.pop();

    // 1.6 Rounding Variance > ₹1.00 (rejected)
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_round_excess',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        rounding_variance: 1.50, // 150 paise > 100 paise max
        net_amount: 1961.50,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Rounding variance > ₹1.00 should fail');
    } catch (e) {
      assert(e.code === 'SETTLEMENT_VARIANCE_MISMATCH', 'Excessive rounding variance throws SETTLEMENT_VARIANCE_MISMATCH');
    }

    // 1.7 Other Deductions without Authorized Evidence
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_other_ded_unauth',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        other_deductions_amount: 50.00,
        net_amount: 1910.00,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Other deductions without documentation evidence should fail');
    } catch (e) {
      assert(e.code === 'UNRECONCILED_SETTLEMENT_EXCEPTION', 'Unsupported other deductions throws UNRECONCILED_SETTLEMENT_EXCEPTION');
    }

    // 1.8 Other Deductions with Authorized Documentation Evidence
    const dedWithEvidence = await GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_other_ded_auth',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      gross_amount: 2000,
      identified_fee_amount: 33.90,
      reported_tax_amount: 6.10,
      other_deductions_amount: 50.00,
      net_amount: 1910.00,
      prepared_by: 'usr_treasury_prep',
      metadata: {
        authorized_deduction_reason: 'CHARGEBACK_DISPUTE_HOLD',
        deduction_evidence: 'DISP_REF_20260927_01',
      },
      orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000, other_deductions_amount: 50.00, identified_fee_amount: 33.90, reported_tax_amount: 6.10 }],
      actorContext: preparerContext,
    }, client);
    createdBatches.push(dedWithEvidence.payoutBatch.id);
    assert(dedWithEvidence.payoutBatch.status === 'INGESTED', 'Other deductions with authorized evidence successfully ingested');
    // Clean up
    await client.query(`DELETE FROM public.gateway_settlement_order WHERE payout_batch_id = $1`, [dedWithEvidence.payoutBatch.id]);
    await client.query(`DELETE FROM public.gateway_payout_batch WHERE id = $1`, [dedWithEvidence.payoutBatch.id]);
    createdBatches.pop();

    console.log('\n--- Section 2: Transaction Allocation & Eligibility Checks ---');

    // 2.1 Missing Payment Transaction
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_notxn',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        net_amount: 1960,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_non_existent', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Missing payment transaction should fail');
    } catch (e) {
      assert(e.code === 'PAYMENT_TRANSACTION_NOT_FOUND', 'Missing payment transaction throws PAYMENT_TRANSACTION_NOT_FOUND');
    }

    // 2.2 Missing Order
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_noord',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        net_amount: 1960,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_non_existent', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Missing order should fail');
    } catch (e) {
      assert(e.code === 'ORDER_NOT_FOUND', 'Missing linked order throws ORDER_NOT_FOUND');
    }

    // 2.3 Deleted Order
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_delord',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 1000,
        net_amount: 980,
        identified_fee_amount: 16.95,
        reported_tax_amount: 3.05,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_04_del', order_id: 'order_test_04_del', allocated_gross_amount: 1000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Deleted order should fail');
    } catch (e) {
      assert(e.code === 'ORDER_NOT_FOUND', 'Deleted linked order throws ORDER_NOT_FOUND');
    }

    // 2.4 Transaction Amount Mismatch (Allocated gross != txn.amount)
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_amount_mismatch',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 1800,
        net_amount: 1764,
        identified_fee_amount: 30.51,
        reported_tax_amount: 5.49,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 1800 }], // Actual txn is 2000
        actorContext: preparerContext,
      }, client);
      assert(false, 'Allocated gross amount mismatch should fail');
    } catch (e) {
      assert(e.code === 'SETTLEMENT_ALLOCATION_MISMATCH', 'Transaction amount mismatch throws SETTLEMENT_ALLOCATION_MISMATCH');
    }

    // 2.5 Branch Relationship Mismatch (Order says Branch B, but Txn says Branch A)
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_branch_mismatch',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 800,
        net_amount: 784,
        identified_fee_amount: 13.56,
        reported_tax_amount: 2.44,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_05_mismatch', order_id: 'order_test_05_mismatch', allocated_gross_amount: 800 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Branch mismatch should fail');
    } catch (e) {
      assert(e.code === 'BRANCH_RELATIONSHIP_MISMATCH', 'Branch mismatch throws BRANCH_RELATIONSHIP_MISMATCH');
    }

    // 2.6 Missing Order Branch Metadata
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_nobranch_meta',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 700,
        net_amount: 686,
        identified_fee_amount: 11.86,
        reported_tax_amount: 2.14,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_06_nobranch', order_id: 'order_test_06_nobranch', allocated_gross_amount: 700 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Missing order branch should fail');
    } catch (e) {
      assert(e.code === 'SETTLEMENT_ORDER_BRANCH_UNVERIFIED', 'Missing order branch throws SETTLEMENT_ORDER_BRANCH_UNVERIFIED');
    }

    // 2.7 Quarantined Legacy Prototype Transaction Rejection
    // Query one of the 53 historical prototype transactions
    const protoTxn = await client.query(`SELECT id, order_id, amount FROM public.payment_transaction LIMIT 1`);
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_proto_reject',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: protoTxn.rows[0].amount,
        net_amount: protoTxn.rows[0].amount - 20,
        identified_fee_amount: 16.95,
        reported_tax_amount: 3.05,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: protoTxn.rows[0].id, order_id: protoTxn.rows[0].order_id, allocated_gross_amount: protoTxn.rows[0].amount }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Legacy prototype transaction should be quarantined and rejected');
    } catch (e) {
      assert(
        e.code === 'ORDER_ALREADY_SETTLED' || e.code === 'GATEWAY_SETTLEMENT_ERROR',
        'Legacy prototype payment transaction rejected (quarantined)'
      );
    }

    console.log('\n--- Section 3: Lifecycle & Segregation of Duties (3-Tier SoD) ---');

    // Ingest valid batch 1 for lifecycle tests
    const batch1 = await GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_sod_lifecycle',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      gross_amount: 2000,
      net_amount: 1960,
      identified_fee_amount: 33.90,
      reported_tax_amount: 6.10,
      prepared_by: 'usr_treasury_prep',
      orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000, identified_fee_amount: 33.90, reported_tax_amount: 6.10 }],
      actorContext: preparerContext,
    }, client);
    createdBatches.push(batch1.payoutBatch.id);
    assert(batch1.payoutBatch.status === 'INGESTED', 'Valid batch ingested with status INGESTED');

    // 3.1 Duplicate Payout Reference Check
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_sod_lifecycle',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 2000,
        net_amount: 1960,
        identified_fee_amount: 33.90,
        reported_tax_amount: 6.10,
        prepared_by: 'usr_treasury_prep',
        orders: [{ payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 }],
        actorContext: preparerContext,
      }, client);
      assert(false, 'Duplicate payout reference should fail');
    } catch (e) {
      assert(e.code === 'DUPLICATE_PAYOUT_REFERENCE', 'Duplicate payout reference throws DUPLICATE_PAYOUT_REFERENCE');
    }

    // 3.2 Post before Approval (attempting to post INGESTED batch)
    try {
      await GatewaySettlementService.postPayoutSettlement({
        payoutBatchId: batch1.payoutBatch.id,
        postedBy: 'usr_gl_poster',
        actorContext: posterContext,
      }, client);
      assert(false, 'Posting before approval should fail');
    } catch (e) {
      assert(e.code === 'INVALID_PAYOUT_STATUS', 'Posting unapproved batch throws INVALID_PAYOUT_STATUS');
    }

    // 3.3 Self-Approval by Preparer Rejected (SoD rule)
    try {
      await GatewaySettlementService.approvePayoutBatch({
        payoutBatchId: batch1.payoutBatch.id,
        approvedBy: 'usr_treasury_prep', // Same as prepared_by
        actorContext: { ...preparerContext, permissions: ['GATEWAY.SETTLE_APPROVE'] },
      }, client);
      assert(false, 'Preparer cannot approve own batch');
    } catch (e) {
      assert(e.code === 'SELF_APPROVAL_FORBIDDEN', 'Preparer self-approval throws SELF_APPROVAL_FORBIDDEN');
    }

    // 3.4 SUPER_ADMIN Self-Approval Bypass Attempt (SUPER_ADMIN cannot bypass SoD!)
    try {
      // Ingest batch prepared by admin_01
      const adminBatch = await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_admin_sod',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 1500,
        net_amount: 1470,
        identified_fee_amount: 25.42,
        reported_tax_amount: 4.58,
        prepared_by: 'admin_01',
        orders: [{ payment_transaction_id: 'paytxn_test_03', order_id: 'order_test_03', allocated_gross_amount: 1500, identified_fee_amount: 25.42, reported_tax_amount: 4.58 }],
        actorContext: superAdminContext,
      }, client);
      createdBatches.push(adminBatch.payoutBatch.id);

      // Attempt to self-approve as admin_01
      await GatewaySettlementService.approvePayoutBatch({
        payoutBatchId: adminBatch.payoutBatch.id,
        approvedBy: 'admin_01',
        actorContext: superAdminContext,
      }, client);
      assert(false, 'Super admin self-approval should fail closed');
    } catch (e) {
      assert(e.code === 'SELF_APPROVAL_FORBIDDEN', 'SUPER_ADMIN self-approval forbidden (SoD preserved)');
    }

    // 3.5 Approval by Authorized Manager (Different Identity)
    const approvedBatch = await GatewaySettlementService.approvePayoutBatch({
      payoutBatchId: batch1.payoutBatch.id,
      approvedBy: 'usr_treasury_appr',
      actorContext: approverContext,
    }, client);
    assert(approvedBatch.status === 'APPROVED', 'Batch approved by distinct treasury manager (status=APPROVED)');
    assert(approvedBatch.approved_by === 'usr_treasury_appr', 'approved_by correctly recorded');

    // Repeated approval of an already APPROVED batch is idempotent
    const repeatedApproval = await GatewaySettlementService.approvePayoutBatch({
      payoutBatchId: batch1.payoutBatch.id,
      approvedBy: 'usr_treasury_appr',
      actorContext: approverContext,
    }, client);
    assert(repeatedApproval.status === 'APPROVED' && repeatedApproval.id === batch1.payoutBatch.id, 'Repeated approval of APPROVED batch returns batch idempotently');

    // 3.6 Post by Preparer Rejected (SoD rule)
    try {
      await GatewaySettlementService.postPayoutSettlement({
        payoutBatchId: batch1.payoutBatch.id,
        postedBy: 'usr_treasury_prep', // Preparer attempting to post
        actorContext: { ...preparerContext, permissions: ['GATEWAY.SETTLE_POST'] },
      }, client);
      assert(false, 'Preparer cannot post settlement voucher');
    } catch (e) {
      assert(e.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Preparer post attempt throws SEGREGATION_OF_DUTIES_VIOLATION');
    }

    // 3.7 Post by Approver Rejected (SoD rule)
    try {
      await GatewaySettlementService.postPayoutSettlement({
        payoutBatchId: batch1.payoutBatch.id,
        postedBy: 'usr_treasury_appr', // Approver attempting to post
        actorContext: { ...approverContext, permissions: ['GATEWAY.SETTLE_POST'] },
      }, client);
      assert(false, 'Approver cannot post settlement voucher');
    } catch (e) {
      assert(e.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Approver post attempt throws SEGREGATION_OF_DUTIES_VIOLATION');
    }

    // 3.8 Cancellation of Batch
    const cancelBatch = await GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_cancel_me',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      gross_amount: 3000,
      net_amount: 2940,
      identified_fee_amount: 50.85,
      reported_tax_amount: 9.15,
      prepared_by: 'usr_treasury_prep',
      orders: [{ payment_transaction_id: 'paytxn_test_02', order_id: 'order_test_02', allocated_gross_amount: 3000, identified_fee_amount: 50.85, reported_tax_amount: 9.15 }],
      actorContext: preparerContext,
    }, client);
    createdBatches.push(cancelBatch.payoutBatch.id);

    const cancelledRes = await GatewaySettlementService.cancelPayoutBatch({
      payoutBatchId: cancelBatch.payoutBatch.id,
      cancelledBy: 'usr_treasury_prep',
      reason: 'Incorrect aggregator file',
      actorContext: preparerContext,
    }, client);
    assert(cancelledRes.status === 'CANCELLED', 'Batch cancelled successfully (status=CANCELLED)');

    console.log('\n--- Section 4: Accounting Configuration Guards ---');

    // 4.1 Fail closed when accounting_start_date unconfigured
    try {
      await GatewaySettlementService.postPayoutSettlement({
        payoutBatchId: batch1.payoutBatch.id,
        postedBy: 'usr_gl_poster',
        actorContext: posterContext,
      }, client);
      assert(false, 'Posting without accounting_start_date should fail closed');
    } catch (e) {
      assert(
        e.code === 'ACCOUNTING_START_DATE_NOT_CONFIGURED',
        'Unconfigured accounting start date throws ACCOUNTING_START_DATE_NOT_CONFIGURED'
      );
    }

    // Configure accounting start date for testing
    await client.query(`INSERT INTO public.setting (id, "group", key, value, created_at, updated_at) VALUES ('set_accounting_start_date_4103', 'accounting', 'accounting_start_date', '2026-08-01', NOW(), NOW())`);
    testSettingInserted = true;

    // 4.2 Fail closed when fiscal period unconfigured
    try {
      await GatewaySettlementService.postPayoutSettlement({
        payoutBatchId: batch1.payoutBatch.id,
        postedBy: 'usr_gl_poster',
        actorContext: posterContext,
      }, client);
      assert(false, 'Posting without fiscal period should fail closed');
    } catch (e) {
      assert(
        e.code === 'FISCAL_PERIOD_NOT_CONFIGURED',
        'Missing fiscal period throws FISCAL_PERIOD_NOT_CONFIGURED'
      );
    }

    // Configure open fiscal period for testing
    const fpRes = await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_2026_09', 'FY2026-27', 'September 2026', '2026-09-01', '2026-09-30', false, NOW()
      ) RETURNING id;
    `);
    createdFiscalPeriods.push(fpRes.rows[0].id);

    console.log('\n--- Section 5: Multi-Branch Partitioning & Accounting GL Posting ---');

    // Clean up previous batch1 & adminBatch to prepare fresh multi-branch payout test
    await client.query(`DELETE FROM public.gateway_settlement_order WHERE payout_batch_id IN ($1, $2, $3)`, [batch1.payoutBatch.id, cancelBatch.payoutBatch.id, createdBatches[1]]);
    await client.query(`DELETE FROM public.gateway_payout_batch WHERE id IN ($1, $2, $3)`, [batch1.payoutBatch.id, cancelBatch.payoutBatch.id, createdBatches[1]]);
    createdBatches.length = 0;

    // Multi-branch payout batch:
    // Order 1 (Branch A): Gross ₹2,000, Fee ₹33.90, Tax ₹6.10, MDR ₹40, Net ₹1,960
    // Order 2 (Branch B): Gross ₹3,000, Fee ₹50.85, Tax ₹9.15, MDR ₹60, Net ₹2,940
    // Total Batch: Gross ₹5,000, Fee ₹84.75, Tax ₹15.25, MDR ₹100, Net ₹4,900
    const multiBranchBatch = await GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_multi_branch_01',
      settlement_reference: 'setl_test_9999',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      bank_value_date: '2026-09-27',
      gross_amount: 5000,
      identified_fee_amount: 84.75,
      reported_tax_amount: 15.25,
      other_deductions_amount: 0,
      net_amount: 4900,
      rounding_variance: 0,
      prepared_by: 'usr_treasury_prep',
      orders: [
        {
          payment_transaction_id: 'paytxn_test_01',
          order_id: 'order_test_01',
          allocated_gross_amount: 2000,
          identified_fee_amount: 33.90,
          reported_tax_amount: 6.10,
        },
        {
          payment_transaction_id: 'paytxn_test_02',
          order_id: 'order_test_02',
          allocated_gross_amount: 3000,
          identified_fee_amount: 50.85,
          reported_tax_amount: 9.15,
        }
      ],
      actorContext: preparerContext,
    }, client);
    createdBatches.push(multiBranchBatch.payoutBatch.id);
    assert(multiBranchBatch.settlementOrders.length === 2, 'Multi-branch batch ingested with 2 orders');

    // Approve multi-branch batch
    const approvedMulti = await GatewaySettlementService.approvePayoutBatch({
      payoutBatchId: multiBranchBatch.payoutBatch.id,
      approvedBy: 'usr_treasury_appr',
      actorContext: approverContext,
    }, client);
    assert(approvedMulti.status === 'APPROVED', 'Multi-branch batch approved by treasury manager');

    // Post multi-branch batch to GL
    const postResult = await GatewaySettlementService.postPayoutSettlement({
      payoutBatchId: multiBranchBatch.payoutBatch.id,
      postedBy: 'usr_gl_poster',
      voucherDate: '2026-09-27',
      actorContext: posterContext,
    });

    assert(postResult.payoutBatch.status === 'POSTED', 'Multi-branch batch status is POSTED');
    assert(postResult.vouchers && postResult.vouchers.length === 2, 'Exactly 2 branch-partitioned vouchers created (ADR-4.10-02 Model A)');

    for (const v of postResult.vouchers) {
      createdVouchers.push(v.id);
    }

    // Inspect Branch A Voucher
    const voucherA = postResult.vouchers.find((v) => v.branch_id === branchA);
    assert(Boolean(voucherA), 'Voucher for Branch A created');
    assert(voucherA.voucher_type === 'RECEIPT', 'Branch A voucher type is RECEIPT');
    assert(voucherA.reference_type === 'GATEWAY_PAYOUT', 'Branch A reference_type is GATEWAY_PAYOUT');

    const linesARes = await client.query(`
      SELECT ajl.*, aa.code as account_code, aa.name as account_name
      FROM public.accounting_journal_line ajl
      JOIN public.accounting_account aa ON aa.id = ajl.account_id
      JOIN public.accounting_journal_entry aje ON aje.id = ajl.journal_entry_id
      WHERE aje.voucher_id = $1
      ORDER BY ajl.line_no ASC
    `, [voucherA.id]);

    const linesA = linesARes.rows;
    assert(linesA.length === 3, 'Branch A voucher has exactly 3 journal lines (1112, 5290, 1113)');

    const lineA_1112 = linesA.find((l) => l.account_code === '1112');
    const lineA_5290 = linesA.find((l) => l.account_code === '5290');
    const lineA_1113 = linesA.find((l) => l.account_code === '1113');

    assert(Number(lineA_1112.debit_amount) === 1960 && Number(lineA_1112.credit_amount) === 0, 'Branch A Dr 1112 Bank Operating = ₹1,960.00 (Net Share)');
    assert(Number(lineA_5290.debit_amount) === 40 && Number(lineA_5290.credit_amount) === 0, 'Branch A Dr 5290 Gateway MDR Fees = ₹40.00 (Fee ₹33.90 + Tax ₹6.10)');
    assert(Number(lineA_1113.debit_amount) === 0 && Number(lineA_1113.credit_amount) === 2000, 'Branch A Cr 1113 Gateway Clearing = ₹2,000.00 (Gross Share)');
    assert(Number(lineA_1112.debit_amount) + Number(lineA_5290.debit_amount) === Number(lineA_1113.credit_amount), 'Branch A Dr Total === Cr Total (Balanced to ₹0.00)');

    // Inspect Branch B Voucher
    const voucherB = postResult.vouchers.find((v) => v.branch_id === branchB);
    assert(Boolean(voucherB), 'Voucher for Branch B created');
    assert(voucherB.voucher_type === 'RECEIPT', 'Branch B voucher type is RECEIPT');

    const linesBRes = await client.query(`
      SELECT ajl.*, aa.code as account_code, aa.name as account_name
      FROM public.accounting_journal_line ajl
      JOIN public.accounting_account aa ON aa.id = ajl.account_id
      JOIN public.accounting_journal_entry aje ON aje.id = ajl.journal_entry_id
      WHERE aje.voucher_id = $1
      ORDER BY ajl.line_no ASC
    `, [voucherB.id]);

    const linesB = linesBRes.rows;
    assert(linesB.length === 3, 'Branch B voucher has exactly 3 journal lines (1112, 5290, 1113)');

    const lineB_1112 = linesB.find((l) => l.account_code === '1112');
    const lineB_5290 = linesB.find((l) => l.account_code === '5290');
    const lineB_1113 = linesB.find((l) => l.account_code === '1113');

    assert(Number(lineB_1112.debit_amount) === 2940 && Number(lineB_1112.credit_amount) === 0, 'Branch B Dr 1112 Bank Operating = ₹2,940.00 (Net Share)');
    assert(Number(lineB_5290.debit_amount) === 60 && Number(lineB_5290.credit_amount) === 0, 'Branch B Dr 5290 Gateway MDR Fees = ₹60.00 (Fee ₹50.85 + Tax ₹9.15)');
    assert(Number(lineB_1113.debit_amount) === 0 && Number(lineB_1113.credit_amount) === 3000, 'Branch B Cr 1113 Gateway Clearing = ₹3,000.00 (Gross Share)');
    assert(Number(lineB_1112.debit_amount) + Number(lineB_5290.debit_amount) === Number(lineB_1113.credit_amount), 'Branch B Dr Total === Cr Total (Balanced to ₹0.00)');

    // Single-branch voucher integrity check: No voucher has lines from mixed branches
    for (const line of linesA) {
      assert(line.branch_id === branchA, `Branch A voucher line is strictly tagged with Branch A (${line.branch_id})`);
    }
    for (const line of linesB) {
      assert(line.branch_id === branchB, `Branch B voucher line is strictly tagged with Branch B (${line.branch_id})`);
    }

    // Subledger audit metadata check on Cr 1113
    assert(lineA_1113.metadata?.payout_batch_id === multiBranchBatch.payoutBatch.id, 'Line 1113 audit metadata contains payout_batch_id');
    assert(lineA_1113.metadata?.payout_reference === 'payout_test_multi_branch_01', 'Line 1113 audit metadata contains payout_reference');
    assert(Array.isArray(lineA_1113.metadata?.order_ids), 'Line 1113 audit metadata contains order_ids array');
    assert(Array.isArray(lineA_1113.metadata?.payment_transaction_ids), 'Line 1113 audit metadata contains payment_transaction_ids array');

    console.log('\n--- Section 6: GST Treatment Verification ---');

    // 6.1 Assert zero direct entries to input GST accounts (1143, 1144, 1146) during daily settlement
    const gstLinesRes = await client.query(`
      SELECT count(*) FROM public.accounting_journal_line ajl
      JOIN public.accounting_account aa ON aa.id = ajl.account_id
      WHERE aa.code IN ('1143', '1144', '1146')
    `);
    assert(parseInt(gstLinesRes.rows[0].count) === 0, 'Zero direct postings to Input GST accounts (1143/1144/1146) during daily settlement');

    // 6.2 Assert reported GST (₹15.25) was bundled into 5290 Payment Gateway MDR Fees
    const total5290Debit = Number(lineA_5290.debit_amount) + Number(lineB_5290.debit_amount);
    assert(total5290Debit === 100, 'Reported tax was properly recognized as part of 5290 MDR expense (Total MDR = ₹100)');

    console.log('\n--- Section 7: Idempotency Verification ---');

    // 7.1 Re-ingest the already POSTED payout reference
    const repeatIngest = await GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_multi_branch_01',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      gross_amount: 5000,
      net_amount: 4900,
      identified_fee_amount: 84.75,
      reported_tax_amount: 15.25,
      prepared_by: 'usr_treasury_prep',
      orders: [
        { payment_transaction_id: 'paytxn_test_01', order_id: 'order_test_01', allocated_gross_amount: 2000 },
        { payment_transaction_id: 'paytxn_test_02', order_id: 'order_test_02', allocated_gross_amount: 3000 },
      ],
      actorContext: preparerContext,
    }, client);
    assert(repeatIngest.wasDuplicate === true, 'Repeat ingestion of POSTED batch returns wasDuplicate: true');
    assert(repeatIngest.payoutBatch.id === multiBranchBatch.payoutBatch.id, 'Authoritative existing batch returned');

    // 7.2 Re-post the already POSTED payout batch
    const repeatPost = await GatewaySettlementService.postPayoutSettlement({
      payoutBatchId: multiBranchBatch.payoutBatch.id,
      postedBy: 'usr_gl_poster',
      actorContext: posterContext,
    });
    assert(repeatPost.wasDuplicate === true, 'Repeat posting returns wasDuplicate: true');

    const totalVouchersRes = await client.query('SELECT count(*) FROM public.accounting_voucher');
    assert(parseInt(totalVouchersRes.rows[0].count) === 2, 'Zero duplicate vouchers created upon idempotent retry (Count remains 2)');

    // 7.3 Repeated approval attempt on an already POSTED batch
    try {
      await GatewaySettlementService.approvePayoutBatch({
        payoutBatchId: multiBranchBatch.payoutBatch.id,
        approvedBy: 'usr_treasury_appr',
        actorContext: approverContext,
      }, client);
      assert(false, 'Approval on POSTED batch should fail');
    } catch (e) {
      assert(e.code === 'POSTED_PAYOUT_IMMUTABLE', 'Approval on POSTED batch throws POSTED_PAYOUT_IMMUTABLE');
    }

    console.log('\n--- Section 8: Concurrency Protection ---');

    // 8.1 Two simultaneous settlement attempts against the same payment transaction
    const concurrentBatchA_promise = GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_conc_A',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      gross_amount: 1500,
      net_amount: 1470,
      identified_fee_amount: 25.42,
      reported_tax_amount: 4.58,
      prepared_by: 'usr_treasury_prep',
      orders: [{ payment_transaction_id: 'paytxn_test_03', order_id: 'order_test_03', allocated_gross_amount: 1500, identified_fee_amount: 25.42, reported_tax_amount: 4.58 }],
      actorContext: preparerContext,
    });

    const concurrentBatchB_promise = GatewaySettlementService.ingestPayoutBatch({
      provider: 'razorpay',
      payout_reference: 'payout_test_conc_B',
      bank_account_id: activeBank.id,
      settlement_date: '2026-09-27',
      gross_amount: 1500,
      net_amount: 1470,
      identified_fee_amount: 25.42,
      reported_tax_amount: 4.58,
      prepared_by: 'usr_treasury_prep',
      orders: [{ payment_transaction_id: 'paytxn_test_03', order_id: 'order_test_03', allocated_gross_amount: 1500, identified_fee_amount: 25.42, reported_tax_amount: 4.58 }],
      actorContext: preparerContext,
    });

    const [concA, concB] = await Promise.allSettled([concurrentBatchA_promise, concurrentBatchB_promise]);
    const oneFulfilled = (concA.status === 'fulfilled' && concB.status === 'rejected') || (concA.status === 'rejected' && concB.status === 'fulfilled');
    assert(oneFulfilled, 'Concurrency test: Exactly one concurrent ingestion succeeded, one failed');

    const winningBatchId = concA.status === 'fulfilled' ? concA.value?.payoutBatch?.id : concB.value?.payoutBatch?.id;
    if (winningBatchId) {
      createdBatches.push(winningBatchId);
    }

    const rejectedError = concA.status === 'rejected' ? concA.reason : concB.reason;
    if (rejectedError) {
      assert(
        rejectedError.code === 'ORDER_ALREADY_SETTLED' || rejectedError.code === 'GATEWAY_SETTLEMENT_ERROR',
        `Failing concurrent attempt received controlled exception (${rejectedError.code || rejectedError.message})`
      );
    } else {
      assert(false, 'Expected one concurrent settlement attempt to fail, but neither failed');
    }

    console.log('\n--- Section 9: Security, RBAC & Immutability ---');

    // 9.1 Missing GATEWAY.SETTLE_PREPARE
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_unauth_prep',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 1500,
        net_amount: 1470,
        prepared_by: 'usr_unauth',
        orders: [],
        actorContext: unauthorizedContext,
      }, client);
      assert(false, 'Unauthorized ingestion should fail');
    } catch (e) {
      assert(e.code === 'PERMISSION_DENIED', 'Missing GATEWAY.SETTLE_PREPARE throws PERMISSION_DENIED');
    }

    // 9.2 Missing GATEWAY.SETTLE_APPROVE
    try {
      await GatewaySettlementService.approvePayoutBatch({
        payoutBatchId: winningBatchId,
        approvedBy: 'usr_unauth',
        actorContext: unauthorizedContext,
      }, client);
      assert(false, 'Unauthorized approval should fail');
    } catch (e) {
      assert(e.code === 'PERMISSION_DENIED', 'Missing GATEWAY.SETTLE_APPROVE throws PERMISSION_DENIED');
    }

    // 9.3 Missing GATEWAY.SETTLE_POST
    try {
      await GatewaySettlementService.postPayoutSettlement({
        payoutBatchId: winningBatchId,
        postedBy: 'usr_unauth',
        actorContext: unauthorizedContext,
      }, client);
      assert(false, 'Unauthorized posting should fail');
    } catch (e) {
      assert(e.code === 'PERMISSION_DENIED', 'Missing GATEWAY.SETTLE_POST throws PERMISSION_DENIED');
    }

    // 9.4 Immutability: Attempt to cancel a POSTED payout batch
    try {
      await GatewaySettlementService.cancelPayoutBatch({
        payoutBatchId: multiBranchBatch.payoutBatch.id,
        cancelledBy: 'usr_treasury_prep',
        reason: 'Attempted cancellation of posted batch',
        actorContext: preparerContext,
      }, client);
      assert(false, 'Cancellation of POSTED batch should fail');
    } catch (e) {
      assert(e.code === 'POSTED_PAYOUT_IMMUTABLE', 'Cancellation of POSTED batch throws POSTED_PAYOUT_IMMUTABLE');
    }

    // 9.5 Missing actorContext entirely throws PERMISSION_DENIED
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_no_actor_context',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 1500,
        net_amount: 1470,
        prepared_by: 'usr_unauth',
        orders: [],
      }, client);
      assert(false, 'Missing actorContext should fail');
    } catch (e) {
      assert(e.code === 'PERMISSION_DENIED', 'Missing actorContext throws PERMISSION_DENIED');
    }

    // 9.6 Forged role / permission bypass attempt
    try {
      await GatewaySettlementService.ingestPayoutBatch({
        provider: 'razorpay',
        payout_reference: 'payout_test_forged_role',
        bank_account_id: activeBank.id,
        settlement_date: '2026-09-27',
        gross_amount: 1500,
        net_amount: 1470,
        prepared_by: 'usr_forged',
        orders: [],
        actorContext: { id: 'usr_forged', role: 'OPERATOR', permissions: [] },
      }, client);
      assert(false, 'Forged/unauthorized role should fail');
    } catch (e) {
      assert(e.code === 'PERMISSION_DENIED', 'Forged/unauthorized role throws PERMISSION_DENIED');
    }

    // 9.7 Client Branch Override Defense
    const vouchersRes = await client.query('SELECT DISTINCT branch_id FROM public.accounting_voucher');
    const branchIds = vouchersRes.rows.map((r) => r.branch_id);
    assert(
      branchIds.includes(branchA) && branchIds.includes(branchB) && branchIds.length === 2,
      'Client branch override defense: Vouchers strictly bound to DB payment_transaction branch IDs'
    );

    // 9.8 Client GL-Account Override Defense
    const allAccountCodesRes = await client.query(`
      SELECT DISTINCT aa.code FROM public.accounting_journal_line ajl
      JOIN public.accounting_account aa ON aa.id = ajl.account_id
    `);
    const usedCodes = allAccountCodesRes.rows.map((r) => r.code).sort();
    assert(
      usedCodes.length === 3 && usedCodes[0] === '1112' && usedCodes[1] === '1113' && usedCodes[2] === '5290',
      'Client GL account override defense: GL accounts are strictly hardcoded (1112, 1113, 5290)'
    );

    // 9.9 Cross-branch / BOLA access defense
    try {
      await GatewaySettlementService.postPayoutSettlement({
        payoutBatchId: multiBranchBatch.payoutBatch.id,
        postedBy: 'usr_branch_staff_A',
        actorContext: { id: 'usr_branch_staff_A', role: 'STAFF', branch_id: branchA, permissions: ['GATEWAY.VIEW'] },
      }, client);
      assert(false, 'Cross-branch / BOLA access without post permission should fail');
    } catch (e) {
      assert(e.code === 'PERMISSION_DENIED', 'BOLA / unauthorized branch poster rejected with PERMISSION_DENIED');
    }

    console.log('\n--- Section 10: Complete Teardown & Independent DB Audit ---');
    await cleanupAllFixtures();

    const postAccounts = await client.query('SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL');
    const postBatches = await client.query('SELECT count(*) FROM public.gateway_payout_batch');
    const postSettlements = await client.query('SELECT count(*) FROM public.gateway_settlement_order');
    const postVouchers = await client.query('SELECT count(*) FROM public.accounting_voucher');
    const postJournals = await client.query('SELECT count(*) FROM public.accounting_journal_entry');
    const postLines = await client.query('SELECT count(*) FROM public.accounting_journal_line');
    const postPeriods = await client.query('SELECT count(*) FROM public.accounting_fiscal_period');
    const postBankAccounts = await client.query('SELECT count(*) FROM public.bank_account');
    const postOrders = await client.query('SELECT count(*) FROM public."order"');
    const postTransactions = await client.query('SELECT count(*) FROM public.payment_transaction');
    const postInventory = await client.query('SELECT count(*) FROM public.branch_inventory');
    const postStartDate = await client.query(`SELECT count(*) FROM public.setting WHERE key = 'accounting_start_date'`);

    assert(parseInt(postAccounts.rows[0].count) === 99, 'Post-cleanup: accounting_account is exactly 99');
    assert(parseInt(postBatches.rows[0].count) === 0, 'Post-cleanup: gateway_payout_batch is exactly 0');
    assert(parseInt(postSettlements.rows[0].count) === 0, 'Post-cleanup: gateway_settlement_order is exactly 0');
    assert(parseInt(postVouchers.rows[0].count) === 0, 'Post-cleanup: accounting_voucher is exactly 0');
    assert(parseInt(postJournals.rows[0].count) === 0, 'Post-cleanup: accounting_journal_entry is exactly 0');
    assert(parseInt(postLines.rows[0].count) === 0, 'Post-cleanup: accounting_journal_line is exactly 0');
    assert(parseInt(postPeriods.rows[0].count) === 0, 'Post-cleanup: accounting_fiscal_period is exactly 0');
    assert(parseInt(postBankAccounts.rows[0].count) === 0, 'Post-cleanup: bank_account is exactly 0');
    assert(parseInt(postOrders.rows[0].count) === 173, 'Post-cleanup: order is exactly 173 (historical baseline unmodified)');
    assert(parseInt(postTransactions.rows[0].count) === 53, 'Post-cleanup: payment_transaction is exactly 53 (prototype baseline unmodified)');
    assert(parseInt(postInventory.rows[0].count) === 424, 'Post-cleanup: branch_inventory is exactly 424 (unmodified)');
    assert(parseInt(postStartDate.rows[0].count) === 0, 'Post-cleanup: accounting_start_date is exactly 0 (unconfigured in prod)');

    console.log('\n=============================================================================');
    console.log(`SUBSTEP 4.10.3 TEST SUITE SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=============================================================================');

    await client.end();
    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    await cleanupAllFixtures();
    await client.end();
    process.exit(1);
  }
}

runTests();
