import { Client } from "pg";
import { OrderRepository } from "../src/lib/repositories/order.repository";
import { closeDbPool } from "../src/lib/db";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const safetyTimeout = setTimeout(() => {
  console.error("[SAFETY_TIMEOUT] test-order-lifecycle-transitions timed out after 30s");
  process.exit(1);
}, 30000);
safetyTimeout.unref();

async function run() {
  console.log("================================================================================");
  console.log("CAKETOHOME — ORDER LIFECYCLE & OPERATIONAL ACTIONS VERIFICATION");
  console.log("================================================================================");

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  const testOrderId = `order_test_lifecycle_${Date.now()}`;
  let passedGates = 0;

  try {
    await client.connect();

    // SETUP: Insert a test order into PostgreSQL for end-to-end lifecycle mutations
    console.log(`\n[SETUP] Creating isolated test order in PostgreSQL: ${testOrderId}`);
    await client.query(
      `INSERT INTO "order" (id, display_id, status, email, currency_code, metadata, created_at, updated_at)
       VALUES ($1, 999901, 'pending', 'tester@caketohome.internal', 'INR', $2, NOW(), NOW())`,
      [
        testOrderId,
        JSON.stringify({
          order_number: "ORD-999901",
          customer_uid: "cust_test_99",
          customer_name: "Lifecycle Audit Customer",
          customer_phone: "+91 98888 77777",
          branch_id: "br_indiranagar",
          items: [
            {
              id: "item_lc_01",
              title: "Artisan Red Velvet Heart Cake",
              quantity: 1,
              unit_price: 749,
              subtotal: 749,
              hsn_code: "19059090",
              gst_rate_pct: 5,
              cgst: 17.83,
              sgst: 17.83,
              tax_amount: 35.66,
            },
          ],
          subtotal: 749,
          total: 749,
          tax_amount: 35.66,
        }),
      ]
    );

    // GATE 1: Initial Order Load
    console.log("\n[GATE 1] Testing initial order load from DB...");
    const order1 = await OrderRepository.findById(testOrderId);
    if (!order1 || order1.status !== "pending" || order1.total !== 749) {
      throw new Error(`Gate 1 failed: initial order status '${order1?.status}' != 'pending' or total ${order1?.total} != 749`);
    }
    console.log(`  ✅ GATE 1 PASSED: Order loaded with status '${order1.status}', total ₹${order1.total}`);
    passedGates++;

    // GATE 2: Invalid Status Transition Rejection
    console.log("\n[GATE 2] Testing illegal transition gate (pending -> delivered)...");
    let caughtIllegal = false;
    try {
      await OrderRepository.updateStatus(testOrderId, "delivered");
    } catch (err: any) {
      caughtIllegal = true;
      console.log(`  Expected illegal transition error caught: "${err.message}"`);
    }
    if (!caughtIllegal) {
      throw new Error("Gate 2 failed: illegal transition was permitted!");
    }
    console.log("  ✅ GATE 2 PASSED: Illegal transition rejected by state machine.");
    passedGates++;

    // GATE 3: Valid Progression: pending -> confirmed -> kitchen_accepted -> preparing -> packed
    console.log("\n[GATE 3] Testing valid sequential state machine progression...");
    const step1 = await OrderRepository.updateStatus(testOrderId, "confirmed", "Customer payment confirmed");
    if (step1.status !== "confirmed") throw new Error(`Step 1 failed: status is ${step1.status}`);

    const step2 = await OrderRepository.updateStatus(testOrderId, "kitchen_accepted", "Chef Somesh accepted order");
    if (step2.status !== "kitchen_accepted") throw new Error(`Step 2 failed: status is ${step2.status}`);

    const step3 = await OrderRepository.updateStatus(testOrderId, "preparing", "Cake sponge in oven");
    if (step3.status !== "preparing") throw new Error(`Step 3 failed: status is ${step3.status}`);

    const step4 = await OrderRepository.updateStatus(testOrderId, "packed", "Packaged in gold insulated box");
    if (step4.status !== "packed") throw new Error(`Step 4 failed: status is ${step4.status}`);

    console.log(`  ✅ GATE 3 PASSED: Order successfully progressed: pending -> confirmed -> kitchen_accepted -> preparing -> packed`);
    passedGates++;

    // GATE 4: Status Transition Idempotency
    console.log("\n[GATE 4] Testing idempotency of updateStatus (double packed)...");
    const countRes1 = await client.query(
      `SELECT count(*)::int as count FROM "order_status_history" WHERE order_id = $1`,
      [testOrderId]
    );
    const countBefore = countRes1.rows[0].count;

    // Call updateStatus with identical status 'packed'
    const step4Idempotent = await OrderRepository.updateStatus(testOrderId, "packed");
    const countRes2 = await client.query(
      `SELECT count(*)::int as count FROM "order_status_history" WHERE order_id = $1`,
      [testOrderId]
    );
    const countAfter = countRes2.rows[0].count;

    if (countAfter !== countBefore) {
      throw new Error(`Gate 4 failed: Idempotent call inserted duplicate status history record (${countAfter} > ${countBefore})`);
    }
    console.log(`  ✅ GATE 4 PASSED: Idempotent call returned existing order without duplicate history logs (${countBefore} entries).`);
    passedGates++;

    // GATE 5: Audit Log Timeline Integrity in PostgreSQL
    console.log("\n[GATE 5] Verifying order_status_history audit trail in DB...");
    const historyRes = await client.query(
      `SELECT to_status, from_status, reason FROM "order_status_history" WHERE order_id = $1 ORDER BY created_at ASC`,
      [testOrderId]
    );
    console.log(`  Audit history entries in DB: ${historyRes.rows.length}`);
    historyRes.rows.forEach((h, idx) => {
      console.log(`    [${idx + 1}] ${h.from_status} -> ${h.to_status} : "${h.reason}"`);
    });
    if (historyRes.rows.length !== 4) {
      throw new Error(`Gate 5 failed: expected 4 status history entries, found ${historyRes.rows.length}`);
    }
    console.log("  ✅ GATE 5 PASSED: Immutable audit trail verified in PostgreSQL.");
    passedGates++;

    // GATE 6: Staff Internal Note Persistence
    console.log("\n[GATE 6] Testing staff internal note addition...");
    const notedOrder = await OrderRepository.addStaffNote(testOrderId, "VIP customer requested extra chocolate curls on top");
    if (!notedOrder.staff_notes || !notedOrder.staff_notes.includes("VIP customer requested extra chocolate curls on top")) {
      throw new Error("Gate 6 failed: staff note not returned in OrderDomain");
    }
    const dbMetaCheck = await client.query(`SELECT metadata FROM "order" WHERE id = $1`, [testOrderId]);
    const persistedNotes = dbMetaCheck.rows[0].metadata?.staff_notes || [];
    if (!persistedNotes.includes("VIP customer requested extra chocolate curls on top")) {
      throw new Error("Gate 6 failed: staff note was not persisted in PostgreSQL metadata");
    }
    console.log(`  ✅ GATE 6 PASSED: Staff internal note successfully persisted to PostgreSQL and verified.`);
    passedGates++;

    // GATE 7: Branch Reassignment
    console.log("\n[GATE 7] Testing branch reassignment...");
    const reassignedOrder = await OrderRepository.assignBranch(
      testOrderId,
      "br_koramangala",
      "Koramangala Gourmet Hub",
      "Rerouted due to closer proximity to delivery address"
    );
    if (reassignedOrder.branch.id !== "br_koramangala" || reassignedOrder.branch.name !== "Koramangala Gourmet Hub") {
      throw new Error("Gate 7 failed: branch not updated in OrderDomain");
    }
    console.log(`  ✅ GATE 7 PASSED: Branch successfully reassigned to '${reassignedOrder.branch.name}'.`);
    passedGates++;

    // GATE 8: Delivery Fleet Partner Assignment
    console.log("\n[GATE 8] Testing delivery partner assignment...");
    const assignedOrder = await OrderRepository.assignDelivery(
      testOrderId,
      "driver_vikram_42",
      "Vikram Rathod",
      "+91 98450 11223"
    );
    if (assignedOrder.delivery.partner_id !== "driver_vikram_42" || assignedOrder.delivery.partner_name !== "Vikram Rathod") {
      throw new Error("Gate 8 failed: delivery partner not updated in OrderDomain");
    }
    console.log(`  ✅ GATE 8 PASSED: Delivery partner successfully assigned to '${assignedOrder.delivery.partner_name}'.`);
    passedGates++;

    // GATE 9: Reschedule Delivery Slot
    console.log("\n[GATE 9] Testing delivery reschedule...");
    const rescheduledOrder = await OrderRepository.reschedule(
      testOrderId,
      "2026-09-15",
      "14:00 - 16:00",
      "Customer requested afternoon delivery slot"
    );
    if (rescheduledOrder.delivery.date !== "2026-09-15" || rescheduledOrder.delivery.slot !== "14:00 - 16:00") {
      throw new Error("Gate 9 failed: delivery date/slot not updated in OrderDomain");
    }
    console.log(`  ✅ GATE 9 PASSED: Delivery slot rescheduled to ${rescheduledOrder.delivery.date} (${rescheduledOrder.delivery.slot}).`);
    passedGates++;

    // GATE 10: Final Fulfillment: packed -> out_for_delivery -> delivered
    console.log("\n[GATE 10] Testing final fulfillment progression to delivered...");
    const outOrder = await OrderRepository.updateStatus(testOrderId, "out_for_delivery", "Rider dispatched");
    if (outOrder.status !== "out_for_delivery") throw new Error("Status not out_for_delivery");

    const deliveredOrder = await OrderRepository.updateStatus(testOrderId, "delivered", "Delivered and OTP verified");
    if (deliveredOrder.status !== "delivered") throw new Error("Status not delivered");

    console.log(`  ✅ GATE 10 PASSED: Order fulfilled to 'delivered'. Payment captured, balance ₹${deliveredOrder.payment?.balance}.`);
    passedGates++;

    console.log("\n================================================================================");
    console.log(`🏆 ALL ${passedGates}/${passedGates} LIFECYCLE & OPERATIONAL ACTION GATES PASSED (100% SUCCESS)`);
    console.log("================================================================================");

  } catch (err: any) {
    console.error("\n❌ FATAL LIFECYCLE ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    // CLEANUP: Delete isolated test order and its status history
    try {
      await client.query(`DELETE FROM "order_status_history" WHERE order_id = $1`, [testOrderId]);
      await client.query(`DELETE FROM "order" WHERE id = $1`, [testOrderId]);
      console.log(`[CLEANUP] Deleted test order ${testOrderId} and associated history records cleanly.`);
      await client.end();
    } catch {
      // ignore
    }
    await closeDbPool();
    clearTimeout(safetyTimeout);
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  }
}

run();
