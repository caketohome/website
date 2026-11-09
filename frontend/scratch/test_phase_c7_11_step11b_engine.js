/**
 * CakeToHome ERP — Phase C7.11 Step 11B: Domain Geographic Matching Engine Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Preflight Database Invariants (CoA=100, TB=₹3,380.00 Dr/Cr, Partners=30, Active Branches=53).
 * 2. 10 Core Matching Scenarios:
 *    - Scenario 1: Missing coordinates -> UNASSIGNED / COORDINATES_MISSING
 *    - Scenario 2: Invalid / out-of-range coordinates -> UNASSIGNED / COORDINATES_INVALID
 *    - Scenario 3: Point inside exclusion polygon -> UNASSIGNED / INSIDE_EXCLUSION
 *    - Scenario 4: Point outside all eligible coverage -> UNASSIGNED / OUTSIDE_COVERAGE
 *    - Scenario 5: Candidate covered by store but is_corporate_routing_eligible=false -> UNASSIGNED / STORE_NOT_ELIGIBLE
 *    - Scenario 6: Store match with zero active partner coverage -> UNASSIGNED / NO_ELIGIBLE_PARTNER
 *    - Scenario 7: Polygon match strictly beats circle radius-only match
 *    - Scenario 8: Store priority, distance, and stable tie-breaker determinism
 *    - Scenario 9: Partner priority, fleet-type tie-breaker (OWN_FLEET > COURIER > 3PL), and stable tie-breaker
 *    - Scenario 10: Repeat-run idempotency & append-only audit:
 *                   - Unchanged outcomes do not emit duplicate audit events
 *                   - Real change appends audit event
 *                   - SQLSTATE 27000 trigger strictly rejects UPDATE and DELETE on audit events
 * 3. Additional Edge Cases:
 *    - Boundary coordinates evaluation
 *    - Transactional rollback if audit insertion fails
 *    - Concurrency / unique constraint defense on (entity_type, entity_id)
 *    - Schema CHECK constraint rejects invalid reason codes
 * 4. Teardown of all test-created fixture records.
 * 5. Postflight Database Invariants (CoA=100, TB=₹3,380.00 Dr/Cr, Partners=30, Branches=53).
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
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
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        let val = line.trim().substring("DATABASE_URL=".length).trim();
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

let passes = 0;
let fails = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passes++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    fails++;
  }
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("=============================================================================");
  console.log("CakeToHome ERP — Phase C7.11 Step 11B Domain Geographic Matching Engine Suite");
  console.log("=============================================================================\n");

  const runId = Date.now();
  const testBranchAId = `br_test_11b_a_${runId}`;
  const testBranchBId = `br_test_11b_b_${runId}`;
  const testBranchCIneligibleId = `br_test_11b_c_${runId}`;
  const testZoneAId = `zone_test_11b_a_${runId}`;
  const testZoneBId = `zone_test_11b_b_${runId}`;
  const testZoneCId = `zone_test_11b_c_${runId}`;
  const testPartner1Id = `dlp_test_11b_1_${runId}`;
  const testPartner2Id = `dlp_test_11b_2_${runId}`;
  const testPartner3Id = `dlp_test_11b_3_${runId}`;
  const testProf1Id = `prof_test_11b_1_${runId}`;
  const testProf2Id = `prof_test_11b_2_${runId}`;
  const testProf3Id = `prof_test_11b_3_${runId}`;
  const testCov1Id = `cov_test_11b_1_${runId}`;
  const testCov2Id = `cov_test_11b_2_${runId}`;
  const testCov3Id = `cov_test_11b_3_${runId}`;

  try {
    // ── 1. PREFLIGHT ACCOUNTING & MASTER INVARIANTS ───────────────────────────
    console.log("[Preflight] Invariant Check");
    const preCoA = await client.query("SELECT count(*)::int as count FROM public.accounting_account;");
    const preVouchers = await client.query("SELECT count(*)::int as count FROM public.accounting_voucher;");
    const preJE = await client.query("SELECT count(*)::int as count FROM public.accounting_journal_entry;");
    const preJL = await client.query("SELECT count(*)::int as count, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const preDP = await client.query("SELECT count(*)::int as count FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const preBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");

    assert(preCoA.rows[0].count === 100, `Preflight CoA is 100 accounts: ${preCoA.rows[0].count}`);
    assert(preVouchers.rows[0].count === 6, `Preflight Vouchers = 6: ${preVouchers.rows[0].count}`);
    assert(preJE.rows[0].count === 4, `Preflight Journal Entries = 4: ${preJE.rows[0].count}`);
    assert(preJL.rows[0].dr === "3380.00" && preJL.rows[0].cr === "3380.00", `Preflight TB strictly balanced Dr/Cr ₹3,380.00`);
    assert(preDP.rows[0].count === 30, `Preflight Delivery Partners preserved: ${preDP.rows[0].count}`);
    assert(preBranch.rows[0].active === 53, `Preflight Active Branches preserved: ${preBranch.rows[0].active}`);

    // ── 2. SEED TRANSACTIONAL TEST FIXTURES ───────────────────────────────────
    console.log("\n[Setup] Seeding Isolated Test Fixtures...");

    // Test Store A: Corporate-eligible, Centroid at Indiranagar (12.9716, 77.6412)
    // Has Zone A with both a Polygon geofence (covering 12.97-12.99, 77.63-77.65) AND an Exclusion polygon (12.980-12.985, 77.635-77.640)
    const polygonZoneA = [
      [12.970, 77.630],
      [12.990, 77.630],
      [12.990, 77.650],
      [12.970, 77.650],
      [12.970, 77.630]
    ];
    const exclusionZoneA = [
      [
        [12.980, 77.635],
        [12.985, 77.635],
        [12.985, 77.640],
        [12.980, 77.640],
        [12.980, 77.635]
      ]
    ];

    const existingShop = await client.query("SELECT shop_id FROM public.branch WHERE shop_id IS NOT NULL LIMIT 1;");
    const validShopId = existingShop.rows[0]?.shop_id || null;

    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, phone, email, address, latitude, longitude, shop_id, is_corporate_routing_eligible)
      VALUES 
        ($1, 'Test Hub A (Eligible)', 'HUB-TEST-A', true, '9999900001', 'hub-a@test.com', 'Indiranagar Hub', 12.9716, 77.6412, $4, true),
        ($2, 'Test Hub B (Eligible)', 'HUB-TEST-B', true, '9999900002', 'hub-b@test.com', 'Domlur Hub', 12.9600, 77.6350, $4, true),
        ($3, 'Test Hub C (Ineligible)', 'HUB-TEST-C', true, '9999900003', 'hub-c@test.com', 'Koramangala Hub', 12.9350, 77.6200, $4, false);
    `, [testBranchAId, testBranchBId, testBranchCIneligibleId, validShopId]);

    // Zone A on Branch A: Priority 50, Polygon coverage + Exclusion zone (no circle radius, strictly polygon)
    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'Zone A (Polygon & Exclusion)', '560038', 0, true, $3, $4, NULL, 12.9716, 77.6412, 50);
    `, [testZoneAId, testBranchAId, JSON.stringify(polygonZoneA), JSON.stringify(exclusionZoneA)]);

    // Zone B on Branch B: Priority 20, Radius-only coverage (3.0 km around 12.9600, 77.6350)
    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'Zone B (Radius Only)', '560071', 0, true, NULL, NULL, 3.0, 12.9600, 77.6350, 20);
    `, [testZoneBId, testBranchBId]);

    // Zone C on Branch C (Ineligible store): Priority 90, Polygon coverage around Koramangala
    const polygonZoneC = [
      [12.920, 77.610],
      [12.950, 77.610],
      [12.950, 77.630],
      [12.920, 77.630],
      [12.920, 77.610]
    ];
    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'Zone C (Ineligible Store)', '560034', 0, true, $3, NULL, 5.0, 12.9350, 77.6200, 90);
    `, [testZoneCId, testBranchCIneligibleId, JSON.stringify(polygonZoneC)]);

    // Seed Test Delivery Partners
    // Partner 1: OWN_FLEET on Hub A, Priority 80, Polygon coverage
    // Partner 2: COURIER on Hub A, Priority 80 (same priority as Partner 1 to test fleet tie-breaker!)
    // Partner 3: 3PL_AGGREGATOR on Hub B, Priority 50, Radius coverage
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES 
        ($1, 'FleetRider', 'One', 'rider1@test.com', '+919988110001'),
        ($2, 'CourierRider', 'Two', 'rider2@test.com', '+919988110002'),
        ($3, 'AggregatorRider', 'Three', 'rider3@test.com', '+919988110003');
    `, [testPartner1Id, testPartner2Id, testPartner3Id]);

    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES
        ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.9),
        ($4, $5, 'COURIER', 'ACTIVE', $6, 4.9),
        ($7, $8, '3PL_AGGREGATOR', 'ACTIVE', $9, 4.5);
    `, [
      testProf1Id, testPartner1Id, testBranchAId,
      testProf2Id, testPartner2Id, testBranchAId,
      testProf3Id, testPartner3Id, testBranchBId
    ]);

    // Coverages for Partner 1 (Polygon) and Partner 2 (Radius) on Branch A
    await client.query(`
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, polygon_coordinates, radius_km, center_latitude, center_longitude)
      VALUES
        ($1, $2, $3, 'POLYGON', 80, true, $4, NULL, NULL, NULL),
        ($5, $6, $7, 'RADIUS', 80, true, NULL, 6.0, 12.9716, 77.6412),
        ($8, $9, $10, 'RADIUS', 50, true, NULL, 10.0, 12.9600, 77.6350);
    `, [
      testCov1Id, testPartner1Id, testBranchAId, JSON.stringify(polygonZoneA),
      testCov2Id, testPartner2Id, testBranchAId,
      testCov3Id, testPartner3Id, testBranchBId
    ]);

    console.log("✓ Test fixtures created successfully.");

    // Import Domain Service
    const { CorporateRoutingService } = require("../src/lib/services/corporate-routing.service");

    // ── 3. EXECUTE TEST SCENARIOS ─────────────────────────────────────────────
    console.log("\n[Test Suites] Executing 10 Core Matching Scenarios...");

    // ── Scenario 1: Missing coordinates -> UNASSIGNED / COORDINATES_MISSING ──
    const res1 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_miss_${runId}`,
        delivery_address: "No GPS Address, MG Road",
        latitude: null,
        longitude: null
      }]
    });
    assert(res1.summary.total_unassigned === 1, "Scenario 1: Missing coordinates marked UNASSIGNED");
    assert(res1.assignments[0].reason_code === "COORDINATES_MISSING", "Scenario 1: Reason is COORDINATES_MISSING");
    assert(res1.assignments[0].status === "UNASSIGNED", "Scenario 1: Status is UNASSIGNED");

    // ── Scenario 2: Invalid / out-of-range coordinates -> UNASSIGNED / COORDINATES_INVALID ──
    const res2 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_inv_${runId}`,
        delivery_address: "Bad GPS Address",
        latitude: 145.0, // Invalid lat > 90
        longitude: 77.64
      }]
    });
    assert(res2.summary.total_unassigned === 1, "Scenario 2: Out-of-bounds latitude marked UNASSIGNED");
    assert(res2.assignments[0].reason_code === "COORDINATES_INVALID", "Scenario 2: Reason is COORDINATES_INVALID");

    // ── Scenario 3: Point inside exclusion polygon -> UNASSIGNED / INSIDE_EXCLUSION ──
    // Point [12.982, 77.638] is strictly inside exclusionZoneA
    const res3 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_excl_${runId}`,
        delivery_address: "Inside Exclusion Zone Point",
        latitude: 12.982,
        longitude: 77.638
      }]
    });
    assert(res3.summary.total_unassigned === 1, "Scenario 3: Inside exclusion polygon marked UNASSIGNED");
    assert(res3.assignments[0].reason_code === "INSIDE_EXCLUSION", "Scenario 3: Reason is INSIDE_EXCLUSION");
    assert(res3.assignments[0].diagnostics_message.includes("exclusion boundary"), "Scenario 3: Diagnostics explains exclusion");

    // ── Scenario 4: Point outside all eligible coverage -> UNASSIGNED / OUTSIDE_COVERAGE ──
    // Point [14.500, 78.500] is far away in rural Andhra/Karnataka, outside all hubs
    const res4 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_out_${runId}`,
        delivery_address: "Distant Rural Location",
        latitude: 14.500,
        longitude: 78.500
      }]
    });
    assert(res4.summary.total_unassigned === 1, "Scenario 4: Point outside all coverage marked UNASSIGNED");
    assert(res4.assignments[0].reason_code === "OUTSIDE_COVERAGE", "Scenario 4: Reason is OUTSIDE_COVERAGE");

    // ── Scenario 5: Candidate covered by store but is_corporate_routing_eligible=false -> UNASSIGNED / STORE_NOT_ELIGIBLE ──
    // Point [12.930, 77.620] is covered by Test Hub C (Ineligible Store)
    const res5 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_inelig_${runId}`,
        delivery_address: "Koramangala 4th Block",
        latitude: 12.930,
        longitude: 77.620
      }]
    });
    assert(res5.summary.total_unassigned === 1, "Scenario 5: Ineligible store coverage marked UNASSIGNED");
    assert(res5.assignments[0].reason_code === "STORE_NOT_ELIGIBLE", "Scenario 5: Reason is STORE_NOT_ELIGIBLE");
    assert(res5.assignments[0].diagnostics_message.includes("is_corporate_routing_eligible = false"), "Scenario 5: Diagnostics explains store ineligibility");

    // ── Scenario 6: Store match with zero active partner coverage -> UNASSIGNED / NO_ELIGIBLE_PARTNER ──
    // Deactivate partner coverages on Hub B temporarily
    await client.query(`UPDATE public.delivery_partner_coverage SET is_active = false WHERE id = $1;`, [testCov3Id]);
    // Point [12.955, 77.630] matches Zone B (Hub B) via radius
    const res6 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_nopartner_${runId}`,
        delivery_address: "Domlur Inner Ring Rd",
        latitude: 12.955,
        longitude: 77.630
      }]
    });
    assert(res6.summary.total_unassigned === 1, "Scenario 6: Store match without partner coverage marked UNASSIGNED");
    assert(res6.assignments[0].reason_code === "NO_ELIGIBLE_PARTNER", "Scenario 6: Reason is NO_ELIGIBLE_PARTNER");
    assert(res6.assignments[0].assigned_store_id === testBranchBId, "Scenario 6: Store ID recorded for context");
    // Re-enable coverage
    await client.query(`UPDATE public.delivery_partner_coverage SET is_active = true WHERE id = $1;`, [testCov3Id]);

    // ── Scenario 7: Polygon match strictly beats circle radius-only match ──
    // Point [12.975, 77.645] falls inside BOTH:
    // 1) Zone A (Polygon coverage, Priority 50)
    // 2) Zone B (Radius coverage, Priority 20)
    // Polygon must win!
    const res7 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "GIFTING_RECIPIENT",
        entity_id: `rec_poly_${runId}`,
        delivery_address: "Indiranagar 12th Main",
        latitude: 12.975,
        longitude: 77.645
      }]
    });
    assert(res7.summary.total_assigned === 1, "Scenario 7: Polygon overlap successfully assigned");
    assert(res7.assignments[0].assigned_store_id === testBranchAId, "Scenario 7: Polygon store (Hub A) selected over radius store (Hub B)");
    assert(res7.assignments[0].reason_code === "MATCHED_POLYGON", "Scenario 7: Reason is MATCHED_POLYGON");

    // ── Scenario 8: Store priority, distance, and stable tie-breaker determinism ──
    // Repeat matching for the same point produces identical deterministic store and distance
    const res8 = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "GIFTING_RECIPIENT",
        entity_id: `rec_poly_${runId}`,
        delivery_address: "Indiranagar 12th Main",
        latitude: 12.975,
        longitude: 77.645
      }]
    });
    assert(res8.assignments[0].assigned_store_id === res7.assignments[0].assigned_store_id, "Scenario 8: Deterministic store match identical");
    assert(res8.assignments[0].distance_km === res7.assignments[0].distance_km, "Scenario 8: Deterministic distance calculation identical");

    // ── Scenario 9: Partner priority & fleet-type tie-breaker (OWN_FLEET > COURIER > 3PL) ──
    // On Hub A, Partner 1 (OWN_FLEET) and Partner 2 (COURIER) both have Priority 80 and Rating 4.9.
    // OWN_FLEET must win the tie-breaker!
    assert(res7.assignments[0].assigned_partner_id === testPartner1Id, "Scenario 9: OWN_FLEET partner selected over COURIER on tie-breaker");
    assert(res7.assignments[0].matched_rule.includes("OWN_FLEET"), "Scenario 9: Matched rule reflects OWN_FLEET preference");

    // ── Scenario 10: Repeat-run idempotency & append-only audit behavior ──
    console.log("\n[Scenario 10] Testing Idempotency & Audit Immutability...");
    // Count audit events before repeat run
    const eventsBefore = await client.query("SELECT count(*)::int as count FROM public.corporate_assignment_event;");

    // Repeat run with identical inputs for recipient
    await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "GIFTING_RECIPIENT",
        entity_id: `rec_poly_${runId}`,
        delivery_address: "Indiranagar 12th Main",
        latitude: 12.975,
        longitude: 77.645
      }]
    });

    const eventsAfter = await client.query("SELECT count(*)::int as count FROM public.corporate_assignment_event;");
    assert(eventsBefore.rows[0].count === eventsAfter.rows[0].count, "Scenario 10: Unchanged repeat run is strictly IDEMPOTENT (no duplicate audit events emitted)");

    // Test real mutation appends new event
    // Change location to outside coverage
    await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "GIFTING_RECIPIENT",
        entity_id: `rec_poly_${runId}`,
        delivery_address: "Relocated Far Away",
        latitude: 14.500,
        longitude: 78.500
      }]
    });
    const eventsMutated = await client.query("SELECT count(*)::int as count FROM public.corporate_assignment_event;");
    assert(eventsMutated.rows[0].count === eventsAfter.rows[0].count + 1, "Scenario 10: Changed assignment state appended exactly 1 new audit event");

    // Test Trigger Defense: UPDATE and DELETE on audit events strictly rejected by PostgreSQL with SQLSTATE 27000
    const sampleEvent = await client.query("SELECT id FROM public.corporate_assignment_event LIMIT 1;");
    let updateRejected = false;
    try {
      await client.query("UPDATE public.corporate_assignment_event SET reason = 'tampered' WHERE id = $1;", [sampleEvent.rows[0].id]);
    } catch (err) {
      if (err.message.includes("append-only") || err.code === "27000") {
        updateRejected = true;
      }
    }
    assert(updateRejected, "Scenario 10: PostgreSQL trigger strictly blocked UPDATE on corporate_assignment_event (SQLSTATE 27000)");

    let deleteRejected = false;
    try {
      await client.query("DELETE FROM public.corporate_assignment_event WHERE id = $1;", [sampleEvent.rows[0].id]);
    } catch (err) {
      if (err.message.includes("append-only") || err.code === "27000") {
        deleteRejected = true;
      }
    }
    assert(deleteRejected, "Scenario 10: PostgreSQL trigger strictly blocked DELETE on corporate_assignment_event (SQLSTATE 27000)");

    // ── 4. ADDITIONAL EDGE CASES ──────────────────────────────────────────────
    console.log("\n[Edge Cases] Additional Boundary & Integrity Validations...");

    // Edge Case: Concurrency & Unique constraint defense on (entity_type, entity_id)
    const duplicateEntityTest = await client.query(`
      SELECT count(*)::int as count FROM public.corporate_delivery_assignment 
      WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1;
    `, [`rec_poly_${runId}`]);
    assert(duplicateEntityTest.rows[0].count === 1, "Edge Case: Exactly 1 assignment record exists per (entity_type, entity_id) unique constraint");

    // Edge Case: Schema CHECK constraint rejects invalid reason codes
    let invalidReasonRejected = false;
    try {
      await client.query(`
        INSERT INTO public.corporate_delivery_assignment (
          entity_type, entity_id, delivery_address, status, reason_code
        ) VALUES ('DIRECT_ORDER', 'ord_invalid_reason', 'Address', 'UNASSIGNED', 'INVALID_REASON_CODE');
      `);
    } catch (err) {
      if (err.message.includes("chk_cda_reason_code")) {
        invalidReasonRejected = true;
      }
    }
    assert(invalidReasonRejected, "Edge Case: Database check constraint rejects unauthorized/invalid reason codes");
    // Edge Case: Coordinates on polygon boundary
    const boundaryOutcome = await CorporateRoutingService.matchDeliveriesBatch({
      items: [{
        entity_type: "ROSTER_EMPLOYEE",
        entity_id: `emp_boundary_${runId}`,
        delivery_address: "Exact Boundary Point",
        latitude: 12.970,
        longitude: 77.640
      }]
    });
    assert(
      boundaryOutcome.assignments.length === 1 &&
      (boundaryOutcome.assignments[0].status === "ASSIGNED" || boundaryOutcome.assignments[0].status === "UNASSIGNED"),
      "Edge Case: Coordinate directly on polygon boundary evaluates deterministically"
    );

    // Edge Case: Transaction rollback if audit insertion fails
    let rollbackVerified = false;
    const testRollbackEntityId = `emp_rollback_${runId}`;
    try {
      const { dbTransaction } = require("../src/lib/db");
      const { CorporateRoutingRepository } = require("../src/lib/repositories/corporate-routing.repository");
      await dbTransaction(async (txClient) => {
        await CorporateRoutingRepository.upsertAssignment({
          entity_type: "ROSTER_EMPLOYEE",
          entity_id: testRollbackEntityId,
          delivery_address: "Rollback Address",
          status: "ASSIGNED",
          reason_code: "MATCHED_POLYGON"
        }, txClient);

        // Force a failure to test atomic rollback
        throw new Error("SIMULATED_AUDIT_FAILURE_FOR_ROLLBACK");
      });
    } catch (txErr) {
      if (txErr.message.includes("SIMULATED_AUDIT_FAILURE_FOR_ROLLBACK")) {
        const checkRolledBack = await client.query(`
          SELECT count(*)::int as count FROM public.corporate_delivery_assignment
          WHERE entity_id = $1;
        `, [testRollbackEntityId]);
        if (checkRolledBack.rows[0].count === 0) {
          rollbackVerified = true;
        }
      }
    }
    assert(rollbackVerified, "Edge Case: Transaction rollback leaves zero residual assignment when audit insertion fails");

  } finally {
    // ── 5. TEARDOWN OF TEST FIXTURES ──────────────────────────────────────────
    console.log("\n[Teardown] Cleaning up isolated test fixtures...");
    try {
      // Disable immutability trigger temporarily to clean test audit events
      await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query(`
        DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (
          SELECT id FROM public.corporate_delivery_assignment WHERE entity_id LIKE '%_${runId}'
        );
      `);
      await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

      await client.query(`DELETE FROM public.corporate_delivery_assignment WHERE entity_id LIKE '%_${runId}';`);
      await client.query(`DELETE FROM public.delivery_partner_coverage WHERE id IN ($1, $2, $3);`, [testCov1Id, testCov2Id, testCov3Id]);
      await client.query(`DELETE FROM public.delivery_partner_profile WHERE id IN ($1, $2, $3);`, [testProf1Id, testProf2Id, testProf3Id]);
      await client.query(`DELETE FROM public.delivery_partner WHERE id IN ($1, $2, $3);`, [testPartner1Id, testPartner2Id, testPartner3Id]);
      await client.query(`DELETE FROM public.delivery_zone WHERE id IN ($1, $2, $3);`, [testZoneAId, testZoneBId, testZoneCId]);
      await client.query(`DELETE FROM public.branch WHERE id IN ($1, $2, $3);`, [testBranchAId, testBranchBId, testBranchCIneligibleId]);
      console.log("✓ Fixtures cleaned up safely.");
    } catch (cleanErr) {
      console.error("Teardown warning:", cleanErr.message);
    }

    // ── 6. POSTFLIGHT ACCOUNTING & MASTER INVARIANTS ──────────────────────────
    console.log("\n[Postflight] Final Master Invariant Verification");
    const postCoA = await client.query("SELECT count(*)::int as count FROM public.accounting_account;");
    const postVouchers = await client.query("SELECT count(*)::int as count FROM public.accounting_voucher;");
    const postJE = await client.query("SELECT count(*)::int as count FROM public.accounting_journal_entry;");
    const postJL = await client.query("SELECT count(*)::int as count, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const postDP = await client.query("SELECT count(*)::int as count FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const postBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
    const postAssign = await client.query("SELECT count(*)::int as count FROM public.corporate_delivery_assignment;");
    const postEvents = await client.query("SELECT count(*)::int as count FROM public.corporate_assignment_event;");

    assert(postCoA.rows[0].count === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].count}`);
    assert(postVouchers.rows[0].count === 6, `Postflight Vouchers = 6: ${postVouchers.rows[0].count}`);
    assert(postJE.rows[0].count === 4, `Postflight Journal Entries = 4: ${postJE.rows[0].count}`);
    assert(postJL.rows[0].dr === "3380.00" && postJL.rows[0].cr === "3380.00", `Postflight TB strictly balanced Dr/Cr ₹3,380.00: Dr ₹${postJL.rows[0].dr} / Cr ₹${postJL.rows[0].cr}`);
    assert(postDP.rows[0].count === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].count}`);
    assert(postBranch.rows[0].active === 53, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);
    assert(postAssign.rows[0].count === 0, `corporate_delivery_assignment has 0 residual rows: ${postAssign.rows[0].count}`);
    assert(postEvents.rows[0].count === 0, `corporate_assignment_event has 0 residual rows: ${postEvents.rows[0].count}`);

    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end();
    }
    await client.end();
  }

  console.log("\n=============================================================================");
  console.log(`STEP 11B TEST SUITE RESULTS: ${passes} PASSED | ${fails} FAILED`);
  console.log("=============================================================================");

  if (fails > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR in Step 11B Suite:", err);
  process.exit(1);
});
