process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product'");
  console.log('PRODUCT TABLE COLUMNS:');
  cols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  const res = await pool.query("SELECT * FROM product WHERE title ILIKE '%cupcake%' OR title ILIKE '%fudge%'");
  console.log('PRODUCTS FOUND:', res.rows.length);
  res.rows.forEach(r => {
    console.log('---');
    console.log('ID:', r.id);
    console.log('TITLE:', r.title);
    console.log('METADATA:', JSON.stringify(r.metadata, null, 2));
  });

  const varCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product_variant'");
  console.log('PRODUCT_VARIANT TABLE COLUMNS:');
  varCols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  const vars = await pool.query("SELECT * FROM product_variant WHERE product_id = 'prod_01KXYMAJKNDZ4T2YVA7K144XP5'");
  console.log('CUPCAKE VARIANTS:', JSON.stringify(vars.rows, null, 2));

  const samplePrices = await pool.query(`
    SELECT DISTINCT currency_code FROM price;
  `);
  console.log('CURRENCY CODES IN PRICE TABLE:', samplePrices.rows);

  const trufflePrices = await pool.query(`
    SELECT p.id, p.title, p.metadata, pv.id as variant_id, pv.title as variant_title, pr.currency_code, pr.amount
    FROM product p
    LEFT JOIN product_variant pv ON pv.product_id = p.id
    LEFT JOIN product_variant_price_set pvps ON pvps.variant_id = pv.id
    LEFT JOIN price pr ON pr.price_set_id = pvps.price_set_id
    WHERE p.title ILIKE '%truffle%'
    LIMIT 5
  `);
  console.log('TRUFFLE PRICING IN DATABASE:', JSON.stringify(trufflePrices.rows, null, 2));

  // Check how ProductRepository maps product prices from DB!
  const allProds = await pool.query(`
    SELECT id, title, metadata->>'price' as meta_price, metadata->>'selling_price' as meta_selling_price, metadata->>'weight_prices' as weight_prices
    FROM product
    LIMIT 10
  `);
  console.log('SAMPLE PRODUCT METADATA PRICES:');
  allProds.rows.forEach(p => console.log(`  - [${p.id}] ${p.title} | price: ${p.meta_price} | selling_price: ${p.meta_selling_price} | weight_prices: ${p.weight_prices}`));

  await pool.end();
}

check().catch(console.error);
