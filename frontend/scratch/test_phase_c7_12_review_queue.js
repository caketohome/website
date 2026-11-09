/**
 * CakeToHome ERP — Phase C7.12 Test Suite: Super Admin Unresolved Location Review Queue
 * Validates Queue Retrieval, Filtering, Privacy Masking, Candidate Evaluation,
 * Manual Resolution (Coordinates Correction, Manual Override, Hold), RBAC, Idempotency, and Invariants.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const Module = require("module");

// Module Alias Resolution for @frontend/
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@frontend/")) {
    const sub = request.substring("@frontend/".length);
    const mapped = path.resolve(__dirname, "../src", sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Register TypeScript compilation hook
const ts = require("../node_modules/typescript");
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
  const envPath = path.join(__dirname, "../.env");
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

const { NextRequest } = require("next/server");
const { signAuthToken } = require("../src/lib/security/auth-session");
const { GET, POST } = require("../src/app/api/v1/[...path]/route");

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

async function apiRequest(method, pathParts, body = null, token = null, queryParams = "", customHeaders = {}) {
  const url = `http://localhost:3000/api/v1/${pathParts.join("/")}${queryParams ? `?${queryParams}` : ""}`;
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
}

async function runC7_12_Suite() {
  console.log("==================================================================");
  console.log("CAKETOHOME ERP — PHASE C7.12: SUPER ADMIN UNRESOLVED REVIEW SUITE");
  console.log("==================================================================\n");

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const runId = Date.now();
  const testStoreId = `br_test_12_${runId}`;
  const testZoneId = `zone_test_12_${runId}`;
  const testPartnerId = `dlp_test_12_${runId}`;
  const testPartnerProfId = `prof_test_12_${runId}`;
  const testPartnerCovId = `cov_test_12_${runId}`;
  const testAccountId = `acc_test_12_${runId}`;

  const idMissing = `cda_test_12_missing_${runId}`;
  const idInvalid = `cda_test_12_invalid_${runId}`;
  const idExclusion = `cda_test_12_exclusion_${runId}`;
  const idOutside = `cda_test_12_outside_${runId}`;

  try {
    // Safety cleanup of any prior aborted test run artifacts
    await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id LIKE 'cda_test_12_%';");
    await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_delivery_assignment WHERE id LIKE 'cda_test_12_%';");
    await client.query("DELETE FROM public.delivery_partner_coverage WHERE id LIKE 'cov_test_12_%';");
    await client.query("DELETE FROM public.delivery_partner_profile WHERE id LIKE 'prof_test_12_%';");
    await client.query("DELETE FROM public.delivery_partner WHERE id LIKE 'dlp_test_12_%';");
    await client.query("DELETE FROM public.delivery_zone WHERE id LIKE 'zone_test_12_%';");
    await client.query("DELETE FROM public.branch WHERE id LIKE 'br_test_12_%';");
    await client.query("DELETE FROM public.corporate_account WHERE id LIKE 'acc_test_12_%';");

    // ── 0. PREFLIGHT INVARIANT CHECK ──────────────────────────────────────────
    console.log("[PREFLIGHT] Master Accounting & Master-Data Baseline Verification");
    const preCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const preV = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
    const preJE = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
    const preJL = await client.query(
      "SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;"
    );
    const preDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const preBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");

    assert(preCoA.rows[0].cnt === 100, `Preflight CoA is 100 accounts: ${preCoA.rows[0].cnt}`);
    assert(preV.rows[0].cnt === 6, `Preflight Vouchers = 6: ${preV.rows[0].cnt}`);
    assert(preJE.rows[0].cnt === 4, `Preflight Journal Entries = 4: ${preJE.rows[0].cnt}`);
    assert(preJL.rows[0].dr === "3380.00" && preJL.rows[0].cr === "3380.00", "Preflight TB strictly balanced Dr/Cr ₹3,380.00");
    assert(preDP.rows[0].cnt === 30, `Preflight Delivery Partners preserved: ${preDP.rows[0].cnt}`);
    assert(preBranch.rows[0].active === 48, `Preflight Active Branches preserved: ${preBranch.rows[0].active}`);

    // ── 1. SEED ISOLATED TEST FIXTURES ────────────────────────────────────────
    console.log("\n[Setup] Seeding isolated test stores, zones, partners, and unresolved assignments...");

    const existingShop = await client.query("SELECT shop_id FROM public.branch WHERE shop_id IS NOT NULL LIMIT 1;");
    const validShopId = existingShop.rows[0]?.shop_id || null;

    // Create isolated test branch
    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, phone, email, address, latitude, longitude, shop_id, is_corporate_routing_eligible)
      VALUES ($1, 'C712 Review Test Hub', 'HUB-C712', true, '9988112233', 'hub-c712@test.com', 'MG Road Central', 12.9716, 77.5946, $2, true);
    `, [testStoreId, validShopId]);

    // Create zone polygon covering Central Bangalore (12.960 to 12.990, 77.580 to 77.620)
    const zonePolygon = [
      [12.9600, 77.5800],
      [12.9900, 77.5800],
      [12.9900, 77.6200],
      [12.9600, 77.6200],
      [12.9600, 77.5800],
    ];

    // Exclusion polygon covering small enclave (12.9800 to 12.9850, 77.6000 to 77.6050)
    const exclusionPolygon = [
      [
        [12.9800, 77.6000],
        [12.9850, 77.6000],
        [12.9850, 77.6050],
        [12.9800, 77.6050],
        [12.9800, 77.6000],
      ],
    ];

    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'C712 Central Zone', '560001', 0, true, $3, $4, 10.0, 12.9716, 77.5946, 50);
    `, [testZoneId, testStoreId, JSON.stringify(zonePolygon), JSON.stringify(exclusionPolygon)]);

    // Create test delivery partner
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, phone, email)
      VALUES ($1, 'Rohan', 'C712Driver', '+919988776655', 'rohan.c712@test.com');
    `, [testPartnerId]);

    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.9);
    `, [testPartnerProfId, testPartnerId, testStoreId]);

    await client.query(`
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, polygon_coordinates, radius_km, center_latitude, center_longitude)
      VALUES ($1, $2, $3, 'RADIUS', 30, true, NULL, 12.0, 12.9716, 77.5946);
    `, [testPartnerCovId, testPartnerId, testStoreId]);

    // Create corporate account
    const existingCust = await client.query("SELECT id FROM public.customer LIMIT 1;");
    const testCustomerId = existingCust.rows[0].id;
    await client.query(`
      INSERT INTO public.corporate_account (id, customer_id, legal_name, legal_name_key, trade_name, status)
      VALUES ($1, $2, 'Acme Infotech Ltd', 'acmeinfotechltd', 'Acme Info', 'APPROVED')
      ON CONFLICT (id) DO NOTHING;
    `, [testAccountId, testCustomerId]);

    // Seed 4 unresolved assignments
    // Item 1: Missing coordinates (COORDINATES_MISSING)
    await client.query(`
      INSERT INTO public.corporate_delivery_assignment (
        id, entity_type, entity_id, account_id, recipient_name, recipient_phone, delivery_address,
        delivery_city, delivery_pincode, latitude, longitude, status, reason_code, diagnostics_message
      ) VALUES (
        $1, 'GIFTING_RECIPIENT', 'rec_c712_01', $2, 'Priya Sharma', '+919876543210',
        'Flat 402, Sunshine Heights, MG Road', 'Bengaluru', '560001', NULL, NULL,
        'UNASSIGNED', 'COORDINATES_MISSING', 'Delivery coordinates missing.'
      );
    `, [idMissing, testAccountId]);

    // Item 2: Invalid coordinates (COORDINATES_INVALID)
    await client.query(`
      INSERT INTO public.corporate_delivery_assignment (
        id, entity_type, entity_id, account_id, recipient_name, recipient_phone, delivery_address,
        delivery_city, delivery_pincode, latitude, longitude, status, reason_code, diagnostics_message, evaluation_metadata
      ) VALUES (
        $1, 'ROSTER_EMPLOYEE', 'emp_c712_02', $2, 'Anand Verma', '+919123456780',
        'Tower B, Tech Park, Outer Ring Rd', 'Bengaluru', '560103', NULL, NULL,
        'UNASSIGNED', 'COORDINATES_INVALID', 'Coordinates outside permissible bounds.',
        '{"invalid_latitude": 999.0, "invalid_longitude": 999.0}'::jsonb
      );
    `, [idInvalid, testAccountId]);

    // Item 3: Inside exclusion polygon (INSIDE_EXCLUSION) ~ (12.9820, 77.6020)
    await client.query(`
      INSERT INTO public.corporate_delivery_assignment (
        id, entity_type, entity_id, account_id, recipient_name, recipient_phone, delivery_address,
        delivery_city, delivery_pincode, latitude, longitude, status, reason_code, diagnostics_message
      ) VALUES (
        $1, 'GIFTING_RECIPIENT', 'rec_c712_03', $2, 'Deepak Menon', '+919845011223',
        'Enclave Sector 3, Cubbon Park Road', 'Bengaluru', '560001', 12.9820, 77.6020,
        'UNASSIGNED', 'INSIDE_EXCLUSION', 'Falls inside active exclusion polygon.'
      );
    `, [idExclusion, testAccountId]);

    // Item 4: Outside coverage (OUTSIDE_COVERAGE) ~ (13.5000, 78.2000)
    await client.query(`
      INSERT INTO public.corporate_delivery_assignment (
        id, entity_type, entity_id, account_id, recipient_name, recipient_phone, delivery_address,
        delivery_city, delivery_pincode, latitude, longitude, status, reason_code, diagnostics_message
      ) VALUES (
        $1, 'DIRECT_ORDER', 'ord_c712_04', NULL, 'Kavita Rao', '+919777123456',
        'Village Post, Rural District', 'Kolar', '563101', 13.5000, 78.2000,
        'UNASSIGNED', 'OUTSIDE_COVERAGE', 'Outside all store delivery coverage.'
      );
    `, [idOutside]);

    console.log("✓ Fixtures seeded successfully.");

    // ── 2. CREATE TOKENS ──────────────────────────────────────────────────────
    const superAdminToken = signAuthToken({
      userId: "admin_01",
      role: "SUPER_ADMIN",
      name: "Super Admin",
    });

    const routerStaffToken = signAuthToken({
      userId: "staff_router_01",
      role: "STAFF",
      name: "Corporate Logistics Officer",
      permissions: ["CORPORATE_ROUTING.VIEW", "CORPORATE_ROUTING.MANAGE"],
    });

    const viewerStaffToken = signAuthToken({
      userId: "staff_viewer_01",
      role: "STAFF",
      name: "Auditor",
      permissions: ["CORPORATE_ROUTING.VIEW"],
    });

    const customerToken = signAuthToken({
      userId: "cust_99",
      role: "CUSTOMER",
      name: "Retail Customer",
      permissions: [],
    });

    // ── 3. TEST SUITES ────────────────────────────────────────────────────────
    console.log("\n[Test Suites] Executing Phase C7.12 Scenarios...\n");

    // TEST 1: Unauthenticated request rejected with 401 UNAUTHORIZED
    {
      const res = await apiRequest("GET", ["admin", "corporate-routing", "unresolved"]);
      assert(res.status === 401, "TEST 1: Unauthenticated request to /unresolved rejected with 401 UNAUTHORIZED");
    }

    // TEST 2: Customer role rejected with 403 Forbidden
    {
      const res = await apiRequest("GET", ["admin", "corporate-routing", "unresolved"], null, customerToken);
      assert(res.status === 403, "TEST 2: Customer role rejected with 403 Forbidden");
    }

    // TEST 3: Spoofed headers defeated without cryptographic session
    {
      const res = await apiRequest("GET", ["admin", "corporate-routing", "unresolved"], null, null, "", {
        "x-user-role": "SUPER_ADMIN",
        "x-user-id": "admin_01",
      });
      assert(res.status === 401, "TEST 3: Anti-Spoofing: Client header spoofing defeated without server token (401)");
    }

    // TEST 4: Viewer lacking CORPORATE_ROUTING.MANAGE rejected on resolution action (403)
    {
      const res = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idMissing, "resolve"],
        { action: "CORRECT_COORDINATES", latitude: 12.9716, longitude: 77.5946 },
        viewerStaffToken
      );
      assert(res.status === 403, "TEST 4: Viewer lacking CORPORATE_ROUTING.MANAGE rejected with 403 on POST /resolve");
    }

    // TEST 5: GET /unresolved returns paginated list with metrics and masked phone numbers
    {
      const res = await apiRequest("GET", ["admin", "corporate-routing", "unresolved"], null, superAdminToken);
      assert(res.status === 200, "TEST 5: GET /unresolved succeeded with 200 OK");
      assert(Array.isArray(res.body.data), "TEST 5: Data is an array");
      assert(res.body.meta.total >= 4, `TEST 5: Total unresolved count >= 4 (actual: ${res.body.meta.total})`);
      assert(res.body.meta.reason_code_counts !== undefined, "TEST 5: Reason code metrics returned");

      const missingItem = res.body.data.find((i) => i.id === idMissing);
      assert(missingItem !== undefined, "TEST 5: Found missing coordinates item");
      assert(missingItem.masked_phone && missingItem.masked_phone.includes("****"), "TEST 5: Recipient phone number is masked for privacy");
      assert(missingItem.account_name === "Acme Infotech Ltd", "TEST 5: Corporate account name joined properly");
      assert(missingItem.reason_description.includes("lacks GPS"), "TEST 5: Human-readable reason description present");
    }

    // TEST 6: Filter unresolved queue by reason_code
    {
      const res = await apiRequest(
        "GET",
        ["admin", "corporate-routing", "unresolved"],
        null,
        superAdminToken,
        "reason_code=INSIDE_EXCLUSION"
      );
      assert(res.status === 200, "TEST 6: Filter by reason_code succeeded with 200 OK");
      const allExclusion = res.body.data.every((i) => i.reason_code === "INSIDE_EXCLUSION");
      assert(allExclusion, "TEST 6: Filter returned only INSIDE_EXCLUSION items");
      assert(res.body.data.some((i) => i.id === idExclusion), "TEST 6: Seeded exclusion item present in filtered view");
    }

    // TEST 7: Search unresolved queue by query term
    {
      const res = await apiRequest(
        "GET",
        ["admin", "corporate-routing", "unresolved"],
        null,
        superAdminToken,
        "search=Sharma"
      );
      assert(res.status === 200, "TEST 7: Search query succeeded with 200 OK");
      assert(res.body.data.some((i) => i.recipient_name === "Priya Sharma"), "TEST 7: Search matched recipient name 'Priya Sharma'");
    }

    // TEST 8: GET /unresolved/:id/candidates for missing coordinates fails closed
    {
      const res = await apiRequest(
        "GET",
        ["admin", "corporate-routing", "unresolved", idMissing, "candidates"],
        null,
        superAdminToken
      );
      assert(res.status === 200, "TEST 8: Candidate query succeeded with 200 OK");
      assert(res.body.data.can_match === false, "TEST 8: can_match is false for missing coordinates");
      assert(res.body.data.diagnostics_message.includes("lacks valid GPS coordinates"), "TEST 8: Diagnostic message informs Super Admin coordinates must be provided");
    }

    // TEST 9: GET /unresolved/:id/candidates for point inside exclusion zone
    {
      const res = await apiRequest(
        "GET",
        ["admin", "corporate-routing", "unresolved", idExclusion, "candidates"],
        null,
        superAdminToken
      );
      assert(res.status === 200, "TEST 9: Candidate query for exclusion point succeeded with 200 OK");
      assert(res.body.data.can_match === false, "TEST 9: can_match is false for point inside exclusion");
      const testStoreReview = res.body.data.candidate_stores.find((s) => s.store_id === testStoreId);
      assert(testStoreReview && testStoreReview.is_inside_exclusion === true, "TEST 9: Candidate store review correctly marks is_inside_exclusion: true");
    }

    // TEST 10: Action CORRECT_COORDINATES with invalid coordinates rejected (400)
    {
      const res = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idMissing, "resolve"],
        { action: "CORRECT_COORDINATES", latitude: 999.0, longitude: 999.0 },
        routerStaffToken
      );
      assert(res.status === 400, "TEST 10: Out-of-bounds coordinates rejected with 400 Bad Request");
    }

    // TEST 11: Action CORRECT_COORDINATES with valid coordinates re-evaluates and persists ASSIGNED
    {
      const res = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idMissing, "resolve"],
        {
          action: "CORRECT_COORDINATES",
          latitude: 12.9716,
          longitude: 77.5946,
          override_reason: "Verified correct gate GPS coordinates with company reception.",
        },
        routerStaffToken
      );
      assert(res.status === 200, "TEST 11: Action CORRECT_COORDINATES succeeded with 200 OK");
      assert(res.body.data.status === "ASSIGNED", "TEST 11: Status transitioned from UNASSIGNED to ASSIGNED");
      assert(res.body.data.assigned_store_id === testStoreId, "TEST 11: Assigned to candidate store Hub C712");
      assert(res.body.data.assigned_partner_id === testPartnerId, "TEST 11: Assigned to candidate partner Rohan");
      assert(res.body.data.latitude === 12.9716, "TEST 11: Corrected latitude persisted");

      const eventCheck = await client.query(
        "SELECT * FROM public.corporate_assignment_event WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1;",
        [idMissing]
      );
      assert(eventCheck.rows.length === 1, "TEST 11: Exactly 1 audit event appended for coordinate resolution");
      assert(eventCheck.rows[0].event_type === "REASSIGNED", "TEST 11: Event type is REASSIGNED");
      assert(eventCheck.rows[0].actor_id === "staff_router_01", "TEST 11: Actor ID is from verified session token");
    }

    // TEST 12: Repeat identical CORRECT_COORDINATES is idempotent (zero churn, zero duplicate events)
    {
      const res = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idMissing, "resolve"],
        {
          action: "CORRECT_COORDINATES",
          latitude: 12.9716,
          longitude: 77.5946,
          override_reason: "Verified correct gate GPS coordinates with company reception.",
        },
        routerStaffToken
      );
      assert(res.status === 200, "TEST 12: Repeat request succeeded with 200 OK");
      assert(res.body.idempotent === true, "TEST 12: Idempotency flag is true");

      const eventsCount = await client.query(
        "SELECT count(*)::int as cnt FROM public.corporate_assignment_event WHERE assignment_id = $1;",
        [idMissing]
      );
      assert(eventsCount.rows[0].cnt === 1, "TEST 12: Idempotent repeat emitted zero duplicate audit events (count = 1)");
    }

    // TEST 13: Action MANUAL_ASSIGN requires valid store_id and minimum 5 char reason
    {
      const resNoReason = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idOutside, "resolve"],
        { action: "MANUAL_ASSIGN", store_id: testStoreId, override_reason: "bad" },
        superAdminToken
      );
      assert(resNoReason.status === 400, "TEST 13: Manual assignment with short override reason rejected (400)");

      const resNoStore = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idOutside, "resolve"],
        { action: "MANUAL_ASSIGN", store_id: "", override_reason: "Legitimate operational reason." },
        superAdminToken
      );
      assert(resNoStore.status === 400, "TEST 13: Manual assignment without store_id rejected (400)");
    }

    // TEST 14: Action MANUAL_ASSIGN persists MANUAL_OVERRIDE with audit trail
    {
      const res = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idOutside, "resolve"],
        {
          action: "MANUAL_ASSIGN",
          store_id: testStoreId,
          partner_id: testPartnerId,
          override_reason: "Authorized long-distance corporate delivery exception by VP Logistics.",
        },
        superAdminToken
      );
      assert(res.status === 200, "TEST 14: Valid MANUAL_ASSIGN succeeded with 200 OK");
      assert(res.body.data.status === "MANUAL_OVERRIDE", "TEST 14: Status transitioned to MANUAL_OVERRIDE");
      assert(res.body.data.reason_code === "MANUAL_OVERRIDE", "TEST 14: Reason code set to MANUAL_OVERRIDE");
      assert(res.body.data.assigned_store_id === testStoreId, "TEST 14: Assigned to designated store");
      assert(res.body.data.assigned_partner_id === testPartnerId, "TEST 14: Assigned to designated partner");

      const eventCheck = await client.query(
        "SELECT * FROM public.corporate_assignment_event WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1;",
        [idOutside]
      );
      assert(eventCheck.rows.length === 1, "TEST 14: Exactly 1 audit event appended for manual override");
      assert(eventCheck.rows[0].event_type === "MANUALLY_OVERRIDDEN", "TEST 14: Event type is MANUALLY_OVERRIDDEN");
      assert(eventCheck.rows[0].actor_id === "admin_01", "TEST 14: Super Admin actor recorded");
    }

    // TEST 15: Action MARK_PENDING_REVIEW updates status to PENDING_REVIEW
    {
      const res = await apiRequest(
        "POST",
        ["admin", "corporate-routing", "unresolved", idInvalid, "resolve"],
        {
          action: "MARK_PENDING_REVIEW",
          override_reason: "Sent SMS to recipient requesting house landmark.",
        },
        routerStaffToken
      );
      assert(res.status === 200, "TEST 15: Action MARK_PENDING_REVIEW succeeded with 200 OK");
      assert(res.body.data.status === "PENDING_REVIEW", "TEST 15: Status transitioned to PENDING_REVIEW");

      const eventCheck = await client.query(
        "SELECT * FROM public.corporate_assignment_event WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1;",
        [idInvalid]
      );
      assert(eventCheck.rows.length === 1, "TEST 15: Event recorded for holding in review");
      assert(eventCheck.rows[0].event_type === "UNASSIGNED_TRIGGERED", "TEST 15: Event type is UNASSIGNED_TRIGGERED");
    }

    // TEST 16: Audit Event Immutability Trigger blocks UPDATE and DELETE
    {
      let updateBlocked = false;
      try {
        await client.query("UPDATE public.corporate_assignment_event SET reason = 'Tampered' WHERE assignment_id = $1;", [idMissing]);
      } catch (err) {
        if (err.code === "27000" || err.message.includes("append-only")) {
          updateBlocked = true;
        }
      }
      assert(updateBlocked, "TEST 16: Database trigger strictly blocks UPDATE on corporate_assignment_event (SQLSTATE 27000)");

      let deleteBlocked = false;
      try {
        await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id = $1;", [idMissing]);
      } catch (err) {
        if (err.code === "27000" || err.message.includes("append-only")) {
          deleteBlocked = true;
        }
      }
      assert(deleteBlocked, "TEST 16: Database trigger strictly blocks DELETE on corporate_assignment_event (SQLSTATE 27000)");
    }
  } catch (err) {
    console.error("TEST SUITE EXECUTION ERROR:", err);
    failed++;
  } finally {
    // ── 4. TEARDOWN & ISOLATED FIXTURE CLEANUP ──────────────────────────────
    console.log("\n[Teardown] Cleaning up test fixtures safely...");
    try {
      await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query(`
        DELETE FROM public.corporate_assignment_event 
        WHERE assignment_id IN ('${idMissing}', '${idInvalid}', '${idExclusion}', '${idOutside}')
           OR assignment_id LIKE 'cda_test_12_%';
      `);
      await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

      await client.query(`
        DELETE FROM public.corporate_delivery_assignment 
        WHERE id IN ('${idMissing}', '${idInvalid}', '${idExclusion}', '${idOutside}')
           OR id LIKE 'cda_test_12_%';
      `);

      await client.query(`DELETE FROM public.delivery_partner_coverage WHERE id = '${testPartnerCovId}' OR id LIKE 'cov_test_12_%';`);
      await client.query(`DELETE FROM public.delivery_partner_profile WHERE id = '${testPartnerProfId}' OR id LIKE 'prof_test_12_%';`);
      await client.query(`DELETE FROM public.delivery_partner WHERE id = '${testPartnerId}' OR id LIKE 'dlp_test_12_%';`);

      await client.query(`DELETE FROM public.delivery_zone WHERE id = '${testZoneId}' OR id LIKE 'zone_test_12_%';`);
      await client.query(`DELETE FROM public.branch WHERE id = '${testStoreId}' OR id LIKE 'br_test_12_%';`);
      await client.query(`DELETE FROM public.corporate_account WHERE id = '${testAccountId}' OR id LIKE 'acc_test_12_%';`);

      console.log("✓ Fixtures cleaned up.");
    } catch (cleanErr) {
      console.error("Teardown error:", cleanErr.message);
    }

    // ── 5. POSTFLIGHT INVARIANT VERIFICATION ─────────────────────────────────
    console.log("\n[POSTFLIGHT] Master Accounting & Master-Data Baseline Verification");

    const postCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const postV = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
    const postJE = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
    const postJL = await client.query(
      "SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;"
    );
    const postDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const postBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
    const residualAssignments = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
    const residualEvents = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

    assert(postCoA.rows[0].cnt === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].cnt}`);
    assert(postV.rows[0].cnt === 6, `Postflight Vouchers = 6: ${postV.rows[0].cnt}`);
    assert(postJE.rows[0].cnt === 4, `Postflight Journal Entries = 4: ${postJE.rows[0].cnt}`);
    assert(postJL.rows[0].dr === "3380.00" && postJL.rows[0].cr === "3380.00", "Postflight TB strictly balanced Dr ₹3,380.00 = Cr ₹3,380.00");
    assert(postDP.rows[0].cnt === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].cnt}`);
    assert(postBranch.rows[0].active === 48, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);
    assert(residualAssignments.rows[0].cnt === 0, `corporate_delivery_assignment has 0 residual rows: ${residualAssignments.rows[0].cnt}`);
    assert(residualEvents.rows[0].cnt === 0, `corporate_assignment_event has 0 residual rows: ${residualEvents.rows[0].cnt}`);

    const trgStatus = await client.query("SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_corporate_assignment_event_immutability';");
    assert(trgStatus.rows[0]?.tgenabled === "O", "Postflight trigger is strictly ENABLED ('O')");

    await client.end();

    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end().catch(() => {});
    }

    console.log("\n==================================================================");
    console.log(`PHASE C7.12 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================================");

    process.exit(failed === 0 ? 0 : 1);
  }
}

runC7_12_Suite().catch(async (err) => {
  console.error("Test Suite Unhandled Exception:", err);
  if (globalThis.__cth_pg_pool__) {
    await globalThis.__cth_pg_pool__.end().catch(() => {});
  }
  process.exit(1);
});
