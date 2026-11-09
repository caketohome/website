const path = require("path");
const fs = require("fs");
const { Pool } = require(path.join(__dirname, "../frontend/node_modules/pg"));

// Load DATABASE_URL from .env or frontend/.env
function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPaths = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "frontend", ".env"),
  ];
  for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
      const content = fs.readFileSync(ep, "utf8");
      const match = content.match(/^DATABASE_URL\s*=\s*["']?([^\r\n"']+)["']?/m);
      if (match && match[1]) return match[1].trim();
    }
  }
  return null;
}

async function inspectDbConnectivity() {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    console.log(JSON.stringify({ error: "DATABASE_URL not found in environment or .env files." }));
    return;
  }

  // Parse URL safely to mask password
  const urlObj = new URL(dbUrl);
  const maskedHost = urlObj.host;
  const maskedUser = urlObj.username;
  const maskedDb = urlObj.pathname.replace(/^\//, "");
  const port = urlObj.port;

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    
    // 1. Basic version and current database
    const vRes = await client.query("SELECT current_database() AS db, current_user AS user, version();");
    
    // 2. Max connections and active connections
    const connRes = await client.query("SELECT count(*) AS active_conns FROM pg_stat_activity;");
    let maxConn = "UNKNOWN";
    try {
      const mcRes = await client.query("SHOW max_connections;");
      maxConn = mcRes.rows[0].max_connections;
    } catch (e) {
      maxConn = e.message;
    }

    // 3. Check WAL and archive settings
    let walLevel = "UNKNOWN";
    let archiveMode = "UNKNOWN";
    try {
      const wRes = await client.query("SHOW wal_level;");
      walLevel = wRes.rows[0].wal_level;
    } catch (e) {
      walLevel = e.message;
    }
    try {
      const aRes = await client.query("SHOW archive_mode;");
      archiveMode = aRes.rows[0].archive_mode;
    } catch (e) {
      archiveMode = e.message;
    }

    // 4. Check tables count in public
    const tRes = await client.query("SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public';");

    // 5. Test transaction safety
    await client.query("BEGIN;");
    const testTx = await client.query("SELECT 1 AS tx_ok;");
    await client.query("COMMIT;");

    client.release();
    await pool.end();

    console.log(JSON.stringify({
      status: "CONNECTED",
      host: maskedHost,
      user: maskedUser,
      database: maskedDb,
      port: port,
      version: vRes.rows[0].version.split(" on ")[0],
      active_connections: connRes.rows[0].active_conns,
      max_connections: maxConn,
      wal_level: walLevel,
      archive_mode: archiveMode,
      public_table_count: tRes.rows[0].table_count,
      transaction_test: testTx.rows[0].tx_ok === 1 ? "PASSED" : "FAILED"
    }, null, 2));

  } catch (err) {
    await pool.end();
    console.log(JSON.stringify({
      status: "FAILED",
      error: err.message
    }, null, 2));
  }
}

inspectDbConnectivity();
