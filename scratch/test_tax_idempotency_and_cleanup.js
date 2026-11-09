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

const { SalesPostingService } = require("../frontend/src/lib/services/sales-posting.service");
const { closeDbPool } = require("../frontend/src/lib/db");

async function runSmallestIsolatedTest() {
  console.log("--- ISOLATED TEST: Idempotency & Clean Event Loop Exit ---");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let passed = false;
  try {
    await client.query("BEGIN");

    // Fetch active branch
    const branchRes = await client.query(`SELECT id FROM public.branch LIMIT 1`);
    const branchId = branchRes.rows[0]?.id || "br_default";

    const retryCustId = "cust_iso_idem_test";
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'IsoRetry', 'Customer', 'isoretry@test.com', '9444444444', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [retryCustId]);

    const testOrderId = `ord_iso_idem_${Date.now()}`;
    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'isoretry@test.com', 'inr', $3, NOW(), NOW())
    `, [
      testOrderId,
      retryCustId,
      JSON.stringify({
        is_ledger_eligible: true,
        branch_id: branchId,
        delivery_address: { state: "Karnataka", pincode: "560001" },
        payment_method: "online",
        items: [{ product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", quantity: 1, unit_price: 649 }]
      })
    ]);

    // Call 1
    const call1 = await SalesPostingService.createSalesVoucherDraft({
      orderId: testOrderId,
      createdBy: "usr_tax_tester",
      branchId,
      client,
    });

    // Call 2 (Retry)
    const call2 = await SalesPostingService.createSalesVoucherDraft({
      orderId: testOrderId,
      createdBy: "usr_tax_tester",
      branchId,
      client,
    });

    const call1VoucherId = (call1.voucher || call1.data)?.id;
    const call2VoucherId = (call2.voucher || call2.data)?.id;

    console.log(`Call 1: success=${call1.success}, voucherId=${call1VoucherId}`);
    console.log(`Call 2: success=${call2.success}, code=${call2.code}`);

    const isSafe = (call2.success && call2VoucherId === call1VoucherId) ||
                   (!call2.success && call2.code === "DUPLICATE_SOURCE_EVENT");

    if (call1.success && isSafe) {
      console.log("✅ PASS: createSalesVoucherDraft is strictly idempotent and safe on retry!");
      passed = true;
    } else {
      console.error("❌ FAIL: Idempotency check failed", { call1, call2 });
    }

    await client.query("ROLLBACK");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await client.end();
    await closeDbPool();
  }

  if (passed) {
    console.log("Cleanup complete. Exiting cleanly.");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSmallestIsolatedTest();
