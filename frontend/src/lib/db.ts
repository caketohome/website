import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

const FORBIDDEN_HOSTS = ['aws-1-ap-south-1.pooler.supabase.com', 'supabase.com', 'supabase.co'];

export function getConnectionString(): string | undefined {
  const isTestMode = process.env.NODE_ENV === "test";

  // Security Fail-Closed: Test mode strictly requires TEST_DATABASE_URL and will NEVER fall back to production DATABASE_URL
  if (isTestMode) {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("SECURITY FAIL-CLOSED: TEST_DATABASE_URL is required in test environments. Refusing to fallback to default or remote DATABASE_URL.");
    }
  }

  let rawUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (process.env.TEST_DATABASE_URL) {
    try {
      const parsed = new URL(process.env.TEST_DATABASE_URL);
      for (const fHost of FORBIDDEN_HOSTS) {
        if (parsed.hostname.includes(fHost)) {
          throw new Error(`CRITICAL SECURITY ABORT: TEST_DATABASE_URL points to production Supabase host (${parsed.hostname})! Target must be isolated localhost.`);
        }
      }
      if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
        throw new Error(`SECURITY ABORT: TEST_DATABASE_URL target (${parsed.hostname}) is not an isolated localhost.`);
      }
    } catch (e: any) {
      throw new Error(`Security validation failed for TEST_DATABASE_URL: ${e.message}`);
    }
    rawUrl = process.env.TEST_DATABASE_URL;
  } else if (rawUrl && process.env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(rawUrl);
      for (const fHost of FORBIDDEN_HOSTS) {
        if (parsed.hostname.includes(fHost)) {
          throw new Error(`CRITICAL SECURITY ABORT: Database target points to forbidden remote host (${parsed.hostname}) in non-production environment.`);
        }
      }
      if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
        throw new Error(`SECURITY ABORT: Database target (${parsed.hostname}) is not an isolated localhost target in non-production environment.`);
      }
    } catch (e: any) {
      throw new Error(`Security validation failed: ${e.message}`);
    }
  }

  if (!rawUrl && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: DATABASE_URL environment variable is required.");
  }

  return rawUrl;
}

// Singleton pool across Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __cth_pg_pool__: Pool | undefined;
}

export function getDbPool(): Pool {
  if (!globalThis.__cth_pg_pool__) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      console.warn("[PostgreSQL] Warning: Neither TEST_DATABASE_URL nor DATABASE_URL is configured.");
    }
    const isSupabase = Boolean(connectionString && connectionString.includes("supabase"));
    globalThis.__cth_pg_pool__ = new Pool({
      connectionString: connectionString || undefined,
      ssl: isSupabase ? { rejectUnauthorized: false } : false,
      client_encoding: "UTF8",
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    globalThis.__cth_pg_pool__.on("connect", (client) => {
      client.query("SET client_encoding TO 'UTF8';").catch(() => {});
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
