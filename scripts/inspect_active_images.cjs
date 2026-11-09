const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test' });

async function main() {
  const activeIds = [
    'acc_01', 'acc_02',
    'prod_01KXYMAJKNDZ4T2YVA7K144XP5', 'prod_01KXYMAJKNH99E1TMWYGQGT61D',
    'prod_01KXYMAJKNS8AGWCN5S1WEGKSD', 'prod_01KXYMAJKNV48P1B9CM7C022YM',
    'prod_01KXYMAJKNWZCFXJHESPTZE01G', 'prod_01KXYMAJKNXGS5WT4R0QNQGV5F',
    'prod_1', 'prod_2', 'prod_3', 'prod_4', 'prod_5',
    'prod_1788960228243', 'prod_1788960313218', 'prod_1788960554491', 'prod_1788960674375',
    'prod_bouquet_carnation_01', 'prod_bouquet_rose_01',
    'prod_dist_test_01', 'prod_dist_test_02'
  ];

  const res = await pool.query('SELECT id, title, metadata FROM public.product WHERE id = ANY($1)', [activeIds]);
  for (const r of res.rows) {
    const meta = r.metadata || {};
    console.log(`[${r.id}] "${r.title}"`);
    console.log(`  thumb: ${meta.thumbnail || 'none'}`);
    console.log(`  gallery: ${JSON.stringify(meta.gallery || [])}`);
    console.log(`  cat: ${meta.category} | slug: ${meta.category_slug}`);
  }
  await pool.end();
}

main().catch(console.error);
