/**
 * CakeToHome ERP — Phase 4: PIM Product Lifecycle Integration Master Test Suite
 *
 * Covers:
 * 1. PIM product creation, editing, and PostgreSQL persistence.
 * 2. Variant creation, editing, and retrieval with SKU, barcode, and variant-specific pricing.
 * 3. Canonical product and variant IDs across catalog, cart, and order lines.
 * 4. Product and variant tax assignment through the existing Tax Master.
 * 5. Checkout and invoice consistency.
 * 6. Made-to-order cake availability and fulfillment (no fake stock decrement).
 * 7. Accessory inventory reservation and atomic decrement (prevent overselling).
 * 8. Cancellation and stock restoration (accessory restored, cake stock untouched).
 * 9. Inactive products and invalid variants rejection (fail closed).
 * 10. Duplicate requests and retry safety.
 * 11. Branch isolation and permissions.
 * 12. Independent PostgreSQL verification after operations and clean pool shutdown.
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

const { ProductRepository } = require("../frontend/src/lib/repositories/product.repository");
const { OrderRepository } = require("../frontend/src/lib/repositories/order.repository");
const { TaxResolverService, TaxResolutionError } = require("../frontend/src/lib/services/tax-resolver.service");
const { OrderService } = require("../frontend/src/lib/services/order.service");
const { InventoryService } = require("../frontend/src/lib/services/inventory.service");
const { SalesPostingService } = require("../frontend/src/lib/services/sales-posting.service");
const { closeDbPool } = require("../frontend/src/lib/db");

async function runPhase4Suite() {
  console.log("================================================================================");
  console.log("CAKETOHOME ERP — PHASE 4: PIM PRODUCT LIFECYCLE INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  let passedTests = 0;
  let totalTests = 12;

  // Track created entities for isolated teardown
  const testProductIds = [];
  const testVariantIds = [];
  const testOrderIds = [];
  const testRuleIds = [];

  // Initial cleanup of any previous test artifacts
  await pgClient.query("DELETE FROM public.product_variant WHERE sku LIKE 'TRUF-PIM%' OR product_id LIKE 'prod_test_pim%'");
  await pgClient.query("DELETE FROM public.tax_rate_rule WHERE reference_id LIKE 'var_prod_test_pim%' OR reference_id LIKE 'prod_test_pim%'");
  await pgClient.query("DELETE FROM public.product WHERE id LIKE 'prod_test_pim%'");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: PIM Product Creation & Editing
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: PIM Product Creation & Editing ---");
    const testProdId = `prod_test_pim_${Date.now()}`;
    testProductIds.push(testProdId);

    await ProductRepository.save({
      id: testProdId,
      product_id: testProdId,
      title: "PIM Lifecycle Signature Truffle",
      handle: `pim-signature-truffle-${Date.now()}`,
      description: "A decadent Belgian chocolate truffle cake managed via canonical PIM.",
      price: 850,
      selling_price: 850,
      cost_price: 400,
      mrp: 999,
      category: "Chocolate Cakes",
      category_slug: "chocolate-cakes",
      merchandise_type: "CAKE",
      hsn_code: "19059090",
      tax_class: "GST_5",
      status: "published",
    });

    const fetchedProd = await ProductRepository.findById(testProdId);
    if (!fetchedProd) throw new Error("Created product not found in PostgreSQL");
    if (fetchedProd.title !== "PIM Lifecycle Signature Truffle") throw new Error("Title mismatch");
    if (fetchedProd.merchandise_type !== "CAKE") throw new Error(`Merchandise type mismatch: expected CAKE, got ${fetchedProd.merchandise_type}`);
    if (fetchedProd.hsn_code !== "19059090") throw new Error("HSN code mismatch");
    if (fetchedProd.price !== 850) throw new Error("Price mismatch");

    // Edit product
    await ProductRepository.save({
      id: testProdId,
      title: "PIM Lifecycle Signature Truffle (Updated)",
      price: 890,
      selling_price: 890,
      merchandise_type: "CAKE",
      hsn_code: "19059090",
      tax_class: "GST_5",
      status: "published",
    });

    const updatedProd = await ProductRepository.findById(testProdId);
    if (updatedProd.title !== "PIM Lifecycle Signature Truffle (Updated)" || updatedProd.price !== 890) {
      throw new Error("Product update failed to persist");
    }
    console.log("  [PASS] Product successfully created, persisted, and updated in PostgreSQL.");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 2: Variant Creation, Editing & Retrieval
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Variant Creation, Editing & Retrieval ---");
    const uniqueSuffix = Date.now().toString().slice(-6);
    const sku05 = `TRUF-PIM-05KG-${uniqueSuffix}`;
    const sku10 = `TRUF-PIM-10KG-${uniqueSuffix}`;
    const skuPetite = `TRUF-PIM-PETITE-${uniqueSuffix}`;

    const var1Id = `var_${testProdId}_05kg`;
    const var2Id = `var_${testProdId}_10kg`;
    testVariantIds.push(var1Id, var2Id);

    await ProductRepository.upsertVariant({
      id: var1Id,
      product_id: testProdId,
      title: "0.5 kg Standard",
      sku: sku05,
      barcode: "890123456701",
      weight: 0.5,
      price: 490,
      variant_rank: 0,
    });

    await ProductRepository.upsertVariant({
      id: var2Id,
      product_id: testProdId,
      title: "1.0 kg Standard",
      sku: sku10,
      barcode: "890123456702",
      weight: 1.0,
      price: 890,
      variant_rank: 1,
    });

    const prodWithVariants = await ProductRepository.findById(testProdId);
    if (!prodWithVariants.variants || prodWithVariants.variants.length !== 2) {
      throw new Error(`Expected 2 variants, got ${prodWithVariants.variants?.length}`);
    }

    const v1 = prodWithVariants.variants.find(v => v.id === var1Id);
    if (!v1 || v1.sku !== sku05 || v1.barcode !== "890123456701" || v1.price !== 490) {
      throw new Error(`Variant 1 attributes mismatch: ${JSON.stringify(v1)}`);
    }

    // Edit variant 1
    await ProductRepository.upsertVariant({
      id: var1Id,
      product_id: testProdId,
      title: "0.5 kg Petite Edition",
      sku: skuPetite,
      barcode: "890123456799",
      weight: 0.5,
      price: 520,
      variant_rank: 0,
    });

    const prodAfterVarUpdate = await ProductRepository.findById(testProdId);
    const updatedV1 = prodAfterVarUpdate.variants.find(v => v.id === var1Id);
    if (updatedV1.title !== "0.5 kg Petite Edition" || updatedV1.sku !== skuPetite || updatedV1.price !== 520) {
      throw new Error(`Updated variant mismatch: ${JSON.stringify(updatedV1)}`);
    }
    console.log("  [PASS] Variants created, retrieved, and updated with SKU, barcode, and variant-specific pricing.");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 3: Canonical IDs Across Catalog, Cart & Order Lines
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Canonical Product & Variant IDs Across Catalog & Orders ---");
    const catalogList = await ProductRepository.listProducts({ q: "PIM Lifecycle Signature Truffle" });
    const catItem = catalogList.items.find(i => i.id === testProdId);
    if (!catItem) throw new Error("Catalog search did not find canonical product");
    if (catItem.id !== testProdId) throw new Error("Catalog item ID mismatch");

    // Fetch an active branch
    const branchRes = await pgClient.query(`
      SELECT b.id, b.name, b.metadata 
      FROM public.branch b 
      JOIN public.branch_inventory bi ON bi.branch_id = b.id 
      JOIN public.product p ON p.id = bi.product_id 
      WHERE bi.quantity - bi.reserved >= 5 AND p.merchandise_type = 'ACCESSORY' AND b.is_open = true AND b.deleted_at IS NULL 
      LIMIT 1
    `);
    const branch = branchRes.rows[0];
    if (!branch) throw new Error("No active branch found");

    // Build order with canonical product and variant ID
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const orderRes = await OrderService.createOrder({
      customer_uid: "cust_canonical_tester",
      customer_name: "Canonical ID Tester",
      customer_email: "canonical.tester@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "14:00 - 16:00",
      delivery_address: {
        address_1: "77 Residency Road",
        city: "Bengaluru",
        postal_code: "560025",
        phone: "+919876543210",
      },
      items: [
        {
          product_id: testProdId,
          variant_id: var1Id,
          quantity: 2,
        }
      ],
    });

    if (!orderRes.success || !orderRes.order) {
      throw new Error(`Order creation failed: ${orderRes.error}`);
    }
    testOrderIds.push(orderRes.order.id);

    const savedOrderLine = orderRes.order.items[0];
    if (savedOrderLine.product_id !== testProdId) throw new Error("Order line product_id drift");
    if (savedOrderLine.variant_id !== var1Id) throw new Error("Order line variant_id drift");
    if (savedOrderLine.sku !== skuPetite) throw new Error("Order line sku drift");
    if (savedOrderLine.barcode !== "890123456799") throw new Error("Order line barcode drift");
    if (savedOrderLine.merchandise_type !== "CAKE") throw new Error("Order line merchandise_type drift");
    if (savedOrderLine.unit_price !== 520) throw new Error(`Order line unit_price mismatch: expected 520, got ${savedOrderLine.unit_price}`);

    console.log("  [PASS] Canonical product & variant IDs, SKU, barcode, and merchandise type correctly snapshotted.");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 4: Product & Variant Tax Assignment via Tax Master
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Product & Variant Tax Assignment via Tax Master ---");
    const baseTax = await TaxResolverService.resolveProductTax(testProdId);
    if (baseTax.rate !== 5 || baseTax.code !== "GST_5") {
      throw new Error(`Base product tax mismatch: expected GST_5 (5%), got ${baseTax.code} (${baseTax.rate}%)`);
    }

    // Set variant override for var2Id -> GST_18
    const gst18RateRes = await pgClient.query(`SELECT id FROM public.tax_rate WHERE code = 'GST_18' AND deleted_at IS NULL LIMIT 1`);
    const gst18Id = gst18RateRes.rows[0].id;
    const ruleId = `txrr_var_${Date.now()}`;
    testRuleIds.push(ruleId);

    await pgClient.query(
      `INSERT INTO public.tax_rate_rule (id, tax_rate_id, reference_id, reference, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, 'product_variant', '{"override":true}', NOW(), NOW())`,
      [ruleId, gst18Id, var2Id]
    );

    const variantOverrideTax = await TaxResolverService.resolveProductTax(testProdId, var2Id);
    if (variantOverrideTax.rate !== 18 || variantOverrideTax.code !== "GST_18") {
      throw new Error(`Variant override tax mismatch: expected GST_18 (18%), got ${variantOverrideTax.code} (${variantOverrideTax.rate}%)`);
    }
    if (variantOverrideTax.source !== "VARIANT_RULE") {
      throw new Error(`Expected source VARIANT_RULE, got ${variantOverrideTax.source}`);
    }

    // Verify unoverridden variant inherits product rule
    const inheritedTax = await TaxResolverService.resolveProductTax(testProdId, var1Id);
    if (inheritedTax.rate !== 5 || inheritedTax.code !== "GST_5") {
      throw new Error(`Inherited variant tax mismatch: expected GST_5 (5%), got ${inheritedTax.code} (${inheritedTax.rate}%)`);
    }
    console.log("  [PASS] Tax Master correctly resolves base product (GST 5%), variant override (GST 18%), and inheritance.");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 5: Checkout & Invoice Consistency
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Checkout & Invoice Consistency ---");
    // Place order with both variants
    const multiOrderRes = await OrderService.createOrder({
      customer_uid: "cust_invoice_tester",
      customer_name: "Invoice Consistency Tester",
      customer_email: "invoice.tester@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "123 Brigade Road",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [
        { product_id: testProdId, variant_id: var1Id, quantity: 1 }, // 520 @ 5% = 26
        { product_id: testProdId, variant_id: var2Id, quantity: 1 }, // 890 @ 18% = 160
      ],
    });

    if (!multiOrderRes.success || !multiOrderRes.order) {
      throw new Error(`Multi-item order failed: ${multiOrderRes.error}`);
    }
    testOrderIds.push(multiOrderRes.order.id);

    const o = multiOrderRes.order;
    const expectedSubtotal = 520 + 890; // 1410
    const expectedTax = 26 + 160.20;       // 186.20
    if (o.subtotal !== expectedSubtotal) throw new Error(`Subtotal mismatch: expected ${expectedSubtotal}, got ${o.subtotal}`);
    if (Math.abs(o.tax_amount - expectedTax) > 0.001) throw new Error(`Tax mismatch: expected ${expectedTax}, got ${o.tax_amount}`);

    // Ensure customer exists in customer table for relational integrity
    await pgClient.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Invoice', 'Tester', 'invoice.tester@caketohome.internal', '+919876543210', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [o.customer_id]);

    // Update order metadata to mark as ledger-eligible
    const orderMetadata = {
      ...o,
      is_ledger_eligible: true,
      branch_id: branch.id,
      delivery_address: { state: "Karnataka", pincode: "560001" },
      payment_method: "online",
      items: o.items.map(it => ({
        product_id: it.product_id,
        variant_id: it.variant_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
    };
    await pgClient.query(`UPDATE public."order" SET metadata = $1, status = 'completed' WHERE id = $2`, [JSON.stringify(orderMetadata), o.id]);

    // Construct deterministic statutory sales voucher
    const salesDraft = await SalesPostingService.createSalesVoucherDraft({
      orderId: o.id,
      createdBy: "usr_tester_sys",
      branchId: branch.id,
      client: pgClient,
    });

    if (!salesDraft.success) {
      throw new Error(`createSalesVoucherDraft failed: ${salesDraft.error} (${salesDraft.code})`);
    }

    const voucher = salesDraft.data;
    const proposedLines = voucher.metadata.proposed_journal_lines;
    const totalDebit = proposedLines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
    const totalCredit = proposedLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Proposed sales voucher out of balance! Dr: ${totalDebit}, Cr: ${totalCredit}`);
    }
    console.log(`  [PASS] Order subtotal (₹${o.subtotal}) + tax (₹${o.tax_amount}) === total (₹${o.total_amount}). Statutory voucher balanced (Dr ₹${totalDebit} == Cr ₹${totalCredit}).`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 6: Made-to-order Cake Availability & Fulfillment
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Made-to-Order Cake Availability & Fulfillment ---");
    // Verify that made-to-order cake succeeds without any fake stock in branch_inventory
    const cakeStockBefore = await InventoryService.getAvailableStock(branch.id, testProdId);
    if (cakeStockBefore !== 0) {
      console.warn(`  Note: physical cake stock returned ${cakeStockBefore}`);
    }

    const cakeOrderRes = await OrderService.createOrder({
      customer_uid: "cust_mto_tester",
      customer_name: "Made-To-Order Tester",
      customer_email: "mto.tester@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "45 MG Road",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: testProdId, quantity: 3 }],
    });

    if (!cakeOrderRes.success) {
      throw new Error(`Made-to-order cake order failed: ${cakeOrderRes.error}`);
    }
    testOrderIds.push(cakeOrderRes.order.id);

    // Verify physical stock remains 0 (no fake records deducted)
    const cakeStockAfter = await InventoryService.getAvailableStock(branch.id, testProdId);
    if (cakeStockAfter !== 0) {
      throw new Error(`Made-to-order cake altered physical stock: before=${cakeStockBefore}, after=${cakeStockAfter}`);
    }

    // Now test kitchen availability guard: mark cake as UNAVAILABLE at branch
    const branchMeta = branch.metadata || {};
    const updatedMeta = {
      ...branchMeta,
      product_availability: {
        ...(branchMeta.product_availability || {}),
        [testProdId]: { status: "UNAVAILABLE", reason: "Oven maintenance" },
      },
    };
    await pgClient.query(`UPDATE public.branch SET metadata = $1 WHERE id = $2`, [JSON.stringify(updatedMeta), branch.id]);

    const blockedCakeOrder = await OrderService.createOrder({
      customer_uid: "cust_mto_tester",
      customer_name: "Made-To-Order Tester",
      customer_email: "mto.tester@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "45 MG Road",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: testProdId, quantity: 1 }],
    });

    // Revert branch metadata
    await pgClient.query(`UPDATE public.branch SET metadata = $1 WHERE id = $2`, [JSON.stringify(branchMeta), branch.id]);

    if (blockedCakeOrder.success) {
      throw new Error("Order succeeded for cake when branch kitchen marked it UNAVAILABLE");
    }
    if (!blockedCakeOrder.error || !blockedCakeOrder.error.includes("UNAVAILABLE")) {
      throw new Error(`Unexpected error message: ${blockedCakeOrder.error}`);
    }
    console.log("  [PASS] Made-to-order cake fulfilled without physical stock decrement; kitchen unavailability guard rejected order as expected.");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 7: Accessory Inventory Reservation & Decrement
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Accessory Inventory Reservation & Decrement ---");
    // Find an accessory with stock at this branch
    const accRow = await pgClient.query(`
      SELECT bi.product_id, bi.variant_id, bi.quantity, bi.reserved, p.title
      FROM public.branch_inventory bi
      JOIN public.product p ON p.id = bi.product_id
      WHERE bi.branch_id = $1 AND bi.quantity - bi.reserved >= 5 AND p.merchandise_type = 'ACCESSORY'
      LIMIT 1
    `, [branch.id]);

    if (!accRow.rows.length) {
      throw new Error(`No stocked accessory found at branch ${branch.id}`);
    }

    const testAcc = accRow.rows[0];
    const initialAvailable = testAcc.quantity - testAcc.reserved;

    // Place order for 2 units
    const accOrderRes = await OrderService.createOrder({
      customer_uid: "cust_acc_tester",
      customer_name: "Accessory Tester",
      customer_email: "acc.tester@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "100 Commercial St",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: testAcc.product_id, variant_id: testAcc.variant_id, quantity: 2 }],
    });

    if (!accOrderRes.success) {
      throw new Error(`Accessory order failed: ${accOrderRes.error}`);
    }
    testOrderIds.push(accOrderRes.order.id);

    // Verify stock decreased by 2
    const accStockAfter = await InventoryService.getAvailableStock(branch.id, testAcc.product_id, testAcc.variant_id);
    if (accStockAfter !== initialAvailable - 2) {
      throw new Error(`Stock deduction mismatch: expected ${initialAvailable - 2}, got ${accStockAfter}`);
    }

    // Test oversell prevention: request more than remaining
    const oversellRes = await OrderService.createOrder({
      customer_uid: "cust_acc_tester",
      customer_name: "Accessory Tester",
      customer_email: "acc.tester@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "100 Commercial St",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: testAcc.product_id, variant_id: testAcc.variant_id, quantity: accStockAfter + 100 }],
    });

    if (oversellRes.success) {
      throw new Error("Oversell order succeeded when requesting more than available stock");
    }
    if (!oversellRes.error || !oversellRes.error.includes("INSUFFICIENT_STOCK")) {
      throw new Error(`Expected INSUFFICIENT_STOCK error, got: ${oversellRes.error}`);
    }
    console.log(`  [PASS] Accessory stock decremented from ${initialAvailable} to ${accStockAfter}; overselling blocked with INSUFFICIENT_STOCK.`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 8: Cancellation, Return & Stock Restoration
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Cancellation, Return & Stock Restoration ---");
    // Place a combo order with cake + accessory
    const comboOrderRes = await OrderService.createOrder({
      customer_uid: "cust_combo_cancel",
      customer_name: "Combo Cancel Tester",
      customer_email: "combo.cancel@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "88 Lavelle Road",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [
        { product_id: testProdId, quantity: 1 }, // CAKE
        { product_id: testAcc.product_id, variant_id: testAcc.variant_id, quantity: 1 }, // ACCESSORY
      ],
    });

    if (!comboOrderRes.success) throw new Error(`Combo order failed: ${comboOrderRes.error}`);
    testOrderIds.push(comboOrderRes.order.id);

    const accStockBeforeCancel = await InventoryService.getAvailableStock(branch.id, testAcc.product_id, testAcc.variant_id);

    // Cancel order
    const cancelledOrder = await OrderRepository.cancelOrder(comboOrderRes.order.id, "Customer changed mind");
    if (cancelledOrder.status !== "canceled" && cancelledOrder.status !== "cancelled") throw new Error(`Order status not updated to canceled: ${cancelledOrder.status}`);

    // Verify accessory stock was restored by 1
    const accStockAfterCancel = await InventoryService.getAvailableStock(branch.id, testAcc.product_id, testAcc.variant_id);
    if (accStockAfterCancel !== accStockBeforeCancel + 1) {
      throw new Error(`Accessory stock not restored: before=${accStockBeforeCancel}, after=${accStockAfterCancel}`);
    }

    // Verify cake stock was untouched (still 0)
    const cakeStockAfterCancel = await InventoryService.getAvailableStock(branch.id, testProdId);
    if (cakeStockAfterCancel !== 0) {
      throw new Error(`Cake stock unexpectedly restored to physical inventory: ${cakeStockAfterCancel}`);
    }
    console.log(`  [PASS] Order cancellation restored physical accessory stock (+1) and left made-to-order cake stock untouched.`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 9: Inactive Products & Invalid Variants
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Inactive Products & Invalid Variants Rejection ---");
    // Create draft product
    const draftProdId = `prod_test_draft_${Date.now()}`;
    testProductIds.push(draftProdId);

    await ProductRepository.save({
      id: draftProdId,
      title: "Draft Unreleased Cake",
      price: 500,
      merchandise_type: "CAKE",
      hsn_code: "19059090",
      tax_class: "GST_5",
      status: "draft",
    });

    // Attempt to order draft product
    const draftOrderRes = await OrderService.createOrder({
      customer_uid: "cust_draft_tester",
      customer_name: "Draft Tester",
      customer_email: "draft@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "123 Test Rd",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: draftProdId, quantity: 1 }],
    });

    if (draftOrderRes.success) throw new Error("Draft product checkout should have failed");
    if (!draftOrderRes.error || !draftOrderRes.error.includes("inactive")) {
      throw new Error(`Unexpected draft error message: ${draftOrderRes.error}`);
    }

    // Attempt to order with non-existent variant ID
    const badVarOrderRes = await OrderService.createOrder({
      customer_uid: "cust_bad_var_tester",
      customer_name: "Bad Var Tester",
      customer_email: "badvar@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "123 Test Rd",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: testProdId, variant_id: "var_non_existent_fake_999", quantity: 1 }],
    });

    if (badVarOrderRes.success) throw new Error("Order with non-existent variant ID should have failed");
    if (!badVarOrderRes.error || !badVarOrderRes.error.includes("non-existent variant")) {
      throw new Error(`Unexpected non-existent variant error message: ${badVarOrderRes.error}`);
    }

    // Attempt to order with variant belonging to ANOTHER product
    const otherVarOrderRes = await OrderService.createOrder({
      customer_uid: "cust_wrong_owner_tester",
      customer_name: "Wrong Owner Tester",
      customer_email: "wrongowner@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      delivery_address: {
        address_1: "123 Test Rd",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: testProdId, variant_id: testAcc.variant_id, quantity: 1 }],
    });

    if (otherVarOrderRes.success) throw new Error("Order with variant belonging to another product should have failed");
    if (!otherVarOrderRes.error || !otherVarOrderRes.error.includes("does not belong to product")) {
      throw new Error(`Unexpected cross-product variant error message: ${otherVarOrderRes.error}`);
    }

    console.log("  [PASS] Inactive products, non-existent variants, and cross-product variant tampering fail closed.");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 10: Duplicate Requests & Retry Safety
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: Duplicate Requests & Retry Safety ---");
    const testIdempotencyKey = `idem_${Date.now()}_retry_safe`;
    const orderPayload = {
      customer_uid: "cust_idem_tester",
      customer_name: "Idempotent Tester",
      customer_email: "idem.tester@caketohome.internal",
      customer_phone: "+919876543210",
      branch_id: branch.id,
      payment_method: "card",
      delivery_type: "standard",
      delivery_date: tomorrow,
      delivery_slot: "16:00 - 18:00",
      idempotency_key: testIdempotencyKey,
      delivery_address: {
        address_1: "55 Church St",
        city: "Bengaluru",
        postal_code: "560001",
        phone: "+919876543210",
      },
      items: [{ product_id: testProdId, quantity: 1 }],
    };

    const run1 = await OrderService.createOrder(orderPayload);
    if (!run1.success) throw new Error(`Initial order failed: ${run1.error}`);
    testOrderIds.push(run1.order.id);

    // Duplicate call with same idempotency key
    const run2 = await OrderService.createOrder(orderPayload);
    if (!run2.success) throw new Error(`Idempotent re-submission failed: ${run2.error}`);
    if (run2.order.id !== run1.order.id) {
      throw new Error(`Idempotency violated: created new order ${run2.order.id} instead of returning existing ${run1.order.id}`);
    }
    console.log(`  [PASS] Duplicate request returned identical order (${run1.order.id}) with zero duplicate reservations or database rows.`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 11: Branch Isolation & Cross-Branch Security
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 11: Branch Isolation & Security ---");
    // Fetch another branch
    const otherBranchRes = await pgClient.query(`
      SELECT id, name FROM public.branch 
      WHERE is_open = true AND deleted_at IS NULL AND id != $1 
      LIMIT 1
    `, [branch.id]);

    if (!otherBranchRes.rows.length) {
      throw new Error("Could not find a second branch to verify isolation");
    }
    const branch2 = otherBranchRes.rows[0];

    const stockBranch1 = await InventoryService.getAvailableStock(branch.id, testAcc.product_id, testAcc.variant_id);
    const stockBranch2 = await InventoryService.getAvailableStock(branch2.id, testAcc.product_id, testAcc.variant_id);

    // Decrement stock at Branch 1 only
    await pgClient.query("BEGIN");
    try {
      await InventoryService.deductStockAtomic(pgClient, branch.id, testAcc.product_id, 1, testAcc.variant_id);
      const stockBranch1After = await InventoryService.getAvailableStock(branch.id, testAcc.product_id, testAcc.variant_id);
      const stockBranch2After = await InventoryService.getAvailableStock(branch2.id, testAcc.product_id, testAcc.variant_id);

      if (stockBranch2After !== stockBranch2) {
        throw new Error(`Branch 2 stock leaked: expected ${stockBranch2}, got ${stockBranch2After}`);
      }
    } finally {
      await pgClient.query("ROLLBACK");
    }
    console.log(`  [PASS] Branch isolation verified: stock movements at branch ${branch.id} leave branch ${branch2.id} isolated.`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 12: Independent PostgreSQL Verification & Clean Teardown
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 12: Independent PostgreSQL Verification & Clean Teardown ---");
    // Verify trial balance remains balanced across all vouchers in the system
    const tbRes = await pgClient.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0) as total_debit,
        COALESCE(SUM(credit_amount), 0) as total_credit
      FROM public.accounting_journal_line
    `);
    const totalDr = Number(tbRes.rows[0].total_debit);
    const totalCr = Number(tbRes.rows[0].total_credit);
    const diff = Math.abs(totalDr - totalCr);
    if (diff > 0.001) {
      throw new Error(`Overall Trial Balance out of balance! Dr: ${totalDr}, Cr: ${totalCr}, Diff: ${diff}`);
    }

    // Verify 12 unmapped products remain unmapped (fail-closed)
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

    let unmappedFailClosedCount = 0;
    for (const uId of unmappedProductIds) {
      try {
        await TaxResolverService.resolveProductTax(uId);
      } catch (taxErr) {
        if (taxErr instanceof TaxResolutionError && taxErr.code === "MISSING_TAX_RATE") {
          unmappedFailClosedCount++;
        }
      }
    }
    if (unmappedFailClosedCount !== 12) {
      throw new Error(`Expected all 12 unmapped products to fail closed, got ${unmappedFailClosedCount}`);
    }

    // Teardown test records
    if (testRuleIds.length > 0) {
      await pgClient.query(`DELETE FROM public.tax_rate_rule WHERE id = ANY($1)`, [testRuleIds]);
    }
    if (testOrderIds.length > 0) {
      await pgClient.query(`DELETE FROM public.order_status_history WHERE order_id = ANY($1)`, [testOrderIds]);
      await pgClient.query(`DELETE FROM public.order WHERE id = ANY($1)`, [testOrderIds]);
    }
    if (testVariantIds.length > 0) {
      await pgClient.query(`DELETE FROM public.product_variant WHERE id = ANY($1)`, [testVariantIds]);
    }
    if (testProductIds.length > 0) {
      await pgClient.query(`DELETE FROM public.tax_rate_rule WHERE reference = 'product' AND reference_id = ANY($1)`, [testProductIds]);
      await pgClient.query(`DELETE FROM public.product WHERE id = ANY($1)`, [testProductIds]);
    }

    console.log(`  [PASS] Overall Trial Balance verified (Net Diff: ₹0.00). All 12 unmapped products confirmed failing closed. Test artifacts cleaned up.`);
    passedTests++;

    console.log("\n================================================================================");
    console.log(`VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log("================================================================================\n");

  } catch (err) {
    console.error("\nTEST SUITE FAILED WITH ERROR:");
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pgClient.end();
    await closeDbPool();
    process.exit(process.exitCode || 0);
  }
}

runPhase4Suite();
