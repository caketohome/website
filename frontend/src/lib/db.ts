import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

/**
 * Allowed Supabase direct-connection hosts.
 * The project's own Supabase DB host is always permitted; TEST_DATABASE_URL
 * is still locked to localhost to prevent accidental test runs against production.
 */
const SUPABASE_PROJECT_REF = 'tunskohzwjaerdxvbwmg';
const ALLOWED_SUPABASE_HOSTS = [`db.${SUPABASE_PROJECT_REF}.supabase.co`];

/** Supabase connection pooler (Supavisor) for THIS project only: user must be postgres.<project-ref>. */
function isAllowedSupabasePooler(parsed: URL): boolean {
  return /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(parsed.hostname)
    && decodeURIComponent(parsed.username) === `postgres.${SUPABASE_PROJECT_REF}`;
}

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
      if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
        throw new Error(`SECURITY ABORT: TEST_DATABASE_URL target (${parsed.hostname}) is not an isolated localhost.`);
      }
    } catch (e: any) {
      throw new Error(`Security validation failed for TEST_DATABASE_URL: ${e.message}`);
    }
    rawUrl = process.env.TEST_DATABASE_URL;
  } else if (rawUrl) {
    // Allow localhost and the project's own Supabase host
    try {
      const parsed = new URL(rawUrl);
      const isLocalhost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
      const isAllowedSupabase = ALLOWED_SUPABASE_HOSTS.includes(parsed.hostname) || isAllowedSupabasePooler(parsed);
      if (!isLocalhost && !isAllowedSupabase) {
        throw new Error(`SECURITY ABORT: Database target (${parsed.hostname}) is not localhost or an allowed Supabase host.`);
      }
    } catch (e: any) {
      if (e.message.startsWith('SECURITY')) throw e;
      throw new Error(`Security validation failed: ${e.message}`);
    }
  }

  if (!rawUrl) {
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
      options: "-c client_encoding=UTF8",
      min: 1,
      max: isSupabase ? 10 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    globalThis.__cth_pg_pool__.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]:", err.message);
    });
  } else {
    // Ensure no legacy 'connect' listeners from hot-reloaded dev sessions execute concurrent client.query() calls
    globalThis.__cth_pg_pool__.removeAllListeners("connect");
  }
  return globalThis.__cth_pg_pool__;
}

/** Any write to a CMS table clears the CMS read cache (see cms.repository). */
function clearCmsCacheIfCmsWrite(text: unknown) {
  if (typeof text === "string" && /^\s*(insert|update|delete)\b/i.test(text) && /\bcms_/i.test(text)) {
    (globalThis as any).__cthCmsReadCache?.clear?.();
  }
}

export async function dbQuery<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  const res = await pool.query<T>(text, params);
  clearCmsCacheIfCmsWrite(text);
  return res;
}

export async function dbTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  const rawQuery = client.query.bind(client);
  let queryQueue: Promise<any> = Promise.resolve();

  // Serialize queries on the same PoolClient within a transaction to prevent overlapping client.query() calls
  (client as any).query = (...args: any[]) => {
    clearCmsCacheIfCmsWrite(args[0]);
    const next = queryQueue.then(() => (rawQuery as any)(...args));
    queryQueue = next.catch(() => {});
    return next;
  };

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackErr) {}
    throw err;
  } finally {
    (client as any).query = rawQuery;
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
