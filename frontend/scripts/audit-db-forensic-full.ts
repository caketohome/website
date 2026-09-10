import { dbQuery, closeDbPool } from "../src/lib/db";

async function inspectAllPublicTables() {
  console.log("============================================================");
  console.log("🔍 INSPECTING ALL PUBLIC TABLES IN POSTGRESQL");
  console.log("============================================================");

  try {
    const tablesRes = await dbQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name ASC
    `);

    console.log(`Found ${tablesRes.rows.length} public tables in PostgreSQL:`);
    for (const t of tablesRes.rows) {
      try {
        const countRes = await dbQuery(`SELECT count(*) AS c FROM "${t.table_name}"`);
        console.log(`  - Table: "${t.table_name}" (Rows: ${countRes.rows[0].c})`);
      } catch (err: any) {
        console.log(`  - Table: "${t.table_name}" (Error reading: ${err.message})`);
      }
    }
  } finally {
    await closeDbPool();
  }
}

inspectAllPublicTables().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
