import { dbQuery, getDbPool } from "../src/lib/db";

async function testCountsAndSearch() {
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

    const countRes = await dbQuery(
      `
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

    console.log(`Counts for "${search}":`, countRes.rows[0]);

    // Test with no search (all branches)
    const allCountRes = await dbQuery(
      `
      SELECT 
        COUNT(*) FILTER (WHERE b.deleted_at IS NULL) as active_count,
        COUNT(*) FILTER (WHERE b.deleted_at IS NOT NULL) as archived_count,
        COUNT(*) as total_count
      FROM "branch" b
      LEFT JOIN "city" c ON b.city_id = c.id
      `
    );
    console.log("Overall counts (no search):", allCountRes.rows[0]);

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

testCountsAndSearch();
