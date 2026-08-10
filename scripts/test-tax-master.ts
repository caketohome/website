/**
 * CakeToHome — Reusable Tax Master & Statutory GST Engine Verification Test Suite
 * Validates Tax Master CRUD, Tax Resolution Hierarchy, Immutable Order Snapshots,
 * Tax Summary Reports, HSN Composite Grouping, and ExcelJS XLSX Exports.
 */

import { TaxMasterService, TaxEngine } from "../backend/src/services/tax-engine";
import { ReportsEngineData } from "../frontend/src/lib/reports-engine-data";
import { ExcelExportService } from "../frontend/src/lib/excel-export-service";

async function runTaxMasterTestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME — DYNAMIC TAX MASTER & STATUTORY GST ENGINE TEST SUITE");
  console.log("================================================================ drop-down\n");

  let passedTests = 0;
  let failedTests = 0;

  // TEST 1: Tax Master Pre-Configured Records List
  console.log("TEST 1: Validating Pre-Configured Tax Master Records...");
  const configs = TaxMasterService.listTaxConfigurations();
  const hasFood5 = configs.some((c) => c.code === "GST_FOOD_5" && c.gstRatePct === 5);
  const hasFood12 = configs.some((c) => c.code === "GST_FOOD_12" && c.gstRatePct === 12);
  const hasFood18 = configs.some((c) => c.code === "GST_FOOD_18" && c.gstRatePct === 18);
  const hasExempt = configs.some((c) => c.code === "GST_EXEMPT" && c.taxability === "Exempt");

  if (configs.length >= 6 && hasFood5 && hasFood12 && hasFood18 && hasExempt) {
    console.log(`  ✅ PASS: Found ${configs.length} standard pre-configured Tax Master records!`);
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Pre-configured Tax Master records verification failed.");
    failedTests++;
  }

  // TEST 2: Tax Master CRUD (Create, Duplicate, Toggle Active)
  console.log("\nTEST 2: Validating Tax Master CRUD Operations...");
  const customConfig = TaxMasterService.saveTaxConfiguration({
    name: "GST Bakery Special 12%",
    code: "GST_BAKERY_12",
    description: "Special 12% GST rate for artisanal gift items",
    taxability: "Taxable",
    gstRatePct: 12,
    cgstRatePct: 6,
    sgstRatePct: 6,
    igstRatePct: 12,
    taxInclusive: true,
  });

  const dup = TaxMasterService.duplicateTaxConfiguration(customConfig.id, "GST Bakery Special 12% Copy", "GST_BAKERY_12_COPY");
  const toggled = TaxMasterService.toggleActive(customConfig.id, false);

  if (customConfig.code === "GST_BAKERY_12" && dup.code === "GST_BAKERY_12_COPY" && toggled.isActive === false) {
    console.log(`  ✅ PASS: Tax Master Create (${customConfig.id}), Duplicate (${dup.id}), and Deactivate verified!`);
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Tax Master CRUD operations failed.");
    failedTests++;
  }

  // TEST 3: Authoritative Tax Engine & Resolution Output
  console.log("\nTEST 3: Validating Authoritative Tax Engine Calculation & Resolution...");
  const taxOutput = TaxEngine.calculateItemTax({
    productId: "prod_cake_01",
    taxConfigurationCode: "GST_FOOD_5",
    quantity: 2,
    unitPrice: 500,
    discount: 50,
    hsnCode: "19059090",
    uqc: "NOS",
    customerStateCode: "29", // Karnataka (Intra-State)
  });

  if (
    taxOutput.taxConfigurationCode === "GST_FOOD_5" &&
    taxOutput.taxableValue === 904.76 &&
    taxOutput.cgst === 22.62 &&
    taxOutput.sgst === 22.62 &&
    taxOutput.totalTax === 45.24 &&
    taxOutput.supplyType === "INTRA-STATE"
  ) {
    console.log("  ✅ PASS: TaxEngine calculated exact statutory Intra-State GST breakdown!");
    passedTests++;
  } else {
    console.error("  ❌ FAIL: TaxEngine calculation test failed:", taxOutput);
    failedTests++;
  }

  // TEST 4: Immutable Transaction Order Tax Snapshot
  console.log("\nTEST 4: Validating Immutable Order Tax Snapshot...");
  const orderTax = TaxEngine.calculateOrderTax([
    {
      productId: "prod_cake_01",
      taxConfigurationCode: "GST_FOOD_5",
      quantity: 1,
      unitPrice: 1000,
      hsnCode: "19059090",
      uqc: "NOS",
      customerStateCode: "33", // Tamil Nadu (Inter-State IGST)
    },
    {
      productId: "prod_candle_01",
      taxConfigurationCode: "GST_FOOD_18",
      quantity: 2,
      unitPrice: 100,
      hsnCode: "34060010",
      uqc: "PKT",
      customerStateCode: "33",
    },
  ]);

  const item1 = orderTax.itemOutputs[0];
  const item2 = orderTax.itemOutputs[1];

  if (
    item1.supplyType === "INTER-STATE" &&
    item1.igst === 47.62 &&
    item2.igst === 30.51 &&
    orderTax.grandTotal === 1200
  ) {
    console.log("  ✅ PASS: Immutable Order Tax Snapshot correctly captures multi-item IGST breakdown!");
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Immutable Order Tax Snapshot test failed.");
    failedTests++;
  }

  // TEST 5: Tax Summary Report Dataset Generation
  console.log("\nTEST 5: Validating Tax Summary Report Dataset...");
  const taxSummary = ReportsEngineData.getTaxSummaryReport({ timeRange: "this_month", branchIds: [] });
  const hasSummary5 = taxSummary.some((t) => t.taxConfigurationCode === "GST_FOOD_5");

  if (taxSummary.length > 0 && hasSummary5) {
    console.log(`  ✅ PASS: Tax Summary Report generated ${taxSummary.length} tax configuration rows!`);
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Tax Summary Report test failed.");
    failedTests++;
  }

  // TEST 6: Dedicated ExcelJS Tax Summary Export
  console.log("\nTEST 6: Validating Dedicated ExcelJS Tax Summary Export (.xlsx)...");
  try {
    let downloadCalled = false;
    (ExcelExportService as any).triggerBrowserDownload = (buf: ArrayBuffer) => {
      downloadCalled = buf.byteLength > 1000;
    };

    await ExcelExportService.exportTaxSummary({
      taxSummary,
      filters: { customStartDate: "2026-08-01", customEndDate: "2026-08-10" },
    });

    if (downloadCalled) {
      console.log("  ✅ PASS: ExcelJS generated binary .xlsx file for Tax Summary Report!");
      passedTests++;
    } else {
      console.error("  ❌ FAIL: ExcelJS Tax Summary export produced empty buffer.");
      failedTests++;
    }
  } catch (err: any) {
    console.error("  ❌ FAIL: ExcelJS Tax Summary export threw error:", err);
    failedTests++;
  }

  console.log("\n================================================================================");
  console.log(`TAX MASTER & GST TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTaxMasterTestSuite().catch((err) => {
  console.error("Tax Master test suite execution failed:", err);
  process.exit(1);
});
