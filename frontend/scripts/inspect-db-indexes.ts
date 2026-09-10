import { getDbPool } from "../src/lib/db";

async function inspectIndexes() {
  const pool = getDbPool();

  console.log("=== 1. DATABASE VERSION ===");
  const versionRes = await pool.query("SELECT version()");
  console.log(versionRes.rows[0].version);

  console.log("\n=== 2. EXTENSIONS (pg_stat_statements check) ===");
  const extRes = await pool.query("SELECT extname, extversion FROM pg_extension");
  console.log(extRes.rows);

  console.log("\n=== 3. ALL USER TABLES & ROW COUNTS ===");
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  for (const r of tablesRes.rows) {
    try {
      const c = await pool.query(`SELECT COUNT(*) FROM "${r.table_name}"`);
      console.log(` - ${r.table_name.padEnd(35)} : ${c.rows[0].count} rows`);
    } catch (e: any) {
      console.log(` - ${r.table_name.padEnd(35)} : error reading count (${e.message})`);
    }
  }

  console.log("\n=== 4. EXISTING INDEXES IN PUBLIC SCHEMA ===");
  const indexRes = await pool.query(`
    SELECT 
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  console.log(`Total existing indexes in public schema: ${indexRes.rows.length}`);
  for (const idx of indexRes.rows) {
    console.log(`[${idx.tablename}] ${idx.indexname} -> ${idx.indexdef}`);
  }

  process.exit(0);
}

inspectIndexes().catch((err) => {
  console.error("Error inspecting database indexes:", err);
  process.exit(1);
});
