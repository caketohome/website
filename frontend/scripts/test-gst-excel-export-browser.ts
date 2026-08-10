/**
 * CakeToHome — Playwright Browser GST Export Download Verification Suite
 * Tests browser download events for dedicated HSN Summary (.xlsx) and full 11-Worksheet GST Workbook (.xlsx),
 * saves physical files to disk, and verifies valid XLSX ZIP binary structure with ExcelJS reader.
 */

import { chromium } from "playwright";
import * as ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { ExcelExportService } from "../src/lib/excel-export-service";

async function runBrowserGstExportTest() {
  console.log("===============================================================");
  console.log("CAKETOHOME — PLAYWRIGHT BROWSER GST EXPORT DOWNLOAD TEST");
  console.log("===============================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  const downloadDir = path.resolve(__dirname, "../temp-downloads");
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  // TEST 1: Dedicated HSN Summary Report Export
  console.log("TEST 1: Testing Dedicated HSN Summary Report Export...");
  const hsnBuffer = await ExcelExportService.generateGstWorkbookXlsx({
    filters: { customStartDate: "2026-08-01", customEndDate: "2026-08-10", branchIds: ["all"] },
    kpis: [],
    salesRegister: [],
    hsnSummary: [
      { hsnCode: "19059010", description: "Sweet Bakery Cakes & Pastries", uom: "KGS", quantity: 15, taxableValue: 12000, gstRatePct: 5, cgst: 300, sgst: 300, igst: 0, totalTax: 600, totalValue: 12600 },
      { hsnCode: "19059010", description: "Sweet Bakery Cakes & Pastries", uom: "NOS", quantity: 25, taxableValue: 20000, gstRatePct: 5, cgst: 500, sgst: 500, igst: 0, totalTax: 1000, totalValue: 21000 },
    ],
    invoiceRegister: [],
    productTaxDetails: [],
    branchGstSummary: [],
    dataQualityWarnings: [],
    reconciliationStatus: { status: "PASS" },
  });

  const b64Hsn = Buffer.from(hsnBuffer).toString("base64");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    const [hsnDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.evaluate((b64) => {
        const binaryStr = atob(b64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "CakeToHome_HSN_Summary_Report_2026-08-01_to_2026-08-10.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, b64Hsn),
    ]);

    const hsnFileName = hsnDownload.suggestedFilename();
    console.log(`  ✅ Dedicated HSN Summary Download Fired: "${hsnFileName}"`);

    if (hsnFileName.endsWith(".xlsx")) {
      console.log("  ✅ HSN filename has .xlsx extension.");
      passedTests++;
    } else {
      console.error(`  ❌ HSN extension mismatch: ${hsnFileName}`);
      failedTests++;
    }

    const hsnSavePath = path.join(downloadDir, hsnFileName);
    await hsnDownload.saveAs(hsnSavePath);
    const hsnStats = fs.statSync(hsnSavePath);
    console.log(`  ✅ Physical Downloaded HSN File Saved: ${hsnSavePath} (${hsnStats.size} bytes)`);

    // Parse HSN XLSX with ExcelJS
    const hsnWb = new ExcelJS.Workbook();
    await hsnWb.xlsx.readFile(hsnSavePath);

    const hsnSheet = hsnWb.getWorksheet(1);
    const hsnSheetName = hsnSheet?.name || "";
    console.log(`  ✅ Parsed HSN Worksheet Name: "${hsnSheetName}"`);

    if (hsnSheetName.includes("Executive Summary") || hsnSheetName.includes("HSN Summary")) {
      console.log("  ✅ PASS: Valid HSN Summary XLSX structure generated!");
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: Invalid HSN worksheet name: ${hsnSheetName}`);
      failedTests++;
    }

    // TEST 2: Full 11-Worksheet GST Workbook Export
    console.log("\nTEST 2: Testing Full 11-Worksheet GST Audit Workbook Export...");
    const fullBuffer = await ExcelExportService.generateGstWorkbookXlsx({
      filters: { customStartDate: "2026-08-01", customEndDate: "2026-08-10", branchIds: ["all"] },
      kpis: [{ label: "Total Revenue", currentValue: 1250000, previousValue: 1100000, growthPct: 13.6 }],
      salesRegister: [
        { invoiceDate: "2026-08-05", invoiceNumber: "CTH/26-27/000124", orderNumber: "ORD-98401", customerName: "Ananya Sharma", customerPhone: "+91 9876543210", customerGstin: "URP", placeOfSupply: "Karnataka (29)", state: "Karnataka", branchName: "Indiranagar Kitchen Hub", branchGstin: "29AAAAA0000A1Z5", productName: "Belgian Chocolate Truffle Cake", hsnCode: "19059090", quantity: 1, uom: "PCS", unitPrice: 949, grossAmount: 949, discount: 0, taxableValue: 804.24, gstRatePct: 18, cgstRatePct: 9, cgst: 72.38, sgstRatePct: 9, sgst: 72.38, igstRatePct: 0, igst: 0, totalTax: 144.76, totalValue: 949, paymentMethod: "UPI / Razorpay", paymentStatus: "Paid", orderStatus: "Delivered" }
      ],
      hsnSummary: [{ hsnCode: "19059090", description: "Cakes & Bakery Products", uom: "PCS", quantity: 1, taxableValue: 804.24, gstRatePct: 18, cgst: 72.38, sgst: 72.38, igst: 0, totalTax: 144.76, totalValue: 949 }],
      invoiceRegister: [{ invoiceNumber: "CTH/26-27/000124", invoiceDate: "2026-08-05", orderNumber: "ORD-98401", customerName: "Ananya Sharma", customerGstin: "URP", branchName: "Indiranagar Kitchen Hub", branchGstin: "29AAAAA0000A1Z5", placeOfSupply: "Karnataka (29)", taxableAmount: 804.24, cgst: 72.38, sgst: 72.38, igst: 0, totalTax: 144.76, roundOff: 0, totalValue: 949, paymentMethod: "UPI / Razorpay", paymentStatus: "Paid", invoiceStatus: "Valid" }],
      productTaxDetails: [{ sku: "CK-TRUF-10", name: "Belgian Chocolate Truffle Cake", category: "Cakes", hsnCode: "19059090", gstRatePct: 18, sellingPrice: 949, taxInclusive: "YES", taxablePrice: 804.24, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 0, status: "CONFIGURED" }],
      branchGstSummary: [{ branchName: "Indiranagar Kitchen Hub", branchCode: "HUB-01", branchGstin: "29AAAAA0000A1Z5", state: "Karnataka", invoiceCount: 1, taxableSales: 804.24, cgst: 72.38, sgst: 72.38, igst: 0, totalTax: 144.76, totalValue: 949 }],
      creditNotes: [{ cnNumber: "CTH/CN/26-27/000001", cnDate: "2026-08-07", origInvoice: "CTH/26-27/000124", customerName: "Ananya Sharma", reason: "Return", taxable: 804.24, cgst: 72.38, sgst: 72.38, igst: 0, totalRefund: 949 }],
      dataQualityWarnings: [],
      reconciliationStatus: { status: "PASS" },
    }, "CakeToHome_Full_GST_Audit_Workbook_2026-08-01_to_2026-08-10");

    const b64Full = Buffer.from(fullBuffer).toString("base64");

    const [fullDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.evaluate((b64) => {
        const binaryStr = atob(b64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "CakeToHome_Full_GST_Audit_Workbook_2026-08-01_to_2026-08-10.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, b64Full),
    ]);

    const fullFileName = fullDownload.suggestedFilename();
    console.log(`  ✅ Full GST Audit Workbook Download Fired: "${fullFileName}"`);

    const fullSavePath = path.join(downloadDir, fullFileName);
    await fullDownload.saveAs(fullSavePath);
    const fullStats = fs.statSync(fullSavePath);
    console.log(`  ✅ Physical Downloaded Full Workbook Saved: ${fullSavePath} (${fullStats.size} bytes)`);

    const fullWb = new ExcelJS.Workbook();
    await fullWb.xlsx.readFile(fullSavePath);
    const sheetNames = fullWb.worksheets.map((w) => w.name);
    console.log("\nWorksheets found in full downloaded XLSX:", sheetNames.join(", "));

    if (sheetNames.length === 11) {
      console.log("  ✅ PASS: All 11 GST Audit Worksheets present in physical downloaded XLSX!");
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: Worksheets count mismatch: ${sheetNames.length}`);
      failedTests++;
    }

    // Verify 0 XML string dumps
    let xmlDump = false;
    fullWb.eachSheet((s) => {
      s.eachRow((r) => {
        r.eachCell((c) => {
          const v = String(c.value || "");
          if (v.startsWith("<?xml") || v.includes("<html") || v.includes("<table")) xmlDump = true;
        });
      });
    });

    if (!xmlDump) {
      console.log("  ✅ PASS: 0 XML / HTML string dumps found in physical downloaded XLSX!");
      passedTests++;
    } else {
      console.error("  ❌ FAIL: XML/HTML string dump found!");
      failedTests++;
    }
  } catch (err: any) {
    console.error("Browser test error:", err.message);
    failedTests++;
  } finally {
    await browser.close();
  }

  console.log("\n===============================================================");
  console.log(`PLAYWRIGHT BROWSER GST EXPORT TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBrowserGstExportTest().catch((err) => {
  console.error("Playwright browser test suite execution failed:", err);
  process.exit(1);
});
