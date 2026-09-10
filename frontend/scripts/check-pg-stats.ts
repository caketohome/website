import { getDbPool } from "../src/lib/db";

async function checkStatStatements() {
  const pool = getDbPool();
  try {
    const res = await pool.query(`
      SELECT 
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        rows
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY total_exec_time DESC
      LIMIT 25;
    `);
    console.log(`=== TOP 25 STATEMENTS BY TOTAL TIME (${res.rows.length} rows) ===`);
    for (const r of res.rows) {
      console.log(`Calls: ${r.calls} | Mean: ${Number(r.mean_exec_time).toFixed(2)}ms | Total: ${Number(r.total_exec_time).toFixed(2)}ms | Rows: ${r.rows}`);
      console.log(`Query: ${r.query.slice(0, 150).replace(/\s+/g, ' ')}\n`);
    }
  } catch (err: any) {
    console.log("pg_stat_statements query error:", err.message);
  }
  process.exit(0);
}

checkStatStatements();
