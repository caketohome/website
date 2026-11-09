const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const sec = await pool.query("SELECT * FROM cms_homepage_section WHERE id = 'sec_home_hero';");
    console.log('sec_home_hero:', JSON.stringify(sec.rows[0], null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
