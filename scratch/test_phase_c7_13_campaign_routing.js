/**
 * CakeToHome ERP — Phase C7.13 Test Suite: Corporate Campaign Integration
 * Strictly bounded execution (max 90s), granular progress logging, real schema fidelity, clean resource teardown.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require(path.join(__dirname, "../frontend/node_modules/pg"));
const Module = require("module");

// 1. Overall test timeout guard (strictly bounded to max 90 seconds)
const OVERALL_TIMEOUT_MS = 90000;
let lastProgressOperation = "Initialization";
let globalTestClient = null;

const overallTimer = setTimeout(async () => {
  console.error(`\n[FATAL TIMEOUT] test_phase_c7_13_campaign_routing.js exceeded ${OVERALL_TIMEOUT_MS}ms!`);
  console.error(`Last completed operation before hang: "${lastProgressOperation}"`);
  if (globalTestClient) {
    try {
      await globalTestClient.end();
      console.error("[TEARDOWN] Test PostgreSQL client ended on timeout.");
    } catch {}
  }
  if (globalThis.__cth_pg_pool__) {
    try {
      await globalThis.__cth_pg_pool__.end();
      console.error("[TEARDOWN] Global application pool ended on timeout.");
    } catch {}
  }
  process.exit(1);
}, OVERALL_TIMEOUT_MS);
if (overallTimer.unref) overallTimer.unref();

function markProgress(operation) {
  lastProgressOperation = operation;
  console.log(`[PROGRESS ${new Date().toISOString().substring(11, 19)}] ${operation}`);
}

// Module Alias Resolution for @frontend/
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@frontend/")) {
    const sub = request.substring("@frontend/".length);
    const mapped = path.resolve(__dirname, "../frontend/src", sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Register TypeScript compilation hook
const ts = require(path.join(__dirname, "../frontend/node_modules/typescript"));
require.extensions[".ts"] = function (module, filename) {
  const content = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  return module._compile(compiled.outputText, filename);
};

function getConnectionString() {
  const envPath = path.join(__dirname, "../frontend/.env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        let val = trimmed.substring("DATABASE_URL=".length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

const connectionString = getConnectionString();
process.env.DATABASE_URL = connectionString;

const { NextRequest } = require(path.join(__dirname, "../frontend/node_modules/next/server"));
const { signAuthToken } = require("../frontend/src/lib/security/auth-session");
const { GET, POST } = require("../frontend/src/app/api/v1/[...path]/route");
const ExcelJS = require(path.join(__dirname, "../frontend/node_modules/exceljs"));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Bounded API Request with 15-second hard timeout per request
async function apiRequest(method, pathParts, body = null, token = null, queryParams = "", customHeaders = {}, timeoutMs = 15000) {
  const pathStr = pathParts.join("/");
  const url = `http://localhost:3000/api/v1/${pathStr}${queryParams ? `?${queryParams}` : ""}`;
  markProgress(`[HTTP START] ${method} /api/v1/${pathStr}`);
  const startTime = Date.now();

  const headers = { "Content-Type": "application/json", ...customHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const reqInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    reqInit.body = JSON.stringify(body);
  }

  const req = new NextRequest(url, reqInit);
  const params = { params: { path: pathParts } };

  const executionPromise = (async () => {
    let response;
    if (method === "GET") response = await GET(req, params);
    else if (method === "POST") response = await POST(req, params);
    else throw new Error(`Unsupported method: ${method}`);

    const status = response.status;
    let resBody = null;
    try {
      resBody = await response.json();
    } catch {
      resBody = null;
    }
    return { status, body: resBody };
  })();

  const timeoutPromise = new Promise((_, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`[HTTP TIMEOUT] ${method} /api/v1/${pathStr} exceeded ${timeoutMs}ms without response`));
    }, timeoutMs);
    if (t.unref) t.unref();
  });

  try {
    const result = await Promise.race([executionPromise, timeoutPromise]);
    const duration = Date.now() - startTime;
    markProgress(`[HTTP DONE] ${method} /api/v1/${pathStr} -> ${result.status} (${duration}ms)`);
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    markProgress(`[HTTP ERROR] ${method} /api/v1/${pathStr} after ${duration}ms: ${err.message}`);
    throw err;
  }
}

// Tracked Database Query Helper with query start/done progress logging
async function trackedQuery(client, text, params = [], label = "") {
  const querySummary = label || text.replace(/\s+/g, " ").trim().substring(0, 90);
  markProgress(`[DB QUERY START] ${querySummary}`);
  const startTime = Date.now();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - startTime;
    markProgress(`[DB QUERY DONE] ${querySummary} (${duration}ms, ${res.rowCount ?? res.rows?.length ?? 0} rows)`);
    return res;
  } catch (err) {
    const duration = Date.now() - startTime;
    markProgress(`[DB QUERY ERROR] ${querySummary} (${duration}ms): ${err.message}`);
    throw err;
  }
}

async function runC7_13_Suite() {
  console.log("==================================================================");
  console.log("CAKETOHOME ERP — PHASE C7.13: CORPORATE CAMPAIGN INTEGRATION SUITE");
  console.log("==================================================================\n");

  markProgress("Connecting to PostgreSQL...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  globalTestClient = client;

  await client.connect();
  markProgress("Connected to PostgreSQL successfully.");

  // Set bounded statement timeout for all subsequent test transactions
  await trackedQuery(client, "SET statement_timeout = 10000;", [], "SET statement_timeout = 10s");

  const runId = Date.now();
  const testStoreId = `br_test_13_${runId}`;
  const testZoneId = `zone_test_13_${runId}`;
  const testPartnerId = `dlp_test_13_${runId}`;
  const testPartnerOtherId = `dlp_test_13_other_${runId}`;
  const testPartnerProfId = `prof_test_13_${runId}`;
  const testPartnerCovId = `cov_test_13_${runId}`;
  const testCustomerId = `cust_test_13_${runId}`;
  const testAccountId = `acc_test_13_${runId}`;

  let createdBatchId = null;
  let recipient1Id = null;
  let recipient2Id = null;

  try {
    // ── INITIAL FIXTURE PURGE (Safe Clean-up of any previous aborted test artifacts) ──
    markProgress("Initial safety cleanup of any prior aborted test run artifacts...");
    await trackedQuery(client, "ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;", [], "Disable assignment event trigger");
    await trackedQuery(client, "DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT');", [], "Delete stale test assignment events");
    await trackedQuery(client, "ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;", [], "Re-enable assignment event trigger");

    await trackedQuery(client, "DELETE FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT';", [], "Delete stale test assignments");
    await trackedQuery(client, "DELETE FROM public.delivery WHERE recipient_name IN ('Anita Desai', 'Karan Johar');", [], "Delete stale test deliveries");
    await trackedQuery(client, "DELETE FROM public.corporate_gifting_recipient WHERE recipient_name IN ('Anita Desai', 'Karan Johar');", [], "Delete stale test recipients");
    await trackedQuery(client, "DELETE FROM public.corporate_gifting_batch WHERE batch_name LIKE 'C713 Campaign Batch %';", [], "Delete stale test batches");
    await trackedQuery(client, "DELETE FROM public.delivery_partner_coverage WHERE id LIKE 'cov_test_13_%';", [], "Delete stale partner coverages");
    await trackedQuery(client, "DELETE FROM public.delivery_partner_profile WHERE id LIKE 'prof_test_13_%';", [], "Delete stale partner profiles");
    await trackedQuery(client, "DELETE FROM public.delivery_partner WHERE id LIKE 'dlp_test_13_%';", [], "Delete stale delivery partners");
    await trackedQuery(client, "DELETE FROM public.delivery_zone WHERE id LIKE 'zone_test_13_%';", [], "Delete stale delivery zones");
    await trackedQuery(client, "DELETE FROM public.branch WHERE id LIKE 'br_test_13_%';", [], "Delete stale branches");
    await trackedQuery(client, "DELETE FROM public.invoice WHERE customer_id LIKE 'cust_test_13_%' OR order_id IN (SELECT id FROM public.order WHERE customer_id LIKE 'cust_test_13_%');", [], "Delete stale invoices");
    await trackedQuery(client, "DELETE FROM public.order_item WHERE order_id IN (SELECT id FROM public.order WHERE customer_id LIKE 'cust_test_13_%');", [], "Delete stale order items");
    await trackedQuery(client, "DELETE FROM public.order WHERE customer_id LIKE 'cust_test_13_%';", [], "Delete stale orders");
    await trackedQuery(client, `
      DELETE FROM public.accounting_journal_line
      WHERE customer_id LIKE 'cust_test_13_%'
         OR journal_entry_id IN (
           SELECT id FROM public.accounting_journal_entry
           WHERE voucher_id IN (
             SELECT id FROM public.accounting_voucher
             WHERE reference_event = 'CORPORATE_INVOICE_POSTED'
                OR reference_id LIKE 'inv_corp_%'
           )
         );
    `, [], "Delete stale journal lines");
    await trackedQuery(client, `
      DELETE FROM public.accounting_journal_entry
      WHERE voucher_id IN (
        SELECT id FROM public.accounting_voucher
        WHERE reference_event = 'CORPORATE_INVOICE_POSTED'
           OR reference_id LIKE 'inv_corp_%'
      );
    `, [], "Delete stale journal entries");
    await trackedQuery(client, `
      DELETE FROM public.accounting_voucher
      WHERE reference_event = 'CORPORATE_INVOICE_POSTED'
         OR reference_id LIKE 'inv_corp_%';
    `, [], "Delete stale vouchers");
    await trackedQuery(client, "DELETE FROM public.corporate_account WHERE customer_id LIKE 'cust_test_13_%';", [], "Delete stale corporate accounts");
    await trackedQuery(client, "DELETE FROM public.customer WHERE id LIKE 'cust_test_13_%';", [], "Delete stale customers");

    // ── 0. PREFLIGHT INVARIANT CHECK ──────────────────────────────────────────
    markProgress("Preflight baseline verification...");
    const preCoA = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.accounting_account;", [], "Count CoA accounts");
    const preV = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.accounting_voucher;", [], "Count accounting vouchers");
    const preJE = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.accounting_journal_entry;", [], "Count journal entries");
    const preJL = await trackedQuery(client, "SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;", [], "Count and sum journal lines");
    const preDP = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;", [], "Count delivery partners");
    const preBranch = await trackedQuery(client, "SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;", [], "Count active branches");

    assert(preCoA.rows[0].cnt === 100, `Preflight CoA is 100 accounts: ${preCoA.rows[0].cnt}`);
    assert(preV.rows[0].cnt === 6, `Preflight Vouchers = 6: ${preV.rows[0].cnt}`);
    assert(preJE.rows[0].cnt === 4, `Preflight Journal Entries = 4: ${preJE.rows[0].cnt}`);
    assert(preJL.rows[0].cnt === 10, `Preflight Journal Lines = 10: ${preJL.rows[0].cnt}`);
    assert(
      Number(preJL.rows[0].dr) === 3380.0 && Number(preJL.rows[0].cr) === 3380.0,
      `Preflight TB strictly balanced Dr/Cr ₹3,380.00`
    );
    assert(preDP.rows[0].cnt === 30, `Preflight Delivery Partners preserved: ${preDP.rows[0].cnt}`);
    assert(preBranch.rows[0].active === 48, `Preflight Active Branches preserved: ${preBranch.rows[0].active}`);

    const preAssignments = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;", [], "Count assignments");
    const preEvents = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_assignment_event;", [], "Count assignment events");
    assert(preAssignments.rows[0].cnt === 0, `Preflight residual assignments is 0: ${preAssignments.rows[0].cnt}`);
    assert(preEvents.rows[0].cnt === 0, `Preflight residual events is 0: ${preEvents.rows[0].cnt}`);
    markProgress("Preflight baseline verified 100%.");

    // ── 1. SETUP TEST FIXTURES ───────────────────────────────────────────────
    markProgress("Seeding test corporate customer, account, store, zone, and delivery partners...");

    const shopRes = await trackedQuery(client, "SELECT id FROM public.shop LIMIT 1;", [], "Query shop ID");
    const shopId = shopRes.rows[0]?.id || null;

    // Corporate Customer (Schema verified: credit_enabled, credit_limit, credit_balance, payment_terms_days, credit_status)
    await trackedQuery(client, `
      INSERT INTO public.customer (
        id, first_name, last_name, email, phone, is_corporate,
        company_name, credit_enabled, credit_limit, credit_balance, payment_terms_days, credit_status
      ) VALUES ($1, 'Acme', 'Corporate', 'acme.c713@example.com', '+919876507713', true,
        'Acme Technologies Pvt Ltd', true, 500000.00, 500000.00, 30, 'APPROVED');
    `, [testCustomerId], "Insert test customer");

    // Corporate Account (Schema verified: customer_id, legal_name, trade_name, legal_name_key, status)
    await trackedQuery(client, `
      INSERT INTO public.corporate_account (
        id, customer_id, legal_name, trade_name, legal_name_key, status
      ) VALUES ($1, $2, 'Acme Technologies Pvt Ltd', 'Acme Corp', 'acme technologies pvt ltd', 'APPROVED');
    `, [testAccountId, testCustomerId], "Insert test corporate account");

    // Store (Corporate routing eligible) in Indiranagar, Bengaluru
    await trackedQuery(client, `
      INSERT INTO public.branch (
        id, name, code, is_open, phone, email, address, latitude, longitude,
        shop_id, is_corporate_routing_eligible
      ) VALUES ($1, 'Indiranagar Central Hub C713', 'HUB-C713', true, '9999913001',
        'hub.c713@example.com', '100ft Road, Indiranagar', 12.9716, 77.6412, $2, true);
    `, [testStoreId, shopId], "Insert test branch");

    // Serviceable Delivery Zone with polygon geofence covering Indiranagar (12.970-12.990, 77.630-77.650)
    const polygonGeofence = [
      [12.970, 77.630],
      [12.990, 77.630],
      [12.990, 77.650],
      [12.970, 77.650],
      [12.970, 77.630],
    ];

    await trackedQuery(client, `
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'Indiranagar Zone C713', '560038', 0.00, true,
        $3, NULL, 12.9716, 77.6412, 100);
    `, [testZoneId, testStoreId, JSON.stringify(polygonGeofence)], "Insert test delivery zone");

    // Primary Delivery Partner
    await trackedQuery(client, `
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES ($1, 'Vikram', 'Rathore', 'vikram.c713@example.com', '+919988130001');
    `, [testPartnerId], "Insert primary delivery partner");

    // Secondary Delivery Partner (for cross-partner access rejection test)
    await trackedQuery(client, `
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES ($1, 'Sunil', 'Kumar', 'sunil.c713@example.com', '+919988130002');
    `, [testPartnerOtherId], "Insert secondary delivery partner");

    // Partner Profile & Coverage for Primary Partner
    await trackedQuery(client, `
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.9);
    `, [testPartnerProfId, testPartnerId, testStoreId], "Insert partner profile");

    await trackedQuery(client, `
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, radius_km, center_latitude, center_longitude)
      VALUES ($1, $2, $3, 'RADIUS', 30, true, 12.0, 12.9716, 77.6412);
    `, [testPartnerCovId, testPartnerId, testStoreId], "Insert partner coverage");

    // Auth Tokens
    const superAdminToken = signAuthToken({
      userId: "usr_superadmin",
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      permissions: ["*"],
    });

    const partnerToken = signAuthToken({
      userId: testPartnerId,
      partnerId: testPartnerId,
      role: "DELIVERY_PARTNER",
      isSuperAdmin: false,
      permissions: ["DELIVERY.VIEW", "DELIVERY.UPDATE"],
    });

    const otherPartnerToken = signAuthToken({
      userId: testPartnerOtherId,
      partnerId: testPartnerOtherId,
      role: "DELIVERY_PARTNER",
      isSuperAdmin: false,
      permissions: ["DELIVERY.VIEW", "DELIVERY.UPDATE"],
    });

    const customerToken = signAuthToken({
      userId: testCustomerId,
      customerId: testCustomerId,
      role: "CUSTOMER",
      isSuperAdmin: false,
      permissions: [],
    });

    markProgress("Fixtures seeded successfully.");

    // ── 2. BUILD TEST SPREADSHEET IN MEMORY ─────────────────────────────────
    markProgress("Building test Excel workbook in memory with 2 recipients...");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Recipients");
    sheet.columns = [
      { header: "employee_id", key: "employee_id" },
      { header: "recipient_name", key: "recipient_name" },
      { header: "recipient_phone", key: "recipient_phone" },
      { header: "delivery_address", key: "delivery_address" },
      { header: "delivery_city", key: "delivery_city" },
      { header: "delivery_pincode", key: "delivery_pincode" },
      { header: "latitude", key: "latitude" },
      { header: "longitude", key: "longitude" },
      { header: "delivery_date", key: "delivery_date" },
      { header: "delivery_slot", key: "delivery_slot" },
      { header: "product_sku", key: "product_sku" },
      { header: "quantity", key: "quantity" },
      { header: "gift_message", key: "gift_message" },
    ];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const delivDateStr = tomorrow.toISOString().split("T")[0];

    // Recipient 1: Valid Coordinates inside Indiranagar polygon (12.9750, 77.6350)
    sheet.addRow({
      employee_id: "EMP-101",
      recipient_name: "Anita Desai",
      recipient_phone: "9876501101",
      delivery_address: "Flat 4B, Palm Grove, Indiranagar",
      delivery_city: "Bengaluru",
      delivery_pincode: "560038",
      latitude: 12.9750,
      longitude: 77.6350,
      delivery_date: delivDateStr,
      delivery_slot: "MORNING",
      product_sku: "BUTTER-CROISSANT",
      quantity: 2,
      gift_message: "Happy Anniversary Anita!",
    });

    // Recipient 2: Missing Coordinates (unresolved location review candidate)
    sheet.addRow({
      employee_id: "EMP-102",
      recipient_name: "Karan Johar",
      recipient_phone: "9876501102",
      delivery_address: "Plot 12, Outer Ring Road",
      delivery_city: "Bengaluru",
      delivery_pincode: "560038",
      latitude: "",
      longitude: "",
      delivery_date: delivDateStr,
      delivery_slot: "EVENING",
      product_sku: "BUTTER-CROISSANT",
      quantity: 1,
      gift_message: "Best Wishes Karan!",
    });

    const fileBuffer = await workbook.xlsx.writeBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString("base64");
    markProgress("Excel workbook generated in memory.");

    // ── 3. TEST 1: DRY-RUN BATCH VALIDATION (ZERO WRITES) ───────────────────
    markProgress("Executing Test 1: Dry-Run Batch Validation API call...");
    const valRes = await apiRequest("POST", ["admin", "corporate-gifting", "validate"], {
      customerId: testCustomerId,
      fileBase64,
      sourceFilename: "c713_test_campaign.xlsx",
    }, superAdminToken);

    assert(valRes.status === 200, `TEST 1: Validate returned 200 OK (actual: ${valRes.status})`);
    assert(valRes.body.isValid === true, `TEST 1: Spreadsheet is completely valid`);
    assert(valRes.body.totalRows === 2, `TEST 1: Total rows parsed is 2`);
    assert(valRes.body.validRows === 2, `TEST 1: Valid rows is 2`);

    const parsed = valRes.body.parsedRecipients;
    assert(Array.isArray(parsed) && parsed.length === 2, `TEST 1: parsedRecipients contains 2 rows`);
    assert(parsed[0].routingPreview !== undefined, `TEST 1: Recipient 1 has routingPreview`);
    assert(parsed[0].routingPreview.can_match === true, `TEST 1: Recipient 1 preview can_match: true`);
    assert(parsed[0].routingPreview.matched_store_id === testStoreId, `TEST 1: Recipient 1 matched test store`);
    assert(parsed[1].routingPreview.can_match === false, `TEST 1: Recipient 2 preview can_match: false (missing coords)`);
    assert(parsed[1].routingPreview.reason_code === "COORDINATES_MISSING", `TEST 1: Recipient 2 reason is COORDINATES_MISSING`);

    // Invariant: Verify 0 database writes occurred during dry-run validation
    const dryBatches = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_gifting_batch WHERE customer_id = $1;", [testCustomerId], "Verify zero dry batches");
    const dryRecips = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_gifting_recipient WHERE deleted_at IS NULL;", [], "Verify zero dry recipients");
    const dryDeliveries = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.delivery WHERE recipient_name IN ('Anita Desai', 'Karan Johar');", [], "Verify zero dry deliveries");
    const dryAssignments = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;", [], "Verify zero dry assignments");
    assert(dryBatches.rows[0].cnt === 0, `TEST 1: Zero batches written to DB (count = 0)`);
    assert(dryRecips.rows[0].cnt === 0, `TEST 1: Zero recipients written to DB (count = 0)`);
    assert(dryDeliveries.rows[0].cnt === 0, `TEST 1: Zero deliveries written to DB (count = 0)`);
    assert(dryAssignments.rows[0].cnt === 0, `TEST 1: Zero routing assignments written to DB (count = 0)`);
    markProgress("Test 1 completed successfully.");

    // ── 4. TEST 2: CAMPAIGN CONFIRMATION WITH AUTOMATED ROUTING ─────────────
    markProgress("Executing Test 2: Campaign Confirmation Execution API call...");
    const execRes = await apiRequest("POST", ["admin", "corporate-gifting", "execute"], {
      customerId: testCustomerId,
      batchName: `C713 Campaign Batch ${runId}`,
      fileBase64,
      sourceFilename: "c713_test_campaign.xlsx",
    }, superAdminToken);

    assert(execRes.status === 200, `TEST 2: Execute returned 200 OK (actual: ${execRes.status})`);
    assert(execRes.body.success === true, `TEST 2: Execution returned success: true`);
    assert(execRes.body.recipientsCount === 2, `TEST 2: Recipients count is 2`);
    assert(execRes.body.masterOrderId !== null, `TEST 2: Master order ID generated`);
    assert(execRes.body.invoiceId !== null, `TEST 2: Master corporate invoice ID generated`);
    assert(execRes.body.voucherId !== null, `TEST 2: Master accounting voucher generated`);
    assert(execRes.body.routingSummary !== null, `TEST 2: Routing summary returned in response`);
    const aCount = execRes.body.routingSummary.assignedCount ?? execRes.body.routingSummary.total_assigned;
    const uCount = execRes.body.routingSummary.unassignedCount ?? execRes.body.routingSummary.total_unassigned;
    assert(aCount === 1, `TEST 2: Routing summary assignedCount is 1 (actual: ${aCount})`);
    assert(uCount === 1, `TEST 2: Routing summary unassignedCount is 1 (actual: ${uCount})`);

    createdBatchId = execRes.body.batch.id;

    // Verify persisted database records
    const dbRecips = await trackedQuery(client, `
      SELECT id, recipient_name, status, delivery_id
      FROM public.corporate_gifting_recipient
      WHERE batch_id = $1
      ORDER BY row_number ASC;
    `, [createdBatchId], "Query created batch recipients");

    assert(dbRecips.rows.length === 2, `TEST 2: Database has exactly 2 recipient rows`);
    recipient1Id = dbRecips.rows[0].id;
    recipient2Id = dbRecips.rows[1].id;

    // Recipient 1: Valid Coordinates -> ASSIGNED
    const cda1 = await trackedQuery(client, `
      SELECT * FROM public.corporate_delivery_assignment
      WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1;
    `, [recipient1Id], "Query recipient 1 assignment");

    assert(cda1.rows.length === 1, `TEST 2: Recipient 1 has assignment record`);
    assert(cda1.rows[0].status === "ASSIGNED", `TEST 2: Recipient 1 assignment status is ASSIGNED`);
    assert(cda1.rows[0].assigned_store_id === testStoreId, `TEST 2: Recipient 1 assigned to test store`);
    assert(cda1.rows[0].assigned_partner_id === testPartnerId, `TEST 2: Recipient 1 assigned to primary partner`);

    // Verify public.delivery synchronization for Recipient 1
    const del1 = await trackedQuery(client, `
      SELECT delivery_status, delivery_partner_id FROM public.delivery
      WHERE id = $1;
    `, [dbRecips.rows[0].delivery_id], "Query recipient 1 delivery");
    assert(del1.rows.length === 1, `TEST 2: Recipient 1 public.delivery record found`);
    assert(del1.rows[0].delivery_status === "pickup_claimed" || del1.rows[0].delivery_status === "assigned", `TEST 2: public.delivery status synced to partner assignment ('pickup_claimed' / 'assigned') (actual: ${del1.rows[0].delivery_status})`);
    assert(del1.rows[0].delivery_partner_id === testPartnerId, `TEST 2: public.delivery partner synced to '${testPartnerId}'`);

    // Recipient 2: Missing Coordinates -> UNASSIGNED
    const cda2 = await trackedQuery(client, `
      SELECT * FROM public.corporate_delivery_assignment
      WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1;
    `, [recipient2Id], "Query recipient 2 assignment");

    assert(cda2.rows.length === 1, `TEST 2: Recipient 2 has assignment record`);
    assert(cda2.rows[0].status === "UNASSIGNED", `TEST 2: Recipient 2 assignment status is UNASSIGNED`);
    assert(cda2.rows[0].reason_code === "COORDINATES_MISSING", `TEST 2: Recipient 2 reason code is COORDINATES_MISSING`);

    // Verify public.delivery for Recipient 2 remains 'pending'
    const del2 = await trackedQuery(client, `
      SELECT delivery_status, delivery_partner_id FROM public.delivery
      WHERE id = $1;
    `, [dbRecips.rows[1].delivery_id], "Query recipient 2 delivery");
    assert(del2.rows.length === 1, `TEST 2: Recipient 2 public.delivery record found`);
    assert(del2.rows[0].delivery_status === "pending", `TEST 2: Recipient 2 delivery status remains 'pending'`);
    assert(del2.rows[0].delivery_partner_id === null, `TEST 2: Recipient 2 has no delivery partner`);
    markProgress("Test 2 completed successfully.");

    // ── 5. TEST 3: BATCH ROUTING OVERVIEW & RECIPIENT DETAIL RETRIEVAL ────────
    markProgress("Executing Test 3: Batch Routing Overview and PII protection tests...");
    const overviewRes = await apiRequest("GET", ["admin", "corporate-gifting", "batches", createdBatchId, "routing"], null, superAdminToken);

    assert(overviewRes.status === 200, `TEST 3: GET /batches/:id/routing returned 200 OK`);
    assert(overviewRes.body.total_recipients === 2, `TEST 3: total_recipients = 2`);
    assert(overviewRes.body.assigned_count === 1, `TEST 3: assigned_count = 1`);
    assert(overviewRes.body.unassigned_count === 1, `TEST 3: unassigned_count = 1`);
    assert(overviewRes.body.unassigned_breakdown["COORDINATES_MISSING"] === 1, `TEST 3: breakdown contains COORDINATES_MISSING: 1`);

    // Detail endpoint GET /batches/:id
    const batchDetailRes = await apiRequest("GET", ["admin", "corporate-gifting", "batches", createdBatchId], null, superAdminToken);
    assert(batchDetailRes.status === 200, `TEST 3: GET /batches/:id returned 200 OK`);
    assert(batchDetailRes.body.routingSummary !== null, `TEST 3: batch detail includes routingSummary`);
    assert(batchDetailRes.body.recipients.length === 2, `TEST 3: batch detail recipients contains 2 items`);

    // PII Masking test: Staff without PII permission
    const limitedStaffToken = signAuthToken({
      userId: "usr_ops_limited",
      role: "OPERATIONS",
      isSuperAdmin: false,
      permissions: ["CORPORATE_GIFTING.VIEW"],
    });
    const limitedRes = await apiRequest("GET", ["admin", "corporate-gifting", "batches", createdBatchId], null, limitedStaffToken);
    assert(limitedRes.status === 200, `TEST 3: Limited staff can view batch detail`);
    const maskedPhone = limitedRes.body.recipients[0].recipient_phone;
    assert(maskedPhone.includes("******"), `TEST 3: PII protected: recipient phone masked for limited staff (${maskedPhone})`);
    markProgress("Test 3 completed successfully.");

    // ── 6. TEST 4: BATCH RE-EVALUATION IDEMPOTENCY ───────────────────────────
    markProgress("Executing Test 4: Batch Re-Evaluation Idempotency test...");
    const preReevalEvents = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_assignment_event;", [], "Count events before re-eval");

    const reevalRes = await apiRequest("POST", ["admin", "corporate-gifting", "batches", createdBatchId, "route"], {
      forceReassign: false,
    }, superAdminToken);

    assert(reevalRes.status === 200, `TEST 4: Re-evaluate route returned 200 OK`);
    assert(reevalRes.body.summary.assignedCount === 1, `TEST 4: Re-eval assignedCount remains 1`);
    assert(reevalRes.body.summary.unassignedCount === 1, `TEST 4: Re-eval unassignedCount remains 1`);

    const postReevalEvents = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_assignment_event;", [], "Count events after re-eval");
    assert(
      postReevalEvents.rows[0].cnt === preReevalEvents.rows[0].cnt,
      `TEST 4: Idempotent re-evaluation emitted zero duplicate audit events (before: ${preReevalEvents.rows[0].cnt}, after: ${postReevalEvents.rows[0].cnt})`
    );
    markProgress("Test 4 completed successfully.");

    // ── 7. TEST 5: MANUAL OVERRIDE & PRESERVATION ────────────────────────────
    markProgress("Executing Test 5: Manual Reassignment & Override Preservation...");
    const reassignRes = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient2Id, "reassign"], {
      storeId: testStoreId,
      partnerId: testPartnerId,
      overrideReason: "Executive dispatch authorized by Super Admin",
      latitude: 12.9720,
      longitude: 77.6380,
    }, superAdminToken);

    assert(reassignRes.status === 200, `TEST 5: Manual reassign returned 200 OK`);
    assert(reassignRes.body.success === true, `TEST 5: Manual reassign success: true`);
    assert(reassignRes.body.assignment.status === "MANUAL_OVERRIDE", `TEST 5: Assignment status set to MANUAL_OVERRIDE`);
    assert(reassignRes.body.assignment.reason_code === "MANUAL_OVERRIDE", `TEST 5: Reason code set to MANUAL_OVERRIDE`);
    assert(reassignRes.body.delivery_status === "assigned", `TEST 5: public.delivery status updated to 'assigned'`);

    // Verify public.delivery synchronization for Recipient 2
    const del2After = await trackedQuery(client, `
      SELECT delivery_status, delivery_partner_id FROM public.delivery
      WHERE id = $1;
    `, [dbRecips.rows[1].delivery_id], "Query recipient 2 delivery after manual override");
    assert(del2After.rows[0].delivery_status === "pickup_claimed" || del2After.rows[0].delivery_status === "assigned", `TEST 5: public.delivery status is 'pickup_claimed' / 'assigned' (actual: ${del2After.rows[0].delivery_status})`);
    assert(del2After.rows[0].delivery_partner_id === testPartnerId, `TEST 5: public.delivery partner synced to '${testPartnerId}'`);

    // Verify MANUALLY_OVERRIDDEN event appended
    const eventOverride = await trackedQuery(client, `
      SELECT event_type, actor_id, reason FROM public.corporate_assignment_event
      WHERE assignment_id = $1
      ORDER BY created_at DESC LIMIT 1;
    `, [cda2.rows[0].id], "Query override event");
    assert(eventOverride.rows[0].event_type === "MANUALLY_OVERRIDDEN", `TEST 5: Audit event is MANUALLY_OVERRIDDEN`);

    // Re-evaluate batch with forceReassign: false -> MUST PRESERVE MANUAL OVERRIDE
    const preserveRes = await apiRequest("POST", ["admin", "corporate-gifting", "batches", createdBatchId, "route"], {
      forceReassign: false,
    }, superAdminToken);

    assert(preserveRes.status === 200, `TEST 5: Batch re-evaluation with forceReassign: false succeeded`);
    assert(preserveRes.body.summary.assignedCount === 2, `TEST 5: Summary assignedCount is now 2 (1 auto + 1 manual)`);
    assert(preserveRes.body.summary.unassignedCount === 0, `TEST 5: Summary unassignedCount is 0`);

    const cda2Preserved = await trackedQuery(client, `
      SELECT status, reason_code FROM public.corporate_delivery_assignment
      WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1;
    `, [recipient2Id], "Query recipient 2 preserved assignment");
    assert(
      cda2Preserved.rows[0].status === "MANUAL_OVERRIDE",
      `TEST 5: Manual override strictly preserved (status = MANUAL_OVERRIDE)`
    );
    markProgress("Test 5 completed successfully.");

    // ── 8. TEST 6: FORCED REASSIGNMENT (forceReassign: true) ──────────────────
    markProgress("Executing Test 6: Forced Reassignment Re-Evaluation (forceReassign: true)...");
    const forceRes = await apiRequest("POST", ["admin", "corporate-gifting", "batches", createdBatchId, "route"], {
      forceReassign: true,
    }, superAdminToken);

    assert(forceRes.status === 200, `TEST 6: Forced re-evaluation returned 200 OK`);
    assert(forceRes.body.summary.assignedCount === 1, `TEST 6: Automated engine re-evaluated: assignedCount = 1`);
    assert(forceRes.body.summary.unassignedCount === 1, `TEST 6: Recipient 2 reverted to unassigned: unassignedCount = 1`);

    const cda2Reverted = await trackedQuery(client, `
      SELECT status, reason_code FROM public.corporate_delivery_assignment
      WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1;
    `, [recipient2Id], "Query recipient 2 reverted assignment");
    assert(
      cda2Reverted.rows[0].status === "UNASSIGNED",
      `TEST 6: Recipient 2 assignment status returned to UNASSIGNED under forceReassign`
    );
    markProgress("Test 6 completed successfully.");

    // ── 9. TEST 7: DELIVERY LIFECYCLE STATE MACHINE ENFORCEMENT ──────────────
    markProgress("Executing Test 7: Delivery Lifecycle State Machine Enforcement...");
    // A. Direct jump from pending to delivered -> MUST FAIL
    const illegalDeliv1 = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient2Id, "delivery-status"], {
      deliveryStatus: "delivered",
      notes: "Direct completion attempt",
    }, superAdminToken);
    assert(illegalDeliv1.status === 422, `TEST 7: Direct pending -> delivered rejected with 422 (${illegalDeliv1.body.error})`);

    // B. Direct jump from assigned to delivered -> MUST FAIL
    const illegalDeliv2 = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient1Id, "delivery-status"], {
      deliveryStatus: "delivered",
      notes: "Direct jump without transit",
    }, superAdminToken);
    assert(illegalDeliv2.status === 422, `TEST 7: Direct assigned -> delivered rejected with 422 (${illegalDeliv2.body.error})`);

    // C. Valid Transition: assigned -> out_for_delivery -> PASS
    const transitRes = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient1Id, "delivery-status"], {
      deliveryStatus: "out_for_delivery",
      notes: "Picked up by rider for delivery",
    }, partnerToken);
    assert(transitRes.status === 200, `TEST 7: assigned -> out_for_delivery returned 200 OK`);
    assert(transitRes.body.deliveryStatus === "out_for_delivery", `TEST 7: deliveryStatus is out_for_delivery`);
    assert(transitRes.body.recipientStatus === "DISPATCHED", `TEST 7: recipient status mapped to DISPATCHED`);

    const del1Transit = await trackedQuery(client, "SELECT delivery_status FROM public.delivery WHERE id = $1;", [dbRecips.rows[0].delivery_id], "Query recipient 1 delivery after transit");
    assert(del1Transit.rows[0].delivery_status === "in_transit" || del1Transit.rows[0].delivery_status === "out_for_delivery", `TEST 7: public.delivery updated to 'in_transit' / 'out_for_delivery' (actual: ${del1Transit.rows[0].delivery_status})`);

    // D. Valid Transition: out_for_delivery -> delivered -> PASS
    const deliveredRes = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient1Id, "delivery-status"], {
      deliveryStatus: "delivered",
      notes: "Delivered to recipient with signature",
    }, partnerToken);
    assert(deliveredRes.status === 200, `TEST 7: out_for_delivery -> delivered returned 200 OK`);
    assert(deliveredRes.body.deliveryStatus === "delivered", `TEST 7: deliveryStatus is delivered`);
    assert(deliveredRes.body.recipientStatus === "DELIVERED", `TEST 7: recipient status mapped to DELIVERED`);

    const del1Delivered = await trackedQuery(client, "SELECT delivery_status FROM public.delivery WHERE id = $1;", [dbRecips.rows[0].delivery_id], "Query recipient 1 delivery after delivered");
    assert(del1Delivered.rows[0].delivery_status === "delivered", `TEST 7: public.delivery updated to 'delivered'`);

    // E. Terminal State Guard: delivered cannot transition to failed
    const terminalRes = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient1Id, "delivery-status"], {
      deliveryStatus: "failed",
      notes: "Attempted modification of completed delivery",
    }, partnerToken);
    assert(terminalRes.status === 422, `TEST 7: Altering terminal delivered state rejected with 422 (${terminalRes.body.error})`);

    // F. Idempotency: repeating same terminal status returns 200 with idempotent: true
    const repeatRes = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient1Id, "delivery-status"], {
      deliveryStatus: "delivered",
    }, partnerToken);
    assert(repeatRes.status === 200, `TEST 7: Repeating status 'delivered' returned 200 OK`);
    assert(repeatRes.body.idempotent === true, `TEST 7: Repeating status returns idempotent: true`);
    markProgress("Test 7 completed successfully.");

    // ── 10. TEST 8: PARTNER AUTHORIZATION SCOPING ────────────────────────────
    markProgress("Executing Test 8: Partner Authorization Scoping...");
    const accessDeniedRes = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient1Id, "delivery-status"], {
      deliveryStatus: "failed",
    }, otherPartnerToken);
    assert(accessDeniedRes.status === 403, `TEST 8: Cross-partner modification rejected with 403 (${accessDeniedRes.body.error})`);

    const custFulfillRes = await apiRequest("POST", ["admin", "corporate-gifting", "recipients", recipient1Id, "delivery-status"], {
      deliveryStatus: "failed",
    }, customerToken);
    assert(custFulfillRes.status === 403, `TEST 8: Customer attempting to alter fulfillment status rejected with 403 (${custFulfillRes.body.error})`);
    markProgress("Test 8 completed successfully.");

    // ── 11. TEST 9: ACCOUNTING CONTROLS VERIFICATION ─────────────────────────
    markProgress("Executing Test 9: Accounting Invariants Verification...");
    const batchInvoices = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.invoice WHERE customer_id = $1;", [testCustomerId], "Verify exactly 1 batch master invoice");
    assert(batchInvoices.rows[0].cnt === 1, `TEST 9: Exactly 1 master corporate invoice created for batch: ${batchInvoices.rows[0].cnt}`);

    const testDeliveriesCount = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.delivery WHERE recipient_name IN ('Anita Desai', 'Karan Johar');", [], "Verify child deliveries count");
    assert(testDeliveriesCount.rows[0].cnt === 2, `TEST 9: Exactly 2 child deliveries created (1 per recipient): ${testDeliveriesCount.rows[0].cnt}`);
    markProgress("Test 9 completed successfully.");

    // ── 12. CLEAN TEARDOWN ───────────────────────────────────────────────────
    markProgress("Teardown: cleaning up test fixtures safely...");

    await trackedQuery(client, "ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;", [], "Teardown disable event trigger");
    await trackedQuery(client, "DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT');", [], "Teardown delete assignment events");
    await trackedQuery(client, "ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;", [], "Teardown re-enable event trigger");

    await trackedQuery(client, "DELETE FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT';", [], "Teardown delete assignments");
    await trackedQuery(client, "DELETE FROM public.delivery WHERE recipient_name IN ('Anita Desai', 'Karan Johar');", [], "Teardown delete deliveries");
    await trackedQuery(client, "DELETE FROM public.corporate_gifting_recipient WHERE batch_id = $1;", [createdBatchId], "Teardown delete recipients");
    await trackedQuery(client, "DELETE FROM public.corporate_gifting_batch WHERE id = $1;", [createdBatchId], "Teardown delete batch");

    await trackedQuery(client, "DELETE FROM public.invoice WHERE customer_id = $1 OR order_id IN (SELECT id FROM public.order WHERE customer_id = $1);", [testCustomerId], "Teardown delete invoice");
    await trackedQuery(client, "DELETE FROM public.order_item WHERE order_id IN (SELECT id FROM public.order WHERE customer_id = $1);", [testCustomerId], "Teardown delete order items");
    await trackedQuery(client, "DELETE FROM public.order WHERE customer_id = $1;", [testCustomerId], "Teardown delete order");

    await trackedQuery(client, `
      DELETE FROM public.accounting_journal_line
      WHERE customer_id = $1
         OR journal_entry_id IN (
           SELECT id FROM public.accounting_journal_entry
           WHERE voucher_id IN (
             SELECT id FROM public.accounting_voucher
             WHERE reference_event = 'CORPORATE_INVOICE_POSTED'
                OR reference_id LIKE 'inv_corp_%'
           )
         );
    `, [testCustomerId], "Teardown delete journal lines");
    await trackedQuery(client, `
      DELETE FROM public.accounting_journal_entry
      WHERE voucher_id IN (
        SELECT id FROM public.accounting_voucher
        WHERE reference_event = 'CORPORATE_INVOICE_POSTED'
           OR reference_id LIKE 'inv_corp_%'
      );
    `, [], "Teardown delete journal entries");
    await trackedQuery(client, `
      DELETE FROM public.accounting_voucher
      WHERE reference_event = 'CORPORATE_INVOICE_POSTED'
         OR reference_id LIKE 'inv_corp_%';
    `, [], "Teardown delete vouchers");

    await trackedQuery(client, "DELETE FROM public.delivery_partner_coverage WHERE id = $1;", [testPartnerCovId], "Teardown delete partner coverage");
    await trackedQuery(client, "DELETE FROM public.delivery_partner_profile WHERE id = $1;", [testPartnerProfId], "Teardown delete partner profile");
    await trackedQuery(client, "DELETE FROM public.delivery_partner WHERE id IN ($1, $2);", [testPartnerId, testPartnerOtherId], "Teardown delete partners");
    await trackedQuery(client, "DELETE FROM public.delivery_zone WHERE id = $1;", [testZoneId], "Teardown delete zone");
    await trackedQuery(client, "DELETE FROM public.branch WHERE id = $1;", [testStoreId], "Teardown delete branch");
    await trackedQuery(client, "DELETE FROM public.corporate_account WHERE id = $1;", [testAccountId], "Teardown delete account");
    await trackedQuery(client, "DELETE FROM public.customer WHERE id = $1;", [testCustomerId], "Teardown delete customer");

    markProgress("Fixtures cleaned up.");

    // ── 13. POSTFLIGHT MASTER INVARIANT CHECK ────────────────────────────────
    markProgress("Postflight baseline verification...");
    const postCoA = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.accounting_account;", [], "Postflight count CoA");
    const postV = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.accounting_voucher;", [], "Postflight count vouchers");
    const postJE = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.accounting_journal_entry;", [], "Postflight count journal entries");
    const postJL = await trackedQuery(client, "SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;", [], "Postflight count journal lines");
    const postDP = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;", [], "Postflight count partners");
    const postBranch = await trackedQuery(client, "SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;", [], "Postflight count branches");
    const postAssignments = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;", [], "Postflight count assignments");
    const postEvents = await trackedQuery(client, "SELECT count(*)::int as cnt FROM public.corporate_assignment_event;", [], "Postflight count events");

    assert(postCoA.rows[0].cnt === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].cnt}`);
    assert(postV.rows[0].cnt === 6, `Postflight Vouchers = 6: ${postV.rows[0].cnt}`);
    assert(postJE.rows[0].cnt === 4, `Postflight Journal Entries = 4: ${postJE.rows[0].cnt}`);
    assert(postJL.rows[0].cnt === 10, `Postflight Journal Lines = 10: ${postJL.rows[0].cnt}`);
    assert(
      Number(postJL.rows[0].dr) === 3380.0 && Number(postJL.rows[0].cr) === 3380.0,
      `Postflight TB strictly balanced Dr ₹3,380.00 = Cr ₹3,380.00`
    );
    assert(postDP.rows[0].cnt === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].cnt}`);
    assert(postBranch.rows[0].active === 48, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);
    assert(postAssignments.rows[0].cnt === 0, `corporate_delivery_assignment has 0 residual rows: ${postAssignments.rows[0].cnt}`);
    assert(postEvents.rows[0].cnt === 0, `corporate_assignment_event has 0 residual rows: ${postEvents.rows[0].cnt}`);

    const postTrigger = await trackedQuery(client, `
      SELECT tgenabled FROM pg_trigger
      WHERE tgname = 'trg_corporate_assignment_event_immutability';
    `, [], "Postflight verify trigger");
    assert(postTrigger.rows[0].tgenabled === "O", `Postflight trigger is strictly ENABLED ('O')`);

    markProgress("Postflight baseline verified 100%.");

    console.log("\n==================================================================");
    console.log(`PHASE C7.13 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================================");

    await client.end();
    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end().catch(() => {});
    }

    clearTimeout(overallTimer);
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ Error during C7.13 test suite (last op: "${lastProgressOperation}"):`, err);
    try {
      await client.end();
    } catch {}
    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end().catch(() => {});
    }
    clearTimeout(overallTimer);
    process.exit(1);
  }
}

runC7_13_Suite().catch(async (err) => {
  console.error("Test Suite Fatal Unhandled Exception:", err);
  if (globalThis.__cth_pg_pool__) {
    await globalThis.__cth_pg_pool__.end().catch(() => {});
  }
  clearTimeout(overallTimer);
  process.exit(1);
});
