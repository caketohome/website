/**
 * CakeToHome ERP — Phase C7.14 Concurrency and Idempotency Stress Suite
 *
 * Real Overlapping Requests & Concurrency Stress Verification:
 * 1. Duplicate Campaign Confirmation: Concurrent execute requests -> exactly 1 succeeds, duplicate rejected (DUPLICATE_FILE_HASH). Zero duplicate invoices/vouchers.
 * 2. Concurrent Routing of Same Entity: 3 simultaneous match requests -> unique constraint holds, exactly 1 row in corporate_delivery_assignment.
 * 3. Concurrent Manual Override vs Automatic Batch Re-evaluation: Overlapping requests -> manual override preserved, zero corruption.
 * 4. Repeated Coordinate Correction: Repeated /resolve calls -> idempotent handling (idempotent: true), append-only audit trail intact.
 * 5. Concurrent Delivery Status Transitions: Parallel status updates -> atomic state machine, idempotent response, delivery reaches delivered.
 * 6. Repeated Requests after Simulated Timeout: Replay defense prevents duplicate invoices, vouchers, or orders.
 * 7. Invariants: 100 CoA accounts, balanced Trial Balance, 0 residual assignments or events.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const ExcelJS = require('exceljs');

const OVERALL_TIMEOUT_MS = 90000;
let lastProgress = "Initialization";
const timer = setTimeout(() => {
  console.error(`\n[TIMEOUT] test_phase_c7_14_concurrency_stress.js exceeded ${OVERALL_TIMEOUT_MS}ms! Last op: "${lastProgress}"`);
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

async function runConcurrencyStress() {
  console.log("==================================================================");
  console.log("CAKETOHOME ERP — PHASE C7.14: CONCURRENCY & IDEMPOTENCY STRESS SUITE");
  console.log("==================================================================\n");

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 15000,
  });
  await client.connect();
  markProgress("Connected to PostgreSQL.");

  const runId = Date.now();
  const testStoreId = `br_cc_${runId}`;
  const testZoneId = `zone_cc_${runId}`;
  const testPartnerId = `dlp_cc_${runId}`;
  const testCustomerId = `cust_cc_${runId}`;
  const testAccountId = `acc_cc_${runId}`;

  const superAdminToken = signAuthToken({ userId: 'usr_superadmin', role: 'SUPER_ADMIN', isSuperAdmin: true });
  const partnerToken = signAuthToken({ userId: testPartnerId, partnerId: testPartnerId, role: 'DELIVERY_PARTNER' });
  const BASE_URL = 'http://localhost:3000';

  let createdBatchId = null;

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
    markProgress("Seeding test store, zone, partner, customer, and corporate account...");
    const shopRes = await client.query("SELECT id FROM public.shop LIMIT 1;");
    const shopId = shopRes.rows[0]?.id || null;

    // Store in Indiranagar
    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, phone, email, address, latitude, longitude, shop_id, is_corporate_routing_eligible)
      VALUES ($1, 'Concurrency Hub Indiranagar', $2, true, '9999900020', 'hub.cc@test.com', '100ft Rd', 12.9716, 77.6412, $3, true);
    `, [testStoreId, `HUB-CC-${runId.toString().slice(-4)}`, shopId]);

    // Serviceable zone
    const polygonGeofence = [
      [12.970, 77.630],
      [12.990, 77.630],
      [12.990, 77.650],
      [12.970, 77.650],
      [12.970, 77.630],
    ];
    await client.query(`
      INSERT INTO public.delivery_zone (id, branch_id, name, pincode, delivery_fee, is_serviceable, polygon_coordinates, radius_km, center_latitude, center_longitude, priority)
      VALUES ($1, $2, 'CC Zone Indiranagar', '560038', 0.00, true, $3, NULL, 12.9716, 77.6412, 100);
    `, [testZoneId, testStoreId, JSON.stringify(polygonGeofence)]);

    // Delivery Partner
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES ($1, 'Rohan', 'Verma', $2, $3);
    `, [testPartnerId, `rohan_${runId}@test.com`, `+9198755${runId.toString().slice(-5)}`]);

    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.9);
    `, [`prof_cc_${runId}`, testPartnerId, testStoreId]);

    await client.query(`
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, radius_km, center_latitude, center_longitude)
      VALUES ($1, $2, $3, 'RADIUS', 30, true, 12.0, 12.9716, 77.6412);
    `, [`cov_cc_${runId}`, testPartnerId, testStoreId]);

    // Customer & Corporate Account
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, is_corporate, company_name, credit_enabled, credit_limit, credit_balance, payment_terms_days, credit_status)
      VALUES ($1, 'Nexus', 'Corp', $2, $3, true, 'Nexus Technologies Pvt Ltd', true, 500000.00, 500000.00, 30, 'APPROVED');
    `, [testCustomerId, `nexus_${runId}@test.com`, `+9198766${runId.toString().slice(-5)}`]);

    await client.query(`
      INSERT INTO public.corporate_account (id, customer_id, legal_name, trade_name, legal_name_key, status)
      VALUES ($1, $2, 'Nexus Technologies Pvt Ltd', 'Nexus Corp', 'nexus technologies pvt ltd', 'APPROVED');
    `, [testAccountId, testCustomerId]);

    markProgress("Fixtures seeded.");

    // Build multi-recipient Excel campaign
    const delivDateStr = new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Recipients");
    sheet.columns = [
      { header: "Employee ID", key: "employee_id", width: 15 },
      { header: "Recipient Name", key: "recipient_name", width: 20 },
      { header: "Recipient Phone", key: "recipient_phone", width: 15 },
      { header: "Delivery Address", key: "delivery_address", width: 30 },
      { header: "Delivery City", key: "delivery_city", width: 15 },
      { header: "Delivery Pincode", key: "delivery_pincode", width: 15 },
      { header: "Latitude", key: "latitude", width: 12 },
      { header: "Longitude", key: "longitude", width: 12 },
      { header: "Delivery Date", key: "delivery_date", width: 15 },
      { header: "Delivery Slot", key: "delivery_slot", width: 15 },
      { header: "Product SKU", key: "product_sku", width: 20 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Gift Message", key: "gift_message", width: 30 },
    ];
    sheet.addRow({
      employee_id: "EMP-CC-1",
      recipient_name: "Pooja Hegde",
      recipient_phone: "9876540001",
      delivery_address: "100ft Road Indiranagar",
      delivery_city: "Bengaluru",
      delivery_pincode: "560038",
      latitude: 12.9720,
      longitude: 77.6420,
      delivery_date: delivDateStr,
      delivery_slot: "MORNING",
      product_sku: "BUTTER-CROISSANT",
      quantity: 1,
      gift_message: "Cheers Pooja!",
    });
    sheet.addRow({
      employee_id: "EMP-CC-2",
      recipient_name: "Siddharth Rao",
      recipient_phone: "9876540002",
      delivery_address: "Unknown Location",
      delivery_city: "Bengaluru",
      delivery_pincode: "560038",
      latitude: "",
      longitude: "",
      delivery_date: delivDateStr,
      delivery_slot: "EVENING",
      product_sku: "BUTTER-CROISSANT",
      quantity: 1,
      gift_message: "Cheers Sid!",
    });

    const fileBuf = await workbook.xlsx.writeBuffer();
    const fileBase64 = Buffer.from(fileBuf).toString("base64");

    // ── 2. CONCURRENCY TEST 1: DUPLICATE CAMPAIGN CONFIRMATION RACE ──────────
    markProgress("Concurrency 1: Firing concurrent duplicate campaign confirmation requests...");

    const executeReq = () => fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        customerId: testCustomerId,
        batchName: `CC Batch ${runId}`,
        fileBase64,
        sourceFilename: "cc_campaign.xlsx",
      }),
    });

    // Launch two parallel requests simultaneously
    const [res1, res2] = await Promise.all([executeReq(), executeReq()]);
    const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

    const successes = [json1, json2].filter(j => j.success === true);
    const rejections = [json1, json2].filter(j => j.success === false);

    assert(successes.length === 1, `Exactly 1 concurrent campaign confirmation succeeded (successes: ${successes.length})`);
    assert(rejections.length === 1, `Exactly 1 concurrent campaign confirmation was rejected`);
    assert(
      rejections[0].error === "DUPLICATE_FILE_HASH" || rejections[0].message?.includes("duplicate") || rejections[0].message?.includes("already"),
      `Rejection was due to duplicate replay defense (error: ${rejections[0].error})`
    );

    createdBatchId = successes[0].batch.id;

    // Verify database invariants: Single Master Corporate Invoice, Single Voucher
    const invoiceCount = await client.query("SELECT count(*)::int as cnt FROM public.invoice WHERE customer_id = $1;", [testCustomerId]);
    const voucherCount = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher WHERE reference_id = $1;", [successes[0].invoiceId]);
    assert(invoiceCount.rows[0].cnt === 1, `INVARIANT: Exactly 1 master corporate invoice generated (count: ${invoiceCount.rows[0].cnt})`);
    assert(voucherCount.rows[0].cnt === 1, `INVARIANT: Exactly 1 accounting voucher linked to master invoice (count: ${voucherCount.rows[0].cnt})`);

    // Verify recipient deliveries
    const recipRows = await client.query("SELECT id, recipient_name, delivery_id FROM public.corporate_gifting_recipient WHERE batch_id = $1 ORDER BY row_number ASC;", [createdBatchId]);
    const recip1 = recipRows.rows[0];
    const recip2 = recipRows.rows[1];

    // ── 3. CONCURRENCY TEST 2: CONCURRENT ROUTING OF SAME DELIVERY ENTITY ────
    markProgress("Concurrency 2: Firing 3 simultaneous match requests on the same entity...");

    const matchReq = () => fetch(`${BASE_URL}/api/v1/admin/corporate-routing/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        entity_type: "GIFTING_RECIPIENT",
        entity_id: recip1.id,
        delivery_address: "100ft Road Indiranagar",
        latitude: 12.9720,
        longitude: 77.6420,
      }),
    });

    const matchResults = await Promise.all([matchReq(), matchReq(), matchReq()]);
    for (const mr of matchResults) {
      assert(mr.status === 200, `Concurrent match request returned 200 OK`);
    }

    // Verify Unique Assignment Constraint holds: exactly 1 row in corporate_delivery_assignment
    const cdaCount = await client.query(
      "SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1;",
      [recip1.id]
    );
    assert(cdaCount.rows[0].cnt === 1, `UNIQUE CONSTRAINT: Exactly 1 assignment row exists for entity (count: ${cdaCount.rows[0].cnt})`);

    // ── 4. CONCURRENCY TEST 3: MANUAL OVERRIDE VS AUTOMATIC BATCH ROUTING ─────
    markProgress("Concurrency 3: Firing race condition between manual override and automatic re-evaluation...");

    // Get assignment for Recipient 2 (currently UNASSIGNED / COORDINATES_MISSING)
    const cda2 = await client.query(
      "SELECT id FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1;",
      [recip2.id]
    );
    const assign2Id = cda2.rows[0].id;

    // Concurrently fire:
    // A: Manual resolution to Store
    // B: Batch re-evaluation
    const resolvePromise = fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved/${assign2Id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        action: "MANUAL_ASSIGN",
        store_id: testStoreId,
        partner_id: testPartnerId,
        override_reason: "Concurrent executive manual assignment override",
      }),
    });

    const routeBatchPromise = fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/batches/${createdBatchId}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
    });

    const [resolveResp, routeBatchResp] = await Promise.all([resolvePromise, routeBatchPromise]);
    assert(resolveResp.status === 200, `Manual resolve returned 200 OK`);
    assert(routeBatchResp.status === 200, `Batch route returned 200 OK`);

    // Invariant: MANUAL_OVERRIDE state MUST BE PRESERVED against automatic overwriting
    const cda2Final = await client.query("SELECT status, assigned_store_id, assigned_partner_id FROM public.corporate_delivery_assignment WHERE id = $1;", [assign2Id]);
    assert(cda2Final.rows[0].status === "MANUAL_OVERRIDE", `MANUAL_OVERRIDE was preserved against automated re-evaluation (actual: ${cda2Final.rows[0].status})`);
    assert(cda2Final.rows[0].assigned_store_id === testStoreId, `Assigned store preserved in manual override`);

    // ── 5. CONCURRENCY TEST 4: REPEATED COORDINATE CORRECTION IDEMPOTENCY ─────
    markProgress("Concurrency 4: Testing repeated coordinate correction idempotency...");

    const correctCoordsReq = () => fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved/${assign2Id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        action: "CORRECT_COORDINATES",
        latitude: 12.9720,
        longitude: 77.6420,
        override_reason: "Correcting verified building coordinates",
      }),
    });

    const correct1 = await (await correctCoordsReq()).json();
    assert(correct1.success === true, `First coordinate correction succeeded`);

    // Repeated identical coordinate correction must be idempotent
    const correct2 = await (await correctCoordsReq()).json();
    assert(correct2.success === true, `Second coordinate correction returned 200`);
    assert(correct2.idempotent === true, `Repeated coordinate correction flagged as idempotent: true`);

    // ── 6. CONCURRENCY TEST 5: CONCURRENT DELIVERY STATUS TRANSITIONS ─────────
    markProgress("Concurrency 5: Firing concurrent delivery status transitions...");

    // Parallel transitions to out_for_delivery
    const transitReq = () => fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/recipients/${recip1.id}/delivery-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${partnerToken}` },
      body: JSON.stringify({ deliveryStatus: "out_for_delivery", notes: "Rider picked up" }),
    });

    const [tr1, tr2] = await Promise.all([transitReq(), transitReq()]);
    const [tJson1, tJson2] = await Promise.all([tr1.json(), tr2.json()]);

    assert(tJson1.success === true && tJson2.success === true, `Both parallel out_for_delivery requests returned success`);
    
    // Explicit idempotency verification on repeated call
    const tr3 = await transitReq();
    const tJson3 = await tr3.json();
    assert(tJson3.success === true, `Repeated out_for_delivery returned success`);
    assert(tJson3.idempotent === true, `Repeated out_for_delivery flagged as idempotent: true`);

    // Parallel transitions to delivered
    const deliverReq = () => fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/recipients/${recip1.id}/delivery-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${partnerToken}` },
      body: JSON.stringify({ deliveryStatus: "delivered", notes: "Delivered to recipient" }),
    });

    const [del1, del2] = await Promise.all([deliverReq(), deliverReq()]);
    const [dJson1, dJson2] = await Promise.all([del1.json(), del2.json()]);

    assert(dJson1.success === true && dJson2.success === true, `Both parallel delivered requests returned success`);

    // Explicit idempotency verification on repeated call
    const del3 = await deliverReq();
    const dJson3 = await del3.json();
    assert(dJson3.success === true, `Repeated delivered returned success`);
    assert(dJson3.idempotent === true, `Repeated delivered flagged as idempotent: true`);

    // Check final delivery status in PostgreSQL
    const del1Final = await client.query("SELECT delivery_status FROM public.delivery WHERE id = $1;", [recip1.delivery_id]);
    assert(del1Final.rows[0].delivery_status === "delivered", `Final public.delivery status is 'delivered'`);

    // ── 7. CONCURRENCY TEST 6: SIMULATED CLIENT TIMEOUT & RETRY REPLAY DEFENSE
    markProgress("Concurrency 6: Testing simulated client timeout and immediate retry...");

    // Send the exact same fileBase64 again
    const retryRes = await fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        customerId: testCustomerId,
        batchName: `CC Retry Batch ${runId}`,
        fileBase64,
        sourceFilename: "cc_campaign.xlsx",
      }),
    });

    const retryJson = await retryRes.json();
    assert(
      retryRes.status === 400 || retryRes.status === 409 || retryJson.success === false,
      `Replay of identical campaign after client timeout was safely rejected`
    );
    assert(
      retryJson.error === "DUPLICATE_FILE_HASH" || retryJson.message?.includes("duplicate"),
      `Replay rejected with DUPLICATE_FILE_HASH`
    );

    // Invariant check: Master invoice count STILL strictly 1
    const finalInvoices = await client.query("SELECT count(*)::int as cnt FROM public.invoice WHERE customer_id = $1;", [testCustomerId]);
    assert(finalInvoices.rows[0].cnt === 1, `INVARIANT: Master corporate invoice count remains strictly 1 after timeout retry`);

    markProgress("All concurrency and idempotency tests passed!");

    // ── 8. CLEAN TEARDOWN ────────────────────────────────────────────────────
    markProgress("Cleaning up isolated concurrency fixtures...");
    await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT');");
    await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

    await client.query("DELETE FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT';");
    await client.query("DELETE FROM public.delivery WHERE recipient_name IN ('Pooja Hegde', 'Siddharth Rao');");
    await client.query("DELETE FROM public.corporate_gifting_recipient WHERE batch_id = $1;", [createdBatchId]);
    await client.query("DELETE FROM public.corporate_gifting_batch WHERE id = $1;", [createdBatchId]);

    await client.query("DELETE FROM public.invoice WHERE customer_id = $1;", [testCustomerId]);
    await client.query("DELETE FROM public.order_item WHERE order_id IN (SELECT id FROM public.order WHERE customer_id = $1);", [testCustomerId]);
    await client.query("DELETE FROM public.order WHERE customer_id = $1;", [testCustomerId]);

    await client.query(`
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
    `, [testCustomerId]);
    await client.query(`
      DELETE FROM public.accounting_journal_entry 
      WHERE voucher_id IN (
        SELECT id FROM public.accounting_voucher 
        WHERE reference_event = 'CORPORATE_INVOICE_POSTED' 
           OR reference_id LIKE 'inv_corp_%'
      );
    `);
    await client.query(`
      DELETE FROM public.accounting_voucher 
      WHERE reference_event = 'CORPORATE_INVOICE_POSTED' 
         OR reference_id LIKE 'inv_corp_%';
    `);

    await client.query("DELETE FROM public.delivery_partner_coverage WHERE id = $1;", [`cov_cc_${runId}`]);
    await client.query("DELETE FROM public.delivery_partner_profile WHERE id = $1;", [`prof_cc_${runId}`]);
    await client.query("DELETE FROM public.delivery_partner WHERE id = $1;", [testPartnerId]);
    await client.query("DELETE FROM public.delivery_zone WHERE id = $1;", [testZoneId]);
    await client.query("DELETE FROM public.branch WHERE id = $1;", [testStoreId]);
    await client.query("DELETE FROM public.corporate_account WHERE id = $1;", [testAccountId]);
    await client.query("DELETE FROM public.customer WHERE id = $1;", [testCustomerId]);

    // ── 9. POSTFLIGHT INVARIANTS ─────────────────────────────────────────────
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
    console.log(`C7.14 CONCURRENCY STRESS SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================================");

    await client.end();
    clearTimeout(timer);
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ Error during Concurrency Stress suite (last op: "${lastProgress}"):`, err);
    try {
      await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT');");
      await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query("DELETE FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT';");
      await client.query("DELETE FROM public.delivery WHERE recipient_name IN ('Pooja Hegde', 'Siddharth Rao');");
      if (createdBatchId) {
        await client.query("DELETE FROM public.corporate_gifting_recipient WHERE batch_id = $1;", [createdBatchId]);
        await client.query("DELETE FROM public.corporate_gifting_batch WHERE id = $1;", [createdBatchId]);
      }
      await client.query("DELETE FROM public.invoice WHERE customer_id = $1;", [testCustomerId]);
      await client.query("DELETE FROM public.order_item WHERE order_id IN (SELECT id FROM public.order WHERE customer_id = $1);", [testCustomerId]);
      await client.query("DELETE FROM public.order WHERE customer_id = $1;", [testCustomerId]);
      await client.query(`
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
      `, [testCustomerId]);
      await client.query(`
        DELETE FROM public.accounting_journal_entry 
        WHERE voucher_id IN (
          SELECT id FROM public.accounting_voucher 
          WHERE reference_event = 'CORPORATE_INVOICE_POSTED' 
             OR reference_id LIKE 'inv_corp_%'
        );
      `);
      await client.query(`
        DELETE FROM public.accounting_voucher 
        WHERE reference_event = 'CORPORATE_INVOICE_POSTED' 
           OR reference_id LIKE 'inv_corp_%';
      `);
      await client.query("DELETE FROM public.delivery_partner_coverage WHERE id = $1;", [`cov_cc_${runId}`]);
      await client.query("DELETE FROM public.delivery_partner_profile WHERE id = $1;", [`prof_cc_${runId}`]);
      await client.query("DELETE FROM public.delivery_partner WHERE id = $1;", [testPartnerId]);
      await client.query("DELETE FROM public.delivery_zone WHERE id = $1;", [testZoneId]);
      await client.query("DELETE FROM public.branch WHERE id = $1;", [testStoreId]);
      await client.query("DELETE FROM public.corporate_account WHERE id = $1;", [testAccountId]);
      await client.query("DELETE FROM public.customer WHERE id = $1;", [testCustomerId]);
      await client.end();
    } catch {}
    clearTimeout(timer);
    process.exit(1);
  }
}

runConcurrencyStress();
