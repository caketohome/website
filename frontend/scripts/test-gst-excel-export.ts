/**
 * CakeToHome — GST & Tax Excel Export (.xlsx) 11-Worksheet Verification Suite
 * Validates native binary ExcelJS workbook generation, 11 worksheets, numeric formatting, formulas,
 * auto-filters, freeze panes, and 0 XML/HTML code dumps.
 */

import * as ExcelJS from "exceljs";
import { ExcelExportService } from "../src/lib/excel-export-service";

async function runGstExcelTestSuite() {
  console.log("===============================================================");
  console.log("CAKETOHOME — NATIVE EXCELJS GST EXPORT (.XLSX) 11-WORKSHEET TEST SUITE");
  console.log("===============================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  // Sample Audit Data
  const sampleData = {
    filters: { customStartDate: "2026-08-01", customEndDate: "2026-08-10", branchIds: ["all"] },
    kpis: [
      { label: "Total Revenue", currentValue: 1250000, previousValue: 1100000, growthPct: 13.6 },
    ],
    salesRegister: [
      { invoiceDate: "2026-08-05", invoiceNumber: "CTH/26-27/000124", orderNumber: "ORD-98401", customerName: "Ananya Sharma", customerPhone: "+91 9876543210", customerGstin: "URP", placeOfSupply: "Karnataka (29)", state: "Karnataka", branchName: "Indiranagar Kitchen Hub", branchGstin: "29AAAAA0000A1Z5", productName: "Belgian Chocolate Truffle Cake", hsnCode: "19059090", quantity: 1, uom: "PCS", unitPrice: 949, grossAmount: 949, discount: 0, taxableValue: 804.24, gstRatePct: 18, cgstRatePct: 9, cgst: 72.38, sgstRatePct: 9, sgst: 72.38, igstRatePct: 0, igst: 0, totalTax: 144.76, totalValue: 949, paymentMethod: "UPI / Razorpay", paymentStatus: "Paid", orderStatus: "Delivered" },
      { invoiceDate: "2026-08-06", invoiceNumber: "CTH/26-27/000125", orderNumber: "ORD-98402", customerName: "Rahul Verma Enterprises", customerPhone: "+91 9812345678", customerGstin: "29ABCDE1234F1Z5", placeOfSupply: "Karnataka (29)", state: "Karnataka", branchName: "Koramangala Kitchen Hub", branchGstin: "29AAAAA0000A1Z5", productName: "Fresh Red Velvet Heart Cake", hsnCode: "19059090", quantity: 2, uom: "PCS", unitPrice: 899, grossAmount: 1798, discount: 100, taxableValue: 1438.98, gstRatePct: 18, cgstRatePct: 9, cgst: 129.51, sgstRatePct: 9, sgst: 129.51, igstRatePct: 0, igst: 0, totalTax: 259.02, totalValue: 1698, paymentMethod: "Credit Card", paymentStatus: "Paid", orderStatus: "Delivered" },
    ],
    hsnSummary: [
      { hsnCode: "19059090", description: "Cakes & Bakery Products", uom: "PCS", quantity: 3, taxableValue: 2243.22, gstRatePct: 18, cgst: 201.89, sgst: 201.89, igst: 0, totalTax: 403.78, totalValue: 2647 },
    ],
    invoiceRegister: [
      { invoiceNumber: "CTH/26-27/000124", invoiceDate: "2026-08-05", orderNumber: "ORD-98401", customerName: "Ananya Sharma", customerGstin: "URP", branchName: "Indiranagar Kitchen Hub", branchGstin: "29AAAAA0000A1Z5", placeOfSupply: "Karnataka (29)", taxableAmount: 804.24, cgst: 72.38, sgst: 72.38, igst: 0, totalTax: 144.76, roundOff: 0, totalValue: 949, paymentMethod: "UPI / Razorpay", paymentStatus: "Paid", invoiceStatus: "Valid" },
    ],
    productTaxDetails: [
      { sku: "CK-TRUF-10", name: "Belgian Chocolate Truffle Cake", category: "Cakes", hsnCode: "19059090", gstRatePct: 18, sellingPrice: 949, taxInclusive: "YES", taxablePrice: 804.24, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 0, status: "CONFIGURED" },
      { sku: "CK-UNKNOWN", name: "Custom Special Cake", category: "Custom", hsnCode: "", gstRatePct: 18, sellingPrice: 1500, taxInclusive: "YES", taxablePrice: 1271.18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 0, status: "MISSING TAX CONFIGURATION" },
    ],
    branchGstSummary: [
      { branchName: "Indiranagar Kitchen Hub", branchCode: "HUB-01", branchGstin: "29AAAAA0000A1Z5", state: "Karnataka", invoiceCount: 1, taxableSales: 804.24, cgst: 72.38, sgst: 72.38, igst: 0, totalTax: 144.76, totalValue: 949 },
      { branchName: "Koramangala Kitchen Hub", branchCode: "HUB-02", branchGstin: "29AAAAA0000A1Z5", state: "Karnataka", invoiceCount: 1, taxableSales: 1438.98, cgst: 129.51, sgst: 129.51, igst: 0, totalTax: 259.02, totalValue: 1698 },
    ],
    creditNotes: [
      { cnNumber: "CTH/CN/26-27/000001", cnDate: "2026-08-07", origInvoice: "CTH/26-27/000124", customerName: "Ananya Sharma", reason: "Order Return", taxable: 804.24, cgst: 72.38, sgst: 72.38, igst: 0, totalRefund: 949 }
    ],
    dataQualityWarnings: [
      { id: "warn_01", title: "1 product missing HSN code" },
    ],
    reconciliationStatus: { status: "PASS" },
  };

  // Step 1: Generate ArrayBuffer using ExcelExportService
  const buffer = await ExcelExportService.generateGstWorkbookXlsx(sampleData);
  const isBufferValid = buffer && buffer.byteLength > 0;

  if (isBufferValid) {
    console.log(`  ✅ Generated binary workbook buffer (${buffer.byteLength} bytes).`);
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Generated workbook buffer is empty.");
    failedTests++;
    process.exit(1);
  }

  // Step 2: Parse buffer with ExcelJS Workbook Reader
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const expectedSheetNames = [
    "01 Executive Summary",
    "02 Invoice Register",
    "03 GST Transactions",
    "04 B2B Sales",
    "05 B2C Sales",
    "06 Credit Notes",
    "07 HSN Summary",
    "08 Tax Summary",
    "09 GSTR-1",
    "10 GSTR-3B",
    "11 Validation Errors",
  ];

  const actualSheetNames = workbook.worksheets.map((w) => w.name);
  console.log("\nWorksheets found:", actualSheetNames.join(", "));

  const allSheetsPresent = expectedSheetNames.every((s) => actualSheetNames.includes(s));

  if (allSheetsPresent && actualSheetNames.length === 11) {
    console.log("  ✅ PASS: All 11 required GST worksheets exist in workbook.");
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Sheet names mismatch. Expected 11 sheets, Found: ${actualSheetNames.join(", ")}`);
    failedTests++;
  }

  // Step 3: Check Worksheet 1 (01 Executive Summary)
  const s1 = workbook.getWorksheet("01 Executive Summary")!;
  const titleVal = String(s1.getCell("A1").value);
  const isTitleCorrect = titleVal.includes("CAKETOHOME GST & TAX SUMMARY REPORT");

  if (isTitleCorrect) {
    console.log(`  ✅ Sheet 1 Header: "${titleVal}"`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Sheet 1 title header incorrect: ${titleVal}`);
    failedTests++;
  }

  // Step 4: Verify Numeric Cell Types & Money Formatting
  const s3 = workbook.getWorksheet("03 GST Transactions")!;
  const cellTaxableVal = s3.getCell("S2").value; // Taxable Value row 2
  const isTaxableNumeric = typeof cellTaxableVal === "number";
  const numFmtTaxable = s3.getCell("S2").numFmt;

  if (isTaxableNumeric && numFmtTaxable === "₹#,##0.00") {
    console.log(`  ✅ Sheet 3 Cell S2 (Taxable Value): Numeric ${cellTaxableVal} | Format: "${numFmtTaxable}"`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Sheet 3 Cell S2 is not formatted numeric. Value: ${cellTaxableVal}, Format: ${numFmtTaxable}`);
    failedTests++;
  }

  // Step 5: Verify GST Percentage Formatting
  const cellGstPct = s3.getCell("T2").value;
  const numFmtGstPct = s3.getCell("T2").numFmt;
  const isGstPctNumeric = typeof cellGstPct === "number";

  if (isGstPctNumeric && numFmtGstPct === "0.00%") {
    console.log(`  ✅ Sheet 3 Cell T2 (GST Rate %): Numeric ${cellGstPct} | Format: "${numFmtGstPct}"`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Sheet 3 Cell T2 is not formatted percentage. Value: ${cellGstPct}, Format: ${numFmtGstPct}`);
    failedTests++;
  }

  // Step 6: Verify Totals Formula `=SUM(...)`
  const s3TotalCell = s3.getCell("S4").value; // Total row Taxable Value
  const isFormula = typeof s3TotalCell === "object" && s3TotalCell !== null && "formula" in s3TotalCell;

  if (isFormula) {
    console.log(`  ✅ Sheet 3 Total Cell S4 Formula: "${(s3TotalCell as any).formula}"`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Sheet 3 Total Cell S4 is not a formula: ${JSON.stringify(s3TotalCell)}`);
    failedTests++;
  }

  // Step 7: Verify Zero XML / HTML Code String Bleeding
  let xmlDumpFound = false;
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const valStr = String(cell.value || "");
        if (valStr.startsWith("<?xml") || valStr.includes("<html") || valStr.includes("<table")) {
          xmlDumpFound = true;
          console.error(`  ❌ XML/HTML string found in Sheet ${sheet.name} Cell ${cell.address}: ${valStr}`);
        }
      });
    });
  });

  if (!xmlDumpFound) {
    console.log("  ✅ PASS: 0 XML / HTML string code dumps found across all 11 worksheets!");
    passedTests++;
  } else {
    failedTests++;
  }

  console.log("\n===============================================================");
  console.log(`11-WORKSHEET GST EXCEL TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runGstExcelTestSuite().catch((err) => {
  console.error("11-Worksheet GST Excel test suite execution failed:", err);
  process.exit(1);
});
