const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const productsCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product' ORDER BY ordinal_position;");
    console.log('product columns:', productsCols.rows.map(r => r.column_name));

    const rows = await pool.query("SELECT id, title, handle, thumbnail, status FROM product ORDER BY id;");
    console.log('Products in DB (total ' + rows.rows.length + '):');
    rows.rows.forEach(p => {
      console.log(`- [${p.id}] ${p.title} (handle: ${p.handle}) -> thumb: ${p.thumbnail ? p.thumbnail.slice(0, 60) : 'NULL'}`);
    });

    const images = await pool.query("SELECT id, product_id, url FROM image LIMIT 20;");
    console.log('Product images count:', images.rows.length);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
