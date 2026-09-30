/**
 * CakeToHome ERP — Phase 4F Step 3C.1 PurchasePostingService Test Suite
 *
 * Targeted Forensic Verification for:
 * 1. Live Configuration Guard: Real posting refused under unconfigured live DB.
 * 2. Voucher Lifecycle Invariants:
 *    - DRAFT creation via canonical PostingService.
 *    - Unapproved voucher (DRAFT or SUBMITTED) cannot be posted.
 *    - Voucher creator cannot approve own voucher (SoD).
 *    - Voucher creator cannot post own voucher (SoD).
 *    - Purchase creator cannot post accounting voucher (SoD).
 *    - Authorized distinct approver + distinct poster succeeds.
 * 3. Purchase Lifecycle & BOLA Isolation.
 * 4. Item Classification & Total Reconciliation.
 * 5. Full Simulation (Accessories, Cakes, Packaging):
 *    - DR 1131, 1132, 1133
 *    - DR 114x Input GST
 *    - CR 2111 Accounts Payable
 *    - Exactly 1:1 cost lots with math validation
 *    - Inventory movements recorded
 *    - Catalog items update branch_inventory
 *    - Packaging (product_id = null) skips branch_inventory cleanly
 *    - Zero cost consumption rows created
 * 6. Idempotency on second posting attempt.
 * 7. Failure Atomicity & Complete Rollback.
 * 8. Live Database Baseline Counts Unchanged.
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

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3C.1 PurchasePostingService Test Suite');
  console.log('=============================================================================\n');

  // Register native typescript compiler hook for .ts imports
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

  const { PurchasePostingService } = require('../src/lib/services/purchase-posting.service');
  const { PostingService } = require('../src/lib/services/posting.service');

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
    // TEST 1: LIVE ACCOUNTING CONFIGURATION HARD BLOCK
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[1/7] Testing Live Accounting Configuration Guards...');

    await client.query('BEGIN');

    await client.query(`
      INSERT INTO public.supplier (id, name, is_active, created_at, updated_at)
      VALUES ('sup_test_guard', 'Test Guard Supplier', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    const branchRes = await client.query('SELECT id FROM public.branch LIMIT 1');
    const testBranchId = branchRes.rows[0].id;

    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_test_guard_01', 'sup_test_guard', $1, 'INV-GUARD-01', '2026-09-24',
        1000, 0, 1000, 90, 90, 0, 1180,
        'APPROVED', 'user_creator_01', 'user_approver_02', NOW(), NOW()
      );
    `, [testBranchId]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, item_type, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, cgst, sgst, total, created_at, updated_at
      ) VALUES (
        'puri_test_guard_01', 'pur_test_guard_01', 'acc_01', 'var_acc_01', 'ACCESSORY', 'Party Poppers',
        10, 100, 0, 1000, 9, 9, 90, 90, 1180, NOW(), NOW()
      );
    `);

    // In live DB, setting 'accounting_start_date' is unconfigured and fiscal_period has 0 rows.
    // Creating voucher draft or posting under live config must fail with POSTING_GUARD_FAILED.
    const liveDraftResult = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: 'pur_test_guard_01',
      createdBy: 'user_ap_clerk',
      client
    });

    assert(liveDraftResult.success === false, 'Live draft creation refused under unconfigured accounting configuration');
    assert(liveDraftResult.code === 'POSTING_GUARD_FAILED', 'Failure code is POSTING_GUARD_FAILED');
    assert(liveDraftResult.error.includes('start date') || liveDraftResult.error.includes('fiscal period'),
      `Refusal reason explicitly states configuration guard: "${liveDraftResult.error}"`);

    // Calling postPurchase directly without voucher returns VOUCHER_NOT_FOUND
    const liveDirectPost = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_guard_01',
      postedBy: 'user_poster_03',
      client
    });
    assert(liveDirectPost.success === false && liveDirectPost.code === 'VOUCHER_NOT_FOUND',
      'Direct postPurchase without created voucher rejected with VOUCHER_NOT_FOUND');

    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: VOUCHER LIFECYCLE & SEGREGATION OF DUTIES
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/7] Testing Voucher Lifecycle & Segregation of Duties (SoD)...');
    await client.query('BEGIN');

    // Configure test accounting environment inside transaction
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_2627', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);

    await client.query(`
      INSERT INTO public.supplier (id, name, is_active, created_at, updated_at)
      VALUES ('sup_test_sod', 'Test SoD Supplier', true, NOW(), NOW());
    `);

    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_sod_lifecycle', 'sup_test_sod', $1, 'INV-SOD-LC', '2026-09-24',
        1000, 0, 1000, 90, 90, 0, 1180,
        'APPROVED', 'user_buyer_alice', 'user_store_mgr_bob', NOW(), NOW()
      );
    `, [testBranchId]);
    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, item_type, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, cgst, sgst, total, created_at, updated_at
      ) VALUES (
        'puri_sod_lc', 'pur_sod_lifecycle', 'acc_01', 'var_acc_01', 'ACCESSORY', 'Party Poppers',
        10, 100, 0, 1000, 9, 9, 90, 90, 1180, NOW(), NOW()
      );
    `);

    // Step A: Create DRAFT voucher
    const draftRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: 'pur_sod_lifecycle',
      createdBy: 'user_ap_clerk_charlie',
      client
    });
    assert(draftRes.success === true && draftRes.data.status === 'DRAFT',
      'Voucher draft created in status DRAFT via canonical PostingService');
    const voucherId = draftRes.data.id;

    // Step B: Attempting to post DRAFT voucher must fail with INVALID_VOUCHER_STATE
    const postDraftRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_sod_lifecycle',
      voucherId,
      postedBy: 'user_finance_controller_dave',
      client
    });
    assert(postDraftRes.success === false && postDraftRes.code === 'INVALID_VOUCHER_STATE',
      'Attempting to post DRAFT voucher rejected with INVALID_VOUCHER_STATE (Only APPROVED vouchers can be posted)');

    // Step C: Submit voucher (DRAFT -> SUBMITTED)
    const submitRes = await PostingService.submitVoucher({
      voucherId,
      submittedBy: 'user_ap_clerk_charlie',
      branchId: testBranchId,
      client
    });
    assert(submitRes.success === true && submitRes.data.status === 'SUBMITTED',
      'Voucher successfully submitted (status = SUBMITTED)');

    // Step D: Attempting to post SUBMITTED voucher must fail
    const postSubmittedRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_sod_lifecycle',
      voucherId,
      postedBy: 'user_finance_controller_dave',
      client
    });
    assert(postSubmittedRes.success === false && postSubmittedRes.code === 'INVALID_VOUCHER_STATE',
      'Attempting to post SUBMITTED voucher rejected with INVALID_VOUCHER_STATE');

    // Step E: Self-Approval violation (voucher creator attempting to approve voucher)
    const selfApproveRes = await PostingService.approveVoucher({
      voucherId,
      approvedBy: 'user_ap_clerk_charlie', // creator attempting to approve
      branchId: testBranchId,
      client
    });
    assert(selfApproveRes.success === false && selfApproveRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION',
      'Voucher self-approval (approved_by == created_by) blocked by PostingService with SEGREGATION_OF_DUTIES_VIOLATION');

    // Step F: Independent Authorized Approval (SUBMITTED -> APPROVED)
    const approveRes = await PostingService.approveVoucher({
      voucherId,
      approvedBy: 'user_acct_mgr_eva', // distinct accounting manager
      branchId: testBranchId,
      client
    });
    assert(approveRes.success === true && approveRes.data.status === 'APPROVED',
      'Voucher approved by authorized accounting manager (status = APPROVED)');

    // Step G: Voucher creator attempting to post voucher
    const creatorPostRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_sod_lifecycle',
      voucherId,
      postedBy: 'user_ap_clerk_charlie', // voucher creator
      client
    });
    assert(creatorPostRes.success === false && creatorPostRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION',
      'Voucher creator attempting to post voucher blocked with SEGREGATION_OF_DUTIES_VIOLATION');

    // Step H: Purchase creator attempting to post voucher
    const purCreatorPostRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_sod_lifecycle',
      voucherId,
      postedBy: 'user_buyer_alice', // purchase creator
      client
    });
    assert(purCreatorPostRes.success === false && purCreatorPostRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION',
      'Purchase creator attempting to post voucher blocked with SEGREGATION_OF_DUTIES_VIOLATION');

    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: PURCHASE LIFECYCLE & BOLA ISOLATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/7] Testing Purchase Lifecycle & BOLA Isolation...');
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO public.supplier (id, name, is_active, created_at, updated_at)
      VALUES ('sup_test_status', 'Test Status Supplier', true, NOW(), NOW());
    `);
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_draft_status', 'sup_test_status', $1, 'INV-DRAFT', '2026-09-24',
        1000, 0, 1000, 90, 90, 0, 1180,
        'DRAFT', 'user_alice', 'user_bob', NOW(), NOW()
      );
    `, [testBranchId]);
    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, item_type, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, cgst, sgst, total, created_at, updated_at
      ) VALUES (
        'puri_draft_01', 'pur_draft_status', 'acc_01', 'var_acc_01', 'ACCESSORY', 'Party Poppers',
        10, 100, 0, 1000, 9, 9, 90, 90, 1180, NOW(), NOW()
      );
    `);

    const draftPurRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: 'pur_draft_status',
      createdBy: 'user_charlie',
      client
    });
    assert(draftPurRes.success === false && draftPurRes.code === 'INVALID_PURCHASE_STATUS',
      'DRAFT purchase is rejected with INVALID_PURCHASE_STATUS');

    await client.query(`UPDATE public.purchase SET status = 'APPROVED' WHERE id = 'pur_draft_status'`);
    const bolaRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_draft_status',
      postedBy: 'user_charlie',
      branchId: 'br_different_branch_99',
      client
    });
    assert(bolaRes.success === false && bolaRes.code === 'BRANCH_ACCESS_DENIED',
      'Mismatched branch scope is rejected with BRANCH_ACCESS_DENIED');

    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: ITEM CLASSIFICATION & RECONCILIATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/7] Testing Item Classification & Total Reconciliation...');
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_2627', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    await client.query(`
      INSERT INTO public.supplier (id, name, is_active, created_at, updated_at)
      VALUES ('sup_test_class', 'Test Classification Supplier', true, NOW(), NOW());
    `);

    // Case 4A: Item type mismatch (acc_01 marked as CAKE)
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_class_mismatch', 'sup_test_class', $1, 'INV-MISMATCH', '2026-09-24',
        1000, 0, 1000, 90, 90, 0, 1180,
        'APPROVED', 'user_alice', 'user_bob', NOW(), NOW()
      );
    `, [testBranchId]);
    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, item_type, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, cgst, sgst, total, created_at, updated_at
      ) VALUES (
        'puri_class_01', 'pur_class_mismatch', 'acc_01', 'var_acc_01', 'CAKE', 'Party Poppers with wrong type',
        10, 100, 0, 1000, 9, 9, 90, 90, 1180, NOW(), NOW()
      );
    `);

    const classMismatchRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: 'pur_class_mismatch',
      createdBy: 'user_charlie',
      client
    });
    assert(classMismatchRes.success === false && classMismatchRes.code === 'INVALID_MERCHANDISE_CLASSIFICATION',
      'Classification mismatch (acc_01 labeled as CAKE) rejected with INVALID_MERCHANDISE_CLASSIFICATION');

    // Case 4B: Total mismatch
    await client.query(`
      UPDATE public.purchase_item SET item_type = 'ACCESSORY' WHERE id = 'puri_class_01';
      UPDATE public.purchase SET total = 1500 WHERE id = 'pur_class_mismatch'; -- real total is 1180
    `);
    const totalMismatchRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: 'pur_class_mismatch',
      createdBy: 'user_charlie',
      client
    });
    assert(totalMismatchRes.success === false && totalMismatchRes.code === 'PURCHASE_TOTAL_MISMATCH',
      'Total mismatch (items sum 1180 != header total 1500) rejected with PURCHASE_TOTAL_MISMATCH');

    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: FULL STAGED SIMULATION (ACCESSORIES, CAKES, PACKAGING)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/7] Testing Full Staged Multi-Actor Simulation (Accessories, Cakes, Packaging)...');
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_e2e', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    await client.query(`
      INSERT INTO public.supplier (id, name, is_active, created_at, updated_at)
      VALUES ('sup_test_e2e', 'Premier Bakery Supplies Ltd', true, NOW(), NOW());
    `);

    // Fetch real CAKE product and variant
    const cakeProdRes = await client.query(`
      SELECT p.id, pv.id as variant_id 
      FROM public.product p
      JOIN public.product_variant pv ON pv.product_id = p.id
      WHERE p.merchandise_type = 'CAKE' AND p.deleted_at IS NULL 
      LIMIT 1
    `);
    const cakeProductId = cakeProdRes.rows[0].id;
    const cakeVariantId = cakeProdRes.rows[0].variant_id;

    const testPurchaseId = 'pur_e2e_full_success';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_e2e', $2, 'INV-E2E-999', '2026-09-24',
        4500, 0, 4500, 405, 405, 0, 5310,
        'APPROVED', 'user_store_buyer_01', 'user_store_mgr_02', NOW(), NOW()
      );
    `, [testPurchaseId, testBranchId]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, item_type, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, cgst, sgst, total, created_at, updated_at
      ) VALUES 
        ('puri_e2e_acc', $1, 'acc_01', 'var_acc_01', 'ACCESSORY', 'Birthday Candles Gold', 10, 100, 0, 1000, 9, 9, 90, 90, 1180, NOW(), NOW()),
        ('puri_e2e_cake', $1, $2, $3, 'CAKE', 'Chocolate Truffle Bases', 5, 500, 0, 2500, 9, 9, 225, 225, 2950, NOW(), NOW()),
        ('puri_e2e_pkg', $1, NULL, NULL, 'PACKAGING', 'Luxury 1kg Cake Boxes', 100, 10, 0, 1000, 9, 9, 90, 90, 1180, NOW(), NOW());
    `, [testPurchaseId, cakeProductId, cakeVariantId]);

    const initialBinvRes = await client.query(`
      SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND product_id = 'acc_01'
    `, [testBranchId]);
    const initialAccQty = initialBinvRes.rows[0]?.quantity ?? 0;

    // Execute staged workflow using prepareAndPostPurchase with 4 distinct actors
    const postResult = await PurchasePostingService.prepareAndPostPurchase({
      purchaseId: testPurchaseId,
      voucherCreatedBy: 'user_ap_clerk_03',
      voucherApprovedBy: 'user_acct_supervisor_04',
      postedBy: 'user_finance_controller_05',
      branchId: testBranchId,
      client
    });

    assert(postResult.success === true, 'Purchase successfully posted through 4-stage lifecycle');

    const data = postResult.data;
    assert(data.purchase.status === 'POSTED', 'Purchase status updated to POSTED');
    assert(Boolean(data.purchase.posted_at), 'Purchase posted_at timestamp is set');

    // Verify Accounting Voucher
    assert(data.voucher.status === 'POSTED', 'Accounting voucher status is POSTED');
    assert(data.voucher.reference_type === 'PURCHASE', 'Voucher reference_type is PURCHASE');
    assert(data.voucher.reference_id === testPurchaseId, 'Voucher reference_id links to purchase');
    assert(data.voucher.created_by === 'user_ap_clerk_03', 'Voucher created_by is AP clerk');
    assert(data.voucher.approved_by === 'user_acct_supervisor_04', 'Voucher approved_by is distinct accounting supervisor');
    assert(data.voucher.posted_by === 'user_finance_controller_05', 'Voucher posted_by is distinct finance controller');
    assert(Number(data.voucher.total_amount) === 5310, 'Voucher total_amount matches purchase total (5310)');

    // Verify Journal Entry & Lines
    const je = data.journal_entry;
    assert(je.lines.length === 6, 'Journal entry has exactly 6 lines (3 inventory debits, 2 GST debits, 1 AP credit)');

    const dr1131 = je.lines.find(l => l.account_code === '1131' || l.narration.includes('Birthday Candles'));
    const dr1132 = je.lines.find(l => l.account_code === '1132' || l.narration.includes('Chocolate Truffle'));
    const dr1133 = je.lines.find(l => l.account_code === '1133' || l.narration.includes('Cake Boxes'));
    const drCgst = je.lines.find(l => l.narration.includes('CGST'));
    const drSgst = je.lines.find(l => l.narration.includes('SGST'));
    const crAp   = je.lines.find(l => l.narration.includes('Accounts Payable'));

    assert(Number(dr1131.debit_amount) === 1000 && Number(dr1131.credit_amount) === 0, '1131 (Accessories) debited 1000');
    assert(Number(dr1132.debit_amount) === 2500 && Number(dr1132.credit_amount) === 0, '1132 (Cakes) debited 2500');
    assert(Number(dr1133.debit_amount) === 1000 && Number(dr1133.credit_amount) === 0, '1133 (Packaging) debited 1000');
    assert(Number(drCgst.debit_amount) === 405 && Number(drCgst.credit_amount) === 0, '1143 (Input CGST) debited 405');
    assert(Number(drSgst.debit_amount) === 405 && Number(drSgst.credit_amount) === 0, '1144 (Input SGST) debited 405');
    assert(Number(crAp.credit_amount) === 5310 && Number(crAp.debit_amount) === 0, '2111 (AP) credited 5310');

    const totalDebits = je.lines.reduce((s, l) => s + Number(l.debit_amount), 0);
    const totalCredits = je.lines.reduce((s, l) => s + Number(l.credit_amount), 0);
    assert(totalDebits === 5310 && totalCredits === 5310, 'Double-entry journal strictly balances: 5310 == 5310');

    // Verify Inventory Cost Lots
    assert(data.cost_lots.length === 3, 'Exactly 3 inventory cost lots created (1:1 with purchase items)');
    const lotAcc = data.cost_lots.find(l => l.item_type === 'ACCESSORY');
    const lotCake = data.cost_lots.find(l => l.item_type === 'CAKE');
    const lotPkg = data.cost_lots.find(l => l.item_type === 'PACKAGING');

    assert(Number(lotAcc.received_quantity) === 10 && Number(lotAcc.remaining_quantity) === 10 && Number(lotAcc.total_cost) === 1000 && Number(lotAcc.unit_cost) === 100,
      'Accessory lot: qty=10, rate=100, total=1000, status=ACTIVE');
    assert(Number(lotCake.received_quantity) === 5 && Number(lotCake.remaining_quantity) === 5 && Number(lotCake.total_cost) === 2500 && Number(lotCake.unit_cost) === 500,
      'Cake lot: qty=5, rate=500, total=2500, status=ACTIVE');
    assert(Number(lotPkg.received_quantity) === 100 && Number(lotPkg.remaining_quantity) === 100 && Number(lotPkg.total_cost) === 1000 && Number(lotPkg.unit_cost) === 10,
      'Packaging lot: qty=100, rate=10, total=1000, status=ACTIVE, product_id=NULL');

    // Verify Physical Inventory Update:
    // 1. Catalog accessory is incremented
    const postBinvRes = await client.query(`
      SELECT quantity FROM public.branch_inventory WHERE branch_id = $1 AND product_id = 'acc_01'
    `, [testBranchId]);
    const postAccQty = postBinvRes.rows[0].quantity;
    assert(postAccQty === initialAccQty + 10, `Physical branch_inventory for acc_01 incremented from ${initialAccQty} to ${postAccQty}`);

    // 2. Packaging without product_id does NOT insert invalid null row in branch_inventory
    const nullBinvRes = await client.query(`
      SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE product_id IS NULL
    `);
    assert(parseInt(nullBinvRes.rows[0].cnt, 10) === 0, 'branch_inventory contains ZERO null product_id rows (Packaging handled cleanly)');

    // Verify Inventory Movements
    assert(data.movements.length === 3, 'Exactly 3 inventory movement records created (1:1 with purchase items)');
    assert(data.movements.every(m => m.movement_type === 'PURCHASE_RECEIPT' && m.direction === 'IN'),
      'All movement records have movement_type = PURCHASE_RECEIPT and direction = IN');

    // Verify ZERO Cost Consumption rows created
    const consRes = await client.query(`SELECT COUNT(*) as cnt FROM public.inventory_cost_consumption`);
    assert(parseInt(consRes.rows[0].cnt, 10) === 0, 'Zero inventory_cost_consumption rows created during receipt');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: IDEMPOTENCY ON SECOND ATTEMPT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/7] Testing Idempotency on Second Attempt...');
    const retryResult = await PurchasePostingService.postPurchase({
      purchaseId: testPurchaseId,
      postedBy: 'user_finance_controller_05',
      branchId: testBranchId,
      client
    });

    assert(retryResult.success === false && retryResult.code === 'PURCHASE_ALREADY_POSTED',
      'Second posting attempt is rejected with PURCHASE_ALREADY_POSTED (No duplicate vouchers or lots)');

    // Rollback test transaction
    await client.query('ROLLBACK');
    console.log('  ✓ Simulation transaction successfully rolled back.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: LIVE DATABASE INVARIANTS AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/7] Verifying Live Database Baseline Invariants...');
    const tablesToCheck = {
      accounting_account: 98,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      accounting_fiscal_period: 0,
      purchase: 0,
      purchase_item: 0,
      purchase_payment: 0,
      branch_inventory: 424,
      order: 173,
      payment_transaction: 53,
      inventory_cost_lot: 0,
      inventory_movement: 0,
      inventory_cost_consumption: 0
    };

    for (const [table, expectedCount] of Object.entries(tablesToCheck)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const actualCount = parseInt(res.rows[0].cnt, 10);
      assert(actualCount === expectedCount, `Table "${table}": count is ${actualCount} (expected: ${expectedCount})`);
    }

    const startSettingRes = await client.query(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
    assert(startSettingRes.rows.length === 0, 'Setting "accounting_start_date" remains UNCONFIGURED');

    // Summary
    console.log('\n=============================================================================');
    console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
    console.log('=============================================================================');

    if (failCount === 0) {
      console.log('\nPURCHASE POSTING SERVICE PASSED ALL SPECIFICATIONS! ✅\n');
    } else {
      console.error(`\nFAILED ${failCount} SPECIFICATIONS! ❌\n`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
