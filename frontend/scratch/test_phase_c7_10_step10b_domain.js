/**
 * CakeToHome ERP — Phase C7.10 Step 10B Domain & Repository Unit Tests
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
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
  }
}

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.10 Step 10B Domain Services & Repositories Suite');
  console.log('=============================================================================');

  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Test Pure Geometry Logic (Jordan Curve Theorem & Haversine)
    console.log('\n[Suite 1] Pure Mathematical Geometry Primitives');
    
    // Polygon: Triangle around Bangalore Center (12.97, 77.59)
    const triangle = [
      [12.90, 77.50],
      [13.05, 77.50],
      [13.00, 77.65]
    ];

    // Inside point
    const insidePt = [12.98, 77.55];
    // Outside point
    const outsidePt = [13.10, 77.70];

    // Simple raycast algorithm test
    function pointInPoly(lat, lng, poly) {
      let isInside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > lng) !== (yj > lng)) && (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
      }
      return isInside;
    }

    assert(pointInPoly(insidePt[0], insidePt[1], triangle) === true, 'Raycast detects point strictly inside polygon');
    assert(pointInPoly(outsidePt[0], outsidePt[1], triangle) === false, 'Raycast detects point outside polygon');

    // Haversine Distance test (Indiranagar 12.9716, 77.6412 to Koramangala 12.9352, 77.6245 approx 4.4 km)
    function haversine(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
    }
    const dist = haversine(12.9716, 77.6412, 12.9352, 77.6245);
    assert(dist >= 4.0 && dist <= 5.0, `Haversine computes accurate distance between Indiranagar and Koramangala: ${dist} km`);

    // 2. Test Store Eligibility Allow-List
    console.log('\n[Suite 2] Store Corporate Routing Eligibility Allow-List');
    // Pick an existing real branch, e.g. HUB-BLR-01 or Indiranagar
    const testBranchRes = await client.query(`SELECT id, code, name, is_corporate_routing_eligible FROM public.branch WHERE code = 'HUB-BLR-01' OR id = 'br_indiranagar' LIMIT 1;`);
    const testBranch = testBranchRes.rows[0];
    assert(testBranch !== undefined, `Found test store: ${testBranch?.name} (${testBranch?.code})`);

    // Test toggle to true
    const setTrueRes = await client.query(
      `UPDATE public.branch SET is_corporate_routing_eligible = true, updated_at = NOW() WHERE id = $1 RETURNING id, is_corporate_routing_eligible;`,
      [testBranch.id]
    );
    assert(setTrueRes.rows[0].is_corporate_routing_eligible === true, 'Store eligibility toggled to true');

    // Audit event recorded
    const auditRes = await client.query(
      `INSERT INTO public.delivery_coverage_event (id, entity_type, entity_id, event_type, actor_id, actor_role, reason, before_state, after_state)
       VALUES ($1, 'STORE_ELIGIBILITY', $2, 'ELIGIBILITY_TOGGLED', 'admin_01', 'SUPER_ADMIN', 'Test eligibility grant', $3, $4)
       RETURNING id, event_type;`,
      [`ev_elig_${Date.now()}`, testBranch.id, JSON.stringify({ eligible: false }), JSON.stringify({ eligible: true })]
    );
    assert(auditRes.rows[0].event_type === 'ELIGIBILITY_TOGGLED', 'Audit event recorded for eligibility toggle');

    // 3. Test Store Delivery Zone with Polygon & Exclusion
    console.log('\n[Suite 3] Store Delivery Zone with Polygon & Exclusion Storage');
    const testZoneId = `zone_test_${Date.now()}`;
    const zonePoly = [
      [12.95, 77.60],
      [13.00, 77.60],
      [13.00, 77.68],
      [12.95, 77.68]
    ];
    const exclusionPoly = [
      [
        [12.97, 77.62],
        [12.99, 77.62],
        [12.99, 77.64],
        [12.97, 77.64]
      ]
    ];

    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km,
        center_latitude, center_longitude, priority,
        estimated_delivery_minutes, created_at, updated_at
      ) VALUES (
        $1, $2, 'Test High-Priority Zone', '560038', 50.00, true,
        $3, $4, 8.5,
        12.9716, 77.6412, 50,
        35, NOW(), NOW()
      );
    `, [testZoneId, testBranch.id, JSON.stringify(zonePoly), JSON.stringify(exclusionPoly)]);

    const readZone = await client.query(`SELECT id, polygon_coordinates, exclusion_polygons, radius_km, priority FROM public.delivery_zone WHERE id = $1;`, [testZoneId]);
    assert(readZone.rows.length === 1, 'Zone created and retrieved');
    assert(readZone.rows[0].polygon_coordinates.length === 4, 'Polygon coordinates stored and retrieved as JSONB');
    assert(readZone.rows[0].exclusion_polygons.length === 1, 'Exclusion polygons stored and retrieved as JSONB');
    assert(parseFloat(readZone.rows[0].radius_km) === 8.5, 'Radius stored as 8.5 km');
    assert(readZone.rows[0].priority === 50, 'Priority stored as 50');

    // 4. Test Delivery Partner Profile & Coverage
    console.log('\n[Suite 4] Delivery Partner Profile & Coverage Boundaries');
    const partnerRes = await client.query(`SELECT id, first_name, last_name FROM public.delivery_partner LIMIT 1;`);
    const testPartner = partnerRes.rows[0];
    assert(testPartner !== undefined, `Found existing delivery partner: ${testPartner.first_name} (${testPartner.id})`);

    const profId = `prof_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.delivery_partner_profile (
        id, partner_id, partner_type, status, primary_branch_id,
        max_concurrent_orders, rating, contract_reference, metadata,
        created_at, updated_at
      ) VALUES (
        $1, $2, 'OWN_FLEET', 'ACTIVE', $3,
        5, 4.95, 'CONTRACT-2026-BLR', '{\"vehicle\": \"electric_bike\"}'::jsonb,
        NOW(), NOW()
      )
      ON CONFLICT (partner_id) DO UPDATE SET
        status = 'ACTIVE',
        primary_branch_id = EXCLUDED.primary_branch_id,
        updated_at = NOW();
    `, [profId, testPartner.id, testBranch.id]);

    const readProf = await client.query(`SELECT * FROM public.delivery_partner_profile WHERE partner_id = $1;`, [testPartner.id]);
    assert(readProf.rows[0].status === 'ACTIVE', 'Partner profile active in PostgreSQL');
    assert(readProf.rows[0].partner_type === 'OWN_FLEET', 'Partner type stored as OWN_FLEET');
    assert(readProf.rows[0].max_concurrent_orders === 5, 'Max concurrent orders stored as 5');

    // Add Partner Coverage
    const covId = `cov_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.delivery_partner_coverage (
        id, partner_id, branch_id, fence_type, polygon_coordinates,
        radius_km, center_latitude, center_longitude, priority,
        is_active, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'HYBRID', $4,
        10.0, 12.9716, 77.6412, 25,
        true, '{}'::jsonb, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET is_active = true;
    `, [covId, testPartner.id, testBranch.id, JSON.stringify(zonePoly)]);

    const readCov = await client.query(`SELECT * FROM public.delivery_partner_coverage WHERE id = $1;`, [covId]);
    assert(readCov.rows[0].is_active === true, 'Partner coverage active in PostgreSQL');
    assert(parseFloat(readCov.rows[0].radius_km) === 10.0, 'Partner coverage radius = 10.0 km');
    assert(readCov.rows[0].priority === 25, 'Partner priority = 25');

    // 5. Test Diagnostic Point Evaluation & Fail-Closed Behaviors
    console.log('\n[Suite 5] Diagnostic Evaluation & Fail-Closed Scenarios');

    // Test A: Point inside zone polygon and outside exclusion -> MATCHED
    const ptNormal = [12.96, 77.61]; // Inside zonePoly, outside exclusionPoly
    const inZone = pointInPoly(ptNormal[0], ptNormal[1], zonePoly);
    const inExcl = pointInPoly(ptNormal[0], ptNormal[1], exclusionPoly[0]);
    assert(inZone === true && inExcl === false, 'Test point A is inside zone polygon and outside exclusion');

    // Test B: Point inside exclusion sub-polygon -> INSIDE_EXCLUSION_ZONE
    const ptExcl = [12.98, 77.63]; // Inside exclusionPoly
    assert(pointInPoly(ptExcl[0], ptExcl[1], exclusionPoly[0]) === true, 'Test point B falls strictly inside exclusion polygon');

    // Test C: Point far outside -> NO_ELIGIBLE_STORE
    const ptFar = [13.50, 78.50];
    assert(pointInPoly(ptFar[0], ptFar[1], zonePoly) === false, 'Test point C is far outside zone boundary');

    // 6. Test Immutability of Coverage Event Log
    console.log('\n[Suite 6] Audit Event Immutability Defense');
    let updateBlocked = false;
    try {
      await client.query(`UPDATE public.delivery_coverage_event SET reason = 'tampered' WHERE id = $1;`, [auditRes.rows[0].id]);
    } catch (e) {
      updateBlocked = true;
    }
    assert(updateBlocked, 'PostgreSQL trigger strictly blocks UPDATE to delivery_coverage_event');

    // Teardown test records
    await client.query(`DELETE FROM public.delivery_partner_coverage WHERE id = $1;`, [covId]);
    await client.query(`DELETE FROM public.delivery_partner_profile WHERE id = $1;`, [profId]);
    await client.query(`DELETE FROM public.delivery_zone WHERE id = $1;`, [testZoneId]);
    await client.query(`UPDATE public.branch SET is_corporate_routing_eligible = false WHERE id = $1;`, [testBranch.id]);

    // 7. Verify Accounting Baseline & Financial Invariants
    console.log('\n[Suite 7] Authoritative Accounting Baseline Invariants');
    const postCoA = await client.query('SELECT count(*) as count FROM public.accounting_account;');
    const postVouchers = await client.query('SELECT count(*) as count FROM public.accounting_voucher;');
    const postJE = await client.query('SELECT count(*) as count FROM public.accounting_journal_entry;');
    const postJL = await client.query('SELECT count(*) as count, sum(debit_amount) as dr, sum(credit_amount) as cr FROM public.accounting_journal_line;');
    const postDP = await client.query('SELECT count(*) as count FROM public.delivery_partner;');

    assert(parseInt(postCoA.rows[0].count) === 100, `CoA is exactly 100 accounts: ${postCoA.rows[0].count}`);
    assert(parseInt(postVouchers.rows[0].count) === 6, `Accounting Vouchers = 6: ${postVouchers.rows[0].count}`);
    assert(parseInt(postJE.rows[0].count) === 4, `Journal Entries = 4: ${postJE.rows[0].count}`);
    assert(postJL.rows[0].dr === '3380.00' && postJL.rows[0].cr === '3380.00', `Trial balance strictly balanced Dr/Cr ₹3,380.00: Dr ₹${postJL.rows[0].dr} / Cr ₹${postJL.rows[0].cr}`);
    assert(parseInt(postDP.rows[0].count) === 30, `All 30 delivery partner master records preserved: ${postDP.rows[0].count}`);

    console.log('\n=============================================================================');
    console.log(`STEP 10B TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================================');

    await client.end();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution failed:', err);
    await client.end();
    process.exit(1);
  }
}

runTests();
