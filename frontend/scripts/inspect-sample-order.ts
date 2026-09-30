import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

const safetyTimeout = setTimeout(() => {
  console.error("[TIMEOUT] inspect-sample-order timed out");
  process.exit(1);
}, 15000);
safetyTimeout.unref();

async function run() {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();

    const res = await client.query(`
      SELECT id, display_id, status, metadata 
      FROM "order" 
      WHERE id = 'ord_1787987782845_uen52' OR metadata->>'order_number' = 'CTH-20260829-101'
      LIMIT 2;
    `);

    console.log("Found:", res.rows.length);
    for (const r of res.rows) {
      console.log("\nID:", r.id);
      console.log("display_id:", r.display_id);
      console.log("status:", r.status);
      console.log("order_number:", r.metadata?.order_number);
      console.log("items count:", (r.metadata?.items || []).length);
      console.log("Metadata:", JSON.stringify(r.metadata, null, 2));
    }
  } catch (err: any) {
    console.error("ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
    clearTimeout(safetyTimeout);
    process.exit(process.exitCode || 0);
  }
}

run();
