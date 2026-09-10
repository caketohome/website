import { dbQuery, getDbPool } from "../src/lib/db";

async function runExplain() {
  try {
    const search = "Kollam";
    const searchParam = `%${search.toLowerCase()}%`;
    const searchClause = `
      (
        LOWER(b.name) LIKE $1
        OR LOWER(b.code) LIKE $1
        OR LOWER(b.address) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'formatted_address', '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'address', '')) LIKE $1
        OR LOWER(COALESCE(c.name, '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'city', '')) LIKE $1
        OR LOWER(COALESCE(c.state, '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'state', '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'pincode', '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'manager_name', '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->'manager_account'->>'name', '')) LIKE $1
        OR LOWER(COALESCE(b.phone, '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'phone', '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->>'manager_phone', '')) LIKE $1
        OR LOWER(COALESCE(b.metadata->'manager_account'->>'phone', '')) LIKE $1
        OR EXISTS (
          SELECT 1 FROM "delivery_zone" dz 
          WHERE dz.branch_id = b.id 
          AND dz.deleted_at IS NULL 
          AND LOWER(COALESCE(dz.pincode, '')) LIKE $1
        )
      )
    `;

    console.log("=== EXPLAIN ANALYZE: COUNT QUERY ===");
    const countExplain = await dbQuery(
      `
      EXPLAIN ANALYZE
      SELECT 
        COUNT(*) FILTER (WHERE b.deleted_at IS NULL) as active_count,
        COUNT(*) FILTER (WHERE b.deleted_at IS NOT NULL) as archived_count,
        COUNT(*) as total_count
      FROM "branch" b
      LEFT JOIN "city" c ON b.city_id = c.id
      WHERE ${searchClause}
      `,
      [searchParam]
    );
    countExplain.rows.forEach(r => console.log(r["QUERY PLAN"]));

    console.log("\n=== EXPLAIN ANALYZE: PAGINATED DATA QUERY ===");
    const dataExplain = await dbQuery(
      `
      EXPLAIN ANALYZE
      SELECT b.*, c.name as city_name, c.state as city_state
      FROM "branch" b
      LEFT JOIN "city" c ON b.city_id = c.id
      WHERE ${searchClause} AND b.deleted_at IS NULL
      ORDER BY b.created_at ASC
      LIMIT 50 OFFSET 0
      `,
      [searchParam]
    );
    dataExplain.rows.forEach(r => console.log(r["QUERY PLAN"]));

    console.log("\n=== EXISTING INDEXES ON 'branch' ===");
    const idxRes = await dbQuery(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'branch'`);
    idxRes.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));

  } catch (err) {
    console.error("Explain failed:", err);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

runExplain();
