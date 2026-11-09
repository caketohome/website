/**
 * CakeToHome ERP — Phase C7.14 Authorization & Tenant-Isolation Matrix Suite
 *
 * Validates RBAC permissions, tenant isolation, and attack vector resistance:
 * 1. Super Admin: full access to all endpoints.
 * 2. Authorized Logistics Reviewer: permitted VIEW and MANAGE actions.
 * 3. Read-Only Viewer: permitted VIEW; denied MANAGE (403).
 * 4. Basic Staff: denied VIEW and MANAGE (403).
 * 5. Corporate Account Customer: self-service access only; denied admin routing (403); cross-account blocked (404/403).
 * 6. Partner User: permitted delivery status updates for assigned deliveries; denied other partners' deliveries (403).
 * 7. Unauthenticated Caller: denied all endpoints (401).
 * 8. Spoofed Header Attacks: unverified x-user-role or x-user-id headers without valid cryptographic JWT signature fail closed.
 * 9. Expired Session: cryptographic token with exp in the past is rejected (401).
 * 10. Tampered Token: cryptographic token with invalid HMAC signature is rejected (401).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const OVERALL_TIMEOUT_MS = 60000;
let lastProgress = "Initialization";
const timer = setTimeout(() => {
  console.error(`\n[TIMEOUT] test_phase_c7_14_security_matrix.js exceeded ${OVERALL_TIMEOUT_MS}ms! Last op: "${lastProgress}"`);
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
    userId: payload.userId || 'usr_test',
    role: payload.role || 'STAFF',
    email: payload.email || 'test@caketohome.com',
    permissions: payload.permissions || [],
    iat: now,
    exp: payload.exp !== undefined ? payload.exp : now + 7 * 86400,
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

async function runSecurityMatrix() {
  console.log("==================================================================");
  console.log("CAKETOHOME ERP — PHASE C7.14: AUTHORIZATION & TENANT-ISOLATION MATRIX");
  console.log("==================================================================\n");

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 10000,
  });
  await client.connect();
  markProgress("Connected to PostgreSQL.");

  const runId = Date.now();
  const testStoreId = `br_sec_${runId}`;
  const testPartnerAId = `dlp_sec_a_${runId}`;
  const testPartnerBId = `dlp_sec_b_${runId}`;
  const testCustomerAId = `cust_sec_a_${runId}`;
  const testCustomerBId = `cust_sec_b_${runId}`;
  const testAccountAId = `acc_sec_a_${runId}`;
  const testAccountBId = `acc_sec_b_${runId}`;
  const testBatchAId = `cgb_sec_a_${runId}`;
  const testBatchBId = `cgb_sec_b_${runId}`;
  const testRecipAId = `cgr_sec_a_${runId}`;
  const testRecipBId = `cgr_sec_b_${runId}`;
  const testDelivAId = `del_sec_a_${runId}`;
  const testDelivBId = `del_sec_b_${runId}`;
  const testAssignAId = `cda_sec_a_${runId}`;

  try {
    // ── 0. PREFLIGHT INVARIANTS ──────────────────────────────────────────────
    markProgress("Verifying preflight database baseline invariants...");
    const preCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const preJL = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    assert(preCoA.rows[0].cnt === 100, `Preflight CoA is 100 accounts: ${preCoA.rows[0].cnt}`);
    assert(Number(preJL.rows[0].dr) === 3380.0 && Number(preJL.rows[0].cr) === 3380.0, `Preflight TB strictly balanced Dr/Cr ₹3,380.00`);

    // ── 1. SEED ISOLATED TEST FIXTURES ───────────────────────────────────────
    markProgress("Seeding test partners, customers, corporate accounts, batches, and recipients...");

    const shopRes = await client.query("SELECT id FROM public.shop LIMIT 1;");
    const shopId = shopRes.rows[0]?.id || null;

    // Branch
    await client.query(`
      INSERT INTO public.branch (id, name, code, is_open, phone, email, address, latitude, longitude, shop_id, is_corporate_routing_eligible)
      VALUES ($1, 'Security Test Branch', $2, true, '9999900014', 'sec@test.com', 'Security Rd', 12.9716, 77.6412, $3, true);
    `, [testStoreId, `HUB-SEC-${runId.toString().slice(-4)}`, shopId]);

    // Two Delivery Partners (Partner A & Partner B)
    await client.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone)
      VALUES 
        ($1, 'Alice', 'Courier', $2, $3),
        ($4, 'Bob', 'Rider', $5, $6);
    `, [testPartnerAId, `alice_${runId}@test.com`, `+9198700${runId.toString().slice(-5)}`,
        testPartnerBId, `bob_${runId}@test.com`, `+9198701${runId.toString().slice(-5)}`]);

    await client.query(`
      INSERT INTO public.delivery_partner_profile (id, partner_id, partner_type, status, primary_branch_id, rating)
      VALUES 
        ($1, $2, 'OWN_FLEET', 'ACTIVE', $3, 4.9),
        ($4, $5, 'OWN_FLEET', 'ACTIVE', $3, 4.8);
    `, [`prof_sec_a_${runId}`, testPartnerAId, testStoreId, `prof_sec_b_${runId}`, testPartnerBId]);

    // Two Corporate Customers (Customer A & Customer B)
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, is_corporate, company_name, credit_enabled, credit_limit, credit_balance, payment_terms_days, credit_status)
      VALUES 
        ($1, 'CorpA', 'Admin', $2, $3, true, 'Corp Alpha Ltd', true, 100000.00, 100000.00, 30, 'APPROVED'),
        ($4, 'CorpB', 'Admin', $5, $6, true, 'Corp Beta Ltd', true, 100000.00, 100000.00, 30, 'APPROVED');
    `, [testCustomerAId, `corpa_${runId}@test.com`, `+9198711${runId.toString().slice(-5)}`,
        testCustomerBId, `corpb_${runId}@test.com`, `+9198722${runId.toString().slice(-5)}`]);

    await client.query(`
      INSERT INTO public.corporate_account (id, customer_id, legal_name, trade_name, legal_name_key, status)
      VALUES 
        ($1, $2, 'Corp Alpha Ltd', 'Corp Alpha', 'corp alpha ltd', 'APPROVED'),
        ($3, $4, 'Corp Beta Ltd', 'Corp Beta', 'corp beta ltd', 'APPROVED');
    `, [testAccountAId, testCustomerAId, testAccountBId, testCustomerBId]);

    // Two Gifting Batches
    await client.query(`
      INSERT INTO public.corporate_gifting_batch (id, customer_id, batch_name, source_filename, file_hash, file_size_bytes, status, total_recipients, total_amount, created_at, updated_at)
      VALUES 
        ($1, $2, 'Alpha Campaign', 'alpha.xlsx', $3, 1024, 'SCHEDULED', 1, 500.00, NOW(), NOW()),
        ($4, $5, 'Beta Campaign', 'beta.xlsx', $6, 1024, 'SCHEDULED', 1, 500.00, NOW(), NOW());
    `, [testBatchAId, testCustomerAId, `hash_a_${runId}`, testBatchBId, testCustomerBId, `hash_b_${runId}`]);

    // Public Deliveries
    // Delivery A assigned to Partner A
    // Delivery B assigned to Partner B
    await client.query(`
      INSERT INTO public.delivery (id, recipient_name, recipient_address, recipient_pincode, delivery_status, delivery_partner_id, created_at, updated_at)
      VALUES 
        ($1, 'Recipient Alpha', '123 Alpha St', '560001', 'pickup_claimed', $2, NOW(), NOW()),
        ($3, 'Recipient Beta', '456 Beta Ave', '560002', 'pickup_claimed', $4, NOW(), NOW());
    `, [testDelivAId, testPartnerAId, testDelivBId, testPartnerBId]);

    // Recipients
    await client.query(`
      INSERT INTO public.corporate_gifting_recipient (
        id, batch_id, row_number, recipient_name, recipient_phone, delivery_address, delivery_pincode, delivery_date, sku, quantity, delivery_id, status
      ) VALUES 
        ($1, $2, 1, 'Recipient Alpha', '9876543210', '123 Alpha St', '560001', '2026-10-20', 'CAKE-01', 1, $3, 'ORDER_CREATED'),
        ($4, $5, 1, 'Recipient Beta', '9876543211', '456 Beta Ave', '560002', '2026-10-20', 'CAKE-01', 1, $6, 'ORDER_CREATED');
    `, [testRecipAId, testBatchAId, testDelivAId, testRecipBId, testBatchBId, testDelivBId]);

    // Unresolved Assignment fixture for Recipient A
    await client.query(`
      INSERT INTO public.corporate_delivery_assignment (
        id, entity_type, entity_id, account_id, recipient_name, recipient_phone, delivery_address, delivery_city, normalized_city_key, delivery_pincode, status, reason_code, latitude, longitude, created_at, updated_at
      ) VALUES ($1, 'GIFTING_RECIPIENT', $2, $3, 'Recipient Alpha', '9876543210', '123 Alpha St', 'Bengaluru', 'bengaluru', '560001', 'UNASSIGNED', 'COORDINATES_MISSING', NULL, NULL, NOW(), NOW());
    `, [testAssignAId, testRecipAId, testAccountAId]);

    markProgress("Fixtures seeded successfully.");

    // ── 2. PREPARE SECURITY TOKENS ───────────────────────────────────────────
    const superAdminToken = signAuthToken({ userId: 'usr_superadmin', role: 'SUPER_ADMIN', isSuperAdmin: true });
    const reviewerToken = signAuthToken({ userId: 'usr_reviewer', role: 'STAFF', permissions: ['CORPORATE_ROUTING.VIEW', 'CORPORATE_ROUTING.MANAGE'] });
    const viewerToken = signAuthToken({ userId: 'usr_viewer', role: 'STAFF', permissions: ['CORPORATE_ROUTING.VIEW'] });
    const basicStaffToken = signAuthToken({ userId: 'usr_basic', role: 'STAFF', permissions: ['INVENTORY.VIEW'] });
    const customerAToken = signAuthToken({ userId: testCustomerAId, customerId: testCustomerAId, role: 'CUSTOMER' });
    const customerBToken = signAuthToken({ userId: testCustomerBId, customerId: testCustomerBId, role: 'CUSTOMER' });
    const partnerAToken = signAuthToken({ userId: testPartnerAId, partnerId: testPartnerAId, role: 'DELIVERY_PARTNER' });
    const partnerBToken = signAuthToken({ userId: testPartnerBId, partnerId: testPartnerBId, role: 'DELIVERY_PARTNER' });
    const expiredToken = signAuthToken({ userId: 'usr_expired', role: 'SUPER_ADMIN', exp: Math.floor(Date.now() / 1000) - 3600 });
    const tamperedToken = superAdminToken.slice(0, -6) + "XXXXXX";

    const BASE_URL = 'http://localhost:3000';

    // ── 3. MATRIX CHECK 1: UNAUTHENTICATED ACCESS (401) ──────────────────────
    markProgress("Matrix 1: Testing unauthenticated requests to protected endpoints...");

    const unauthGet = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`);
    assert(unauthGet.status === 401, `Unauthenticated GET /unresolved returned 401 (actual: ${unauthGet.status})`);

    const unauthResolve = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved/${testAssignAId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "MANUAL_ASSIGN", store_id: testStoreId, partner_id: testPartnerAId, override_reason: "Hacker attempt" }),
    });
    assert(unauthResolve.status === 401, `Unauthenticated POST /resolve returned 401 (actual: ${unauthResolve.status})`);

    const unauthDelivery = await fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/recipients/${testRecipAId}/delivery-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStatus: "delivered" }),
    });
    assert(unauthDelivery.status === 401, `Unauthenticated POST /delivery-status returned 401 (actual: ${unauthDelivery.status})`);

    // ── 4. MATRIX CHECK 2: HEADER SPOOFING ATTACKS (FAIL CLOSED) ─────────────
    markProgress("Matrix 2: Testing spoofed x-user-role and x-user-id headers without signature...");

    const spoofedAdmin = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: {
        "x-user-role": "SUPER_ADMIN",
        "x-user-id": "usr_superadmin",
        "x-is-super-admin": "true",
      },
    });
    assert(spoofedAdmin.status === 401, `Header-spoofed GET /unresolved without JWT rejected with 401 (actual: ${spoofedAdmin.status})`);

    const spoofedResolve = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved/${testAssignAId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": "SUPER_ADMIN",
        "x-user-id": "usr_superadmin",
      },
      body: JSON.stringify({ action: "MANUAL_ASSIGN", store_id: testStoreId, partner_id: testPartnerAId, override_reason: "Spoof test" }),
    });
    assert(spoofedResolve.status === 401, `Header-spoofed POST /resolve without JWT rejected with 401 (actual: ${spoofedResolve.status})`);

    // ── 5. MATRIX CHECK 3: EXPIRED & TAMPERED TOKENS (401) ───────────────────
    markProgress("Matrix 3: Testing expired and tampered cryptographic tokens...");

    const expRes = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expRes.status === 401, `Expired token GET /unresolved rejected with 401 (actual: ${expRes.status})`);

    const tampRes = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert(tampRes.status === 401, `Tampered token GET /unresolved rejected with 401 (actual: ${tampRes.status})`);

    // ── 6. MATRIX CHECK 4: ROLE ACCESS PERMUTATIONS (SUPER ADMIN & REVIEWER) ──
    markProgress("Matrix 4: Testing Super Admin and Authorized Logistics Reviewer permissions...");

    // Super Admin: View & Manage
    const saView = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(saView.status === 200, `Super Admin GET /unresolved permitted (200)`);

    // Logistics Reviewer: View
    const revView = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert(revView.status === 200, `Authorized Reviewer GET /unresolved permitted (200)`);

    // Logistics Reviewer: Manage (Preview)
    const revPreview = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({
        entity_type: "GIFTING_RECIPIENT",
        entity_id: "preview_recip_1",
        delivery_address: "100ft Road Indiranagar",
        latitude: 12.9716,
        longitude: 77.6412,
      }),
    });
    assert(revPreview.status === 200, `Authorized Reviewer POST /preview permitted (200)`);

    // ── 7. MATRIX CHECK 5: READ-ONLY VIEWER & BASIC STAFF DENIALS (403) ───────
    markProgress("Matrix 5: Testing Read-Only Viewer and Basic Staff permission enforcement...");

    // Read-only Viewer can view
    const roView = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(roView.status === 200, `Read-Only Viewer GET /unresolved permitted (200)`);

    // Read-only Viewer CANNOT manage / resolve
    const roResolve = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved/${testAssignAId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${viewerToken}` },
      body: JSON.stringify({ action: "MANUAL_ASSIGN", store_id: testStoreId, partner_id: testPartnerAId, override_reason: "Read-only override attempt" }),
    });
    assert(roResolve.status === 403, `Read-Only Viewer POST /resolve denied with 403 (actual: ${roResolve.status})`);

    // Basic Staff cannot view
    const bsView = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${basicStaffToken}` },
    });
    assert(bsView.status === 403, `Basic Staff GET /unresolved denied with 403 (actual: ${bsView.status})`);

    // Basic Staff cannot resolve
    const bsResolve = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved/${testAssignAId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${basicStaffToken}` },
      body: JSON.stringify({ action: "MANUAL_ASSIGN", store_id: testStoreId, partner_id: testPartnerAId, override_reason: "Basic staff override attempt" }),
    });
    assert(bsResolve.status === 403, `Basic Staff POST /resolve denied with 403 (actual: ${bsResolve.status})`);

    // ── 8. MATRIX CHECK 6: CORPORATE CUSTOMER TENANT ISOLATION ───────────────
    markProgress("Matrix 6: Testing Corporate Customer tenant isolation and cross-account rejection...");

    // Customer cannot access admin routing queue
    const custQueue = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    assert(custQueue.status === 403, `Customer accessing admin routing queue denied with 403 (actual: ${custQueue.status})`);

    // Customer A can view their own batch
    const custAOwn = await fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/batches/${testBatchAId}`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    assert(custAOwn.status === 200, `Customer A viewing own batch permitted (200)`);

    // Customer A CANNOT view Customer B's batch (Cross-tenant rejection)
    const custACross = await fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/batches/${testBatchBId}`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    assert(custACross.status === 404 || custACross.status === 403, `Customer A accessing Customer B's batch rejected with 404/403 (actual: ${custACross.status})`);

    // Customer A CANNOT submit campaign for Customer B
    const custASpoofB = await fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerAToken}` },
      body: JSON.stringify({ customerId: testCustomerBId, fileBase64: Buffer.from("test").toString("base64") }),
    });
    assert(custASpoofB.status === 403, `Customer A submitting for Customer B rejected with 403 (actual: ${custASpoofB.status})`);

    // ── 9. MATRIX CHECK 7: CROSS-PARTNER ASSIGNMENT ISOLATION ────────────────
    markProgress("Matrix 7: Testing Delivery Partner isolation and cross-partner update rejection...");

    // Partner A updates Delivery A (Assigned to Partner A) -> PERMITTED
    const partAOwn = await fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/recipients/${testRecipAId}/delivery-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${partnerAToken}` },
      body: JSON.stringify({ deliveryStatus: "out_for_delivery", notes: "Rider A en route" }),
    });
    assert(partAOwn.status === 200, `Partner A updating Delivery A permitted (200)`);

    // Partner B updates Delivery A (Assigned to Partner A) -> STRICTLY DENIED (403)
    const partBCross = await fetch(`${BASE_URL}/api/v1/admin/corporate-gifting/recipients/${testRecipAId}/delivery-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${partnerBToken}` },
      body: JSON.stringify({ deliveryStatus: "delivered", notes: "Rider B illegitimate update" }),
    });
    assert(partBCross.status === 403, `Partner B updating Partner A's delivery rejected with 403 (actual: ${partBCross.status})`);

    // Partner B cannot access admin routing
    const partBRouting = await fetch(`${BASE_URL}/api/v1/admin/corporate-routing/unresolved`, {
      headers: { Authorization: `Bearer ${partnerBToken}` },
    });
    assert(partBRouting.status === 403, `Partner B accessing admin routing denied with 403 (actual: ${partBRouting.status})`);

    markProgress("All security matrix test cases passed!");

    // ── 10. CLEAN TEARDOWN ───────────────────────────────────────────────────
    markProgress("Cleaning up isolated security fixtures...");
    await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
    await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id = $1;", [testAssignAId]);
    await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

    await client.query("DELETE FROM public.corporate_delivery_assignment WHERE id = $1;", [testAssignAId]);
    await client.query("DELETE FROM public.corporate_gifting_recipient WHERE id IN ($1, $2);", [testRecipAId, testRecipBId]);
    await client.query("DELETE FROM public.delivery WHERE id IN ($1, $2);", [testDelivAId, testDelivBId]);
    await client.query("DELETE FROM public.corporate_gifting_batch WHERE id IN ($1, $2);", [testBatchAId, testBatchBId]);
    await client.query("DELETE FROM public.corporate_account WHERE id IN ($1, $2);", [testAccountAId, testAccountBId]);
    await client.query("DELETE FROM public.customer WHERE id IN ($1, $2);", [testCustomerAId, testCustomerBId]);
    await client.query("DELETE FROM public.delivery_partner_profile WHERE partner_id IN ($1, $2);", [testPartnerAId, testPartnerBId]);
    await client.query("DELETE FROM public.delivery_partner WHERE id IN ($1, $2);", [testPartnerAId, testPartnerBId]);
    await client.query("DELETE FROM public.branch WHERE id = $1;", [testStoreId]);

    // ── 11. POSTFLIGHT INVARIANTS ────────────────────────────────────────────
    markProgress("Verifying postflight baseline invariants...");
    const postCoA = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
    const postJL = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
    const postDP = await client.query("SELECT count(*)::int as cnt FROM public.delivery_partner WHERE deleted_at IS NULL;");
    const postBranch = await client.query("SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int as active FROM public.branch;");

    assert(postCoA.rows[0].cnt === 100, `Postflight CoA is exactly 100 accounts: ${postCoA.rows[0].cnt}`);
    assert(Number(postJL.rows[0].dr) === 3380.0 && Number(postJL.rows[0].cr) === 3380.0, `Postflight TB strictly balanced Dr/Cr ₹3,380.00`);
    assert(postDP.rows[0].cnt === 30, `Postflight Delivery Partners preserved: ${postDP.rows[0].cnt}`);
    assert(postBranch.rows[0].active === 48, `Postflight Active Branches preserved: ${postBranch.rows[0].active}`);

    console.log("\n==================================================================");
    console.log(`C7.14 SECURITY MATRIX SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================================");

    await client.end();
    clearTimeout(timer);
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ Error during Security Matrix suite (last op: "${lastProgress}"):`, err);
    try {
      await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id = $1;", [testAssignAId]);
      await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");
      await client.query("DELETE FROM public.corporate_delivery_assignment WHERE id = $1;", [testAssignAId]);
      await client.query("DELETE FROM public.corporate_gifting_recipient WHERE id IN ($1, $2);", [testRecipAId, testRecipBId]);
      await client.query("DELETE FROM public.delivery WHERE id IN ($1, $2);", [testDelivAId, testDelivBId]);
      await client.query("DELETE FROM public.corporate_gifting_batch WHERE id IN ($1, $2);", [testBatchAId, testBatchBId]);
      await client.query("DELETE FROM public.corporate_account WHERE id IN ($1, $2);", [testAccountAId, testAccountBId]);
      await client.query("DELETE FROM public.customer WHERE id IN ($1, $2);", [testCustomerAId, testCustomerBId]);
      await client.query("DELETE FROM public.delivery_partner_profile WHERE partner_id IN ($1, $2);", [testPartnerAId, testPartnerBId]);
      await client.query("DELETE FROM public.delivery_partner WHERE id IN ($1, $2);", [testPartnerAId, testPartnerBId]);
      await client.query("DELETE FROM public.branch WHERE id = $1;", [testStoreId]);
      await client.end();
    } catch {}
    clearTimeout(timer);
    process.exit(1);
  }
}

runSecurityMatrix();
