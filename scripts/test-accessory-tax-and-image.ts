import { ApiEngine } from "../frontend/src/lib/api-engine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runAccessoryTaxAndImageSuite() {
  console.log("==================================================================");
  console.log("🕯️ CAKETOHOME — ACCESSORY TAX ENGINE & IMAGE INTEGRATION AUDIT");
  console.log("==================================================================\n");

  const timestamp = Date.now().toString().slice(-6);

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1 & 2: ACCESSORY TAX ENGINE INTEGRATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- PHASE 1 & 2: ACCESSORY TAX ENGINE & HSN RESOLUTION ---");

  // Create Accessory with 18% GST (Candles HSN 34060010)
  const candleAcc = ApiEngine.createAccessory({
    name: `Sparkler Candle Set ${timestamp}`,
    sku: `ACC-CND-${timestamp}`,
    category_id: "cat_acc_candles",
    price: 118, // ₹118 tax inclusive -> ₹100 taxable + ₹18 GST (₹9 CGST + ₹9 SGST)
    cost_price: 30,
    mrp: 149,
    stock: 100,
    tax_category_id: "cat_tax_candles",
    hsn_code: "34060010",
    gst_rate_pct: 18,
    tax_treatment: "inclusive",
    thumbnail: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaACdLoAA3AA/v38gAA=",
  });

  assert(candleAcc !== null && candleAcc.id !== undefined, "Accessory created with ID");
  assert(candleAcc.hsn_code === "34060010", "Accessory retains HSN code 34060010");
  assert(candleAcc.gst_rate_pct === 18 || candleAcc.gst_rate === 18, "Accessory retains 18% GST rate");

  // Create Accessory with 12% GST (Greeting Card HSN 49090090)
  const cardAcc = ApiEngine.createAccessory({
    name: `Personalized Greeting Card ${timestamp}`,
    sku: `ACC-CRD-${timestamp}`,
    category_id: "cat_acc_cards",
    price: 112, // ₹112 tax inclusive -> ₹100 taxable + ₹12 GST (₹6 CGST + ₹6 SGST)
    cost_price: 25,
    mrp: 149,
    stock: 50,
    tax_category_id: "cat_tax_cards",
    hsn_code: "49090090",
    gst_rate_pct: 12,
    tax_treatment: "inclusive",
    thumbnail: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaACdLoAA3AA/v38gAA=",
  });

  assert(cardAcc.hsn_code === "49090090", "Greeting card retains HSN code 49090090");
  assert(cardAcc.gst_rate_pct === 12 || cardAcc.gst_rate === 12, "Greeting card retains 12% GST rate");

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 4 & 5: CHECKOUT TAX ENGINE & IMMUTABLE TAX SNAPSHOT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- PHASE 4 & 5: CHECKOUT INTEGRATION & TAX SNAPSHOT ---");

  const cartId = `cart_tax_acc_${timestamp}`;
  ApiEngine.createCart({ id: cartId });
  ApiEngine.addToCart(cartId, {
    productId: candleAcc.id,
    quantity: 1,
    price: 118,
  });

  // Validate Checkout for Intra-State (Karnataka 560038)
  const validation = ApiEngine.validateCheckout({
    cart_id: cartId,
    pincode: "560038",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_01",
  });

  assert(validation.valid === true, "Cart checkout validation succeeded");
  assert(validation.cart.items[0].taxable_value === 100, "Taxable value for ₹118 @ 18% GST is ₹100");
  assert(validation.cart.items[0].tax_amount === 18, "Total GST for ₹118 @ 18% GST is ₹18");
  assert(validation.cart.items[0].cgst === 9, "CGST (Intra-State) is ₹9");
  assert(validation.cart.items[0].sgst === 9, "SGST (Intra-State) is ₹9");
  assert(validation.cart.items[0].igst === 0, "IGST (Intra-State) is ₹0");

  // Place Order
  const orderRes = ApiEngine.confirmCheckout({
    cart_id: cartId,
    customer_id: "cus_tax_test",
    address: { first_name: "Tax", last_name: "Test", phone: "+91 98765 00000", line1: "100ft Rd", city: "Bengaluru", state: "Karnataka" },
    pincode: "560038",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_01",
    payment_method: "test_mode",
  });

  assert(orderRes.success === true, "Order placed successfully");
  const orderId = orderRes.order_id || orderRes.order?.id;
  const initialTaxSnapshot = orderRes.order?.tax_snapshot || orderRes.tax_snapshot;

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 5: IMMUTABILITY RULE — EDITING ACCESSORY TAX DOES NOT MUTATE PAST ORDER
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- PHASE 5: HISTORICAL TAX SNAPSHOT IMMUTABILITY ---");

  // Modify accessory tax rate from 18% to 28%
  ApiEngine.updateAccessory(candleAcc.id, {
    gst_rate_pct: 28,
    gst_rate: 28,
    hsn_code: "34060010",
  });

  const updatedAcc = ApiEngine.getAccessoryById(candleAcc.id);
  assert(updatedAcc.gst_rate_pct === 28, "Accessory updated to 28% GST for future orders");

  // Retrieve past order details
  const retrievedOrder = ApiEngine.getOrderDetails(orderId);
  assert(retrievedOrder !== null, "Past order retrieved from database");
  assert(retrievedOrder.items?.[0]?.gst_rate_pct === 18 || retrievedOrder.items?.[0]?.tax_amount === 18 || retrievedOrder.tax_snapshot?.total_tax === 18, "Historical order tax snapshot remains 18% (Immutable)");

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 7, 8, 9 & 11: IMAGE UPLOADER & COMPRESSION SIMULATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- PHASE 7, 8, 9: IMAGE COMPRESSION & ACCESSORY LIFECYCLE ---");

  // Edit accessory image thumbnail
  const webpImageData = "data:image/webp;base64,UklGRlYAAABXRUJQVlA4WAoAAAAgAAAAAQAAAT8CAQUAAAAAAB0AAMsAAAEAAAAAAAAA";
  const updatedWithImage = ApiEngine.updateAccessory(candleAcc.id, {
    thumbnail: webpImageData,
    images: [webpImageData],
  });

  assert(updatedWithImage.thumbnail === webpImageData, "Accessory thumbnail updated with WebP image data");

  // Delete test accessory
  const deleted = ApiEngine.deleteAccessory(candleAcc.id);
  assert(deleted === true, "Test accessory deleted successfully");

  console.log("\n==================================================================");
  console.log("🎉 ALL ACCESSORY TAX ENGINE & IMAGE AUDIT TESTS PASSED!");
  console.log("==================================================================\n");
}

runAccessoryTaxAndImageSuite().catch((err) => {
  console.error("❌ ACCESSORY TAX SUITE FAILED:", err);
  process.exit(1);
});
