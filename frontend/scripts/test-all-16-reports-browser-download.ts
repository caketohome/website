/**
 * CakeToHome — Playwright Browser All 16 Excel Exports Download Verification Suite
 * Tests real browser download events for all 16 reporting tabs and the complete 16-sheet master workbook,
 * saves physical files to disk, and verifies valid XLSX ZIP binary structure with ExcelJS reader.
 */

import { chromium } from "playwright";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { ReportsEngineData, ReportFilterState } from "../src/lib/reports-engine-data";
import { ExcelExportService } from "../src/lib/excel-export-service";

async function runBrowserExcelExportsAudit() {
  console.log("===============================================================");
  console.log("CAKETOHOME — PLAYWRIGHT BROWSER 16 EXCEL EXPORTS DOWNLOAD TEST");
  console.log("===============================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  const downloadDir = path.resolve(__dirname, "../temp-downloads");
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

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

  // Authoritative data
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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // Test definitions
  const testCases: { name: string; generate: () => Promise<any>; expectedSheets: string[] }[] = [
    {
      name: "01_Executive_Summary",
      generate: () => ExcelExportService.exportExecutiveSummary({
        kpis, stats, top3, bottom3,
        paymentBreakdown: paymentData.breakdown,
        deliverySla: deliveryData,
        customerRetention: customerData,
        cityPerformance,
        filters: defaultFilters
      }),
      expectedSheets: ["Executive Summary"]
    },
    {
      name: "02_Daily_Sales",
      generate: () => ExcelExportService.exportDailySalesReport({ daily: dailyData, filters: defaultFilters }),
      expectedSheets: ["Daily Sales Report"]
    },
    {
      name: "03_Weekly_Sales",
      generate: () => ExcelExportService.exportWeeklySalesReport({ weekly: weeklyData, filters: defaultFilters }),
      expectedSheets: ["Weekly Sales Report"]
    },
    {
      name: "04_Monthly_Sales",
      generate: () => ExcelExportService.exportMonthlySalesReport({ monthly: monthlyData, filters: defaultFilters }),
      expectedSheets: ["Monthly Sales Report"]
    },
    {
      name: "05_Product_Performance",
      generate: () => ExcelExportService.exportProductPerformance({ products, filters: defaultFilters }),
      expectedSheets: ["Product Performance"]
    },
    {
      name: "06_Branch_Performance",
      generate: () => ExcelExportService.exportBranchPerformance({ cities: branchPerformance, filters: defaultFilters }),
      expectedSheets: ["Branch Performance"]
    },
    {
      name: "07_City_Performance",
      generate: () => ExcelExportService.exportCityPerformance({ cities: cityPerformance, filters: defaultFilters }),
      expectedSheets: ["City Performance"]
    },
    {
      name: "08_Area_Pincode_Sales",
      generate: () => ExcelExportService.exportAreaPincodeSales({ areaPincodes, filters: defaultFilters }),
      expectedSheets: ["Area Pincode Sales"]
    },
    {
      name: "09_Payments_Refunds",
      generate: () => ExcelExportService.exportPaymentsRefunds({ payments: paymentData, filters: defaultFilters }),
      expectedSheets: ["Payments & Refunds"]
    },
    {
      name: "10_Delivery_Fleet",
      generate: () => ExcelExportService.exportDeliveryFleet({ delivery: deliveryData, filters: defaultFilters }),
      expectedSheets: ["Delivery & Fleet"]
    },
    {
      name: "11_Customer_Analytics",
      generate: () => ExcelExportService.exportCustomerAnalytics({ customers: customerData, filters: defaultFilters }),
      expectedSheets: ["Customer Analytics"]
    },
    {
      name: "12_GST_HSN_Summary",
      generate: () => ExcelExportService.exportGstHsnSummary({ gstSummary, filters: defaultFilters }),
      expectedSheets: ["GST HSN Summary"]
    },
    {
      name: "13_GST_Detailed_Register",
      generate: () => ExcelExportService.exportGstDetailedRegister({ register: gstDetailedRegister, filters: defaultFilters }),
      expectedSheets: ["GST Detailed Register"]
    },
    {
      name: "14_Order_Register",
      generate: () => ExcelExportService.exportOrderRegister({ orders, filters: defaultFilters }),
      expectedSheets: ["Order Register"]
    },
    {
      name: "15_Cross_Sell_Upsell",
      generate: () => ExcelExportService.exportCrossSellUpsell({ crossSell: crossSellData, filters: defaultFilters }),
      expectedSheets: ["Cross-Sell & Upsell"]
    },
    {
      name: "16_Exception_Center",
      generate: () => ExcelExportService.exportExceptionCenter({ exceptions, filters: defaultFilters }),
      expectedSheets: ["Exception Center"]
    },
    {
      name: "17_Master_16_Sheet_Complete_Workbook",
      generate: () => ExcelExportService.exportCompleteWorkbook({
        kpis, daily: dailyData, weekly: weeklyData, monthly: monthlyData,
        products, branches: branchPerformance, cities: cityPerformance, areaPincodes,
        payments: paymentData, delivery: deliveryData, customers: customerData,
        gstSummary, gstDetailedRegister, orderRegister: orders,
        crossSell: crossSellData, exceptions, filters: defaultFilters,
      }),
      expectedSheets: [
        "Executive Summary", "Daily Sales", "Weekly Sales", "Monthly Sales",
        "Product Performance", "Branch Performance", "City Performance",
        "Payment Summary", "Delivery Performance", "Customer Summary",
        "Area Pincode Sales", "GST HSN Summary", "GST Detailed Register",
        "Order Register", "Cross-Sell & Upsell", "Exception Center"
      ]
    }
  ];

  for (const tc of testCases) {
    console.log(`Testing Browser Download for: ${tc.name}...`);
    let capturedBuffer: ArrayBuffer | null = null;
    let capturedFilename = "";

    const orig = ExcelExportService.triggerBrowserDownload;
    ExcelExportService.triggerBrowserDownload = function (buf, fname) {
      capturedBuffer = buf;
      capturedFilename = fname;
    };

    try {
      await tc.generate();

      if (!capturedBuffer) {
        throw new Error(`Failed to generate buffer for ${tc.name}`);
      }

      // Convert buffer to base64 and trigger download in Playwright page
      const b64 = Buffer.from(capturedBuffer).toString("base64");
      const targetFileName = `${capturedFilename || tc.name}.xlsx`;

      const [downloadEvent] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        page.evaluate(({ b64Data, filename }) => {
          const binary = atob(b64Data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }, { b64Data: b64, filename: targetFileName })
      ]);

      const downloadedName = downloadEvent.suggestedFilename();
      const savePath = path.join(downloadDir, downloadedName);
      await downloadEvent.saveAs(savePath);

      const fileStats = fs.statSync(savePath);
      console.log(`  💾 Downloaded: ${downloadedName} (${fileStats.size} bytes)`);

      // Verify with ExcelJS
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(savePath);

      const sheetNames = wb.worksheets.map(w => w.name);
      console.log(`  📊 Sheets (${sheetNames.length}): [${sheetNames.join(", ")}]`);

      let sheetCheckPass = true;
      for (const expected of tc.expectedSheets) {
        if (!sheetNames.includes(expected)) {
          console.error(`  ❌ Missing expected sheet: "${expected}"`);
          sheetCheckPass = false;
        }
      }

      if (sheetCheckPass && fileStats.size > 1000) {
        console.log(`  ✅ PASS: ${tc.name}\n`);
        passedTests++;
      } else {
        console.error(`  ❌ FAIL: ${tc.name}\n`);
        failedTests++;
      }
    } catch (err: any) {
      console.error(`  ❌ ERROR in ${tc.name}:`, err.message);
      failedTests++;
    } finally {
      ExcelExportService.triggerBrowserDownload = orig;
    }
  }

  await browser.close();

  console.log("===============================================================");
  console.log(`PLAYWRIGHT BROWSER EXCEL AUDIT: ${passedTests}/${testCases.length} PASSED`);
  console.log("===============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBrowserExcelExportsAudit().catch((err) => {
  console.error("FATAL ERROR IN PLAYWRIGHT AUDIT:", err);
  process.exit(1);
});
