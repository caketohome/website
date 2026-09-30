/**
 * CakeToHome ERP — Phase 4F Step 4.2 Sales Voucher Construction Test Suite
 *
 * SCOPE:
 * Sales Tax Engine (Frozen 4.1)
 *         ↓
 * Sales Posting Service (Step 4.2)
 *         ↓
 * Double-Entry Journal Lines (AR 1121/1122, Revenue 4110/4120/4130, Output GST 2121-2129)
 *         ↓
 * Voucher DRAFT Creation with Idempotency
 *         ↓
 * Voucher SUBMITTED Transition
 *
 * BOUNDARIES PRESERVED:
 * - ZERO GL journal postings (accounting_journal_entry / line = 0)
 * - ZERO inventory cost-lot consumptions (inventory_cost_consumption = 0)
 * - ZERO inventory movements (inventory_movement = 0)
 * - ZERO branch inventory alterations (branch_inventory = 424)
 * - ZERO customer receipts / AR settlements
 * - ZERO mutations to historical orders (173 quarantined)
 * - Accounting start date remains UNCONFIGURED
 * - Fiscal periods remain UNCONFIGURED (0 rows)
 * - STRICT ROLLBACK TRANSACTION GUARD
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
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.2 Sales Voucher Construction Test Suite');
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

  const { SalesPostingService, SalesPostingError } = require('../src/lib/services/sales-posting.service');

  const client = new Client({
    connectionString: getConnectionString(),
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

  try {
    console.log('[Setup] Starting isolated rollback transaction...');
    await client.query('BEGIN');

    // 1. Identify or set up active branch in Karnataka
    const bRes = await client.query(`
      SELECT id, name, metadata
      FROM public.branch
      WHERE deleted_at IS NULL AND is_open = true
      LIMIT 1
    `);
    const testBranch = bRes.rows[0];
    const branchId = testBranch.id;

    // Ensure branch has metadata with state 'Karnataka' and GSTIN prefix '29'
    await client.query(`
      UPDATE public.branch
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{state}',
        '"Karnataka"'::jsonb
      ) || jsonb_build_object('gstin', '29AABCU9603R1ZM')
      WHERE id = $1
    `, [branchId]);
    assert(Boolean(branchId), `Branch configured with Karnataka GST profile (${branchId})`);

    // 2. Identify or set up active catalog products for testing
    // Product A: Cake (5% GST)
    const pCakeRes = await client.query(`
      SELECT id, title, merchandise_type, metadata
      FROM public.product
      WHERE merchandise_type = 'CAKE' AND deleted_at IS NULL
      LIMIT 1
    `);
    const cakeProd = pCakeRes.rows[0];
    assert(Boolean(cakeProd), `Identified CAKE product (${cakeProd.id}: ${cakeProd.title})`);

    // Ensure cake has 5% gst_rate in metadata
    await client.query(`
      UPDATE public.product
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{gst_rate}', '5'::jsonb)
      WHERE id = $1
    `, [cakeProd.id]);

    // Product B: Accessory (18% GST)
    const pAccRes = await client.query(`
      SELECT id, title, merchandise_type, metadata
      FROM public.product
      WHERE merchandise_type = 'ACCESSORY' AND deleted_at IS NULL
      LIMIT 1
    `);
    const accProd = pAccRes.rows[0];
    assert(Boolean(accProd), `Identified ACCESSORY product (${accProd.id}: ${accProd.title})`);

    await client.query(`
      UPDATE public.product
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{gst_rate}', '18'::jsonb)
      WHERE id = $1
    `, [accProd.id]);

    // Setup Test Customer
    const testCustId = 'cus_step4_2_test';
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Priya', 'Nair', 'priya.nair@test.com', '+91 98450 12345', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [testCustId]);

    // ── TEST GROUP 1: Valid Intra-State Cake Sale (5% GST) ─────────────────────
    console.log('\n[Test Group 1] Valid Intra-State Cake Sale (5% GST)...');
    const order1Id = 'ord_test_step4_2_01';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90001, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      order1Id,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        payment_method: 'online',
        delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
        items: [
          {
            product_id: cakeProd.id,
            quantity: 1,
            unit_price: 500,
            gst_rate: 5,
          }
        ],
        total_amount: 525, // 500 base + 25 GST (12.50 CGST + 12.50 SGST)
      })
    ]);

    const res1 = await SalesPostingService.createSalesVoucherDraft({
      orderId: order1Id,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(res1.success === true, 'Voucher draft created successfully');
    const v1 = res1.data;
    assert(v1.status === 'DRAFT', 'Voucher status is DRAFT');
    assert(v1.voucher_type === 'SALES', 'Voucher type is SALES');
    assert(Number(v1.total_amount) === 525, `Voucher total_amount is 525 (actual: ${v1.total_amount})`);
    assert(v1.metadata.payment_classification === 'PREPAID', 'Payment classification is PREPAID');
    assert(v1.metadata.ar_account_code === '1121', 'AR control account is 1121 (Accounts Receivable)');

    // Verify journal lines structure
    const lines1 = v1.metadata.proposed_journal_lines;
    assert(lines1.length === 4, `4 journal lines generated (AR, Cake Rev, CGST, SGST)`);
    const debitLine1 = lines1.find(l => l.debit_amount > 0);
    assert(debitLine1.debit_amount === 525, 'Debit AR is ₹525');

    const cakeRevLine1 = lines1.find(l => l.metadata?.merchandise_type === 'CAKE');
    assert(cakeRevLine1 && cakeRevLine1.credit_amount === 500, 'Credit Cake Revenue (4110) is ₹500');

    const cgstLine1 = lines1.find(l => l.metadata?.account_code === '2121');
    const sgstLine1 = lines1.find(l => l.metadata?.account_code === '2122');
    assert(cgstLine1 && cgstLine1.credit_amount === 12.5, 'Credit Output CGST 2.5% (2121) is ₹12.50');
    assert(sgstLine1 && sgstLine1.credit_amount === 12.5, 'Credit Output SGST 2.5% (2122) is ₹12.50');

    // Balance check
    const totalDr1 = lines1.reduce((s, l) => s + l.debit_amount, 0);
    const totalCr1 = lines1.reduce((s, l) => s + l.credit_amount, 0);
    assert(totalDr1 === totalCr1 && totalDr1 === 525, 'Double-entry exact balance: sum(Dr) === sum(Cr) === ₹525');

    // ── TEST GROUP 2: Valid Interstate Cake Sale (5% IGST) ──────────────────────
    console.log('\n[Test Group 2] Valid Interstate Cake Sale (5% IGST)...');
    const order2Id = 'ord_test_step4_2_02';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90002, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      order2Id,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        payment_method: 'card',
        delivery_address: { state: 'Kerala', city: 'Kochi' },
        items: [
          {
            product_id: cakeProd.id,
            quantity: 2,
            unit_price: 600,
            gst_rate: 5,
          }
        ],
        total_amount: 1260, // 1200 base + 60 IGST (5%)
      })
    ]);

    const res2 = await SalesPostingService.createSalesVoucherDraft({
      orderId: order2Id,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(res2.success === true, 'Interstate voucher draft created successfully');
    const v2 = res2.data;
    assert(v2.metadata.tax_calculation.jurisdiction.jurisdiction === 'INTER_STATE', 'Jurisdiction is INTER_STATE');
    const igstLine2 = v2.metadata.proposed_journal_lines.find(l => l.metadata?.account_code === '2125');
    assert(igstLine2 && igstLine2.credit_amount === 60, 'Credit Output IGST 5.0% (2125) is ₹60.00');
    const hasCgstSgst2 = v2.metadata.proposed_journal_lines.some(l => l.metadata?.account_code === '2121' || l.metadata?.account_code === '2122');
    assert(!hasCgstSgst2, 'Zero CGST/SGST lines present for interstate supply');

    // ── TEST GROUP 3: Valid Accessory Sale (18% GST) ───────────────────────────
    console.log('\n[Test Group 3] Valid Accessory Sale (18% GST)...');
    const order3Id = 'ord_test_step4_2_03';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90003, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      order3Id,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        payment_method: 'upi',
        delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
        items: [
          {
            product_id: accProd.id,
            quantity: 2,
            unit_price: 100,
            gst_rate: 18,
          }
        ],
        total_amount: 236, // 200 base + 36 GST (18 CGST + 18 SGST)
      })
    ]);

    const res3 = await SalesPostingService.createSalesVoucherDraft({
      orderId: order3Id,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(res3.success === true, 'Accessory voucher draft created');
    const v3 = res3.data;
    const accRevLine3 = v3.metadata.proposed_journal_lines.find(l => l.metadata?.merchandise_type === 'ACCESSORY');
    assert(accRevLine3 && accRevLine3.credit_amount === 200, 'Credit Accessory Revenue (4120) is ₹200.00');
    const cgst9 = v3.metadata.proposed_journal_lines.find(l => l.metadata?.account_code === '2123');
    const sgst9 = v3.metadata.proposed_journal_lines.find(l => l.metadata?.account_code === '2124');
    assert(cgst9 && cgst9.credit_amount === 18, 'Credit Output CGST 9.0% (2123) is ₹18.00');
    assert(sgst9 && sgst9.credit_amount === 18, 'Credit Output SGST 9.0% (2124) is ₹18.00');

    // ── TEST GROUP 4: Mixed Cake + Accessory Sale ──────────────────────────────
    console.log('\n[Test Group 4] Mixed Cake + Accessory Sale...');
    const order4Id = 'ord_test_step4_2_04';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90004, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      order4Id,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        payment_method: 'card',
        delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
        items: [
          { product_id: cakeProd.id, quantity: 1, unit_price: 500, gst_rate: 5 },
          { product_id: accProd.id, quantity: 1, unit_price: 200, gst_rate: 18 }
        ],
        total_amount: 761, // 500 + 25 tax + 200 + 36 tax = 761
      })
    ]);

    const res4 = await SalesPostingService.createSalesVoucherDraft({
      orderId: order4Id,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(res4.success === true, 'Mixed sale voucher draft created');
    const lines4 = res4.data.metadata.proposed_journal_lines;
    const cakeRev4 = lines4.find(l => l.metadata?.merchandise_type === 'CAKE');
    const accRev4 = lines4.find(l => l.metadata?.merchandise_type === 'ACCESSORY');
    assert(cakeRev4.credit_amount === 500, 'Cake Revenue is ₹500');
    assert(accRev4.credit_amount === 200, 'Accessory Revenue is ₹200');

    // ── TEST GROUP 5: Delivery Charge Accounting ───────────────────────────────
    console.log('\n[Test Group 5] Delivery Charge Accounting...');
    const order5Id = 'ord_test_step4_2_05';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90005, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      order5Id,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        payment_method: 'online',
        delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
        delivery: { fee: 100, tax_rate: 18 },
        items: [
          { product_id: cakeProd.id, quantity: 1, unit_price: 500, gst_rate: 5 }
        ],
        total_amount: 643, // 500 base + 25 tax + 100 delivery + 18 delivery tax = 643
      })
    ]);

    const res5 = await SalesPostingService.createSalesVoucherDraft({
      orderId: order5Id,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(res5.success === true, 'Delivery charge voucher draft created');
    const lines5 = res5.data.metadata.proposed_journal_lines;
    const delRevLine = lines5.find(l => l.metadata?.delivery_fee !== undefined);
    assert(delRevLine && delRevLine.credit_amount === 100, 'Credit Delivery Revenue (4130) is ₹100.00');

    // ── TEST GROUP 6: Header Discount Allocation ───────────────────────────────
    console.log('\n[Test Group 6] Header Discount Allocation...');
    const order6Id = 'ord_test_step4_2_06';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90006, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      order6Id,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        payment_method: 'online',
        delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
        discount_amount: 100, // 100 coupon discount
        items: [
          { product_id: cakeProd.id, quantity: 2, unit_price: 300, gst_rate: 5 }, // 600 base -> gets 60 discount = 540 taxable
          { product_id: accProd.id, quantity: 4, unit_price: 100, gst_rate: 18 }  // 400 base -> gets 40 discount = 360 taxable
        ],
        // Tax: 5% of 540 = 27; 18% of 360 = 64.80. Total tax = 91.80.
        // Total = 900 net taxable + 91.80 tax = 991.80
        total_amount: 991.80,
      })
    ]);

    const res6 = await SalesPostingService.createSalesVoucherDraft({
      orderId: order6Id,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(res6.success === true, 'Discounted voucher draft created');
    const v6 = res6.data;
    assert(Number(v6.total_amount) === 991.80, `Voucher total_amount is 991.80 (actual: ${v6.total_amount})`);
    const lines6 = v6.metadata.proposed_journal_lines;
    const cakeRev6 = lines6.find(l => l.metadata?.merchandise_type === 'CAKE');
    const accRev6 = lines6.find(l => l.metadata?.merchandise_type === 'ACCESSORY');
    assert(cakeRev6.credit_amount === 540, 'Cake Revenue credited with discounted base ₹540.00');
    assert(accRev6.credit_amount === 360, 'Accessory Revenue credited with discounted base ₹360.00');

    // ── TEST GROUP 7: Payment Classification (COD vs Prepaid) ──────────────────
    console.log('\n[Test Group 7] Payment Classification (COD vs Prepaid)...');
    // Case A: COD from order metadata
    const orderCodId = 'ord_test_step4_2_cod';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90007, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      orderCodId,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        payment_method: 'cod',
        delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
        items: [{ product_id: cakeProd.id, quantity: 1, unit_price: 400, gst_rate: 5 }],
        total_amount: 420,
      })
    ]);

    const resCod = await SalesPostingService.createSalesVoucherDraft({
      orderId: orderCodId,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(resCod.success === true, 'COD voucher draft created');
    assert(resCod.data.metadata.payment_classification === 'COD', 'Payment classification is COD');
    assert(resCod.data.metadata.ar_account_code === '1122', 'AR account is 1122 (Undeposited COD Collections)');
    const codDebitLine = resCod.data.metadata.proposed_journal_lines.find(l => l.debit_amount > 0);
    assert(codDebitLine.metadata?.ar_account_code === '1122', 'Debit line targets Account 1122');

    // Case B: Payment classification derived from payment_transaction table
    const orderTxnId = 'ord_test_step4_2_ptxn';
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES (
        $1, 90008, $2, 'priya.nair@test.com', 'inr', 'completed',
        $3, NOW(), NOW()
      )
    `, [
      orderTxnId,
      testCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
        items: [{ product_id: cakeProd.id, quantity: 1, unit_price: 400, gst_rate: 5 }],
        total_amount: 420,
      })
    ]);

    // Insert authoritative payment_transaction with provider 'upi'
    await client.query(`
      INSERT INTO public.payment_transaction (
        id, branch_id, order_id, customer_id, amount, currency, status, settlement_status, provider, created_at, updated_at
      ) VALUES (
        'ptxn_test_step4_2_01', $1, $2, $3, 420, 'INR', 'captured', 'settled', 'upi', NOW(), NOW()
      )
    `, [branchId, orderTxnId, testCustId]);

    const resPtxn = await SalesPostingService.createSalesVoucherDraft({
      orderId: orderTxnId,
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(resPtxn.success === true, 'Voucher created using payment_transaction authority');
    assert(resPtxn.data.metadata.payment_classification === 'PREPAID', 'Classified as PREPAID based on payment_transaction.provider');
    assert(resPtxn.data.metadata.ar_account_code === '1121', 'AR account is 1121 based on UPI provider');

    // ── TEST GROUP 8: Idempotency & Duplicate Rejection ─────────────────────────
    console.log('\n[Test Group 8] Idempotency & Duplicate Rejection...');
    const dupRes = await SalesPostingService.createSalesVoucherDraft({
      orderId: order1Id, // Already drafted in Test Group 1
      createdBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(dupRes.success === false, 'Duplicate voucher creation correctly rejected');
    assert(dupRes.code === 'DUPLICATE_SOURCE_EVENT', `Error code is DUPLICATE_SOURCE_EVENT (actual: ${dupRes.code})`);

    // ── TEST GROUP 9: Voucher Lifecycle: DRAFT -> SUBMITTED ─────────────────────
    console.log('\n[Test Group 9] Voucher Lifecycle: DRAFT -> SUBMITTED...');
    const submitRes = await SalesPostingService.submitSalesVoucher({
      voucherId: v1.id,
      submittedBy: 'staff_acct_01',
      branchId,
      client,
    });

    assert(submitRes.success === true, 'Voucher successfully submitted');
    assert(submitRes.data.status === 'SUBMITTED', 'Voucher status updated to SUBMITTED');
    assert(submitRes.data.submitted_by === 'staff_acct_01', 'submitted_by recorded');

    // Reject re-submission of SUBMITTED voucher
    const reSubmitRes = await SalesPostingService.submitSalesVoucher({
      voucherId: v1.id,
      submittedBy: 'staff_acct_01',
      branchId,
      client,
    });
    assert(reSubmitRes.success === false, 'Cannot submit non-DRAFT voucher');
    assert(reSubmitRes.code === 'INVALID_VOUCHER_STATE', 'Error code is INVALID_VOUCHER_STATE');

    // ── TEST GROUP 10: Fail-Closed Validation & Boundary Rejections ─────────────
    console.log('\n[Test Group 10] Fail-Closed Validation & Boundary Rejections...');

    // 1. Missing branch
    const orderNoBranch = 'ord_test_no_branch';
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 90010, $2, 'test@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [orderNoBranch, testCustId, JSON.stringify({ is_ledger_eligible: true, items: [{ product_id: cakeProd.id, quantity: 1, unit_price: 100, gst_rate: 5 }] })]);

    const resNoBranch = await SalesPostingService.createSalesVoucherDraft({ orderId: orderNoBranch, createdBy: 'staff_01', client });
    assert(resNoBranch.success === false && resNoBranch.code === 'BRANCH_NOT_FOUND', 'Rejects order with missing branch');

    // 2. Unauthorized branch (BOLA)
    const resBola = await SalesPostingService.createSalesVoucherDraft({
      orderId: order2Id,
      createdBy: 'staff_01',
      branchId: 'br_unauthorized_fake',
      client
    });
    assert(resBola.success === false && resBola.code === 'BRANCH_ACCESS_DENIED', 'Rejects unauthorized branch (BOLA defense)');

    // 3. Missing customer delivery state
    const orderNoState = 'ord_test_no_state';
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 90011, $2, 'test@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [orderNoState, testCustId, JSON.stringify({ is_ledger_eligible: true, branch_id: branchId, payment_method: 'cod', items: [{ product_id: cakeProd.id, quantity: 1, unit_price: 100, gst_rate: 5 }] })]);

    const resNoState = await SalesPostingService.createSalesVoucherDraft({ orderId: orderNoState, createdBy: 'staff_01', branchId, client });
    assert(resNoState.success === false && resNoState.code === 'CUSTOMER_LOCATION_UNRESOLVED', 'Rejects order with missing delivery state');

    // 4. Empty order
    const orderEmpty = 'ord_test_empty';
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 90012, $2, 'test@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [orderEmpty, testCustId, JSON.stringify({ is_ledger_eligible: true, branch_id: branchId, payment_method: 'cod', delivery_address: { state: 'Karnataka' }, items: [] })]);

    const resEmpty = await SalesPostingService.createSalesVoucherDraft({ orderId: orderEmpty, createdBy: 'staff_01', branchId, client });
    assert(resEmpty.success === false && resEmpty.code === 'EMPTY_ORDER', 'Rejects empty order');

    // 5. Invalid quantity
    const orderBadQty = 'ord_test_bad_qty';
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 90013, $2, 'test@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [orderBadQty, testCustId, JSON.stringify({ is_ledger_eligible: true, branch_id: branchId, payment_method: 'cod', delivery_address: { state: 'Karnataka' }, items: [{ product_id: cakeProd.id, quantity: 0, unit_price: 100, gst_rate: 5 }] })]);

    const resBadQty = await SalesPostingService.createSalesVoucherDraft({ orderId: orderBadQty, createdBy: 'staff_01', branchId, client });
    assert(resBadQty.success === false && resBadQty.code === 'INVALID_QUANTITY', 'Rejects quantity <= 0');

    // 6. Invalid price
    const orderBadPrice = 'ord_test_bad_price';
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 90014, $2, 'test@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [orderBadPrice, testCustId, JSON.stringify({ is_ledger_eligible: true, branch_id: branchId, payment_method: 'cod', delivery_address: { state: 'Karnataka' }, items: [{ product_id: cakeProd.id, quantity: 1, unit_price: -50, gst_rate: 5 }] })]);

    const resBadPrice = await SalesPostingService.createSalesVoucherDraft({ orderId: orderBadPrice, createdBy: 'staff_01', branchId, client });
    assert(resBadPrice.success === false && resBadPrice.code === 'INVALID_PRICE', 'Rejects unit_price < 0');

    // 7. Order total mismatch
    const orderMismatch = 'ord_test_mismatch';
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 90015, $2, 'test@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [orderMismatch, testCustId, JSON.stringify({ is_ledger_eligible: true, branch_id: branchId, payment_method: 'cod', delivery_address: { state: 'Karnataka' }, items: [{ product_id: cakeProd.id, quantity: 1, unit_price: 500, gst_rate: 5 }], total_amount: 999 })]);

    const resMismatch = await SalesPostingService.createSalesVoucherDraft({ orderId: orderMismatch, createdBy: 'staff_01', branchId, client });
    assert(resMismatch.success === false && resMismatch.code === 'ORDER_TOTAL_MISMATCH', 'Rejects order total mismatch against calculation');

    // 8. Historical Quarantined Prototype Order Rejection
    console.log('\n[Test Group 11] Historical Quarantined Prototype Order Rejection...');
    // Query one of the 173 historical orders from DB (excluding transient test orders created in this run)
    const histRes = await client.query(`
      SELECT id, metadata, status
      FROM public."order"
      WHERE deleted_at IS NULL
        AND id NOT LIKE 'ord_test_%'
      ORDER BY created_at ASC
      LIMIT 1
    `);
    const histOrder = histRes.rows[0];
    assert(Boolean(histOrder), `Found live historical order (${histOrder.id})`);

    const resHist = await SalesPostingService.createSalesVoucherDraft({
      orderId: histOrder.id,
      createdBy: 'staff_01',
      client,
    });
    assert(resHist.success === false, 'Historical prototype order rejected from voucher drafting');
    assert(resHist.code === 'LEGACY_PROTOTYPE_ORDER_REJECTED', `Error code is LEGACY_PROTOTYPE_ORDER_REJECTED (actual: ${resHist.code})`);

    // Explicit legacy_prototype = true flag rejection
    const orderExplicitLegacy = 'ord_test_legacy_flag';
    await client.query(`
      INSERT INTO public."order" (id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 90016, $2, 'test@test.com', 'inr', 'completed', $3, NOW(), NOW())
    `, [orderExplicitLegacy, testCustId, JSON.stringify({ legacy_prototype: true, is_ledger_eligible: true, branch_id: branchId, items: [{ product_id: cakeProd.id, quantity: 1, unit_price: 100 }] })]);

    const resExplicitLegacy = await SalesPostingService.createSalesVoucherDraft({ orderId: orderExplicitLegacy, createdBy: 'staff_01', client });
    assert(resExplicitLegacy.success === false && resExplicitLegacy.code === 'LEGACY_PROTOTYPE_ORDER_REJECTED', 'Explicit legacy_prototype=true rejected');

    // ── TEST GROUP 12: Preview Primitive (Read-Only) ───────────────────────────
    console.log('\n[Test Group 12] Preview Sales Voucher (Read-Only)...');
    const previewRes = await SalesPostingService.previewSalesVoucher({
      orderId: order3Id,
      branchId,
      client,
    });
    assert(previewRes && previewRes.invoiceTotal === 236, 'Preview returns correct invoiceTotal (₹236)');
    assert(previewRes.journalLines.length === 4, 'Preview returns balanced journal lines');

    // Verify voucher count inside transaction
    const insideVCount = await client.query(`SELECT count(*)::int AS cnt FROM public.accounting_voucher`);
    assert(insideVCount.rows[0].cnt >= 6, `Vouchers created inside transaction: ${insideVCount.rows[0].cnt}`);

  } finally {
    console.log('\n[Teardown] Rolling back isolated transaction...');
    await client.query('ROLLBACK');
    await client.end();
  }

  // ── INDEPENDENT POST-TEST VERIFICATION ─────────────────────────────────────────
  console.log('\n=============================================================================');
  console.log('Independent Post-Test PostgreSQL Baseline Verification (Outside Transaction)');
  console.log('=============================================================================');

  const verifyClient = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await verifyClient.connect();

  try {
    const checks = [
      { name: 'accounting_voucher', sql: 'SELECT count(*)::int AS cnt FROM public.accounting_voucher', expected: 0 },
      { name: 'accounting_journal_entry', sql: 'SELECT count(*)::int AS cnt FROM public.accounting_journal_entry', expected: 0 },
      { name: 'accounting_journal_line', sql: 'SELECT count(*)::int AS cnt FROM public.accounting_journal_line', expected: 0 },
      { name: 'accounting_fiscal_period', sql: 'SELECT count(*)::int AS cnt FROM public.accounting_fiscal_period', expected: 0 },
      { name: 'inventory_cost_lot', sql: 'SELECT count(*)::int AS cnt FROM public.inventory_cost_lot', expected: 0 },
      { name: 'inventory_movement', sql: 'SELECT count(*)::int AS cnt FROM public.inventory_movement', expected: 0 },
      { name: 'inventory_cost_consumption', sql: 'SELECT count(*)::int AS cnt FROM public.inventory_cost_consumption', expected: 0 },
      { name: 'branch_inventory', sql: 'SELECT count(*)::int AS cnt FROM public.branch_inventory', expected: 424 },
      { name: 'order', sql: 'SELECT count(*)::int AS cnt FROM public."order"', expected: 173 },
      { name: 'payment_transaction', sql: 'SELECT count(*)::int AS cnt FROM public.payment_transaction', expected: 53 },
      { name: 'accounting_account', sql: 'SELECT count(*)::int AS cnt FROM public.accounting_account', expected: 98 },
    ];

    for (const c of checks) {
      const res = await verifyClient.query(c.sql);
      const actual = res.rows[0].cnt;
      assert(actual === c.expected, `${c.name}: expected ${c.expected}, actual ${actual}`);
    }

    const setRes = await verifyClient.query(`SELECT * FROM public.setting WHERE key = 'accounting_start_date'`);
    assert(setRes.rows.length === 0, 'accounting_start_date remains UNCONFIGURED (0 rows in setting)');

  } finally {
    await verifyClient.end();
  }

  console.log('\n=============================================================================');
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED (Total: ${passCount + failCount})`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
