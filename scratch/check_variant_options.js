const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const res = await pool.query('SELECT id, type, name, display_name, price_modifier, is_enabled FROM variant_option');
  console.log('variant_options count:', res.rows.length);
  for (const row of res.rows) {
    console.log(`Option: [${row.type}] ${row.name} (${row.display_name}) modifier: ${row.price_modifier} enabled: ${row.is_enabled}`);
  }
  await pool.end();
}

check().catch(console.error);
