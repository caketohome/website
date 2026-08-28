/**
 * CakeToHome — Multi-Product Cart Integrity & Anti-Contamination E2E Test Suite
 * Validates:
 * 1. Clean cart initialization (empty cart)
 * 2. Adding Black Forest Gateau Special (0.5 kg) -> Exactly ₹467, 1 item
 * 3. Adding Classic Red Velvet Cream Cheese Cake (1 kg) -> Exactly ₹749, 2 items, Subtotal ₹1216
 * 4. Adding Belgian Chocolate Truffle Cake (1.5 kg) -> Exactly ₹941, 3 items, Subtotal ₹2157
 * 5. Adding Butterscotch Caramel Crunch Cake (2 kg) -> Exactly ₹1108, 4 items, Subtotal ₹3265
 * 6. Line item quantity increment (0.5kg + 0.5kg) vs distinct weight line creation (0.5kg vs 1kg)
 * 7. Invariant assertion: Zero occurrences of 'Celebration Cake', zero occurrences of ₹0
 * 8. Invariant assertion: Rejection of invalid products and invalid prices
 * 9. ValidateCheckout calculation integrity across multi-product basket
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";
import { parseAndNormalizeWeight } from "../frontend/src/lib/util/weight-matrix";

let passedCount = 0;
let failedCount = 0;

function pass(name: string) {
  passedCount++;
  console.log(`  ✓ [PASS] ${name}`);
}

function fail(name: string, details?: any) {
  failedCount++;
  console.error(`  ✗ [FAIL] ${name}`, details !== undefined ? details : "");
}

async function runMultiProductCartIntegrityTestSuite() {
  console.log("================================================================================");
  console.log("🚀 STARTING CAKETOHOME MULTI-PRODUCT CART DATA-INTEGRITY E2E TEST SUITE");
  console.log("================================================================================\n");

  const testCartId = `cart_test_integrity_${Date.now()}`;

  // ── [TEST GROUP 1] Clean Cart Initialization ──
  console.log("[TEST GROUP 1] Clean Cart Initialization");
  const initCart = ApiEngine.getCart(testCartId);
  if (initCart && Array.isArray(initCart.items) && initCart.items.length === 0 && initCart.subtotal === 0) {
    pass("Cart initialized with 0 items and ₹0 subtotal");
  } else {
    fail("Cart initialization failed", initCart);
  }

  // ── [TEST GROUP 2] Add Black Forest Gateau Special (0.5 kg) ──
  console.log("\n[TEST GROUP 2] Add 'Black Forest Gateau Special' (0.5 kg / 500g)");
  const cartAfterBlackForest = ApiEngine.addToCart(testCartId, {
    productId: "black-forest-gateau",
    weight: "0.5 kg",
    quantity: 1,
  });

  if (cartAfterBlackForest.items.length === 1) {
    pass("Cart item count is exactly 1");
  } else {
    fail(`Expected 1 item, got ${cartAfterBlackForest.items.length}`);
  }

  const item1 = cartAfterBlackForest.items[0];
  if (item1.title === "Black Forest Gateau Special") {
    pass(`Item title is canonical: "${item1.title}"`);
  } else {
    fail(`Expected 'Black Forest Gateau Special', got '${item1.title}'`);
  }

  if (item1.product_id === "prod_4") {
    pass(`Item product_id is canonical: '${item1.product_id}'`);
  } else {
    fail(`Expected 'prod_4', got '${item1.product_id}'`);
  }

  if (item1.unit_price === 467 && item1.total_price === 467) {
    pass(`Item price is exact canonical 0.5kg variant rate: ₹${item1.unit_price}`);
  } else {
    fail(`Expected ₹467, got unit_price: ${item1.unit_price}, total_price: ${item1.total_price}`);
  }

  if (cartAfterBlackForest.subtotal === 467) {
    pass(`Cart subtotal is exact: ₹${cartAfterBlackForest.subtotal}`);
  } else {
    fail(`Expected subtotal ₹467, got ₹${cartAfterBlackForest.subtotal}`);
  }

  // ── [TEST GROUP 3] Add Classic Red Velvet Cream Cheese Cake (1 kg) ──
  console.log("\n[TEST GROUP 3] Add 'Classic Red Velvet Cream Cheese Cake' (1 kg)");
  const cartAfterRedVelvet = ApiEngine.addToCart(testCartId, {
    productId: "prod_2",
    weight: "1 kg",
    quantity: 1,
  });

  if (cartAfterRedVelvet.items.length === 2) {
    pass("Cart item count is exactly 2");
  } else {
    fail(`Expected 2 items, got ${cartAfterRedVelvet.items.length}`);
  }

  const rvItem = cartAfterRedVelvet.items.find((i: any) => i.product_id === "prod_2");
  if (rvItem && rvItem.title === "Classic Red Velvet Cream Cheese Cake" && rvItem.unit_price === 749) {
    pass(`Red Velvet item canonical: "${rvItem.title}" @ ₹${rvItem.unit_price}`);
  } else {
    fail("Red Velvet item incorrect", rvItem);
  }

  const expectedSubtotal2 = 467 + 749; // 1216
  if (cartAfterRedVelvet.subtotal === expectedSubtotal2) {
    pass(`Cart subtotal updated accurately: ₹${cartAfterRedVelvet.subtotal} (₹467 + ₹749 = ₹1216)`);
  } else {
    fail(`Expected subtotal ₹${expectedSubtotal2}, got ₹${cartAfterRedVelvet.subtotal}`);
  }

  // ── [TEST GROUP 4] Add Belgian Chocolate Truffle Cake (1.5 kg) ──
  console.log("\n[TEST GROUP 4] Add 'Belgian Chocolate Truffle Cake' (1.5 kg)");
  const cartAfterTruffle = ApiEngine.addToCart(testCartId, {
    productId: "belgian-chocolate-truffle-cake",
    weight: "1.5 kg",
    quantity: 1,
  });

  if (cartAfterTruffle.items.length === 3) {
    pass("Cart item count is exactly 3");
  } else {
    fail(`Expected 3 items, got ${cartAfterTruffle.items.length}`);
  }

  const truffleItem = cartAfterTruffle.items.find((i: any) => i.product_id === "prod_1");
  if (truffleItem && truffleItem.title === "Belgian Chocolate Truffle Cake" && truffleItem.unit_price === 941) {
    pass(`Belgian Truffle 1.5kg item canonical: "${truffleItem.title}" @ ₹${truffleItem.unit_price}`);
  } else {
    fail("Belgian Truffle item incorrect", truffleItem);
  }

  const expectedSubtotal3 = 467 + 749 + 941; // 2157
  if (cartAfterTruffle.subtotal === expectedSubtotal3) {
    pass(`Cart subtotal updated accurately: ₹${cartAfterTruffle.subtotal} (₹1216 + ₹941 = ₹2157)`);
  } else {
    fail(`Expected subtotal ₹${expectedSubtotal3}, got ₹${cartAfterTruffle.subtotal}`);
  }

  // ── [TEST GROUP 5] Add Butterscotch Caramel Crunch Cake (2 kg) ──
  console.log("\n[TEST GROUP 5] Add 'Butterscotch Caramel Crunch Cake' (2 kg)");
  const cartAfterButterscotch = ApiEngine.addToCart(testCartId, {
    productId: "butterscotch-caramel-cake",
    weight: "2 kg",
    quantity: 1,
  });

  if (cartAfterButterscotch.items.length === 4) {
    pass("Cart item count is exactly 4");
  } else {
    fail(`Expected 4 items, got ${cartAfterButterscotch.items.length}`);
  }

  const bsItem = cartAfterButterscotch.items.find((i: any) => i.product_id === "prod_5");
  if (bsItem && bsItem.title === "Butterscotch Caramel Crunch Cake" && bsItem.unit_price === 1108) {
    pass(`Butterscotch 2kg item canonical: "${bsItem.title}" @ ₹${bsItem.unit_price}`);
  } else {
    fail("Butterscotch item incorrect", bsItem);
  }

  const expectedSubtotal4 = 2157 + 1108; // 3265
  if (cartAfterButterscotch.subtotal === expectedSubtotal4) {
    pass(`Cart subtotal updated accurately: ₹${cartAfterButterscotch.subtotal} (₹2157 + ₹1108 = ₹3265)`);
  } else {
    fail(`Expected subtotal ₹${expectedSubtotal4}, got ₹${cartAfterButterscotch.subtotal}`);
  }

  // ── [TEST GROUP 6] Quantity Increment vs New Variant Line ──
  console.log("\n[TEST GROUP 6] Quantity Increment vs Distinct Weight Variant Line Creation");
  // Add another 0.5kg of Black Forest Gateau (should increment quantity on existing line)
  const cartAfterBfQtyInc = ApiEngine.addToCart(testCartId, {
    productId: "prod_4",
    weight: "0.5 kg",
    quantity: 1,
  });

  if (cartAfterBfQtyInc.items.length === 4) {
    pass("Cart item count remains 4 (matching variant quantity incremented)");
  } else {
    fail(`Expected 4 items, got ${cartAfterBfQtyInc.items.length}`);
  }

  const bfLine = cartAfterBfQtyInc.items.find((i: any) => i.product_id === "prod_4" && i.weight === "0.5 kg");
  if (bfLine && bfLine.quantity === 2 && bfLine.total_price === 934) {
    pass(`Black Forest 0.5kg quantity is 2, total_price is ₹${bfLine.total_price} (2 × ₹467)`);
  } else {
    fail("Black Forest quantity increment failed", bfLine);
  }

  // Now add 1kg of Black Forest Gateau (should create a NEW distinct 5th line item)
  const cartAfterBf1kg = ApiEngine.addToCart(testCartId, {
    productId: "prod_4",
    weight: "1 kg",
    quantity: 1,
  });

  if (cartAfterBf1kg.items.length === 5) {
    pass("Cart item count is 5 (distinct 1kg variant created separate line)");
  } else {
    fail(`Expected 5 items, got ${cartAfterBf1kg.items.length}`);
  }

  const bf1kgLine = cartAfterBf1kg.items.find((i: any) => i.product_id === "prod_4" && i.weight === "1 kg");
  if (bf1kgLine && bf1kgLine.quantity === 1 && bf1kgLine.unit_price === 549) {
    pass(`Black Forest 1kg line created: 1x @ ₹${bf1kgLine.unit_price}`);
  } else {
    fail("Black Forest 1kg line failed", bf1kgLine);
  }

  const expectedSubtotal6 = 3265 + 467 + 549; // 4281
  if (cartAfterBf1kg.subtotal === expectedSubtotal6) {
    pass(`Cart total subtotal matches exactly: ₹${cartAfterBf1kg.subtotal}`);
  } else {
    fail(`Expected subtotal ₹${expectedSubtotal6}, got ₹${cartAfterBf1kg.subtotal}`);
  }

  // ── [TEST GROUP 7] Zero-Fallback & Anti-Contamination Invariants ──
  console.log("\n[TEST GROUP 7] Zero-Fallback & Anti-Contamination Invariants");
  let celebrationCakeFound = false;
  let zeroPriceFound = false;

  for (const it of cartAfterBf1kg.items) {
    if (it.title === "Celebration Cake" || it.name === "Celebration Cake") {
      celebrationCakeFound = true;
    }
    if (!it.unit_price || it.unit_price <= 0 || !it.total_price || it.total_price <= 0) {
      zeroPriceFound = true;
    }
  }

  if (!celebrationCakeFound) {
    pass("Zero occurrences of 'Celebration Cake' across entire multi-item cart");
  } else {
    fail("Found forbidden 'Celebration Cake' fallback in cart items");
  }

  if (!zeroPriceFound) {
    pass("Zero occurrences of ₹0 price across entire multi-item cart (all prices strictly > 0)");
  } else {
    fail("Found forbidden ₹0 price in cart items");
  }

  // Rejection of non-existent product
  let rejectedInvalidProduct = false;
  try {
    ApiEngine.addToCart(testCartId, {
      productId: "non_existent_fake_cake_9999",
      weight: "1 kg",
      quantity: 1,
    });
  } catch (err: any) {
    rejectedInvalidProduct = true;
  }

  if (rejectedInvalidProduct) {
    pass("Non-existent product ID strictly rejected with error");
  } else {
    fail("Non-existent product ID was NOT rejected");
  }

  // Rejection of zero price
  let rejectedZeroPrice = false;
  try {
    ApiEngine.addToCart(testCartId, {
      title: "Unknown Item",
      price: 0,
      quantity: 1,
    });
  } catch (err: any) {
    rejectedZeroPrice = true;
  }

  if (rejectedZeroPrice) {
    pass("Zero-price item addition strictly rejected with error");
  } else {
    fail("Zero-price item was NOT rejected");
  }

  // ── [TEST GROUP 8] ValidateCheckout Multi-Product Calculation ──
  console.log("\n[TEST GROUP 8] ValidateCheckout Multi-Product Calculation");
  const checkoutValidation = ApiEngine.validateCheckout({
    cart_id: testCartId,
    pincode: "560038",
    delivery_date: new Date().toISOString().slice(0, 10),
  });

  if (checkoutValidation && checkoutValidation.items && checkoutValidation.items.length === 5) {
    pass("Checkout validated all 5 line items successfully");
  } else {
    fail("Checkout validation failed items check", checkoutValidation);
  }

  if (checkoutValidation && checkoutValidation.subtotal === expectedSubtotal6) {
    pass(`Checkout subtotal strictly equals ₹${checkoutValidation.subtotal}`);
  } else {
    fail(`Expected checkout subtotal ₹${expectedSubtotal6}, got ${checkoutValidation?.subtotal}`);
  }

  console.log("\n================================================================================");
  console.log(`🏁 TEST SUITE COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runMultiProductCartIntegrityTestSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
