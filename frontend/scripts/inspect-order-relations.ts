import { Client } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const safetyTimeout = setTimeout(() => {
  console.error("[TIMEOUT] inspect-order-relations timed out after 15s");
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

    // 1. Find all order-related tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%order%' 
          OR table_name LIKE '%line%' 
          OR table_name LIKE '%item%' 
          OR table_name LIKE '%payment%' 
          OR table_name LIKE '%delivery%' 
          OR table_name LIKE '%invoice%' 
          OR table_name LIKE '%kot%')
      ORDER BY table_name;
    `);
    console.log("RELATED TABLES FOUND:");
    tablesRes.rows.forEach(r => console.log(" -", r.table_name));

    // 2. Inspect 10 real orders with targeted JSON extraction (WITHOUT full SELECT *)
    console.log("\nINSPECTING 10 RECENT ORDERS (Targeted JSON extract):");
    const ordersRes = await client.query(`
      SELECT 
        id, 
        display_id, 
        status, 
        created_at,
        metadata->>'order_number' AS meta_order_number,
        metadata->>'customer_name' AS meta_customer_name,
        metadata->>'branch_id' AS meta_branch_id,
        metadata->>'bakery_status' AS meta_bakery_status,
        metadata->>'payment_status' AS meta_payment_status,
        metadata->>'payment_method' AS meta_payment_method,
        metadata->>'total' AS meta_total,
        metadata->>'subtotal' AS meta_subtotal,
        metadata->>'tax_amount' AS meta_tax_amount,
        metadata->>'discount_amount' AS meta_discount_amount,
        CASE WHEN metadata ? 'items' THEN jsonb_array_length(metadata->'items') ELSE 0 END AS items_count,
        CASE WHEN metadata ? 'delivery' THEN 1 ELSE 0 END AS has_delivery
      FROM "order"
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    console.table(ordersRes.rows);

    // 3. For the first 3 orders, examine items financial structure inside metadata
    console.log("\nINSPECTING ITEMS IN FIRST 3 ORDERS:");
    const itemDetailRes = await client.query(`
      SELECT 
        id,
        metadata->>'order_number' AS order_number,
        metadata->'items' AS items
      FROM "order"
      WHERE deleted_at IS NULL AND metadata ? 'items'
      ORDER BY created_at DESC
      LIMIT 3;
    `);

    itemDetailRes.rows.forEach((r, idx) => {
      console.log(`\nOrder #${idx + 1} (${r.id}, #${r.order_number}):`);
      const items = r.items || [];
      items.forEach((it: any, itIdx: number) => {
        console.log(`  Item [${itIdx}]:`, JSON.stringify(it));
      });
    });

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
