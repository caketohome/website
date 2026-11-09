/**
 * CakeToHome ERP — Phase C7.10 Step 10C: Delivery Coverage & Partner Geofence API Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Preflight Database Invariants:
 *    - CoA = 100, TB = Dr ₹3,380.00 == Cr ₹3,380.00, Vouchers = 6, JEs = 4, JLs = 10.
 *    - Delivery partner rows = 30 intact.
 *    - Corporate accounts = 0, corporate employees = 0.
 * 2. Authentication & Authorization (Server-Side RBAC):
 *    - Unauthenticated -> 401 UNAUTHORIZED
 *    - Customer token -> 403 FORBIDDEN
 *    - Staff lacking DELIVERY_COVERAGE.VIEW -> 403 FORBIDDEN
 *    - Staff with DELIVERY_COVERAGE.VIEW -> 200 OK for GET /stores
 *    - Staff lacking DELIVERY_COVERAGE.MANAGE attempting mutations -> 403 FORBIDDEN
 *    - Non-Super Admin attempting to toggle corporate eligibility -> 403 FORBIDDEN (Super Admin only)
 *    - Branch Manager attempting cross-branch zone mutation -> 403 TenantScopeViolation
 * 3. Endpoints & Functional Capabilities:
 *    - GET /stores
 *    - PATCH /stores/:id/eligibility (with mandatory audit reason)
 *    - POST /stores/:id/zones (polygon with exclusion zone)
 *    - GET /stores/:id/zones
 *    - PUT /zones/:id (boundary update)
 *    - GET /partners (all 30 partners)
 *    - PUT /partners/:id/profile
 *    - PUT /partners/:id/coverage
 *    - GET /partners/:id/coverage
 *    - POST /validate-point (diagnostic probe)
 *    - POST /resolve-corporate (fail-closed corporate routing)
 *    - DELETE /zones/:id (deactivate)
 *    - GET /events (immutable audit log)
 * 4. Immutability & Event History:
 *    - Verify delivery_coverage_event rows generated and trigger blocks UPDATE/DELETE.
 * 5. Teardown & Postflight PostgreSQL Invariant Audit:
 *    - Clean teardown of test zones, partner profiles/coverages, and branch eligibility.
 *    - Complete baseline recheck (CoA=100, TB=₹3,380.00, partners=30).
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Module = require('module');
const assert = require('assert');

// 1. Module Alias Resolution for @frontend/
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@frontend/')) {
    const sub = request.substring('@frontend/'.length);
    const mapped = path.resolve(__dirname, '../src', sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// 2. Register TypeScript compilation hook
const ts = require('../node_modules/typescript');
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
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
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        let val = trimmed.substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cakes2home_test';
}

const conn = getConnectionString();
process.env.DATABASE_URL = conn;

const { NextRequest } = require('next/server');
const { signAuthToken } = require('../src/lib/security/auth-session');
const { GET, POST, PUT, DELETE, PATCH } = require('../src/app/api/v1/[...path]/route');

async function apiRequest(method, pathParts, body = null, token = null, queryParams = "", customHeaders = {}) {
  const url = `http://localhost:3000/api/v1/${pathParts.join("/")}${queryParams ? `?${queryParams}` : ""}`;
  const headers = { "Content-Type": "application/json", ...customHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const req = new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let res;
  if (method === "GET") {
    res = await GET(req, { params: { path: pathParts } });
  } else if (method === "POST") {
    res = await POST(req, { params: { path: pathParts } });
  } else if (method === "PATCH") {
    res = await PATCH(req, { params: { path: pathParts } });
  } else if (method === "PUT") {
    res = await PUT(req, { params: { path: pathParts } });
  } else if (method === "DELETE") {
    res = await DELETE(req, { params: { path: pathParts } });
  } else {
    throw new Error(`Unsupported method: ${method}`);
  }

  const status = res.status;
  let json = {};
  try {
    json = await res.json();
  } catch {
    // empty or non-json
  }
  return { status, json, headers: res.headers };
}

async function runStep10cSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.10 STEP 10C: API & RBAC SUITE         ");
  console.log("==================================================================\n");

  const pool = new Pool({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  let passed = 0;
  let failed = 0;

  function pass(testNum, desc) {
    passed++;
    console.log(`  ✓ TEST [${testNum}] PASS: ${desc}`);
  }

  function fail(testNum, desc, err, extra) {
    failed++;
    console.error(`  ✗ TEST [${testNum}] FAIL: ${desc}`);
    if (err) console.error("    Details:", err.message || err);
    if (extra) console.error("    Response Body:", JSON.stringify(extra));
  }

  const createdZoneIds = [];
  const createdPartnerProfileIds = [];
  const createdPartnerCoverageIds = [];
  let testBranchId = null;
  let testPartnerId = null;

  try {
    // -------------------------------------------------------------------------
    // PREFLIGHT: Baseline Invariant Audit
    // -------------------------------------------------------------------------
    const preCoA = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_account`);
    const preTB = await pool.query(`SELECT COALESCE(SUM(debit_amount),0)::numeric(15,2) as dr, COALESCE(SUM(credit_amount),0)::numeric(15,2) as cr FROM public.accounting_journal_line`);
    const preV = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_voucher`);
    const preJE = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_entry`);
    const preJL = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_line`);
    const preDP = await pool.query(`SELECT count(*)::int as cnt FROM public.delivery_partner`);
    const preCA = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_account`);
    const preCE = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee`);

    assert.strictEqual(preCoA.rows[0].cnt, 100, "CoA locked at 100");
    assert.strictEqual(preTB.rows[0].dr, '3380.00', "Trial balance Dr ₹3,380.00");
    assert.strictEqual(preTB.rows[0].cr, '3380.00', "Trial balance Cr ₹3,380.00");
    assert.strictEqual(preV.rows[0].cnt, 6, "Vouchers = 6");
    assert.strictEqual(preJE.rows[0].cnt, 4, "Journal Entries = 4");
    assert.strictEqual(preJL.rows[0].cnt, 10, "Journal Lines = 10");
    assert.strictEqual(preDP.rows[0].cnt, 30, "Delivery partners = 30 intact");
    assert.strictEqual(preCA.rows[0].cnt, 0, "Preflight: corporate_account empty");
    assert.strictEqual(preCE.rows[0].cnt, 0, "Preflight: corporate_employee empty");

    console.log(`  [PREFLIGHT] CoA: ${preCoA.rows[0].cnt} | TB: Dr ₹${preTB.rows[0].dr} = Cr ₹${preTB.rows[0].cr} | DP: ${preDP.rows[0].cnt} | Corp Tables Clean`);
    console.log("------------------------------------------------------------------\n");

    // Fetch active non-deleted branches and partner for testing
    const bRes = await pool.query(`SELECT id, name, latitude, longitude FROM public.branch WHERE deleted_at IS NULL ORDER BY id LIMIT 2`);
    testBranchId = bRes.rows[0].id;
    const branch2Id = bRes.rows[1].id;
    const branchLat = Number(bRes.rows[0].latitude) || 12.925;
    const branchLng = Number(bRes.rows[0].longitude) || 77.615;

    const pRes = await pool.query(`SELECT id, first_name, last_name FROM public.delivery_partner WHERE deleted_at IS NULL ORDER BY id LIMIT 1`);
    testPartnerId = pRes.rows[0].id;

    // Tokens
    const tokenSuperAdmin = signAuthToken({ userId: "admin_01", role: "SUPER_ADMIN" });
    const tokenViewer = signAuthToken({
      userId: "usr_viewer_10c",
      role: "STAFF",
      permissions: ["DELIVERY_COVERAGE.VIEW"],
    });
    const tokenManager = signAuthToken({
      userId: "usr_mgr_10c",
      role: "STAFF",
      permissions: ["DELIVERY_COVERAGE.VIEW", "DELIVERY_COVERAGE.MANAGE"],
    });
    const tokenBranchMgr = signAuthToken({
      userId: "usr_bm_10c",
      role: "BRANCH_MANAGER",
      branchId: testBranchId,
      permissions: ["DELIVERY_COVERAGE.VIEW", "DELIVERY_COVERAGE.MANAGE"],
    });
    const tokenUnauthorized = signAuthToken({
      userId: "usr_unauth_10c",
      role: "STAFF",
      permissions: [],
    });
    const tokenCustomer = signAuthToken({
      userId: "cust_test_10c",
      role: "CUSTOMER",
    });

    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated request rejected with 401
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest("GET", ["admin", "delivery-coverage", "stores"], null, null);
      assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
      pass(1, "Unauthenticated request rejected with 401 UNAUTHORIZED");
    } catch (e) {
      fail(1, "Unauthenticated request check", e);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Customer role rejected with 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest("GET", ["admin", "delivery-coverage", "stores"], null, tokenCustomer);
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      pass(2, "Customer role rejected with 403 Forbidden");
    } catch (e) {
      fail(2, "Customer role rejection", e);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Staff lacking DELIVERY_COVERAGE.VIEW rejected with 403
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest("GET", ["admin", "delivery-coverage", "stores"], null, tokenUnauthorized);
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      pass(3, "Staff lacking DELIVERY_COVERAGE.VIEW rejected with 403");
    } catch (e) {
      fail(3, "Staff lacking permission", e);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Staff with DELIVERY_COVERAGE.VIEW permitted to GET /stores
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest("GET", ["admin", "delivery-coverage", "stores"], null, tokenViewer);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.ok(Array.isArray(res.json.stores), "Stores list returned");
      assert.ok(res.json.stores.length > 0, "Non-empty stores array");
      pass(4, `Staff with DELIVERY_COVERAGE.VIEW successfully retrieved ${res.json.stores.length} stores`);
    } catch (e) {
      fail(4, "Staff with view permission", e);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Viewer trying to mutate zone rejected with 403
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "stores", testBranchId, "zones"],
        { name: "Unauthorized Zone", radius_km: 5 },
        tokenViewer
      );
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      pass(5, "Viewer lacking DELIVERY_COVERAGE.MANAGE rejected with 403 on POST /zones");
    } catch (e) {
      fail(5, "Viewer mutation rejection", e);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Non-Super Admin trying to update eligibility rejected with 403
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "PATCH",
        ["admin", "delivery-coverage", "stores", testBranchId, "eligibility"],
        { is_eligible: true, reason: "Unauthorized attempt" },
        tokenManager
      );
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      pass(6, "Non-Super Admin rejected with 403 when modifying store corporate eligibility");
    } catch (e) {
      fail(6, "Non-Super Admin eligibility guard", e);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Eligibility toggle validation: missing/short reason rejected with 400
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "PATCH",
        ["admin", "delivery-coverage", "stores", testBranchId, "eligibility"],
        { is_eligible: true, reason: "hi" }, // too short
        tokenSuperAdmin
      );
      assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
      pass(7, "Eligibility update without valid reason rejected with 400 Bad Request");
    } catch (e) {
      fail(7, "Eligibility reason validation", e);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Super Admin successfully sets store corporate eligibility = true
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "PATCH",
        ["admin", "delivery-coverage", "stores", testBranchId, "eligibility"],
        { is_eligible: true, reason: "Verified hub GPS coordinates & kitchen capacity" },
        tokenSuperAdmin
      );
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.is_corporate_routing_eligible, true);
      pass(8, "Super Admin successfully enabled store corporate routing eligibility with reason");
    } catch (e) {
      fail(8, "Super Admin eligibility update", e);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Branch Manager cross-branch scope rejection (403)
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "stores", branch2Id, "zones"],
        { name: "Cross Branch Zone", radius_km: 5 },
        tokenBranchMgr
      );
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      assert.strictEqual(res.json.error, "TenantScopeViolation");
      pass(9, "Branch Manager restricted from modifying zones outside assigned store (TenantScopeViolation)");
    } catch (e) {
      fail(9, "Branch Manager scope isolation", e);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Create store zone with polygon and exclusion zone via POST
    // -------------------------------------------------------------------------
    let createdZone = null;
    try {
      const polygonCoords = [
        { lat: branchLat - 0.05, lng: branchLng - 0.05 },
        { lat: branchLat + 0.05, lng: branchLng - 0.05 },
        { lat: branchLat + 0.05, lng: branchLng + 0.05 },
        { lat: branchLat - 0.05, lng: branchLng + 0.05 },
      ];
      const exclusionZones = [
        [
          { lat: branchLat - 0.01, lng: branchLng - 0.01 },
          { lat: branchLat + 0.01, lng: branchLng - 0.01 },
          { lat: branchLat + 0.01, lng: branchLng + 0.01 },
          { lat: branchLat - 0.01, lng: branchLng + 0.01 },
        ]
      ];

      const res = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "stores", testBranchId, "zones"],
        {
          name: "API Test Express Hub Zone",
          coordinates: { lat: branchLat, lng: branchLng },
          radius_km: 8.5,
          polygon_coordinates: polygonCoords,
          exclusion_polygons: exclusionZones,
          is_serviceable: true,
          reason: "Configured express perimeter and defence exclusion zone via API",
        },
        tokenSuperAdmin
      );

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.ok(res.json.zone && res.json.zone.id, "Zone returned with ID");
      createdZone = res.json.zone;
      createdZoneIds.push(createdZone.id);
      pass(10, `Created store zone ${createdZone.id} with polygon and exclusion zones via POST /zones`);
    } catch (e) {
      fail(10, "Create store zone", e);
    }

    // -------------------------------------------------------------------------
    // TEST 11: GET /stores/:id/zones returns store zones
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "GET",
        ["admin", "delivery-coverage", "stores", testBranchId, "zones"],
        null,
        tokenViewer
      );
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.ok(Array.isArray(res.json.zones), "Zones list returned");
      const found = res.json.zones.find(z => z.id === createdZone.id);
      assert.ok(found, "Created zone present in store zones list");
      pass(11, `GET /stores/:id/zones verified created zone ${createdZone.id}`);
    } catch (e) {
      fail(11, "List store zones", e);
    }

    // -------------------------------------------------------------------------
    // TEST 12: PUT /zones/:id updates zone boundaries
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "PUT",
        ["admin", "delivery-coverage", "zones", createdZone.id],
        {
          name: "API Test Express Hub Zone (Updated)",
          radius_km: 10.0,
          branch_id: testBranchId,
          reason: "Expanded delivery radius to 10km",
        },
        tokenManager
      );
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.zone.radius_km, 10.0);
      assert.strictEqual(res.json.zone.name, "API Test Express Hub Zone (Updated)");
      pass(12, `PUT /zones/:id successfully updated radius to 10km`);
    } catch (e) {
      fail(12, "Update store zone", e);
    }

    // -------------------------------------------------------------------------
    // TEST 13: GET /partners returns all 30 partners
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest("GET", ["admin", "delivery-coverage", "partners"], null, tokenViewer);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.ok(Array.isArray(res.json.partners), "Partners list returned");
      assert.strictEqual(res.json.partners.length, 30, "All 30 partners returned");
      pass(13, `GET /partners returned all 30 partners`);
    } catch (e) {
      fail(13, "List partners", e);
    }

    // -------------------------------------------------------------------------
    // TEST 14: PUT /partners/:id/profile configures operational capabilities
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "PUT",
        ["admin", "delivery-coverage", "partners", testPartnerId, "profile"],
        {
          partner_type: "OWN_FLEET",
          status: "ACTIVE",
          max_concurrent_orders: 8,
          rating: 4.8,
          primary_branch_id: testBranchId,
          metadata: { supports_cold_chain: true },
          reason: "Onboarded express cold-chain courier",
        },
        tokenManager
      );
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.profile.partner_id, testPartnerId);
      assert.strictEqual(res.json.profile.partner_type, "OWN_FLEET");
      createdPartnerProfileIds.push(res.json.profile.id);
      pass(14, `Configured delivery partner operational profile with status ACTIVE and capacity 8`);
    } catch (e) {
      fail(14, "Configure partner profile", e, e.extra);
    }

    // -------------------------------------------------------------------------
    // TEST 15: PUT /partners/:id/coverage configures partner geofence boundary
    // -------------------------------------------------------------------------
    try {
      const partnerPolygon = [
        { lat: branchLat - 0.06, lng: branchLng - 0.06 },
        { lat: branchLat + 0.06, lng: branchLng - 0.06 },
        { lat: branchLat + 0.06, lng: branchLng + 0.06 },
        { lat: branchLat - 0.06, lng: branchLng + 0.06 },
      ];

      const res = await apiRequest(
        "PUT",
        ["admin", "delivery-coverage", "partners", testPartnerId, "coverage"],
        {
          name: "Express Fleet Koramangala Grid",
          branch_id: testBranchId,
          fence_type: "POLYGON",
          polygon_coordinates: partnerPolygon,
          is_active: true,
          reason: "Defined primary metropolitan delivery corridor",
        },
        tokenManager
      );
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.coverage.partner_id, testPartnerId);
      createdPartnerCoverageIds.push(res.json.coverage.id);
      pass(15, `Configured delivery partner geofence coverage boundary`);
    } catch (e) {
      fail(15, "Configure partner coverage", e);
    }

    // -------------------------------------------------------------------------
    // TEST 16: GET /partners/:id/coverage retrieves partner coverage
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "GET",
        ["admin", "delivery-coverage", "partners", testPartnerId, "coverage"],
        null,
        tokenViewer
      );
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.ok(Array.isArray(res.json.coverage), "Coverage array returned");
      assert.ok(res.json.coverage.length >= 1, "At least 1 coverage boundary");
      pass(16, `GET /partners/:id/coverage returned active boundaries for partner`);
    } catch (e) {
      fail(16, "Get partner coverage", e);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Diagnostic Point Probe POST /validate-point
    // -------------------------------------------------------------------------
    try {
      // 17A: Point inside coverage (near branch, outside exclusion)
      const insidePt = { lat: branchLat + 0.02, lng: branchLng + 0.02, branch_id: testBranchId };
      const insideRes = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "validate-point"],
        insidePt,
        tokenViewer
      );
      assert.strictEqual(insideRes.status, 200);
      assert.strictEqual(insideRes.json.result.serviceable, true, "Point inside zone should be serviceable");
      assert.strictEqual(insideRes.json.result.inside_exclusion, false, "Point not in exclusion");

      // 17B: Point inside exclusion zone
      const exclPt = { lat: branchLat, lng: branchLng, branch_id: testBranchId };
      const exclRes = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "validate-point"],
        exclPt,
        tokenViewer
      );
      assert.strictEqual(exclRes.status, 200);
      assert.strictEqual(exclRes.json.result.inside_exclusion, true, "Point detected in exclusion zone");

      // 17C: Point outside all zones
      const outPt = { lat: 13.500, lng: 78.500 };
      const outRes = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "validate-point"],
        outPt,
        tokenViewer
      );
      assert.strictEqual(outRes.status, 200);
      assert.strictEqual(outRes.json.result.serviceable, false, "Point detected outside all zones");

      pass(17, "Diagnostic Point Probe accurately classified inside, exclusion, and outside coordinates");
    } catch (e) {
      fail(17, "Diagnostic point probe", e);
    }

    // -------------------------------------------------------------------------
    // TEST 18: Corporate Routing Fail-Closed Resolution POST /resolve-corporate
    // -------------------------------------------------------------------------
    try {
      // 18A: Missing coordinates -> fail-closed INVALID_COORDINATES
      const invRes = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "resolve-corporate"],
        { lat: null, lng: null },
        tokenViewer
      );
      assert.strictEqual(invRes.status, 200);
      assert.strictEqual(invRes.json.resolution.resolved, false);
      assert.strictEqual(invRes.json.resolution.reason_code, "INVALID_COORDINATES");

      // 18B: Point inside exclusion zone -> fail-closed INSIDE_EXCLUSION_ZONE
      const exclPt = { lat: branchLat, lng: branchLng, branch_id: testBranchId };
      const exclRes = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "resolve-corporate"],
        exclPt,
        tokenViewer
      );
      assert.strictEqual(exclRes.status, 200);
      assert.strictEqual(exclRes.json.resolution.resolved, false);
      assert.strictEqual(exclRes.json.resolution.reason_code, "INSIDE_EXCLUSION_ZONE");

      // 18C: Valid point inside eligible store zone with active partner -> resolved = true
      const insidePt = { lat: branchLat + 0.02, lng: branchLng + 0.02, branch_id: testBranchId };
      const okRes = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "resolve-corporate"],
        insidePt,
        tokenViewer
      );
      assert.strictEqual(okRes.status, 200);
      assert.strictEqual(okRes.json.resolution.resolved, true);
      assert.strictEqual(okRes.json.resolution.reason_code, "RESOLVED");
      assert.strictEqual(okRes.json.resolution.store.id, testBranchId);

      // 18D: Toggle store eligibility to FALSE -> resolution must immediately fail-closed with STORE_NOT_VERIFIED
      await apiRequest(
        "PATCH",
        ["admin", "delivery-coverage", "stores", testBranchId, "eligibility"],
        { is_eligible: false, reason: "Temporarily disabled for corporate testing" },
        tokenSuperAdmin
      );

      const unverifiedRes = await apiRequest(
        "POST",
        ["admin", "delivery-coverage", "resolve-corporate"],
        insidePt,
        tokenViewer
      );
      assert.strictEqual(unverifiedRes.status, 200);
      assert.strictEqual(unverifiedRes.json.resolution.resolved, false);
      assert.strictEqual(unverifiedRes.json.resolution.reason_code, "STORE_NOT_VERIFIED");

      // Re-enable eligibility for remainder of testing
      await apiRequest(
        "PATCH",
        ["admin", "delivery-coverage", "stores", testBranchId, "eligibility"],
        { is_eligible: true, reason: "Re-enabled store eligibility for teardown" },
        tokenSuperAdmin
      );

      pass(18, "Corporate Routing Fail-Closed Resolution verified (INVALID_COORDINATES, INSIDE_EXCLUSION_ZONE, STORE_NOT_VERIFIED, RESOLVED)");
    } catch (e) {
      fail(18, "Corporate routing resolution", e);
    }

    // -------------------------------------------------------------------------
    // TEST 19: DELETE /zones/:id deactivates store zone
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest(
        "DELETE",
        ["admin", "delivery-coverage", "zones", createdZone.id],
        null,
        tokenManager
      );
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);

      // Verify zone is now not serviceable
      const checkRes = await pool.query(`SELECT is_serviceable FROM public.delivery_zone WHERE id = $1`, [createdZone.id]);
      assert.strictEqual(checkRes.rows[0].is_serviceable, false, "Zone marked not serviceable");
      pass(19, `DELETE /zones/:id safely deactivated zone ${createdZone.id}`);
    } catch (e) {
      fail(19, "Deactivate store zone", e);
    }

    // -------------------------------------------------------------------------
    // TEST 20: GET /events returns audit trail and enforces immutability trigger
    // -------------------------------------------------------------------------
    try {
      const res = await apiRequest("GET", ["admin", "delivery-coverage", "events"], null, tokenViewer);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.json.success, true);
      assert.ok(Array.isArray(res.json.events), "Audit events array returned");
      assert.ok(res.json.events.length >= 5, "Multiple audit events recorded");

      // Verify DB trigger blocks UPDATE on delivery_coverage_event
      let triggerBlocked = false;
      try {
        await pool.query(`UPDATE public.delivery_coverage_event SET reason = 'Tampered' WHERE id = $1`, [res.json.events[0].id]);
      } catch (triggerErr) {
        if (
          triggerErr.message.includes('append-only') ||
          triggerErr.message.includes('prohibited') ||
          triggerErr.message.includes('immutable') ||
          triggerErr.code === '27000'
        ) {
          triggerBlocked = true;
        }
      }
      assert.strictEqual(triggerBlocked, true, "Trigger trg_delivery_coverage_event_immutability blocked update");
      pass(20, `Audit events endpoint verified (${res.json.events.length} events logged) and immutability trigger blocked tampering`);
    } catch (e) {
      fail(20, "Audit trail and immutability", e);
    }

    // -------------------------------------------------------------------------
    // TEARDOWN: Clean up test fixtures
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("  TEARDOWN: Cleaning test fixtures...                             ");

    // Clean test partner coverages and profiles
    if (createdPartnerCoverageIds.length > 0) {
      await pool.query(`DELETE FROM public.delivery_partner_coverage WHERE id = ANY($1::text[])`, [createdPartnerCoverageIds]);
    }
    if (createdPartnerProfileIds.length > 0) {
      await pool.query(`DELETE FROM public.delivery_partner_profile WHERE id = ANY($1::text[])`, [createdPartnerProfileIds]);
    }
    if (createdZoneIds.length > 0) {
      await pool.query(`DELETE FROM public.delivery_zone WHERE id = ANY($1::text[])`, [createdZoneIds]);
    }
    // Revert branch eligibility to default false
    if (testBranchId) {
      await pool.query(`UPDATE public.branch SET is_corporate_routing_eligible = false WHERE id = $1`, [testBranchId]);
    }
    // Note: delivery_coverage_event is append-only & immutable by design and preserves audit events.

    console.log("  Teardown completed cleanly.");
    console.log("------------------------------------------------------------------\n");

    // -------------------------------------------------------------------------
    // POSTFLIGHT: Final Baseline Integrity Audit
    // -------------------------------------------------------------------------
    const postCoA = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_account`);
    const postTB = await pool.query(`SELECT COALESCE(SUM(debit_amount),0)::numeric(15,2) as dr, COALESCE(SUM(credit_amount),0)::numeric(15,2) as cr FROM public.accounting_journal_line`);
    const postV = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_voucher`);
    const postJE = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_entry`);
    const postJL = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_line`);
    const postDP = await pool.query(`SELECT count(*)::int as cnt FROM public.delivery_partner`);
    const postCA = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_account`);
    const postCE = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee`);

    assert.strictEqual(postCoA.rows[0].cnt, 100, "CoA remained at 100");
    assert.strictEqual(postTB.rows[0].dr, '3380.00', "Trial balance Dr ₹3,380.00");
    assert.strictEqual(postTB.rows[0].cr, '3380.00', "Trial balance Cr ₹3,380.00");
    assert.strictEqual(postV.rows[0].cnt, 6, "Vouchers remained 6");
    assert.strictEqual(postJE.rows[0].cnt, 4, "Journal Entries remained 4");
    assert.strictEqual(postJL.rows[0].cnt, 10, "Journal Lines remained 10");
    assert.strictEqual(postDP.rows[0].cnt, 30, "All 30 delivery partners intact");
    assert.strictEqual(postCA.rows[0].cnt, 0, "Corporate accounts intact at 0");
    assert.strictEqual(postCE.rows[0].cnt, 0, "Corporate employees intact at 0");

    console.log(`  [POSTFLIGHT] CoA: ${postCoA.rows[0].cnt} | TB: Dr ₹${postTB.rows[0].dr} = Cr ₹${postTB.rows[0].cr} | DP: ${postDP.rows[0].cnt} | Corp: 0`);
    console.log("==================================================================");
    console.log(`  STEP 10C TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================================\n");

  } finally {
    await pool.end();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runStep10cSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
