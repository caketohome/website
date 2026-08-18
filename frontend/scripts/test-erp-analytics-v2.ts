/**
 * Automated Verification Suite for CakeToHome ERP Analytics, Reporting & GST Engine V2
 * Tests real-data integration, GST calculations, multi-branch isolation, and Excel export services.
 */

import { ApiEngine } from "../src/lib/api-engine";
import { ReportsEngineData, ReportFilterState } from "../src/lib/reports-engine-data";
import { ExcelExportService } from "../src/lib/excel-export-service";
import { REPORTS } from "../src/lib/report-registry";

async function runTestSuite() {
  console.log("============================================================");
  console.log("CakeToHome ERP Analytics & GST Engine V2 — Test Suite");
  console.log("============================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail !== undefined ? detail : "");
      failed++;
    }
  }

  // 1. Initialize Canonical Data Store
  console.log("\n--- Domain 1: Data Store & Seed Integrity ---");
  ApiEngine.resetStoreToCanonical();
  const branches = ApiEngine.listBranches();
  const products = ApiEngine.listProducts();
  const profile = ApiEngine.getBusinessProfile();
  const gstRegistrations = ApiEngine.listGstRegistrations();

  const ordersRes = ApiEngine.getAdminOrders({ limit: 99999 });
  ReportsEngineData.setClientStoreData({
    orders: ordersRes.orders,
    products,
    branches,
  });

  assert(branches.length >= 4, `Branches populated (found ${branches.length})`);
  assert(products.length >= 8, `Products populated (found ${products.length})`);
  assert(profile.trade_name.startsWith("CakeToHome"), `Business Profile trade name is "${profile.trade_name}"`);
  assert(gstRegistrations.length >= 1, `GST Registrations exist (found ${gstRegistrations.length})`);

  // 2. Test Transactional Metrics Aggregation from Real Orders
  console.log("\n--- Domain 2: Transactional Metrics Aggregation ---");
  const defaultFilter: ReportFilterState = {
    timeRange: "last_30_days",
    compareMode: "previous_period",
    branchIds: [],
  };

  const metrics = ReportsEngineData.getTransactionalMetrics(defaultFilter);
  assert(typeof metrics.grossRevenue === "number", `Gross Revenue is a number: ₹${metrics.grossRevenue}`);
  assert(typeof metrics.netSalesExclTax === "number", `Net Sales Excl Tax is a number: ₹${metrics.netSalesExclTax}`);
  assert(typeof metrics.totalOrders === "number", `Total Orders is a number: ${metrics.totalOrders}`);
  assert(metrics.totalOrders >= 4, `Real order records accounted for (found ${metrics.totalOrders} orders)`);
  assert(metrics.grossProfit <= metrics.netSalesExclTax, `Gross Profit (₹${metrics.grossProfit}) <= Net Sales (₹${metrics.netSalesExclTax})`);

  // 3. Test Executive Dashboard KPI Cards
  console.log("\n--- Domain 3: Executive KPI Cards ---");
  const kpiCards = ReportsEngineData.getExecutiveKpis(defaultFilter);
  assert(kpiCards.length >= 8, `KPI cards generated (${kpiCards.length} cards)`);
  const netSalesCard = kpiCards.find((k) => k.id === "kpi_net_sales");
  assert(Boolean(netSalesCard), "Net Sales KPI card exists");
  assert(netSalesCard?.currentValue === metrics.netSalesExclTax, `KPI Net Sales value matches calculated metrics: ₹${netSalesCard?.currentValue}`);

  // 4. Test Product Performance & Margin Analysis
  console.log("\n--- Domain 4: Product Performance & Margin Analysis ---");
  const productPerf = ReportsEngineData.getProductPerformance(defaultFilter);
  assert(Array.isArray(productPerf), "Product performance returns array");
  if (productPerf.length > 0) {
    const p1 = productPerf[0];
    assert(Boolean(p1.id && p1.name), `Product performance has valid identity: ${p1.name}`);
    assert(p1.grossMarginPct >= 0 && p1.grossMarginPct <= 100, `Gross Margin % is valid (${p1.grossMarginPct}%)`);
    assert(Boolean(p1.hsnCode), `Product has HSN code (${p1.hsnCode})`);
  }

  // 5. Test Order Lifecycle & Statutory Invoice Numbers
  console.log("\n--- Domain 5: Order Lifecycle & Invoicing ---");
  const orderLifecycle = ReportsEngineData.getOrderLifecycle(defaultFilter);
  assert(orderLifecycle.length >= 4, `Order lifecycle items returned (${orderLifecycle.length} orders)`);
  const ord1 = orderLifecycle[0];
  assert(Boolean(ord1.id && ord1.invoiceNumber), `Order has ID and Invoice Number: ${ord1.id} -> ${ord1.invoiceNumber}`);
  assert(Boolean(ord1.customerName), `Order has Customer Name: ${ord1.customerName}`);

  // 6. Test GST & Tax Register Aggregation
  console.log("\n--- Domain 6: GST & Tax Register Calculations ---");
  const gstReport = ReportsEngineData.getGstReport(defaultFilter);
  assert(Array.isArray(gstReport), "GST report returns array");
  if (gstReport.length > 0) {
    const g1 = gstReport[0];
    assert(Boolean(g1.hsnCode), `GST line has HSN Code: ${g1.hsnCode}`);
    assert(Math.abs(g1.totalTax - (g1.cgst + g1.sgst + g1.igst)) < 0.05, `GST total tax equals sum of CGST + SGST + IGST (₹${g1.totalTax})`);
  }

  const taxSummary = ReportsEngineData.getTaxSummaryReport(defaultFilter);
  assert(Array.isArray(taxSummary), "Tax Summary report returns array");

  // 7. Test Branch Performance & Isolation
  console.log("\n--- Domain 7: Multi-Branch Performance & Filtering ---");
  const branchPerf = ReportsEngineData.getBranchPerformance(defaultFilter);
  assert(branchPerf.length >= 4, `All 4 branches reported (found ${branchPerf.length})`);
  
  // Test filtering for a single branch
  const indiranagarBranch = branches[0];
  const branchFilter: ReportFilterState = {
    ...defaultFilter,
    branchIds: [indiranagarBranch.id],
  };
  const filteredMetrics = ReportsEngineData.getTransactionalMetrics(branchFilter);
  assert(filteredMetrics.totalOrders <= metrics.totalOrders, `Branch filtered orders (${filteredMetrics.totalOrders}) <= total orders (${metrics.totalOrders})`);

  // 8. Test ApiEngine Report Endpoints (Direct & Proxy Integration)
  console.log("\n--- Domain 8: ApiEngine Report Endpoints ---");
  const apiDash = ApiEngine.getReportsDashboard({ branch_id: "all" });
  assert(apiDash.gross_revenue === metrics.grossRevenue, `ApiEngine.getReportsDashboard gross_revenue matches real data (₹${apiDash.gross_revenue})`);
  assert(apiDash.delivered_orders === metrics.deliveredOrders, `ApiEngine.getReportsDashboard delivered_orders matches real data (${apiDash.delivered_orders})`);

  const apiSales = ApiEngine.getReportsSales({});
  assert(apiSales.gross_revenue === metrics.grossRevenue, "ApiEngine.getReportsSales connected to real gross revenue");

  const apiOrders = ApiEngine.getReportsOrders({});
  const totalStoreOrders = ApiEngine.getAdminOrders({ limit: 99999 }).total;
  assert(apiOrders.total_placed === totalStoreOrders, `ApiEngine.getReportsOrders connected to real order counts (${apiOrders.total_placed} == ${totalStoreOrders})`);

  const apiBranches = ApiEngine.getReportsBranches({});
  assert(apiBranches.total_hubs >= 4, `ApiEngine.getReportsBranches reports all hubs (${apiBranches.total_hubs})`);

  const apiExport = ApiEngine.getReportsExport({});
  assert(apiExport.success === true, "ApiEngine.getReportsExport returns success");

  // 9. Test Report Registry Definitions
  console.log("\n--- Domain 9: Report Registry & Module Definitions ---");
  const requiredModules = [
    "executive_summary", "sales", "products", "orders", "branches",
    "tax_gst", "delivery", "customers", "payments", "geography",
    "cross_sell", "exceptions"
  ];
  for (const mod of requiredModules) {
    const def = REPORTS[mod as keyof typeof REPORTS];
    assert(Boolean(def && def.title && def.exportFilename), `Module "${mod}" defined in registry: ${def?.title}`);
  }

  // 10. Test Dynamic Order Ingestion & Live Reporting Update
  console.log("\n--- Domain 10: Dynamic Order Ingestion & Live Update ---");
  const initialRevenue = metrics.grossRevenue;
  const initialOrderCount = metrics.totalOrders;

  // Create a new order via ApiEngine.confirmCheckout
  const newOrderRes = ApiEngine.confirmCheckout({
    cart_id: "cart_vip_test",
    pincode: "560038",
    delivery_slot_id: "slot_standard",
    delivery_date: new Date().toISOString().slice(0, 10),
    payment_method: "cod",
    address: {
      first_name: "Test",
      last_name: "VIP Buyer",
      phone: "+91 99887 76655",
      email: "vip.test@cakes2home.com",
      line1: "Indiranagar 100ft Rd",
      city: "Bengaluru",
      pincode: "560038",
    },
    subtotal: 1299,
    items: [
      {
        product_id: products[0].id || products[0].product_id,
        title: products[0].title || products[0].name,
        unit_price: 1299,
        quantity: 1,
        subtotal: 1299,
        category: "Signature Cakes",
        hsn_code: "19059090",
        gst_rate: 5,
      }
    ],
  } as any);

  assert(newOrderRes.success === true, `New order created successfully: ${newOrderRes.order?.order_number}`);

  // Re-hydrate ReportsEngineData with updated store
  ReportsEngineData.setClientStoreData({
    orders: ApiEngine.getAdminOrders({ limit: 99999 }).orders,
  });

  // Re-run report aggregation
  const updatedMetrics = ReportsEngineData.getTransactionalMetrics(defaultFilter);
  assert(updatedMetrics.totalOrders === initialOrderCount + 1, `Total orders incremented: ${initialOrderCount} -> ${updatedMetrics.totalOrders}`);
  assert(updatedMetrics.grossRevenue > initialRevenue, `Gross revenue updated: ₹${initialRevenue} -> ₹${updatedMetrics.grossRevenue}`);

  console.log("\n============================================================");
  console.log(`Test Execution Finished: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite crashed with unhandled error:", err);
  process.exit(1);
});
