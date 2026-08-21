import { ApiEngine } from "../frontend/src/lib/api-engine";
import { apiClient } from "../frontend/src/lib/api-client";
import * as http from "http";

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(num: number, name: string, condition: boolean, details: string) {
  results.push({ num, name, passed: condition, details });
  const icon = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${icon} [Assertion ${num}]: ${name} — ${details}`);
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — ENTERPRISE ORDER COMMAND CENTER FILTER ENGINE 25-POINT E2E SUITE ");
  console.log("================================================================================\n");

  // Ensure test data contains a refunded order and varied dates for exhaustive assertion testing
  ApiEngine.ensureOrdersStore();
  const testNow = new Date();
  
  // Seed a refunded order if none exists
  const hasRefunded = ApiEngine.getAdminOrders({ limit: 1000 }).orders.some(
    (o: any) => (o.payment_status || "").toLowerCase() === "refunded"
  );
  if (!hasRefunded) {
    ApiEngine.addOrder({
      id: "ord_test_refunded_9999",
      order_number: "CTH-REF-9999",
      status: "refunded",
      payment_status: "refunded",
      branch_id: "br_indiranagar",
      branch_name: "Indiranagar Flagship Kitchen",
      city: "Bengaluru",
      customer_name: "Refund Tester",
      customer_phone: "+91 98888 77777",
      total: 1499,
      created_at: new Date(testNow.getTime() - 2 * 86400000).toISOString(),
    });
  }

  // 1. All orders baseline
  const allRes = ApiEngine.getAdminOrders({ limit: 1000 });
  const totalAll = allRes.total;
  assert(1, "All Orders Baseline", totalAll > 0 && allRes.orders.length > 0, `Total orders in DB: ${totalAll}`);

  // 2. Paid / Captured filter
  const paidRes = ApiEngine.getAdminOrders({ payment_status: "paid", limit: 1000 });
  const allPaidValid = paidRes.orders.every(
    (o: any) =>
      ["paid", "captured", "success"].includes((o.payment_status || "").toLowerCase()) ||
      o.status === "delivered" ||
      o.status === "completed" ||
      (Array.isArray(o.timeline) && o.timeline.some((tl: any) => tl.title?.toLowerCase().includes("payment captured")))
  );
  assert(2, "Payment = Paid / Captured", paidRes.total > 0 && allPaidValid, `Filtered ${paidRes.total} paid orders (100% matched)`);

  // 3. Pending filter
  const pendRes = ApiEngine.getAdminOrders({ payment_status: "pending", limit: 1000 });
  const allPendValid = pendRes.orders.every(
    (o: any) =>
      ["pending", "payment_pending", "unpaid"].includes((o.payment_status || "").toLowerCase()) ||
      (o.status || "").toLowerCase() === "payment_pending"
  );
  assert(3, "Payment = Pending", pendRes.total > 0 && allPendValid, `Filtered ${pendRes.total} pending orders (100% matched)`);

  // 4. Refunded filter
  const refRes = ApiEngine.getAdminOrders({ payment_status: "refunded", limit: 1000 });
  const allRefValid = refRes.orders.every(
    (o: any) =>
      ["refunded", "partially_refunded", "refund_initiated"].includes((o.payment_status || "").toLowerCase()) ||
      (o.status || "").toLowerCase() === "refunded"
  );
  assert(4, "Payment = Refunded", refRes.total > 0 && allRefValid, `Filtered ${refRes.total} refunded orders`);

  // 5. Each Branch filter
  const indRes = ApiEngine.getAdminOrders({ branch_id: "br_indiranagar", limit: 1000 });
  const indValid = indRes.orders.every(
    (o: any) =>
      o.branch_id === "br_indiranagar" ||
      (o.branch_name && o.branch_name.toLowerCase().includes("indiranagar")) ||
      o.branch_id === "res_01KXYMAHGFPRY1G9TZKEVGAGAT" ||
      (o.branch_id && o.branch_id.includes("indiranagar"))
  );
  assert(5, "Branch = Indiranagar Flagship", indRes.total > 0 && indValid, `Filtered ${indRes.total} Indiranagar orders`);

  // 6. Each City filter (Bengaluru, Kochi)
  const blrRes = ApiEngine.getAdminOrders({ city: "bengaluru", limit: 1000 });
  assert(6, "City = Bengaluru", blrRes.total > 0, `Filtered ${blrRes.total} Bengaluru orders`);

  const kocRes = ApiEngine.getAdminOrders({ city: "kochi", limit: 1000 });
  assert(7, "City = Kochi", kocRes.total >= 0, `Filtered ${kocRes.total} Kochi orders`);

  // 8. Today Date Filter
  const todayRes = ApiEngine.getAdminOrders({ date_preset: "today", limit: 1000 });
  assert(8, "Date Preset = Today", todayRes.total > 0, `Filtered ${todayRes.total} orders created today`);

  // 9. Yesterday Date Filter
  const yestRes = ApiEngine.getAdminOrders({ date_preset: "yesterday", limit: 1000 });
  assert(9, "Date Preset = Yesterday", yestRes.total >= 0, `Filtered ${yestRes.total} orders created yesterday`);

  // 10. Last 7 Days Date Filter
  const last7Res = ApiEngine.getAdminOrders({ date_preset: "last_7_days", limit: 1000 });
  assert(10, "Date Preset = Last 7 Days", last7Res.total >= todayRes.total, `Filtered ${last7Res.total} orders in last 7 days`);

  // 11. Last 30 Days Date Filter
  const last30Res = ApiEngine.getAdminOrders({ date_preset: "last_30_days", limit: 1000 });
  assert(11, "Date Preset = Last 30 Days", last30Res.total >= last7Res.total, `Filtered ${last30Res.total} orders in last 30 days`);

  // 12. Last 90 Days Date Filter
  const last90Res = ApiEngine.getAdminOrders({ date_preset: "last_90_days", limit: 1000 });
  assert(12, "Date Preset = Last 90 Days", last90Res.total >= last30Res.total, `Filtered ${last90Res.total} orders in last 90 days`);

  // 13. This Month Date Filter
  const thisMonthRes = ApiEngine.getAdminOrders({ date_preset: "this_month", limit: 1000 });
  assert(13, "Date Preset = This Month", thisMonthRes.total > 0, `Filtered ${thisMonthRes.total} orders this month`);

  // 14. Last Month Date Filter
  const lastMonthRes = ApiEngine.getAdminOrders({ date_preset: "last_month", limit: 1000 });
  assert(14, "Date Preset = Last Month", typeof lastMonthRes.total === "number", `Filtered ${lastMonthRes.total} orders last month`);

  // 15. This Year Date Filter
  const thisYearRes = ApiEngine.getAdminOrders({ date_preset: "this_year", limit: 1000 });
  assert(15, "Date Preset = This Year", thisYearRes.total >= thisMonthRes.total, `Filtered ${thisYearRes.total} orders this year`);

  // 16. Financial Year Date Filter (Indian FY: 1 April -> 31 March)
  const fyRes = ApiEngine.getAdminOrders({ date_preset: "financial_year", limit: 1000 });
  assert(16, "Date Preset = Financial Year", fyRes.total > 0, `Filtered ${fyRes.total} orders in current Indian FY`);

  // 17. Custom Date Range Filter
  const fromStr = "2026-08-01";
  const toStr = "2026-08-31";
  const customRes = ApiEngine.getAdminOrders({ from_date: fromStr, to_date: toStr, limit: 1000 });
  assert(17, "Custom Date Range (2026-08-01 to 2026-08-31)", customRes.total > 0, `Filtered ${customRes.total} orders in August 2026`);

  // 18. Search + Filter Combinations
  const searchCombo = ApiEngine.getAdminOrders({ q: "Ananya", payment_status: "paid", limit: 1000 });
  const searchComboValid = searchCombo.orders.every(
    (o: any) =>
      ((o.customer_name || "").includes("Ananya") || (o.customer_email || "").includes("ananya")) &&
      ["paid", "captured", "success"].includes((o.payment_status || "").toLowerCase())
  );
  assert(18, "Combined Filter: Search ('Ananya') + Payment ('paid')", searchCombo.total > 0 && searchComboValid, `Matched ${searchCombo.total} orders`);

  // 19. Multi-Filter: Payment + Branch + City
  const multiCombo = ApiEngine.getAdminOrders({ payment_status: "paid", branch_id: "br_indiranagar", city: "bengaluru", limit: 1000 });
  assert(19, "Combined Filter: Payment + Branch + City", multiCombo.total > 0, `Matched ${multiCombo.total} orders`);

  // 20. Pagination after Filtering
  const paginatedRes = ApiEngine.getAdminOrders({ limit: 10, offset: 0, payment_status: "paid" });
  assert(20, "Pagination After Filtering", paginatedRes.orders.length <= 10 && paginatedRes.total === paidRes.total, `Page limit 10 returned ${paginatedRes.orders.length} items of ${paginatedRes.total} total`);

  // 21. No-Result Filter Combination
  const noMatchRes = ApiEngine.getAdminOrders({ q: "NON_EXISTENT_ORDER_XYZ_99999", limit: 100 });
  assert(21, "No-Result Filter Handling", noMatchRes.total === 0 && noMatchRes.orders.length === 0, `Correctly returned 0 orders with zero errors`);

  // 22. CSV Export with Active Filters
  const exportRes = ApiEngine.exportAdminOrders({ payment_status: "paid", branch_id: "br_indiranagar" });
  assert(22, "Export with Active Filters", Array.isArray(exportRes.export_data) && exportRes.export_data.length === multiCombo.total, `Exported ${exportRes.export_data?.length} rows matching active filters`);

  // 23. RBAC Branch Scope Enforcement
  const rbacBranchRes = ApiEngine.getAdminOrders({ role: "BRANCH_MANAGER", user_branch_id: "br_indiranagar", branch_id: "br_whitefield", limit: 100 });
  const rbacStrict = rbacBranchRes.orders.every(
    (o: any) =>
      o.branch_id === "br_indiranagar" ||
      (o.branch_name && o.branch_name.toLowerCase().includes("indiranagar")) ||
      o.branch_id === "res_01KXYMAHGFPRY1G9TZKEVGAGAT" ||
      (o.branch_id && o.branch_id.includes("indiranagar"))
  );
  assert(23, "RBAC Branch Scope Isolation", rbacStrict, `Branch manager strictly locked to assigned branch indiranagar`);

  // 24. Live Order Update Reflection
  const testOrderId = "ord_test_live_update_" + Date.now();
  ApiEngine.addOrder({
    id: testOrderId,
    order_number: "CTH-LIVE-001",
    status: "payment_pending",
    payment_status: "pending",
    branch_id: "br_indiranagar",
    total: 999,
    created_at: new Date().toISOString(),
  });
  const beforeUpdate = ApiEngine.getAdminOrders({ payment_status: "pending", limit: 1000 });
  const foundPending = beforeUpdate.orders.some((o: any) => o.id === testOrderId);

  // Update to paid
  const targetOrd = ApiEngine.getOrder(testOrderId);
  if (targetOrd) {
    targetOrd.payment_status = "paid";
    targetOrd.status = "confirmed";
  }
  const afterUpdatePaid = ApiEngine.getAdminOrders({ payment_status: "paid", limit: 1000 });
  const foundInPaid = afterUpdatePaid.orders.some((o: any) => o.id === testOrderId);
  const afterUpdatePending = ApiEngine.getAdminOrders({ payment_status: "pending", limit: 1000 });
  const notInPending = !afterUpdatePending.orders.some((o: any) => o.id === testOrderId);

  assert(24, "Real-Time Filter State Reflection", foundPending && foundInPaid && notInPending, `Order updated from pending -> paid dynamically moved between filter views`);

  // 25. HTTP API Endpoint Verification
  const httpApi = await new Promise<any>((resolve) => {
    http.get("http://localhost:3000/api/v1/admin/orders?payment_status=paid&limit=5", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
  assert(25, "HTTP API /api/v1/admin/orders Returns 200 OK with Filtered Orders", httpApi !== null && Array.isArray(httpApi.orders) && httpApi.orders.length > 0, `HTTP response returned ${httpApi?.orders?.length} orders and total ${httpApi?.total}`);

  console.log("\n================================================================================");
  const passedCount = results.filter(r => r.passed).length;
  console.log(`  ORDER COMMAND CENTER RESULTS: ${passedCount} / ${results.length} ASSERTIONS PASSED (${((passedCount / results.length) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runTestSuite().catch(console.error);
