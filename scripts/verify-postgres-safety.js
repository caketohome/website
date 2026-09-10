const path = require("path");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));

async function verifyPostgresSafety() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in backend/.env or frontend/.env");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const t0 = Date.now();
    await client.connect();
    const connectLatency = Date.now() - t0;
    console.log(`[PostgreSQL Check] Connected in ${connectLatency}ms`);

    // 1. SELECT 1
    const t1 = Date.now();
    const pingRes = await client.query("SELECT 1 as ping;");
    const pingLatency = Date.now() - t1;
    console.log(`[PostgreSQL Check] SELECT 1 -> result: ${pingRes.rows[0].ping} (latency: ${pingLatency}ms)`);

    // 2. Harmless counts
    const t2 = Date.now();
    const productRes = await client.query("SELECT COUNT(*) as cnt FROM product;");
    const productLatency = Date.now() - t2;
    console.log(`[PostgreSQL Check] SELECT COUNT(*) FROM product -> ${productRes.rows[0].cnt} products (latency: ${productLatency}ms)`);

    const t3 = Date.now();
    const cmsRes = await client.query("SELECT COUNT(*) as cnt FROM cms_page;");
    const cmsLatency = Date.now() - t3;
    console.log(`[PostgreSQL Check] SELECT COUNT(*) FROM cms_page -> ${cmsRes.rows[0].cnt} pages (latency: ${cmsLatency}ms)`);

    // 3. Check active connections in database
    const connRes = await client.query(`
      SELECT count(*) as total_connections,
             count(*) FILTER (WHERE state = 'active') as active_connections,
             count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database();
    `);
    const connStats = connRes.rows[0];
    console.log(`[PostgreSQL Check] Connections in DB -> Total: ${connStats.total_connections}, Active: ${connStats.active_connections}, Idle: ${connStats.idle_connections}`);

    await client.end();
    console.log("✅ PostgreSQL health check: ALL CHECKS PASSED. Client connection closed cleanly.");
    process.exit(0);
  } catch (err) {
    console.error("❌ PostgreSQL health check FAILED:", err.message);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

verifyPostgresSafety();
