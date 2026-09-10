import { dbQuery } from "../src/lib/db";
import { OrderService } from "../src/lib/services/order.service";
import { InventoryService } from "../src/lib/services/inventory.service";

async function runIdempotencyGate() {
  console.log("================================================================================");
  console.log("   HARD GATE: ORDER IDEMPOTENCY ACCEPTANCE TEST");
  console.log("================================================================================\n");

  const testBranchId = "br_indiranagar";
  const testProductId = "prod_01KXYMAJKNWZCFXJHESPTZE01G";
  const idempotencyKey = `idemp_gate_${Date.now()}`;

  // Ensure stock is available
  await InventoryService.setStock(testBranchId, testProductId, 10);
  const stockBefore = await InventoryService.getAvailableStock(testBranchId, testProductId);
  console.log(`Available stock before test: ${stockBefore}`);

  // 1. Initial Order submission
  console.log(`Submitting initial order with Idempotency-Key: ${idempotencyKey}...`);
  const firstRes = await OrderService.createOrder({
    idempotency_key: idempotencyKey,
    customer_name: "Idempotency Tester",
    customer_email: "idempotency@caketohome.test",
    customer_phone: "9876543210",
    customer_uid: "cust_idemp_user",
    branch_id: testBranchId,
    items: [{ product_id: testProductId, quantity: 2, weight: "1 kg" }],
    delivery_type: "pickup",
    delivery_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    delivery_slot: "18:00 - 20:00",
    payment_method: "upi",
  });

  if (!firstRes.success || !firstRes.order) {
    throw new Error(`Initial order failed: ${firstRes.error}`);
  }

  const firstOrderId = firstRes.order.id;
  console.log(`✅ First order created: ID=${firstOrderId}`);

  const stockAfterFirst = await InventoryService.getAvailableStock(testBranchId, testProductId);
  console.log(`Stock after first order: ${stockAfterFirst} (Expected: ${stockBefore - 2})`);

  // 2. Retry with the SAME Idempotency-Key
  console.log(`Retrying order with SAME Idempotency-Key: ${idempotencyKey}...`);
  const retryRes = await OrderService.createOrder({
    idempotency_key: idempotencyKey,
    customer_name: "Idempotency Tester",
    customer_email: "idempotency@caketohome.test",
    customer_phone: "9876543210",
    customer_uid: "cust_idemp_user",
    branch_id: testBranchId,
    items: [{ product_id: testProductId, quantity: 2, weight: "1 kg" }],
    delivery_type: "pickup",
    delivery_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    delivery_slot: "18:00 - 20:00",
    payment_method: "upi",
  });

  if (!retryRes.success || !retryRes.order) {
    throw new Error(`Retry failed: ${retryRes.error}`);
  }

  const retryOrderId = retryRes.order.id;
  console.log(`Retry order response ID: ${retryOrderId}`);

  const stockAfterRetry = await InventoryService.getAvailableStock(testBranchId, testProductId);
  console.log(`Stock after retry: ${stockAfterRetry} (Must be identical: ${stockAfterFirst})`);

  // 3. Query PostgreSQL directly to ensure only 1 order exists
  const dbCount = await dbQuery(
    `SELECT COUNT(*)::int as count FROM "order" WHERE metadata->>'idempotency_key' = $1 AND deleted_at IS NULL`,
    [idempotencyKey]
  );
  const totalOrdersInDb = dbCount.rows[0].count;
  console.log(`Total orders in PostgreSQL with this idempotency key: ${totalOrdersInDb}`);

  let passed = true;
  if (firstOrderId !== retryOrderId) {
    console.error(`❌ FAILED: Retry produced a different order ID (${retryOrderId} vs ${firstOrderId})`);
    passed = false;
  }
  if (stockAfterRetry !== stockAfterFirst) {
    console.error(`❌ FAILED: Retry deducted inventory a second time! (${stockAfterRetry} vs ${stockAfterFirst})`);
    passed = false;
  }
  if (totalOrdersInDb !== 1) {
    console.error(`❌ FAILED: Found ${totalOrdersInDb} orders in PostgreSQL for same idempotency key!`);
    passed = false;
  }

  // Cleanup stock
  await InventoryService.setStock(testBranchId, testProductId, 50);

  console.log("\n================================================================================");
  if (passed) {
    console.log("   🎉 ORDER IDEMPOTENCY HARD GATE: PASS");
    console.log("   Zero Duplicate Orders | Zero Duplicate Inventory Deductions | 100% Consistent");
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.log("   ❌ ORDER IDEMPOTENCY HARD GATE: FAIL");
    console.log("================================================================================\n");
    process.exit(1);
  }
}

runIdempotencyGate().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
