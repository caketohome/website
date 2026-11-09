process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query('SELECT id, title, metadata FROM product WHERE deleted_at IS NULL');
  console.log('TOTAL PRODUCTS:', res.rows.length);
  const zeroPrices = [];
  const validPrices = [];
  res.rows.forEach(p => {
    const meta = p.metadata || {};
    const price = Number(meta.price || meta.selling_price || 0);
    const hasWeightPrices = Array.isArray(meta.weight_prices) && meta.weight_prices.length > 0;
    if (price <= 0 && !hasWeightPrices) {
      zeroPrices.push({ id: p.id, title: p.title, metaKeys: Object.keys(meta) });
    } else {
      validPrices.push({ id: p.id, title: p.title, price, wpCount: hasWeightPrices ? meta.weight_prices.length : 0 });
    }
  });
  console.log('PRODUCTS WITH VALID PRICES (' + validPrices.length + '):');
  validPrices.forEach(p => console.log('  [VALID]', p.id, p.title, 'price=' + p.price, 'wp=' + p.wpCount));
  console.log('PRODUCTS WITH ZERO/MISSING PRICES (' + zeroPrices.length + '):');
  zeroPrices.forEach(p => console.log('  [ZERO]', p.id, p.title));
  await pool.end();
}
run().catch(console.error);
