const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cms_homepage_section' ORDER BY ordinal_position;");
    console.log('cms_homepage_section columns:', cols.rows);

    const firstRow = await pool.query("SELECT * FROM cms_homepage_section LIMIT 1;");
    console.log('First row:', firstRow.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
