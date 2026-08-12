import { ApiEngine } from "../src/lib/api-engine";
import assert from "node:assert";

async function runProductStoreAvailabilityMatrixTests() {
  console.log("\n=======================================================");
  console.log("CakeToHome — Product Store Availability Matrix Tests");
  console.log("=======================================================\n");

  const branches = ApiEngine.listBranches();
  const branchA = branches[0]; // e.g. Indiranagar / HUB-BLR-01 (serves 560038)
  const branchB = branches[2] || branches[1]; // e.g. Whitefield / HUB-BLR-03 (serves 560066)
  const branchC = branches[1]; // e.g. Koramangala / HUB-BLR-02 (serves 560034)

  const pinA = Array.isArray(branchA.delivery_zones?.[0]?.pincodes) ? branchA.delivery_zones[0].pincodes[0] : (branchA.pincode || "560038");
  const pinB = Array.isArray(branchB.delivery_zones?.[0]?.pincodes) ? branchB.delivery_zones[0].pincodes[0] : (branchB.pincode || "560066");
  const pinC = Array.isArray(branchC.delivery_zones?.[0]?.pincodes) ? branchC.delivery_zones[0].pincodes[0] : (branchC.pincode || "560034");

  const targetProduct = ApiEngine.getAdminProducts()[0];
  const targetProdId = targetProduct.id || targetProduct.product_id;
  const originalPrice = targetProduct.price;

  console.log(`[SETUP] Target Product: ${targetProduct.title} (ID: ${targetProdId})`);
  console.log(`[SETUP] Store A: ${branchA.name} (ID: ${branchA.id}, Pincode: ${pinA})`);
  console.log(`[SETUP] Store B: ${branchB.name} (ID: ${branchB.id}, Pincode: ${pinB})`);
  console.log(`[SETUP] Store C: ${branchC.name} (ID: ${branchC.id}, Pincode: ${pinC})\n`);

  // 1. Initial State: Set Store A -> AVAILABLE, Store B -> OUT_OF_STOCK, Store C -> HIDDEN
  console.log("Test 1: Configure Store Availability Matrix...");
  ApiEngine.updateBranchProductAvailability(branchA.id, targetProdId, { status: "AVAILABLE" });
  ApiEngine.updateBranchProductAvailability(branchB.id, targetProdId, { status: "OUT_OF_STOCK", reason: "Kitchen sold out for today" });
  ApiEngine.updateBranchProductAvailability(branchC.id, targetProdId, { status: "HIDDEN", reason: "Not offered at this hub" });

  const bA_record = ApiEngine.resolveBranchRecord(branchA.id);
  const bB_record = ApiEngine.resolveBranchRecord(branchB.id);
  const bC_record = ApiEngine.resolveBranchRecord(branchC.id);

  assert.strictEqual(bA_record.product_availability?.[targetProdId]?.status, "AVAILABLE");
  assert.strictEqual(bB_record.product_availability?.[targetProdId]?.status, "OUT_OF_STOCK");
  assert.strictEqual(bC_record.product_availability?.[targetProdId]?.status, "HIDDEN");
  console.log("✅ Test 1 PASSED: Store-specific availability configured independently in branch records.\n");

  // 2. Zero Global Product Mutation
  console.log("Test 2: Assert Zero Global Catalog Mutation...");
  const adminProduct = ApiEngine.getAdminProducts().find((p: any) => p.id === targetProdId || p.product_id === targetProdId);
  assert.strictEqual(adminProduct.price, originalPrice, "Global product price must not be modified");
  assert.strictEqual(adminProduct.title, targetProduct.title, "Global product title must not be modified");
  console.log("✅ Test 2 PASSED: Global catalog record is completely untouched.\n");

  // 3. Multi-Store Isolation via Direct Branch ID
  console.log("Test 3: Storefront Query by Branch ID...");
  const prodsA = ApiEngine.getProducts(branchA.id);
  const pInA = prodsA.find((p: any) => p.id === targetProdId || p.product_id === targetProdId);
  assert.ok(pInA, "Product must be present in Store A");
  assert.strictEqual(pInA.branch_status, "AVAILABLE");
  assert.strictEqual(pInA.is_out_of_stock_at_branch, false);

  const prodsB = ApiEngine.getProducts(branchB.id);
  const pInB = prodsB.find((p: any) => p.id === targetProdId || p.product_id === targetProdId);
  assert.ok(pInB, "Product must be present in Store B list (to show Out of Stock badge)");
  assert.strictEqual(pInB.branch_status, "OUT_OF_STOCK");
  assert.strictEqual(pInB.is_out_of_stock_at_branch, true);

  const prodsC = ApiEngine.getProducts(branchC.id);
  const pInC = prodsC.find((p: any) => p.id === targetProdId || p.product_id === targetProdId);
  assert.strictEqual(pInC, undefined, "Product marked HIDDEN must NOT be present in Store C catalog");
  console.log("✅ Test 3 PASSED: Store A = AVAILABLE, Store B = OUT_OF_STOCK, Store C = HIDDEN.\n");

  // 4. Pincode Inheritance Verification
  console.log("Test 4: Pincode Serving Hub Inheritance...");
  // Query by Pincode A (served by Store A)
  const prodsPinA = ApiEngine.getProducts(undefined, pinA);
  const pInPinA = prodsPinA.find((p: any) => p.id === targetProdId || p.product_id === targetProdId);
  assert.ok(pInPinA, `Product must be available for Pincode ${pinA} (served by Store A)`);
  assert.strictEqual(pInPinA.branch_status, "AVAILABLE");

  // Query by Pincode B (served by Store B)
  const prodsPinB = ApiEngine.getProducts(undefined, pinB);
  const pInPinB = prodsPinB.find((p: any) => p.id === targetProdId || p.product_id === targetProdId);
  assert.ok(pInPinB, `Product must show as OUT_OF_STOCK for Pincode ${pinB} (served by Store B)`);
  assert.strictEqual(pInPinB.branch_status, "OUT_OF_STOCK");
  assert.strictEqual(pInPinB.is_out_of_stock_at_branch, true);

  // Query by Pincode C (served by Store C)
  const prodsPinC = ApiEngine.getProducts(undefined, pinC);
  const pInPinC = prodsPinC.find((p: any) => p.id === targetProdId || p.product_id === targetProdId);
  assert.strictEqual(pInPinC, undefined, `Product must be HIDDEN for Pincode ${pinC} (served by Store C)`);
  console.log("✅ Test 4 PASSED: All pincodes correctly inherit their serving store's product availability.\n");

  // 5. Product Detail By Slug / ID Pincode Resolution
  console.log("Test 5: Product Detail Availability Resolution...");
  const detailA = ApiEngine.getProductById(targetProdId, undefined, pinA);
  assert.strictEqual(detailA.branch_status, "AVAILABLE");
  assert.strictEqual(detailA.is_out_of_stock_at_branch, false);

  const detailB = ApiEngine.getProductById(targetProdId, undefined, pinB);
  assert.strictEqual(detailB.branch_status, "OUT_OF_STOCK");
  assert.strictEqual(detailB.is_out_of_stock_at_branch, true);
  console.log("✅ Test 5 PASSED: Product detail endpoints correctly resolve branch availability for customer location.\n");

  // 6. Add to Cart Validation
  console.log("Test 6: Add to Cart Backend Enforcement...");
  const cartIdA = `cart_test_${Date.now()}_A`;
  const cartIdB = `cart_test_${Date.now()}_B`;

  // Adding with Store A / Pincode A -> Succeeds
  const cartResA = ApiEngine.addToCart(cartIdA, { productId: targetProdId, quantity: 1, pincode: pinA });
  assert.ok(cartResA.items.length > 0, "Item successfully added to cart for Store A");

  // Adding with Store B / Pincode B -> Throws Error
  assert.throws(
    () => {
      ApiEngine.addToCart(cartIdB, { productId: targetProdId, quantity: 1, pincode: pinB });
    },
    (err: any) => {
      assert.ok(err.message.includes("out of stock or unavailable"));
      return true;
    },
    "Adding out-of-stock product to cart at Store B must throw an error"
  );
  console.log("✅ Test 6 PASSED: Add to Cart succeeds for Store A and is strictly blocked for Store B.\n");

  // 7. Order Placement & Checkout Validation
  console.log("Test 7: Checkout Order Placement Validation...");
  // Order placed for Store A pincode -> Succeeds
  const orderA = ApiEngine.createOrder({
    customer_name: "Test Customer A",
    customer_phone: "9000000001",
    pincode: pinA,
    subtotal: 649,
    items: [{ id: targetProdId, title: targetProduct.title, quantity: 1, price: 649 }],
  });
  assert.ok(orderA.id, "Order successfully created for Store A");

  // Order placed for Store B pincode -> Throws Error
  assert.throws(
    () => {
      ApiEngine.createOrder({
        customer_name: "Test Customer B",
        customer_phone: "9000000002",
        pincode: pinB,
        subtotal: 649,
        items: [{ id: targetProdId, title: targetProduct.title, quantity: 1, price: 649 }],
      });
    },
    (err: any) => {
      assert.ok(err.message.includes("not available for delivery"));
      return true;
    },
    "Placing order with out-of-stock item at Store B must be rejected"
  );
  console.log("✅ Test 7 PASSED: Order creation succeeds for Store A and is rejected for Store B.\n");

  // 8. Reversal & Reset Verification
  console.log("Test 8: Reversal & Reset Verification...");
  ApiEngine.updateBranchProductAvailability(branchB.id, targetProdId, { status: "AVAILABLE" });
  const resetDetailB = ApiEngine.getProductById(targetProdId, undefined, pinB);
  assert.strictEqual(resetDetailB.branch_status, "AVAILABLE");
  assert.strictEqual(resetDetailB.is_out_of_stock_at_branch, false);

  const resetCartResB = ApiEngine.addToCart(cartIdB, { productId: targetProdId, quantity: 1, pincode: pinB });
  assert.ok(resetCartResB.items.length > 0, "Item can now be added to cart after reset to AVAILABLE");
  console.log("✅ Test 8 PASSED: Resetting Store B to AVAILABLE restores purchasability for Store B pincodes.\n");

  console.log("=======================================================");
  console.log("🎉 ALL PRODUCT STORE AVAILABILITY TESTS PASSED (8/8)!");
  console.log("=======================================================\n");
}

runProductStoreAvailabilityMatrixTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
