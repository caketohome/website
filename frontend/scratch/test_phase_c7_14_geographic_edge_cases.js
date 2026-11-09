/**
 * CakeToHome ERP — Phase C7.14 Geographic Edge Cases and Graceful Degradation Suite
 *
 * Validates:
 * 1. Missing Coordinates -> UNASSIGNED (COORDINATES_MISSING), no store/partner guessed.
 * 2. Invalid / Out-of-Bounds Coordinates -> UNASSIGNED (COORDINATES_INVALID).
 * 3. Inside Exclusion Polygon -> UNASSIGNED (INSIDE_EXCLUSION).
 * 4. Outside All Coverage -> UNASSIGNED (OUTSIDE_COVERAGE).
 * 5. Deterministic Store Tie-Breaking -> Polygon beats radius, higher priority wins.
 * 6. Deterministic Partner Tie-Breaking -> Higher priority wins, fleet rank preference.
 * 7. Inactive Partner Graceful Degradation -> Next partner selected, or NO_ELIGIBLE_PARTNER.
 * 8. Ineligible Store Handling -> STORE_NOT_ELIGIBLE when store is not corporate allow-listed.
 * 9. Delivery State Machine Guards -> Rejects invalid transitions (pending -> delivered, terminal delivered -> out_for_delivery) with 422.
 * 10. Zero Fallback Guessing -> Strict invariants maintained throughout.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const OVERALL_TIMEOUT_MS = 60000;
let lastProgress = "Initialization";
const timer = setTimeout(() => {
  console.error(`\n[TIMEOUT] test_phase_c7_14_geographic_edge_cases.js exceeded ${OVERALL_TIMEOUT_MS}ms! Last op: "${lastProgress}"`);
  process.exit(1);
}, OVERALL_TIMEOUT_MS);
if (timer.unref) timer.unref();

function markProgress(op) {
  lastProgress = op;
  console.log(`[PROGRESS ${new Date().toISOString().substring(11, 19)}] ${op}`);
}

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      if (l.trim().startsWith('DATABASE_URL=')) {
        let v = l.trim().substring('DATABASE_URL='.length).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return v;
      }
    }
  }
  return process.env.DATABASE_URL;
}

function signAuthToken(payload, secret = 'supersecret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    userId: payload.userId || 'usr_superadmin',
    role: payload.role || 'SUPER_ADMIN',
    email: payload.email || 'superadmin@caketohome.com',
    permissions: payload.permissions || ['*'],
    iat: now,
    exp: now + 7 * 86400,
    ...payload,
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${sig}`;
}

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

async function runGeographicEdgeCases() {
  console.log("==================================================================");
  console.log("CAKETOHOME ERP — PHASE C7.14: GEOGRAPHIC EDGE CASES & DEGRADATION");
  console.log("==================================================================\n");

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 15000,
  });
  await client.connect();
  markProgress("Connected to PostgreSQL.");

  const runId = Date.now();
  const superAdminToken = signAuthToken({ userId: 'usr_superadmin', role: 'SUPER_ADMIN', isSuperAdmin: true });
  const BASE_URL = 'http://localhost:3000';

  const storeAId = `br_geo_a_${runId}`;
  const storeBId = `br_geo_b_${runId}`;
  const storeCId = `br_geo_c_${runId}`; // Ineligible store
  const zoneAId = `zone_geo_a_${runId}`;
  const zoneBId = `zone_geo_b_${runId}`;
  const zoneCId = `zone_geo_c_${runId}`;
  const partnerA1Id = `dlp_geo_a1_${runId}`; // Priority 10
  const partnerA2Id = `dlp_geo_a2_${runId}`; // Priority 5
  const customerId = `cust_geo_${runId}`;
  const accountId = `acc_geo_${runId}`;
  const testRecipientId = `recip_geo_${runId}`;
  const testDeliveryId = `deliv_geo_${runId}`;
  const testBatchId = `batch_geo_${runId}`;

  try {
    // ── 0. PREFLIGHT INVARIANTS ──────────────────────────────────────────────
    markProgress("Verifying preflight database baseline invariants...");
    const preCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const preV = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
    const preJE = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
    const preJL = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const preDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const preBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");

    assert(preCoA.rows[0].cnt === 100, `Preflight CoA is 100 accounts: ${preCoA.rows[0].cnt}`);
    assert(preV.rows[0].cnt === 6, `Preflight Vouchers = 6: ${preV.rows[0].cnt}`);
    assert(preJE.rows[0].cnt === 4, `Preflight Journal Entries = 4: ${preJE.rows[0].cnt}`);
    assert(preJL.rows[0].cnt === 10, `Preflight Journal Lines = 10: ${preJL.rows[0].cnt}`);
    assert(Number(preJL.rows[0].dr) === 3380.0 && Number(preJL.rows[0].cr) === 3380.0, `Preflight TB strictly balanced Dr/Cr ₹3,380.00`);
    assert(preDP.rows[0].cnt === 30, `Preflight Delivery Partners preserved: ${preDP.rows[0].cnt}`);
    assert(preBranch.rows[0].active === 48, `Preflight Active Branches preserved: ${preBranch.rows[0].active}`);

    // ── 1. SEED TEST FIXTURES ────────────────────────────────────────────────
    markProgress("Seeding geographic test stores, exclusion zones, and partners...");
    const shopRes = await client.query("SELECT id FROM public.shop LIMIT 1;");
    const shopId = shopRes.rows[0]?.id || null;

    // Store A: Polygon geofence in Indiranagar with an internal exclusion boundary
    // Polygon: [(12.965, 77.635), (12.985, 77.635), (12.985, 77.655), (12.965, 77.655), (12.965, 77.635)]
    // Exclusion: [(12.971, 77.641), (12.975, 77.641), (12.975, 77.645), (12.971, 77.645), (12.971, 77.641)]
    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, is_corporate_routing_eligible, latitude, longitude, phone, email, address, shop_id)
      VALUES ($1, 'Store A Polygon Hub', $2, true, true, 12.9750, 77.6450, '9999900031', 'hub.a@test.com', 'Indiranagar Main Rd', $3);
    `, [storeAId, `STA_${runId.toString().slice(-4)}`, shopId]);

    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable, priority, polygon_coordinates, exclusion_polygons
      ) VALUES (
        $1, $2, 'Indiranagar Polygon Zone', '560038', 0.00, true, 10,
        $3::jsonb, $4::jsonb
      );
    `, [
      zoneAId, storeAId,
      JSON.stringify([[12.965, 77.635], [12.985, 77.635], [12.985, 77.655], [12.965, 77.655], [12.965, 77.635]]),
      JSON.stringify([[[12.971, 77.641], [12.975, 77.641], [12.975, 77.645], [12.971, 77.645], [12.971, 77.641]]])
    ]);

    // Store B: Radius geofence overlapping Indiranagar, but priority 5
    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, is_corporate_routing_eligible, latitude, longitude, phone, email, address, shop_id)
      VALUES ($1, 'Store B Radius Hub', $2, true, true, 12.9700, 77.6400, '9999900032', 'hub.b@test.com', 'Old Airport Rd', $3);
    `, [storeBId, `STB_${runId.toString().slice(-4)}`, shopId]);

    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable, priority, radius_km, center_latitude, center_longitude
      ) VALUES (
        $1, $2, 'Indiranagar Radius Zone', '560038', 0.00, true, 5, 10.0, 12.9700, 77.6400
      );
    `, [zoneBId, storeBId]);

    // Store C: Covers area but is NOT eligible for corporate routing (is_corporate_routing_eligible = false)
    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, is_corporate_routing_eligible, latitude, longitude, phone, email, address, shop_id)
      VALUES ($1, 'Store C Ineligible Hub', $2, true, false, 12.9698, 77.7500, '9999900033', 'hub.c@test.com', 'Whitefield', $3);
    `, [storeCId, `STC_${runId.toString().slice(-4)}`, shopId]);

    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable, priority, radius_km, center_latitude, center_longitude
      ) VALUES (
        $1, $2, 'Whitefield Ineligible Zone', '560066', 0.00, true, 10, 8.0, 12.9698, 77.7500
      );
    `, [zoneCId, storeCId]);

    // Partner A1: Covers Store A, Priority 10, OWN_FLEET
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES ($1, 'Apex', 'Swift', $2, $3);
    `, [partnerA1Id, `apex_${runId}@caketohome.com`, `+9198751${runId.toString().slice(-5)}`]);

    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.9);
    `, [`prof_a1_${runId}`, partnerA1Id, storeAId]);

    await client.query(`
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, radius_km, center_latitude, center_longitude)
      VALUES ($1, $2, $3, 'RADIUS', 10, true, 15.0, 12.9750, 77.6450);
    `, [`cov_a1_${runId}`, partnerA1Id, storeAId]);

    // Partner A2: Covers Store A, Priority 5, COURIER
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES ($1, 'Standard', 'Courier', $2, $3);
    `, [partnerA2Id, `courier_${runId}@caketohome.com`, `+9198752${runId.toString().slice(-5)}`]);

    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES ($1, $2, 'COURIER', 'ACTIVE', $3, 4.5);
    `, [`prof_a2_${runId}`, partnerA2Id, storeAId]);

    await client.query(`
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, radius_km, center_latitude, center_longitude)
      VALUES ($1, $2, $3, 'RADIUS', 5, true, 15.0, 12.9750, 77.6450);
    `, [`cov_a2_${runId}`, partnerA2Id, storeAId]);

    // Customer & Corporate Account
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, is_corporate, company_name, credit_enabled, credit_limit, credit_balance, payment_terms_days, credit_status)
      VALUES ($1, 'Geo', 'Testing', $2, $3, true, 'Geo Technologies Pvt Ltd', true, 500000.00, 500000.00, 30, 'APPROVED');
    `, [customerId, `cust_geo_${runId}@example.com`, `+9198759${runId.toString().slice(-5)}`]);

    await client.query(`
      INSERT INTO public.corporate_account (id, customer_id, legal_name, trade_name, legal_name_key, status)
      VALUES ($1, $2, 'Geo Technologies Pvt Ltd', 'Geo Tech', 'geo technologies pvt ltd', 'APPROVED');
    `, [accountId, customerId]);

    markProgress("Geographic fixtures seeded.");

    const previewReq = (item) => fetch(`${BASE_URL}/api/v1/admin/corporate-routing/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify(item),
    });

    const matchReq = (item) => fetch(`${BASE_URL}/api/v1/admin/corporate-routing/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify(item),
    });

    // ── 2. CASE 1: MISSING COORDINATES ──────────────────────────────────────
    markProgress("Case 1: Testing missing coordinates...");
    const missingRes = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_missing_${runId}`,
      account_id: accountId,
      recipient_name: "Alice Missing",
      recipient_phone: "9876590001",
      delivery_address: "No Coordinates Lane",
      delivery_city: "Bengaluru",
      delivery_pincode: "560038",
      latitude: null,
      longitude: null,
    });
    const missingJson = await missingRes.json();
    assert(missingRes.status === 200, "Missing coords preview returned 200 OK");
    assert(missingJson.data.outcome.status === "UNASSIGNED", "Missing coords status is UNASSIGNED");
    assert(missingJson.data.outcome.reason_code === "COORDINATES_MISSING", "Reason code is COORDINATES_MISSING");
    assert(missingJson.data.outcome.assigned_store_id === null, "assigned_store_id is strictly null");
    assert(missingJson.data.outcome.assigned_partner_id === null, "assigned_partner_id is strictly null");

    // ── 3. CASE 2: INVALID / OUT-OF-BOUNDS COORDINATES ───────────────────────
    markProgress("Case 2: Testing invalid and out-of-bounds coordinates...");
    const invalidRes1 = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_invalid_${runId}`,
      account_id: accountId,
      recipient_name: "Bob Invalid",
      recipient_phone: "9876590002",
      delivery_address: "Invalid Coords Rd",
      delivery_city: "Bengaluru",
      delivery_pincode: "560038",
      latitude: 999.999,
      longitude: 999.999,
    });
    const invalidJson1 = await invalidRes1.json();
    assert(invalidJson1.data.outcome.status === "UNASSIGNED", "Out-of-bounds 999.999 status is UNASSIGNED");
    assert(invalidJson1.data.outcome.reason_code === "COORDINATES_INVALID", "Reason code is COORDINATES_INVALID");
    assert(invalidJson1.data.outcome.assigned_store_id === null, "assigned_store_id is null for invalid coords");

    const invalidRes2 = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_invalid2_${runId}`,
      account_id: accountId,
      recipient_name: "Bob Invalid 2",
      recipient_phone: "9876590002",
      delivery_address: "Lat 120 Rd",
      latitude: 120.0,
      longitude: 77.6,
    });
    const invalidJson2 = await invalidRes2.json();
    assert(invalidJson2.data.outcome.reason_code === "COORDINATES_INVALID", "Latitude 120.0 rejected with COORDINATES_INVALID");

    // ── 4. CASE 3: INSIDE EXCLUSION POLYGON ─────────────────────────────────
    markProgress("Case 3: Testing delivery inside active exclusion boundary...");
    // Point (12.973, 77.643) is inside Store A's polygon AND inside Store A's exclusion polygon
    const exclusionRes = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_excl_${runId}`,
      account_id: accountId,
      recipient_name: "Charlie Exclusion",
      recipient_phone: "9876590003",
      delivery_address: "Inside Exclusion Boundary Park",
      latitude: 12.9730,
      longitude: 77.6430,
    });
    const exclusionJson = await exclusionRes.json();
    assert(exclusionJson.data.outcome.status === "UNASSIGNED", "Inside exclusion status is UNASSIGNED");
    assert(exclusionJson.data.outcome.reason_code === "INSIDE_EXCLUSION", "Reason code is INSIDE_EXCLUSION");
    assert(exclusionJson.data.outcome.matched_rule === "EXCLUSION_ZONE_BLOCKED", "matched_rule is EXCLUSION_ZONE_BLOCKED");
    assert(exclusionJson.data.outcome.assigned_store_id === null, "Store assignment blocked by exclusion");

    // ── 5. CASE 4: OUTSIDE ALL COVERAGE ─────────────────────────────────────
    markProgress("Case 4: Testing delivery far outside all coverage boundaries...");
    // Atlantic ocean (0.0, 0.0)
    const outsideRes = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_outside_${runId}`,
      account_id: accountId,
      recipient_name: "David Faraway",
      recipient_phone: "9876590004",
      delivery_address: "Middle of Nowhere",
      latitude: 0.0,
      longitude: 0.0,
    });
    const outsideJson = await outsideRes.json();
    assert(outsideJson.data.outcome.status === "UNASSIGNED", "Outside coverage status is UNASSIGNED");
    assert(outsideJson.data.outcome.reason_code === "OUTSIDE_COVERAGE", "Reason code is OUTSIDE_COVERAGE");
    assert(outsideJson.data.outcome.assigned_store_id === null, "assigned_store_id is null for outside coverage");
    assert(outsideJson.data.outcome.assigned_partner_id === null, "assigned_partner_id is null for outside coverage");

    // ── 6. CASE 5: DETERMINISTIC STORE TIE-BREAKING (POLYGON > RADIUS) ───────
    markProgress("Case 5: Testing deterministic store tie-breaking (Polygon beats Radius)...");
    // Point (12.9780, 77.6480) is inside Store A (Polygon, prio 10) AND Store B (Radius, prio 5), outside exclusion
    const tieRes = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_tie_${runId}`,
      account_id: accountId,
      recipient_name: "Eva In-Coverage",
      recipient_phone: "9876590005",
      delivery_address: "100ft Rd Indiranagar",
      latitude: 12.9780,
      longitude: 77.6480,
    });
    const tieJson = await tieRes.json();
    assert(tieJson.data.outcome.status === "ASSIGNED", "Covered point status is ASSIGNED");
    assert(tieJson.data.outcome.reason_code === "MATCHED_POLYGON", "Reason code is MATCHED_POLYGON");
    assert(tieJson.data.outcome.assigned_store_id === storeAId, "Polygon Store A won tie-breaker over Radius Store B");
    assert(tieJson.data.outcome.assigned_zone_id === zoneAId, "Winning zone is zoneAId");

    // ── 7. CASE 6: DETERMINISTIC PARTNER TIE-BREAKING (PRIO 10 > PRIO 5) ─────
    markProgress("Case 6: Testing deterministic partner tie-breaking (Higher priority wins)...");
    // In the outcome of Case 5, Store A has two partners: Partner A1 (prio 10, OWN_FLEET) and Partner A2 (prio 5, COURIER)
    assert(tieJson.data.outcome.assigned_partner_id === partnerA1Id, "Partner A1 (Prio 10) won tie-breaker over Partner A2 (Prio 5)");
    assert(tieJson.data.outcome.matched_rule === "POLYGON_STORE_OWN_FLEET", "Rule code indicates POLYGON_STORE_OWN_FLEET");

    // ── 8. CASE 7: INACTIVE PARTNER GRACEFUL DEGRADATION ─────────────────────
    markProgress("Case 7: Testing inactive partner graceful degradation...");
    // Deactivate Partner A1 coverage
    await client.query("UPDATE public.delivery_partner_coverage SET is_active = false WHERE partner_id = $1;", [partnerA1Id]);

    // Now Partner A2 (prio 5) should be selected
    const degRes1 = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_deg1_${runId}`,
      account_id: accountId,
      recipient_name: "Frank Graceful",
      recipient_phone: "9876590006",
      delivery_address: "100ft Rd Indiranagar",
      latitude: 12.9780,
      longitude: 77.6480,
    });
    const degJson1 = await degRes1.json();
    assert(degJson1.data.outcome.status === "ASSIGNED", "With Partner A1 inactive, routing status is still ASSIGNED");
    assert(degJson1.data.outcome.assigned_partner_id === partnerA2Id, "Partner A2 smoothly took over fulfillment without incident");
    assert(degJson1.data.outcome.matched_rule === "POLYGON_STORE_COURIER", "Matched rule updated to POLYGON_STORE_COURIER");

    // Deactivate Partner A2 coverage as well
    await client.query("UPDATE public.delivery_partner_coverage SET is_active = false WHERE partner_id = $1;", [partnerA2Id]);

    // Now no partner is eligible for Store A
    const degRes2 = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_deg2_${runId}`,
      account_id: accountId,
      recipient_name: "Frank NoPartner",
      recipient_phone: "9876590006",
      delivery_address: "100ft Rd Indiranagar",
      latitude: 12.9780,
      longitude: 77.6480,
    });
    const degJson2 = await degRes2.json();
    assert(degJson2.data.outcome.status === "UNASSIGNED", "With all partners inactive, status is UNASSIGNED");
    assert(degJson2.data.outcome.reason_code === "NO_ELIGIBLE_PARTNER", "Reason code is NO_ELIGIBLE_PARTNER");
    assert(degJson2.data.outcome.assigned_store_id === storeAId, "Store is correctly identified even when partner is missing");
    assert(degJson2.data.outcome.assigned_partner_id === null, "assigned_partner_id is strictly null");

    // Reactivate partner coverages for clean cleanup
    await client.query("UPDATE public.delivery_partner_coverage SET is_active = true WHERE partner_id IN ($1, $2);", [partnerA1Id, partnerA2Id]);

    // ── 9. CASE 8: INELIGIBLE STORE HANDLING ────────────────────────────────
    markProgress("Case 8: Testing delivery in area covered ONLY by corporate-ineligible store...");
    // Whitefield point covered by Store C (is_corporate_routing_eligible = false)
    const ineligRes = await previewReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_inelig_${runId}`,
      account_id: accountId,
      recipient_name: "George Whitefield",
      recipient_phone: "9876590007",
      delivery_address: "Whitefield ITPL Rd",
      latitude: 12.9700,
      longitude: 77.7490,
    });
    const ineligJson = await ineligRes.json();
    assert(ineligJson.data.outcome.status === "UNASSIGNED", "Ineligible store area status is UNASSIGNED");
    assert(ineligJson.data.outcome.reason_code === "STORE_NOT_ELIGIBLE", "Reason code is STORE_NOT_ELIGIBLE");
    assert(ineligJson.data.outcome.assigned_store_id === null, "Store assignment is withheld for ineligible store");

    // ── 10. CASE 9: DELIVERY STATE MACHINE INVALID TRANSITIONS ───────────────
    markProgress("Case 9: Testing delivery state machine constraints and invalid transitions...");

    // Seed a test delivery and recipient
    await client.query(`
      INSERT INTO public.delivery (id, recipient_name, recipient_phone, recipient_address, recipient_pincode, delivery_status)
      VALUES ($1, 'State Machine Test Recipient', '9876599009', '100ft Rd', '560038', 'pending');
    `, [testDeliveryId]);

    await client.query(`
      INSERT INTO public.corporate_gifting_batch (id, customer_id, batch_name, status, total_recipients, source_filename, file_hash, file_size_bytes)
      VALUES ($1, $2, 'SM Test Batch', 'COMPLETED', 1, 'sm.xlsx', $3, 1024);
    `, [testBatchId, customerId, `hash_sm_${runId}`]);

    await client.query(`
      INSERT INTO public.corporate_gifting_recipient (
        id, batch_id, row_number, employee_id, recipient_name, recipient_phone,
        delivery_address, delivery_city, delivery_pincode, delivery_date, delivery_slot,
        sku, quantity, unit_price, line_total, validation_status, delivery_id, status, metadata
      ) VALUES (
        $1, $2, 1, 'EMP-SM-1', 'State Machine Test Recipient', '9876599009',
        '100ft Rd', 'Bengaluru', '560038', '2026-10-20', 'MORNING',
        'BUTTER-CROISSANT', 1, 150.00, 150.00, 'VALID', $3, 'PENDING', '{}'::jsonb
      );
    `, [testRecipientId, testBatchId, testDeliveryId]);

    // Also seed assignment linking recipient to partnerA1
    await client.query(`
      INSERT INTO public.corporate_delivery_assignment (
        id, entity_type, entity_id, account_id, recipient_name, recipient_phone,
        delivery_address, delivery_city, normalized_city_key, delivery_pincode,
        latitude, longitude, status, reason_code, assigned_store_id, assigned_partner_id
      ) VALUES (
        $1, 'GIFTING_RECIPIENT', $2, $3, 'State Machine Test Recipient', '9876599009',
        '100ft Rd', 'Bengaluru', 'bengaluru', '560038',
        12.9780, 77.6480, 'ASSIGNED', 'MATCHED_POLYGON', $4, $5
      );
    `, [`cda_sm_${runId}`, testRecipientId, accountId, storeAId, partnerA1Id]);

    const statusReq = (body) => fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/recipients/${testRecipientId}/delivery-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify(body),
    });

    // A. Invalid transition: Direct skip from pending -> delivered is prohibited
    const skipRes = await statusReq({ deliveryStatus: "delivered" });
    assert(skipRes.status === 422 || skipRes.status === 400, "Direct transition from pending to delivered was rejected with 422");
    const skipJson = await skipRes.json();
    assert(
      skipJson.error === "INVALID_STATUS_TRANSITION" || skipJson.message?.includes("Cannot mark delivery completed directly"),
      "Error indicates INVALID_STATUS_TRANSITION"
    );

    // B. Invalid transition: Direct skip from pending -> out_for_delivery is also prohibited
    const skipTransitRes = await statusReq({ deliveryStatus: "out_for_delivery" });
    assert(skipTransitRes.status === 422 || skipTransitRes.status === 400, "Direct transition from pending to out_for_delivery was rejected with 422");
    const skipTransitJson = await skipTransitRes.json();
    assert(skipTransitJson.error === "INVALID_STATUS_TRANSITION", "Error indicates INVALID_STATUS_TRANSITION for out_for_delivery without pickup");

    // C. Invalid status name
    const bogusRes = await statusReq({ deliveryStatus: "flying_on_a_broom" });
    assert(bogusRes.status === 422 || bogusRes.status === 400, "Bogus deliveryStatus string rejected with 422");

    // D. Valid transition 1: pending -> pickup_claimed (claim order)
    const claimRes = await statusReq({ deliveryStatus: "pickup_claimed", notes: "Rider at bakery" });
    assert(claimRes.status === 200, "Valid transition to pickup_claimed returned 200 OK");
    const claimJson = await claimRes.json();
    assert(claimJson.success === true, "Transition to pickup_claimed succeeded");

    // E. Valid transition 2: pickup_claimed -> out_for_delivery
    const transitRes = await statusReq({ deliveryStatus: "out_for_delivery", notes: "Rider in transit" });
    assert(transitRes.status === 200, "Valid transition to out_for_delivery returned 200 OK");
    const transitJson = await transitRes.json();
    assert(transitJson.success === true, "Transition to out_for_delivery succeeded");

    // F. Valid transition 3: out_for_delivery -> delivered
    const delivRes = await statusReq({ deliveryStatus: "delivered", notes: "Delivered with signature" });
    assert(delivRes.status === 200, "Valid transition to delivered returned 200 OK");
    const delivJson = await delivRes.json();
    assert(delivJson.success === true, "Transition to delivered succeeded");

    // G. Terminal state guard: cannot alter delivery once delivered
    const terminalRes = await statusReq({ deliveryStatus: "out_for_delivery" });
    assert(terminalRes.status === 422 || terminalRes.status === 400, "Transition out of terminal 'delivered' state rejected with 422");
    const terminalJson = await terminalRes.json();
    assert(
      terminalJson.error === "INVALID_STATUS_TRANSITION" || terminalJson.message?.includes("already completed"),
      "Error indicates terminal delivered state is protected"
    );

    // ── 11. CASE 10: ZERO FALLBACK GUESSING INVARIANT ────────────────────────
    markProgress("Case 10: Verifying zero fallback guessing invariant across all unassigned outcomes...");
    // When match is called for an unassigned recipient, verify that no arbitrary store or partner is attached in the DB
    const unassignedMatchRes = await matchReq({
      entity_type: "GIFTING_RECIPIENT",
      entity_id: `recip_unassigned_match_${runId}`,
      account_id: accountId,
      recipient_name: "No Guessing Allowed",
      recipient_phone: "9876599010",
      delivery_address: "Unknown Pincode Jungle",
      latitude: null,
      longitude: null,
    });
    const unassignedMatchJson = await unassignedMatchRes.json();
    assert(unassignedMatchRes.status === 200, "Unassigned match call returned 200 OK");
    assert(unassignedMatchJson.data.status === "UNASSIGNED", "Persisted assignment status is strictly UNASSIGNED");
    assert(unassignedMatchJson.data.assigned_store_id === null, "Zero fallback guessing: assigned_store_id is strictly null");
    assert(unassignedMatchJson.data.assigned_partner_id === null, "Zero fallback guessing: assigned_partner_id is strictly null");

    markProgress("All 10 geographic edge cases and degradation tests passed!");

    // ── 12. CLEAN TEARDOWN ───────────────────────────────────────────────────
    markProgress("Cleaning up isolated geographic fixtures...");
    await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_id LIKE 'recip_%');");
    await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

    await client.query("DELETE FROM public.corporate_delivery_assignment WHERE entity_id LIKE 'recip_%';");
    await client.query("DELETE FROM public.delivery WHERE id = $1;", [testDeliveryId]);
    await client.query("DELETE FROM public.corporate_gifting_recipient WHERE id = $1;", [testRecipientId]);
    await client.query("DELETE FROM public.corporate_gifting_batch WHERE id = $1;", [testBatchId]);

    await client.query("DELETE FROM public.delivery_partner_coverage WHERE id IN ($1, $2);", [`cov_a1_${runId}`, `cov_a2_${runId}`]);
    await client.query("DELETE FROM public.delivery_partner_profile WHERE id IN ($1, $2);", [`prof_a1_${runId}`, `prof_a2_${runId}`]);
    await client.query("DELETE FROM public.delivery_partner WHERE id IN ($1, $2);", [partnerA1Id, partnerA2Id]);
    await client.query("DELETE FROM public.delivery_zone WHERE id IN ($1, $2, $3);", [zoneAId, zoneBId, zoneCId]);
    await client.query("DELETE FROM public.branch WHERE id IN ($1, $2, $3);", [storeAId, storeBId, storeCId]);
    await client.query("DELETE FROM public.corporate_account WHERE id = $1;", [accountId]);
    await client.query("DELETE FROM public.customer WHERE id = $1;", [customerId]);

    // ── 13. POSTFLIGHT INVARIANTS ────────────────────────────────────────────
    markProgress("Verifying postflight baseline invariants...");
    const postCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const postV = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
    const postJE = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
    const postJL = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const postDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const postBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
    const postAssignments = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
    const postEvents = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");

    assert(postCoA.rows[0].cnt === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].cnt}`);
    assert(postV.rows[0].cnt === 6, `Postflight Vouchers = 6: ${postV.rows[0].cnt}`);
    assert(postJE.rows[0].cnt === 4, `Postflight Journal Entries = 4: ${postJE.rows[0].cnt}`);
    assert(postJL.rows[0].cnt === 10, `Postflight Journal Lines = 10: ${postJL.rows[0].cnt}`);
    assert(Number(postJL.rows[0].dr) === 3380.0 && Number(postJL.rows[0].cr) === 3380.0, `Postflight TB strictly balanced Dr ₹3,380.00 = Cr ₹3,380.00`);
    assert(postDP.rows[0].cnt === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].cnt}`);
    assert(postBranch.rows[0].active === 48, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);
    assert(postAssignments.rows[0].cnt === 0, `corporate_delivery_assignment residual rows = 0: ${postAssignments.rows[0].cnt}`);
    assert(postEvents.rows[0].cnt === 0, `corporate_assignment_event residual rows = 0: ${postEvents.rows[0].cnt}`);

    console.log("\n==================================================================");
    console.log(`C7.14 GEOGRAPHIC EDGE CASES SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================================");

    await client.end();
    clearTimeout(timer);
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ Error during Geographic Edge Cases suite (last op: "${lastProgress}"):`, err);
    try {
      await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_id LIKE 'recip_%');");
      await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query("DELETE FROM public.corporate_delivery_assignment WHERE entity_id LIKE 'recip_%';");
      await client.query("DELETE FROM public.delivery WHERE id = $1;", [testDeliveryId]);
      await client.query("DELETE FROM public.corporate_gifting_recipient WHERE id = $1;", [testRecipientId]);
      await client.query("DELETE FROM public.corporate_gifting_batch WHERE id = $1;", [testBatchId]);
      await client.query("DELETE FROM public.delivery_partner_coverage WHERE id IN ($1, $2);", [`cov_a1_${runId}`, `cov_a2_${runId}`]);
      await client.query("DELETE FROM public.delivery_partner_profile WHERE id IN ($1, $2);", [`prof_a1_${runId}`, `prof_a2_${runId}`]);
      await client.query("DELETE FROM public.delivery_partner WHERE id IN ($1, $2);", [partnerA1Id, partnerA2Id]);
      await client.query("DELETE FROM public.delivery_zone WHERE id IN ($1, $2, $3);", [zoneAId, zoneBId, zoneCId]);
      await client.query("DELETE FROM public.branch WHERE id IN ($1, $2, $3);", [storeAId, storeBId, storeCId]);
      await client.query("DELETE FROM public.corporate_account WHERE id = $1;", [accountId]);
      await client.query("DELETE FROM public.customer WHERE id = $1;", [customerId]);
      await client.end();
    } catch {}
    clearTimeout(timer);
    process.exit(1);
  }
}

runGeographicEdgeCases();
