const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expense' ORDER BY ordinal_position");
  console.log("Columns of expense:", r.rows);
  const sample = await pool.query("SELECT * FROM public.expense LIMIT 1");
  console.log("Sample expense row:", sample.rows[0]);
  await pool.end();
}
main().catch(console.error);
