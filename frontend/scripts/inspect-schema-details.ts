import { dbQuery } from "../src/lib/db";

async function main() {
  const tables = [
    "branch_inventory",
    "order",
    "order_status_history",
    "product",
    "branch",
    "cms_page",
    "cms_section",
    "payment",
    "payment_collection",
    "payment_session"
  ];

  for (const t of tables) {
    try {
      const cols = await dbQuery(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [t]
      );
      if (cols.rows.length === 0) {
        console.log(`=== TABLE: "${t}" DOES NOT EXIST ===\n`);
        continue;
      }
      const pks = await dbQuery(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
        [t]
      );
      const idxs = await dbQuery(
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE tablename = $1`,
        [t]
      );
      const count = await dbQuery(`SELECT count(*) FROM "${t}"`);
      console.log(`=== TABLE: "${t}" ===`);
      console.log(`Row count: ${count.rows[0].count}`);
      console.log(`Primary Keys: [${pks.rows.map((r) => r.column_name).join(", ")}]`);
      console.log(
        `Columns (${cols.rows.length}):\n  ` +
          cols.rows
            .map((r) => `${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`)
            .join("\n  ")
      );
      console.log(
        `Indexes (${idxs.rows.length}):\n  ` +
          idxs.rows.map((r) => `${r.indexname} -> ${r.indexdef}`).join("\n  ")
      );
      console.log("");
    } catch (err: any) {
      console.error(`Error inspecting table "${t}":`, err.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
