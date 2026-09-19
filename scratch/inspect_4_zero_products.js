process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const ids = [
    'prod_01KXYMAJKNS8AGWCN5S1WEGKSD',
    'prod_01KXYMAJKNH99E1TMWYGQGT61D',
    'prod_01KXYMAJKNV48P1B9CM7C022YM',
    'prod_01KXYMAJKNDZ4T2YVA7K144XP5'
  ];
  const res = await pool.query(`
    SELECT p.id, p.title, pv.id as variant_id, pv.title as variant_title, pr.currency_code, pr.amount
    FROM product p
    JOIN product_variant pv ON pv.product_id = p.id
    LEFT JOIN product_variant_price_set pvps ON pvps.variant_id = pv.id
    LEFT JOIN price pr ON pr.price_set_id = pvps.price_set_id
    WHERE p.id = ANY($1)
  `, [ids]);
  console.log('PRICES IN PRICE TABLE FOR THE 4 PRODUCTS:');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run().catch(console.error);
