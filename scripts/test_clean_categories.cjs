const fs = require('fs');
const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test' });

async function main() {
  const dump = JSON.parse(fs.readFileSync('scratch/product_master_dump.json', 'utf8'));
  const deletedIds = dump.products.filter(p => p.is_deleted).map(p => p.id);
  deletedIds.push('prod_dist_pg_persisted_test');

  const placeholders = deletedIds.map((_, i) => '$' + (i + 1)).join(',');
  const query = `
    SELECT DISTINCT 
      COALESCE(metadata->>'category', 'Artisanal Cakes') as name,
      COALESCE(metadata->>'category_slug', 'cakes') as slug,
      COUNT(*)::int as product_count
    FROM product 
    WHERE id NOT IN (${placeholders})
    GROUP BY 1, 2
    ORDER BY product_count DESC;
  `;
  const derived = await pool.query(query, deletedIds);
  console.log('Clean categories after restoring deleted_at:');
  console.log(derived.rows);
  await pool.end();
}

main().catch(console.error);
