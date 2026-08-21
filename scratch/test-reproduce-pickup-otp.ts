import { ApiEngine } from "../frontend/src/lib/api-engine";
import { OrderLifecycleService } from "../frontend/src/lib/order-lifecycle-service";
import { verifyPickupOtp } from "../frontend/src/lib/actions/deliveries";

async function reproduce() {
  console.log("=== Reproducing Pickup OTP Verification ===");
  ApiEngine.ensureOrdersStore();
  ApiEngine.ensureDeliveryPartnersStore();
  const store = ApiEngine.getStore();

  // Create or find an order in PACKED state
  let testOrder = store.orders.find((o: any) => o.id === "ord_pickup_test_01");
  if (!testOrder) {
    testOrder = {
      id: "ord_pickup_test_01",
      order_number: "CTH-TEST-9901",
      status: "packed",
      delivery_status: "ready_for_pickup",
      payment_status: "captured",
      branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      pickup_otp: "1294",
      delivery_otp: "4819",
      delivery_partner_id: "dlp_01",
      items: [{ id: "item_1", title: "Chocolate Truffle Cake", quantity: 1, unit_price: 650 }],
    };
    store.orders.push(testOrder);
  } else {
    testOrder.status = "packed";
    testOrder.delivery_status = "ready_for_pickup";
    testOrder.pickup_otp = "1294";
    testOrder.delivery_partner_id = "dlp_01";
    delete testOrder.pickup_verified_at;
  }

  console.log("Initial order state:", {
    id: testOrder.id,
    status: testOrder.status,
    delivery_status: testOrder.delivery_status,
    pickup_otp: testOrder.pickup_otp,
    delivery_partner_id: testOrder.delivery_partner_id
  });

  // Call verifyPickupOtp via Server Action
  console.log("\nCalling verifyPickupOtp('ord_pickup_test_01', '1294', 'dlp_01')...");
  try {
    const res = await verifyPickupOtp("ord_pickup_test_01", "1294", "dlp_01");
    console.log("Result of verifyPickupOtp:", res);
  } catch (err) {
    console.error("Error thrown during verifyPickupOtp:", err);
  }

  const updatedOrder = store.orders.find((o: any) => o.id === "ord_pickup_test_01");
  console.log("\nUpdated order state:", {
    id: updatedOrder.id,
    status: updatedOrder.status,
    delivery_status: updatedOrder.delivery_status,
    pickup_verified_at: updatedOrder.pickup_verified_at
  });
}

reproduce();
