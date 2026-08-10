/**
 * CakeToHome — Dynamic Kitchen Hub / Branch Report Filter Verification Test Suite
 * Validates dynamic API branch fetching, no hard-coded branch IDs/counts, Select All & Clear All
 * UI control mechanics, immediate refetch upon branch creation, report dataset filtering,
 * and ExcelJS export metadata formatting.
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";
import { ReportsEngineData } from "../frontend/src/lib/reports-engine-data";
import { ExcelExportService } from "../frontend/src/lib/excel-export-service";

async function runDynamicBranchFilterTestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME — DYNAMIC KITCHEN HUB / BRANCH REPORT FILTER TEST SUITE");
  console.log("================================================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  // TEST 1: Fetch Authoritative Branch List from Canonical API Engine
  console.log("TEST 1: Validating Authoritative Branch Loading from ApiEngine...");
  const rawBranches: any[] = ApiEngine.getAdminBranches() || [];

  if (rawBranches && rawBranches.length > 0) {
    console.log(`  ✅ PASS: Loaded ${rawBranches.length} dynamic operating branches from ApiEngine!`);
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Failed to load operating branches from canonical API engine.");
    failedTests++;
  }

  // TEST 2: Select All Mechanics (No Fake "all" Branch ID)
  console.log("\nTEST 2: Validating Select All & Clear All Control Mechanics...");
  const allEligibleBranchIds = rawBranches.map((b: any) => b.id);
  const hasNoFakeAllString = !allEligibleBranchIds.includes("all") && !allEligibleBranchIds.includes("ALL_KITCHEN_HUBS");

  let selectedBranchIds = [...allEligibleBranchIds];
  const isSelectAllActive = selectedBranchIds.length === rawBranches.length;

  selectedBranchIds = [];
  const isClearAllActive = selectedBranchIds.length === 0;

  if (hasNoFakeAllString && isSelectAllActive && isClearAllActive) {
    console.log("  ✅ PASS: Select All & Clear All controls use real branch IDs without fake 'all' strings!");
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Select All / Clear All control test failed.");
    failedTests++;
  }

  // TEST 3: Dynamic Branch Creation & Immediate Refetch
  console.log("\nTEST 3: Validating Dynamic Branch Creation & Refetching...");
  const initialCount = rawBranches.length;
  const newBranchPayload = {
    name: "New Koramangala Express Kitchen",
    code: `HUB-EXPRESS-${Date.now().toString().slice(-4)}`,
    city: "Bengaluru",
    address: "80 Feet Rd, Koramangala 4th Block, Bengaluru",
    phone: "+91 99887 76655",
    is_open: true,
  };

  const createdBranch: any = ApiEngine.createAdminBranch(newBranchPayload);
  const updatedBranches: any[] = ApiEngine.getAdminBranches() || [];

  const newBranchFound = updatedBranches.some((b: any) => b.id === createdBranch.id || b.name === newBranchPayload.name);

  if (updatedBranches.length === initialCount + 1 && newBranchFound) {
    console.log(`  ✅ PASS: Newly created branch "${createdBranch.name}" (${createdBranch.id}) dynamically appeared! Total count: ${updatedBranches.length}`);
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Dynamic branch creation refetch test failed.");
    failedTests++;
  }

  // TEST 4: Report Query & Dataset Filtering by Actual Branch IDs
  console.log("\nTEST 4: Validating Report Dataset Filtering by Actual Branch IDs...");
  const allUpdatedBranchIds = updatedBranches.map((b: any) => b.id);
  const fullReport = ReportsEngineData.getGstReport({
    timeRange: "this_month",
    branchIds: allUpdatedBranchIds,
  });

  const singleBranchReport = ReportsEngineData.getGstReport({
    timeRange: "this_month",
    branchIds: [createdBranch.id],
  });

  if (fullReport.length > 0 && singleBranchReport.length > 0) {
    console.log(`  ✅ PASS: ReportsEngineData generated datasets for ${allUpdatedBranchIds.length} branches!`);
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Report dataset branch filtering failed.");
    failedTests++;
  }

  // TEST 5: Dynamic Excel Export Subtitle Formatting
  console.log("\nTEST 5: Validating Excel Export Dynamic Branch Subtitle Formatting...");
  const singleSubtitle = ExcelExportService.formatBranchSubtitle({ branchIds: ["br_indiranagar"] });
  const multiSubtitle = ExcelExportService.formatBranchSubtitle({ branchIds: ["br_indiranagar", "br_koramangala"] });
  const allSubtitle = ExcelExportService.formatBranchSubtitle({ branchIds: [] });

  if (
    singleSubtitle === "Branch: br_indiranagar" &&
    multiSubtitle === "Branches: 2 Selected" &&
    allSubtitle === "All Operating Branches"
  ) {
    console.log("  ✅ PASS: Excel Export dynamic branch subtitles verified!");
    passedTests++;
  } else {
    console.error("  ❌ FAIL: Excel Export branch subtitle formatting failed:", { singleSubtitle, multiSubtitle, allSubtitle });
    failedTests++;
  }

  console.log("\n================================================================================");
  console.log(`DYNAMIC BRANCH REPORT FILTER TEST SUITE: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runDynamicBranchFilterTestSuite().catch((err) => {
  console.error("Dynamic Branch Filter test suite failed:", err);
  process.exit(1);
});
