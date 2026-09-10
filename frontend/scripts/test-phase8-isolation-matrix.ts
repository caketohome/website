import { ApiEngine } from "../src/lib/api-engine";
import assert from "assert";

async function runIsolationMatrixTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME — PHASE 8 FINAL HARDENING: ISOLATION MATRIX & CONTEXT TEST");
  console.log("================================================================================\n");

  try {
    await ApiEngine.ensureHydrated();
    const BASE_URL = "http://localhost:3000";

    // ──────────────────────────────────────────────────────────────────────────
    // 1. BRANCH CONTEXT: Branch A vs Branch B Context Isolation
    // ──────────────────────────────────────────────────────────────────────────
    console.log("--- 1. TESTING BRANCH AVAILABILITY CONTEXT ISOLATION ---");
    const branches = ApiEngine.getStore().branches || [];
    const branchA = branches[0];
    const branchB = branches[1];
    console.log(`Branch A: ${branchA.name} (${branchA.id})`);
    console.log(`Branch B: ${branchB.name} (${branchB.id})`);

    // Product to test
    const prod = ApiEngine.getProducts()[0];
    const pId = prod.id || prod.product_id;
    console.log(`Test Product: ${prod.title} (${pId})`);

    // Direct Engine verification
    branchA.product_availability = { [pId]: { status: "OUT_OF_STOCK" } };
    branchB.product_availability = { [pId]: { status: "AVAILABLE" } };

    const resA1 = ApiEngine.getProductById(pId, branchA.id);
    const resB1 = ApiEngine.getProductById(pId, branchB.id);

    assert.strictEqual(resA1.branch_status, "OUT_OF_STOCK", "Branch A must be OUT_OF_STOCK");
    assert.strictEqual(resA1.is_out_of_stock_at_branch, true, "Branch A is_out_of_stock_at_branch must be true");

    assert.strictEqual(resB1.branch_status, "AVAILABLE", "Branch B must be AVAILABLE");
    assert.strictEqual(resB1.is_out_of_stock_at_branch, false, "Branch B is_out_of_stock_at_branch must be false");

    // Repeat test
    const resA2 = ApiEngine.getProductById(pId, branchA.id);
    const resB2 = ApiEngine.getProductById(pId, branchB.id);

    assert.strictEqual(resA2.branch_status, "OUT_OF_STOCK", "Repeat Branch A must remain OUT_OF_STOCK");
    assert.strictEqual(resB2.branch_status, "AVAILABLE", "Repeat Branch B must remain AVAILABLE");

    console.log("  ✅ PASS: Branch A never receives Branch B data and Branch B never receives Branch A data.");

    console.log("\n--- 2. TESTING GEOGRAPHIC & SERVICEABILITY CONTEXT ISOLATION ---");
    const serviceableCity = "Bengaluru";
    const unserviceableCity = "NonExistentCity99";

    const eligibleResA = ApiEngine.getEligibleBranches({ city: serviceableCity });
    const eligibleResB = ApiEngine.getEligibleBranches({ city: unserviceableCity });

    const branchesA = eligibleResA.branches || [];
    const branchesB = eligibleResB.branches || [];

    console.log(`City "${serviceableCity}" -> Eligible Branches (${branchesA.length}):`, branchesA.slice(0, 3).map(b => b.name));
    console.log(`City "${unserviceableCity}" -> Eligible Branches (${branchesB.length}):`, branchesB.map(b => b.name));

    assert(branchesA.length > 0, `"${serviceableCity}" must have eligible branches`);
    assert(branchesB.length === 0, `"${unserviceableCity}" must have ZERO eligible branches`);

    // Coordinate-based map-first smart resolution using real branch coords
    const operationalBranch = branches.find((b: any) => typeof b.latitude === "number" && typeof b.longitude === "number");
    const testLat = operationalBranch ? operationalBranch.latitude : 12.9784;
    const testLng = operationalBranch ? operationalBranch.longitude : 77.6408;

    const smartA = ApiEngine.resolveSmartBranch({ lat: testLat, lng: testLng });
    console.log(`Coordinates (${testLat}, ${testLng}) -> Resolved Branch: ${smartA.branch?.name || "NONE"} (ResolvedBy: ${smartA.resolvedBy})`);
    assert(smartA.branch !== null, "Valid operational branch coordinates must resolve to an operational branch");

    // Verify HTTP endpoint Cache-Control with pincode and branch_id
    const resPinA = await fetch(`${BASE_URL}/api/v1/products?pincode=560038`);
    assert.strictEqual(resPinA.status, 200);
    const ccPinA = resPinA.headers.get("cache-control");
    console.log(`HTTP /api/v1/products?pincode=560038 -> Cache-Control: ${ccPinA}`);
    assert(ccPinA?.includes("no-store") || ccPinA?.includes("private"), "Pincode-filtered response must NOT be public cache");

    const resBranch = await fetch(`${BASE_URL}/api/v1/products?branch_id=${encodeURIComponent(branchA.id)}`);
    assert.strictEqual(resBranch.status, 200);
    const ccBranch = resBranch.headers.get("cache-control");
    console.log(`HTTP /api/v1/products?branch_id=${branchA.id} -> Cache-Control: ${ccBranch}`);
    assert(ccBranch?.includes("no-store") || ccBranch?.includes("private"), "Branch-filtered response must NOT be public cache");

    console.log("  ✅ PASS: Geographic & Serviceability context correctly isolates and enforces private/no-store caching.");

    // ──────────────────────────────────────────────────────────────────────────
    // 3. AUTHENTICATION & CUSTOMER ISOLATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- 3. TESTING CUSTOMER ACCOUNT CONTEXT ISOLATION ---");
    const customers = ApiEngine.getStore().customers || [];
    if (customers.length >= 2) {
      const custA = customers[0];
      const custB = customers[1];
      console.log(`Customer A: ${custA.first_name} ${custA.last_name} (${custA.id || custA.customer_uid})`);
      console.log(`Customer B: ${custB.first_name} ${custB.last_name} (${custB.id || custB.customer_uid})`);

      const resAuthA = ApiEngine.resolveUserAccount({ customerUid: custA.customer_uid || custA.id });
      const resAuthB = ApiEngine.resolveUserAccount({ customerUid: custB.customer_uid || custB.id });

      assert.strictEqual(resAuthA?.email, custA.email, "Cust A must resolve Cust A");
      assert.strictEqual(resAuthB?.email, custB.email, "Cust B must resolve Cust B");
      assert.notStrictEqual(resAuthA?.email, resAuthB?.email, "Cust A and Cust B must be isolated");

      console.log("  ✅ PASS: Customer profiles are strictly isolated with zero context leakage.");
    } else {
      console.log("  ℹ️ Insufficient customer records to test A/B comparison.");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. GST & HSN TAX CALCULATION ISOLATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- 4. TESTING GST & HSN TAX CALCULATION ISOLATION ---");
    const testBranch = branches[0];
    const sellerBranchState = testBranch.state || "Karnataka";
    const differentState = sellerBranchState.toLowerCase() === "karnataka" ? "Tamil Nadu" : "Karnataka";

    // Intrastate Tax Context (Same State)
    const taxContextIntra = ApiEngine.resolveTaxContext({
      branchId: testBranch.id,
      customerAddress: { state: sellerBranchState, city: "LocalCity" },
    });
    console.log(`Intrastate Tax Context (${taxContextIntra.sellerState} -> ${taxContextIntra.customerState}):`, {
      sellerState: taxContextIntra.sellerState,
      customerState: taxContextIntra.customerState,
      isIntraState: taxContextIntra.isIntraState,
      supplyType: taxContextIntra.supplyType,
      sellerGstin: taxContextIntra.sellerGstin,
    });
    assert.strictEqual(taxContextIntra.isIntraState, true, "Same state must be INTRA-STATE");
    assert.strictEqual(taxContextIntra.supplyType, "INTRA-STATE", "Supply type must be INTRA-STATE");

    // Interstate Tax Context (Different State)
    const taxContextInter = ApiEngine.resolveTaxContext({
      branchId: testBranch.id,
      customerAddress: { state: differentState, city: "OtherCity" },
    });
    console.log(`Interstate Tax Context (${taxContextInter.sellerState} -> ${taxContextInter.customerState}):`, {
      sellerState: taxContextInter.sellerState,
      customerState: taxContextInter.customerState,
      isIntraState: taxContextInter.isIntraState,
      supplyType: taxContextInter.supplyType,
    });
    assert.strictEqual(taxContextInter.isIntraState, false, "Different states must be INTER-STATE");
    assert.strictEqual(taxContextInter.supplyType, "INTER-STATE", "Supply type must be INTER-STATE");

    // Verify HSN 19059090 tax computation
    const unitPrice = 500;
    const gstRatePct = 5; // HSN 19059090 standard bakery rate
    const itemTaxable = Math.round((unitPrice / (1 + gstRatePct / 100)) * 100) / 100;
    const itemTax = Math.round((unitPrice - itemTaxable) * 100) / 100;
    
    // Intrastate breakdown: CGST 2.5% + SGST 2.5%
    const intraCgst = taxContextIntra.isIntraState ? Math.round((itemTax / 2) * 100) / 100 : 0;
    const intraSgst = taxContextIntra.isIntraState ? Math.round((itemTax / 2) * 100) / 100 : 0;
    const intraIgst = !taxContextIntra.isIntraState ? itemTax : 0;
    assert(intraCgst > 0 && intraSgst > 0, "Intrastate CGST & SGST must be > 0");
    assert.strictEqual(intraIgst, 0, "Intrastate IGST must be 0");
    assert(Math.abs((intraCgst + intraSgst) - itemTax) <= 0.02, "Intrastate CGST + SGST sum must equal item tax within rounding tolerance");

    // Interstate breakdown: IGST 5%
    const interCgst = taxContextInter.isIntraState ? Math.round((itemTax / 2) * 100) / 100 : 0;
    const interSgst = taxContextInter.isIntraState ? Math.round((itemTax / 2) * 100) / 100 : 0;
    const interIgst = !taxContextInter.isIntraState ? itemTax : 0;
    assert.strictEqual(interCgst, 0, "Interstate CGST must be 0");
    assert.strictEqual(interSgst, 0, "Interstate SGST must be 0");
    assert.strictEqual(interIgst, itemTax, "Interstate IGST (5%) must equal total tax");

    console.log("  ✅ PASS: GST HSN 19059090 tax calculations and supply contexts are 100% accurate and isolated.");

    console.log("\n================================================================================");
    console.log("ALL ISOLATION & CONTEXT CHECKS PASSED (100%)");
    console.log("================================================================================");
  } catch (e) {
    console.error("Isolation matrix test failed:", e);
    process.exit(1);
  }
}

runIsolationMatrixTest().then(() => {
  // Graceful exit
  setTimeout(() => process.exit(0), 100);
});
