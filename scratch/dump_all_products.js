const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const prods = await pool.query(`
    SELECT p.id, p.title, p.handle, p.status, p.weight as db_weight,
           p.metadata->>'price' as price,
           p.metadata->>'selling_price' as selling_price,
           p.metadata->>'mrp' as mrp,
           p.metadata->>'weight' as meta_weight,
           p.metadata->>'unit' as meta_unit,
           p.metadata->'weight_prices' as weight_prices,
           p.metadata->'pim_config' as pim_config,
           p.metadata->>'category' as category,
           p.metadata->>'category_slug' as category_slug
    FROM product p
    WHERE p.deleted_at IS NULL
    ORDER BY p.id
  `);

  console.log(`Total active products: ${prods.rows.length}`);
  for (const p of prods.rows) {
    console.log(`\n[${p.id}] ${p.title} (${p.handle})`);
    console.log(`  category: ${p.category} (${p.category_slug}), status: ${p.status}`);
    console.log(`  price: ${p.price}, selling_price: ${p.selling_price}, mrp: ${p.mrp}`);
    console.log(`  db_weight: ${p.db_weight}, meta_weight: ${p.meta_weight}, meta_unit: ${p.meta_unit}`);
    console.log(`  weight_prices: ${JSON.stringify(p.weight_prices)}`);
    console.log(`  pim_config: ${JSON.stringify(p.pim_config)}`);
  }

  // Also check product_variant for all products
  const vars = await pool.query(`
    SELECT pv.id, pv.product_id, pv.title, pv.sku, pv.weight
    FROM product_variant pv
    WHERE pv.deleted_at IS NULL
    ORDER BY pv.product_id, pv.id
  `);
  console.log(`\nTotal active variants: ${vars.rows.length}`);
  for (const v of vars.rows) {
    console.log(`  Product ${v.product_id} -> Variant [${v.id}] "${v.title}" (sku: ${v.sku}, weight: ${v.weight})`);
  }

  await pool.end();
}
run().catch(console.error);
