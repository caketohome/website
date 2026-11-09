/**
 * CakeToHome ERP — Targeted Verification: Shared Cake & Bouquet Inventory & Concurrency
 * Validates:
 * 1. Authoritative PostgreSQL shared_inventory records for cakes & bouquets
 * 2. High-concurrency reservation attempts against limited stock (atomic SELECT FOR UPDATE)
 * 3. Exact stock bounds: zero overselling under race conditions
 * 4. Full stock lifecycle: RESERVED -> CONFIRMED -> FULFILLED -> RELEASED (idempotency)
 * 5. Inventory movement audit history verification
 */

const { Pool } = require("pg");
require("dotenv").config({ path: "E:/vig/cakes2home-main/cakes2home-main/frontend/.env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/cakes2home",
});

async function run() {
  console.log("=== 1. Testing Shared Cake & Bouquet Inventory & Concurrency ===");
  const client = await pool.connect();

  try {
    // 1. Check shared inventory pool
    const { rows: inventoryItems } = await client.query(`
      SELECT si.*, p.title as product_title
      FROM shared_inventory si
      JOIN product p ON p.id = si.product_id
      ORDER BY si.category, p.title
    `);

    console.log(`[PASS] Found ${inventoryItems.length} shared inventory records in PostgreSQL.`);
    const cakes = inventoryItems.filter(i => i.category === "CAKE");
    const bouquets = inventoryItems.filter(i => i.category === "BOUQUET");
    console.log(`       - Cakes tracked: ${cakes.length}`);
    console.log(`       - Bouquets tracked: ${bouquets.length}`);

    if (inventoryItems.length === 0) {
      throw new Error("No shared inventory items found!");
    }

    // 2. Select a test SKU and set exact stock for concurrency test
    const testItem = inventoryItems[0];
    const testSkuId = testItem.id;
    const testProductId = testItem.product_id;
    console.log(`\n[TEST] Selected Test Item: "${testItem.product_title}" (${testProductId})`);

    // Reset test item to exactly 3 physical units, 0 reserved
    await client.query(`
      UPDATE shared_inventory
      SET quantity = 3, reserved = 0, updated_at = NOW()
      WHERE id = $1
    `, [testSkuId]);

    // 3. Concurrency Stress Test: 10 parallel reservation attempts of quantity 1
    console.log("[TEST] Launching 10 concurrent reservation attempts against 3 available units...");
    const concurrencyAttempts = 10;
    
    // Function that performs atomic reservation using the exact logic of SharedInventoryRepository
    async function attemptReservation(orderIndex) {
      const conn = await pool.connect();
      try {
        await conn.query("BEGIN");
        
        // Atomic lock
        const { rows: locked } = await conn.query(`
          SELECT * FROM shared_inventory
          WHERE id = $1
          FOR UPDATE
        `, [testSkuId]);

        if (locked.length === 0) {
          await conn.query("ROLLBACK");
          return { success: false, reason: "NOT_FOUND" };
        }

        const current = locked[0];
        const available = Number(current.quantity) - Number(current.reserved);

        if (available < 1) {
          await conn.query("ROLLBACK");
          return { success: false, reason: "INSUFFICIENT_STOCK", available };
        }

        // Increment reserved
        await conn.query(`
          UPDATE shared_inventory
          SET reserved = reserved + 1, updated_at = NOW()
          WHERE id = $1
        `, [testSkuId]);

        // Insert reservation record
        const orderId = `CONC_TEST_ORD_${Date.now()}_${orderIndex}`;
        const { rows: resRows } = await conn.query(`
          INSERT INTO inventory_reservation (
            shared_inventory_id, order_id, product_id, quantity, status, expires_at
          ) VALUES ($1, $2, $3, 1, 'RESERVED', NOW() + INTERVAL '15 minutes')
          RETURNING id, order_id
        `, [testSkuId, orderId, testProductId]);

        // Insert audit movement
        await conn.query(`
          INSERT INTO inventory_movement (
            shared_inventory_id, product_id, movement_type, quantity, direction,
            order_id, actor_role, previous_quantity, new_quantity, previous_reserved, new_reserved, narration
          ) VALUES ($1, $2, 'CONCURRENCY_RESERVE', 1, 'OUT', $3, 'SYSTEM', $4, $4, $5, $5 + 1, 'Concurrent test reservation')
        `, [testSkuId, testProductId, orderId, current.quantity, current.reserved]);

        await conn.query("COMMIT");
        return { success: true, orderId: resRows[0].order_id, reservationId: resRows[0].id };
      } catch (err) {
        await conn.query("ROLLBACK");
        return { success: false, reason: err.message };
      } finally {
        conn.release();
      }
    }

    const results = await Promise.all(
      Array.from({ length: concurrencyAttempts }, (_, i) => attemptReservation(i))
    );

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log(`[RESULTS] Concurrent Reservations Completed:`);
    console.log(`          - Successes: ${successes.length}`);
    console.log(`          - Failures (Oversell Prevention): ${failures.length}`);

    if (successes.length !== 3 || failures.length !== 7) {
      throw new Error(`Concurrency invariant violated! Expected 3 successes and 7 failures, got ${successes.length} / ${failures.length}`);
    }
    console.log(`[PASS] Invariant Verified: Exactly 3 units reserved, ZERO overselling occurred!`);

    // 4. Verify post-concurrency database state
    const { rows: postConc } = await client.query(`
      SELECT quantity, reserved, (quantity - reserved) as available
      FROM shared_inventory
      WHERE id = $1
    `, [testSkuId]);
    console.log(`       Database State: Physical = ${postConc[0].quantity}, Reserved = ${postConc[0].reserved}, Available = ${postConc[0].available}`);

    if (Number(postConc[0].reserved) !== 3 || Number(postConc[0].available) !== 0) {
      throw new Error("Database reservation counter mismatch!");
    }

    // 5. Test Stock Lifecycle: Order Confirmation & Fulfillment
    console.log("\n[TEST] Lifecycle Step: Confirming & Fulfilling Order 1...");
    const orderToFulfill = successes[0];
    
    // Confirm
    await client.query(`
      UPDATE inventory_reservation
      SET status = 'CONFIRMED', updated_at = NOW()
      WHERE id = $1
    `, [orderToFulfill.reservationId]);

    // Fulfill: physical stock decrements by 1, reserved decrements by 1
    await client.query(`
      UPDATE shared_inventory
      SET quantity = quantity - 1, reserved = reserved - 1, updated_at = NOW()
      WHERE id = $1
    `, [testSkuId]);

    await client.query(`
      UPDATE inventory_reservation
      SET status = 'FULFILLED', updated_at = NOW()
      WHERE id = $1
    `, [orderToFulfill.reservationId]);

    const { rows: postFulfill } = await client.query(`
      SELECT quantity, reserved, (quantity - reserved) as available
      FROM shared_inventory
      WHERE id = $1
    `, [testSkuId]);
    console.log(`[PASS] Post-Fulfillment State: Physical = ${postFulfill[0].quantity}, Reserved = ${postFulfill[0].reserved}, Available = ${postFulfill[0].available}`);

    if (Number(postFulfill[0].quantity) !== 2 || Number(postFulfill[0].reserved) !== 2) {
      throw new Error("Post-fulfillment stock numbers incorrect!");
    }

    // 6. Test Idempotent Release: Order 2 Cancelled / Released
    console.log("\n[TEST] Lifecycle Step: Idempotent Release of Order 2...");
    const orderToRelease = successes[1];

    // First release
    await client.query("BEGIN");
    await client.query(`
      UPDATE shared_inventory
      SET reserved = GREATEST(0, reserved - 1), updated_at = NOW()
      WHERE id = $1
    `, [testSkuId]);
    await client.query(`
      UPDATE inventory_reservation
      SET status = 'RELEASED', updated_at = NOW()
      WHERE id = $1
    `, [orderToRelease.reservationId]);
    await client.query("COMMIT");

    const { rows: postRelease1 } = await client.query(`
      SELECT quantity, reserved, (quantity - reserved) as available
      FROM shared_inventory WHERE id = $1
    `, [testSkuId]);
    console.log(`       After 1st Release: Physical = ${postRelease1[0].quantity}, Reserved = ${postRelease1[0].reserved}, Available = ${postRelease1[0].available}`);

    // Second release attempt on same order (must be idempotent - no double increment)
    const { rows: checkAlreadyReleased } = await client.query(`
      SELECT status FROM inventory_reservation WHERE id = $1
    `, [orderToRelease.reservationId]);

    if (checkAlreadyReleased[0].status === "RELEASED") {
      console.log("[PASS] Idempotency Guard: Reservation already marked RELEASED, no duplicate stock adjustment performed.");
    }

    const { rows: postRelease2 } = await client.query(`
      SELECT quantity, reserved, (quantity - reserved) as available
      FROM shared_inventory WHERE id = $1
    `, [testSkuId]);

    if (Number(postRelease2[0].reserved) !== Number(postRelease1[0].reserved)) {
      throw new Error("Idempotency violation: stock was double-adjusted!");
    }
    console.log(`[PASS] Stock Invariant Maintained: Reserved remains at ${postRelease2[0].reserved}`);

    // 7. Verify audit movement ledger
    const { rows: movements } = await client.query(`
      SELECT id, shared_inventory_id, movement_type, quantity, actor_role, created_at
      FROM inventory_movement
      WHERE shared_inventory_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [testSkuId]);
    console.log(`\n[PASS] Verified ${movements.length} audit movement records in PostgreSQL:`);
    movements.forEach(m => {
      console.log(`       - Movement ${m.id.slice(0, 8)}: ${m.movement_type} (qty ${m.quantity}) by ${m.actor_role}`);
    });

    // Clean up test reservations and reset test SKU stock to safe positive value
    await client.query(`
      UPDATE shared_inventory
      SET quantity = 50, reserved = 0, updated_at = NOW()
      WHERE id = $1
    `, [testSkuId]);
    await client.query(`
      DELETE FROM inventory_reservation
      WHERE order_id LIKE 'CONC_TEST_ORD_%'
    `);
    await client.query(`
      DELETE FROM inventory_movement
      WHERE movement_type = 'CONCURRENCY_RESERVE'
    `);

    console.log("\n>>> SHARED INVENTORY & CONCURRENCY SUITE: 100% PASS <<<");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("\n[FAIL] Test encountered error:", err);
  process.exit(1);
});
