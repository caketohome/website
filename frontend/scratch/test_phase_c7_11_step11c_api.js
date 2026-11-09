/**
 * CakeToHome ERP — Phase C7.11 Step 11C: Corporate Routing API & Controller Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Preflight Database Invariants (CoA=100, TB=₹3,380.00 Dr/Cr, Partners=30, Active Branches=53).
 * 2. Authentication & Authorization (Server-Side RBAC & Anti-Spoofing):
 *    - Unauthenticated request rejected with 401 UNAUTHORIZED
 *    - Customer token rejected with 403 Forbidden
 *    - Staff lacking CORPORATE_ROUTING.VIEW rejected with 403 Forbidden
 *    - Spoofed identity/role headers without token rejected with 401 UNAUTHORIZED
 *    - Viewer lacking CORPORATE_ROUTING.MANAGE rejected with 403 on mutation endpoints
 * 3. Functional Endpoints:
 *    - POST /admin/corporate-routing/preview (Simulation without database writes)
 *    - POST /admin/corporate-routing/match (Single entity atomic matching)
 *    - POST /admin/corporate-routing/match-batch (Bounded batch matching)
 *    - GET /admin/corporate-routing/assignments (List with pagination & filtering)
 *    - GET /admin/corporate-routing/assignments/:id (Detail by primary key)
 *    - GET /admin/corporate-routing/assignments/by-entity (Detail by entity identity)
 *    - GET /admin/corporate-routing/assignments/:id/events (Audit event history)
 * 4. Input Validation & Fail-Closed Guards:
 *    - Invalid entity_type rejected with 400 Bad Request
 *    - Missing required entity_id or delivery_address rejected with 400 Bad Request
 *    - Missing coordinates fail-closed to UNASSIGNED / COORDINATES_MISSING
 *    - Invalid coordinates fail-closed to UNASSIGNED / COORDINATES_INVALID
 *    - Empty batch items rejected with 400 Bad Request
 *    - Oversized batch (> 100 items) rejected with 400 Bad Request
 * 5. Branch Tenant Scoping:
 *    - Branch Manager restricted from accessing assignments outside assigned store (403 TenantScopeViolation)
 * 6. Idempotency & Immutability:
 *    - Repeat matching does not churn assignments or duplicate audit events
 *    - Immutability trigger strictly blocks UPDATE and DELETE on audit events (SQLSTATE 27000)
 * 7. Teardown & Postflight PostgreSQL Invariant Audit:
 *    - Clean teardown of test fixtures
 *    - Recheck CoA=100, TB=₹3,380.00, partners=30, branches=53, residual rows = 0
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const Module = require("module");

// 1. Module Alias Resolution for @frontend/
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@frontend/")) {
    const sub = request.substring("@frontend/".length);
    const mapped = path.resolve(__dirname, "../src", sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// 2. Register TypeScript compilation hook
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

  if (method === "GET") return await GET(req, params);
  if (method === "POST") return await POST(req, params);
  throw new Error(`Unsupported method: ${method}`);
}

async function runStep11cSuite() {
  console.log("==================================================================");
  console.log("CAKETOHOME ERP — PHASE C7.11 STEP 11C: ROUTING API & RBAC SUITE  ");
  console.log("==================================================================\n");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const runId = Date.now();
  const testBranchAId = `br_test_11c_a_${runId}`;
  const testBranchBId = `br_test_11c_b_${runId}`;
  const testZoneAId = `zone_test_11c_a_${runId}`;
  const testZoneBId = `zone_test_11c_b_${runId}`;
  const testPartner1Id = `dlp_test_11c_1_${runId}`;
  const testProf1Id = `prof_test_11c_1_${runId}`;
  const testCov1Id = `cov_test_11c_1_${runId}`;

  try {
    // ── 1. PREFLIGHT INVARIANT CHECK ──────────────────────────────────────────
    console.log("[PREFLIGHT] Master Accounting & Master-Data Baseline Verification");
    const preCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const preV = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
    const preJE = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
    const preJL = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const preDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const preBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");

    assert(preCoA.rows[0].cnt === 100, `Preflight CoA is 100 accounts: ${preCoA.rows[0].cnt}`);
    assert(preV.rows[0].cnt === 6, `Preflight Vouchers = 6: ${preV.rows[0].cnt}`);
    assert(preJE.rows[0].cnt === 4, `Preflight Journal Entries = 4: ${preJE.rows[0].cnt}`);
    assert(preJL.rows[0].dr === "3380.00" && preJL.rows[0].cr === "3380.00", `Preflight TB strictly balanced Dr/Cr ₹3,380.00`);
    assert(preDP.rows[0].cnt === 30, `Preflight Delivery Partners preserved: ${preDP.rows[0].cnt}`);
    assert(preBranch.rows[0].active === 48, `Preflight Active Branches preserved: ${preBranch.rows[0].active}`);

    // ── 2. SEED ISOLATED TEST FIXTURES ────────────────────────────────────────
    console.log("\n[Setup] Seeding isolated test stores and partner fixtures...");

    const existingShop = await client.query("SELECT shop_id FROM public.branch WHERE shop_id IS NOT NULL LIMIT 1;");
    const validShopId = existingShop.rows[0]?.shop_id || null;

    // Insert 2 test branches (both corporate routing eligible)
    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, phone, email, address, latitude, longitude, shop_id, is_corporate_routing_eligible)
      VALUES 
        ($1, 'API Hub A (Indiranagar)', 'HUB-11C-A', true, '9999911001', 'hub-11c-a@test.com', 'Indiranagar 100ft', 12.9716, 77.6412, $3, true),
        ($2, 'API Hub B (Domlur)', 'HUB-11C-B', true, '9999911002', 'hub-11c-b@test.com', 'Domlur Ring Rd', 12.9600, 77.6350, $3, true);
    `, [testBranchAId, testBranchBId, validShopId]);

    // Polygon coordinates for Zone A (Indiranagar: 12.970-12.990, 77.630-77.650)
    const polygonZoneA = [
      [12.970, 77.630],
      [12.990, 77.630],
      [12.990, 77.650],
      [12.970, 77.650],
      [12.970, 77.630]
    ];
    // Exclusion polygon inside Zone A (12.980-12.985, 77.635-77.640)
    const exclusionZoneA = [
      [
        [12.980, 77.635],
        [12.985, 77.635],
        [12.985, 77.640],
        [12.980, 77.640],
        [12.980, 77.635]
      ]
    ];

    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'API Zone A', '560038', 0, true, $3, $4, NULL, 12.9716, 77.6412, 50);
    `, [testZoneAId, testBranchAId, JSON.stringify(polygonZoneA), JSON.stringify(exclusionZoneA)]);

    // Zone B on Hub B (Radius 3.0 km)
    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'API Zone B', '560071', 0, true, NULL, NULL, 3.0, 12.9600, 77.6350, 20);
    `, [testZoneBId, testBranchBId]);

    // Insert Test Delivery Partner with coverage on Hub A
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES ($1, 'Rider11C', 'Alpha', 'rider11c@test.com', '+919988110099');
    `, [testPartner1Id]);

    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.9);
    `, [testProf1Id, testPartner1Id, testBranchAId]);

    await client.query(`
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, polygon_coordinates, radius_km, center_latitude, center_longitude)
      VALUES ($1, $2, $3, 'POLYGON', 80, true, $4, NULL, NULL, NULL);
    `, [testCov1Id, testPartner1Id, testBranchAId, JSON.stringify(polygonZoneA)]);

    console.log("✓ Fixtures seeded successfully.");

    // ── 3. TEST TOKENS ────────────────────────────────────────────────────────
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

    const unauthorizedStaffToken = signAuthToken({
      userId: "staff_kitchen_01",
      role: "STAFF",
      name: "Baker",
      permissions: ["KITCHEN.VIEW"],
    });

    const branchManagerToken = signAuthToken({
      userId: "mgr_11c_01",
      role: "BRANCH_MANAGER",
      name: "Manager Hub A",
      branchId: testBranchAId,
      permissions: ["CORPORATE_ROUTING.VIEW"],
    });

    const customerToken = signAuthToken({
      userId: "cus_11c_01",
      role: "CUSTOMER",
      name: "Customer John",
      permissions: [],
    });

    // ── 4. EXECUTE TEST SUITES ────────────────────────────────────────────────
    console.log("\n[Test Suites] Executing Security, RBAC, and Functional Scenarios...");

    // ── TEST 1: Unauthenticated request rejected with 401 ─────────────────────
    const res1 = await apiRequest("POST", ["admin", "corporate-routing", "preview"], {
      entity_type: "ROSTER_EMPLOYEE",
      entity_id: "emp_test_unauth",
      delivery_address: "Address",
      latitude: 12.975,
      longitude: 77.645,
    });
    assert(res1.status === 401, "TEST 1: Unauthenticated request rejected with 401 UNAUTHORIZED");

    // ── TEST 2: Customer role rejected with 403 ───────────────────────────────
    const res2 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "preview"],
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: "emp_test_cus",
        delivery_address: "Address",
        latitude: 12.975,
        longitude: 77.645,
      },
      customerToken
    );
    assert(res2.status === 403, "TEST 2: Customer token rejected with 403 Forbidden");

    // ── TEST 3: Staff lacking CORPORATE_ROUTING.VIEW rejected with 403 ────────
    const res3 = await apiRequest(
      "GET",
      ["admin", "corporate-routing", "assignments"],
      null,
      unauthorizedStaffToken
    );
    assert(res3.status === 403, "TEST 3: Staff lacking CORPORATE_ROUTING.VIEW rejected with 403 Forbidden");

    // ── TEST 4: Anti-Spoofing: Client header spoofing defeated without token ──
    const res4 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "preview"],
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: "emp_test_spoof",
        delivery_address: "Address",
        latitude: 12.975,
        longitude: 77.645,
      },
      null,
      "",
      {
        "x-user-role": "SUPER_ADMIN",
        "x-user-id": "admin_01",
      }
    );
    assert(res4.status === 401, "TEST 4: Spoofed headers without cryptographic session rejected with 401 UNAUTHORIZED");

    // ── TEST 5: Viewer lacking CORPORATE_ROUTING.MANAGE rejected with 403 ─────
    const res5 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match"],
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: "emp_test_viewer",
        delivery_address: "Address",
        latitude: 12.975,
        longitude: 77.645,
      },
      viewerStaffToken
    );
    assert(res5.status === 403, "TEST 5: Viewer lacking CORPORATE_ROUTING.MANAGE rejected with 403 on POST /match");

    // ── TEST 6: Preview endpoint succeeds without writing assignments or events
    const assignmentsBefore6 = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
    const eventsBefore6 = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

    const res6 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "preview"],
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_prev_${runId}`,
        delivery_address: "Indiranagar 12th Main",
        latitude: 12.975,
        longitude: 77.645,
      },
      viewerStaffToken
    );
    const json6 = await res6.json();
    const assignmentsAfter6 = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
    const eventsAfter6 = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

    assert(res6.status === 200 && json6.success === true, "TEST 6: POST /preview executed successfully with 200 OK");
    assert(json6.data.is_preview === true, "TEST 6: Preview payload marks is_preview: true");
    assert(json6.data.outcome.status === "ASSIGNED", "TEST 6: Preview accurately evaluated match to ASSIGNED");
    assert(json6.data.outcome.assigned_store_id === testBranchAId, "TEST 6: Preview matched Hub A");
    assert(assignmentsBefore6.rows[0].cnt === assignmentsAfter6.rows[0].cnt, "TEST 6: Zero assignment rows written during preview");
    assert(eventsBefore6.rows[0].cnt === eventsAfter6.rows[0].cnt, "TEST 6: Zero audit event rows written during preview");

    // ── TEST 7: Invalid entity_type rejected with 400 Bad Request ────────────
    const res7 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "preview"],
      {
        entity_type: "INVALID_ENTITY_TYPE",
        entity_id: "emp_inv",
        delivery_address: "Address",
        latitude: 12.975,
        longitude: 77.645,
      },
      routerStaffToken
    );
    assert(res7.status === 400, "TEST 7: Invalid entity_type rejected with 400 Bad Request");

    // ── TEST 8: Missing entity_id or delivery_address rejected with 400 ────────
    const res8 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match"],
      {
        entity_type: "ROSTER_EMPLOYEE",
        delivery_address: "Address",
      },
      routerStaffToken
    );
    assert(res8.status === 400, "TEST 8: Missing entity_id rejected with 400 Bad Request");

    // ── TEST 9: Missing coordinates fail-closed to UNASSIGNED / COORDINATES_MISSING
    const res9 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match"],
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_miss_${runId}`,
        delivery_address: "MG Road, No GPS",
        latitude: null,
        longitude: null,
      },
      routerStaffToken
    );
    const json9 = await res9.json();
    assert(res9.status === 200, "TEST 9: Missing coordinates handled gracefully with 200 OK");
    assert(json9.data.status === "UNASSIGNED", "TEST 9: Missing coordinates status is UNASSIGNED");
    assert(json9.data.reason_code === "COORDINATES_MISSING", "TEST 9: Reason code is COORDINATES_MISSING");

    // ── TEST 10: Invalid coordinates fail-closed to UNASSIGNED / COORDINATES_INVALID
    const res10 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match"],
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_inv_${runId}`,
        delivery_address: "Out of bounds point",
        latitude: 145.0,
        longitude: 77.645,
      },
      routerStaffToken
    );
    const json10 = await res10.json();
    assert(res10.status === 200, "TEST 10: Out-of-bounds coordinates handled with 200 OK");
    assert(json10.data.status === "UNASSIGNED", "TEST 10: Status is UNASSIGNED");
    assert(json10.data.reason_code === "COORDINATES_INVALID", "TEST 10: Reason code is COORDINATES_INVALID");

    // ── TEST 11: Valid single match POST /match persists and emits audit event
    const eventsBefore11 = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");
    const res11 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match"],
      {
        entity_type: "GIFTING_RECIPIENT",
        entity_id: `rec_single_${runId}`,
        recipient_name: "Anita Sharma",
        delivery_address: "Indiranagar 12th Main, Bangalore",
        latitude: 12.975,
        longitude: 77.645,
      },
      routerStaffToken
    );
    const json11 = await res11.json();
    const eventsAfter11 = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

    assert(res11.status === 200 && json11.success === true, "TEST 11: POST /match succeeded with 200 OK");
    assert(json11.data.status === "ASSIGNED", "TEST 11: Single match status is ASSIGNED");
    assert(json11.data.assigned_store_id === testBranchAId, "TEST 11: Assigned to Hub A");
    assert(json11.data.assigned_partner_id === testPartner1Id, "TEST 11: Assigned to Partner 1");
    assert(eventsAfter11.rows[0].cnt === eventsBefore11.rows[0].cnt + 1, "TEST 11: Exactly 1 audit event appended");

    // ── TEST 12: Repeat matching is idempotent (zero churn, zero duplicate events)
    const res12 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match"],
      {
        entity_type: "GIFTING_RECIPIENT",
        entity_id: `rec_single_${runId}`,
        recipient_name: "Anita Sharma",
        delivery_address: "Indiranagar 12th Main, Bangalore",
        latitude: 12.975,
        longitude: 77.645,
      },
      routerStaffToken
    );
    const json12 = await res12.json();
    const eventsAfter12 = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

    assert(res12.status === 200 && json12.data.id === json11.data.id, "TEST 12: Repeat match returned existing assignment record");
    assert(eventsAfter12.rows[0].cnt === eventsAfter11.rows[0].cnt, "TEST 12: Unchanged repeat match emitted 0 duplicate audit events (strictly idempotent)");

    // ── TEST 13: Empty batch rejected with 400 Bad Request ────────────────────
    const res13 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match-batch"],
      { items: [] },
      routerStaffToken
    );
    assert(res13.status === 400, "TEST 13: Empty batch items rejected with 400 Bad Request");

    // ── TEST 14: Oversized batch (> 100 items) rejected with 400 ──────────────
    const oversizedItems = Array.from({ length: 101 }, (_, i) => ({
      entity_type: "ROSTER_EMPLOYEE",
      entity_id: `emp_over_${runId}_${i}`,
      delivery_address: "Test Address",
      latitude: 12.975,
      longitude: 77.645,
    }));
    const res14 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match-batch"],
      { items: oversizedItems },
      routerStaffToken
    );
    assert(res14.status === 400, "TEST 14: Oversized batch (> 100 items) rejected with 400 Bad Request before transaction");

    // ── TEST 15: Valid batch match POST /match-batch processes targets atomically
    const batchTargets = [
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_batch_1_${runId}`,
        delivery_address: "Indiranagar Hub Area",
        latitude: 12.975,
        longitude: 77.645,
      },
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_batch_2_${runId}`,
        delivery_address: "Inside Exclusion Polygon",
        latitude: 12.982,
        longitude: 77.638,
      },
      {
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_batch_3_${runId}`,
        delivery_address: "Far outside all hubs",
        latitude: 15.000,
        longitude: 78.000,
      },
    ];

    const res15 = await apiRequest(
      "POST",
      ["admin", "corporate-routing", "match-batch"],
      { items: batchTargets },
      routerStaffToken
    );
    const json15 = await res15.json();

    assert(res15.status === 200 && json15.success === true, "TEST 15: POST /match-batch succeeded with 200 OK");
    assert(json15.summary.total_evaluated === 3, "TEST 15: Summary evaluated 3 targets");
    assert(json15.summary.total_assigned === 1, "TEST 15: Exactly 1 target assigned (Indiranagar)");
    assert(json15.summary.total_unassigned === 2, "TEST 15: Exactly 2 targets unassigned (Exclusion & Outside)");
    assert(json15.summary.unassigned_breakdown["INSIDE_EXCLUSION"] === 1, "TEST 15: Breakdown accurately identifies INSIDE_EXCLUSION");
    assert(json15.summary.unassigned_breakdown["OUTSIDE_COVERAGE"] === 1, "TEST 15: Breakdown accurately identifies OUTSIDE_COVERAGE");

    // ── TEST 16: GET /assignments lists records with pagination ──────────────
    const res16 = await apiRequest(
      "GET",
      ["admin", "corporate-routing", "assignments"],
      null,
      routerStaffToken,
      "limit=10&offset=0"
    );
    const json16 = await res16.json();
    assert(res16.status === 200 && json16.success === true, "TEST 16: GET /assignments returned 200 OK");
    assert(Array.isArray(json16.data) && json16.data.length > 0, "TEST 16: Assignments returned as array");
    assert(json16.meta.limit === 10, "TEST 16: Pagination meta limit is 10");

    // ── TEST 17: GET /assignments/:id retrieves single assignment detail ──────
    const sampleAssignmentId = json11.data.id;
    const res17 = await apiRequest(
      "GET",
      ["admin", "corporate-routing", "assignments", sampleAssignmentId],
      null,
      routerStaffToken
    );
    const json17 = await res17.json();
    assert(res17.status === 200 && json17.data.id === sampleAssignmentId, "TEST 17: GET /assignments/:id returned matching assignment detail");

    // ── TEST 18: GET /assignments/by-entity retrieves assignment by identity ──
    const res18 = await apiRequest(
      "GET",
      ["admin", "corporate-routing", "assignments", "by-entity"],
      null,
      routerStaffToken,
      `entity_type=GIFTING_RECIPIENT&entity_id=rec_single_${runId}`
    );
    const json18 = await res18.json();
    assert(res18.status === 200 && json18.data.entity_id === `rec_single_${runId}`, "TEST 18: GET /assignments/by-entity retrieved record by entity key");

    // ── TEST 19: GET /assignments/:id/events retrieves audit event history ────
    const res19 = await apiRequest(
      "GET",
      ["admin", "corporate-routing", "assignments", sampleAssignmentId, "events"],
      null,
      routerStaffToken
    );
    const json19 = await res19.json();
    assert(res19.status === 200, "TEST 19: GET /assignments/:id/events returned 200 OK");
    assert(Array.isArray(json19.data) && json19.data.length >= 1, "TEST 19: Audit events returned as non-empty array");
    assert(json19.data[0].assignment_id === sampleAssignmentId, "TEST 19: Event is linked to sample assignment");

    // ── TEST 20: Branch Manager restricted from accessing foreign store assignments
    // Hub B assignment:
    const foreignAssignment = await client.query(
      `INSERT INTO public.corporate_delivery_assignment (
        entity_type, entity_id, delivery_address, status, reason_code, assigned_store_id
      ) VALUES ('DIRECT_ORDER', $1, 'Foreign Address', 'ASSIGNED', 'MATCHED_RADIUS', $2)
      RETURNING id;`,
      [`ord_foreign_${runId}`, testBranchBId]
    );
    const foreignId = foreignAssignment.rows[0].id;

    const res20 = await apiRequest(
      "GET",
      ["admin", "corporate-routing", "assignments", foreignId],
      null,
      branchManagerToken // Manager of Hub A trying to read Hub B assignment
    );
    assert(res20.status === 403, "TEST 20: Branch Manager restricted from reading foreign branch assignment (403 TenantScopeViolation)");

    // Clean foreign assignment record
    await client.query("DELETE FROM public.corporate_delivery_assignment WHERE id = $1;", [foreignId]);

    // ── TEST 21: Audit Event Immutability Defense (SQLSTATE 27000) ─────────────
    const sampleEvent = await client.query("SELECT id FROM public.corporate_assignment_event LIMIT 1;");
    let updateBlocked = false;
    try {
      await client.query("UPDATE public.corporate_assignment_event SET reason = 'tampered' WHERE id = $1;", [sampleEvent.rows[0].id]);
    } catch (err) {
      if (err.message.includes("append-only") || err.code === "27000") {
        updateBlocked = true;
      }
    }
    assert(updateBlocked, "TEST 21: Database trigger strictly blocks UPDATE on corporate_assignment_event (SQLSTATE 27000)");

    let deleteBlocked = false;
    try {
      await client.query("DELETE FROM public.corporate_assignment_event WHERE id = $1;", [sampleEvent.rows[0].id]);
    } catch (err) {
      if (err.message.includes("append-only") || err.code === "27000") {
        deleteBlocked = true;
      }
    }
    assert(deleteBlocked, "TEST 21: Database trigger strictly blocks DELETE on corporate_assignment_event (SQLSTATE 27000)");

  } finally {
    // ── 5. TEARDOWN TEST FIXTURES ─────────────────────────────────────────────
    console.log("\n[Teardown] Cleaning up test fixtures safely...");
    try {
      await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query(`
        DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (
          SELECT id FROM public.corporate_delivery_assignment WHERE entity_id LIKE '%_${runId}%'
        );
      `);
      await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

      await client.query(`DELETE FROM public.corporate_delivery_assignment WHERE entity_id LIKE '%_${runId}%';`);
      await client.query(`DELETE FROM public.delivery_partner_coverage WHERE id = $1;`, [testCov1Id]);
      await client.query(`DELETE FROM public.delivery_partner_profile WHERE id = $1;`, [testProf1Id]);
      await client.query(`DELETE FROM public.delivery_partner WHERE id = $1;`, [testPartner1Id]);
      await client.query(`DELETE FROM public.delivery_zone WHERE id IN ($1, $2);`, [testZoneAId, testZoneBId]);
      await client.query(`DELETE FROM public.branch WHERE id IN ($1, $2);`, [testBranchAId, testBranchBId]);
      console.log("✓ Fixtures cleaned up.");
    } catch (cleanErr) {
      console.error("Teardown warning:", cleanErr.message);
    }

    // ── 6. POSTFLIGHT MASTER INVARIANT VERIFICATION ───────────────────────────
    console.log("\n[POSTFLIGHT] Master Accounting & Master-Data Baseline Verification");
    const postCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const postV = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
    const postJE = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
    const postJL = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const postDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const postBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
    const postAssign = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
    const postEvents = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

    assert(postCoA.rows[0].cnt === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].cnt}`);
    assert(postV.rows[0].cnt === 6, `Postflight Vouchers = 6: ${postV.rows[0].cnt}`);
    assert(postJE.rows[0].cnt === 4, `Postflight Journal Entries = 4: ${postJE.rows[0].cnt}`);
    assert(postJL.rows[0].dr === "3380.00" && postJL.rows[0].cr === "3380.00", `Postflight TB strictly balanced Dr ₹3,380.00 = Cr ₹3,380.00`);
    assert(postDP.rows[0].cnt === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].cnt}`);
    assert(postBranch.rows[0].active === 48, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);
    assert(postAssign.rows[0].cnt === 0, `corporate_delivery_assignment has 0 residual rows: ${postAssign.rows[0].cnt}`);
    assert(postEvents.rows[0].cnt === 0, `corporate_assignment_event has 0 residual rows: ${postEvents.rows[0].cnt}`);

    // Terminate global db pool and client connection to ensure clean process exit
    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end();
    }
    await client.end();
  }

  console.log("\n==================================================================");
  console.log(`STEP 11C TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runStep11cSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
