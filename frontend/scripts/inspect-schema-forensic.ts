import { dbQuery } from "../src/lib/db";

async function inspectSchema() {
  const res = await dbQuery(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position
  `);
  const byTable: Record<string, string[]> = {};
  for (const row of res.rows) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(`${row.column_name} (${row.data_type})`);
  }
  for (const [t, cols] of Object.entries(byTable)) {
    console.log(`=== Table: ${t} ===`);
    console.log(cols.join(", "));
    console.log("");
  }
  process.exit(0);
}

inspectSchema().catch((err) => {
  console.error(err);
  process.exit(1);
});
