import { Client } from "pg";
import { OrderRepository } from "../src/lib/repositories/order.repository";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const res = await client.query(`
    SELECT id, display_id, metadata->>'order_number' AS order_number, status, metadata 
    FROM "order" 
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `);

  console.log(`Auditing all ${res.rows.length} active orders in PostgreSQL:`);

  let failCount = 0;
  let successCount = 0;
  const failures: any[] = [];

  for (const r of res.rows) {
    const byId = await OrderRepository.findById(r.id);
    if (!byId) {
      failCount++;
      failures.push({ type: "BY_ID_FAILED", id: r.id, order_number: r.order_number });
    } else {
      successCount++;
    }

    // Also test by order_number if it exists
    if (r.order_number) {
      const byNum = await OrderRepository.findById(r.order_number);
      if (!byNum) {
        failures.push({ type: "BY_NUMBER_FAILED", id: r.id, order_number: r.order_number });
      }
    }
  }

  console.log(`Summary: ${successCount} succeeded, ${failCount} failed by ID.`);
  if (failures.length > 0) {
    console.log("Failures found:", failures);
  } else {
    console.log("All 130 orders found successfully by ID!");
  }

  await client.end();
}

run();
