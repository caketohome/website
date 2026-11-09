const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test' });

async function main() {
  const res = await pool.query(`
    SELECT id, title, sku, handle, merchandise_type, deleted_at, metadata
    FROM public.product
    WHERE title ILIKE '%red velvet%' 
       OR title ILIKE '%forensic%' 
       OR id = 'prod_01KXYMAJKNXGS5WT4R0QNQGV5F'
       OR title ILIKE '%topper%';
  `);
  console.log('Query returned', res.rows.length, 'rows:');
  for (const r of res.rows) {
    console.log(JSON.stringify(r, null, 2));
  }
  await pool.end();
}

main().catch(console.error);
