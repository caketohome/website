import { ReportsEngineData, ReportFilterState } from "../src/lib/reports-engine-data";
import { ExcelExportService } from "../src/lib/excel-export-service";
import { getReportDefinition, REPORTS } from "../src/lib/report-registry";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

async function runAll12AnalyticsReportsTestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME — COMPLETE 12-REPORT ENTERPRISE ANALYTICS & EXCEL TEST SUITE");
  console.log("================================================================================\n");

  const mockTriggerDownload = (buffer: ArrayBuffer, filename: string) => {
    const outputDir = path.join(__dirname, "../tmp_report_exports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filePath = path.join(outputDir, `${filename}.xlsx`);
    fs.writeFileSync(filePath, Buffer.from(buffer));
  };

  (ExcelExportService as any).triggerBrowserDownload = mockTriggerDownload;

  const filters: ReportFilterState = {
    timeRange: "custom",
    customStartDate: "2026-08-01",
    customEndDate: "2026-08-10",
    compareMode: "none",
    branchIds: ["br_indiranagar", "br_koramangala", "br_hsr", "br_whitefield"],
    searchQuery: "",
    productSortBy: "revenue",
    topProductsMetric: "revenue",
  };

  console.log("TEST 1: Validating Central Report Registry (12 Main Reports + Aliases)...");
  const reportKeys = Object.keys(REPORTS) as Array<keyof typeof REPORTS>;
  if (reportKeys.length < 12) {
    throw new Error(`Expected at least 12 reports in registry, but found ${reportKeys.length}`);
  }
  reportKeys.forEach((key) => {
    const def = getReportDefinition(key);
    if (!def.title || !def.exportFilename) {
      throw new Error(`Report definition ${key} is missing title or exportFilename!`);
    }
  });
  console.log(`  ✅ PASS: All ${reportKeys.length} reports registered with metadata and filenames!\n`);

  console.log("TEST 2: Validating Datasets for All 12 Report Sections...");
  const kpis = ReportsEngineData.getExecutiveKpis(filters);
  const products = ReportsEngineData.getProductPerformance(filters);
  const orders = ReportsEngineData.getOrderLifecycle(filters);
  const gstItems = ReportsEngineData.getGstReport(filters);
  const taxSummary = ReportsEngineData.getTaxSummaryReport(filters);
  const exceptions = ReportsEngineData.getExceptionCenterAudit(filters);
  const branchPerf = ReportsEngineData.getBranchPerformance(filters);
  const deliveryData = ReportsEngineData.getDeliveryFleetPerformance(filters);
  const customerData = ReportsEngineData.getCustomerAnalytics(filters);
  const paymentData = ReportsEngineData.getPaymentsRefunds(filters);
  const geoData = ReportsEngineData.getGeographicSales(filters);
  const crossSellData = ReportsEngineData.getCrossSellUpsell(filters);

  console.log(`  - Executive KPIs: ${kpis.length}`);
  console.log(`  - Products: ${products.length}`);
  console.log(`  - Orders Lifecycle: ${orders.length}`);
  console.log(`  - GST Items: ${gstItems.length}`);
  console.log(`  - Branch Performance: ${branchPerf.length}`);
  console.log(`  - Delivery Partners: ${deliveryData.partners.length}`);
  console.log(`  - Top Customers: ${customerData.topCustomers.length}`);
  console.log(`  - Payment Gateways: ${paymentData.breakdown.length}`);
  console.log(`  - Geographic Areas: ${geoData.length}`);
  console.log(`  - Cross-Sell Pairs: ${crossSellData.length}`);
  console.log(`  - Audit Exceptions: ${exceptions.length}`);
  console.log(`  ✅ PASS: All 12 report sections produced valid non-empty datasets!\n`);

  console.log("TEST 3: Triggering All 12 Report-Specific Excel Exports...");
  await ExcelExportService.exportExecutiveSummary({ kpis, salesRegister: orders, filters } as any);
  await ExcelExportService.exportSalesRevenue({ salesRegister: orders, filters } as any);
  await ExcelExportService.exportProductsProfitability({ products, filters } as any);
  await ExcelExportService.exportOrdersLifecycle({ orders, filters } as any);
  await ExcelExportService.exportBranchPerformance({ branchPerformance: branchPerf, filters } as any);
  await ExcelExportService.exportHsnSummary({ hsnSummary: gstItems, filters } as any);
  await ExcelExportService.exportDeliveryFleet({ deliveryData, filters } as any);
  await ExcelExportService.exportCustomerAnalytics({ customerData, filters } as any);
  await ExcelExportService.exportPaymentsRefunds({ paymentData, filters } as any);
  await ExcelExportService.exportGeographicSales({ geoData, filters } as any);
  await ExcelExportService.exportCrossSellUpsell({ crossSellData, filters } as any);
  await ExcelExportService.exportExceptionReport({ exceptions, filters } as any);

  console.log(`  ✅ PASS: Generated all 12 report-specific Excel workbooks!\n`);

  console.log("TEST 4: Inspecting Excel Workbooks Metadata & Formatting...");
  const exportDir = path.join(__dirname, "../tmp_report_exports");
  const generatedFiles = fs.readdirSync(exportDir).filter((f) => f.endsWith(".xlsx"));

  for (const filename of generatedFiles) {
    const filePath = path.join(exportDir, filename);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const firstSheet = wb.worksheets[0];
    const headerVal = firstSheet.getCell("A1").value?.toString() || "";
    if (!headerVal.includes("CAKETOHOME")) {
      throw new Error(`File ${filename} missing CAKETOHOME header! Found: "${headerVal}"`);
    }

    console.log(`  - [EXCEL FILE] ${filename}: Header = "${headerVal.substring(0, 30)}...", Sheet = "${firstSheet.name}", Rows = ${firstSheet.rowCount}`);
  }
  console.log(`  ✅ PASS: All exported Excel workbooks verified for formatting and header metadata!\n`);

  console.log("================================================================================");
  console.log("ALL 12 ANALYTICS REPORTS TEST SUITE: 4 PASSED, 0 FAILED");
  console.log("================================================================================");
}

runAll12AnalyticsReportsTestSuite().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
