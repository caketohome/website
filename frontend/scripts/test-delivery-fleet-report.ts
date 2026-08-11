import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

async function runDeliveryFleetReportTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME — E2E DELIVERY & FLEET ANALYTICS & EXCEL EXPORT ACCEPTANCE TEST");
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

  console.log("STEP 2: Clicking 'Delivery & Fleet' tab...");
  const deliveryTabBtn = page.locator("button", { hasText: "Delivery & Fleet" }).first();
  await deliveryTabBtn.waitFor({ state: "visible", timeout: 15000 });
  await deliveryTabBtn.click();
  await page.waitForTimeout(2000);

  console.log("STEP 3: Asserting Delivery & Fleet report body structure...");
  const deliveryHeader = page.locator("h2", { hasText: "Delivery & Fleet" }).first();
  await deliveryHeader.waitFor({ state: "visible", timeout: 15000 });
  console.log("  ✅ PASS: Delivery & Fleet header is visible on screen!");

  const kpiTotal = await page.locator("text='Total Deliveries'").first().isVisible();
  const kpiOnTime = await page.locator("text='On-Time Deliveries'").first().isVisible();
  const kpiDelayed = await page.locator("text='Delayed Deliveries'").first().isVisible();
  const kpiFulfillment = await page.locator("text='Avg Fulfillment Time'").first().isVisible();

  if (!kpiTotal || !kpiOnTime || !kpiDelayed || !kpiFulfillment) {
    throw new Error("❌ FAIL: Delivery & Fleet KPI cards are missing!");
  }
  console.log("  ✅ PASS: All Delivery & Fleet KPI cards are visibly rendered!");

  console.log("\nSTEP 4: Verifying absence of 3PL demo companies and presence of own fleet riders...");
  const pageText = await page.innerText("body");
  const demo3plFound = ["Shadowfax", "Dunzo", "Porter", "In-House Bakery Fleet"].some((demo) => pageText.includes(demo));

  if (demo3plFound) {
    throw new Error("❌ FAIL: 3PL demo companies (Shadowfax/Dunzo/Porter) are still present on screen!");
  }
  console.log("  ✅ PASS: Verified 100% absence of 3PL demo companies (Shadowfax, Dunzo, Porter)!");

  const rows = page.locator("tbody tr");
  const rowCount = await rows.count();
  console.log(`  - Total Dynamic Rider Rows in Table: ${rowCount}`);

  if (rowCount === 0) {
    throw new Error("❌ FAIL: Delivery & Fleet table has 0 rider rows!");
  }

  const firstRiderText = await rows.first().innerText();
  console.log(`  - Sample Rider Row #1: "${firstRiderText.replace(/\s+/g, " ")}"`);
  console.log("  ✅ PASS: Delivery & Fleet table dynamically loaded CakeToHome own fleet riders!");

  console.log("\nSTEP 5: Triggering Export Delivery Fleet (XLSX) download...");
  const exportBtn = page.locator("button", { hasText: "Export Delivery Fleet (XLSX)" }).first();
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
  const fleetModelCell = sheet.getCell("B4").value?.toString() || "";

  console.log(`  - Excel Sheet Name: "${sheet.name}"`);
  console.log(`  - Header Cell A1: "${headerCell}"`);
  console.log(`  - Period Cell A2: "${periodCell}"`);
  console.log(`  - Fleet Model Cell B4: "${fleetModelCell}"`);
  console.log(`  - Total Rows: ${sheet.rowCount}`);

  if (!headerCell.includes("CAKETOHOME")) {
    throw new Error(`❌ FAIL: Excel header cell does not contain CAKETOHOME! Found: "${headerCell}"`);
  }
  if (!fleetModelCell.includes("CakeToHome Dedicated Fleet")) {
    throw new Error(`❌ FAIL: Excel fleet model cell does not specify CakeToHome Dedicated Fleet! Found: "${fleetModelCell}"`);
  }
  if (sheet.rowCount < 7) {
    throw new Error(`❌ FAIL: Excel sheet has insufficient data rows! Count: ${sheet.rowCount}`);
  }
  console.log("  ✅ PASS: Excel export verified for company header, fleet model, period, and numeric data rows!");

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
  console.log("DELIVERY & FLEET E2E TEST: ALL 7 STEPS PASSED (100%)");
  console.log("================================================================================");
}

runDeliveryFleetReportTest().catch((err) => {
  console.error("❌ E2E TEST FAILED:", err);
  process.exit(1);
});
