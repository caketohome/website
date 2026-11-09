/**
 * CakeToHome Phase 2.4 — Complete Invoice Safeguard Test Matrix
 *
 * Verifies all 8+ failure modes, fail-closed security, and order preservation
 * against local isolated PostgreSQL test database on port 5433.
 */

import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { DeliveryInvoicingService } from "../src/lib/services/delivery-invoicing.service";

// ── Strict Database Configuration Guardrail ──────────────────────────────────
const envPath = path.resolve(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("FATAL: frontend/.env.local not found");
  process.exit(1);
}

const envFile = fs.readFileSync(envPath, "utf8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match && !match[1].startsWith("#")) {
    process.env[match[1]] = (match[2] || "").trim();
  }
}

const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes("5433") || !dbUrl.includes("cth_test")) {
  console.error("FATAL: Database configuration must strictly target 127.0.0.1:5433/cth_test. Found:", dbUrl ? "[REDACTED NON-5433]" : "NONE");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

interface MatrixResult {
  code: string;
  name: string;
  passed: boolean;
  actualStatus: string;
  expectedStatus: string;
  details?: any;
}

const results: MatrixResult[] = [];
let passedCount = 0;
let failedCount = 0;

function recordTest(code: string, name: string, condition: boolean, actual: string, expected: string, details?: any) {
  if (condition) {
    results.push({ code, name, passed: true, actualStatus: actual, expectedStatus: expected, details });
    passedCount++;
    console.log(`  ✅ [PASS] ${code}: ${name} (Result: ${actual})`);
  } else {
    results.push({ code, name, passed: false, actualStatus: actual, expectedStatus: expected, details });
    failedCount++;
    console.error(`  ❌ [FAIL] ${code}: ${name} (Expected: ${expected}, Got: ${actual})`, details || "");
  }
}

async function runMatrix() {
  console.log("================================================================================");
  console.log("  CAKETOHOME PHASE 2.4 — STATUTORY INVOICE SAFEGUARD TEST MATRIX");
  console.log("================================================================================\n");

  // Create or load a mock delivered order fixture for testing
  const testOrderId = `test_order_safeguard_${Date.now()}`;
  const baseOrder = {
    id: testOrderId,
    order_number: `CTH-QA-${Date.now().toString().slice(-5)}`,
    status: "delivered",
    delivery_status: "delivered",
    delivered_at: new Date().toISOString(),
    customer_id: "cus_qa_matrix",
    customer_name: "Rahul Verma",
    customer_phone: "9876543210",
    seller_legal_name: "CakeToHome India Private Limited",
    seller_gstin: "29AABCC1234F1Z5", // Active company GSTIN
    branch_id: "br_indiranagar",
    items: [
      {
        product_id: "prod_1",
        title: "Belgian Chocolate Truffle Cake",
        quantity: 1,
        unit_price: 649,
        taxable_value: 649,
        gst_rate_pct: 5,
        cgst: 16.23,
        sgst: 16.23,
        tax_amount: 32.46,
        total: 681.46,
        hsn_code: "19059010",
      },
    ],
    pricing: {
      subtotal: 649,
      tax_total: 32.46,
      delivery_fee: 0,
      discount_total: 0,
      grand_total: 681.46,
    },
    payment_method: "prepaid_online",
    payment_status: "paid",
  };

  // ── 1. Conflicting-GSTIN Series (Prefix CTH with Active GSTIN 29AABCC1234F1Z5) ──
  console.log("1. Testing Conflicting-GSTIN Series Binding...");
  const orderConflict = { ...baseOrder, invoice_prefix: "CTH" };
  const resConflict = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderConflict);
  recordTest(
    "SAFEGUARD-01",
    "Conflicting GSTIN series fails closed",
    resConflict.success === false && resConflict.code === "INVOICE_SERIES_PREFIX_CONFLICT",
    resConflict.code || "SUCCESS",
    "INVOICE_SERIES_PREFIX_CONFLICT",
    { error: resConflict.error }
  );

  // ── 2. Same-GSTIN Series Binding (Prefix CONC bound to 29AABCC1234F1Z5) ─────────
  console.log("\n2. Testing Same-GSTIN Authorized Series Binding...");
  // Check sequence binding in DB for CONC
  const concRes = await pool.query(`SELECT prefix, gstin FROM invoice_sequence WHERE prefix = 'CONC' AND fiscal_year = 2026`);
  const isConcBoundToActive = concRes.rows.length > 0 && concRes.rows[0].gstin === "29AABCC1234F1Z5";
  if (isConcBoundToActive) {
    const orderSameGstin = { ...baseOrder, id: `test_conc_${Date.now()}`, invoice_prefix: "CONC" };
    const resSameGstin = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderSameGstin);
    recordTest(
      "SAFEGUARD-02",
      "Same-GSTIN authorized series generates valid statutory invoice",
      resSameGstin.success === true && Boolean(resSameGstin.invoice_number?.startsWith("CONC/")),
      resSameGstin.invoice_number || resSameGstin.code || "FAIL",
      "CONC/25-26/XXXXXX",
      { invoiceNumber: resSameGstin.invoice_number }
    );
  } else {
    console.log("  [SKIP] CONC sequence not pre-bound to 29AABCC1234F1Z5");
  }

  // ── 3. Missing, Blank, or Malformed Prefix Validation ─────────────────────────
  console.log("\n3. Testing Missing, Blank & Malformed Prefix Validation...");
  
  // 3a. Empty string
  const orderEmptyPrefix = { ...baseOrder, invoice_prefix: "" };
  // If empty, falls back to CTH which then triggers prefix conflict, OR invalid
  // If explicitly passed empty string with no fallback
  const resEmpty = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, { ...baseOrder, invoice_prefix: "   " });
  recordTest(
    "SAFEGUARD-03A",
    "Whitespace prefix rejected with INVOICE_PREFIX_INVALID",
    resEmpty.success === false && resEmpty.code === "INVOICE_PREFIX_INVALID",
    resEmpty.code || "SUCCESS",
    "INVOICE_PREFIX_INVALID"
  );

  // 3b. Slashes or illegal characters
  const orderSlash = { ...baseOrder, invoice_prefix: "CTH/INV" };
  const resSlash = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderSlash);
  recordTest(
    "SAFEGUARD-03B",
    "Prefix with slashes rejected with INVOICE_PREFIX_INVALID",
    resSlash.success === false && resSlash.code === "INVOICE_PREFIX_INVALID",
    resSlash.code || "SUCCESS",
    "INVOICE_PREFIX_INVALID"
  );

  // 3c. Exceeding 16 characters
  const orderTooLong = { ...baseOrder, invoice_prefix: "CTH-SERIES-NAME-TOO-LONG-999" };
  const resTooLong = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderTooLong);
  recordTest(
    "SAFEGUARD-03C",
    "Prefix exceeding 16 chars rejected with INVOICE_PREFIX_INVALID",
    resTooLong.success === false && resTooLong.code === "INVOICE_PREFIX_INVALID",
    resTooLong.code || "SUCCESS",
    "INVOICE_PREFIX_INVALID"
  );

  // ── 4. Database Connection / Unverifiable State Fail-Closed ───────────────────
  console.log("\n4. Testing Database Failure & Unverifiable State Fail-Closed...");
  const dbModule = await import("../src/lib/db");
  const pgPool = dbModule.getDbPool();
  const origPoolQuery = pgPool.query.bind(pgPool);
  
  try {
    (pgPool as any).query = (queryText: any, params?: any, callback?: any) => {
      const q = typeof queryText === "string" ? queryText : (queryText?.text || "");
      if (q.includes("invoice_sequence")) {
        throw new Error("Connection refused: 127.0.0.1:5433 postgres socket dropped");
      }
      return origPoolQuery(queryText, params, callback);
    };

    const orderDbFail = { ...baseOrder, id: `test_dbfail_${Date.now()}`, invoice_prefix: "SAFE-TEST" };
    const resDbFail = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderDbFail);
    recordTest(
      "SAFEGUARD-04",
      "Database connection drop fails closed with INVOICE_SEQUENCE_VERIFICATION_FAILED",
      resDbFail.success === false && resDbFail.code === "INVOICE_SEQUENCE_VERIFICATION_FAILED",
      resDbFail.code || "BYPASS",
      "INVOICE_SEQUENCE_VERIFICATION_FAILED",
      { error: resDbFail.error }
    );
  } finally {
    pgPool.query = origPoolQuery;
  }

  // ── 5. Query / Permission Error Fail-Closed ───────────────────────────────────
  console.log("\n5. Testing Query Permission Error Fail-Closed...");
  try {
    (pgPool as any).query = (queryText: any, params?: any, callback?: any) => {
      const q = typeof queryText === "string" ? queryText : (queryText?.text || "");
      if (q.includes("invoice_sequence")) {
        const permErr: any = new Error("permission denied for table invoice_sequence");
        permErr.code = "42501";
        throw permErr;
      }
      return origPoolQuery(queryText, params, callback);
    };

    const orderPermFail = { ...baseOrder, id: `test_permfail_${Date.now()}`, invoice_prefix: "PERM-TEST" };
    const resPermFail = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderPermFail);
    recordTest(
      "SAFEGUARD-05",
      "Database permission error fails closed with INVOICE_SEQUENCE_VERIFICATION_FAILED",
      resPermFail.success === false && resPermFail.code === "INVOICE_SEQUENCE_VERIFICATION_FAILED",
      resPermFail.code || "BYPASS",
      "INVOICE_SEQUENCE_VERIFICATION_FAILED",
      { error: resPermFail.error }
    );
  } finally {
    pgPool.query = origPoolQuery;
  }

  // ── 6. Direct Database Allocator Rejection ────────────────────────────────────
  console.log("\n6. Testing Direct PostgreSQL Stored Function Allocator Rejection...");
  let allocatorThrew = false;
  let allocatorErrCode = "";
  try {
    await pool.query(
      `SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, $5)`,
      ["CTH", `alloc_test_${Date.now()}`, "CAKETOHOME_PARENT", "29AABCC1234F1Z5", new Date()]
    );
  } catch (err: any) {
    allocatorThrew = true;
    allocatorErrCode = err?.message || "";
  }
  recordTest(
    "SAFEGUARD-06",
    "PostgreSQL allocate_invoice_number raises AMBIGUOUS_GSTIN_SEQUENCE_SCOPE",
    allocatorThrew && allocatorErrCode.includes("AMBIGUOUS_GSTIN_SEQUENCE_SCOPE"),
    allocatorErrCode.split("\n")[0].slice(0, 50),
    "AMBIGUOUS_GSTIN_SEQUENCE_SCOPE"
  );

  // ── 7. Idempotency & Duplicate Request Safety ─────────────────────────────────
  console.log("\n7. Testing Idempotency & Duplicate Request Safety...");
  // Find an existing invoice in PostgreSQL
  const existingInv = await pool.query(`SELECT id, invoice_number, order_id FROM public.invoice LIMIT 1`);
  if (existingInv.rows.length > 0) {
    const inv = existingInv.rows[0];
    const dupOrder = { ...baseOrder, id: inv.order_id, invoice_prefix: "CONC" };
    const resDup = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, dupOrder);
    recordTest(
      "SAFEGUARD-07",
      "Duplicate invoice request returns existing invoice without incrementing sequence",
      resDup.success === true && resDup.idempotent_replay === true && resDup.invoice_number === inv.invoice_number,
      `idempotent_replay: ${resDup.idempotent_replay}, number: ${resDup.invoice_number}`,
      `idempotent_replay: true, number: ${inv.invoice_number}`
    );
  }

  // ── 8. Concurrency & Advisory Lock Serialization ─────────────────────────────
  console.log("\n8. Testing Concurrency & Lock Serialization...");
  const orderConc1 = { ...baseOrder, id: `test_conc_race_1_${Date.now()}`, invoice_prefix: "CONC" };
  const orderConc2 = { ...baseOrder, id: `test_conc_race_2_${Date.now()}`, invoice_prefix: "CONC" };

  const [conc1, conc2] = await Promise.all([
    DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderConc1),
    DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderConc2),
  ]);

  const bothSucceeded = conc1.success && conc2.success;
  const distinctNumbers = conc1.invoice_number !== conc2.invoice_number;
  recordTest(
    "SAFEGUARD-08",
    "Concurrent allocations produce distinct, serialized sequence numbers",
    bothSucceeded && distinctNumbers,
    `inv1: ${conc1.invoice_number}, inv2: ${conc2.invoice_number}`,
    "Distinct serialized numbers"
  );

  // ── 9. Order Preservation When Invoice Allocation is Blocked ─────────────────
  console.log("\n9. Testing Order Preservation When Invoicing Fails Closed...");
  // Create an order in PostgreSQL "order" table
  const testOrderIdDb = `order_preservation_${Date.now()}`;
  await pool.query(
    `INSERT INTO public."order" (id, customer_id, email, grand_total, subtotal, tax_total, status, seller_legal_name, seller_gstin, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      testOrderIdDb,
      "cus_preservation_test",
      "preservation.test@caketohome.com",
      681.46,
      649.00,
      32.46,
      "delivered",
      "CakeToHome India Private Limited",
      "29AABCC1234F1Z5",
      JSON.stringify({ order_number: "CTH-PRESERVE-01" }),
    ]
  );

  // Attempt invoice generation with conflicting CTH prefix
  const orderToBlock = {
    id: testOrderIdDb,
    order_number: "CTH-PRESERVE-01",
    status: "delivered",
    invoice_prefix: "CTH", // Conflicting
    seller_legal_name: "CakeToHome India Private Limited",
    seller_gstin: "29AABCC1234F1Z5",
    pricing: { subtotal: 649, tax_total: 32.46, grand_total: 681.46 },
    items: baseOrder.items,
  };

  const blockRes = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, orderToBlock);

  // Verify order in DB was NOT rolled back or destroyed
  const verifyOrderDb = await pool.query(`SELECT id, status, grand_total FROM public."order" WHERE id = $1`, [testOrderIdDb]);
  const orderPreserved = verifyOrderDb.rows.length === 1 && verifyOrderDb.rows[0].status === "delivered";

  recordTest(
    "SAFEGUARD-09",
    "Order record is preserved in PostgreSQL when statutory invoice is blocked",
    blockRes.success === false && blockRes.code === "INVOICE_SERIES_PREFIX_CONFLICT" && orderPreserved,
    `Order present: ${orderPreserved}, Invoice code: ${blockRes.code}`,
    "Order present: true, Invoice code: INVOICE_SERIES_PREFIX_CONFLICT"
  );

  // ── 10. Zero Credential Exposure in Error Messages ───────────────────────────
  console.log("\n10. Testing Zero Credential Exposure in Errors...");
  const errorsToAudit = [resConflict.error, resEmpty.error, resSlash.error, resTooLong.error];
  const leaksCredentials = errorsToAudit.some((e) => e && (e.includes("postgres:") || e.includes("cth_test_user") || e.includes("supersecret")));
  recordTest(
    "SAFEGUARD-10",
    "Error messages contain zero exposed credentials or internal passwords",
    !leaksCredentials,
    leaksCredentials ? "LEAKED" : "CLEAN",
    "CLEAN"
  );

  console.log("\n================================================================================");
  console.log(`  MATRIX EXECUTION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  await pool.end();
  process.exit(failedCount > 0 ? 1 : 0);
}

runMatrix().catch((err) => {
  console.error("FATAL matrix runner exception:", err);
  process.exit(1);
});
