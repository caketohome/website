/**
 * CakeToHome ERP — Phase 4F Step 3D.2 Purchase Accounting Voucher Construction Test Suite
 *
 * SCOPE:
 * Purchase Tax Engine
 *         ↓
 * Validated Purchase Totals
 *         ↓
 * Voucher DRAFT
 *         ↓
 * Journal Entry / Journal Lines
 *         ↓
 * Double-entry validation
 *         ↓
 * SUBMITTED
 *
 * BOUNDARIES PRESERVED:
 * - NO permanent purchases
 * - NO permanent cost lots
 * - NO branch_inventory mutation
 * - NO COGS posting
 * - NO purchase payments / AP settlement
 * - NO fiscal periods configured
 * - NO accounting start date configured
 * - NO packaging products seeded
 * - NO retro-posting historical orders
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
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3D.2 Purchase Accounting Voucher Construction');
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
    console.log('[1/8] Setting up isolated rollback transaction...');
    await client.query('BEGIN');

    // Resolve an existing active branch in Karnataka
    const bRes = await client.query(`
      SELECT b.id, b.name, b.metadata
      FROM public.branch b
      WHERE b.deleted_at IS NULL AND b.metadata->>'state' = 'Karnataka'
      LIMIT 1
    `);
    const branchKa = bRes.rows[0];
    assert(Boolean(branchKa), `Found active Karnataka branch (${branchKa.id})`);

    // Setup Test Suppliers
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES 
        ('sup_test_ka_3d2', 'Karnataka Supplier Ltd', '29AABCU9603R1Z2', 'Karnataka', true, NOW(), NOW()),
        ('sup_test_mh_3d2', 'Maharashtra Packaging Corp', '27AABCU9603R1ZV', 'Maharashtra', true, NOW(), NOW()),
        ('sup_test_unreg_3d2', 'Local Unregistered Vendor', NULL, 'Karnataka', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, gstin = EXCLUDED.gstin, state = EXCLUDED.state;
    `);
    assert(true, 'Test suppliers inserted within transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 1: Intra-State Purchase Voucher Construction (Cakes + Accessories)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/8] Testing Intra-State Purchase Voucher Construction (Dr 1132, Dr 1131, Dr 1141, Dr 1142, Dr 1143, Dr 1144, Cr 2111)...');

    // Create an APPROVED purchase header
    const p1Id = 'pch_test_intrastate_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_ka_3d2', $2, 'INV-KA-001', '2026-09-24',
        7000.00, 0.00, 7000.00, 305.00, 305.00, 0.00, 7610.00,
        'APPROVED', 'user_buyer_01', 'user_manager_01', NOW(), NOW()
      );
    `, [p1Id, branchKa.id]);

    // Insert purchase items: Cake (5% GST) + Accessory (18% GST)
    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_cake_3d2', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Classic Chocolate Cake 1kg',
         10, 500.00, 0.00, 5000.00, 2.50, 2.50, 0.00, 125.00, 125.00, 0.00, 5250.00,
         'CAKE', NOW(), NOW()),
        ('pi_acc_3d2', $1, 'acc_01', 'var_acc_01', 'Gold Happy Birthday Topper',
         20, 100.00, 0.00, 2000.00, 9.00, 9.00, 0.00, 180.00, 180.00, 0.00, 2360.00,
         'ACCESSORY', NOW(), NOW());
    `, [p1Id]);

    // 1. Preview Voucher
    const prev1 = await PurchasePostingService.previewPurchaseVoucher({
      purchaseId: p1Id,
      branchId: branchKa.id,
      client,
    });
    assert(prev1.success === true, 'previewPurchaseVoucher succeeds');
    assert(prev1.success && prev1.data.is_balanced === true, 'preview indicates double-entry balanced');
    assert(prev1.success && prev1.data.total_payable === 7610.00, 'preview total payable === 7610.00');
    assert(prev1.success && prev1.data.tax_calculation.jurisdiction.jurisdiction === 'INTRA_STATE', 'jurisdiction resolved as INTRA_STATE');

    // 2. Create Voucher Draft
    const draftRes1 = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: p1Id,
      createdBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(draftRes1.success === true, 'createPurchaseVoucherDraft succeeds');
    const voucher1 = draftRes1.success ? draftRes1.data : null;
    assert(voucher1 && voucher1.status === 'DRAFT', 'voucher status is DRAFT');
    assert(voucher1 && Number(voucher1.total_amount) === 7610.00, `voucher total_amount === 7610.00 (actual: ${voucher1?.total_amount})`);
    assert(voucher1 && voucher1.reference_type === 'PURCHASE', 'voucher reference_type is PURCHASE');
    assert(voucher1 && voucher1.reference_id === p1Id, 'voucher reference_id matches purchase ID');

    // 3. Inspect Proposed Journal Lines
    const lines1 = voucher1?.metadata?.proposed_journal_lines || [];
    assert(lines1.length === 7, `7 journal lines constructed (actual: ${lines1.length})`);

    // Verify double entry validation on the lines
    const verifiedTotal1 = PostingService.validateJournalLines(lines1);
    assert(verifiedTotal1 === 7610.00, `PostingService.validateJournalLines verified total = 7610.00 (got ${verifiedTotal1})`);

    // Check specific debits and credits
    const debitCakes = lines1.find(l => l.metadata?.item_type === 'CAKE');
    assert(debitCakes && debitCakes.debit_amount === 5000.00, 'Dr 1132 Merchandise Inventory - Cakes = 5000.00');

    const debitAcc = lines1.find(l => l.metadata?.item_type === 'ACCESSORY');
    assert(debitAcc && debitAcc.debit_amount === 2000.00, 'Dr 1131 Merchandise Inventory - Accessories = 2000.00');

    const debitCgst25 = lines1.find(l => l.metadata?.tax_component === 'CGST' && l.narration.includes('2.5%'));
    assert(debitCgst25 && debitCgst25.debit_amount === 125.00, 'Dr 1141 Input CGST 2.5% = 125.00');

    const debitSgst25 = lines1.find(l => l.metadata?.tax_component === 'SGST' && l.narration.includes('2.5%'));
    assert(debitSgst25 && debitSgst25.debit_amount === 125.00, 'Dr 1142 Input SGST 2.5% = 125.00');

    const debitCgst9 = lines1.find(l => l.metadata?.tax_component === 'CGST' && l.narration.includes('9%'));
    assert(debitCgst9 && debitCgst9.debit_amount === 180.00, 'Dr 1143 Input CGST 9.0% = 180.00');

    const debitSgst9 = lines1.find(l => l.metadata?.tax_component === 'SGST' && l.narration.includes('9%'));
    assert(debitSgst9 && debitSgst9.debit_amount === 180.00, 'Dr 1144 Input SGST 9.0% = 180.00');

    const creditAp = lines1.find(l => l.credit_amount > 0);
    assert(creditAp && creditAp.credit_amount === 7610.00, 'Cr 2111 Accounts Payable = 7610.00');

    // 4. Submit Voucher
    const subRes1 = await PurchasePostingService.submitPurchaseVoucher({
      voucherId: voucher1.id,
      submittedBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(subRes1.success === true, 'submitPurchaseVoucher succeeds');
    assert(subRes1.success && subRes1.data.status === 'SUBMITTED', 'voucher status transitioned to SUBMITTED');
    assert(subRes1.success && subRes1.data.submitted_by === 'user_ap_clerk_01', 'voucher.submitted_by recorded');
    assert(subRes1.success && Boolean(subRes1.data.submitted_at), 'voucher.submitted_at timestamp set');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 2: Inter-State Purchase Voucher Construction (Packaging)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/8] Testing Inter-State Purchase Voucher Construction (Dr 1133, Dr 1146, Cr 2111)...');

    const p2Id = 'pch_test_interstate_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_mh_3d2', $2, 'INV-MH-PKG-001', '2026-09-24',
        2500.00, 0.00, 2500.00, 0.00, 0.00, 450.00, 2950.00,
        'APPROVED', 'user_buyer_02', 'user_manager_01', NOW(), NOW()
      );
    `, [p2Id, branchKa.id]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_pkg_3d2', $1, NULL, NULL, 'Cake Transport Boxes (Pack of 100)',
         100, 25.00, 0.00, 2500.00, 0.00, 0.00, 18.00, 0.00, 0.00, 450.00, 2950.00,
         'PACKAGING', NOW(), NOW());
    `, [p2Id]);

    const draftRes2 = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: p2Id,
      createdBy: 'user_ap_clerk_02',
      branchId: branchKa.id,
      client,
    });
    assert(draftRes2.success === true, 'inter-state voucher draft created');
    const voucher2 = draftRes2.success ? draftRes2.data : null;
    assert(voucher2 && voucher2.status === 'DRAFT', 'inter-state voucher status is DRAFT');
    assert(voucher2 && Number(voucher2.total_amount) === 2950.00, 'voucher total_amount === 2950.00');

    const lines2 = voucher2?.metadata?.proposed_journal_lines || [];
    assert(lines2.length === 3, `3 journal lines for inter-state packaging (actual: ${lines2.length})`);

    const verifiedTotal2 = PostingService.validateJournalLines(lines2);
    assert(verifiedTotal2 === 2950.00, `Double-entry verified balance = 2950.00`);

    const debitPkg = lines2.find(l => l.metadata?.item_type === 'PACKAGING');
    assert(debitPkg && debitPkg.debit_amount === 2500.00, 'Dr 1133 Packaging Supplies Stock = 2500.00');

    const debitIgst = lines2.find(l => l.metadata?.tax_component === 'IGST');
    assert(debitIgst && debitIgst.debit_amount === 450.00, 'Dr 1146 Input IGST 18.0% = 450.00');

    const creditAp2 = lines2.find(l => l.credit_amount > 0);
    assert(creditAp2 && creditAp2.credit_amount === 2950.00, 'Cr 2111 Accounts Payable = 2950.00');

    // Submit voucher 2
    const subRes2 = await PurchasePostingService.submitPurchaseVoucher({
      voucherId: voucher2.id,
      submittedBy: 'user_ap_clerk_02',
      branchId: branchKa.id,
      client,
    });
    assert(subRes2.success === true && subRes2.data.status === 'SUBMITTED', 'inter-state voucher transitioned to SUBMITTED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 3: Operating Expense Freight Purchase Voucher (Dr 5240)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/8] Testing Operating Expense Freight Purchase Voucher (Dr 1132, Dr 5240, Dr 1141, Dr 1142, Cr 2111)...');

    const p3Id = 'pch_test_opex_freight_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, metadata, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_ka_3d2', $2, 'INV-OPEX-FRT-001', '2026-09-24',
        4000.00, 0.00, 4000.00, 100.00, 100.00, 0.00, 4600.00,
        'APPROVED', 
        '{"freight_policy": "OPERATING_EXPENSE", "freight_amount": 400.00, "is_freight_billed_on_invoice": true}'::jsonb,
        'user_buyer_01', 'user_manager_01', NOW(), NOW()
      );
    `, [p3Id, branchKa.id]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_cake_opex_3d2', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Classic Chocolate Cake 1kg',
         8, 500.00, 0.00, 4000.00, 2.50, 2.50, 0.00, 100.00, 100.00, 0.00, 4200.00,
         'CAKE', NOW(), NOW());
    `, [p3Id]);

    const draftRes3 = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: p3Id,
      createdBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(draftRes3.success === true, 'operating expense freight voucher draft created');
    const voucher3 = draftRes3.success ? draftRes3.data : null;
    assert(voucher3 && Number(voucher3.total_amount) === 4600.00, 'voucher total_amount === 4600.00');

    const lines3 = voucher3?.metadata?.proposed_journal_lines || [];
    assert(lines3.length === 5, `5 journal lines for opex freight invoice (actual: ${lines3.length})`);

    const verifiedTotal3 = PostingService.validateJournalLines(lines3);
    assert(verifiedTotal3 === 4600.00, `Double-entry balance = 4600.00`);

    const debitCakeOpex = lines3.find(l => l.metadata?.item_type === 'CAKE');
    assert(debitCakeOpex && debitCakeOpex.debit_amount === 4000.00, 'Dr 1132 Cake Inventory = 4000.00 (freight excluded from inventory)');

    const debitFreight = lines3.find(l => l.metadata?.freight_policy === 'OPERATING_EXPENSE');
    assert(debitFreight && debitFreight.debit_amount === 400.00, 'Dr 5240 Freight & Cartage Inward = 400.00');

    const creditAp3 = lines3.find(l => l.credit_amount > 0);
    assert(creditAp3 && creditAp3.credit_amount === 4600.00, 'Cr 2111 Accounts Payable = 4600.00 (includes invoice freight)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 4: Capitalized Attributable Freight Purchase Voucher
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/8] Testing Capitalized Attributable Freight Purchase Voucher...');

    const p4Id = 'pch_test_cap_freight_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, metadata, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_ka_3d2', $2, 'INV-CAP-FRT-001', '2026-09-24',
        5000.00, 0.00, 5000.00, 255.00, 255.00, 0.00, 5810.00,
        'APPROVED', 
        '{"freight_policy": "INVENTORY_CAPITALIZED", "freight_amount": 300.00, "is_freight_billed_on_invoice": true}'::jsonb,
        'user_buyer_01', 'user_manager_01', NOW(), NOW()
      );
    `, [p4Id, branchKa.id]);

    // Cake (3000 = 60% share), Accessory (2000 = 40% share)
    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_cake_cap_3d2', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', 'variant_01KXYMAN3S2BD93GANERPZH3FP', 'Classic Chocolate Cake 1kg',
         6, 500.00, 0.00, 3000.00, 2.50, 2.50, 0.00, 75.00, 75.00, 0.00, 3150.00,
         'CAKE', NOW(), NOW()),
        ('pi_acc_cap_3d2', $1, 'acc_01', 'var_acc_01', 'Gold Happy Birthday Topper',
         20, 100.00, 0.00, 2000.00, 9.00, 9.00, 0.00, 180.00, 180.00, 0.00, 2360.00,
         'ACCESSORY', NOW(), NOW());
    `, [p4Id]);

    const draftRes4 = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: p4Id,
      createdBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(draftRes4.success === true, 'capitalized freight voucher draft created');
    const voucher4 = draftRes4.success ? draftRes4.data : null;
    assert(voucher4 && Number(voucher4.total_amount) === 5810.00, 'voucher total_amount === 5810.00');

    const lines4 = voucher4?.metadata?.proposed_journal_lines || [];
    const verifiedTotal4 = PostingService.validateJournalLines(lines4);
    assert(verifiedTotal4 === 5810.00, 'Double-entry verified balance = 5810.00');

    const debitCakeCap = lines4.find(l => l.metadata?.item_type === 'CAKE');
    // 3000 + 180 (60% of 300) = 3180.00
    assert(debitCakeCap && debitCakeCap.debit_amount === 3180.00, `Dr 1132 Cake = 3180.00 (taxable 3000 + freight 180, actual: ${debitCakeCap?.debit_amount})`);

    const debitAccCap = lines4.find(l => l.metadata?.item_type === 'ACCESSORY');
    // 2000 + 120 (40% of 300) = 2120.00
    assert(debitAccCap && debitAccCap.debit_amount === 2120.00, `Dr 1131 Accessory = 2120.00 (taxable 2000 + freight 120, actual: ${debitAccCap?.debit_amount})`);

    const hasAccount5240 = lines4.some(l => l.metadata?.freight_policy === 'OPERATING_EXPENSE');
    assert(!hasAccount5240, 'Account 5240 is NOT debited when freight is INVENTORY_CAPITALIZED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 5: Header Trade Discount Distribution & Penny Reconciliation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/8] Testing Header Discount Distribution...');

    const p5Id = 'pch_test_discount_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_ka_3d2', $2, 'INV-DISC-001', '2026-09-24',
        10000.00, 500.00, 9500.00, 237.50, 237.50, 0.00, 9975.00,
        'APPROVED', 'user_buyer_01', 'user_manager_01', NOW(), NOW()
      );
    `, [p5Id, branchKa.id]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_cake_disc1', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Cake Batch A',
         10, 500.00, 0.00, 4750.00, 2.50, 2.50, 0.00, 118.75, 118.75, 0.00, 4987.50,
         'CAKE', NOW(), NOW()),
        ('pi_cake_disc2', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Cake Batch B',
         10, 500.00, 0.00, 4750.00, 2.50, 2.50, 0.00, 118.75, 118.75, 0.00, 4987.50,
         'CAKE', NOW(), NOW());
    `, [p5Id]);

    const draftRes5 = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: p5Id,
      createdBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(draftRes5.success === true, 'header discount voucher draft created');
    const voucher5 = draftRes5.success ? draftRes5.data : null;
    assert(voucher5 && Number(voucher5.total_amount) === 9975.00, 'voucher total_amount === 9975.00');

    const lines5 = voucher5?.metadata?.proposed_journal_lines || [];
    const verifiedTotal5 = PostingService.validateJournalLines(lines5);
    assert(verifiedTotal5 === 9975.00, 'Double-entry balance = 9975.00 reconciles exactly to the cent');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 6: Unregistered Supplier Invoice (Zero Input Tax)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/8] Testing Unregistered Supplier Invoice...');

    const p6Id = 'pch_test_unreg_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_unreg_3d2', $2, 'INV-UNREG-001', '2026-09-24',
        3000.00, 0.00, 3000.00, 0.00, 0.00, 0.00, 3000.00,
        'APPROVED', 'user_buyer_01', 'user_manager_01', NOW(), NOW()
      );
    `, [p6Id, branchKa.id]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_cake_unreg', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Cake Direct Local',
         6, 500.00, 0.00, 3000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3000.00,
         'CAKE', NOW(), NOW());
    `, [p6Id]);

    const draftRes6 = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: p6Id,
      createdBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(draftRes6.success === true, 'unregistered supplier voucher draft created');
    const voucher6 = draftRes6.success ? draftRes6.data : null;
    assert(voucher6 && Number(voucher6.total_amount) === 3000.00, 'voucher total_amount === 3000.00');

    const lines6 = voucher6?.metadata?.proposed_journal_lines || [];
    assert(lines6.length === 2, `Exactly 2 lines for unregistered invoice (1 Dr, 1 Cr, actual: ${lines6.length})`);
    const taxLines6 = lines6.filter(l => Boolean(l.metadata?.tax_component));
    assert(taxLines6.length === 0, 'Zero input tax lines created for unregistered supplier');

    const verifiedTotal6 = PostingService.validateJournalLines(lines6);
    assert(verifiedTotal6 === 3000.00, 'Double-entry balance = 3000.00');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 7: Fail-Closed Security & Integrity Checks
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/8] Testing Fail-Closed Security & Integrity Checks...');

    // A. Unapproved purchase status
    const pUnappId = 'pch_test_unapproved_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_ka_3d2', $2, 'INV-DRAFT-001', '2026-09-24',
        1000.00, 0.00, 1000.00, 25.00, 25.00, 0.00, 1050.00,
        'DRAFT', 'user_buyer_01', NOW(), NOW()
      );
    `, [pUnappId, branchKa.id]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_unapp_item', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Cake Item',
         2, 500.00, 0.00, 1000.00, 2.50, 2.50, 0.00, 25.00, 25.00, 0.00, 1050.00,
         'CAKE', NOW(), NOW());
    `, [pUnappId]);

    const unappRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: pUnappId,
      createdBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(unappRes.success === false && unappRes.code === 'INVALID_PURCHASE_STATUS',
      'Unapproved purchase cannot create voucher draft (fails closed with INVALID_PURCHASE_STATUS)');

    // B. Purchase total mismatch
    const pMismatchId = 'pch_test_mismatch_3d2';
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, 'sup_test_ka_3d2', $2, 'INV-MISMATCH-001', '2026-09-24',
        1000.00, 0.00, 1000.00, 25.00, 25.00, 0.00, 9999.00,
        'APPROVED', 'user_buyer_01', 'user_manager_01', NOW(), NOW()
      );
    `, [pMismatchId, branchKa.id]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value,
        cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
        item_type, created_at, updated_at
      ) VALUES 
        ('pi_mismatch_item', $1, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Cake Item',
         2, 500.00, 0.00, 1000.00, 2.50, 2.50, 0.00, 25.00, 25.00, 0.00, 1050.00,
         'CAKE', NOW(), NOW());
    `, [pMismatchId]);

    const mismatchRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: pMismatchId,
      createdBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(mismatchRes.success === false && mismatchRes.code === 'PURCHASE_TOTAL_MISMATCH',
      'Purchase total discrepancy fails closed with PURCHASE_TOTAL_MISMATCH');

    // C. Cross-branch isolation (BOLA)
    const bolaRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: p1Id,
      createdBy: 'user_ap_clerk_01',
      branchId: 'br_other_unauthorized_branch',
      client,
    });
    assert(bolaRes.success === false && bolaRes.code === 'BRANCH_ACCESS_DENIED',
      'Cross-branch voucher draft creation rejected with BRANCH_ACCESS_DENIED');

    // D. Submitting non-draft voucher
    const subAgainRes = await PurchasePostingService.submitPurchaseVoucher({
      voucherId: voucher1.id,
      submittedBy: 'user_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(subAgainRes.success === false && subAgainRes.code === 'INVALID_VOUCHER_STATE',
      'Submitting already SUBMITTED voucher rejected with INVALID_VOUCHER_STATE');

    // E. Posting non-approved voucher
    const postPrematureRes = await PostingService.postVoucher({
      voucherId: voucher1.id,
      postedBy: 'user_controller_01',
      lines: lines1,
      branchId: branchKa.id,
      client,
    });
    assert(postPrematureRes.success === false && postPrematureRes.code === 'INVALID_VOUCHER_STATE',
      'Posting SUBMITTED voucher without approval rejected with INVALID_VOUCHER_STATE');

  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // ROLLBACK & ZERO PERSISTENCE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nRolling back test transaction...');
    await client.query('ROLLBACK');
    console.log('Transaction rolled back successfully.');

    // Verify baseline invariants after rollback
    const vchAfter = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(vchAfter === 0, `accounting_voucher = 0 after rollback (actual: ${vchAfter})`);

    const jnlAfter = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    assert(jnlAfter === 0, `accounting_journal_entry = 0 after rollback (actual: ${jnlAfter})`);

    const jnlLineAfter = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    assert(jnlLineAfter === 0, `accounting_journal_line = 0 after rollback (actual: ${jnlLineAfter})`);

    const pchAfter = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    assert(pchAfter === 0, `purchase = 0 after rollback (actual: ${pchAfter})`);

    const lotAfter = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    assert(lotAfter === 0, `inventory_cost_lot = 0 after rollback (actual: ${lotAfter})`);

    const movAfter = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    assert(movAfter === 0, `inventory_movement = 0 after rollback (actual: ${movAfter})`);

    const binvAfter = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    assert(binvAfter === 424, `branch_inventory = 424 intact after rollback (actual: ${binvAfter})`);

    const pkgAfter = parseInt((await client.query("SELECT COUNT(*) FROM public.product WHERE merchandise_type = 'PACKAGING'")).rows[0].count, 10);
    assert(pkgAfter === 0, `packaging products = 0 after rollback (actual: ${pkgAfter})`);

    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`TEST RESULTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
