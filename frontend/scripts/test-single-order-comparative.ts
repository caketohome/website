import { Client } from "pg";
import { OrderRepository } from "../src/lib/repositories/order.repository";
import { closeDbPool } from "../src/lib/db";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const safetyTimeout = setTimeout(() => {
  console.error("[TIMEOUT] test-single-order-comparative timed out after 30s");
  process.exit(1);
}, 30000);
safetyTimeout.unref();

async function testOrderTrace(label: string, identifier: string) {
  console.log(`\n============================================================`);
  console.log(`TESTING ORDER: ${label} (identifier: "${identifier}")`);
  console.log(`============================================================`);

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  try {
    // 1. Direct DB query
    const t0 = Date.now();
    await client.connect();
    const dbRes = await client.query(
      `SELECT id, display_id, status, metadata FROM "order" WHERE (id = $1 OR display_id::text = $1 OR metadata->>'order_number' = $1) AND deleted_at IS NULL LIMIT 1`,
      [identifier]
    );
    const dbMs = Date.now() - t0;
    console.log(`1. Direct DB lookup: ${dbMs}ms | Found: ${dbRes.rows.length > 0}`);
    if (dbRes.rows.length > 0) {
      const r = dbRes.rows[0];
      console.log(`   DB id: "${r.id}" | display_id: ${r.display_id} | status: "${r.status}" | order_number: "${r.metadata?.order_number}"`);
      console.log(`   DB total_amount in meta: ${r.metadata?.total_amount} | subtotal: ${r.metadata?.subtotal} | items: ${(r.metadata?.items || []).length}`);
    }

    // 2. OrderRepository lookup
    const t1 = Date.now();
    const repoOrder = await OrderRepository.findById(identifier);
    const repoMs = Date.now() - t1;
    console.log(`2. Repository findById: ${repoMs}ms | Found: ${!!repoOrder}`);
    if (repoOrder) {
      console.log(`   Repo id: "${repoOrder.id}" | order_number: "${repoOrder.order_number}" | status: "${repoOrder.status}" | total: ₹${repoOrder.total}`);
    }

    // 3. Detail API HTTP fetch
    const t2 = Date.now();
    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), 12000);
    const apiRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${identifier}`, {
      signal: controller.signal,
    });
    clearTimeout(fetchTimer);
    const apiMs = Date.now() - t2;
    console.log(`3. Detail API HTTP fetch: ${apiMs}ms | Status: ${apiRes.status}`);
    const apiData = await apiRes.json();
    console.log(`   API success: ${apiData.success} | has order: ${!!apiData.order}`);
    if (apiData.order) {
      console.log(`   API id: "${apiData.order.id}" | order_number: "${apiData.order.order_number}" | total: ₹${apiData.order.total}`);
    } else {
      console.log(`   API response error/message:`, apiData.error || apiData.message || apiData);
    }

  } catch (err: any) {
    console.error(`ERROR during ${label}:`, err.message);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function run() {
  try {
    // 1. Working order: ORD-305751 (order_1788862305751_y8eh)
    await testOrderTrace("WORKING ORDER (ORD-305751)", "order_1788862305751_y8eh");

    // 2. Older / previously failing order: CTH-20260829-101 (ord_1787987782845_uen52)
    await testOrderTrace("OLDER ORDER BY ID (ord_1787987782845_uen52)", "ord_1787987782845_uen52");
    await testOrderTrace("OLDER ORDER BY NUMBER (CTH-20260829-101)", "CTH-20260829-101");

  } finally {
    await closeDbPool();
    clearTimeout(safetyTimeout);
    // Graceful exit for libuv on Windows
    setTimeout(() => process.exit(0), 50);
  }
}

run();
