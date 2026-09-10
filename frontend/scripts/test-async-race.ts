import { dbQuery } from "../src/lib/db";

async function testAsyncRace() {
  const sampleOrderRes = await dbQuery(`SELECT id, status, metadata FROM "order" WHERE deleted_at IS NULL LIMIT 1`);
  const order = sampleOrderRes.rows[0];
  console.log("Order ID:", order.id, "initial DB metadata bakery_status:", order.metadata?.bakery_status);

  // Call the API to update status to "out_for_delivery"
  const res = await fetch(`http://localhost:3000/api/v1/admin/orders/${order.id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "out_for_delivery" }),
  });
  console.log("API returned status:", res.status);

  // Immediate DB check
  const immediate = await dbQuery(`SELECT status, metadata FROM "order" WHERE id = $1`, [order.id]);
  console.log("Immediate DB check bakery_status:", immediate.rows[0]?.metadata?.bakery_status);

  // Wait 1500ms
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const delayed = await dbQuery(`SELECT status, metadata FROM "order" WHERE id = $1`, [order.id]);
  console.log("Delayed (1.5s) DB check bakery_status:", delayed.rows[0]?.metadata?.bakery_status);

  // Revert
  await fetch(`http://localhost:3000/api/v1/admin/orders/${order.id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: order.metadata?.bakery_status || "confirmed" }),
  });
}

testAsyncRace().catch(console.error);
