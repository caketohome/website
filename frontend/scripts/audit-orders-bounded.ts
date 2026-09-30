import { Client } from "pg";
import { OrderRepository } from "../src/lib/repositories/order.repository";
import { closeDbPool } from "../src/lib/db";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

// Parse CLI argument for limit (default: 5)
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 5;

// Overall safety timer
const safetyTimeoutMs = Math.max(20000, limit * 1000 + 10000);
const safetyTimeout = setTimeout(() => {
  console.error(`\n[SAFETY_TIMEOUT] Script exceeded maximum allotted time of ${safetyTimeoutMs}ms`);
  process.exit(1);
}, safetyTimeoutMs);
safetyTimeout.unref();

interface AuditResult {
  index: number;
  orderId: string;
  orderNumber: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  dbFound: boolean;
  repoFound: boolean;
  apiStatus: number;
  status: "SUCCESS" | "FAILED" | "TIMEOUT";
  error?: string;
}

async function auditOrder(client: Client, r: any, index: number): Promise<AuditResult> {
  const startTime = new Date().toISOString();
  const startMs = Date.now();
  const orderId = r.id;
  const orderNumber = r.metadata?.order_number || r.display_id || "";

  let dbFound = false;
  let repoFound = false;
  let apiStatus = 0;

  try {
    // 1. Direct DB lookup with per-query 3s timeout
    const dbPromise = client.query(
      `SELECT id, display_id, status FROM "order" WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [orderId]
    );
    const dbRes = await Promise.race([
      dbPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 3000)),
    ]);
    dbFound = dbRes.rows.length > 0;

    // 2. Repository findById with 3s timeout
    const repoPromise = OrderRepository.findById(orderId);
    const repoOrder = await Promise.race([
      repoPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Repo timeout")), 3000)),
    ]);
    repoFound = !!repoOrder;

    // 3. API HTTP fetch with 3s timeout
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 3000);
    const apiRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${orderId}`, {
      signal: controller.signal,
    }).catch((e) => ({ status: 0, error: e.message }));
    clearTimeout(fetchTimeout);
    apiStatus = (apiRes as any).status || 0;

    const durationMs = Date.now() - startMs;
    const isSuccess = dbFound && repoFound && apiStatus === 200;

    return {
      index,
      orderId,
      orderNumber,
      startTime,
      endTime: new Date().toISOString(),
      durationMs,
      dbFound,
      repoFound,
      apiStatus,
      status: isSuccess ? "SUCCESS" : "FAILED",
    };
  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    const isTimeout = err.message?.includes("timeout") || err.name === "AbortError";
    return {
      index,
      orderId,
      orderNumber,
      startTime,
      endTime: new Date().toISOString(),
      durationMs,
      dbFound,
      repoFound,
      apiStatus,
      status: isTimeout ? "TIMEOUT" : "FAILED",
      error: err.message,
    };
  }
}

async function run() {
  const overallStart = Date.now();
  console.log(`============================================================`);
  console.log(`STARTING BOUNDED ORDER AUDIT (Target: ${limit} orders)`);
  console.log(`============================================================\n`);

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  const results: AuditResult[] = [];

  try {
    await client.connect();
    const ordersRes = await client.query(`
      SELECT id, display_id, status, metadata 
      FROM "order" 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    console.log(`Retrieved ${ordersRes.rows.length} orders from PostgreSQL. Executing sequential audit:\n`);

    for (let i = 0; i < ordersRes.rows.length; i++) {
      const r = ordersRes.rows[i];
      const res = await auditOrder(client, r, i + 1);
      results.push(res);
      console.log(
        `[${res.index}/${ordersRes.rows.length}] Order ${res.orderId} (#${res.orderNumber}) -> ${res.status} (DB: ${res.dbFound ? "OK" : "MISSING"}, Repo: ${res.repoFound ? "OK" : "MISSING"}, API: ${res.apiStatus}) in ${res.durationMs}ms`
      );
    }

    const totalElapsed = Date.now() - overallStart;
    const successes = results.filter((r) => r.status === "SUCCESS").length;
    const failures = results.filter((r) => r.status === "FAILED").length;
    const timeouts = results.filter((r) => r.status === "TIMEOUT").length;
    const avgMs = Math.round(results.reduce((acc, r) => acc + r.durationMs, 0) / (results.length || 1));
    const slowest = [...results].sort((a, b) => b.durationMs - a.durationMs)[0];

    console.log(`\n============================================================`);
    console.log(`BOUNDED AUDIT SUMMARY:`);
    console.log(`  Total Orders Tested: ${results.length}`);
    console.log(`  Successful:          ${successes}`);
    console.log(`  Failed:              ${failures}`);
    console.log(`  Timed Out:           ${timeouts}`);
    console.log(`  Total Elapsed Time:  ${totalElapsed}ms`);
    console.log(`  Average Per Order:   ${avgMs}ms`);
    if (slowest) {
      console.log(`  Slowest Order:       ${slowest.orderId} (${slowest.durationMs}ms)`);
    }
    console.log(`============================================================\n`);

  } catch (err: any) {
    console.error("FATAL ERROR during bounded audit:", err.message);
    process.exitCode = 1;
  } finally {
    try {
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
