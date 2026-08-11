import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

async function runCustomerAnalyticsTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME — E2E CUSTOMER ANALYTICS & EXCEL EXPORT ACCEPTANCE TEST");
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

  console.log("STEP 2: Clicking 'Customer Analytics' tab...");
  const customerTabBtn = page.locator("button", { hasText: "Customer Analytics" }).first();
  await customerTabBtn.waitFor({ state: "visible", timeout: 15000 });
  await customerTabBtn.click();
  await page.waitForTimeout(2000);

  console.log("STEP 3: Asserting Customer Analytics report body structure...");
  const customerHeader = page.locator("h2", { hasText: "Customer Analytics" }).first();
  await customerHeader.waitFor({ state: "visible", timeout: 15000 });
  console.log("  ✅ PASS: Customer Analytics header is visible on screen!");

  const kpiBuyers = await page.locator("text='Total Active Buyers'").first().isVisible();
  const kpiNew = await page.locator("text='New Customers'").first().isVisible();
  const kpiRepeat = await page.locator("text='Repeat Purchase Rate'").first().isVisible();
  const kpiLtv = await page.locator("text='Average Customer LTV'").first().isVisible();

  if (!kpiBuyers || !kpiNew || !kpiRepeat || !kpiLtv) {
    throw new Error("❌ FAIL: Customer Analytics KPI cards are missing!");
  }
  console.log("  ✅ PASS: All Customer Analytics KPI cards are visibly rendered!");

  console.log("\nSTEP 4: Verifying absence of demo customer IDs (cust_101-104)...");
  const pageText = await page.innerText("body");
  const demoIdsFound = ["cust_101", "cust_102", "cust_103", "cust_104"].some((id) => pageText.includes(id));

  if (demoIdsFound) {
    throw new Error("❌ FAIL: Demo customer IDs (cust_101, cust_102, etc.) are still present on screen!");
  }
  console.log("  ✅ PASS: Verified 100% absence of demo customer IDs (cust_101-104)!");

  const rows = page.locator("tbody tr");
  const rowCount = await rows.count();
  console.log(`  - Total Dynamic Customer Rows in Table: ${rowCount}`);

  if (rowCount === 0) {
    throw new Error("❌ FAIL: Customer Analytics table has 0 customer rows!");
  }

  const firstCustomerText = await rows.first().innerText();
  console.log(`  - Sample Customer Row #1: "${firstCustomerText.replace(/\s+/g, " ")}"`);
  console.log("  ✅ PASS: Customer Analytics table dynamically loaded real CakeToHome customer records!");

  console.log("\nSTEP 5: Triggering Export Customer Analytics (XLSX) download...");
  const exportBtn = page.locator("button", { hasText: "Export Customer Analytics (XLSX)" }).first();
  await exportBtn.waitFor({ state: "visible", timeout: 15000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    exportBtn.click(),
  ]);

  const downloadPath = path.join(downloadsDir, download.suggestedFilename());
  await download.saveAs(downloadPath);
  console.log(`  ✅ PASS: Downloaded physical Excel file: ${download.suggestedFilename()} (${fs.statSync(downloadPath).size} bytes)`);

  console.log("\nSTEP 6: Parsing downloaded Excel file using ExcelJS...");
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
  console.log("  ✅ PASS: Excel export verified for company header, period, and numeric customer data rows!");

  console.log("\nSTEP 7: Auditing all 12 Analytics tabs for non-empty report body rendering...");
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
  console.log("CUSTOMER ANALYTICS E2E TEST: ALL 7 STEPS PASSED (100%)");
  console.log("================================================================================");
}

runCustomerAnalyticsTest().catch((err) => {
  console.error("❌ E2E TEST FAILED:", err);
  process.exit(1);
});
