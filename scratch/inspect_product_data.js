const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function inspectProduct() {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product'
    `);
    console.log('PRODUCT_COLUMNS:', cols.rows.map(r => r.column_name));

    const sample = await pool.query(`SELECT * FROM product LIMIT 1`);
    console.log('SAMPLE_PRODUCT:', JSON.stringify(sample.rows[0], null, 2));

    const sampleVariant = await pool.query(`SELECT * FROM product_variant LIMIT 1`);
    console.log('SAMPLE_VARIANT:', JSON.stringify(sampleVariant.rows[0], null, 2));
  } catch (err) {
    console.error('ERR:', err);
  } finally {
    await pool.end();
  }
}

inspectProduct();
