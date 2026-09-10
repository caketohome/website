import { getDbPool } from "../src/lib/db";

async function testIndexUsageUnderScale() {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    console.log("--- Test Delivery Date Index WITH deleted_at IS NULL ---");
    await client.query("BEGIN;");
    await client.query("SET LOCAL enable_seqscan = off;");
    const res1 = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT * FROM "delivery" 
      WHERE delivery_date = '2026-09-07' AND deleted_at IS NULL;
    `);
    for (const r of res1.rows) console.log(r["QUERY PLAN"]);

    console.log("\n--- Test Driver Capacity Index WITH deleted_at IS NULL ---");
    const res2 = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT * FROM "delivery" 
      WHERE delivery_partner_id = 'dlp_1' AND delivery_status = 'assigned' AND deleted_at IS NULL;
    `);
    for (const r of res2.rows) console.log(r["QUERY PLAN"]);

    await client.query("ROLLBACK;");
  } finally {
    client.release();
  }
  process.exit(0);
}

testIndexUsageUnderScale().catch(console.error);
