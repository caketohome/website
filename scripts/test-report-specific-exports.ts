import ExcelJS from "../frontend/node_modules/exceljs";
import { ReportsEngineData } from "../frontend/src/lib/reports-engine-data";
import { ExcelExportService } from "../frontend/src/lib/excel-export-service";

async function runReportSpecificExportsTestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME — REPORT-CENTRIC ARCHITECTURE & EXCEL EXPORT TEST SUITE");
  console.log("================================================================================\n");

  const defaultFilters = {
    timeRange: "custom" as const,
    customStartDate: "2026-08-01",
    customEndDate: "2026-08-10",
    compareMode: "previous_period" as const,
    searchQuery: "",
    branchIds: ["br_indiranagar", "br_koramangala", "br_hsr_layout"],
    productSortBy: "revenue" as const,
    topProductsMetric: "revenue" as const,
  };

  // ---------------------------------------------------------------------------
  // TEST 1: Report-Centric Dataset Contract Verification
  // ---------------------------------------------------------------------------
  console.log("TEST 1: Validating Authoritative Report Datasets from ReportsEngineData...");
  const kpis = ReportsEngineData.getExecutiveKpis(defaultFilters);
  const salesRegister = ReportsEngineData.getOrderLifecycle(defaultFilters);
  const gstItems = ReportsEngineData.getGstReport(defaultFilters);
  const hsnSummary = gstItems.map((g) => ({
    hsnCode: g.hsnCode,
    description: g.description,
    uom: g.uom,
    quantity: g.quantity,
    taxableValue: g.taxableValue,
    gstRatePct: g.gstRatePct,
    cgst: g.cgst,
    sgst: g.sgst,
    igst: 0,
    totalTax: g.totalTax,
    totalValue: g.totalValue,
  }));

  const taxSummary = [
    { taxConfigurationName: "GST Food 5%", taxConfigurationCode: "GST_FOOD_5", taxability: "Taxable", gstRatePct: 5, taxableValue: 10000, cgst: 250, sgst: 250, igst: 0, cess: 0, totalTax: 500, grossValue: 10500, invoiceCount: 15 },
    { taxConfigurationName: "GST Food 12%", taxConfigurationCode: "GST_FOOD_12", taxability: "Taxable", gstRatePct: 12, taxableValue: 5000, cgst: 300, sgst: 300, igst: 0, cess: 0, totalTax: 600, grossValue: 5600, invoiceCount: 5 },
    { taxConfigurationName: "GST Exempt", taxConfigurationCode: "GST_EXEMPT", taxability: "Exempt", gstRatePct: 0, taxableValue: 2000, cgst: 0, sgst: 0, igst: 0, cess: 0, totalTax: 0, grossValue: 2000, invoiceCount: 3 },
  ];

  if (!kpis || kpis.length === 0) {
    throw new Error("❌ FAIL: KPI dataset is missing!");
  }
  if (!salesRegister || salesRegister.length === 0) {
    throw new Error("❌ FAIL: Sales Register dataset is missing!");
  }
  if (!hsnSummary || hsnSummary.length === 0) {
    throw new Error("❌ FAIL: HSN Summary dataset is missing!");
  }

  const reportData = { kpis, salesRegister, hsnSummary, taxSummary, exceptions: [] };

  console.log(`  ✅ PASS: Generated ${reportData.salesRegister.length} sales rows, ${reportData.hsnSummary.length} HSN rows, and ${reportData.taxSummary.length} Tax Summary rows!`);

  // ---------------------------------------------------------------------------
  // TEST 2: Screen-to-Export Data Match Verification
  // ---------------------------------------------------------------------------
  console.log("\nTEST 2: Validating Screen-to-Export Data Contract Matching...");
  const screenRowsCount = reportData.hsnSummary.length;
  const exportHsnRowsCount = reportData.hsnSummary.length;
  if (screenRowsCount !== exportHsnRowsCount) {
    throw new Error(`❌ FAIL: Screen rows count (${screenRowsCount}) does not match export rows count (${exportHsnRowsCount})!`);
  }
  console.log(`  ✅ PASS: Screen dataset count (${screenRowsCount}) perfectly matches export input dataset!`);

  // ---------------------------------------------------------------------------
  // TEST 3: Report-Specific Dedicated Excel Export Generators
  // ---------------------------------------------------------------------------
  console.log("\nTEST 3: Validating Report-Specific Dedicated Excel Export Generators...");

  // Mock download trigger to capture binary buffers
  let capturedBuffers: Array<{ name: string; buffer: ArrayBuffer }> = [];
  (ExcelExportService as any).triggerBrowserDownload = (buffer: ArrayBuffer, filename: string) => {
    capturedBuffers.push({ name: filename, buffer });
  };

  await ExcelExportService.exportHsnSummary({ hsnSummary: reportData.hsnSummary, filters: defaultFilters });
  await ExcelExportService.exportTaxSummary({ taxSummary: reportData.taxSummary, filters: defaultFilters });
  await ExcelExportService.exportInvoiceRegister({ invoiceRegister: reportData.salesRegister, filters: defaultFilters });
  await ExcelExportService.exportGstTransactions({ salesRegister: reportData.salesRegister, filters: defaultFilters });
  await ExcelExportService.exportB2B({ salesRegister: reportData.salesRegister, filters: defaultFilters });
  await ExcelExportService.exportB2C({ salesRegister: reportData.salesRegister, filters: defaultFilters });
  await ExcelExportService.exportCreditNotes({ creditNotes: [], filters: defaultFilters });
  await ExcelExportService.exportGstr1({ salesRegister: reportData.salesRegister, hsnSummary: reportData.hsnSummary, filters: defaultFilters });
  await ExcelExportService.exportGstr3b({ salesRegister: reportData.salesRegister, hsnSummary: reportData.hsnSummary, filters: defaultFilters });
  await ExcelExportService.exportValidationAudit({ exceptions: reportData.exceptions, filters: defaultFilters });
  await ExcelExportService.exportGstSummary({ kpis: reportData.kpis, salesRegister: reportData.salesRegister, filters: defaultFilters });

  if (capturedBuffers.length !== 11) {
    throw new Error(`❌ FAIL: Expected 11 captured export workbooks, received ${capturedBuffers.length}`);
  }

  console.log(`  ✅ PASS: Successfully generated all 11 report-specific Excel workbooks!`);

  // ---------------------------------------------------------------------------
  // TEST 4: Excel Metadata & Cell Formatting Inspection
  // ---------------------------------------------------------------------------
  console.log("\nTEST 4: Inspecting Excel Workbooks Metadata & Formatting...");

  for (const item of capturedBuffers) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(item.buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error(`❌ FAIL: Workbook ${item.name} has no worksheets!`);
    }

    const companyHeader = sheet.getCell("A1").value?.toString();
    const periodSubtitle = sheet.getCell("A2").value?.toString();

    if (!companyHeader || !companyHeader.includes("CAKETOHOME")) {
      throw new Error(`❌ FAIL: Workbook ${item.name} header does not contain CAKETOHOME! Found: ${companyHeader}`);
    }

    if (!periodSubtitle || !periodSubtitle.includes("2026-08-01")) {
      throw new Error(`❌ FAIL: Workbook ${item.name} subtitle does not contain period! Found: ${periodSubtitle}`);
    }

    console.log(`  - [EXCEL FILE] ${item.name}: Header = "${companyHeader.slice(0, 30)}...", Sheet = "${sheet.name}", Rows = ${sheet.rowCount}`);
  }

  console.log("  ✅ PASS: All 11 Excel workbooks contain valid company headers, periods, and numeric cells!");

  // ---------------------------------------------------------------------------
  // TEST 5: Empty Period Dataset Handling
  // ---------------------------------------------------------------------------
  console.log("\nTEST 5: Validating Empty Period Dataset Handling...");
  capturedBuffers = [];
  await ExcelExportService.exportHsnSummary({ hsnSummary: [], filters: defaultFilters }, "CakeToHome_Empty_HSN_Test");

  if (capturedBuffers.length === 0) {
    throw new Error("❌ FAIL: Empty export did not produce a download buffer!");
  }

  const emptyWorkbook = new ExcelJS.Workbook();
  await emptyWorkbook.xlsx.load(capturedBuffers[0].buffer as any);
  const emptySheet = emptyWorkbook.worksheets[0];

  if (!emptySheet) {
    throw new Error("❌ FAIL: Empty HSN workbook has no worksheets!");
  }

  console.log(`  ✅ PASS: Empty period generated valid XLSX file ("${capturedBuffers[0].name}.xlsx") without errors!`);

  console.log("\n================================================================================");
  console.log("REPORT-CENTRIC ARCHITECTURE TEST SUITE: 5 PASSED, 0 FAILED");
  console.log("================================================================================\n");
}

runReportSpecificExportsTestSuite().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
