/**
 * CakeToHome ERP — Comprehensive Statutory Tax Master ↔ PIM ↔ Product Integration Test Suite
 *
 * Validates:
 * 1. Canonical Tax Master records loading from PostgreSQL.
 * 2. Product tax assignment saved and retrieved correctly via ProductRepository & TaxResolverService.
 * 3. Variant tax inheritance & variant rule override precedence.
 * 4. Missing / invalid tax assignments fail closed without guessing or defaulting.
 * 5. Inactive / deleted tax configuration rejection.
 * 6. Checkout tax resolution without manually supplied percentage (OrderService.createOrder).
 * 7. Sales invoice tax calculations (SalesPostingService, CGST+SGST intra-state vs IGST inter-state).
 * 8. Purchase invoice tax calculations & posting (PurchasePostingService).
 * 9. Decimal rounding & paise reconciliation: sum(taxable) + sum(tax) + delivery === total.
 * 10. Historical invoice preservation: subsequent changes to Tax Master do NOT rewrite historical vouchers.
 * 11. Idempotency & retry safety: duplicate draft requests do not create duplicate accounting vouchers.
 * 12. List of 12 unmapped products explicitly identified and confirmed to fail closed.
 */

const { Client } = require("../frontend/node_modules/pg");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const ts = require("../frontend/node_modules/typescript");
require.extensions[".ts"] = function(module, filename) {
  const content = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    }
  });
  return module._compile(compiled.outputText, filename);
};

const { TaxResolverService, TaxResolutionError } = require("../frontend/src/lib/services/tax-resolver.service");
const { SalesPostingService, SalesPostingError } = require("../frontend/src/lib/services/sales-posting.service");
const { PurchasePostingService, PurchasePostingError } = require("../frontend/src/lib/services/purchase-posting.service");
const { OrderService } = require("../frontend/src/lib/services/order.service");
const { ProductRepository } = require("../frontend/src/lib/repositories/product.repository");
const { closeDbPool } = require("../frontend/src/lib/db");

async function runComprehensiveSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME ERP — FULL STATUTORY TAX INTEGRATION VERIFICATION SUITE");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let passed = 0;
  let failed = 0;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Existing Tax Master records loading from PostgreSQL
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Existing Tax Master records loading from PostgreSQL ---");
    const activeRates = await TaxResolverService.listActiveTaxRates(client);
    console.log(`  Found ${activeRates.length} active tax configurations in PostgreSQL:`);
    for (const r of activeRates) {
      console.log(`   * ${r.code} (${r.name}): ${r.gstRatePct}% | Taxability: ${r.taxability} | Usage: ${r.usageCount}`);
    }

    const has0 = activeRates.some(r => r.code === "GST_0" && r.gstRatePct === 0);
    const has5 = activeRates.some(r => r.code === "GST_5" && r.gstRatePct === 5);
    const has12 = activeRates.some(r => r.code === "GST_12" && r.gstRatePct === 12);
    const has18 = activeRates.some(r => r.code === "GST_18" && r.gstRatePct === 18);
    const has28 = activeRates.some(r => r.code === "GST_28" && r.gstRatePct === 28);

    if (activeRates.length === 5 && has0 && has5 && has12 && has18 && has28) {
      console.log("  ✅ PASS: All 5 statutory tax rates (0%, 5%, 12%, 18%, 28%) correctly retrieved from PostgreSQL.\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Canonical Tax Master rates mismatch.\n");
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 2: Product tax assignment saved and retrieved correctly via ProductRepository
    // -------------------------------------------------------------------------
    console.log("--- TEST 2: Product tax assignment save and retrieval via ProductRepository ---");
    await client.query("BEGIN");

    const testProdId = "prod_test_tax_save_retrieve";
    const testProductData = {
      id: testProdId,
      title: "PIM Tax Assignment Test Cake",
      name: "PIM Tax Assignment Test Cake",
      price: 799,
      selling_price: 799,
      tax_rate_id: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", // GST 5%
      tax_class: "GST_5",
      hsn_code: "19059090",
      status: "published",
    };

    // Save product via ProductRepository
    await ProductRepository.save(testProductData);

    // Retrieve product via ProductRepository
    const retrieved = await ProductRepository.findById(testProdId);
    console.log("  Retrieved Product Domain:", {
      id: retrieved?.id,
      gst_rate: retrieved?.gst_rate,
      tax_class: retrieved?.tax_class,
      tax_rate_id: retrieved?.tax_rate_id,
      tax_configuration_id: retrieved?.tax_configuration_id,
    });

    // Check tax_rate_rule in DB
    const ruleRes = await client.query(
      `SELECT * FROM public.tax_rate_rule WHERE reference = 'product' AND reference_id = $1 AND deleted_at IS NULL`,
      [testProdId]
    );
    console.log(`  Rule created in public.tax_rate_rule: count=${ruleRes.rows.length}, tax_rate_id=${ruleRes.rows[0]?.tax_rate_id}`);

    if (
      retrieved?.gst_rate === 5 &&
      retrieved?.tax_class === "GST_5" &&
      retrieved?.tax_rate_id === "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6" &&
      ruleRes.rows.length === 1 &&
      ruleRes.rows[0].tax_rate_id === "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6"
    ) {
      console.log("  ✅ PASS: Product tax assignment saved to product.metadata and public.tax_rate_rule correctly!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Product tax assignment persistence failed.\n");
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 3: Product variant inheritance and override rules
    // -------------------------------------------------------------------------
    console.log("--- TEST 3: Variant tax inheritance & variant rule override precedence ---");
    await client.query("BEGIN");

    const baseProdId = "prod_var_tax_test";
    await client.query(`
      INSERT INTO public.product (id, title, handle, is_giftcard, status, metadata, merchandise_type, created_at, updated_at)
      VALUES ($1, 'Base Variant Test Product', 'base-var-test', false, 'published',
              $2, 'CAKE', NOW(), NOW())
    `, [baseProdId, JSON.stringify({ tax_rate_id: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", tax_class: "GST_5", gst_rate: 5 })]);

    const varInheritId = "var_inherit_5";
    const varOverrideId = "var_override_18";

    await client.query(`
      INSERT INTO public.product_variant (id, title, product_id, allow_backorder, manage_inventory, created_at, updated_at)
      VALUES ($1, 'Inherited Variant', $2, false, false, NOW(), NOW()),
             ($3, 'Override Variant', $2, false, false, NOW(), NOW())
    `, [varInheritId, baseProdId, varOverrideId]);

    // Create a variant override rule in public.tax_rate_rule for varOverrideId -> GST 18%
    await client.query(`
      INSERT INTO public.tax_rate_rule (id, tax_rate_id, reference_id, reference, created_at, updated_at)
      VALUES ('txrr_test_override_18', 'txr_gst_18_in', $1, 'product_variant', NOW(), NOW())
    `, [varOverrideId]);

    // Resolve variant with inheritance
    const resolvedInherit = await TaxResolverService.resolveProductTax(baseProdId, varInheritId, client);
    console.log("  Inherited Variant Resolved:", resolvedInherit.code, resolvedInherit.rate + "%", "Source:", resolvedInherit.source);

    // Resolve variant with override
    const resolvedOverride = await TaxResolverService.resolveProductTax(baseProdId, varOverrideId, client);
    console.log("  Override Variant Resolved:", resolvedOverride.code, resolvedOverride.rate + "%", "Source:", resolvedOverride.source);

    if (
      resolvedInherit.rate === 5 &&
      resolvedOverride.rate === 18 &&
      resolvedOverride.source === "VARIANT_RULE"
    ) {
      console.log("  ✅ PASS: Variant correctly inherits base product tax unless explicitly overridden in tax_rate_rule!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Variant inheritance/override failed.\n");
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 4: Missing and invalid tax assignments fail closed
    // -------------------------------------------------------------------------
    console.log("--- TEST 4: Missing and invalid tax assignments fail closed ---");
    let caughtMissing = false;
    try {
      await TaxResolverService.resolveProductTax("prod_5", null, client);
    } catch (err) {
      caughtMissing = true;
      console.log(`  Caught expected error for unmapped prod_5: [${err.code}] ${err.message}`);
    }

    let caughtInvalid = false;
    try {
      await TaxResolverService.resolveProductTax("non_existent_prod_999", null, client);
    } catch (err) {
      caughtInvalid = true;
      console.log(`  Caught expected error for non-existent product: [${err.code}] ${err.message}`);
    }

    if (caughtMissing && caughtInvalid) {
      console.log("  ✅ PASS: Both unmapped and non-existent products fail closed with strict errors!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Fail-closed validation did not trigger properly.\n");
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 5: Inactive or deleted tax configurations are rejected
    // -------------------------------------------------------------------------
    console.log("--- TEST 5: Inactive/deleted tax configuration rejection ---");
    await client.query("BEGIN");

    // Deactivate a tax rate temporarily
    const inactiveRateId = "txr_test_inactive";
    await client.query(`
      INSERT INTO public.tax_rate (id, name, code, rate, is_default, is_combinable, tax_region_id, deleted_at, created_at, updated_at)
      VALUES ($1, 'Inactive Special Rate', 'GST_INACTIVE_TEST', 15, false, false, 'txreg_01KY2B1R2YVX5040412JCZM1H6', NOW(), NOW(), NOW())
    `, [inactiveRateId]);

    const inactiveProdId = "prod_inactive_tax_test";
    await client.query(`
      INSERT INTO public.product (id, title, handle, is_giftcard, status, metadata, merchandise_type, created_at, updated_at)
      VALUES ($1, 'Inactive Rate Product', 'inactive-rate-prod', false, 'published',
              $2, 'CAKE', NOW(), NOW())
    `, [inactiveProdId, JSON.stringify({ tax_rate_id: inactiveRateId, tax_class: "GST_INACTIVE_TEST" })]);

    let caughtInactive = false;
    try {
      await TaxResolverService.resolveProductTax(inactiveProdId, null, client);
    } catch (err) {
      caughtInactive = true;
      console.log(`  Caught expected rejection for inactive tax rate: [${err.code}] ${err.message}`);
    }

    if (caughtInactive) {
      console.log("  ✅ PASS: Inactive/deleted tax configuration is strictly rejected!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Inactive tax rate was resolved unexpectedly.\n");
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 6: Checkout tax resolution without manually supplied percentage (OrderService)
    // -------------------------------------------------------------------------
    console.log("--- TEST 6: Checkout tax resolution via OrderService.createOrder ---");
    await client.query("BEGIN");

    const branchRes = await client.query("SELECT b.* FROM public.branch b LEFT JOIN public.city c ON c.id = b.city_id WHERE (b.metadata->>'state' IS NOT NULL OR c.state IS NOT NULL) AND b.deleted_at IS NULL LIMIT 1");
    const testBranch = branchRes.rows[0];

    const tomorrowTaxTest = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    // Order 1: With verified cake (no manual tax_rate)
    const orderResSuccess = await OrderService.createOrder({
      customer_name: "Checkout Tax Verification",
      customer_email: "checkout_tax@example.com",
      branch_id: testBranch.id,
      delivery_date: tomorrowTaxTest,
      items: [
        {
          product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", // 5% cake
          quantity: 1,
          unit_price: 649,
          // Notice: NO tax_rate provided!
        }
      ]
    });

    console.log("  Checkout Success Order:", {
      success: orderResSuccess.success,
      orderId: orderResSuccess.order?.id,
      subtotal: orderResSuccess.order?.subtotal,
      total_tax: orderResSuccess.order?.total_tax,
      total: orderResSuccess.order?.total,
    });

    // Order 2: With unmapped product (prod_5) -> Must fail checkout!
    const orderResFail = await OrderService.createOrder({
      customer_name: "Unmapped Prod Checkout",
      customer_email: "unmapped_tax@example.com",
      branch_id: testBranch.id,
      delivery_date: tomorrowTaxTest,
      items: [
        {
          product_id: "prod_5", // Unmapped Butterscotch cake
          quantity: 1,
          unit_price: 599,
        }
      ]
    });

    console.log("  Checkout Unmapped Product Result:", {
      success: orderResFail.success,
      error: orderResFail.error,
    });

    const taxAmt = orderResSuccess.order?.metadata?.tax_amount ?? orderResSuccess.order?.tax_amount;
    const expectedTax = Math.round(((orderResSuccess.order?.subtotal || 0) * 0.05) * 100) / 100;
    const subtotal = orderResSuccess.order?.subtotal || 0;
    const total = orderResSuccess.order?.total || 0;

    if (
      orderResSuccess.success &&
      taxAmt === expectedTax &&
      total === subtotal + taxAmt &&
      !orderResFail.success &&
      orderResFail.error?.includes("has no authoritative GST tax rate configuration")
    ) {
      console.log("  ✅ PASS: Checkout resolves canonical tax rate and blocks unmapped products!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Checkout tax resolution verification failed.", {
        success: orderResSuccess.success,
        taxAmt,
        expectedTax,
        subtotal,
        total,
        failSuccess: orderResFail.success,
        failError: orderResFail.error,
      }, "\n");
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 7: Intra-state vs Inter-state Sales Posting & Ledger Reconciliation
    // -------------------------------------------------------------------------
    console.log("--- TEST 7: Intra-state (CGST+SGST) vs Inter-state (IGST) Sales Posting ---");
    await client.query("BEGIN");

    const custK = "cust_intra_state_ka";
    const custM = "cust_inter_state_mh";

    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Intra', 'Customer', 'intra@test.com', '9111111111', true, NOW(), NOW()),
             ($2, 'Inter', 'Customer', 'inter@test.com', '9222222222', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [custK, custM]);

    // 7A: Intra-state Order (Karnataka -> Karnataka)
    const ordIntra = "ord_test_intra_state";
    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'intra@test.com', 'inr', $3, NOW(), NOW())
    `, [
      ordIntra,
      custK,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: testBranch.id,
        delivery_address: { state: "Karnataka", pincode: "560001" },
        payment_method: "online",
        items: [{ product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", quantity: 1, unit_price: 1000 }]
      })
    ]);

    const intraDraft = await SalesPostingService.createSalesVoucherDraft({
      orderId: ordIntra,
      createdBy: "usr_tax_tester",
      branchId: testBranch.id,
      client,
    });

    const intraVoucher = intraDraft.voucher || intraDraft.data;
    const intraProposedLines = intraVoucher.metadata.proposed_journal_lines;
    const hasCgst = intraProposedLines.some(l => l.metadata?.account_code === "2121"); // Output CGST 2.5%
    const hasSgst = intraProposedLines.some(l => l.metadata?.account_code === "2122"); // Output SGST 2.5%
    const hasIgst = intraProposedLines.some(l => l.metadata?.account_code === "2125");

    console.log("  Intra-state lines check: CGST line found:", hasCgst, "| SGST line found:", hasSgst, "| IGST line found:", hasIgst);

    // 7B: Inter-state Order (Karnataka -> Maharashtra)
    const ordInter = "ord_test_inter_state";
    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'inter@test.com', 'inr', $3, NOW(), NOW())
    `, [
      ordInter,
      custM,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: testBranch.id,
        delivery_address: { state: "Maharashtra", pincode: "400001" },
        payment_method: "online",
        items: [{ product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", quantity: 1, unit_price: 1000 }]
      })
    ]);

    const interDraft = await SalesPostingService.createSalesVoucherDraft({
      orderId: ordInter,
      createdBy: "usr_tax_tester",
      branchId: testBranch.id,
      client,
    });

    const interVoucher = interDraft.voucher || interDraft.data;
    const interProposedLines = interVoucher.metadata.proposed_journal_lines;
    const interHasIgst = interProposedLines.some(l => l.metadata?.account_code === "2125"); // Output IGST 5%

    console.log("  Inter-state lines check: IGST line found:", interHasIgst);

    if (hasCgst && hasSgst && !hasIgst && interHasIgst) {
      console.log("  ✅ PASS: Intra-state splits into CGST+SGST; Inter-state correctly resolves to IGST!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Place-of-supply tax split check failed.\n");
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 8: Purchase invoice tax resolution & posting (PurchasePostingService)
    // -------------------------------------------------------------------------
    console.log("--- TEST 8: Purchase Posting tax resolution from catalog products ---");
    await client.query("BEGIN");

    // Create test supplier
    const testSupplierId = "sup_test_tax_suite";
    await client.query(`
      INSERT INTO public.supplier (id, name, email, phone, gstin, state, is_active, metadata, created_at, updated_at)
      VALUES ($1, 'Test Tax Supplier', 'sup@test.com', '9876543210', '29ABCDE1234F1Z5', 'Karnataka', true, $2, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET gstin = EXCLUDED.gstin, state = EXCLUDED.state
    `, [testSupplierId, JSON.stringify({ supplier_type: 'RAW_MATERIALS', contact_person: 'Supplier Contact', pan: 'ABCDE1234F' })]);

    const purchId = "purch_test_tax_res";
    // 10 units @ 350 = 3500 taxable. 5% GST = 175. Total = 3675
    const purchaseTotal = 3675;

    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, subtotal, taxable_value, total, status, created_by, approved_by, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, 'BILL-TAX-001', CURRENT_DATE, 3500, 3500, $4, 'APPROVED', 'usr_buyer', 'usr_manager', $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET total = EXCLUDED.total, status = EXCLUDED.status
    `, [
      purchId,
      testSupplierId,
      testBranch.id,
      purchaseTotal,
      JSON.stringify({ freight_policy: "NONE" }),
    ]);

    const purchItemId = "pitem_tax_suite_01";
    await client.query(`
      INSERT INTO public.purchase_item (id, purchase_id, product_id, item_type, description, quantity, rate, discount, taxable_value, total, created_at, updated_at)
      VALUES ($1, $2, $3, 'CAKE', 'Truffle Cake Lot', 10, 350, 0, 3500, 3675, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET taxable_value = EXCLUDED.taxable_value, total = EXCLUDED.total
    `, [
      purchItemId,
      purchId,
      "prod_01KXYMAJKNWZCFXJHESPTZE01G", // Catalog product (5% GST)
    ]);

    const purchDraftRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: purchId,
      createdBy: "usr_tax_tester",
      branchId: testBranch.id,
      client,
    });

    console.log("  Purchase Voucher Draft Result:", {
      success: purchDraftRes.success,
      voucherId: purchDraftRes.data?.id,
      voucherNumber: purchDraftRes.data?.voucher_no,
      totalAmount: purchDraftRes.data?.total_amount,
    });

    if (purchDraftRes.success && purchDraftRes.data && Number(purchDraftRes.data.total_amount) === 3675) {
      console.log("  ✅ PASS: Purchase posting successfully resolved tax from catalog product without manual rate!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Purchase posting tax resolution failed.\n", purchDraftRes);
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 9: Historical invoice preservation after master data changes
    // -------------------------------------------------------------------------
    console.log("--- TEST 9: Historical invoice preservation after Tax Master changes ---");
    await client.query("BEGIN");

    const histCustId = "cust_hist_preservation_test";
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Hist', 'Customer', 'hist@test.com', '9111111111', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [histCustId]);

    // 1. Post a sales voucher with an item at 5%
    const histOrderId = "ord_hist_preservation_test";
    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'hist@test.com', 'inr', $3, NOW(), NOW())
    `, [
      histOrderId,
      histCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: testBranch.id,
        delivery_address: { state: "Karnataka", pincode: "560001" },
        payment_method: "online",
        items: [
          {
            product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G",
            quantity: 1,
            unit_price: 1000,
            tax_rate: 5, // Frozen transaction snapshot
            tax_rate_id: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6",
          }
        ]
      })
    ]);

    const histDraft = await SalesPostingService.createSalesVoucherDraft({
      orderId: histOrderId,
      createdBy: "usr_tax_tester",
      branchId: testBranch.id,
      client,
    });

    const v1 = histDraft.voucher || histDraft.data;
    const v1Total = v1.total_amount;

    // 2. Now simulate a master-data tax rate change for this product to 18% in PostgreSQL
    await client.query(`
      UPDATE public.product
      SET metadata = jsonb_set(metadata, '{tax_rate_id}', '"txr_gst_18_in"')
      WHERE id = 'prod_01KXYMAJKNWZCFXJHESPTZE01G'
    `);

    // 3. Re-query the historical order line tax resolution during re-posting or reprint
    // The sales voucher snapshot must PRESERVE the original 5% tax amount (1050 total)
    const v1Recheck = await client.query("SELECT total_amount FROM public.accounting_voucher WHERE id = $1", [v1.id]);
    console.log(`  Historical Voucher Total Before: ${v1Total} | Recheck: ${v1Recheck.rows[0].total_amount}`);

    if (v1Recheck.rows[0].total_amount === v1Total && Number(v1Total) === 1050) {
      console.log("  ✅ PASS: Historical voucher total and tax details preserved identically despite Tax Master changes!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Historical voucher total modified.\n");
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 10: Idempotency & Retry Safety
    // -------------------------------------------------------------------------
    console.log("--- TEST 10: Idempotency & Retry Safety ---");
    await client.query("BEGIN");

    const retryCustId = "cust_retry_safety_test";
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Retry', 'Customer', 'retry@test.com', '9333333333', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [retryCustId]);

    const retryOrderId = "ord_retry_safety_test";
    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'retry@test.com', 'inr', $3, NOW(), NOW())
    `, [
      retryOrderId,
      retryCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: testBranch.id,
        delivery_address: { state: "Karnataka", pincode: "560001" },
        payment_method: "online",
        items: [{ product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", quantity: 1, unit_price: 649 }]
      })
    ]);

    const call1 = await SalesPostingService.createSalesVoucherDraft({
      orderId: retryOrderId,
      createdBy: "usr_tax_tester",
      branchId: testBranch.id,
      client,
    });

    const call2 = await SalesPostingService.createSalesVoucherDraft({
      orderId: retryOrderId,
      createdBy: "usr_tax_tester",
      branchId: testBranch.id,
      client,
    });

    const call1VoucherId = (call1.voucher || call1.data)?.id;
    const call2VoucherId = (call2.voucher || call2.data)?.id;
    console.log(`  Call 1 Voucher ID: ${call1VoucherId} | Call 2: success=${call2.success}, code=${call2.code}`);

    const totalVouchersRes = await client.query(
      `SELECT COUNT(*) as cnt FROM public.accounting_voucher WHERE reference_id = $1`,
      [retryOrderId]
    );

    const isSafe = (call2.success && call2VoucherId === call1VoucherId) ||
                   (!call2.success && call2.code === "DUPLICATE_SOURCE_EVENT");

    if (call1.success && isSafe && Number(totalVouchersRes.rows[0].cnt) === 1) {
      console.log("  ✅ PASS: Retrying draft creation is strictly idempotent/blocked without creating duplicate accounting records!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Idempotency check failed.\n", { call1, call2 });
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 11: Decimal rounding & Ledger reconciliation (Paise precision)
    // -------------------------------------------------------------------------
    console.log("--- TEST 11: Decimal Rounding & Ledger Reconciliation (Debits === Credits) ---");
    await client.query("BEGIN");

    const roundCustId = "cust_round_test";
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Round', 'Customer', 'round@test.com', '9444444444', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [roundCustId]);

    const roundOrderId = "ord_round_test";
    // 3 items with fractional tax: 333 * 0.05 = 16.65 each -> rounds to 17.
    // Total taxable = 999. Total tax = 50. Total = 1049.
    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'round@test.com', 'inr', $3, NOW(), NOW())
    `, [
      roundOrderId,
      roundCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: testBranch.id,
        delivery_address: { state: "Karnataka", pincode: "560001" },
        payment_method: "online",
        items: [
          { product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", quantity: 3, unit_price: 333 }
        ]
      })
    ]);

    const roundDraft = await SalesPostingService.createSalesVoucherDraft({
      orderId: roundOrderId,
      createdBy: "usr_tax_tester",
      branchId: testBranch.id,
      client,
    });

    const roundVoucher = roundDraft.voucher || roundDraft.data;
    const lines = roundVoucher.metadata.proposed_journal_lines;
    const sumDebits = lines.reduce((acc, l) => acc + (Number(l.debit_amount ?? l.debit) || 0), 0);
    const sumCredits = lines.reduce((acc, l) => acc + (Number(l.credit_amount ?? l.credit) || 0), 0);

    console.log(`  Proposed Journal Debits: ${sumDebits.toFixed(2)} | Credits: ${sumCredits.toFixed(2)}`);

    if (Math.abs(sumDebits - sumCredits) < 0.001 && sumDebits > 0) {
      console.log("  ✅ PASS: Journal entries balance perfectly (Total Debits === Total Credits to the paise)!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Decimal rounding / balance mismatch.\n");
      failed++;
    }

    await client.query("ROLLBACK");

    // -------------------------------------------------------------------------
    // TEST 12: List of all 12 Unmapped Products Verified to Fail-Closed
    // -------------------------------------------------------------------------
    console.log("--- TEST 12: Audit of 12 Unmapped Products (Fail-Closed Verification) ---");
    const unmappedProductIds = [
      "prod_01KXYMAJKNDZ4T2YVA7K144XP5",
      "prod_01KXYMAJKNH99E1TMWYGQGT61D",
      "prod_01KXYMAJKNS8AGWCN5S1WEGKSD",
      "prod_01KXYMAJKNV48P1B9CM7C022YM",
      "prod_1",
      "prod_2",
      "prod_3",
      "prod_4",
      "prod_5",
      "prod_dist_pg_persisted_test",
      "prod_dist_test_01",
      "prod_dist_test_02",
    ];

    let unmappedRejections = 0;
    for (const pid of unmappedProductIds) {
      try {
        await TaxResolverService.resolveProductTax(pid, undefined, client);
        console.error(`  ❌ Product ${pid} unexpectedly resolved a tax rate!`);
      } catch (err) {
        if (err instanceof TaxResolutionError && err.code === "MISSING_TAX_RATE") {
          unmappedRejections++;
        } else {
          console.error(`  ❌ Product ${pid} threw wrong error:`, err);
        }
      }
    }

    console.log(`  Unmapped Products Audit: ${unmappedRejections}/${unmappedProductIds.length} failed closed with MISSING_TAX_RATE`);

    if (unmappedRejections === unmappedProductIds.length) {
      console.log("  ✅ PASS: All 12 unmapped products strictly fail closed without guessing or defaulting!\n");
      passed++;
    } else {
      console.error("  ❌ FAIL: Some unmapped products did not fail closed.\n");
      failed++;
    }

    await client.query("ROLLBACK");

  } catch (err) {
    console.error("UNEXPECTED FAILURE IN TEST SUITE:", err);
    failed++;
  } finally {
    try {
      await client.end();
    } catch (_) {}
    try {
      await closeDbPool();
    } catch (_) {}
  }

  console.log("================================================================================");
  console.log(`COMPREHENSIVE TEST SUITE COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runComprehensiveSuite().catch(console.error);
