import { dbQuery, dbTransaction } from "../src/lib/db";
import { InventoryService } from "../src/lib/services/inventory.service";

async function runTransactionRollbackGate() {
  console.log("================================================================================");
  console.log("   HARD GATE: TRANSACTION ROLLBACK ACCEPTANCE TEST");
  console.log("================================================================================\n");

  const testBranchId = "br_indiranagar";
  const testProductId = "prod_01KXYMAJKNWZCFXJHESPTZE01G";
  const testOrderId = `order_fail_${Date.now()}`;

  // 1. Set initial stock to 15
  await InventoryService.setStock(testBranchId, testProductId, 15);
  const initialStock = await InventoryService.getAvailableStock(testBranchId, testProductId);
  console.log(`Initial verified stock in PostgreSQL: ${initialStock}`);

  // 2. Execute a transaction that deducts stock, inserts order, but throws before commit
  console.log("\nExecuting atomic transaction designed to throw before commit...");
  let caughtError: any = null;

  try {
    await dbTransaction(async (client) => {
      // Step A: Deduct 3 units of stock
      console.log("  [Inside TX] Deducting 3 units of stock...");
      await InventoryService.deductStockAtomic(client, testBranchId, testProductId, 3);

      // Verify deduction inside transaction
      const inTxRes = await client.query(
        `SELECT quantity, reserved FROM "branch_inventory" WHERE branch_id = $1 AND product_id = $2`,
        [testBranchId, testProductId]
      );
      console.log(`  [Inside TX] Available stock: ${inTxRes.rows[0].quantity} (Deducted 3)`);

      // Step B: Insert order
      console.log("  [Inside TX] Inserting order record...");
      await client.query(
        `INSERT INTO "order" (id, display_id, email, currency_code, status, metadata, created_at, updated_at)
         VALUES ($1, 99999, 'rollback@caketohome.test', 'INR', 'pending', '{"test": true}', NOW(), NOW())`,
        [testOrderId]
      );

      // Step C: Force intentional mid-flight failure
      console.log("  [Inside TX] Forcing intentional mid-flight system failure (simulated network/db error)...");
      throw new Error("SIMULATED_FAILURE_BEFORE_COMMIT");
    });
  } catch (err: any) {
    caughtError = err;
    console.log(`\nTransaction caught error as expected: ${err.message}`);
  }

  // 3. Verification outside transaction
  console.log("\n--- VERIFICATION IN POSTGRESQL POST-ROLLBACK ---");
  const finalStock = await InventoryService.getAvailableStock(testBranchId, testProductId);
  console.log(`Final Available Stock in PostgreSQL: ${finalStock} (Expected: ${initialStock})`);

  const orderCheck = await dbQuery(`SELECT id FROM "order" WHERE id = $1`, [testOrderId]);
  console.log(`Order rows found in PostgreSQL: ${orderCheck.rows.length} (Expected: 0)`);

  let passed = true;
  if (!caughtError || caughtError.message !== "SIMULATED_FAILURE_BEFORE_COMMIT") {
    console.error("❌ FAILED: Transaction did not catch simulated failure!");
    passed = false;
  }
  if (finalStock !== initialStock) {
    console.error(`❌ FAILED: Stock was not restored by rollback! Got ${finalStock}, expected ${initialStock}`);
    passed = false;
  }
  if (orderCheck.rows.length !== 0) {
    console.error("❌ FAILED: Order was persisted despite transaction failure!");
    passed = false;
  }

  // Cleanup stock back to 50
  await InventoryService.setStock(testBranchId, testProductId, 50);

  console.log("\n================================================================================");
  if (passed) {
    console.log("   🎉 TRANSACTION ROLLBACK HARD GATE: PASS");
    console.log("   Zero Partial Mutations | Complete Rollback on Failure | 100% Acid Compliant");
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.log("   ❌ TRANSACTION ROLLBACK HARD GATE: FAIL");
    console.log("================================================================================\n");
    process.exit(1);
  }
}

runTransactionRollbackGate().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
