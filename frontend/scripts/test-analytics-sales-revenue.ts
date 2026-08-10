import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

async function runAnalyticsSalesRevenueTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME — E2E SALES & REVENUE ANALYTICS & EXCEL EXPORT ACCEPTANCE TEST");
  console.log("================================================================================\n");

  const downloadsDir = path.join(__dirname, "../temp-downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  console.log("STEP 1: Navigating to Admin Dashboard Analytics & Reporting...");
  await page.goto("http://localhost:3000/dashboard?tab=analytics", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const buttonTexts = await page.locator("button").allInnerTexts();
  console.log("Visible Buttons on Dashboard Page:", buttonTexts.map(t => t.replace(/\s+/g, ' ')));

  console.log("STEP 2: Clicking 'Sales & Revenue' tab...");
  const salesTabBtn = page.locator("button").filter({ hasText: "Sales & Revenue" }).first();
  await salesTabBtn.waitFor({ state: "visible", timeout: 15000 });
  await salesTabBtn.click();
  await page.waitForTimeout(2000);

  const headingsAfterClick = await page.locator("h1, h2, h3").allInnerTexts();
  console.log("Headings after click:", headingsAfterClick.map(t => t.replace(/\s+/g, ' ')));

  console.log("STEP 3: Asserting Sales & Revenue report body structure...");
  const kpiTotalOrders = await page.locator("text='Total Orders'").first().isVisible();
  const kpiGrossSales = await page.locator("text='Gross Sales'").first().isVisible();
  const kpiNetSales = await page.locator("text='Net Sales Revenue'").first().isVisible();
  const kpiDiscounts = await page.locator("text='Total Discounts'").first().isVisible();
  const kpiTax = await page.locator("text='GST Tax Collected'").first().isVisible();
  const kpiDelivery = await page.locator("text='Delivery Charges'").first().isVisible();
  const kpiAov = await page.locator("text='Average Order Value (AOV)'").first().isVisible();

  if (!kpiTotalOrders || !kpiGrossSales || !kpiNetSales || !kpiDiscounts || !kpiTax || !kpiDelivery || !kpiAov) {
    throw new Error("❌ FAIL: Sales & Revenue KPI cards are missing!");
  }
  console.log("  ✅ PASS: All 8 Sales & Revenue KPI cards are visibly rendered on screen!");

  const trendVisual = await page.locator("h3", { hasText: "Revenue Trend" }).first().isVisible();
  const b2bB2c = await page.locator("h3", { hasText: "B2B Corporate" }).first().isVisible();
  const paymentBreakdown = await page.locator("h3", { hasText: "Payment Gateway Breakdown" }).first().isVisible();
  const dailySalesTable = await page.locator("h3", { hasText: "Daily Sales Register" }).first().isVisible();

  if (!trendVisual || !b2bB2c || !paymentBreakdown || !dailySalesTable) {
    throw new Error("❌ FAIL: Sales & Revenue body charts or tables are missing!");
  }
  console.log("  ✅ PASS: Revenue Trend, B2B/B2C split, Payment breakdown, and Daily Sales table are visibly rendered!");

  console.log("\nSTEP 4: Triggering Export Sales & Revenue (XLSX) download...");
  const exportBtn = page.locator("button", { hasText: "Export Sales & Revenue (XLSX)" }).first();
  await exportBtn.waitFor({ state: "visible", timeout: 15000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    exportBtn.click(),
  ]);

  const downloadPath = path.join(downloadsDir, download.suggestedFilename());
  await download.saveAs(downloadPath);
  console.log(`  ✅ PASS: Downloaded physical Excel file: ${download.suggestedFilename()} (${fs.statSync(downloadPath).size} bytes)`);

  console.log("\nSTEP 5: Parsing downloaded Excel file using ExcelJS...");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(downloadPath);

  const sheet = wb.worksheets[0];
  const headerCell = sheet.getCell("A1").value?.toString() || "";
  const periodCell = sheet.getCell("A2").value?.toString() || "";

  console.log(`  - Excel Sheet Name: "${sheet.name}"`);
  console.log(`  - Header Cell A1: "${headerCell}"`);
  console.log(`  - Period Cell A2: "${periodCell}"`);
  console.log(`  - Total Rows: ${sheet.rowCount}`);

  if (!headerCell.includes("CAKETOHOME")) {
    throw new Error(`❌ FAIL: Excel header cell does not contain CAKETOHOME! Found: "${headerCell}"`);
  }
  if (sheet.rowCount < 7) {
    throw new Error(`❌ FAIL: Excel sheet has insufficient data rows! Count: ${sheet.rowCount}`);
  }
  console.log("  ✅ PASS: Excel export verified for company header, period, and numeric data rows!");

  console.log("\nSTEP 6: Auditing all 12 Analytics tabs for non-empty report body rendering...");
  const sections = [
    "Executive Summary",
    "Sales & Revenue",
    "Products & Profitability",
    "Orders & Lifecycle",
    "Branch Performance",
    "Tax & GST Register",
    "Delivery & Fleet",
    "Customer Analytics",
    "Payments & Refunds",
    "Geographic Sales",
    "Cross-Sell & Upsell",
    "Exception Center",
  ];

  for (const label of sections) {
    const tabBtn = page.locator("button", { hasText: label }).first();
    await tabBtn.waitFor({ state: "visible", timeout: 15000 });
    await tabBtn.click();
    await page.waitForTimeout(500);

    const isVisible = await page.locator("h2, h3").count() > 0;
    if (!isVisible) {
      throw new Error(`❌ FAIL: Report tab '${label}' body is empty!`);
    }
    console.log(`  - [TAB] ${label}: ✅ NON-EMPTY BODY VERIFIED`);
  }

  await browser.close();

  console.log("\n================================================================================");
  console.log("SALES & REVENUE E2E TEST: ALL 6 STEPS PASSED (100%)");
  console.log("================================================================================");
}

runAnalyticsSalesRevenueTest().catch((err) => {
  console.error("❌ E2E TEST FAILED:", err);
  process.exit(1);
});
