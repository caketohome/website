import { dbQuery } from "../src/lib/db";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Safety timer of 30 seconds
const safetyTimer = setTimeout(() => {
  console.error("❌ TIMEOUT: test-phase11-dashboard-verification exceeded 30s timeout");
  process.exit(1);
}, 30000);
safetyTimer.unref();

async function runDashboardVerification() {
  console.log("================================================================================");
  console.log("   PHASE 11 — FINAL DASHBOARD & ORDER DETAIL LIVE END-TO-END VERIFICATION");
  console.log("================================================================================\n");

  const adminHeaders = {
    "User-Agent": "Phase11Verification/1.0",
    Cookie: "_cth_jwt=test_admin_jwt; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=9999999999; cth_user_role=SUPER_ADMIN",
  };

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details = "") {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName} ${details ? `(${details})` : ""}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? `(${details})` : ""}`);
      failed++;
    }
  }

  // 1. Dashboard Root & Tabs
  const dashboardRoutes = [
    { name: "Dashboard Root (/dashboard)", path: "/dashboard" },
    { name: "Dashboard Tab: orders (/dashboard?tab=orders)", path: "/dashboard?tab=orders" },
    { name: "Dashboard Tab: catalog (/dashboard?tab=catalog)", path: "/dashboard?tab=catalog" },
    { name: "Dashboard Tab: branches (/dashboard?tab=branches)", path: "/dashboard?tab=branches" },
    { name: "Dashboard Tab: cms (/dashboard?tab=cms)", path: "/dashboard?tab=cms" },
    { name: "Dashboard Tab: reports (/dashboard?tab=reports)", path: "/dashboard?tab=reports" },
    { name: "Dashboard Tab: telemarketing (/dashboard?tab=telemarketing)", path: "/dashboard?tab=telemarketing" },
  ];

  console.log("--- 1. Testing Dashboard Routes & Tabs with Admin Session ---");
  for (const r of dashboardRoutes) {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${r.path}`, { headers: adminHeaders });
      const duration = Math.round(performance.now() - start);
      const text = await res.text();
      const status = res.status;
      const ok = status === 200;
      assert(ok, r.name, `HTTP ${status} in ${duration}ms, size ${text.length} bytes`);
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      assert(false, r.name, `Error after ${duration}ms: ${err.message}`);
    }
  }

  // 2. Order List -> Select Order -> Order Detail
  console.log("\n--- 2. Order List -> Select Order -> Order Detail Trace ---");
  const listStart = performance.now();
  const listUrl = `${BASE_URL}/api/v1/admin/orders?page=1&pageSize=10`;
  const listRes = await fetch(listUrl, { headers: adminHeaders });
  const listDuration = Math.round(performance.now() - listStart);
  assert(listRes.status === 200, "Admin Orders List API (GET /api/v1/admin/orders)", `HTTP ${listRes.status} in ${listDuration}ms`);

  const listData = await listRes.json();
  assert(listData.success === true, "Orders list reports success === true");
  assert(Array.isArray(listData.orders) && listData.orders.length > 0, "Orders list returns non-empty array", `Returned ${listData.orders?.length || 0} orders, total: ${listData.total}`);

  // Select an order from the list
  const selectedOrderFromList = listData.orders[0];
  const selectedOrderId = selectedOrderFromList.id;
  console.log(`\n  Selected Order from List: ${selectedOrderId} (Status: ${selectedOrderFromList.status})`);

  // Request order detail from DB-backed endpoint
  const detailStart = performance.now();
  const detailUrl = `${BASE_URL}/api/v1/admin/orders/${selectedOrderId}`;
  const detailRes = await fetch(detailUrl, { headers: adminHeaders });
  const detailDuration = Math.round(performance.now() - detailStart);
  assert(detailRes.status === 200, `Order Detail API (GET /api/v1/admin/orders/${selectedOrderId})`, `HTTP ${detailRes.status} in ${detailDuration}ms`);

  const detailData = await detailRes.json();
  assert(detailData.success === true, "Order detail response reports success === true");
  assert(detailData.order && detailData.order.id === selectedOrderId, "Order detail returns requested order ID", `Returned ${detailData.order?.id}`);

  // Check detail content integrity
  assert(
    detailData.order.status === selectedOrderFromList.status,
    "Order detail status matches order list status exactly",
    `List: ${selectedOrderFromList.status} === Detail: ${detailData.order.status}`
  );

  // 3. PostgreSQL Authoritative Trace Verification
  console.log("\n--- 3. Database Coherence & Authoritative Trace ---");
  const pgRes = await dbQuery(`SELECT * FROM "order" WHERE id = $1`, [selectedOrderId]);
  assert(pgRes.rows.length === 1, `Order ${selectedOrderId} exists in PostgreSQL authoritative "order" table`);

  const pgRow = pgRes.rows[0];
  const pgStatus = pgRow.metadata?.bakery_status || pgRow.status;
  assert(
    detailData.order.status === pgStatus,
    "Order detail status matches PostgreSQL row status directly",
    `API Detail: ${detailData.order.status} === PostgreSQL: ${pgStatus}`
  );

  console.log("\n================================================================================");
  console.log(`  PHASE 11 VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runDashboardVerification().catch((err) => {
  console.error("Dashboard verification fatal error:", err);
  process.exit(1);
});
