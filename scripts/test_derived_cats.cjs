const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test' });

async function main() {
  const derived = await pool.query(`
    SELECT DISTINCT 
      COALESCE(metadata->>'category', 'Artisanal Cakes') as name,
      COALESCE(metadata->>'category_slug', 'cakes') as slug,
      COALESCE(metadata->>'primary_category_id', 'cat_' || LOWER(REGEXP_REPLACE(metadata->>'category', '[^a-zA-Z0-9]+', '_', 'g'))) as id,
      COUNT(*)::int as product_count
    FROM product 
    WHERE deleted_at IS NULL
    GROUP BY 1, 2, 3
    ORDER BY product_count DESC;
  `);
  console.log(derived.rows);
  await pool.end();
}

main().catch(console.error);
