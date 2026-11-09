const path = require('path');
const { Pool } = require(path.join(process.cwd(), 'frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query('SELECT id, name, url, mime_type FROM media LIMIT 25;');
  console.log('Total sample media rows:', res.rows.length);
  res.rows.forEach(r => {
    console.log(`[${r.id}] ${r.name} -> ${r.url}`);
  });
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
