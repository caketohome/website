/**
 * CakeToHome ERP — Phase 4F Step 3D.4 Atomic Purchase Financial + Inventory Posting Test Suite
 *
 * SCOPE & BOUNDARIES:
 * APPROVED voucher
 *       │
 *       ├── lock purchase
 *       ├── lock voucher
 *       ├── validate fiscal period (fail-closed if 0 configured)
 *       ├── validate accounting start date (fail-closed if unconfigured)
 *       ├── validate source / idempotency
 *       ├── validate journal balance
 *       ├── create journal entry
 *       ├── create journal lines
 *       ├── create inventory cost lots (using 3D.1 calculated cost, capitalized freight included)
 *       ├── create inventory movement (PURCHASE_RECEIPT, direction IN)
 *       ├── update branch_inventory (catalog items only, non-negative)
 *       ├── mark voucher POSTED
 *       ├── mark purchase POSTED
 *       └── COMMIT (or ROLLBACK EVERYTHING on any error; no partial state)
 *
 * FORBIDDEN:
 * - NO payment settlement (purchase_payment remains 0; cash/bank untouched)
 * - NO retro-posting of historical 173 orders / 53 payments
 * - NO speculative packaging data
 * - NO uncommitted or permanent mutations outside rollback
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
  console.log('CakeToHome ERP — Phase 4F Step 3D.4 Atomic Purchase Posting Test Suite');
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
  const { StaffAccessControl } = require('../src/lib/staff-access-control');

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
    // SECTION 0: PRE-TEST BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/9] Verifying pristine baseline before test execution...');
    const preVoucher = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const preJournal = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const preLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const preLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const preMovs = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const preBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const prePurch = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const prePurchItem = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_item')).rows[0].count, 10);
    const prePurchPay = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const preFpd = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const preStartSetting = (await client.query("SELECT value FROM public.setting WHERE key = 'accounting_start_date'")).rows[0]?.value;

    assert(preVoucher === 0, `Baseline accounting_voucher === 0 (got ${preVoucher})`);
    assert(preJournal === 0, `Baseline accounting_journal_entry === 0 (got ${preJournal})`);
    assert(preLines === 0, `Baseline accounting_journal_line === 0 (got ${preLines})`);
    assert(preLots === 0, `Baseline inventory_cost_lot === 0 (got ${preLots})`);
    assert(preMovs === 0, `Baseline inventory_movement === 0 (got ${preMovs})`);
    assert(preBinv === 424, `Baseline branch_inventory === 424 (got ${preBinv})`);
    assert(prePurch === 0, `Baseline purchase === 0 (got ${prePurch})`);
    assert(prePurchItem === 0, `Baseline purchase_item === 0 (got ${prePurchItem})`);
    assert(prePurchPay === 0, `Baseline purchase_payment === 0 (got ${prePurchPay})`);
    assert(preFpd === 0, `Baseline accounting_fiscal_period === 0 (got ${preFpd})`);
    assert(!preStartSetting, `Baseline accounting_start_date unconfigured`);

    // BEGIN isolated transaction
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: FIXTURE SETUP
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/9] Setting up test branches, suppliers, staff, and catalog items inside rollback transaction...');

    // Resolve active Karnataka branch
    const bRes = await client.query(`
      SELECT b.id, b.name, b.metadata
      FROM public.branch b
      WHERE b.deleted_at IS NULL AND b.metadata->>'state' = 'Karnataka'
      LIMIT 1
    `);
    const branchKa = bRes.rows[0];
    assert(Boolean(branchKa), `Resolved Karnataka branch (${branchKa.id})`);

    // Resolve existing cake product
    const cakeProdRes = await client.query(`
      SELECT p.id, p.title, pv.id as variant_id 
      FROM public.product p 
      JOIN public.product_variant pv ON p.id = pv.product_id 
      WHERE p.merchandise_type = 'CAKE' AND p.deleted_at IS NULL 
      LIMIT 1;
    `);
    const cakeProd = cakeProdRes.rows[0];
    assert(Boolean(cakeProd), `Resolved catalog cake product (${cakeProd.id})`);

    // Resolve existing accessory product
    const accProdRes = await client.query(`
      SELECT p.id, p.title, pv.id as variant_id 
      FROM public.product p 
      JOIN public.product_variant pv ON p.id = pv.product_id 
      WHERE p.merchandise_type = 'ACCESSORY' AND p.deleted_at IS NULL 
      LIMIT 1;
    `);
    const accProd = accProdRes.rows[0];
    assert(Boolean(accProd), `Resolved catalog accessory product (${accProd.id})`);

    // Create temporary packaging product & variant inside transaction
    await client.query(`
      INSERT INTO public.product (id, title, handle, merchandise_type, status, created_at, updated_at)
      VALUES ('prod_pkg_test_3d4', 'Premium Eco Cake Box 1kg', 'pkg-box-1kg-test', 'PACKAGING', 'published', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.query(`
      INSERT INTO public.product_variant (id, product_id, title, sku, manage_inventory, allow_backorder, created_at, updated_at)
      VALUES ('var_pkg_test_3d4', 'prod_pkg_test_3d4', 'Default', 'SKU-PKG-BOX-1KG-T', true, false, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
    assert(true, 'Packaging catalog item created in rollback transaction');

    // Setup intra-state supplier (Karnataka GSTIN 29...)
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES ('sup_test_ka_3d4', 'Karnataka Master Supplier Ltd', '29AABCU9603R1Z2', 'Karnataka', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gstin = EXCLUDED.gstin, state = EXCLUDED.state;
    `);

    // Setup inter-state supplier (Maharashtra GSTIN 27...)
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES ('sup_test_mh_3d4', 'Maharashtra Inter-State Packaging Corp', '27AABCU9603R1Z2', 'Maharashtra', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gstin = EXCLUDED.gstin, state = EXCLUDED.state;
    `);

    // Setup 5 distinct staff identities for Segregation of Duties
    const staffIdentities = {
      buyer: 'staff_3d4_buyer',
      storeMgr: 'staff_3d4_store_mgr',
      apPreparer: 'staff_3d4_ap_preparer',
      apSubmitter: 'staff_3d4_ap_submitter',
      accountingSup: 'staff_3d4_acct_sup',
      glPoster: 'staff_3d4_gl_poster',
    };

    // Register Staff in StaffAccessControl with permissions
    let glStaff = StaffAccessControl.getStaffMemberByEmail("ganesh.poster@cakes2home.com");
    if (!glStaff) {
      glStaff = StaffAccessControl.createStaffMember({
        name: "Ganesh GL Poster",
        phone: "+91 98888 33333",
        email: "ganesh.poster@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    staffIdentities.glPoster = glStaff.id;
    StaffAccessControl.setStaffOverride(glStaff.id, "ACCOUNTING.POST", "ALLOW", "admin_01");

    let supStaff = StaffAccessControl.getStaffMemberByEmail("suresh.acct@cakes2home.com");
    if (!supStaff) {
      supStaff = StaffAccessControl.createStaffMember({
        name: "Suresh Accounting Supervisor",
        phone: "+91 98888 44444",
        email: "suresh.acct@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    staffIdentities.accountingSup = supStaff.id;
    StaffAccessControl.setStaffOverride(supStaff.id, "ACCOUNTING.APPROVE", "ALLOW", "admin_01");

    // Helper: insert a fully approved purchase with items
    async function setupApprovedPurchase(purchaseId, supplierId, itemsConfig) {
      let subtotal = 0;
      let taxableValue = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      for (const it of itemsConfig) {
        subtotal += it.rate * it.quantity;
        taxableValue += it.rate * it.quantity;
        if (it.cgstRate) cgstTotal += Math.round(it.rate * it.quantity * (it.cgstRate / 100) * 100) / 100;
        if (it.sgstRate) sgstTotal += Math.round(it.rate * it.quantity * (it.sgstRate / 100) * 100) / 100;
        if (it.igstRate) igstTotal += Math.round(it.rate * it.quantity * (it.igstRate / 100) * 100) / 100;
      }
      const totalTax = cgstTotal + sgstTotal + igstTotal;
      const total = taxableValue + totalTax;

      await client.query(`
        INSERT INTO public.purchase (
          id, supplier_id, branch_id, invoice_no, invoice_date,
          subtotal, discount, taxable_value, cgst, sgst, igst, total,
          status, created_by, approved_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'INV-' || $1, '2026-09-24',
          $4, 0.00, $5, $6, $7, $8, $9,
          'APPROVED', $10, $11, NOW(), NOW()
        );
      `, [
        purchaseId, supplierId, branchKa.id,
        subtotal, taxableValue, cgstTotal, sgstTotal, igstTotal, total,
        staffIdentities.buyer, staffIdentities.storeMgr
      ]);

      for (let i = 0; i < itemsConfig.length; i++) {
        const it = itemsConfig[i];
        const lineTaxable = it.rate * it.quantity;
        const lineTotal = lineTaxable + (it.cgstRate ? lineTaxable * (it.cgstRate / 100) : 0)
                                      + (it.sgstRate ? lineTaxable * (it.sgstRate / 100) : 0)
                                      + (it.igstRate ? lineTaxable * (it.igstRate / 100) : 0);
        await client.query(`
          INSERT INTO public.purchase_item (
            id, purchase_id, product_id, variant_id, description,
            quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
            cgst, sgst, igst, total, item_type, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, 0.00, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, NOW(), NOW()
          );
        `, [
          `pitem_${purchaseId}_${i + 1}`, purchaseId, it.productId, it.variantId, it.description,
          it.quantity, it.rate, lineTaxable, it.cgstRate || 0, it.sgstRate || 0, it.igstRate || 0,
          it.cgstRate ? Math.round(lineTaxable * (it.cgstRate / 100) * 100) / 100 : 0,
          it.sgstRate ? Math.round(lineTaxable * (it.sgstRate / 100) * 100) / 100 : 0,
          it.igstRate ? Math.round(lineTaxable * (it.igstRate / 100) * 100) / 100 : 0,
          Math.round(lineTotal * 100) / 100, it.itemType
        ]);
      }
    }

    // Helper: create, submit, and approve voucher
    async function setupApprovedVoucher(purchaseId, opts = {}) {
      const draftRes = await PurchasePostingService.createPurchaseVoucherDraft({
        purchaseId,
        createdBy: staffIdentities.apPreparer,
        branchId: branchKa.id,
        freightPolicy: opts.freightPolicy,
        freightAmount: opts.freightAmount,
        isFreightBilledOnInvoice: opts.isFreightBilledOnInvoice,
        client,
      });
      assert(draftRes.success, `Created voucher draft for ${purchaseId}`);

      const submitRes = await PurchasePostingService.submitPurchaseVoucher({
        voucherId: draftRes.data.id,
        submittedBy: staffIdentities.apSubmitter,
        branchId: branchKa.id,
        client,
      });
      assert(submitRes.success, `Submitted voucher for ${purchaseId}`);

      const approveRes = await PurchasePostingService.approvePurchaseVoucher({
        voucherId: draftRes.data.id,
        approvedBy: staffIdentities.accountingSup,
        actorRole: "STAFF",
        actorSession: { id: staffIdentities.accountingSup, role: "STAFF" },
        branchId: branchKa.id,
        client,
      });
      assert(approveRes.success, `Approved voucher for ${purchaseId}`);

      return approveRes.data.voucher;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: FAIL-CLOSED BEHAVIOR (REAL DB BASELINE)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/9] Testing fail-closed behavior (fiscal period & accounting start date)...');

    await setupApprovedPurchase('pur_test_failclosed_fpd', 'sup_test_ka_3d4', [
      { productId: cakeProd.id, variantId: cakeProd.variant_id, description: cakeProd.title, quantity: 5, rate: 1000, cgstRate: 9, sgstRate: 9, itemType: 'CAKE' }
    ]);
    const vFailFpd = await setupApprovedVoucher('pur_test_failclosed_fpd');

    // Test 2A: Accounting start date unconfigured -> HARD BLOCK
    const postDateFailRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_failclosed_fpd',
      voucherId: vFailFpd.id,
      postedBy: staffIdentities.glPoster,
      branchId: branchKa.id,
      client,
    });
    assert(!postDateFailRes.success, 'Post blocked when accounting start date is unconfigured');
    assert(postDateFailRes.error?.includes('ACCOUNTING_START_DATE_NOT_CONFIGURED'), 'Error code is ACCOUNTING_START_DATE_NOT_CONFIGURED');

    // Verify voucher and purchase remain APPROVED (not POSTED)
    const vCheck1 = (await client.query("SELECT status FROM public.accounting_voucher WHERE id = $1", [vFailFpd.id])).rows[0];
    const pCheck1 = (await client.query("SELECT status FROM public.purchase WHERE id = 'pur_test_failclosed_fpd'")).rows[0];
    assert(vCheck1.status === 'APPROVED', 'Voucher status remains APPROVED after blocked posting');
    assert(pCheck1.status === 'APPROVED', 'Purchase status remains APPROVED after blocked posting');

    // Now configure mock accounting_start_date inside transaction, but keep fiscal periods at 0
    await client.query(`
      INSERT INTO public.setting (id, "group", key, value, created_at, updated_at)
      VALUES ('set_test_date_3d4', 'accounting', 'accounting_start_date', '2026-04-01', NOW(), NOW());
    `);
    assert(true, 'Temporary mock accounting_start_date configured inside rollback transaction');

    // Test 2B: 0 configured fiscal periods -> HARD BLOCK
    const postFpdFailRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_failclosed_fpd',
      voucherId: vFailFpd.id,
      postedBy: staffIdentities.glPoster,
      branchId: branchKa.id,
      client,
    });
    assert(!postFpdFailRes.success, 'Post blocked when 0 fiscal periods are configured');
    assert(postFpdFailRes.error?.includes('FISCAL_PERIOD_NOT_CONFIGURED'), 'Error code is FISCAL_PERIOD_NOT_CONFIGURED');

    // Now configure a mock fiscal period for subsequent operational tests
    await client.query(`
      INSERT INTO public.accounting_fiscal_period (
        id, fiscal_year, period_name, start_date, end_date, is_locked, created_at
      ) VALUES (
        'fp_test_3d4', 'FY2627', 'FY 2026-27 Q2', '2026-04-01', '2027-03-31', false, NOW()
      );
    `);
    assert(true, 'Temporary mock fiscal period inserted inside rollback transaction');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: SEGREGATION OF DUTIES ON POSTING
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/9] Testing Segregation of Duties (SoD) on GL posting...');

    await setupApprovedPurchase('pur_test_sod', 'sup_test_ka_3d4', [
      { productId: cakeProd.id, variantId: cakeProd.variant_id, description: cakeProd.title, quantity: 2, rate: 500, cgstRate: 9, sgstRate: 9, itemType: 'CAKE' }
    ]);
    const vSod = await setupApprovedVoucher('pur_test_sod');

    // 3A: Voucher creator cannot post
    const sodCreatorRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_sod',
      voucherId: vSod.id,
      postedBy: staffIdentities.apPreparer, // creator
      branchId: branchKa.id,
      client,
    });
    assert(!sodCreatorRes.success, 'Posting blocked when postedBy === voucher.created_by');
    assert(sodCreatorRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for voucher creator');

    // 3B: Voucher submitter cannot post
    const sodSubmitterRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_sod',
      voucherId: vSod.id,
      postedBy: staffIdentities.apSubmitter, // submitter
      branchId: branchKa.id,
      client,
    });
    assert(!sodSubmitterRes.success, 'Posting blocked when postedBy === voucher.submitted_by');
    assert(sodSubmitterRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for voucher submitter');

    // 3C: Purchase creator (buyer) cannot post
    const sodBuyerRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_sod',
      voucherId: vSod.id,
      postedBy: staffIdentities.buyer, // purchase creator
      branchId: branchKa.id,
      client,
    });
    assert(!sodBuyerRes.success, 'Posting blocked when postedBy === purchase.created_by');
    assert(sodBuyerRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase creator');

    // 3D: Purchase approver (store manager) cannot post
    const sodStoreMgrRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_sod',
      voucherId: vSod.id,
      postedBy: staffIdentities.storeMgr, // purchase approver
      branchId: branchKa.id,
      client,
    });
    assert(!sodStoreMgrRes.success, 'Posting blocked when postedBy === purchase.approved_by');
    assert(sodStoreMgrRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION for purchase approver');

    // 3E: Super Admin cannot bypass SoD (e.g. attempting to post own voucher)
    const sodSuperAdminRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_sod',
      voucherId: vSod.id,
      postedBy: staffIdentities.apPreparer,
      actorRole: "SUPER_ADMIN", // Super admin attempting bypass
      branchId: branchKa.id,
      client,
    });
    assert(!sodSuperAdminRes.success, 'Super Admin cannot bypass SoD rule on posting');
    assert(sodSuperAdminRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Returns SEGREGATION_OF_DUTIES_VIOLATION even for SUPER_ADMIN role');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: PERMISSION RESOLUTION (ACCOUNTING.POST)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/9] Testing permission resolution (ACCOUNTING.POST)...');

    // 4A: Staff member with explicit DENY override
    let unauthStaff = StaffAccessControl.getStaffMemberByEmail("unauth@cakes2home.com");
    if (!unauthStaff) {
      unauthStaff = StaffAccessControl.createStaffMember({
        name: "Unauthorized Staff",
        phone: "+91 98888 55555",
        email: "unauth@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    }
    StaffAccessControl.setStaffOverride(unauthStaff.id, "ACCOUNTING.POST", "DENY", "admin_01");

    const permDeniedRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_sod',
      voucherId: vSod.id,
      postedBy: unauthStaff.id,
      actorRole: "STAFF",
      branchId: branchKa.id,
      client,
    });
    assert(!permDeniedRes.success, 'Posting blocked for staff member without ACCOUNTING.POST');
    assert(permDeniedRes.code === 'PERMISSION_DENIED', 'Returns PERMISSION_DENIED error');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: FULL ATOMIC POSTING (CATALOG MULTI-LINE + CAPITALIZED FREIGHT)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/9] Testing full atomic posting with 3 merchandise types & capitalized freight...');

    const initialBinvAcc = parseInt((await client.query(`
      SELECT quantity FROM public.branch_inventory 
      WHERE branch_id = $1 AND variant_id = $2
    `, [branchKa.id, accProd.variant_id])).rows[0]?.quantity || 0, 10);

    // Multi-line invoice:
    // Line 1: CAKE (5 units @ 1000 = 5000 taxable, 18% GST -> 450 CGST, 450 SGST)
    // Line 2: ACCESSORY (10 units @ 200 = 2000 taxable, 12% GST -> 120 CGST, 120 SGST)
    // Line 3: PACKAGING (50 units @ 20 = 1000 taxable, 18% GST -> 90 CGST, 90 SGST)
    // Capitalized Freight: 160 INR allocated across lines:
    // Total taxable = 8000.
    // Line 1 freight share: 160 * (5000/8000) = 100.00
    // Line 2 freight share: 160 * (2000/8000) = 40.00
    // Line 3 freight share: 160 * (1000/8000) = 20.00
    // Line 1 inventory lot total cost: 5000 + 100 = 5100.00 (unit: 1020.00)
    // Line 2 inventory lot total cost: 2000 + 40 = 2040.00 (unit: 204.00)
    // Line 3 inventory lot total cost: 1000 + 20 = 1020.00 (unit: 20.40)
    // Sum eligible inventory = 8160.00.
    // CGST: 450 + 120 + 90 = 660.00
    // SGST: 450 + 120 + 90 = 660.00
    // Total payable (Cr 2111) = 8000 + 160 (freight) + 1320 (tax) = 9480.00.

    const multiItems = [
      { productId: cakeProd.id, variantId: cakeProd.variant_id, description: cakeProd.title, quantity: 5, rate: 1000, cgstRate: 9, sgstRate: 9, itemType: 'CAKE' },
      { productId: accProd.id, variantId: accProd.variant_id, description: accProd.title, quantity: 10, rate: 200, cgstRate: 6, sgstRate: 6, itemType: 'ACCESSORY' },
      { productId: 'prod_pkg_test_3d4', variantId: 'var_pkg_test_3d4', description: 'Packaging Box 1kg', quantity: 50, rate: 20, cgstRate: 9, sgstRate: 9, itemType: 'PACKAGING' },
    ];

    // Purchase total in DB must match 9480.00 (including billed freight)
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, metadata, created_at, updated_at
      ) VALUES (
        'pur_test_atomic_full', 'sup_test_ka_3d4', $1, 'INV-ATOMIC-01', '2026-09-24',
        8000.00, 0.00, 8000.00, 660.00, 660.00, 0.00, 9480.00,
        'APPROVED', $2, $3, '{"freight_policy": "INVENTORY_CAPITALIZED", "freight_amount": 160, "is_freight_billed_on_invoice": true}', NOW(), NOW()
      );
    `, [branchKa.id, staffIdentities.buyer, staffIdentities.storeMgr]);

    for (let i = 0; i < multiItems.length; i++) {
      const it = multiItems[i];
      const lineTaxable = it.rate * it.quantity;
      const lineCgst = Math.round(lineTaxable * (it.cgstRate / 100) * 100) / 100;
      const lineSgst = Math.round(lineTaxable * (it.sgstRate / 100) * 100) / 100;
      await client.query(`
        INSERT INTO public.purchase_item (
          id, purchase_id, product_id, variant_id, description,
          quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
          cgst, sgst, igst, total, item_type, created_at, updated_at
        ) VALUES (
          $1, 'pur_test_atomic_full', $2, $3, $4,
          $5, $6, 0.00, $7, $8, $9, 0,
          $10, $11, 0, $12, $13, NOW(), NOW()
        );
      `, [
        `pitem_atomic_${i + 1}`, it.productId, it.variantId, it.description,
        it.quantity, it.rate, lineTaxable, it.cgstRate, it.sgstRate,
        lineCgst, lineSgst, lineTaxable + lineCgst + lineSgst, it.itemType
      ]);
    }

    const vAtomic = await setupApprovedVoucher('pur_test_atomic_full', {
      freightPolicy: 'INVENTORY_CAPITALIZED',
      freightAmount: 160,
      isFreightBilledOnInvoice: true,
    });

    const postAtomicRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_atomic_full',
      voucherId: vAtomic.id,
      postedBy: staffIdentities.glPoster,
      branchId: branchKa.id,
      client,
    });

    assert(postAtomicRes.success, 'Purchase successfully posted atomically');

    // 5A: General Ledger Verifications
    const jeRes = await client.query(`
      SELECT * FROM public.accounting_journal_entry 
      WHERE voucher_id = $1
    `, [vAtomic.id]);
    assert(jeRes.rows.length === 1, 'Exactly one GL journal entry created');
    const je = jeRes.rows[0];
    assert(Number(je.total_debit) > 0, 'Journal entry total_debit > 0');
    assert(Math.abs(Number(je.total_debit) - Number(je.total_credit)) < 0.001, 'Journal entry debits equal credits');
    assert(Number(je.total_debit) === 9480.00, `Total journal amount === 9480.00 (got ${je.total_debit})`);

    const jlRes = await client.query(`
      SELECT jl.*, a.code as account_code, a.name as account_name
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account a ON jl.account_id = a.id
      WHERE jl.journal_entry_id = $1
      ORDER BY a.code ASC
    `, [je.id]);

    // Check account credits & debits:
    // AP 2111 Credit
    const apLine = jlRes.rows.find(l => l.account_code === '2111');
    assert(Boolean(apLine), 'Accounts Payable (2111) line exists');
    assert(Number(apLine.credit_amount) === 9480.00, `AP credit equals exactly 9480.00 (got ${apLine.credit_amount})`);
    assert(Number(apLine.debit_amount) === 0, 'AP debit amount is 0');

    // Inventory 1131 (Accessories) Debit: 2040.00 (taxable 2000 + allocated freight 40)
    const invAccLine = jlRes.rows.find(l => l.account_code === '1131');
    assert(Boolean(invAccLine), 'Inventory 1131 (Accessories) debit line exists');
    assert(Number(invAccLine.debit_amount) === 2040.00, `1131 debit === 2040.00 (got ${invAccLine.debit_amount})`);

    // Inventory 1132 (Cakes) Debit: 5100.00 (taxable 5000 + allocated freight 100)
    const invCakeLine = jlRes.rows.find(l => l.account_code === '1132');
    assert(Boolean(invCakeLine), 'Inventory 1132 (Cakes) debit line exists');
    assert(Number(invCakeLine.debit_amount) === 5100.00, `1132 debit === 5100.00 (got ${invCakeLine.debit_amount})`);

    // Inventory 1133 (Packaging) Debit: 1020.00 (taxable 1000 + allocated freight 20)
    const invPkgLine = jlRes.rows.find(l => l.account_code === '1133');
    assert(Boolean(invPkgLine), 'Inventory 1133 (Packaging) debit line exists');
    assert(Number(invPkgLine.debit_amount) === 1020.00, `1133 debit === 1020.00 (got ${invPkgLine.debit_amount})`);

    // 5240 (Freight Operating Expense) must NOT be debited because freight was capitalized
    const freightExpLine = jlRes.rows.find(l => l.account_code === '5240');
    assert(!freightExpLine, 'Freight account 5240 is NOT debited when freight is INVENTORY_CAPITALIZED');

    // Total GST Input Debits: 660 + 660 = 1320.00
    const gstLines = jlRes.rows.filter(l => l.account_code.startsWith('114'));
    const totalGstDebits = gstLines.reduce((acc, l) => acc + Number(l.debit_amount), 0);
    assert(Math.round(totalGstDebits * 100) / 100 === 1320.00, `Total GST input debited === 1320.00 (got ${totalGstDebits})`);

    // 5B: Inventory Cost Lots Verifications
    const lotsRes = await client.query(`
      SELECT * FROM public.inventory_cost_lot 
      WHERE purchase_id = 'pur_test_atomic_full'
      ORDER BY purchase_item_id ASC
    `);
    assert(lotsRes.rows.length === 3, 'Exactly 3 inventory cost lots created (1:1 with items)');

    const cakeLot = lotsRes.rows.find(l => l.product_id === cakeProd.id);
    assert(Number(cakeLot.received_quantity) === 5, 'Cake lot received_quantity === 5');
    assert(Number(cakeLot.remaining_quantity) === 5, 'Cake lot remaining_quantity === 5');
    assert(Number(cakeLot.total_cost) === 5100.00, `Cake lot total_cost === 5100.00 (got ${cakeLot.total_cost})`);
    assert(Number(cakeLot.unit_cost) === 1020.0000, `Cake lot unit_cost === 1020.0000 (got ${cakeLot.unit_cost})`);
    assert(cakeLot.status === 'ACTIVE', 'Cake lot status === ACTIVE');

    const accLot = lotsRes.rows.find(l => l.product_id === accProd.id);
    assert(Number(accLot.received_quantity) === 10, 'Accessory lot received_quantity === 10');
    assert(Number(accLot.total_cost) === 2040.00, `Accessory lot total_cost === 2040.00 (got ${accLot.total_cost})`);
    assert(Number(accLot.unit_cost) === 204.0000, `Accessory lot unit_cost === 204.0000 (got ${accLot.unit_cost})`);

    const pkgLot = lotsRes.rows.find(l => l.product_id === 'prod_pkg_test_3d4');
    assert(Number(pkgLot.received_quantity) === 50, 'Packaging lot received_quantity === 50');
    assert(Number(pkgLot.total_cost) === 1020.00, `Packaging lot total_cost === 1020.00 (got ${pkgLot.total_cost})`);
    assert(Number(pkgLot.unit_cost) === 20.4000, `Packaging lot unit_cost === 20.4000 (got ${pkgLot.unit_cost})`);

    // 5C: Physical Inventory (branch_inventory) Verifications
    const postBinvAcc = parseInt((await client.query(`
      SELECT quantity FROM public.branch_inventory 
      WHERE branch_id = $1 AND variant_id = $2
    `, [branchKa.id, accProd.variant_id])).rows[0].quantity, 10);
    assert(postBinvAcc === initialBinvAcc + 10, `branch_inventory for accessory incremented by 10 (${initialBinvAcc} -> ${postBinvAcc})`);

    const pkgBinv = (await client.query(`
      SELECT quantity, reserved FROM public.branch_inventory 
      WHERE branch_id = $1 AND variant_id = 'var_pkg_test_3d4'
    `, [branchKa.id])).rows[0];
    assert(Boolean(pkgBinv), 'branch_inventory record exists for packaging item');
    assert(Number(pkgBinv.quantity) === 50, `Packaging branch_inventory quantity === 50 (got ${pkgBinv.quantity})`);
    assert(Number(pkgBinv.reserved) === 0, 'Packaging branch_inventory reserved === 0');

    // 5D: Inventory Movements Verifications
    const movsRes = await client.query(`
      SELECT * FROM public.inventory_movement 
      WHERE purchase_id = 'pur_test_atomic_full'
      ORDER BY id ASC
    `);
    assert(movsRes.rows.length === 3, 'Exactly 3 inventory movements created');
    for (const m of movsRes.rows) {
      assert(m.movement_type === 'PURCHASE_RECEIPT', 'Movement type is PURCHASE_RECEIPT');
      assert(m.direction === 'IN', 'Movement direction is IN');
      assert(m.voucher_id === vAtomic.id, 'Movement linked to voucher_id');
      assert(m.branch_id === branchKa.id, 'Movement linked to receiving branch');
    }

    // 5E: Status Transitions
    const vFinal = (await client.query("SELECT status, posted_by, posted_at FROM public.accounting_voucher WHERE id = $1", [vAtomic.id])).rows[0];
    const pFinal = (await client.query("SELECT status, posted_at FROM public.purchase WHERE id = 'pur_test_atomic_full'")).rows[0];
    assert(vFinal.status === 'POSTED', 'Voucher status transitioned to POSTED');
    assert(vFinal.posted_by === staffIdentities.glPoster, 'Voucher posted_by matches GL poster');
    assert(Boolean(vFinal.posted_at), 'Voucher posted_at is timestamped');
    assert(pFinal.status === 'POSTED', 'Purchase status transitioned to POSTED');
    assert(Boolean(pFinal.posted_at), 'Purchase posted_at is timestamped');

    // 5F: No Supplier Payment Settlement
    const payCount = parseInt((await client.query("SELECT COUNT(*) FROM public.purchase_payment")).rows[0].count, 10);
    assert(payCount === 0, `purchase_payment table remains 0 rows (got ${payCount})`);
    const bankLines = jlRes.rows.filter(l => ['1111', '1112', '1113'].includes(l.account_code));
    assert(bankLines.length === 0, 'No cash/bank accounts touched during purchase posting');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: OPERATING EXPENSE FREIGHT POSTING
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/9] Testing OPERATING_EXPENSE freight accounting (Account 5240)...');

    // 1 item: CAKE (2 units @ 1000 = 2000 taxable, 18% GST -> 180 CGST, 180 SGST)
    // Operating freight: 150 INR billed on invoice
    // Total payable = 2000 + 150 + 360 = 2510.00.
    // 1132 (Cake inventory) debited with 2000.00 (pure taxable, 0 freight)
    // 5240 (Freight Inward) debited with 150.00
    // 2111 (Accounts Payable) credited with 2510.00.
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, metadata, created_at, updated_at
      ) VALUES (
        'pur_test_op_freight', 'sup_test_ka_3d4', $1, 'INV-OPFR-01', '2026-09-24',
        2000.00, 0.00, 2000.00, 180.00, 180.00, 0.00, 2510.00,
        'APPROVED', $2, $3, '{"freight_policy": "OPERATING_EXPENSE", "freight_amount": 150, "is_freight_billed_on_invoice": true}', NOW(), NOW()
      );
    `, [branchKa.id, staffIdentities.buyer, staffIdentities.storeMgr]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
        cgst, sgst, igst, total, item_type, created_at, updated_at
      ) VALUES (
        'pitem_opfr_1', 'pur_test_op_freight', $1, $2, $3,
        2, 1000, 0.00, 2000, 9, 9, 0,
        180, 180, 0, 2360, 'CAKE', NOW(), NOW()
      );
    `, [cakeProd.id, cakeProd.variant_id, cakeProd.title]);

    const vOpFreight = await setupApprovedVoucher('pur_test_op_freight', {
      freightPolicy: 'OPERATING_EXPENSE',
      freightAmount: 150,
      isFreightBilledOnInvoice: true,
    });

    const postOpRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_op_freight',
      voucherId: vOpFreight.id,
      postedBy: staffIdentities.glPoster,
      branchId: branchKa.id,
      client,
    });
    assert(postOpRes.success, 'Purchase with OPERATING_EXPENSE freight posted successfully');

    const opJe = (await client.query("SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1", [vOpFreight.id])).rows[0];
    const opLines = (await client.query(`
      SELECT jl.*, a.code as account_code 
      FROM public.accounting_journal_line jl 
      JOIN public.accounting_account a ON jl.account_id = a.id 
      WHERE jl.journal_entry_id = $1
    `, [opJe.id])).rows;

    const opFreightLine = opLines.find(l => l.account_code === '5240');
    assert(Boolean(opFreightLine), 'Operating freight debited to account 5240');
    assert(Number(opFreightLine.debit_amount) === 150.00, `Account 5240 debit === 150.00 (got ${opFreightLine.debit_amount})`);

    const opCakeLot = (await client.query("SELECT * FROM public.inventory_cost_lot WHERE purchase_id = 'pur_test_op_freight'")).rows[0];
    assert(Number(opCakeLot.total_cost) === 2000.00, `Cost lot total_cost excludes operating freight (2000.00 vs ${opCakeLot.total_cost})`);
    assert(Number(opCakeLot.unit_cost) === 1000.0000, `Cost lot unit_cost === 1000.0000 (got ${opCakeLot.unit_cost})`);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: INTER-STATE PURCHASE (IGST)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/9] Testing inter-state purchase (IGST debit)...');

    // Supplier in Maharashtra (27), Branch in Karnataka (29) -> INTER_STATE
    // 10 units @ 100 = 1000 taxable, 18% IGST = 180.00. Total = 1180.00.
    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        'pur_test_interstate', 'sup_test_mh_3d4', $1, 'INV-INTER-01', '2026-09-24',
        1000.00, 0.00, 1000.00, 0.00, 0.00, 180.00, 1180.00,
        'APPROVED', $2, $3, NOW(), NOW()
      );
    `, [branchKa.id, staffIdentities.buyer, staffIdentities.storeMgr]);

    await client.query(`
      INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
        cgst, sgst, igst, total, item_type, created_at, updated_at
      ) VALUES (
        'pitem_inter_1', 'pur_test_interstate', $1, $2, $3,
        10, 100, 0.00, 1000, 0, 0, 18,
        0, 0, 180, 1180, 'ACCESSORY', NOW(), NOW()
      );
    `, [accProd.id, accProd.variant_id, accProd.title]);

    const vInter = await setupApprovedVoucher('pur_test_interstate');

    const postInterRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_interstate',
      voucherId: vInter.id,
      postedBy: staffIdentities.glPoster,
      branchId: branchKa.id,
      client,
    });
    assert(postInterRes.success, 'Inter-state purchase posted successfully');

    const interJe = (await client.query("SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1", [vInter.id])).rows[0];
    const interLines = (await client.query(`
      SELECT jl.*, a.code as account_code, a.name as account_name
      FROM public.accounting_journal_line jl 
      JOIN public.accounting_account a ON jl.account_id = a.id 
      WHERE jl.journal_entry_id = $1
    `, [interJe.id])).rows;

    const igstLine = interLines.find(l => l.account_name.includes('IGST'));
    assert(Boolean(igstLine), 'Input IGST account debited for inter-state purchase');
    assert(Number(igstLine.debit_amount) === 180.00, `Input IGST debit === 180.00 (got ${igstLine.debit_amount})`);

    const cgstLines = interLines.filter(l => l.account_name.includes('CGST') && Number(l.debit_amount) > 0);
    const sgstLines = interLines.filter(l => l.account_name.includes('SGST') && Number(l.debit_amount) > 0);
    assert(cgstLines.length === 0, 'CGST debit is 0 for inter-state purchase');
    assert(sgstLines.length === 0, 'SGST debit is 0 for inter-state purchase');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: CONCURRENCY, IDEMPOTENCY & ATOMICITY (FAILURE INJECTION)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/9] Testing concurrency, idempotency, and atomicity failure injection...');

    // 8A: Idempotency / Double-post prevention
    const duplicatePostRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_atomic_full',
      voucherId: vAtomic.id,
      postedBy: staffIdentities.glPoster,
      branchId: branchKa.id,
      client,
    });
    assert(!duplicatePostRes.success, 'Subsequent post against already POSTED purchase is rejected');
    assert(duplicatePostRes.code === 'PURCHASE_ALREADY_POSTED', 'Returns PURCHASE_ALREADY_POSTED code');

    // Prove zero duplicate records created
    const jeDupCount = parseInt((await client.query("SELECT COUNT(*) FROM public.accounting_journal_entry WHERE voucher_id = $1", [vAtomic.id])).rows[0].count, 10);
    assert(jeDupCount === 1, 'Zero duplicate journal entries created');
    const lotsDupCount = parseInt((await client.query("SELECT COUNT(*) FROM public.inventory_cost_lot WHERE purchase_id = 'pur_test_atomic_full'")).rows[0].count, 10);
    assert(lotsDupCount === 3, 'Zero duplicate inventory cost lots created');

    // 8B: Failure Injection (Simulate failure during cost lot insert via SAVEPOINT)
    await client.query('SAVEPOINT sp_failure_test');

    await setupApprovedPurchase('pur_test_fail_inject', 'sup_test_ka_3d4', [
      { productId: cakeProd.id, variantId: cakeProd.variant_id, description: cakeProd.title, quantity: 4, rate: 500, cgstRate: 9, sgstRate: 9, itemType: 'CAKE' }
    ]);
    const vFailInject = await setupApprovedVoucher('pur_test_fail_inject');

    // Intentionally corrupt cost consistency by modifying taxable_value in purchase_item to mismatch rate*qty
    // so that postPurchase throws COST_CONSISTENCY_VIOLATION or trigger fails
    await client.query(`
      UPDATE public.purchase_item 
      SET quantity = 100, taxable_value = 2000.00
      WHERE purchase_id = 'pur_test_fail_inject'
    `);

    const injectFailRes = await PurchasePostingService.postPurchase({
      purchaseId: 'pur_test_fail_inject',
      voucherId: vFailInject.id,
      postedBy: staffIdentities.glPoster,
      branchId: branchKa.id,
      client,
    });
    assert(!injectFailRes.success, 'Post fails when item cost consistency / math check fails');

    // Rollback to savepoint
    await client.query('ROLLBACK TO SAVEPOINT sp_failure_test');

    // Verify database returned to pre-failure state
    const failJeCheck = (await client.query("SELECT COUNT(*) FROM public.accounting_journal_entry WHERE voucher_id = $1", [vFailInject.id])).rows[0].count;
    assert(parseInt(failJeCheck, 10) === 0, 'Atomicity verified: Zero journal entries created after failure');
    const failLotCheck = (await client.query("SELECT COUNT(*) FROM public.inventory_cost_lot WHERE purchase_id = 'pur_test_fail_inject'")).rows[0].count;
    assert(parseInt(failLotCheck, 10) === 0, 'Atomicity verified: Zero cost lots created after failure');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: ROLLBACK TRANSACTION & INDEPENDENT POSTGRESQL VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[9/9] Executing full ROLLBACK and verifying PostgreSQL pristine state...');
    await client.query('ROLLBACK');

    // Independent post-rollback counts
    const postVoucher = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const postJournal = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const postLines = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    const postLots = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const postMovs = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const postBinv = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const postPurch = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    const postPurchItem = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_item')).rows[0].count, 10);
    const postPurchPay = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    const postFpd = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    const postStartSetting = (await client.query("SELECT value FROM public.setting WHERE key = 'accounting_start_date'")).rows[0]?.value;
    const postPkgProd = parseInt((await client.query("SELECT COUNT(*) FROM public.product WHERE merchandise_type = 'PACKAGING'")).rows[0].count, 10);
    const postOrders = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    const postPayments = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);

    assert(postVoucher === 0, `Post-rollback accounting_voucher returned to 0 (actual: ${postVoucher})`);
    assert(postJournal === 0, `Post-rollback accounting_journal_entry returned to 0 (actual: ${postJournal})`);
    assert(postLines === 0, `Post-rollback accounting_journal_line returned to 0 (actual: ${postLines})`);
    assert(postLots === 0, `Post-rollback inventory_cost_lot returned to 0 (actual: ${postLots})`);
    assert(postMovs === 0, `Post-rollback inventory_movement returned to 0 (actual: ${postMovs})`);
    assert(postBinv === 424, `Post-rollback branch_inventory strictly preserved at 424 (actual: ${postBinv})`);
    assert(postPurch === 0, `Post-rollback purchase returned to 0 (actual: ${postPurch})`);
    assert(postPurchItem === 0, `Post-rollback purchase_item returned to 0 (actual: ${postPurchItem})`);
    assert(postPurchPay === 0, `Post-rollback purchase_payment returned to 0 (actual: ${postPurchPay})`);
    assert(postFpd === 0, `Post-rollback accounting_fiscal_period returned to 0 (actual: ${postFpd})`);
    assert(!postStartSetting, 'Post-rollback accounting_start_date remains unconfigured');
    assert(postPkgProd === 0, `Post-rollback packaging products returned to 0 (actual: ${postPkgProd})`);
    assert(postOrders === 173, `Historical 173 orders strictly untouched (actual: ${postOrders})`);
    assert(postPayments === 53, `Historical 53 payments strictly untouched (actual: ${postPayments})`);

  } catch (err) {
    console.error('Fatal error during test execution:', err);
    try {
      await client.query('ROLLBACK');
    } catch {}
    failCount++;
  } finally {
    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
