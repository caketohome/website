import { getDbPool } from "../src/lib/db";

async function main() {
  const pool = getDbPool();
  try {
    const res = await pool.query("SELECT id, title, handle, metadata FROM product WHERE title ILIKE '%Pistachio%' LIMIT 5");
    console.log("Found products:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

main();
