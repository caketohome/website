const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
});

async function main() {
  const dump = JSON.parse(fs.readFileSync('scratch/product_master_dump.json', 'utf8'));
  console.log('--- ALL PRODUCTS IN MASTER DUMP ---');
  dump.products.forEach(p => {
    console.log(`[${p.id}] "${p.title}" | is_deleted: ${p.is_deleted} | deleted_at: ${p.deleted_at} | category: ${p.category} (${p.category_slug})`);
  });

  console.log('\n--- ALL PRODUCTS IN POSTGRESQL ---');
  const res = await pool.query('SELECT id, title, merchandise_type, deleted_at, metadata FROM public.product ORDER BY id;');
  res.rows.forEach(p => {
    const cat = p.metadata?.category || 'none';
    const cat_slug = p.metadata?.category_slug || 'none';
    const img = p.metadata?.thumbnail || p.metadata?.image || 'none';
    console.log(`[${p.id}] "${p.title}" | del: ${p.deleted_at ? 'YES' : 'NO'} | type: ${p.merchandise_type} | cat: ${cat} (${cat_slug}) | img: ${img.slice(0, 50)}`);
  });

  await pool.end();
}

main().catch(console.error);
