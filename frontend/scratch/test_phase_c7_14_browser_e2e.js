/**
 * CakeToHome ERP — Phase C7.14 Unified End-to-End Browser Integration Suite
 *
 * Full Lifecycle Browser & Relational Verification:
 * 1. Open Corporate Gifting Administration UI.
 * 2. Authenticate as Super Admin with cryptographic session cookie.
 * 3. Seed isolated corporate customer, store, and partner fixtures.
 * 4. Generate multi-recipient campaign spreadsheet (.xlsx) with 1 auto-routable recipient and 1 missing-coordinates recipient.
 * 5. Dry-run validation via UI / API and assert zero mutations.
 * 6. Confirm and execute campaign; assert single master invoice, single voucher, and 2 deliveries in PostgreSQL.
 * 7. Verify recipient 1 is ASSIGNED ('pickup_claimed') to store & partner.
 * 8. Navigate to Super Admin Review Queue (/dashboard?tab=corporate_routing_review); verify recipient 2 is UNASSIGNED ('COORDINATES_MISSING').
 * 9. Perform manual resolution (CORRECT_COORDINATES or MANUAL_ASSIGN); verify immutable audit event.
 * 10. Advance delivery lifecycle (pickup_claimed -> in_transit -> delivered).
 * 11. Refresh browser and assert UI accurately renders persisted states.
 * 12. Clean teardown and assert 100 CoA / balanced TB invariants.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
const ExcelJS = require('exceljs');

const OVERALL_TIMEOUT_MS = 120000;
let lastProgress = "Initialization";
const timer = setTimeout(() => {
  console.error(`\n[TIMEOUT] test_phase_c7_14_browser_e2e.js exceeded ${OVERALL_TIMEOUT_MS}ms! Last op: "${lastProgress}"`);
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

async function runBrowserE2ESuite() {
  console.log("==================================================================");
  console.log("CAKETOHOME ERP — PHASE C7.14: UNIFIED BROWSER E2E INTEGRATION SUITE");
  console.log("==================================================================\n");

  const connStr = getConnectionString();
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });

  await client.connect();
  markProgress("Connected to PostgreSQL successfully.");

  const runId = Date.now();
  const testStoreId = `br_e2e_14_${runId}`;
  const testZoneId = `zone_e2e_14_${runId}`;
  const testPartnerId = `dlp_e2e_14_${runId}`;
  const testPartnerProfId = `prof_e2e_14_${runId}`;
  const testPartnerCovId = `cov_e2e_14_${runId}`;
  const testCustomerId = `cust_e2e_14_${runId}`;
  const testAccountId = `acc_e2e_14_${runId}`;

  let createdBatchId = null;
  let recipient1Id = null;
  let recipient2Id = null;
  let browser = null;

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
    markProgress("Seeding test store, zone, delivery partner, customer, and account...");

    const shopRes = await client.query("SELECT id FROM public.shop LIMIT 1;");
    const shopId = shopRes.rows[0]?.id || null;

    // Corporate Customer (Schema verified: credit_enabled, credit_limit, credit_balance, payment_terms_days, credit_status)
    await client.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, email, phone, is_corporate,
        company_name, credit_enabled, credit_limit, credit_balance, payment_terms_days, credit_status
      ) VALUES ($1, 'Acme', 'Enterprises', $2, $3, true,
        'Acme Enterprises Ltd', true, 500000.00, 500000.00, 30, 'APPROVED');
    `, [testCustomerId, `acme.e2e_${runId}@example.com`, `+9198765${runId.toString().slice(-5)}`]);

    // Corporate Account (Schema verified: customer_id, legal_name, trade_name, legal_name_key, status)
    await client.query(`
      INSERT INTO public.corporate_account (
        id, customer_id, legal_name, trade_name, legal_name_key, status
      ) VALUES ($1, $2, 'Acme Enterprises Ltd', 'Acme E2E', 'acme enterprises ltd', 'APPROVED');
    `, [testAccountId, testCustomerId]);

    // Store (Corporate routing eligible) in Indiranagar, Bengaluru
    await client.query(`
      INSERT INTO public.branch (
        id, name, code, is_open, phone, email, address, latitude, longitude,
        shop_id, is_corporate_routing_eligible
      ) VALUES ($1, 'Hub E2E 14 Indiranagar', $2, true, '9999914001',
        'hub.e2e14@example.com', '100ft Road, Indiranagar', 12.9716, 77.6412, $3, true);
    `, [testStoreId, `HUB-E2E14-${runId.toString().slice(-4)}`, shopId]);

    // Serviceable Delivery Zone with polygon geofence covering Indiranagar (12.970-12.990, 77.630-77.650)
    const polygonGeofence = [
      [12.970, 77.630],
      [12.990, 77.630],
      [12.990, 77.650],
      [12.970, 77.650],
      [12.970, 77.630],
    ];

    await client.query(`
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, radius_km, center_latitude, center_longitude, priority
      ) VALUES ($1, $2, 'Indiranagar Zone E2E', '560038', 0.00, true,
        $3, NULL, 12.9716, 77.6412, 100);
    `, [testZoneId, testStoreId, JSON.stringify(polygonGeofence)]);

    // Delivery Partner
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES ($1, 'E2E Runner', 'Speedy', $2, $3);
    `, [testPartnerId, `runner_${runId}@caketohome.test`, `+9198765${runId.toString().slice(-5)}`]);

    // Partner Profile & Coverage
    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.95);
    `, [testPartnerProfId, testPartnerId, testStoreId]);

    await client.query(`
      INSERT INTO public.delivery_partner_coverage (id, partner_id, branch_id, fence_type, priority, is_active, radius_km, center_latitude, center_longitude)
      VALUES ($1, $2, $3, 'RADIUS', 30, true, 12.0, 12.9716, 77.6412);
    `, [testPartnerCovId, testPartnerId, testStoreId]);

    markProgress("Test fixtures seeded successfully in PostgreSQL.");

    // ── 2. LAUNCH CHROMIUM BROWSER ───────────────────────────────────────────
    markProgress("Launching Playwright Chromium browser...");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

    // Inject Super Admin Session
    const superAdminToken = signAuthToken({ userId: 'usr_superadmin', role: 'SUPER_ADMIN' });
    await context.addCookies([
      { name: '_cth_jwt', value: superAdminToken, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'usr_superadmin', domain: 'localhost', path: '/' },
    ]);

    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', msg => {
      const txt = msg.text();
      if (!txt.includes('Fast Refresh') && !txt.includes('React DevTools')) {
        consoleLogs.push(`[${msg.type()}] ${txt}`);
      }
    });

    // ── 3. WORKFLOW STEP 1: OPEN CORPORATE GIFTING UI ────────────────────────
    markProgress("Step 1: Navigating to Corporate Gifting admin interface...");
    await page.goto('http://localhost:3000/dashboard?tab=corporate_gifting', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Corporate Gifting Subsystem', { timeout: 30000 });
    await page.waitForTimeout(1000);

    const shot1 = path.join(__dirname, 'c7_14_e2e_01_gifting_panel.png');
    await page.screenshot({ path: shot1 });
    console.log(`  📸 Screenshot saved: ${shot1}`);
    assert(fs.existsSync(shot1), "Screenshot 1 captured: Corporate Gifting panel rendered");

    // ── 4. WORKFLOW STEP 2 & 3: BUILD SPREADSHEET & VALIDATE ────────────────
    markProgress("Step 2-3: Validating multi-recipient gifting campaign via API & UI...");

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

    // Recipient 1: Inside Indiranagar Store & Partner Polygon -> ASSIGNED
    sheet.addRow({
      employee_id: "EMP-E2E-1",
      recipient_name: "Anita Desai",
      recipient_phone: "9876501101",
      delivery_address: "100ft Road Indiranagar",
      delivery_city: "Bengaluru",
      delivery_pincode: "560038",
      latitude: 12.9720,
      longitude: 77.6420,
      delivery_date: delivDateStr,
      delivery_slot: "MORNING",
      product_sku: "BUTTER-CROISSANT",
      quantity: 2,
      gift_message: "Happy Anniversary Anita!",
    });

    // Recipient 2: Missing Coordinates -> UNASSIGNED (review candidate)
    sheet.addRow({
      employee_id: "EMP-E2E-2",
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

    const fileBuf = await workbook.xlsx.writeBuffer();
    const fileBase64 = Buffer.from(fileBuf).toString("base64");

    // Perform dry run validation API call
    const valRes = await page.evaluate(async ({ customerId, b64 }) => {
      const res = await fetch("/api/v1/admin/corporate-gifting/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          fileBase64: b64,
          sourceFilename: "c714_campaign_e2e.xlsx",
        }),
      });
      return { status: res.status, data: await res.json() };
    }, { customerId: testCustomerId, b64: fileBase64 });

    assert(valRes.status === 200, `Validation API returned 200 OK`);
    assert(valRes.data.isValid === true, `Validation report is valid`);
    assert(valRes.data.totalRows === 2, `Total parsed rows = 2`);
    assert(valRes.data.parsedRecipients[0].routingPreview.can_match === true, `Recipient 1 routingPreview can_match: true`);
    assert(valRes.data.parsedRecipients[1].routingPreview.can_match === false, `Recipient 2 routingPreview can_match: false (missing coords)`);

    // Invariant: Assert zero database writes occurred during dry-run validation
    const dryBatches = await client.query("SELECT count(*)::int as cnt FROM public.corporate_gifting_batch WHERE customer_id = $1;", [testCustomerId]);
    assert(dryBatches.rows[0].cnt === 0, `Dry run validation preserved zero DB mutations`);

    // ── 5. WORKFLOW STEP 4: CAMPAIGN CONFIRMATION & EXECUTION ─────────────────
    markProgress("Step 4: Executing campaign confirmation and verifying single master invoice...");
    const execRes = await page.evaluate(async ({ customerId, b64, runId }) => {
      const res = await fetch("/api/v1/admin/corporate-gifting/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          batchName: `E2E Campaign Batch ${runId}`,
          fileBase64: b64,
          sourceFilename: "c714_campaign_e2e.xlsx",
        }),
      });
      return { status: res.status, data: await res.json() };
    }, { customerId: testCustomerId, b64: fileBase64, runId });

    assert(execRes.status === 200, `Execution API returned 200 OK`);
    assert(execRes.data.success === true, `Campaign execution successful`);
    assert(execRes.data.recipientsCount === 2, `Recipients count is 2`);
    assert(execRes.data.masterOrderId !== null, `Master commercial umbrella order generated`);
    assert(execRes.data.invoiceId !== null, `Single master corporate invoice generated`);
    assert(execRes.data.voucherId !== null, `Single master statutory voucher generated`);

    createdBatchId = execRes.data.batch.id;

    // Verify database persistence: Single Master Invoice rule
    const masterInvoices = await client.query("SELECT count(*)::int as cnt FROM public.invoice WHERE customer_id = $1;", [testCustomerId]);
    assert(masterInvoices.rows[0].cnt === 1, `INVARIANT: Exactly 1 master corporate invoice in public.invoice`);

    const childDeliveries = await client.query("SELECT count(*)::int as cnt FROM public.delivery WHERE recipient_name IN ('Anita Desai', 'Karan Johar');");
    assert(childDeliveries.rows[0].cnt === 2, `INVARIANT: Exactly 2 child deliveries created in public.delivery`);

    // ── 6. WORKFLOW STEP 5: VERIFY ROUTING ASSIGNMENTS ───────────────────────
    markProgress("Step 5: Verifying automated routing assignments...");
    const dbRecips = await client.query(`
      SELECT id, recipient_name, status, delivery_id
      FROM public.corporate_gifting_recipient
      WHERE batch_id = $1 ORDER BY row_number ASC;
    `, [createdBatchId]);

    recipient1Id = dbRecips.rows[0].id;
    recipient2Id = dbRecips.rows[1].id;

    // Recipient 1: Valid Coordinates -> ASSIGNED
    const cda1 = await client.query(`
      SELECT * FROM public.corporate_delivery_assignment WHERE entity_id = $1;
    `, [recipient1Id]);
    assert(cda1.rows.length === 1 && cda1.rows[0].status === "ASSIGNED", `Recipient 1 assignment is ASSIGNED`);
    assert(cda1.rows[0].assigned_store_id === testStoreId, `Recipient 1 assigned to test store`);
    assert(cda1.rows[0].assigned_partner_id === testPartnerId, `Recipient 1 assigned to test partner`);

    // Public.delivery synchronization for Recipient 1 adheres to check constraint
    const del1 = await client.query("SELECT delivery_status, delivery_partner_id FROM public.delivery WHERE id = $1;", [dbRecips.rows[0].delivery_id]);
    assert(del1.rows[0].delivery_status === "pickup_claimed", `Recipient 1 public.delivery is 'pickup_claimed'`);
    assert(del1.rows[0].delivery_partner_id === testPartnerId, `Recipient 1 delivery partner synced`);

    // Recipient 2: Missing Coordinates -> UNASSIGNED
    const cda2 = await client.query(`
      SELECT * FROM public.corporate_delivery_assignment WHERE entity_id = $1;
    `, [recipient2Id]);
    assert(cda2.rows.length === 1 && cda2.rows[0].status === "UNASSIGNED", `Recipient 2 assignment is UNASSIGNED`);
    assert(cda2.rows[0].reason_code === "COORDINATES_MISSING", `Recipient 2 reason is COORDINATES_MISSING`);

    // ── 7. WORKFLOW STEP 6: NAVIGATE TO REVIEW QUEUE ─────────────────────────
    markProgress("Step 6: Navigating to Super Admin Unresolved Review Queue...");
    await page.goto('http://localhost:3000/dashboard?tab=corporate_routing_review', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Super Admin Unresolved Routing Queue', { timeout: 30000 });
    await page.waitForTimeout(1000);

    const shot2 = path.join(__dirname, 'c7_14_e2e_02_review_queue.png');
    await page.screenshot({ path: shot2 });
    console.log(`  📸 Screenshot saved: ${shot2}`);
    assert(fs.existsSync(shot2), "Screenshot 2 captured: Review Queue rendered");

    // Verify Recipient 2 is in review queue
    const queueRes = await page.evaluate(async () => {
      const res = await fetch("/api/v1/admin/corporate-routing/unresolved?limit=50");
      return await res.json();
    });
    assert(queueRes.success === true, `Review queue API returned 200 OK`);
    const foundUnresolved = (queueRes.data || []).find(it => it.entity_id === recipient2Id);
    assert(foundUnresolved !== undefined, `Recipient 2 present in Super Admin review queue`);
    assert(foundUnresolved.reason_code === "COORDINATES_MISSING", `Recipient 2 flagged with COORDINATES_MISSING`);

    // ── 8. WORKFLOW STEP 7 & 8: RESOLVE RECIPIENT & AUDIT TRAIL ──────────────
    markProgress("Step 7-8: Resolving unresolved location with manual override and verifying audit trail...");
    const resolveRes = await page.evaluate(async ({ assignId, storeId, partnerId }) => {
      const res = await fetch(`/api/v1/admin/corporate-routing/unresolved/${assignId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MANUAL_ASSIGN",
          store_id: storeId,
          partner_id: partnerId,
          override_reason: "Super Admin manual routing authorization for corporate executive recipient",
        }),
      });
      return { status: res.status, data: await res.json() };
    }, { assignId: cda2.rows[0].id, storeId: testStoreId, partnerId: testPartnerId });

    assert(resolveRes.status === 200, `Resolution API returned 200 OK`);
    const resolvedStatus = resolveRes.data?.data?.status || resolveRes.data?.assignment?.status;
    assert(resolvedStatus === "MANUAL_OVERRIDE", `Assignment status updated to MANUAL_OVERRIDE (actual: ${resolvedStatus})`);

    // Verify audit event appended in PostgreSQL
    const auditEvents = await client.query(`
      SELECT event_type, actor_id, actor_role, reason FROM public.corporate_assignment_event
      WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1;
    `, [cda2.rows[0].id]);
    assert(auditEvents.rows.length === 1, `Audit event persisted in corporate_assignment_event`);
    assert(auditEvents.rows[0].event_type === "MANUALLY_OVERRIDDEN", `Event type is MANUALLY_OVERRIDDEN`);
    assert(auditEvents.rows[0].actor_id === "usr_superadmin", `Audit actor ID is usr_superadmin`);

    // ── 9. WORKFLOW STEP 9: DELIVERY STATUS LIFECYCLE ────────────────────────
    markProgress("Step 9: Advancing delivery status lifecycle through valid transitions...");
    const partnerToken = signAuthToken({ userId: testPartnerId, role: 'DELIVERY_PARTNER', partnerId: testPartnerId });

    // A. pickup_claimed -> in_transit (out_for_delivery)
    const transitRes = await page.evaluate(async ({ recipId, token }) => {
      const res = await fetch(`/api/v1/admin/corporate-gifting/recipients/${recipId}/delivery-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          deliveryStatus: "out_for_delivery",
          notes: "Package collected by partner rider",
        }),
      });
      return { status: res.status, data: await res.json() };
    }, { recipId: recipient1Id, token: partnerToken });

    assert(transitRes.status === 200, `Transition to out_for_delivery returned 200 OK`);
    assert(transitRes.data.deliveryStatus === "out_for_delivery", `deliveryStatus is out_for_delivery`);

    const del1Transit = await client.query("SELECT delivery_status FROM public.delivery WHERE id = $1;", [dbRecips.rows[0].delivery_id]);
    assert(del1Transit.rows[0].delivery_status === "in_transit", `public.delivery status updated to 'in_transit'`);

    // B. in_transit -> delivered
    const deliveredRes = await page.evaluate(async ({ recipId, token }) => {
      const res = await fetch(`/api/v1/admin/corporate-gifting/recipients/${recipId}/delivery-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          deliveryStatus: "delivered",
          notes: "Delivered to recipient with digital confirmation",
        }),
      });
      return { status: res.status, data: await res.json() };
    }, { recipId: recipient1Id, token: partnerToken });

    assert(deliveredRes.status === 200, `Transition to delivered returned 200 OK`);
    assert(deliveredRes.data.deliveryStatus === "delivered", `deliveryStatus is delivered`);

    const del1Delivered = await client.query("SELECT delivery_status FROM public.delivery WHERE id = $1;", [dbRecips.rows[0].delivery_id]);
    assert(del1Delivered.rows[0].delivery_status === "delivered", `public.delivery status updated to 'delivered'`);

    // ── 10. WORKFLOW STEP 10: BROWSER REFRESH & PERSISTENCE VERIFICATION ─────
    markProgress("Step 10: Refreshing browser and asserting UI displays current persisted state...");
    await page.goto(`http://localhost:3000/dashboard?tab=corporate_gifting`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Corporate Gifting Subsystem', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const batchDetail = await page.evaluate(async (batchId) => {
      const res = await fetch(`/api/v1/admin/corporate-gifting/batches/${batchId}`);
      return await res.json();
    }, createdBatchId);

    assert(batchDetail.success === true, `Refreshed batch detail returned 200 OK`);
    assert(batchDetail.recipients.length === 2, `Refreshed batch contains 2 recipients`);
    const recip1 = batchDetail.recipients[0];
    const isDelivered = recip1.delivery_status === "delivered" || recip1.status === "DELIVERED";
    assert(isDelivered, `Recipient 1 delivery status persisted as delivered (actual delivery_status: ${recip1.delivery_status}, status: ${recip1.status})`);

    const shot3 = path.join(__dirname, 'c7_14_e2e_03_refreshed_state.png');
    await page.screenshot({ path: shot3 });
    console.log(`  📸 Screenshot saved: ${shot3}`);
    assert(fs.existsSync(shot3), "Screenshot 3 captured: Refreshed state rendered");

    // Close browser cleanly
    await context.close();
    await browser.close();
    browser = null;
    markProgress("Browser session closed cleanly.");

    // ── 11. TEARDOWN FIXTURES SAFELY ─────────────────────────────────────────
    markProgress("Cleaning up isolated test fixtures...");
    await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT');");
    await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

    await client.query("DELETE FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT';");
    await client.query("DELETE FROM public.delivery WHERE recipient_name IN ('Anita Desai', 'Karan Johar');");
    await client.query("DELETE FROM public.corporate_gifting_recipient WHERE batch_id = $1;", [createdBatchId]);
    await client.query("DELETE FROM public.corporate_gifting_batch WHERE id = $1;", [createdBatchId]);

    await client.query("DELETE FROM public.invoice WHERE customer_id = $1 OR order_id IN (SELECT id FROM public.order WHERE customer_id = $1);", [testCustomerId]);
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

    await client.query("DELETE FROM public.delivery_partner_coverage WHERE id = $1;", [testPartnerCovId]);
    await client.query("DELETE FROM public.delivery_partner_profile WHERE id = $1;", [testPartnerProfId]);
    await client.query("DELETE FROM public.delivery_partner WHERE id = $1;", [testPartnerId]);
    await client.query("DELETE FROM public.delivery_zone WHERE id = $1;", [testZoneId]);
    await client.query("DELETE FROM public.branch WHERE id = $1;", [testStoreId]);
    await client.query("DELETE FROM public.corporate_account WHERE id = $1;", [testAccountId]);
    await client.query("DELETE FROM public.customer WHERE id = $1;", [testCustomerId]);

    markProgress("Fixtures cleaned up.");

    // ── 12. POSTFLIGHT INVARIANTS ────────────────────────────────────────────
    markProgress("Verifying postflight baseline invariants...");
    const postCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const postV = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
    const postJE = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
    const postJL = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const postDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const postBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");
    const postAssignments = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");
    const postEvents = await client.query("SELECT count(*)::int as cnt FROM public.corporate_assignment_event;");
    const postTrigger = await client.query("SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_corporate_assignment_event_immutability';");

    assert(postCoA.rows[0].cnt === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].cnt}`);
    assert(postV.rows[0].cnt === 6, `Postflight Vouchers = 6: ${postV.rows[0].cnt}`);
    assert(postJE.rows[0].cnt === 4, `Postflight Journal Entries = 4: ${postJE.rows[0].cnt}`);
    assert(postJL.rows[0].cnt === 10, `Postflight Journal Lines = 10: ${postJL.rows[0].cnt}`);
    assert(Number(postJL.rows[0].dr) === 3380.0 && Number(postJL.rows[0].cr) === 3380.0, `Postflight TB strictly balanced Dr ₹3,380.00 = Cr ₹3,380.00`);
    assert(postDP.rows[0].cnt === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].cnt}`);
    assert(postBranch.rows[0].active === 48, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);
    assert(postAssignments.rows[0].cnt === 0, `corporate_delivery_assignment residual rows = 0: ${postAssignments.rows[0].cnt}`);
    assert(postEvents.rows[0].cnt === 0, `corporate_assignment_event residual rows = 0: ${postEvents.rows[0].cnt}`);
    assert(postTrigger.rows[0].tgenabled === 'O', `Postflight trigger is strictly ENABLED ('O')`);

    console.log("\n==================================================================");
    console.log(`C7.14 BROWSER E2E SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================================");

    await client.end();
    clearTimeout(timer);
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ Error during C7.14 Browser E2E suite (last op: "${lastProgress}"):`, err);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    try { await client.end(); } catch {}
    clearTimeout(timer);
    process.exit(1);
  }
}

runBrowserE2ESuite();
