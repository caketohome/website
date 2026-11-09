const { Pool } = require('../frontend/node_modules/pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });

  console.log('--- 1. SAMPLE METADATA KEYS ---');
  const sampleMeta = await pool.query("SELECT id, title, merchandise_type, metadata FROM public.product LIMIT 5");
  console.log(JSON.stringify(sampleMeta.rows, null, 2));

  console.log('\n--- 2. ALL PRODUCTS WITH ACC_ OR ACCESSORY ---');
  const accs = await pool.query("SELECT id, title, merchandise_type, hsn_code, metadata FROM public.product WHERE merchandise_type = 'ACCESSORY' OR id LIKE 'acc_%'");
  console.log(JSON.stringify(accs.rows, null, 2));

  console.log('\n--- 3. CHECK DISTINCT CATEGORIES IN METADATA ---');
  const cats = await pool.query("SELECT DISTINCT metadata->>'category' as category, count(*) FROM public.product GROUP BY metadata->>'category'");
  console.log(cats.rows);

  console.log('\n--- 4. CHECK IMAGES / THUMBNAILS IN METADATA ---');
  const imgs = await pool.query("SELECT id, title, metadata->>'thumbnail' as thumb, metadata->>'image' as img, metadata->>'images' as imgs FROM public.product WHERE metadata->>'thumbnail' IS NOT NULL OR metadata->>'image' IS NOT NULL LIMIT 10");
  console.log('Products with thumbnail/image:', imgs.rows);

  console.log('\n--- 5. CHECK PRODUCT_VARIANT ---');
  const variants = await pool.query("SELECT * FROM public.product_variant LIMIT 5");
  console.log('Variants:', variants.rows);

  console.log('\n--- 6. CHECK ORDER ITEMS OF ORDER 98544 OR SIMILAR ---');
  const orderItems = await pool.query("SELECT * FROM public.order_item LIMIT 5");
  console.log('Order items sample:', orderItems.rows);

  await pool.end();
}

main().catch(console.error);
