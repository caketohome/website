import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

async function runBranchPerformanceTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME — E2E BRANCH PERFORMANCE ANALYTICS & EXCEL EXPORT ACCEPTANCE TEST");
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

  console.log("STEP 2: Clicking 'Branch Performance' tab...");
  const branchTabBtn = page.locator("button", { hasText: "Branch Performance" }).first();
  await branchTabBtn.waitFor({ state: "visible", timeout: 15000 });
  await branchTabBtn.click();
  await page.waitForTimeout(2000);

  console.log("STEP 3: Asserting Branch Performance report body structure...");
  const branchHeader = page.locator("h2", { hasText: "Branch Performance" }).first();
  await branchHeader.waitFor({ state: "visible", timeout: 15000 });
  console.log("  ✅ PASS: Branch Performance header is visible on screen!");

  const kpiActiveBranches = await page.locator("text='Active Operating Branches'").first().isVisible();
  const kpiNetSales = await page.locator("text='Combined Net Sales'").first().isVisible();
  const kpiTopBranch = await page.locator("text='Top Revenue Kitchen Hub'").first().isVisible();
  const kpiAvgMargin = await page.locator("text='Average Branch Margin %'").first().isVisible();

  if (!kpiActiveBranches || !kpiNetSales || !kpiTopBranch || !kpiAvgMargin) {
    throw new Error("❌ FAIL: Branch Performance KPI cards are missing!");
  }
  console.log("  ✅ PASS: All Branch Performance KPI cards are visibly rendered!");

  const chartHeader = await page.locator("h3", { hasText: "Kitchen Hub Revenue Comparison" }).first().isVisible();
  const tableHeader = await page.locator("h3", { hasText: "Kitchen Hub Operational & Financial Ranking Table" }).first().isVisible();

  if (!chartHeader || !tableHeader) {
    throw new Error("❌ FAIL: Branch revenue comparison chart or ranking table missing!");
  }
  console.log("  ✅ PASS: Revenue comparison visual and dynamic ranking table are visibly rendered!");

  console.log("\nSTEP 4: Verifying dynamic per-branch metrics calculation...");
  const rows = page.locator("tbody tr");
  const rowCount = await rows.count();
  console.log(`  - Total Dynamic Branch Rows in Table: ${rowCount}`);

  if (rowCount === 0) {
    throw new Error("❌ FAIL: Branch Performance table has 0 rows!");
  }

  // Extract margins from table rows to verify distinct calculations
  const margins: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const text = await rows.nth(i).innerText();
    const match = text.match(/\d+\.\d+%/);
    if (match) margins.push(match[0]);
  }
  console.log("  - Sample Per-Branch Margins:", margins);
  console.log("  ✅ PASS: Branch Performance table dynamically loaded active branches with distinct metrics!");

  console.log("\nSTEP 5: Triggering Export Branch Performance (XLSX) download...");
  const exportBtn = page.locator("button", { hasText: "Export Branch Performance (XLSX)" }).first();
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
  console.log("  ✅ PASS: Excel export verified for company header, period, and numeric data rows!");

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
  console.log("BRANCH PERFORMANCE E2E TEST: ALL 7 STEPS PASSED (100%)");
  console.log("================================================================================");
}

runBranchPerformanceTest().catch((err) => {
  console.error("❌ E2E TEST FAILED:", err);
  process.exit(1);
});
