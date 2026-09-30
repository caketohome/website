import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

// Hard safety timer: terminates script after 20 seconds maximum
const safetyTimeout = setTimeout(() => {
  console.error("\n[DIAGNOSTIC_TIMEOUT] Global script safety timeout (20s) reached.");
  process.exit(1);
}, 20000);
safetyTimeout.unref();

async function runQueryWithTimeout(client: Client, queryText: string, params: any[] = [], timeoutMs: number = 8000): Promise<{ rows: any[]; durationMs: number }> {
  console.log(`QUERY_START: "${queryText.replace(/\s+/g, ' ').trim()}"`);
  const start = Date.now();
  
  const queryPromise = client.query(queryText, params);
  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`Query timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    t.unref();
  });

  const result = await Promise.race([queryPromise, timeoutPromise]);
  const durationMs = Date.now() - start;
  console.log(`QUERY_SUCCESS: Returned ${result.rows.length} rows`);
  console.log(`QUERY_DURATION: ${durationMs}ms`);
  return { rows: result.rows, durationMs };
}

async function runDiagnostic() {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  try {
    console.log("DB_CONNECTION_ATTEMPT: Connecting to", connectionString.split("@")[1] || "PostgreSQL");
    const connStart = Date.now();
    await client.connect();
    const connDuration = Date.now() - connStart;
    console.log(`DB_CONNECTION_SUCCESS: Established in ${connDuration}ms`);

    // 1. Minimal check: SELECT 1
    const q1 = await runQueryWithTimeout(client, "SELECT 1 AS check_val", [], 5000);
    console.log("  Result check_val:", q1.rows[0]?.check_val);

    // 2. Identity check: SELECT current_database(), current_user, now()
    const q2 = await runQueryWithTimeout(client, "SELECT current_database(), current_user, now()", [], 5000);
    console.log("  Database:", q2.rows[0]?.current_database);
    console.log("  User:", q2.rows[0]?.current_user);
    console.log("  Server Time:", q2.rows[0]?.now);

    // 3. Count orders: SELECT COUNT(*) FROM "order"
    const q3 = await runQueryWithTimeout(client, 'SELECT COUNT(*)::int AS count FROM "order" WHERE deleted_at IS NULL', [], 5000);
    console.log("  Order Count (active):", q3.rows[0]?.count);

    // 4. Representative order lookup latency
    const q4 = await runQueryWithTimeout(
      client,
      'SELECT id, display_id, status, metadata->>\'order_number\' as order_number FROM "order" WHERE deleted_at IS NULL LIMIT 1',
      [],
      5000
    );
    const sampleId = q4.rows[0]?.id;
    if (sampleId) {
      const q5 = await runQueryWithTimeout(
        client,
        'SELECT id, display_id, status, metadata FROM "order" WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
        [sampleId],
        5000
      );
      console.log(`  Representative order ${sampleId} lookup took ${q5.durationMs}ms`);
    }

  } catch (err: any) {
    console.error("ERROR_CODE:", err?.code || "UNKNOWN");
    console.error("ERROR_MESSAGE:", err?.message || String(err));
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
    clearTimeout(safetyTimeout);
    process.exit(process.exitCode || 0);
  }
}

runDiagnostic();
