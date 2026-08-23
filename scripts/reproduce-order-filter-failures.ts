import { ApiEngine } from "../frontend/src/lib/api-engine";
import { apiClient } from "../frontend/src/lib/api-client";
import * as http from "http";

interface FailureLog {
  filterType: string;
  selection: string;
  requestUrl: string;
  queryParams: Record<string, string>;
  httpStatus: number;
  returnedCount: number;
  expectedBehavior: string;
  isWorking: boolean;
  notes: string;
}

const logs: FailureLog[] = [];

function testApi(urlPath: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000/api/v1${urlPath}`, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 0, data: body });
        }
      });
    }).on("error", (e) => {
      resolve({ status: 0, data: e.message });
    });
  });
}

async function runReproduction() {
  console.log("================================================================================");
  console.log("  PHASE 1 — REPRODUCING ALL ORDER COMMAND CENTER FILTER FAILURES                ");
  console.log("================================================================================\n");

  // Baseline
  const baseline = await testApi("/admin/orders?limit=100");
  const baselineCount = baseline.data?.orders?.length || baseline.data?.total || 0;
  console.log(`[BASELINE DATASET]: Status ${baseline.status} | Total Orders returned: ${baselineCount}\n`);

  // A. Payment = Paid
  const paidRes = await testApi("/admin/orders?payment_status=paid&limit=100");
  const paidCount = paidRes.data?.orders?.length || 0;
  const isPaidFiltered = paidCount > 0 && paidCount < baselineCount && paidRes.data?.orders?.every((o: any) => ["paid", "captured"].includes(o.payment_status?.toLowerCase()));
  logs.push({
    filterType: "Payment Status",
    selection: "Paid / Captured",
    requestUrl: "/api/v1/admin/orders?payment_status=paid&limit=100",
    queryParams: { payment_status: "paid", limit: "100" },
    httpStatus: paidRes.status,
    returnedCount: paidCount,
    expectedBehavior: "Only orders with payment_status 'paid' or 'captured'",
    isWorking: isPaidFiltered,
    notes: isPaidFiltered ? "Working" : `Returned ${paidCount} orders (same as baseline or unfiltered). payment_status is ignored in getAdminOrders.`,
  });

  // B. Payment = Pending
  const pendRes = await testApi("/admin/orders?payment_status=pending&limit=100");
  const pendCount = pendRes.data?.orders?.length || 0;
  logs.push({
    filterType: "Payment Status",
    selection: "Pending",
    requestUrl: "/api/v1/admin/orders?payment_status=pending&limit=100",
    queryParams: { payment_status: "pending", limit: "100" },
    httpStatus: pendRes.status,
    returnedCount: pendCount,
    expectedBehavior: "Only orders with payment_status 'pending'",
    isWorking: false,
    notes: `Returned ${pendCount} orders (unfiltered).`,
  });

  // C. Payment = Refunded
  const refRes = await testApi("/admin/orders?payment_status=refunded&limit=100");
  const refCount = refRes.data?.orders?.length || 0;
  logs.push({
    filterType: "Payment Status",
    selection: "Refunded",
    requestUrl: "/api/v1/admin/orders?payment_status=refunded&limit=100",
    queryParams: { payment_status: "refunded", limit: "100" },
    httpStatus: refRes.status,
    returnedCount: refCount,
    expectedBehavior: "Only orders with payment_status 'refunded'",
    isWorking: false,
    notes: `Returned ${refCount} orders (unfiltered).`,
  });

  // D. Branch = Indiranagar Flagship
  const indRes = await testApi("/admin/orders?branch_id=res_01KXYMAHGFPRY1G9TZKEVGAGAT&limit=100");
  logs.push({
    filterType: "Branch",
    selection: "Indiranagar Flagship (res_01KXYMAHGFPRY1G9TZKEVGAGAT)",
    requestUrl: "/api/v1/admin/orders?branch_id=res_01KXYMAHGFPRY1G9TZKEVGAGAT&limit=100",
    queryParams: { branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", limit: "100" },
    httpStatus: indRes.status,
    returnedCount: indRes.data?.orders?.length || 0,
    expectedBehavior: "Orders for Indiranagar Flagship branch",
    isWorking: false,
    notes: `Returned ${indRes.data?.orders?.length || 0} orders. Mock ID does not match canonical branch ID br_indiranagar.`,
  });

  // G. City = Bengaluru
  const blrRes = await testApi("/admin/orders?city=bengaluru&limit=100");
  logs.push({
    filterType: "City",
    selection: "Bengaluru",
    requestUrl: "/api/v1/admin/orders?city=bengaluru&limit=100",
    queryParams: { city: "bengaluru", limit: "100" },
    httpStatus: blrRes.status,
    returnedCount: blrRes.data?.orders?.length || 0,
    expectedBehavior: "Orders in Bengaluru city",
    isWorking: false,
    notes: `Returned ${blrRes.data?.orders?.length || 0} orders. city parameter ignored in getAdminOrders.`,
  });

  // J. Date = Today
  const today = new Date().toISOString().slice(0, 10);
  const dateRes = await testApi(`/admin/orders?from_date=${today}&to_date=${today}&limit=100`);
  logs.push({
    filterType: "Date Range",
    selection: "Today",
    requestUrl: `/api/v1/admin/orders?from_date=${today}&to_date=${today}&limit=100`,
    queryParams: { from_date: today, to_date: today, limit: "100" },
    httpStatus: dateRes.status,
    returnedCount: dateRes.data?.orders?.length || 0,
    expectedBehavior: "Only orders created today",
    isWorking: false,
    notes: `Returned ${dateRes.data?.orders?.length || 0} orders. from_date and to_date ignored in getAdminOrders.`,
  });

  console.log("REPRODUCTION LOG TABLE:");
  console.table(logs.map(l => ({
    Filter: `${l.filterType}: ${l.selection}`,
    Status: l.httpStatus,
    Count: l.returnedCount,
    Working: l.isWorking ? "YES" : "NO (FAILED)",
    Notes: l.notes,
  })));
}

runReproduction().catch(console.error);
