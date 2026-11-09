const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const cats = await pool.query(`
      SELECT id, name, handle, metadata 
      FROM product_category 
      ORDER BY id ASC;
    `).catch(() => pool.query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%categor%'`));
    console.log('Categories / tables:');
    console.table(cats.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
