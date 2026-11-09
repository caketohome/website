const path = require('path');
const { Pool } = require(path.join(process.cwd(), 'frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});
async function test() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'product_variant'
  `);
  console.log('product_variant columns:', res.rows.map(r => r.column_name + ' (' + r.data_type + ')'));
  await pool.end();
}
test().catch(console.error);
