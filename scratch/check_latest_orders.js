const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query('SELECT id, display_id, status, created_at FROM "order" ORDER BY created_at DESC LIMIT 5');
  console.log('Latest Orders in PostgreSQL:');
  console.log(res.rows);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
