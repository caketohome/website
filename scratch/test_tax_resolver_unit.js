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

async function runTests() {
  console.log("================================================================================");
  console.log("CAKETOHOME ERP — TAX MASTER <-> PIM <-> PRODUCT INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let passed = 0;
  let failed = 0;

  try {
    // TEST 1: Retrieve canonical Tax Master configurations from PostgreSQL
    console.log("TEST 1: Loading canonical Tax Master records from PostgreSQL...");
    const rates = await TaxResolverService.listActiveTaxRates(client);
    console.log(`  Loaded ${rates.length} active tax rates from PostgreSQL tax_rate:`);
    for (const r of rates) {
      console.log(`    - [${r.id}] ${r.name} (${r.code}): ${r.gstRatePct}% | Usage: ${r.usageCount}`);
    }

    const has5 = rates.some(r => r.code === "GST_5" && r.gstRatePct === 5);
    const has18 = rates.some(r => r.code === "GST_18" && r.gstRatePct === 18);
    const has0 = rates.some(r => r.code === "GST_0" && r.gstRatePct === 0);

    if (rates.length >= 5 && has5 && has18 && has0) {
      console.log("  ✅ PASS: Canonical Tax Master configurations loaded accurately from PostgreSQL!");
      passed++;
    } else {
      console.error("  ❌ FAIL: Missing canonical tax rates in PostgreSQL.");
      failed++;
    }

    // TEST 2: Authoritative resolution for product with verified metadata
    console.log("\nTEST 2: Authoritative tax resolution for verified product (Classic Chocolate Truffle Cake)...");
    const cakeRes = await TaxResolverService.resolveProductTax("prod_01KXYMAJKNWZCFXJHESPTZE01G", null, client);
    console.log("  Resolved:", cakeRes);
    if (cakeRes.rate === 5 && cakeRes.code === "GST_5") {
      console.log("  ✅ PASS: Cake resolved to canonical GST 5% rate!");
      passed++;
    } else {
      console.error("  ❌ FAIL: Unexpected tax resolution for cake.");
      failed++;
    }

    // TEST 3: Authoritative resolution for accessory product
    console.log("\nTEST 3: Authoritative tax resolution for accessory (acc_01 Gold Topper)...");
    const accRes = await TaxResolverService.resolveProductTax("acc_01", null, client);
    console.log("  Resolved:", accRes);
    if (accRes.rate === 18 && accRes.code === "GST_18") {
      console.log("  ✅ PASS: Accessory resolved to canonical GST 18% rate!");
      passed++;
    } else {
      console.error("  ❌ FAIL: Unexpected tax resolution for accessory.");
      failed++;
    }

    // TEST 4: Fail-closed on unmapped product
    console.log("\nTEST 4: Fail-closed verification on unmapped product (prod_5 Butterscotch Cake)...");
    let unmappedFailed = false;
    try {
      await TaxResolverService.resolveProductTax("prod_5", null, client);
    } catch (err) {
      unmappedFailed = true;
      console.log(`  Caught expected error: [${err.code}] ${err.message}`);
      if (err.code === "MISSING_TAX_RATE") {
        console.log("  ✅ PASS: Unmapped product fails closed with MISSING_TAX_RATE without guessing or defaulting!");
        passed++;
      } else {
        console.error("  ❌ FAIL: Unexpected error code:", err.code);
        failed++;
      }
    }
    if (!unmappedFailed) {
      console.error("  ❌ FAIL: Unmapped product did NOT throw an error!");
      failed++;
    }

    // TEST 5: Sales posting for verified product without manually supplied tax_rate
    console.log("\nTEST 5: SalesPostingService draft creation for order without manual tax_rate...");
    await client.query("BEGIN");

    const bRes = await client.query("SELECT * FROM public.branch WHERE deleted_at IS NULL LIMIT 1");
    const branch = bRes.rows[0];

    const custId = "cust_test_sales_tax";
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Tax', 'Tester', 'taxtest@example.com', '9888877777', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [custId]);

    const orderId = "ord_test_tax_resolution";
    const orderMetadata = {
      is_ledger_eligible: true,
      branch_id: branch.id,
      delivery_address: { state: "Karnataka", pincode: "560001" },
      payment_method: "online",
      items: [
        {
          product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", // Verified cake (5%)
          quantity: 2,
          unit_price: 649,
          // NO tax_rate supplied! Must resolve from Tax Master!
        },
        {
          product_id: "acc_01", // Verified accessory (18%)
          quantity: 1,
          unit_price: 99,
          // NO tax_rate supplied! Must resolve from Tax Master!
        }
      ]
    };

    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'taxtest@example.com', 'inr', $3, NOW(), NOW())
    `, [orderId, custId, JSON.stringify(orderMetadata)]);

    const draftRes = await SalesPostingService.createSalesVoucherDraft({
      orderId,
      createdBy: "usr_tax_tester",
      branchId: branch.id,
      client,
    });

    const voucher = draftRes.voucher || draftRes.data;
    console.log("  Voucher Draft Result:", {
      success: draftRes.success,
      voucherId: voucher?.id,
      voucherNumber: voucher?.voucher_no || voucher?.voucher_number,
      totalAmount: voucher?.total_amount,
    });

    if (draftRes.success && voucher) {
      console.log("  ✅ PASS: Sales voucher draft created successfully resolving tax from Tax Master without manual input!");
      passed++;
    } else {
      console.error("  ❌ FAIL: Sales voucher draft failed:", draftRes);
      failed++;
    }

    await client.query("ROLLBACK");

  } catch (err) {
    console.error("UNEXPECTED TEST ERROR:", err);
    failed++;
  } finally {
    await client.end();
  }

  console.log("\n================================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");
}

runTests().catch(console.error);
