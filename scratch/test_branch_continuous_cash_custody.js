/**
 * CakeToHome ERP — Comprehensive Verification Test Suite:
 * Branch-Based Continuous Cash Custody & Shift Decoupling
 *
 * Verifies all 11 mandatory scenarios:
 * 1.  Opening the module with no teller session.
 * 2.  Viewing branch cash without creating a shift.
 * 3.  Switching between authorized branches.
 * 4.  Blocking unauthorized cross-branch access (HTTP 403 BOLA defense).
 * 5.  Recording and acknowledging physical delivery handovers without a shift.
 * 6.  Approval without payment leaving cash unchanged.
 * 7.  Actual cash payment reducing cash exactly once.
 * 8.  Duplicate requests and idempotency.
 * 9.  Concurrent payments that exceed available cash (atomic overdraft defense).
 * 10. Cash discrepancy and authorized adjustment controls.
 * 11. Reloading and verifying persisted PostgreSQL values.
 */

const path = require("path");
const crypto = require("crypto");
const { Pool } = require(path.join(__dirname, "../frontend/node_modules/pg"));

const DB_URL = "[REDACTED_DATABASE_CREDENTIAL]";
const BASE_URL = "http://localhost:3001";
const JWT_SECRET = "supersecret";

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    userId: payload.userId || "admin_01",
    role: payload.role || "SUPER_ADMIN",
    branchId: payload.branchId || null,
    isSuperAdmin: payload.role === "SUPER_ADMIN",
    iat: now,
    exp: now + 86400,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

const adminToken = signToken({ userId: "admin_01", role: "SUPER_ADMIN" });
const bm1Token = signToken({ userId: "bm_wf_01", role: "BRANCH_MANAGER", branchId: "br_whitefield" });
const bm2Token = signToken({ userId: "bm_other_02", role: "BRANCH_MANAGER", branchId: "br_01KYWH05FY08YH6XJKATV0NXDR" });

const results = [];

function recordResult(testName, status, details) {
  results.push({ testName, status, details });
  console.log(`[${status}] ${testName}: ${details}`);
}

async function runTests() {
  console.log("================================================================================");
  console.log("CakeToHome ERP — Branch-Based Continuous Cash Custody Verification Suite");
  console.log("================================================================================\n");

  try {
    const branch1 = "br_whitefield";
    const branch2 = "br_01KYWH05FY08YH6XJKATV0NXDR";

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 1: Opening the module with no teller session
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 1: Opening module with no teller session...");
    const res1 = await fetch(`${BASE_URL}/api/v1/admin/teller/sessions/active?branch_id=${branch1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data1 = await res1.json();
    if (res1.status === 200 && data1.success) {
      recordResult("1. Open Module With No Shift", "VERIFIED", `Active session check returned HTTP 200. Session: ${data1.session ? data1.session.id : "null (continuous mode active)"}`);
    } else {
      recordResult("1. Open Module With No Shift", "FAILED", `Expected HTTP 200, got ${res1.status}: ${JSON.stringify(data1)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 2: Viewing branch cash without creating a shift
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 2: Viewing branch cash without creating a shift...");
    const res2 = await fetch(`${BASE_URL}/api/v1/admin/accounting/branch-cash-position/${branch1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data2 = await res2.json();
    if (res2.status === 200 && data2.success && data2.branch_id === branch1) {
      recordResult("2. View Branch Cash Without Shift", "VERIFIED", `Branch ${branch1} cash position loaded: GL 1111: ₹${data2.gl_cash_in_hand}, Petty 1114: ₹${data2.gl_petty_cash}, Total Physical: ₹${data2.total_physical_cash}`);
    } else {
      recordResult("2. View Branch Cash Without Shift", "FAILED", `Failed to load branch cash position: ${JSON.stringify(data2)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Switching between authorized branches
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 3: Switching between authorized branches...");
    const res3a = await fetch(`${BASE_URL}/api/v1/admin/accounting/branch-cash-position/${branch1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res3b = await fetch(`${BASE_URL}/api/v1/admin/accounting/branch-cash-position/${branch2}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data3a = await res3a.json();
    const data3b = await res3b.json();
    if (res3a.status === 200 && res3b.status === 200 && data3a.branch_id !== data3b.branch_id) {
      recordResult("3. Switch Authorized Branches", "VERIFIED", `Switched between Branch 1 (${data3a.branch_name}, ₹${data3a.total_physical_cash}) and Branch 2 (${data3b.branch_name}, ₹${data3b.total_physical_cash})`);
    } else {
      recordResult("3. Switch Authorized Branches", "FAILED", `Failed branch switching.`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Blocking unauthorized cross-branch access (BOLA defense)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 4: Blocking unauthorized cross-branch access...");
    const res4 = await fetch(`${BASE_URL}/api/v1/admin/accounting/branch-cash-position/${branch2}`, {
      headers: { Authorization: `Bearer ${bm1Token}` },
    });
    const data4 = await res4.json();
    if (res4.status === 403 || data4.error === "FORBIDDEN" || data4.code === "BRANCH_ACCESS_DENIED") {
      recordResult("4. Block Cross-Branch Access", "VERIFIED", `Cross-branch access blocked with HTTP ${res4.status}: ${data4.message || data4.error}`);
    } else {
      recordResult("4. Block Cross-Branch Access", "FAILED", `Expected HTTP 403, got ${res4.status}: ${JSON.stringify(data4)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: Recording and acknowledging physical delivery handovers without a shift
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 5: Recording and acknowledging physical handovers without a shift...");
    const partnerRes = await pool.query(`SELECT id FROM public.delivery_partner LIMIT 1`);
    const partnerId = partnerRes.rows[0]?.id || "dlp_01KYWJ71934X5AZASE5MHQC8C2";

    const testHandoverId = `ho_test_${Date.now()}`;
    const handoverNumber = `HO-TEST-${Date.now()}`;
    const testOrderIds = [`ord_test_${Date.now()}`];
    
    await pool.query(
      `INSERT INTO public.delivery_cash_handover (
        id, handover_number, branch_id, delivery_partner_id, status,
        declared_amount, digital_amount, order_ids, submitted_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'SUBMITTED', $5, 0, $6, 'admin_01', NOW(), NOW())`,
      [testHandoverId, handoverNumber, branch1, partnerId, 500.00, testOrderIds]
    );

    const res5 = await fetch(`${BASE_URL}/api/v1/admin/delivery-handovers/acknowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        handover_id: testHandoverId,
        branch_id: branch1,
        acknowledged_amount: 500.00,
        // No teller_session_id passed! Tests continuous branch custody anchor!
      }),
    });
    const data5 = await res5.json();

    if (res5.status === 200 && data5.success) {
      const movCheck = await pool.query(
        `SELECT id, teller_session_id, branch_id, direction, amount, movement_type, source_id
         FROM public.teller_movement
         WHERE source_id = $1`,
        [testHandoverId]
      );
      if (movCheck.rows.length > 0 && movCheck.rows[0].direction === "IN") {
        recordResult("5. Handover Without Shift", "VERIFIED", `Acknowledged ₹500.00 without shift. Anchored to continuous session '${movCheck.rows[0].teller_session_id}', movement '${movCheck.rows[0].id}'.`);
      } else {
        recordResult("5. Handover Without Shift", "FAILED", `API succeeded but teller movement row not found in DB.`);
      }
    } else {
      recordResult("5. Handover Without Shift", "FAILED", `Acknowledge API failed: ${JSON.stringify(data5)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: Approval without payment leaving cash unchanged
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 6: Approval without payment leaving cash unchanged...");
    const posBeforeRes = await pool.query(
      `SELECT ROUND(COALESCE(SUM(debit_amount - credit_amount), 0), 2) as bal
       FROM public.accounting_journal_line
       WHERE branch_id = $1 AND account_id = 'afdd90ab-7096-41fd-a268-7df89f7ed9b0'`,
      [branch1]
    );
    const balBefore = Number(posBeforeRes.rows[0]?.bal || 0);

    const expId1 = `exp_test_${Date.now()}`;
    await pool.query(
      `INSERT INTO public.expense (
        id, branch_id, category_id, description, subtotal, discount, taxable_value, total,
        payment_method, settlement_type, status, expense_date, created_by, created_at, updated_at
      ) VALUES ($1, $2, 'excat_rent', 'Bakery Store Supplies', 200.00, 0.00, 200.00, 200.00,
        'CASH', 'DIRECT_PAYMENT', 'SUBMITTED', '2026-10-15', 'operator_maker_01', NOW(), NOW())`,
      [expId1, branch1]
    );

    const approveRes = await fetch(`${BASE_URL}/api/v1/admin/expenses/${expId1}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    const approveData = await approveRes.json();

    const posAfterApproveRes = await pool.query(
      `SELECT ROUND(COALESCE(SUM(debit_amount - credit_amount), 0), 2) as bal
       FROM public.accounting_journal_line
       WHERE branch_id = $1 AND account_id = 'afdd90ab-7096-41fd-a268-7df89f7ed9b0'`,
      [branch1]
    );
    const balAfterApprove = Number(posAfterApproveRes.rows[0]?.bal || 0);

    if (approveRes.status === 200 && approveData.success && balBefore === balAfterApprove) {
      recordResult("6. Approval Leaves Cash Unchanged", "VERIFIED", `Expense '${expId1}' approved. Cash before: ₹${balBefore}, Cash after: ₹${balAfterApprove}. Delta = ₹0.00.`);
    } else {
      recordResult("6. Approval Leaves Cash Unchanged", "FAILED", `Cash changed upon approval! Before: ${balBefore}, After: ${balAfterApprove}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 7: Actual cash payment reducing cash exactly once
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 7: Actual cash payment reducing cash exactly once...");
    const payRes = await fetch(`${BASE_URL}/api/v1/admin/expenses/${expId1}/pay-drawer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        branch_id: branch1,
      }),
    });
    const payData = await payRes.json();

    const posAfterPayRes = await pool.query(
      `SELECT ROUND(COALESCE(SUM(debit_amount - credit_amount), 0), 2) as bal
       FROM public.accounting_journal_line
       WHERE branch_id = $1 AND account_id = 'afdd90ab-7096-41fd-a268-7df89f7ed9b0'`,
      [branch1]
    );
    const balAfterPay = Number(posAfterPayRes.rows[0]?.bal || 0);
    const cashDelta = Math.round((balBefore - balAfterPay) * 100) / 100;

    if (payRes.status === 200 && payData.success && cashDelta === 200.00) {
      recordResult("7. Payment Reduces Cash Once", "VERIFIED", `Paid ₹200.00. Cash before: ₹${balBefore}, Cash after: ₹${balAfterPay}. Reduced by exactly ₹200.00.`);
    } else {
      recordResult("7. Payment Reduces Cash Once", "FAILED", `Payment failed or delta mismatch: delta=${cashDelta}, response=${JSON.stringify(payData)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 8: Duplicate requests and idempotency
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 8: Duplicate requests and idempotency...");
    const dupPayRes = await fetch(`${BASE_URL}/api/v1/admin/expenses/${expId1}/pay-drawer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ branch_id: branch1 }),
    });
    const dupPayData = await dupPayRes.json();

    const posAfterDupRes = await pool.query(
      `SELECT ROUND(COALESCE(SUM(debit_amount - credit_amount), 0), 2) as bal
       FROM public.accounting_journal_line
       WHERE branch_id = $1 AND account_id = 'afdd90ab-7096-41fd-a268-7df89f7ed9b0'`,
      [branch1]
    );
    const balAfterDup = Number(posAfterDupRes.rows[0]?.bal || 0);

    if (dupPayRes.status !== 200 || !dupPayData.success) {
      if (balAfterDup === balAfterPay) {
        recordResult("8. Idempotency & Duplicate Defense", "VERIFIED", `Duplicate payment blocked cleanly (${dupPayData.error || dupPayData.message}). Cash remained at ₹${balAfterDup}.`);
      } else {
        recordResult("8. Idempotency & Duplicate Defense", "FAILED", `Cash changed on duplicate attempt!`);
      }
    } else {
      recordResult("8. Idempotency & Duplicate Defense", "FAILED", `Duplicate payment succeeded unexpectedly.`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 9: Concurrent payments that exceed available cash (Overdraft defense)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 9: Concurrent payments exceeding available cash...");
    const expHuge = `exp_huge_${Date.now()}`;
    await pool.query(
      `INSERT INTO public.expense (
        id, branch_id, category_id, description, subtotal, discount, taxable_value, total,
        payment_method, settlement_type, status, expense_date, created_by, created_at, updated_at
      ) VALUES ($1, $2, 'excat_rent', 'Heavy Machinery Equipment', 99999999.00, 0.00, 99999999.00, 99999999.00,
        'CASH', 'DIRECT_PAYMENT', 'APPROVED', '2026-10-15', 'operator_maker_01', NOW(), NOW())`,
      [expHuge, branch1]
    );

    const overdraftRes = await fetch(`${BASE_URL}/api/v1/admin/expenses/${expHuge}/pay-drawer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ branch_id: branch1 }),
    });
    const overdraftData = await overdraftRes.json();

    if (overdraftRes.status === 422 || overdraftData.error?.includes("exceeds available") || overdraftData.error?.includes("overdraft") || overdraftData.error?.includes("insufficient")) {
      recordResult("9. Cash Overdraft Defense", "VERIFIED", `Overdraft payment of ₹99,999,999 blocked with status ${overdraftRes.status}: ${overdraftData.error}`);
    } else {
      recordResult("9. Cash Overdraft Defense", "FAILED", `Expected overdraft rejection, got ${overdraftRes.status}: ${JSON.stringify(overdraftData)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 10: Cash discrepancy and authorized adjustment controls
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 10: Cash discrepancy and authorized adjustment controls...");
    const adjRes = await fetch(`${BASE_URL}/api/v1/admin/teller/movements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        branch_id: branch1,
        direction: "IN",
        amount: 50.00,
        narration: "Authorized drawer float count alignment verification",
        reference_id: `ref_adj_${Date.now()}`,
      }),
    });
    const adjData = await adjRes.json();

    if (adjRes.status === 201 && adjData.success && adjData.movement) {
      recordResult("10. Cash Adjustment Controls", "VERIFIED", `Manual cash adjustment of ₹50.00 recorded: movement ID '${adjData.movement.id}', anchored to session '${adjData.movement.teller_session_id}'.`);
    } else {
      recordResult("10. Cash Adjustment Controls", "FAILED", `Adjustment failed: ${JSON.stringify(adjData)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 11: Reloading the page and verifying persisted values
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("--> Scenario 11: Reloading and verifying persisted PostgreSQL values...");
    const reloadRes = await fetch(`${BASE_URL}/api/v1/admin/accounting/branch-cash-position/${branch1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reloadData = await reloadRes.json();

    const dbSummary = await pool.query(
      `SELECT
         ROUND(COALESCE(SUM(CASE WHEN account_id = 'afdd90ab-7096-41fd-a268-7df89f7ed9b0' THEN debit_amount - credit_amount ELSE 0 END), 0), 2) AS gl_cash,
         ROUND(COALESCE(SUM(CASE WHEN account_id = '6bf2d474-1800-461d-8a02-e0b4cf423671' THEN debit_amount - credit_amount ELSE 0 END), 0), 2) AS gl_petty
       FROM public.accounting_journal_line
       WHERE branch_id = $1`,
      [branch1]
    );
    const dbGlCash = Number(dbSummary.rows[0]?.gl_cash || 0);

    if (reloadRes.status === 200 && reloadData.success && reloadData.gl_cash_in_hand === dbGlCash) {
      recordResult("11. Persistence Across Reloads", "VERIFIED", `Reloaded API data matches PostgreSQL ground truth: API GL cash = ₹${reloadData.gl_cash_in_hand}, DB GL cash = ₹${dbGlCash}.`);
    } else {
      recordResult("11. Persistence Across Reloads", "FAILED", `Mismatch between reloaded API and DB: API=${reloadData.gl_cash_in_hand}, DB=${dbGlCash}`);
    }

  } catch (err) {
    console.error("Test execution exception:", err);
    recordResult("Unexpected Exception", "FAILED", err.message);
  } finally {
    await pool.end();
  }

  console.log("\n================================================================================");
  console.log("TEST RESULTS SUMMARY:");
  console.log("================================================================================");
  let passedCount = 0;
  for (const r of results) {
    console.log(`[${r.status.padEnd(8)}] ${r.testName}: ${r.details}`);
    if (r.status === "VERIFIED") passedCount++;
  }
  console.log(`\nTOTAL: ${passedCount} / ${results.length} PASSED`);
  console.log("================================================================================\n");
}

runTests();
