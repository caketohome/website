import { dbQuery } from "../src/lib/db";
import { OrderService } from "../src/lib/services/order.service";
import { InventoryService } from "../src/lib/services/inventory.service";

async function runInventoryConcurrencyGate() {
  console.log("================================================================================");
  console.log("   HARD GATE: INVENTORY CONCURRENCY ACCEPTANCE TEST (10 CONCURRENT REQUESTS)");
  console.log("================================================================================\n");

  const testBranchId = "br_indiranagar";
  const testProductId = "prod_01KXYMAJKNWZCFXJHESPTZE01G"; // Classic Chocolate Truffle Cake

  // 1. Setup: Reset stock to exactly 1 in branch_inventory
  console.log(`Setting stock to 1 for product ${testProductId} at branch ${testBranchId}...`);
  await dbQuery(
    `UPDATE "branch_inventory"
     SET quantity = 1, reserved = 0, updated_at = NOW()
     WHERE branch_id = $1 AND product_id = $2`,
    [testBranchId, testProductId]
  );

  const initialStock = await InventoryService.getAvailableStock(testBranchId, testProductId);
  console.log(`Verified initial available stock: ${initialStock}`);
  if (initialStock !== 1) {
    throw new Error(`Failed to set initial stock to 1. Current stock: ${initialStock}`);
  }

  // 2. Launch 10 concurrent order requests for quantity 1
  console.log("\nLaunching 10 concurrent checkout requests simultaneously...");
  const orderPromises: Promise<any>[] = [];

  for (let i = 1; i <= 10; i++) {
    orderPromises.push(
      OrderService.createOrder({
        customer_name: `Concurrency Tester ${i}`,
        customer_email: `tester_${i}_${Date.now()}@concurrency-gate.test`,
        customer_phone: `987654321${i % 10}`,
        customer_uid: `cust_concurrency_${i}_${Date.now()}`,
        branch_id: testBranchId,
        items: [
          {
            product_id: testProductId,
            quantity: 1,
            weight: "1 kg",
          },
        ],
        delivery_type: "pickup",
        delivery_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        delivery_slot: "18:00 - 20:00",
        payment_method: "card",
      })
    );
  }

  const results = await Promise.all(orderPromises);

  // 3. Analyze results
  const successfulOrders = results.filter((r) => r.success === true);
  const failedOrders = results.filter((r) => r.success === false);
  const insufficientStockErrors = failedOrders.filter((r) =>
    r.error?.includes("INSUFFICIENT_STOCK")
  );

  console.log("\n--- CONCURRENCY TEST RESULTS ---");
  console.log(`Total Requests: ${results.length}`);
  console.log(`Successful Orders: ${successfulOrders.length}`);
  console.log(`Failed Orders: ${failedOrders.length}`);
  if (failedOrders.length > 0) {
    console.log(`Sample Failure Error: ${failedOrders[0].error}`);
  }
  console.log(`Insufficient Stock Errors: ${insufficientStockErrors.length}`);

  // 4. Verify stock in PostgreSQL
  const finalStock = await InventoryService.getAvailableStock(testBranchId, testProductId);
  console.log(`Final Available Stock in PostgreSQL: ${finalStock}`);

  // 5. Verification checks
  let passed = true;
  if (successfulOrders.length !== 1) {
    console.error(`❌ FAILED: Expected exactly 1 successful order, got ${successfulOrders.length}`);
    passed = false;
  }
  if (failedOrders.length !== 9) {
    console.error(`❌ FAILED: Expected exactly 9 failed orders, got ${failedOrders.length}`);
    passed = false;
  }
  if (insufficientStockErrors.length !== 9) {
    console.error(`❌ FAILED: Expected 9 INSUFFICIENT_STOCK errors, got ${insufficientStockErrors.length}`);
    passed = false;
  }
  if (finalStock !== 0) {
    console.error(`❌ FAILED: Expected final stock = 0, got ${finalStock}`);
    passed = false;
  }

  // 6. Verify created order in PostgreSQL directly
  if (successfulOrders.length === 1) {
    const createdOrderId = successfulOrders[0].order.id;
    const dbCheck = await dbQuery(`SELECT id, status, metadata FROM "order" WHERE id = $1`, [createdOrderId]);
    if (dbCheck.rows.length === 1) {
      const ordTotal = dbCheck.rows[0].metadata?.total_amount || dbCheck.rows[0].metadata?.subtotal;
      console.log(`✅ Order ${createdOrderId} verified directly in PostgreSQL: Status=${dbCheck.rows[0].status}, Total=₹${ordTotal}`);
    } else {
      console.error(`❌ FAILED: Order ${createdOrderId} was not found in PostgreSQL!`);
      passed = false;
    }

    // Verify order_status_history
    const historyCheck = await dbQuery(`SELECT * FROM "order_status_history" WHERE order_id = $1`, [createdOrderId]);
    console.log(`✅ Order status history rows in PostgreSQL: ${historyCheck.rows.length}`);
    if (historyCheck.rows.length === 0) {
      console.error(`❌ FAILED: Zero order_status_history rows found!`);
      passed = false;
    }
  }

  // 7. Cleanup test stock back to 50
  await dbQuery(
    `UPDATE "branch_inventory" SET quantity = 50, reserved = 0 WHERE branch_id = $1 AND product_id = $2`,
    [testBranchId, testProductId]
  );

  console.log("\n================================================================================");
  if (passed) {
    console.log("   🎉 INVENTORY CONCURRENCY HARD GATE: PASS");
    console.log("   Zero Overselling | Row Lock / Atomic UPDATE Integrity | 100% Durable");
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.log("   ❌ INVENTORY CONCURRENCY HARD GATE: FAIL");
    console.log("================================================================================\n");
    process.exit(1);
  }
}

runInventoryConcurrencyGate().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
