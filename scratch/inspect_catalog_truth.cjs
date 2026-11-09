const path = require('path');
const pg = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new pg.Pool({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });

async function main() {
  const metaRes = await pool.query(`
    SELECT 
      id, 
      title, 
      merchandise_type, 
      metadata->>'category' as category, 
      metadata->>'category_slug' as category_slug, 
      metadata->>'primary_category_id' as primary_category_id,
      metadata->>'image' as meta_image,
      metadata->>'images' as meta_images,
      metadata->>'thumbnail' as meta_thumb
    FROM public.product
    LIMIT 20
  `);
  console.log('SAMPLE PRODUCTS METADATA:', JSON.stringify(metaRes.rows, null, 2));

  const distinctCategories = await pool.query(`
    SELECT 
      merchandise_type,
      metadata->>'category' as category,
      metadata->>'category_slug' as category_slug,
      count(*)
    FROM public.product
    GROUP BY 1, 2, 3
  `);
  console.log('DISTINCT CATEGORIES IN DB:', JSON.stringify(distinctCategories.rows, null, 2));
  await pool.end();
}
main().catch(console.error);
