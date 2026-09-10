import { dbQuery } from "../src/lib/db";

async function runCommandCenterConsistencyGate() {
  console.log("================================================================================");
  console.log("   HARD GATE: ORDER COMMAND CENTER LIST / DETAIL CONSISTENCY TEST");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";

  // 1. Get an existing test order from PostgreSQL
  const orderRes = await dbQuery(
    `SELECT id, display_id, status, metadata FROM "order" WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`
  );
  if (orderRes.rows.length === 0) {
    throw new Error("No orders found in database for consistency test");
  }
  const testOrder = orderRes.rows[0];
  const orderId = testOrder.id;
  console.log(`Testing with Order ID: ${orderId}`);

  // Test Step 1: Directly mutate status in PostgreSQL to 'baking'
  console.log("\n[Step 1] Directly updating order status in PostgreSQL to 'baking'...");
  await dbQuery(
    `UPDATE "order"
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{bakery_status}', '"baking"'),
         updated_at = NOW()
     WHERE id = $1`,
    [orderId]
  );

  // Test Step 2: Query Command Center List API (without server restart)
  console.log("[Step 2] Fetching Command Center List API...");
  const listRes = await fetch(`${baseUrl}/api/v1/admin/orders?limit=50`, {
    headers: { "x-user-role": "SUPER_ADMIN", "x-user-id": "admin_01" },
  });
  const listData = await listRes.json();
  const listOrder = (listData.orders || []).find((o: any) => o.id === orderId || o.order_id === orderId);

  console.log(`List API status for ${orderId}: ${listOrder?.status}`);

  // Test Step 3: Query Command Center Detail API
  console.log("[Step 3] Fetching Command Center Detail API...");
  const detailRes = await fetch(`${baseUrl}/api/v1/admin/orders/${orderId}`, {
    headers: { "x-user-role": "SUPER_ADMIN", "x-user-id": "admin_01" },
  });
  const detailData = await detailRes.json();
  const detailOrder = detailData.order;

  console.log(`Detail API status for ${orderId}: ${detailOrder?.status}`);

  let passed = true;
  if (!listOrder || listOrder.status !== "baking") {
    console.error(`❌ FAILED: List API did not immediately reflect PostgreSQL update! Got: ${listOrder?.status}`);
    passed = false;
  }
  if (!detailOrder || detailOrder.status !== "baking") {
    console.error(`❌ FAILED: Detail API did not immediately reflect PostgreSQL update! Got: ${detailOrder?.status}`);
    passed = false;
  }

  // Test Step 4: Update status through Command Center API to 'ready_for_pickup'
  console.log("\n[Step 4] Updating status via PUT /api/v1/admin/orders/[id]/status to 'ready_for_pickup'...");
  const putRes = await fetch(`${baseUrl}/api/v1/admin/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "SUPER_ADMIN",
      "x-user-id": "admin_01",
    },
    body: JSON.stringify({ status: "ready_for_pickup", notes: "Command Center Consistency Test" }),
  });
  const putData = await putRes.json();
  console.log(`PUT status response: success=${putData.success}`);

  // Test Step 5: Verify immediate visibility in List, Detail, and PostgreSQL
  console.log("[Step 5] Re-verifying List, Detail, and direct PostgreSQL...");
  const listRes2 = await fetch(`${baseUrl}/api/v1/admin/orders?limit=50`, {
    headers: { "x-user-role": "SUPER_ADMIN", "x-user-id": "admin_01" },
  });
  const listData2 = await listRes2.json();
  const listOrder2 = (listData2.orders || []).find((o: any) => o.id === orderId || o.order_id === orderId);

  const detailRes2 = await fetch(`${baseUrl}/api/v1/admin/orders/${orderId}`, {
    headers: { "x-user-role": "SUPER_ADMIN", "x-user-id": "admin_01" },
  });
  const detailData2 = await detailRes2.json();
  const detailOrder2 = detailData2.order;

  const dbCheck = await dbQuery(`SELECT metadata->>'bakery_status' as status FROM "order" WHERE id = $1`, [orderId]);
  const dbStatus = dbCheck.rows[0]?.status;

  console.log(`List API status: ${listOrder2?.status}`);
  console.log(`Detail API status: ${detailOrder2?.status}`);
  console.log(`Direct PostgreSQL status: ${dbStatus}`);

  if (listOrder2?.status !== "ready_for_pickup") {
    console.error(`❌ FAILED: List API status mismatch (${listOrder2?.status} vs ready_for_pickup)`);
    passed = false;
  }
  if (detailOrder2?.status !== "ready_for_pickup") {
    console.error(`❌ FAILED: Detail API status mismatch (${detailOrder2?.status} vs ready_for_pickup)`);
    passed = false;
  }
  if (dbStatus !== "ready_for_pickup") {
    console.error(`❌ FAILED: PostgreSQL status mismatch (${dbStatus} vs ready_for_pickup)`);
    passed = false;
  }

  console.log("\n================================================================================");
  if (passed) {
    console.log("   🎉 COMMAND CENTER CONSISTENCY HARD GATE: PASS");
    console.log("   List & Detail 100% Synchronized | Direct DB Reflection without Restart");
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.log("   ❌ COMMAND CENTER CONSISTENCY HARD GATE: FAIL");
    console.log("================================================================================\n");
    process.exit(1);
  }
}

runCommandCenterConsistencyGate().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
