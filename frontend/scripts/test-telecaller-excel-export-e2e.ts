/**
 * CakeToHome Telecaller Calling-List Excel Export E2E Test Suite
 * Run with: npx tsx scripts/test-telecaller-excel-export-e2e.ts
 */

import { TelemarketingExportService } from "../src/lib/telemarketing-export-service";
import { TelemarketingEngine } from "../src/lib/telemarketing-engine";
import ExcelJS from "exceljs";

async function runTelecallerExportTests() {
  console.log("================================================================================");
  console.log("CAKETOHOME — TELECALLER CALLING-LIST EXCEL EXPORT VERIFICATION");
  console.log("================================================================================\n");

  const results: Record<string, "PASS" | "FAIL"> = {
    telecaller_list_generation: "FAIL",
    column_ordering: "FAIL",
    phone_formatting: "FAIL",
    date_formatting: "FAIL",
    filter_preservation: "FAIL",
    six_sheet_master_workbook: "FAIL",
    excel_formatting_autofilter: "FAIL",
  };

  // ── 1. Telecaller List Generation ──────────────────────────────────────────
  console.log("1. Testing Telecaller Calling List Generation...");
  try {
    const exportResult = await TelemarketingExportService.generateTelecallerCallingList();
    if (exportResult.buffer && exportResult.buffer.byteLength > 5000 && exportResult.filename.includes("CakeToHome_Telecaller_")) {
      results.telecaller_list_generation = "PASS";
      console.log(`   [PASS] Generated calling list "${exportResult.filename}.xlsx" (${exportResult.buffer.byteLength} bytes)`);
    }
  } catch (err: any) {
    console.error("   [FAIL] Calling list generation error:", err.message);
  }

  // ── 2. Column Ordering & Technical IDs Placement ───────────────────────────
  console.log("\n2. Testing Prioritized Column Ordering...");
  try {
    const exportResult = await TelemarketingExportService.generateTelecallerCallingList();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exportResult.buffer as any);
    const sheet = wb.getWorksheet("Calling List");

    const headerRow = sheet?.getRow(6).values as string[];

    // Verify expected columns:
    // A: Priority, B: Customer Name, C: Phone Number, D: Previous Order Date, E: Previous Cake,
    // F: Occasion, G: Previous Order Value, H: Expected Reorder Date, I: City, J: Area,
    // K: Pincode, L: Reason for Call, M: Recommended Cake, N: Contact Status, O: Assigned Telecaller,
    // P: Next Follow-Up, Q: Call Notes, R: Score, S: Customer ID, T: Previous Order #, U: Preferred Branch
    const expectedHeaders = [
      "Priority", "Customer Name", "Phone Number", "Previous Order Date", "Previous Cake",
      "Occasion", "Previous Order Value", "Expected Reorder Date", "City", "Area",
      "Pincode", "Reason for Call", "Recommended Cake", "Contact Status", "Assigned Telecaller",
      "Next Follow-Up", "Call Notes", "Score", "Customer ID", "Previous Order #", "Preferred Branch"
    ];

    let headersMatch = true;
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (headerRow[i + 1] !== expectedHeaders[i]) {
        headersMatch = false;
        console.error(`   Mismatch at col ${i + 1}: expected "${expectedHeaders[i]}", got "${headerRow[i + 1]}"`);
      }
    }

    if (headersMatch) {
      results.column_ordering = "PASS";
      console.log("   [PASS] Prioritized column order verified: Telecaller-facing fields are first (Name, Phone, Date, Cake, Reason), technical IDs are placed last.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Column ordering error:", err.message);
  }

  // ── 3. Phone Number Formatting & Credential Protection ────────────────────
  console.log("\n3. Testing Phone Number Formatting & Privacy...");
  try {
    const rawSamplePhone = "9876543210";
    const formatted = TelemarketingExportService.formatPhoneReadable(rawSamplePhone);
    const isValidFormat = formatted === "+91 98765 43210";

    const exportResult = await TelemarketingExportService.generateTelecallerCallingList();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exportResult.buffer as any);
    const sheet = wb.getWorksheet("Calling List");

    const samplePhoneCell = sheet?.getCell("C7").value?.toString();
    const phoneValidInSheet = Boolean(samplePhoneCell && samplePhoneCell.startsWith("+91 "));

    // Check no sensitive fields
    let zeroLeakage = true;
    sheet?.eachRow((row) => {
      row.eachCell((cell) => {
        const strVal = String(cell.value || "");
        if (strVal.includes("jwt_") || strVal.includes("otp") || strVal.includes("password")) {
          zeroLeakage = false;
        }
      });
    });

    if (isValidFormat && phoneValidInSheet && zeroLeakage) {
      results.phone_formatting = "PASS";
      console.log(`   [PASS] Phone number formatted cleanly to '${samplePhoneCell}' with zero token/credential leakage.`);
    }
  } catch (err: any) {
    console.error("   [FAIL] Phone formatting error:", err.message);
  }

  // ── 4. Date Formatting (DD/MM/YYYY) ───────────────────────────────────────
  console.log("\n4. Testing Date Formatting (DD/MM/YYYY)...");
  try {
    const d1 = TelemarketingExportService.formatDateDDMMYYYY("2025-08-18T14:30:00.000Z");
    const d2 = TelemarketingExportService.formatDateDDMMYYYY("2026-08-18");

    const exportResult = await TelemarketingExportService.generateTelecallerCallingList();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exportResult.buffer as any);
    const sheet = wb.getWorksheet("Calling List");

    const prevDateCell = sheet?.getCell("D7").value?.toString();
    const expectedDateCell = sheet?.getCell("H7").value?.toString();

    const isDDMMYYYY = (str?: string) => Boolean(str && /^\d{2}\/\d{2}\/\d{4}$/.test(str));

    if (d1 === "18/08/2025" && d2 === "18/08/2026" && isDDMMYYYY(prevDateCell) && isDDMMYYYY(expectedDateCell)) {
      results.date_formatting = "PASS";
      console.log(`   [PASS] Dates formatted as DD/MM/YYYY (Prev: ${prevDateCell}, Expected: ${expectedDateCell})`);
    }
  } catch (err: any) {
    console.error("   [FAIL] Date formatting error:", err.message);
  }

  // ── 5. Filter Preservation ────────────────────────────────────────────────
  console.log("\n5. Testing Filter Preservation...");
  try {
    const highPriExport = await TelemarketingExportService.generateTelecallerCallingList(undefined, {
      filterType: "high_priority",
    });
    const wbHigh = new ExcelJS.Workbook();
    await wbHigh.xlsx.load(highPriExport.buffer as any);
    const highSheet = wbHigh.getWorksheet("Calling List");

    let allHigh = true;
    for (let r = 7; r <= (highSheet?.rowCount || 7); r++) {
      const pVal = highSheet?.getCell(`A${r}`).value;
      if (pVal && pVal !== "HIGH") allHigh = false;
    }

    if (allHigh && highPriExport.filename.includes("HighPriority")) {
      results.filter_preservation = "PASS";
      console.log(`   [PASS] Filter preservation verified: Filtered export contains only high priority candidates.`);
    }
  } catch (err: any) {
    console.error("   [FAIL] Filter preservation error:", err.message);
  }

  // ── 6. Six-Sheet Complete Master Workbook ──────────────────────────────────
  console.log("\n6. Testing 6-Sheet Master Workbook...");
  try {
    const masterExport = await TelemarketingExportService.generateExcelWorkbook();
    const wbMaster = new ExcelJS.Workbook();
    await wbMaster.xlsx.load(masterExport.buffer as any);

    const sheetNames = wbMaster.worksheets.map((s) => s.name);
    const expected6Sheets = [
      "Calling List",
      "High Priority",
      "Calls Due",
      "Follow-Ups",
      "Purchase Context",
      "Campaign Summary",
    ];

    const hasAll6 = expected6Sheets.every((name) => sheetNames.includes(name));

    // Check Campaign Summary content
    const summarySheet = wbMaster.getWorksheet("Campaign Summary");
    const summaryRowCount = summarySheet?.rowCount || 0;

    if (hasAll6 && summaryRowCount >= 15) {
      results.six_sheet_master_workbook = "PASS";
      console.log(`   [PASS] 6-Sheet Master Workbook verified: [${sheetNames.join(", ")}]`);
    }
  } catch (err: any) {
    console.error("   [FAIL] 6-sheet workbook error:", err.message);
  }

  // ── 7. Excel Formatting, AutoFilter & Frozen Rows ──────────────────────────
  console.log("\n7. Testing Excel Formatting, AutoFilter & Frozen Rows...");
  try {
    const exportResult = await TelemarketingExportService.generateTelecallerCallingList();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exportResult.buffer as any);
    const sheet = wb.getWorksheet("Calling List");

    const hasAutoFilter = Boolean(sheet?.autoFilter);
    const views = sheet?.views || [];
    const isFrozen = views.some((v) => (v as any).state === "frozen" && (v as any).ySplit === 6);
    const numFmt = sheet?.getCell("G7").numFmt;

    if (hasAutoFilter && isFrozen && numFmt === "₹#,##0.00") {
      results.excel_formatting_autofilter = "PASS";
      console.log("   [PASS] Excel formatting verified: Top row frozen (ySplit=6), AutoFilter active, ₹ currency format applied.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Excel formatting error:", err.message);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log("TELECALLER EXCEL EXPORT ACCEPTANCE SUMMARY");
  console.log("================================================================================\n");

  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  const allPassed = Object.values(results).every((v) => v === "PASS");
  if (allPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTelecallerExportTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
