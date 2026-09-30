import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

// Fail safely if DATABASE_URL is not configured
if (!connectionString) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: DATABASE_URL environment variable is required.");
  }
  console.warn("[PostgreSQL] Warning: DATABASE_URL environment variable is not set.");
}

// Singleton pool across Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __cth_pg_pool__: Pool | undefined;
}

export function getDbPool(): Pool {
  if (!globalThis.__cth_pg_pool__) {
    const isSupabase = Boolean(connectionString && connectionString.includes("supabase"));
    globalThis.__cth_pg_pool__ = new Pool({
      connectionString: connectionString || undefined,
      ssl: isSupabase ? { rejectUnauthorized: false } : false,
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    globalThis.__cth_pg_pool__.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]:", err.message);
    });
  }
  return globalThis.__cth_pg_pool__;
}

export async function dbQuery<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(text, params);
}

export async function dbTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

let lastDbHealthCheck = 0;
let dbHealthCached = true;

export async function isDatabaseHealthy(): Promise<boolean> {
  if (Date.now() - lastDbHealthCheck < 10000) {
    return dbHealthCached;
  }
  try {
    const pool = getDbPool();
    const res = await pool.query("SELECT 1 AS healthy");
    dbHealthCached = res.rows.length > 0 && res.rows[0].healthy === 1;
    lastDbHealthCheck = Date.now();
    return dbHealthCached;
  } catch (err) {
    dbHealthCached = false;
    lastDbHealthCheck = Date.now();
    return false;
  }
}

export async function closeDbPool(): Promise<void> {
  if (globalThis.__cth_pg_pool__) {
    await globalThis.__cth_pg_pool__.end();
    globalThis.__cth_pg_pool__ = undefined;
  }
}
