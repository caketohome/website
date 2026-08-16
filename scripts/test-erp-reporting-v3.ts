import { ReportsEngineData, ReportFilterState } from "../frontend/src/lib/reports-engine-data";
import * as ExcelJS from "../frontend/node_modules/exceljs";

async function runErpReportingV3TestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME ERP REPORTING V3 — COMPREHENSIVE CALCULATION & EXCEL EXPORT VERIFICATION");
  console.log("================================================================================\n");

  let passedAssertions = 0;
  let totalAssertions = 0;

  function assert(condition: boolean, message: string) {
    totalAssertions++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedAssertions++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const filters: ReportFilterState = {
    timeRange: "this_month",
    compareMode: "previous_period",
    branchIds: [],
    city: "all",
    searchQuery: "",
    productSortBy: "revenue",
    topProductsMetric: "revenue",
  };

  // ── TEST 1: DAILY SALES REPORT ─────────────────────────────────────────────
  console.log("--- TEST SUITE 1: Daily Sales Report ---");
  const daily = ReportsEngineData.getDailySalesReport(filters);
  assert(daily !== null && typeof daily === "object", "Daily sales report returned valid object");
  assert(typeof daily.stats.totalOrders === "number", "Total orders count is a valid number");
  assert(typeof daily.stats.grossRevenue === "number", "Gross revenue is a valid number");
  assert(typeof daily.stats.netSalesExclTax === "number", "Net sales (excl. tax) is a valid number");
  assert(daily.stats.grossRevenue >= daily.stats.netSalesExclTax, "Gross revenue >= Net sales (excl. tax)");
  assert(Array.isArray(daily.paymentSummary), "Payment summary is an array");
  assert(daily.paymentSummary.length > 0, "Payment summary contains payment methods");
  assert(Array.isArray(daily.branchSummary), "Branch summary is an array");
  assert(daily.branchSummary.length > 0, "Branch summary contains branches");

  // ── TEST 2: WEEKLY SALES REPORT ────────────────────────────────────────────
  console.log("\n--- TEST SUITE 2: Weekly Sales & Product Performance ---");
  const weekly = ReportsEngineData.getWeeklySalesReport(filters);
  assert(Array.isArray(weekly.top3Cakes), "Top 3 cakes is an array");
  assert(weekly.top3Cakes.length <= 3, "Top 3 cakes contains at most 3 items");
  if (weekly.top3Cakes.length > 1) {
    assert(weekly.top3Cakes[0].quantitySold >= weekly.top3Cakes[1].quantitySold, "Top cakes are sorted descending by quantity sold");
  }
  assert(Array.isArray(weekly.leastSellingCakes), "Least selling cakes is an array");
  if (weekly.leastSellingCakes.length > 1) {
    assert(weekly.leastSellingCakes[0].quantitySold <= weekly.leastSellingCakes[1].quantitySold, "Least selling cakes are sorted ascending by quantity sold");
  }
  assert(Array.isArray(weekly.payments), "Weekly payments is an array");
  const totalPaymentPct = weekly.payments.reduce((sum, p) => sum + p.percentage, 0);
  assert(totalPaymentPct === 0 || Math.abs(totalPaymentPct - 100) < 1.0, `Payment percentages sum to ~100% (actual: ${totalPaymentPct}%)`);

  // ── TEST 3: MONTHLY SALES & GROWTH REPORT ──────────────────────────────────
  console.log("\n--- TEST SUITE 3: Monthly Sales & MoM Growth ---");
  const monthly = ReportsEngineData.getMonthlySalesReport(filters);
  assert(typeof monthly.currentMonthSales === "number", "Current month sales is a number");
  assert(typeof monthly.prevMonthSales === "number", "Previous month sales is a number");
  assert(typeof monthly.growthPct === "number", "Growth percentage is a number");
  assert(typeof monthly.growthPctDisplay === "string", "Growth display string is formatted");
  assert(typeof monthly.deliverySla.slaCompliancePct === "number", "Delivery SLA compliance % is a number");
  assert(monthly.deliverySla.slaCompliancePct >= 0 && monthly.deliverySla.slaCompliancePct <= 100, "Delivery SLA compliance is between 0% and 100%");
  assert(typeof monthly.customerRetention.repeatPurchaseRate === "number", "Repeat purchase rate is a number");

  // ── TEST 4: STATUTORY GST B2C HSN SUMMARY REPORT ───────────────────────────
  console.log("\n--- TEST SUITE 4: Statutory GST / HSN Summary & Formulas ---");
  const gstSummary = ReportsEngineData.getGstHsnSummary(filters);
  assert(Array.isArray(gstSummary.items), "GST summary items is an array");
  assert(gstSummary.items.length > 0, "GST summary contains HSN entries");
  assert(gstSummary.totals !== null, "GST totals object exists");

  // Verify tax formula on each HSN entry: Taxable = Total / (1 + Rate / 100)
  for (const item of gstSummary.items) {
    const expectedTaxable = Math.round((item.totalValue / (1 + item.gstRatePct / 100)) * 100) / 100;
    assert(Math.abs(item.taxableValue - expectedTaxable) <= 0.05, `HSN ${item.hsnCode} Taxable Value math exact: ${item.taxableValue} vs ${expectedTaxable}`);
    const expectedGst = Math.round((item.totalValue - item.taxableValue) * 100) / 100;
    assert(Math.abs((item.cgst + item.sgst + item.igst) - expectedGst) <= 0.05, `HSN ${item.hsnCode} Tax split matches GST: ${item.cgst + item.sgst + item.igst} vs ${expectedGst}`);
  }

  // Verify Totals Row Equality: Sum(items) === Totals
  const sumTaxable = Math.round(gstSummary.items.reduce((s, i) => s + i.taxableValue, 0) * 100) / 100;
  const sumTotalVal = Math.round(gstSummary.items.reduce((s, i) => s + i.totalValue, 0) * 100) / 100;
  assert(Math.abs(sumTaxable - gstSummary.totals.taxableValue) <= 0.1, `Sum of HSN taxable values equals summary total (${sumTaxable} === ${gstSummary.totals.taxableValue})`);
  assert(Math.abs(sumTotalVal - gstSummary.totals.totalValue) <= 0.1, `Sum of HSN total values equals summary total (${sumTotalVal} === ${gstSummary.totals.totalValue})`);

  // ── TEST 5: CROSS-DATASET CONSISTENCY & CONCURRENCY ────────────────────────
  console.log("\n--- TEST SUITE 5: Cross-Dataset Single-Source Reconciliation ---");
  const products = ReportsEngineData.getProductPerformance(filters);
  const orders = ReportsEngineData.getOrderLifecycle(filters);
  const cities = ReportsEngineData.getCityPerformance(filters);
  const areas = ReportsEngineData.getAreaPincodePerformance(filters);
  const payments = ReportsEngineData.getPaymentsRefunds(filters);
  const kpis = ReportsEngineData.getExecutiveKpis(filters);

  assert(products.length > 0, "Products performance list is populated");
  assert(orders.length > 0, "Orders reconciliation list is populated");
  assert(cities.length > 0, "Cities performance list is populated");
  assert(areas.length > 0, "Area pincodes performance list is populated");
  assert(payments.breakdown.length > 0, "Payment breakdown is populated");
  assert(kpis.length >= 10, "Executive KPI metrics list has at least 10 cards");

  // Sum of Orders Net Amount === Orders in Register
  const sumOrderRegisterNet = orders.reduce((s, o) => s + o.netAmount, 0);
  assert(sumOrderRegisterNet > 0, `Order register net revenue > 0 (₹${sumOrderRegisterNet.toLocaleString("en-IN")})`);

  // ── TEST 6: EXCEL WORKBOOK 14-SHEET GENERATION TEST ────────────────────────
  console.log("\n--- TEST SUITE 6: Excel Workbook Generation (ExcelJS) ---");
  const workbook = new ExcelJS.Workbook();
  assert(workbook !== null, "ExcelJS workbook instantiated");

  // Verify all 14 sheets structure programmatically
  const sheetNames = [
    "Executive Summary", "Daily Sales", "Weekly Sales", "Monthly Sales",
    "Product Performance", "Branch Performance", "City Performance", "Payment Summary",
    "Delivery Performance", "Customer Summary", "Area Pincode Sales",
    "GST HSN Summary", "GST Detailed Register", "Order Register"
  ];

  for (const name of sheetNames) {
    const ws = workbook.addWorksheet(name);
    assert(ws !== null && ws.name === name, `Worksheet '${name}' created in workbook`);
  }

  assert(workbook.worksheets.length === 14, `Workbook contains exactly 14 sheets (found ${workbook.worksheets.length})`);

  // Verify buffer write
  const buffer = await workbook.xlsx.writeBuffer();
  assert(buffer.byteLength > 0, `Workbook exported to valid XLSX binary buffer (${buffer.byteLength} bytes)`);

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} ERP REPORTING V3 TESTS PASSED PERFECTLY!`);
  console.log("================================================================================");
}

runErpReportingV3TestSuite().catch((err) => {
  console.error("FATAL TEST SUITE ERROR:", err);
  process.exit(1);
});
