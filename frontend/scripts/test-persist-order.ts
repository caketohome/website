import { dbQuery } from "../src/lib/db";
import { persistOrderToDb } from "../src/lib/db-persistence";

async function testPersistOrder() {
  const sampleOrderRes = await dbQuery(`SELECT * FROM "order" WHERE deleted_at IS NULL LIMIT 1`);
  const order = sampleOrderRes.rows[0];
  console.log("Sample order before:", order.id, order.status, order.metadata);

  try {
    const testOrderObj = {
      id: order.id,
      display_id: order.display_id,
      email: order.email,
      status: "kitchen_accepted",
      total: 999,
      metadata: order.metadata,
    };
    await persistOrderToDb(testOrderObj);
    console.log("persistOrderToDb succeeded!");

    const verify = await dbQuery(`SELECT * FROM "order" WHERE id = $1`, [order.id]);
    console.log("Verify after persistOrderToDb:", verify.rows[0].status, verify.rows[0].metadata);
  } catch (err: any) {
    console.error("persistOrderToDb threw an error:", err.message, err.stack);
  }
}

testPersistOrder().catch(console.error);
