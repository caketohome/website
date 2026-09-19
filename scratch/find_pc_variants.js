process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('--- Inspecting all products for "pc", "piece", weight, weight_prices ---');
  const res = await pool.query(`
    SELECT id, title, handle, weight, metadata 
    FROM product 
    ORDER BY title ASC
  `);

  console.log(`Total products in DB: ${res.rows.length}`);
  
  for (const row of res.rows) {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const weightPrices = meta.weight_prices || [];
    const metaWeight = meta.weight;
    const colWeight = row.weight;
    const pimConfig = meta.pim_config;

    const hasPcInWeight = (metaWeight && /pc|piece/i.test(metaWeight)) || (colWeight && /pc|piece/i.test(String(colWeight)));
    const hasPcInWeightPrices = weightPrices.some(wp => wp.weight_name && /pc|piece/i.test(wp.weight_name));

    if (hasPcInWeight || hasPcInWeightPrices) {
      console.log(`\nMATCH: [${row.id}] "${row.title}" (handle: ${row.handle})`);
      console.log('  col weight:', colWeight);
      console.log('  meta weight:', metaWeight);
      console.log('  meta weight_prices:', JSON.stringify(weightPrices, null, 2));
      console.log('  meta pim_config:', JSON.stringify(pimConfig, null, 2));
    }
  }

  // Also inspect product_variant table for pc/piece
  console.log('\n--- Inspecting product_variant table for "pc" or "piece" ---');
  const varRes = await pool.query(`
    SELECT id, product_id, title, sku, weight, metadata 
    FROM product_variant
    WHERE title ILIKE '%pc%' OR title ILIKE '%piece%' OR sku ILIKE '%pc%' OR sku ILIKE '%piece%'
  `);
  console.log(`Variants matching: ${varRes.rows.length}`);
  for (const vr of varRes.rows) {
    console.log(`  Variant [${vr.id}] title="${vr.title}" sku="${vr.sku}" weight="${vr.weight}"`);
  }

  await pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
