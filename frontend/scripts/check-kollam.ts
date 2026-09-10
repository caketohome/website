import { dbQuery, getDbPool } from "../src/lib/db";

async function checkKollam() {
  try {
    const res = await dbQuery(`
      SELECT b.id, b.name, b.code, b.is_open, b.deleted_at, b.metadata
      FROM "branch" b
      WHERE b.id = 'br_kollam_central' OR LOWER(b.name) LIKE '%kollam%'
    `);
    console.log("Kollam branches in DB:", JSON.stringify(res.rows, null, 2));
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

checkKollam();
