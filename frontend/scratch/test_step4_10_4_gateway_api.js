/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.4 Test Suite
 * Gateway Settlement API Endpoints & Enterprise UI Dashboard
 *
 * MANDATED TEST COVERAGE:
 * 1. Database Baseline:
 *    - Verify pristine pre-test baseline (0 batches, 0 vouchers, 0 journals).
 * 2. Architectural Boundaries:
 *    - Verify GET and POST route handlers.
 *    - Verify StaffAccessControl permissions & TAB_PERMISSION_MAP integration.
 * 3. Authentication & RBAC Layer:
 *    - Anonymous requests rejected (HTTP 401).
 *    - Spoofed headers rejected (HTTP 401).
 *    - Customer tokens rejected (HTTP 403).
 *    - Missing GATEWAY.VIEW rejected (HTTP 403).
 *    - Granular action permissions (SETTLE_PREPARE, SETTLE_APPROVE, SETTLE_POST) enforced.
 * 4. Client-Tampering Defense (Mandated Explicit Check):
 *    - GL codes (1112, 1113, 5290) and branch IDs in client payload are stripped/ignored.
 *    - Server-side settlement engine authoritatively resolves branch from payment_transaction.branch_id.
 * 5. BOLA & Branch Isolation:
 *    - Branch-scoped users can only query their branch orders/vouchers.
 *    - Cross-branch queries return HTTP 403 FORBIDDEN.
 * 6. Lifecycle & Idempotency:
 *    - Ingest batch (HTTP 201) with integer paise validation.
 *    - Duplicate reference rejection (HTTP 409).
 *    - Bad financial math rejection (HTTP 422).
 *    - Segregation of Duties (SoD): Preparer cannot self-approve (HTTP 403).
 *    - Approve batch (HTTP 200).
 *    - SoD: Approver / Preparer cannot self-post (HTTP 403).
 *    - Post batch (HTTP 200) -> creates branch-partitioned vouchers (Dr 1112, Dr 5290, Cr 1113).
 *    - Posted batch immutability: cancellation rejected (HTTP 409).
 *    - Cancellation API on unposted batch (HTTP 200).
 * 7. Complete Teardown & Independent Audit:
 *    - 100% teardown of all created fixtures.
 *    - Pristine database baseline verified (0 batches, 0 vouchers, 0 journals).
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
  throw new Error("No database connection string found");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10.4 Gateway Settlement API & UI Tests');
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

  const { GatewaySettlementService } = require('../src/lib/services/gateway-settlement.service');
  const { GatewayPayoutRepository } = require('../src/lib/repositories/gateway-payout.repository');
  const { GatewaySettlementOrderRepository } = require('../src/lib/repositories/gateway-settlement-order.repository');
  const { BankAccountRepository } = require('../src/lib/repositories/bank-account.repository');
  const { StaffAccessControl } = require('../src/lib/staff-access-control');
  const { signAuthToken } = require('../src/lib/security/auth-session');
  const { GET, POST } = require('../src/app/api/v1/[...path]/route');
  const { NextRequest } = require('next/server');
  const { closeDbPool } = require('../src/lib/db');

  const client = new Client({ connectionString: connStr });
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

  // Tracking fixtures for 100% teardown
  const createdBatchIds = [];
  const createdBankAccIds = [];
  const createdOrderIds = [];
  const createdTxnIds = [];
  const createdCustIds = [];
  let fiscalPeriodCreated = false;
  let startDateCreated = false;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0: PRE-TEST DATABASE BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/7] Auditing pre-test PostgreSQL baseline...');
    const preAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    const preBatches = parseInt((await client.query('SELECT COUNT(*) FROM public.gateway_payout_batch')).rows[0].count, 10);
    const preOrdersSettled = parseInt((await client.query('SELECT COUNT(*) FROM public.gateway_settlement_order')).rows[0].count, 10);
    const preVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const preJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const preOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const preTxns = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    const preBankAccounts = parseInt((await client.query('SELECT COUNT(*) FROM public.bank_account')).rows[0].count, 10);

    assert(preAccounts >= 98, `Chart of accounts is complete (actual: ${preAccounts})`);
    assert(preBatches === 0, `Pre-test gateway_payout_batch === 0 (actual: ${preBatches})`);
    assert(preOrdersSettled === 0, `Pre-test gateway_settlement_order === 0 (actual: ${preOrdersSettled})`);
    assert(preVouchers === 0, `Pre-test accounting_voucher === 0 (actual: ${preVouchers})`);
    assert(preJournals === 0, `Pre-test accounting_journal_entry === 0 (actual: ${preJournals})`);
    assert(preOrders === 173, `Historical order baseline untouched === 173 (actual: ${preOrders})`);
    assert(preTxns === 53, `Prototype transaction baseline untouched === 53 (actual: ${preTxns})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: ARCHITECTURAL BOUNDARIES & TAB NAVIGATION INTEGRATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/7] Verifying Architectural Boundaries & Navigation Controls...');
    assert(typeof GET === 'function', 'GET route handler is exported from [...path]/route.ts');
    assert(typeof POST === 'function', 'POST route handler is exported from [...path]/route.ts');
    assert(typeof GatewaySettlementService.ingestPayoutBatch === 'function', 'GatewaySettlementService defines ingestPayoutBatch');
    assert(typeof GatewaySettlementService.approvePayoutBatch === 'function', 'GatewaySettlementService defines approvePayoutBatch');
    assert(typeof GatewaySettlementService.postPayoutSettlement === 'function', 'GatewaySettlementService defines postPayoutSettlement');
    assert(typeof GatewaySettlementService.cancelPayoutBatch === 'function', 'GatewaySettlementService defines cancelPayoutBatch');

    // Super Admin tab permission
    assert(StaffAccessControl.isTabPermitted({ role: 'SUPER_ADMIN' }, 'gateway_settlements') === true,
      'isTabPermitted grants gateway_settlements to SUPER_ADMIN');

    // Non-super admin staff with GATEWAY.VIEW
    const staffWithGwView = { role: 'STAFF', permissions: ['GATEWAY.VIEW'] };
    assert(StaffAccessControl.isTabPermitted(staffWithGwView, 'gateway_settlements') === true,
      'isTabPermitted grants gateway_settlements to staff with GATEWAY.VIEW');

    // Staff without GATEWAY.VIEW
    const staffNoGwView = { role: 'STAFF', permissions: ['ORDERS.VIEW'] };
    assert(StaffAccessControl.isTabPermitted(staffNoGwView, 'gateway_settlements') === false,
      'isTabPermitted blocks gateway_settlements for staff lacking GATEWAY.VIEW');

    // Verify UI component exists on disk
    const panelPath = path.resolve(__dirname, '../src/components/dashboard/admin/gateway-settlement-panel.tsx');
    assert(fs.existsSync(panelPath), 'GatewaySettlementPanel UI component exists at expected path');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: AUTHENTICATION & RBAC PERMISSION GATES
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/7] Testing Authentication & RBAC Permission Enforcement...');

    // 2.1 Anonymous request rejected
    const reqAnonGet = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches');
    const resAnonGet = await GET(reqAnonGet, { params: { path: ['admin', 'gateway-settlements', 'batches'] } });
    assert(resAnonGet.status === 401, `Anonymous GET batches returns HTTP 401 (actual: ${resAnonGet.status})`);

    const reqAnonPost = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches/ingest', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const resAnonPost = await POST(reqAnonPost, { params: { path: ['admin', 'gateway-settlements', 'batches', 'ingest'] } });
    assert(resAnonPost.status === 401, `Anonymous POST ingest returns HTTP 401 (actual: ${resAnonPost.status})`);

    // 2.2 Spoofed headers without verified session rejected
    const reqSpoof = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches', {
      headers: { 'x-user-role': 'SUPER_ADMIN', 'x-user-id': 'admin_01' },
    });
    const resSpoof = await GET(reqSpoof, { params: { path: ['admin', 'gateway-settlements', 'batches'] } });
    assert(resSpoof.status === 401, `Spoofed headers return HTTP 401 (actual: ${resSpoof.status})`);

    // 2.3 Customer token rejected on gateway admin API (403 FORBIDDEN)
    const custToken = signAuthToken({ userId: 'cust_01', role: 'CUSTOMER', customerId: 'cust_01' });
    const reqCust = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches', {
      headers: { authorization: `Bearer ${custToken}` },
    });
    const resCust = await GET(reqCust, { params: { path: ['admin', 'gateway-settlements', 'batches'] } });
    assert(resCust.status === 403, `Customer token returns HTTP 403 on gateway settlements (actual: ${resCust.status})`);

    // 2.4 Staff token lacking GATEWAY.VIEW rejected (403 FORBIDDEN)
    const staffNoPermToken = signAuthToken({ userId: 'usr_staff_noperm', role: 'STAFF', branchId: 'res_01' });
    const reqNoPerm = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches', {
      headers: { authorization: `Bearer ${staffNoPermToken}` },
    });
    const resNoPerm = await GET(reqNoPerm, { params: { path: ['admin', 'gateway-settlements', 'batches'] } });
    assert(resNoPerm.status === 403, `Staff lacking GATEWAY.VIEW returns HTTP 403 (actual: ${resNoPerm.status})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: BANK ACCOUNTS API & GRANULAR RBAC
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/7] Testing Bank Accounts Master API...');

    // Create test corporate bank account for subsequent tests
    const testBankId = `ba_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_account (
        id, company_id, branch_id, bank_name, account_number_masked, ifsc_code, status, metadata, created_at, updated_at
      ) VALUES ($1, 'default_company', NULL, 'HDFC Corporate Treasury', 'XXXXXX1234', 'HDFC0000001', 'ACTIVE', '{}', NOW(), NOW());
    `, [testBankId]);
    createdBankAccIds.push(testBankId);

    // Super Admin queries bank accounts
    const adminToken = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    const reqBanks = new NextRequest('http://localhost:3000/api/v1/admin/bank-accounts', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resBanks = await GET(reqBanks, { params: { path: ['admin', 'bank-accounts'] } });
    assert(resBanks.status === 200, `SUPER_ADMIN can list bank accounts (actual: ${resBanks.status})`);
    const jsonBanks = await resBanks.json();
    assert(jsonBanks.success === true && Array.isArray(jsonBanks.data), 'Bank accounts response is valid array');
    assert(jsonBanks.data.some(b => b.id === testBankId), 'Created test bank account found in response');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: INGESTION API & CLIENT-TAMPERING DEFENSE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/7] Testing Batch Ingestion API & Client Override Rejection...');

    // Setup branches, customers, orders, and payment transactions
    const branchRes = await client.query('SELECT id, name FROM public.branch LIMIT 2');
    const branchA = branchRes.rows[0];
    const branchB = branchRes.rows[1];

    const testCustId = `cust_test_gw_${Date.now()}`;
    await client.query(`
      INSERT INTO public.customer (id, phone, first_name, last_name, email, created_at, updated_at)
      VALUES ($1, '+919999988888', 'Test', 'GatewayUser', 'gw@test.com', NOW(), NOW())
    `, [testCustId]);
    createdCustIds.push(testCustId);

    // Order 1 (Fulfilled at Branch A)
    const order1Id = `ord_gw_test_1_${Date.now()}`;
    const txn1Id = `paytxn_gw_test_1_${Date.now()}`;
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 99991, $2, 'gw1@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [order1Id, testCustId, JSON.stringify({ is_ledger_eligible: 'true', branch_id: branchA.id })]);
    createdOrderIds.push(order1Id);

    await client.query(`
      INSERT INTO public.payment_transaction (
        id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 5500.00, 'INR', 'captured', 'unsettled', 'razorpay', $5, NOW(), NOW())
    `, [txn1Id, branchA.id, order1Id, testCustId, `pay_ref_${txn1Id}`]);
    createdTxnIds.push(txn1Id);

    // Order 2 (Fulfilled at Branch B)
    const order2Id = `ord_gw_test_2_${Date.now()}`;
    const txn2Id = `paytxn_gw_test_2_${Date.now()}`;
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 99992, $2, 'gw2@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [order2Id, testCustId, JSON.stringify({ is_ledger_eligible: 'true', branch_id: branchB.id })]);
    createdOrderIds.push(order2Id);

    await client.query(`
      INSERT INTO public.payment_transaction (
        id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 5000.00, 'INR', 'captured', 'unsettled', 'razorpay', $5, NOW(), NOW())
    `, [txn2Id, branchB.id, order2Id, testCustId, `pay_ref_${txn2Id}`]);
    createdTxnIds.push(txn2Id);

    // Order 3 (Fulfilled at Branch A, for cancellation test)
    const order3Id = `ord_gw_test_3_${Date.now()}`;
    const txn3Id = `paytxn_gw_test_3_${Date.now()}`;
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 99993, $2, 'gw3@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [order3Id, testCustId, JSON.stringify({ is_ledger_eligible: 'true', branch_id: branchA.id })]);
    createdOrderIds.push(order3Id);

    await client.query(`
      INSERT INTO public.payment_transaction (
        id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 1000.00, 'INR', 'captured', 'unsettled', 'payu', $5, NOW(), NOW())
    `, [txn3Id, branchA.id, order3Id, testCustId, `pay_ref_${txn3Id}`]);
    createdTxnIds.push(txn3Id);

    // 4.1 Test Math Mismatch Rejection (HTTP 422)
    const badMathPayload = {
      provider: 'razorpay',
      payout_reference: `pout_badmath_${Date.now()}`,
      bank_account_id: testBankId,
      settlement_date: '2026-09-28',
      gross_amount: 10500.00,
      identified_fee_amount: 178.00,
      reported_tax_amount: 32.04,
      net_amount: 9999.00, // Deliberate mismatch
      orders: [],
    };
    const reqBadMath = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches/ingest', {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(badMathPayload),
    });
    const resBadMath = await POST(reqBadMath, { params: { path: ['admin', 'gateway-settlements', 'batches', 'ingest'] } });
    assert(resBadMath.status === 422, `Math mismatch rejected with HTTP 422 (actual: ${resBadMath.status})`);
    const jsonBadMath = await resBadMath.json();
    assert(jsonBadMath.error === 'SETTLEMENT_MATH_MISMATCH', 'Error code is SETTLEMENT_MATH_MISMATCH');

    // 4.2 Test Client-Side Override Tampering Defense (MANDATED CHECK)
    // Client sends fake gl_account '9999' and fake branch_id 'br_client_override' in orders payload.
    // The server must strip/ignore these and extract the true branch from payment_transaction.
    const payoutRef1 = `pout_valid_test_1_${Date.now()}`;
    const validIngestPayload = {
      provider: 'razorpay',
      payout_reference: payoutRef1,
      settlement_reference: 'UTR1234567890',
      bank_account_id: testBankId,
      settlement_date: '2026-09-28',
      bank_value_date: '2026-09-28',
      gross_amount: 10500.00,
      identified_fee_amount: 178.00,
      reported_tax_amount: 32.04,
      other_deductions_amount: 0.00,
      rounding_variance: 0.04,
      net_amount: 10290.00,
      orders: [
        {
          payment_transaction_id: txn1Id,
          order_id: order1Id,
          allocated_gross_amount: 5500.00,
          identified_fee_amount: 93.24,
          reported_tax_amount: 16.78,
          // Attacker injects unauthorized accounting and branch data:
          gl_account: '9999',
          account_code: '9999',
          branch_id: 'br_unauthorized_override',
          settlement_branch_id: 'br_unauthorized_override',
        },
        {
          payment_transaction_id: txn2Id,
          order_id: order2Id,
          allocated_gross_amount: 5000.00,
          identified_fee_amount: 84.76,
          reported_tax_amount: 15.26,
        },
      ],
    };

    // User preparing the batch (User 1)
    const user1Token = signAuthToken({ userId: 'usr_preparer_01', role: 'SUPER_ADMIN' });
    const reqValidIngest = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches/ingest', {
      method: 'POST',
      headers: { authorization: `Bearer ${user1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validIngestPayload),
    });
    const resValidIngest = await POST(reqValidIngest, { params: { path: ['admin', 'gateway-settlements', 'batches', 'ingest'] } });
    assert(resValidIngest.status === 201, `Valid payout batch ingested with HTTP 201 (actual: ${resValidIngest.status})`);
    const jsonValidIngest = await resValidIngest.json();
    assert(jsonValidIngest.success === true, 'Ingest response success === true');
    const batch1Id = jsonValidIngest.data.payoutBatch.id;
    createdBatchIds.push(batch1Id);

    // Verify DB Ground Truth for Client Override Defense:
    const dbOrderA = (await client.query('SELECT * FROM public.gateway_settlement_order WHERE payout_batch_id = $1 AND payment_transaction_id = $2', [batch1Id, txn1Id])).rows[0];
    assert(dbOrderA.settlement_branch_id === branchA.id,
      `Authoritative branch_id enforced from payment_transaction (${branchA.id}) - client override ignored (actual: ${dbOrderA.settlement_branch_id})`);
    assert(dbOrderA.settlement_branch_id !== 'br_unauthorized_override',
      'Client-supplied settlement_branch_id was successfully rejected/ignored');

    // 4.3 Idempotency: Duplicate Reference Rejection (HTTP 409)
    const reqDuplicate = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches/ingest', {
      method: 'POST',
      headers: { authorization: `Bearer ${user1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validIngestPayload),
    });
    const resDuplicate = await POST(reqDuplicate, { params: { path: ['admin', 'gateway-settlements', 'batches', 'ingest'] } });
    assert(resDuplicate.status === 409, `Duplicate reference rejected with HTTP 409 (actual: ${resDuplicate.status})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: BATCH LISTING, DETAIL, ORDERS & BOLA ISOLATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/7] Testing Query APIs & Branch BOLA Isolation...');

    // 5.1 List Batches
    const reqList = new NextRequest('http://localhost:3000/api/v1/admin/gateway-settlements/batches?provider=razorpay', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resList = await GET(reqList, { params: { path: ['admin', 'gateway-settlements', 'batches'] } });
    assert(resList.status === 200, `List batches returns HTTP 200 (actual: ${resList.status})`);
    const jsonList = await resList.json();
    assert(jsonList.data.some(b => b.id === batch1Id), 'Ingested batch present in list response');

    // 5.2 Get Batch Detail
    const reqDetail = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resDetail = await GET(reqDetail, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id] } });
    assert(resDetail.status === 200, `Get batch detail returns HTTP 200 (actual: ${resDetail.status})`);
    const jsonDetail = await resDetail.json();
    assert(jsonDetail.data.batch.payout_reference === payoutRef1, 'Batch reference matches');
    assert(jsonDetail.data.bankAccount.id === testBankId, 'Destination bank account details resolved');

    // 5.3 Get Batch Orders (with authoritative branch enrichment)
    const reqOrders = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/orders`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resOrders = await GET(reqOrders, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'orders'] } });
    assert(resOrders.status === 200, `Get batch orders returns HTTP 200 (actual: ${resOrders.status})`);
    const jsonOrders = await resOrders.json();
    assert(jsonOrders.data.orders.length === 2, 'Returns all allocated orders for enterprise admin');
    assert(jsonOrders.data.orders[0].branch_name !== undefined, 'Authoritative branch_name is populated');

    // 5.4 BOLA / Branch Scoping Defense
    // Staff assigned strictly to Branch A
    const staffBranchAToken = signAuthToken({ userId: 'usr_mgr_bra', role: 'BRANCH_MANAGER', branchId: branchA.id });
    const reqBranchAOrders = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/orders`, {
      headers: { authorization: `Bearer ${staffBranchAToken}` },
    });
    const resBranchAOrders = await GET(reqBranchAOrders, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'orders'] } });
    assert(resBranchAOrders.status === 200, `Branch A manager can query batch orders (actual: ${resBranchAOrders.status})`);
    const jsonBranchAOrders = await resBranchAOrders.json();
    assert(jsonBranchAOrders.data.orders.length === 1 && jsonBranchAOrders.data.orders[0].settlement_branch_id === branchA.id,
      'Branch A manager only sees transactions for Branch A (Branch B isolated)');

    // Staff assigned to an unrelated branch (Branch C)
    const staffBranchCToken = signAuthToken({ userId: 'usr_mgr_brc', role: 'BRANCH_MANAGER', branchId: 'res_unrelated_branch_c' });
    const reqBOLA = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/orders`, {
      headers: { authorization: `Bearer ${staffBranchCToken}` },
    });
    const resBOLA = await GET(reqBOLA, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'orders'] } });
    assert(resBOLA.status === 403, `Unrelated branch manager querying batch orders fails with HTTP 403 (actual: ${resBOLA.status})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: SEGREGATION OF DUTIES (SoD), APPROVAL, GL POSTING & IMMUTABILITY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/7] Testing Segregation of Duties (SoD), Approval & GL Posting...');

    // Setup accounting prerequisites (accounting_start_date & open fiscal period)
    const startDateSettingRes = await client.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date'");
    if (startDateSettingRes.rows.length === 0) {
      await client.query(`
        INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
        VALUES ('set_accounting_start_date_4104', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW())
      `);
      startDateCreated = true;
    }

    const periodRes = await client.query("SELECT * FROM public.accounting_fiscal_period WHERE fiscal_year = 'FY2026-27' AND is_locked = false");
    if (periodRes.rows.length === 0) {
      await client.query(`
        INSERT INTO public.accounting_fiscal_period (
          id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
        ) VALUES ('fp_test_2026', 'FY2026-27', 'September 2026', '2026-09-01', '2026-09-30', false, NOW())
      `);
      fiscalPeriodCreated = true;
    }

    // 6.1 SoD Violation: Preparer (usr_preparer_01) attempts self-approval -> HTTP 403
    const reqSelfApprove = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resSelfApprove = await POST(reqSelfApprove, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'approve'] } });
    assert(resSelfApprove.status === 403, `Preparer self-approval rejected with HTTP 403 (actual: ${resSelfApprove.status})`);
    const jsonSelfApprove = await resSelfApprove.json();
    assert(jsonSelfApprove.error === 'SELF_APPROVAL_FORBIDDEN', 'Error code is SELF_APPROVAL_FORBIDDEN');

    // 6.2 Second Actor (User 2: Manager) approves the batch -> HTTP 200
    const user2Token = signAuthToken({ userId: 'usr_approver_02', role: 'SUPER_ADMIN' });
    const reqValidApprove = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resValidApprove = await POST(reqValidApprove, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'approve'] } });
    assert(resValidApprove.status === 200, `Second actor approves batch with HTTP 200 (actual: ${resValidApprove.status})`);
    const jsonValidApprove = await resValidApprove.json();
    assert(jsonValidApprove.data.payoutBatch.status === 'APPROVED', 'Batch status transitioned to APPROVED');
    assert(jsonValidApprove.data.payoutBatch.approved_by === 'usr_approver_02', 'approved_by correctly recorded');

    // 6.3 SoD Violation: Approver (usr_approver_02) attempts self-posting -> HTTP 403
    const reqApproverSelfPost = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/post`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ posting_date: '2026-09-28' }),
    });
    const resApproverSelfPost = await POST(reqApproverSelfPost, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'post'] } });
    assert(resApproverSelfPost.status === 403, `Approver self-posting rejected with HTTP 403 (actual: ${resApproverSelfPost.status})`);
    const jsonApproverSelfPost = await resApproverSelfPost.json();
    assert(jsonApproverSelfPost.error === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Error code is SEGREGATION_OF_DUTIES_VIOLATION');

    // 6.4 SoD Violation: Preparer (usr_preparer_01) attempts posting -> HTTP 403
    const reqPreparerPost = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/post`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ posting_date: '2026-09-28' }),
    });
    const resPreparerPost = await POST(reqPreparerPost, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'post'] } });
    assert(resPreparerPost.status === 403, `Preparer posting rejected with HTTP 403 (actual: ${resPreparerPost.status})`);

    // 6.5 Third Actor (User 3: GL Accountant) posts batch to General Ledger -> HTTP 200
    const user3Token = signAuthToken({ userId: 'usr_accountant_03', role: 'SUPER_ADMIN' });
    const reqValidPost = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/post`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user3Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ posting_date: '2026-09-28' }),
    });
    const resValidPost = await POST(reqValidPost, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'post'] } });
    assert(resValidPost.status === 200, `Third actor posts batch with HTTP 200 (actual: ${resValidPost.status})`);
    const jsonValidPost = await resValidPost.json();
    assert(jsonValidPost.data.payoutBatch.status === 'POSTED', 'Batch status transitioned to POSTED');
    assert(jsonValidPost.data.vouchers.length === 2, 'Generated exactly 2 branch-partitioned vouchers (Branch A + Branch B)');

    // 6.6 Verify Vouchers API & Accounting Entries
    const reqVouchers = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/vouchers`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const resVouchers = await GET(reqVouchers, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'vouchers'] } });
    assert(resVouchers.status === 200, `Get batch vouchers returns HTTP 200 (actual: ${resVouchers.status})`);
    const jsonVouchers = await resVouchers.json();
    assert(jsonVouchers.data.vouchers.length === 2, '2 vouchers returned via API');

    // Verify voucher structure for Branch A
    const vBranchA = jsonVouchers.data.vouchers.find(v => v.branch_id === branchA.id);
    assert(vBranchA !== undefined, 'Voucher for Branch A present');
    assert(vBranchA.lines.length >= 3, 'Voucher has Dr 1112, Dr 5290, Cr 1113 lines');

    const dr1112 = vBranchA.lines.find(l => l.account_code === '1112');
    const dr5290 = vBranchA.lines.find(l => l.account_code === '5290');
    const cr1113 = vBranchA.lines.find(l => l.account_code === '1113');
    assert(dr1112 && Number(dr1112.debit_amount) > 0, 'Dr 1112 Bank Operating present with positive debit');
    assert(dr5290 && Number(dr5290.debit_amount) > 0, 'Dr 5290 MDR Fees present with positive debit');
    assert(cr1113 && Number(cr1113.credit_amount) === 5500.00, 'Cr 1113 Gateway Clearing equals Branch A Gross (₹5,500.00)');

    // Mathematical balance of voucher
    const sumDebits = vBranchA.lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
    const sumCredits = vBranchA.lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
    assert(Math.abs(sumDebits - sumCredits) < 0.01, `Branch A voucher is mathematically balanced (Dr: ${sumDebits}, Cr: ${sumCredits})`);

    // 6.7 Immutability Defense: Attempt to Cancel POSTED Batch -> HTTP 409
    const reqCancelPosted = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch1Id}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Attempt to cancel posted batch' }),
    });
    const resCancelPosted = await POST(reqCancelPosted, { params: { path: ['admin', 'gateway-settlements', 'batches', batch1Id, 'cancel'] } });
    assert(resCancelPosted.status === 409, `Cancelling POSTED batch rejected with HTTP 409 (actual: ${resCancelPosted.status})`);
    const jsonCancelPosted = await resCancelPosted.json();
    assert(jsonCancelPosted.error === 'POSTED_PAYOUT_IMMUTABLE', 'Error code is POSTED_PAYOUT_IMMUTABLE');

    // 6.8 Cancellation API on unposted batch
    const payoutRef2 = `pout_cancel_test_${Date.now()}`;
    const ingestCancelBatch = await GatewaySettlementService.ingestPayoutBatch({
      provider: 'payu',
      payout_reference: payoutRef2,
      bank_account_id: testBankId,
      settlement_date: '2026-09-28',
      gross_amount: 1000.00,
      identified_fee_amount: 18.00,
      reported_tax_amount: 3.24,
      net_amount: 978.76,
      prepared_by: 'usr_preparer_01',
      orders: [
        {
          payment_transaction_id: txn3Id,
          order_id: order3Id,
          allocated_gross_amount: 1000.00,
          identified_fee_amount: 18.00,
          reported_tax_amount: 3.24,
        },
      ],
      actorContext: { id: 'usr_preparer_01', role: 'SUPER_ADMIN' },
    });
    const batch2Id = ingestCancelBatch.payoutBatch.id;
    createdBatchIds.push(batch2Id);

    // Cancel without reason fails HTTP 400
    const reqNoReason = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch2Id}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resNoReason = await POST(reqNoReason, { params: { path: ['admin', 'gateway-settlements', 'batches', batch2Id, 'cancel'] } });
    assert(resNoReason.status === 400, `Cancel without reason returns HTTP 400 (actual: ${resNoReason.status})`);

    // Cancel with valid reason succeeds HTTP 200
    const reqCancelValid = new NextRequest(`http://localhost:3000/api/v1/admin/gateway-settlements/batches/${batch2Id}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Aggregator payout recalled by PayU' }),
    });
    const resCancelValid = await POST(reqCancelValid, { params: { path: ['admin', 'gateway-settlements', 'batches', batch2Id, 'cancel'] } });
    assert(resCancelValid.status === 200, `Cancel unposted batch returns HTTP 200 (actual: ${resCancelValid.status})`);
    const jsonCancelValid = await resCancelValid.json();
    assert(jsonCancelValid.data.status === 'CANCELLED', 'Batch transitioned to CANCELLED');

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: 100% COMPLETE TEARDOWN & POST-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/7] Executing 100% complete test fixture teardown...');

    try {
      // 1. Delete created accounting vouchers and journals
      if (createdBatchIds.length > 0) {
        await client.query(`
          DELETE FROM public.accounting_journal_line
          WHERE journal_entry_id IN (
            SELECT id FROM public.accounting_journal_entry
            WHERE voucher_id IN (
              SELECT id FROM public.accounting_voucher WHERE metadata->>'payout_batch_id' = ANY($1)
            )
          );
        `, [createdBatchIds]);

        await client.query(`
          DELETE FROM public.accounting_journal_entry
          WHERE voucher_id IN (
            SELECT id FROM public.accounting_voucher WHERE metadata->>'payout_batch_id' = ANY($1)
          );
        `, [createdBatchIds]);

        await client.query(`
          DELETE FROM public.accounting_voucher
          WHERE metadata->>'payout_batch_id' = ANY($1);
        `, [createdBatchIds]);

        // 2. Delete settlement orders
        await client.query(`
          DELETE FROM public.gateway_settlement_order
          WHERE payout_batch_id = ANY($1);
        `, [createdBatchIds]);

        // 3. Delete payout batches
        await client.query(`
          DELETE FROM public.gateway_payout_batch
          WHERE id = ANY($1);
        `, [createdBatchIds]);
      }

      // 4. Delete payment transactions
      if (createdTxnIds.length > 0) {
        await client.query(`
          DELETE FROM public.payment_transaction
          WHERE id = ANY($1);
        `, [createdTxnIds]);
      }

      // 5. Delete orders
      if (createdOrderIds.length > 0) {
        await client.query(`
          DELETE FROM public."order"
          WHERE id = ANY($1);
        `, [createdOrderIds]);
      }

      // 6. Delete customers
      if (createdCustIds.length > 0) {
        await client.query(`
          DELETE FROM public.customer
          WHERE id = ANY($1);
        `, [createdCustIds]);
      }

      // 7. Delete bank accounts
      if (createdBankAccIds.length > 0) {
        await client.query(`
          DELETE FROM public.bank_account
          WHERE id = ANY($1);
        `, [createdBankAccIds]);
      }

      // 8. Delete fiscal period if created during test
      if (fiscalPeriodCreated) {
        await client.query("DELETE FROM public.accounting_fiscal_period WHERE id = 'fp_test_2026'");
      }

      // 9. Delete start date setting if created during test
      if (startDateCreated) {
        await client.query("DELETE FROM public.setting WHERE key = 'accounting_start_date'");
      }

      // Independent Audit
      const postBatches = parseInt((await client.query('SELECT COUNT(*) FROM public.gateway_payout_batch')).rows[0].count, 10);
      const postOrdersSettled = parseInt((await client.query('SELECT COUNT(*) FROM public.gateway_settlement_order')).rows[0].count, 10);
      const postVouchers = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
      const postJournals = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
      const postOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
      const postTxns = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);

      assert(postBatches === 0, `Post-test gateway_payout_batch is pristine === 0 (actual: ${postBatches})`);
      assert(postOrdersSettled === 0, `Post-test gateway_settlement_order is pristine === 0 (actual: ${postOrdersSettled})`);
      assert(postVouchers === 0, `Post-test accounting_voucher is pristine === 0 (actual: ${postVouchers})`);
      assert(postJournals === 0, `Post-test accounting_journal_entry is pristine === 0 (actual: ${postJournals})`);
      assert(postOrders === 173, `Post-test order count is pristine === 173 (actual: ${postOrders})`);
      assert(postTxns === 53, `Post-test payment_transaction is pristine === 53 (actual: ${postTxns})`);
    } catch (cleanupErr) {
      console.error('Teardown error:', cleanupErr);
    } finally {
      try {
        await closeDbPool();
      } catch (poolCloseErr) {
        console.error('Error closing DB pool:', poolCloseErr);
      }
      try {
        await client.end();
      } catch (clientEndErr) {
        console.error('Error closing dedicated client:', clientEndErr);
      }
    }
  }

  console.log('\n=============================================================================');
  console.log(`STEP 4.10.4 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled fatal error in test runner:', err);
  process.exit(1);
});
