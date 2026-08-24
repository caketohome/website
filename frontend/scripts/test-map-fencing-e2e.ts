import { ApiEngine } from "../src/lib/api-engine";

async function main() {
  console.log("\n========================================================");
  console.log("🚀 STARTING STRICT MAP GEODECISION E2E VERIFICATION SUITE");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, detail !== undefined ? detail : "");
      failed++;
    }
  }

  // 1. Coordinates within range (Close to Indiranagar Flagship Bakery)
  // Indiranagar coordinates: lat 12.9716, lng 77.6412
  console.log("\n--- Scenario 1: Coordinates Within Serviceable Radius ---");
  const closeCoords = ApiEngine.resolveSmartBranch({
    lat: 12.9716 + 0.01, // ~1.1km north
    lng: 77.6412,
  });
  assert(closeCoords.resolvedBy.startsWith("geofence_"), `Resolved by geofence coordinates: ${closeCoords.resolvedBy}`);
  assert(closeCoords.branch.id === "br_indiranagar", `Resolved to closest branch (Indiranagar): resolved to ${closeCoords.branch.id}`);
  assert(closeCoords.zoneName === "Zone A", `Correct zone resolved: ${closeCoords.zoneName}`);

  const contextClose = ApiEngine.resolveDeliveryContext(undefined, 12.9716 + 0.01, 77.6412);
  assert(contextClose.serviceable === true, "resolveDeliveryContext returns serviceable = true for coords within radius");
  assert(contextClose.storeId === "br_indiranagar", `Resolved storeId matches Indiranagar: ${contextClose.storeId}`);

  // 2. Coordinates outside range
  console.log("\n--- Scenario 2: Coordinates Outside All Branch Radii ---");
  const farCoords = ApiEngine.resolveSmartBranch({
    lat: 12.9716 + 0.3, // ~33km north
    lng: 77.6412,
  });
  assert(farCoords.resolvedBy === "unserviceable_coords", `Resolved as unserviceable coordinates: ${farCoords.resolvedBy}`);
  assert(!!farCoords.blockedReason, `Correctly returns blockedReason: ${farCoords.blockedReason}`);

  const contextFar = ApiEngine.resolveDeliveryContext(undefined, 12.9716 + 0.3, 77.6412);
  assert(contextFar.serviceable === false, "resolveDeliveryContext returns serviceable = false for out-of-range coords");
  assert(!!contextFar.blockedReason, `Explanatory blocked reason returned: ${contextFar.blockedReason}`);

  // 3. Serviceable pincode
  console.log("\n--- Scenario 3: Serviceable Pincode ---");
  const contextPin = ApiEngine.resolveDeliveryContext("560038");
  assert(contextPin.serviceable === true, "resolveDeliveryContext returns serviceable = true for pincode 560038");
  assert(contextPin.storeId === "br_indiranagar", `Resolved store is Indiranagar: ${contextPin.storeId}`);

  // 4. Unserviceable pincode
  console.log("\n--- Scenario 4: Unserviceable Pincode ---");
  const contextUnservPin = ApiEngine.resolveDeliveryContext("999999");
  assert(contextUnservPin.serviceable === false, "resolveDeliveryContext returns serviceable = false for pincode 999999");
  assert(!!contextUnservPin.blockedReason, `Explanatory blocked reason returned: ${contextUnservPin.blockedReason}`);

  // 5. Empty inputs (initial storefront load)
  console.log("\n--- Scenario 5: Empty Inputs (Initial Load) ---");
  const contextEmpty = ApiEngine.resolveSmartBranch({});
  assert(contextEmpty.resolvedBy === "operational_fallback", `Defaults safely to fallback: ${contextEmpty.resolvedBy}`);

  console.log("\n========================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
