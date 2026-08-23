import ExcelJS from "exceljs";
import { ReportsEngineData, ReportFilterState } from "../src/lib/reports-engine-data";
import { ExcelExportService } from "../src/lib/excel-export-service";

interface ExportValidationResult {
  reportName: string;
  sheetCount: number;
  sheets: {
    name: string;
    rowCount: number;
    columnCount: number;
    hasFrozenPane: boolean;
    headerTitle: string;
  }[];
  passed: boolean;
  notes?: string;
}

async function runExcelExportAcceptanceAudit() {
  console.log("============================================================");
  console.log("   CAKETOHOME ERP REPORTING V3 — ALL 16 EXCEL EXPORTS AUDIT  ");
  console.log("============================================================\n");

  const defaultFilters: ReportFilterState = {
    timeRange: "this_month",
    customStartDate: "2026-08-01",
    customEndDate: "2026-08-16",
    compareMode: "previous_period",
    branchIds: [],
    city: "all",
    searchQuery: "",
    productSortBy: "revenue",
    topProductsMetric: "revenue",
  };

  // 1. Fetch authoritative domain data
  const kpis = ReportsEngineData.getExecutiveKpis(defaultFilters);
  const stats = ReportsEngineData.getTransactionalMetrics(defaultFilters);
  const dailyData = ReportsEngineData.getDailySalesReport(defaultFilters);
  const weeklyData = ReportsEngineData.getWeeklySalesReport(defaultFilters);
  const monthlyData = ReportsEngineData.getMonthlySalesReport(defaultFilters);
  const products = ReportsEngineData.getProductPerformance(defaultFilters);
  const orders = ReportsEngineData.getOrderLifecycle(defaultFilters);
  const branchPerformance = ReportsEngineData.getBranchPerformance(defaultFilters);
  const cityPerformance = ReportsEngineData.getCityPerformance(defaultFilters);
  const areaPincodes = ReportsEngineData.getAreaPincodePerformance(defaultFilters);
  const gstSummary = ReportsEngineData.getGstHsnSummary(defaultFilters);
  const gstDetailedRegister = ReportsEngineData.getGstDetailedRegister(defaultFilters);
  const deliveryData = ReportsEngineData.getDeliveryFleetPerformance(defaultFilters);
  const customerData = ReportsEngineData.getCustomerAnalytics(defaultFilters);
  const paymentData = ReportsEngineData.getPaymentsRefunds(defaultFilters);
  const crossSellData = ReportsEngineData.getCrossSellUpsell(defaultFilters);
  const exceptions = ReportsEngineData.getExceptionCenterAudit(defaultFilters, products, orders);

  const top3 = products.slice(0, 3);
  const bottom3 = [...products].reverse().slice(0, 3);

  const results: ExportValidationResult[] = [];

  // Helper to inspect workbook from captured buffer
  async function inspectWorkbook(generateFn: () => Promise<any>, reportName: string): Promise<ExportValidationResult> {
    const originalTrigger = ExcelExportService.triggerBrowserDownload;
    let capturedBuffer: ArrayBuffer | null = null;
    let capturedFilename = "";

    ExcelExportService.triggerBrowserDownload = function (buffer: ArrayBuffer, filename: string) {
      capturedBuffer = buffer;
      capturedFilename = filename;
    };

    try {
      await generateFn();

      if (!capturedBuffer) {
        throw new Error(`No buffer was passed to triggerBrowserDownload for "${reportName}"`);
      }

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(capturedBuffer as Buffer);

      const sheets = wb.worksheets.map((ws) => {
        const titleCell = ws.getCell("A2").value?.toString() || ws.getCell("A1").value?.toString() || ws.getCell("A6").value?.toString() || "";
        const views = (ws.views || []) as any[];
        const hasFrozenPane = views.some((v) => v.state === "frozen" || v.ySplit === 6);
        return {
          name: ws.name,
          rowCount: ws.rowCount,
          columnCount: ws.columnCount,
          hasFrozenPane,
          headerTitle: titleCell,
        };
      });

      return {
        reportName,
        sheetCount: sheets.length,
        sheets,
        passed: sheets.length > 0 && sheets.every((s) => s.rowCount > 5),
      };
    } finally {
      ExcelExportService.triggerBrowserDownload = originalTrigger;
    }
  }

  // 1. Executive Summary
  console.log("1. Testing Executive Summary Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportExecutiveSummary({
      kpis, stats, top3, bottom3,
      paymentBreakdown: paymentData.breakdown,
      deliverySla: deliveryData,
      customerRetention: customerData,
      cityPerformance,
      filters: defaultFilters
    }),
    "Executive Summary"
  ));

  // 2. Daily Sales
  console.log("2. Testing Daily Sales Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportDailySalesReport({ daily: dailyData, filters: defaultFilters }),
    "Daily Sales"
  ));

  // 3. Weekly Sales
  console.log("3. Testing Weekly Sales Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportWeeklySalesReport({ weekly: weeklyData, filters: defaultFilters }),
    "Weekly Sales"
  ));

  // 4. Monthly Sales
  console.log("4. Testing Monthly Sales Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportMonthlySalesReport({ monthly: monthlyData, filters: defaultFilters }),
    "Monthly Sales"
  ));

  // 5. Products Performance
  console.log("5. Testing Products Performance Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportProductPerformance({ products, filters: defaultFilters }),
    "Product Performance"
  ));

  // 6. Branch Performance
  console.log("6. Testing Branch Performance Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportBranchPerformance({ cities: branchPerformance, filters: defaultFilters }),
    "Branch Performance"
  ));

  // 7. City Performance
  console.log("7. Testing City Performance Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportCityPerformance({ cities: cityPerformance, filters: defaultFilters }),
    "City Performance"
  ));

  // 8. Area Pincode Sales
  console.log("8. Testing Area & Pincode Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportAreaPincodeSales({ areaPincodes, filters: defaultFilters }),
    "Area Pincode Sales"
  ));

  // 9. Payments & Refunds
  console.log("9. Testing Payments & Refunds Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportPaymentsRefunds({ payments: paymentData, filters: defaultFilters }),
    "Payments & Refunds"
  ));

  // 10. Delivery & Fleet
  console.log("10. Testing Delivery & Fleet Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportDeliveryFleet({ delivery: deliveryData, filters: defaultFilters }),
    "Delivery & Fleet"
  ));

  // 11. Customer Analytics
  console.log("11. Testing Customer Analytics Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportCustomerAnalytics({ customers: customerData, filters: defaultFilters }),
    "Customer Analytics"
  ));

  // 12. GST HSN Summary
  console.log("12. Testing GST HSN Summary Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportGstHsnSummary({ gstSummary, filters: defaultFilters }),
    "GST HSN Summary"
  ));

  // 13. GST Detailed Register
  console.log("13. Testing GST Detailed Register Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportGstDetailedRegister({ register: gstDetailedRegister, filters: defaultFilters }),
    "GST Detailed Register"
  ));

  // 14. Order Register
  console.log("14. Testing Order Register Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportOrderRegister({ orders, filters: defaultFilters }),
    "Order Register"
  ));

  // 15. Cross-Sell & Upsell
  console.log("15. Testing Cross-Sell & Upsell Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportCrossSellUpsell({ crossSell: crossSellData, filters: defaultFilters }),
    "Cross-Sell & Upsell"
  ));

  // 16. Exception Center
  console.log("16. Testing Exception Center Audit Export...");
  results.push(await inspectWorkbook(
    () => ExcelExportService.exportExceptionCenter({ exceptions, filters: defaultFilters }),
    "Exception Center"
  ));

  // 17. Master 16-Sheet Complete Enterprise Workbook
  console.log("17. Testing MASTER 16-SHEET COMPLETE ENTERPRISE WORKBOOK Export...");
  const masterWorkbookResult = await inspectWorkbook(
    () => ExcelExportService.exportCompleteWorkbook({
      kpis,
      daily: dailyData,
      weekly: weeklyData,
      monthly: monthlyData,
      products,
      branches: branchPerformance,
      cities: cityPerformance,
      areaPincodes,
      payments: paymentData,
      delivery: deliveryData,
      customers: customerData,
      gstSummary,
      gstDetailedRegister,
      orderRegister: orders,
      crossSell: crossSellData,
      exceptions,
      filters: defaultFilters,
    }),
    "Master 16-Sheet Complete Enterprise Workbook"
  );
  results.push(masterWorkbookResult);

  // Summary Report
  console.log("\n============================================================");
  console.log("                   EXPORT AUDIT RESULTS SUMMARY              ");
  console.log("============================================================\n");

  let totalPassed = 0;
  for (const [idx, res] of results.entries()) {
    const status = res.passed ? "✅ PASS" : "❌ FAIL";
    if (res.passed) totalPassed++;
    console.log(`[${(idx + 1).toString().padStart(2, "0")}] ${res.reportName.padEnd(46)}: ${status} (${res.sheetCount} sheet(s))`);
    for (const sh of res.sheets) {
      console.log(`     └─ Sheet: "${sh.name.padEnd(26)}" | Rows: ${sh.rowCount.toString().padStart(3)} | Cols: ${sh.columnCount.toString().padStart(2)} | Frozen Header: ${sh.hasFrozenPane ? "YES" : "NO"}`);
    }
  }

  console.log("\n============================================================");
  console.log(`TOTAL AUDIT RESULT: ${totalPassed}/${results.length} EXPORT TESTS PASSED`);
  console.log(`MASTER WORKBOOK SHEETS: ${masterWorkbookResult.sheetCount}/16 SHEETS VERIFIED`);
  console.log("============================================================\n");

  if (totalPassed !== results.length || masterWorkbookResult.sheetCount !== 16) {
    process.exit(1);
  }
}

runExcelExportAcceptanceAudit().catch((err) => {
  console.error("FATAL ERROR IN AUDIT:", err);
  process.exit(1);
});
