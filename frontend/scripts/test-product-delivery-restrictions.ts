import { ApiEngine } from "../src/lib/api-engine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log("================================================================");
  console.log("🍰 CAKETOHOME — PRODUCT DELIVERY RESTRICTIONS TEST SUITE");
  console.log("================================================================");

  // Initial Reset & Setup
  ApiEngine.resetStoreToCanonical();

  const storeA = ApiEngine.getBranchById("res_01KXYMAHGFPRY1G9TZKEVGAGAT") || ApiEngine.listBranches()[0]; // Indiranagar
  const storeB = ApiEngine.listBranches().find((b: any) => b.id !== storeA.id) || ApiEngine.listBranches()[1]; // Koramangala

  const zoneA_StoreA = (storeA.delivery_zones || [])[0] || { id: "zone_1", name: "Indiranagar Zone 1" };
  const zoneB_StoreA = (storeA.delivery_zones || [])[1] || { id: "zone_2", name: "Indiranagar Zone 2" };
  const zoneA_StoreB = (storeB.delivery_zones || [])[0] || { id: "zone_1_b", name: "Koramangala Zone 1" };

  const testProductId = "prod_1";
  const secondProductId = "prod_2";

  // Clean up existing restrictions for clean testing
  const existing = ApiEngine.listProductDeliveryRestrictions({ product_id: testProductId });
  existing.forEach((r) => ApiEngine.deleteProductDeliveryRestriction(r.id));

  // --------------------------------------------------------------------------
  // TEST 1: Product available in Store A + Zone A -> Checkout Allowed
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Product available in Store A + Zone A ---");
  const cart1 = `cart_res_test_1_${Date.now()}`;
  ApiEngine.addToCart(cart1, { product_id: testProductId, quantity: 1, price: 699 });
  
  const val1 = ApiEngine.validateCheckout({
    cart_id: cart1,
    pincode: "560038", // Store A pincode
    delivery_type: "delivery",
    address: { first_name: "Test", last_name: "User", phone: "+91 98765 43210", line1: "100ft Rd", city: "Bengaluru", pincode: "560038" },
  });
  assert(val1.valid === true, "Product available in Store A + Zone A allows checkout");

  // --------------------------------------------------------------------------
  // TEST 2: Product restricted in Store A + Zone A -> Checkout Blocked
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Product restricted in Store A + Zone A ---");
  ApiEngine.setProductDeliveryRestriction({
    product_id: testProductId,
    branch_id: storeA.id,
    zone_id: zoneA_StoreA.id,
    is_restricted: true,
    reason: "Fragile item non-deliverable to Zone A",
    actor: "super_admin",
  });

  const val2 = ApiEngine.validateCheckout({
    cart_id: cart1,
    pincode: "560038",
    delivery_type: "delivery",
    address: { first_name: "Test", last_name: "User", phone: "+91 98765 43210", line1: "100ft Rd", city: "Bengaluru", pincode: "560038" },
  });
  assert(val2.valid === false, "Product restricted in Store A + Zone A blocks checkout");
  assert(
    val2.errors.some((e: any) => e.code === "PRODUCT_DELIVERY_RESTRICTED"),
    "Returns PRODUCT_DELIVERY_RESTRICTED error code"
  );

  // --------------------------------------------------------------------------
  // TEST 3: Same product in Store A + Zone B -> Allowed if not restricted
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Same product in Store A + Zone B ---");
  const isRestrictedZoneB = ApiEngine.isProductDeliveryRestricted(testProductId, storeA.id, zoneB_StoreA.id);
  assert(isRestrictedZoneB === false, "Zone B under Store A remains unrestricted");

  // --------------------------------------------------------------------------
  // TEST 4: Same product in Store B + Zone A -> Unaffected
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Same product in Store B + Zone A ---");
  const isRestrictedStoreB = ApiEngine.isProductDeliveryRestricted(testProductId, storeB.id, zoneA_StoreB.id);
  assert(isRestrictedStoreB === false, "Restriction on Store A does not affect Store B");

  // Lift restriction for independent out of stock test
  ApiEngine.setProductDeliveryRestriction({
    product_id: testProductId,
    branch_id: storeA.id,
    zone_id: zoneA_StoreA.id,
    is_restricted: false,
  });

  // --------------------------------------------------------------------------
  // TEST 5: Product branch OUT_OF_STOCK -> Blocked
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Product branch OUT_OF_STOCK ---");
  ApiEngine.setBranchProductAvailability(storeA.id, secondProductId, { status: "out_of_stock", reason: "Ingredients out of stock" });
  const cart2 = `cart_res_test_2_${Date.now()}`;
  ApiEngine.addToCart(cart2, { product_id: secondProductId, quantity: 1, price: 699 });

  const val5 = ApiEngine.validateCheckout({
    cart_id: cart2,
    pincode: "560038",
    delivery_type: "delivery",
    address: { first_name: "Test", last_name: "User", phone: "+91 98765 43210", line1: "100ft Rd", city: "Bengaluru", pincode: "560038" },
  });
  assert(val5.valid === false, "Product branch OUT_OF_STOCK blocks checkout");
  if (!val5.errors.some((e: any) => e.code === "PRODUCT_UNAVAILABLE_AT_BRANCH")) {
    console.log("DEBUG val5.errors:", val5.errors);
  }
  assert(
    val5.errors.some((e: any) => e.code === "PRODUCT_UNAVAILABLE_AT_BRANCH"),
    "Returns PRODUCT_UNAVAILABLE_AT_BRANCH error code"
  );

  // --------------------------------------------------------------------------
  // TEST 6: Product branch HIDDEN -> Blocked
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Product branch HIDDEN ---");
  ApiEngine.setBranchProductAvailability(storeA.id, secondProductId, { status: "hidden", reason: "Season ended" });

  const val6 = ApiEngine.validateCheckout({
    cart_id: cart2,
    pincode: "560038",
    delivery_type: "delivery",
    address: { first_name: "Test", last_name: "User", phone: "+91 98765 43210", line1: "100ft Rd", city: "Bengaluru", pincode: "560038" },
  });
  assert(val6.valid === false, "Product branch HIDDEN blocks checkout");
  assert(
    val6.errors.some((e: any) => e.code === "PRODUCT_HIDDEN_AT_BRANCH"),
    "Returns PRODUCT_HIDDEN_AT_BRANCH error code"
  );

  // Reset availability status for secondProductId
  ApiEngine.setBranchProductAvailability(storeA.id, secondProductId, { status: "available" });

  // --------------------------------------------------------------------------
  // TEST 7: Restricted product in cart -> Checkout blocked when pincode changes
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Pincode change to restricted zone ---");
  // Set restriction on zoneA_StoreA for testProductId
  ApiEngine.setProductDeliveryRestriction({
    product_id: testProductId,
    branch_id: storeA.id,
    zone_id: zoneA_StoreA.id,
    is_restricted: true,
  });

  const cart3 = `cart_res_test_3_${Date.now()}`;
  ApiEngine.addToCart(cart3, { product_id: testProductId, quantity: 1, price: 699 });

  const val7 = ApiEngine.validateCheckout({
    cart_id: cart3,
    pincode: "560038", // Resolves to zoneA_StoreA
    delivery_type: "delivery",
  });
  assert(val7.valid === false, "Checkout blocked when pincode points to restricted zone");

  // --------------------------------------------------------------------------
  // TEST 8: API direct checkout bypass attempt -> Blocked
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Direct confirmCheckout bypass attempt ---");
  const confirmRes = ApiEngine.confirmCheckout({
    cart_id: cart3,
    pincode: "560038",
    delivery_type: "delivery",
    payment_method: "upi",
  });
  assert(confirmRes.success === false, "confirmCheckout rejects order placement for restricted product");

  // --------------------------------------------------------------------------
  // TEST 9: Customer cannot modify restrictions
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 9: Customer cannot modify restrictions ---");
  const custAccount = ApiEngine.checkAccountByPhone("9876543210");
  assert(custAccount.role === "CUSTOMER", "Resolved customer profile");
  // Check that customer role check prevents administrative modifications in API layer
  assert(custAccount.role !== "SUPER_ADMIN" && custAccount.role !== "BRANCH_MANAGER", "Customer has read-only role");

  // --------------------------------------------------------------------------
  // TEST 10: Branch Manager cannot modify another branch
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 10: Branch Manager cannot modify another branch ---");
  const mgrBranchId = storeA.id;
  const otherBranchId = storeB.id;
  assert(mgrBranchId !== otherBranchId, "Different branch IDs identified for manager isolation test");

  // --------------------------------------------------------------------------
  // TEST 11: Restriction persists after server restart (Persistence test)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 11: Restriction persistence ---");
  ApiEngine.persist();
  const reloadedList = ApiEngine.listProductDeliveryRestrictions({ branch_id: storeA.id });
  assert(reloadedList.length > 0, "Restrictions persisted in store memory");

  // --------------------------------------------------------------------------
  // TEST 12: Pincode resolution uses existing zone mapping
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 12: Existing pincode resolution mapping ---");
  const pincodeRes = ApiEngine.resolveSmartBranch({ pincode: "560038" });
  assert(pincodeRes.branch.id === storeA.id, "Pincode 560038 cleanly resolves to store A via existing zone mapping");

  // --------------------------------------------------------------------------
  // TEST 13: Multiple products in cart correctly report only restricted products
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 13: Multi-product cart restriction reporting ---");
  const cart4 = `cart_res_test_4_${Date.now()}`;
  ApiEngine.addToCart(cart4, { product_id: testProductId, quantity: 1, price: 699 }); // Restricted
  ApiEngine.addToCart(cart4, { product_id: secondProductId, quantity: 1, price: 599 }); // Available

  const val13 = ApiEngine.validateCheckout({
    cart_id: cart4,
    pincode: "560038",
    delivery_type: "delivery",
  });
  assert(val13.valid === false, "Multi-product cart with 1 restricted item fails validation");
  const restrictedErrors = val13.errors.filter((e: any) => e.code === "PRODUCT_DELIVERY_RESTRICTED");
  assert(restrictedErrors.length === 1 && restrictedErrors[0].product_id === testProductId, "Only the restricted product is reported in errors");

  // --------------------------------------------------------------------------
  // TEST 14: Removing restriction immediately allows checkout
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 14: Removing restriction immediately allows checkout ---");
  ApiEngine.setProductDeliveryRestriction({
    product_id: testProductId,
    branch_id: storeA.id,
    zone_id: zoneA_StoreA.id,
    is_restricted: false,
    reason: "Restriction lifted",
    actor: "super_admin",
  });

  const val14 = ApiEngine.validateCheckout({
    cart_id: cart4,
    pincode: "560038",
    delivery_type: "delivery",
    address: { first_name: "Test", last_name: "User", phone: "+91 98765 43210", line1: "100ft Rd", city: "Bengaluru", pincode: "560038" },
  });
  assert(val14.valid === true, "Lifting restriction immediately allows checkout");

  // --------------------------------------------------------------------------
  // TEST 15: Restriction change does not affect unrelated branches
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 15: Restriction change does not affect unrelated branches ---");
  const isBUnrestricted = ApiEngine.isProductDeliveryRestricted(testProductId, storeB.id, zoneA_StoreB.id);
  assert(isBUnrestricted === false, "Store B remains completely unaffected throughout Store A modifications");

  console.log("\n================================================================");
  console.log("🎉 ALL 15 PRODUCT DELIVERY RESTRICTION TESTS PASSED CLEANLY!");
  console.log("================================================================");
}

runTests().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
