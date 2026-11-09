const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query(`
    SELECT p.id, p.title, p.handle, p.metadata->>'category' as cat, p.metadata->'weight_prices' as wp,
           (SELECT json_agg(pv.*) FROM product_variant pv WHERE pv.product_id = p.id) as variants
    FROM product p
    WHERE p.deleted_at IS NULL
  `);
  for (const r of res.rows) {
    console.log(`\nProduct: [${r.id}] ${r.title} (Cat: ${r.cat})`);
    console.log('  Weight Prices in metadata:', r.wp);
    console.log('  Variants in product_variant:', (r.variants || []).map(v => ({ id: v.id, title: v.title, sku: v.sku })));
  }
  await pool.end();
}
run().catch(console.error);
