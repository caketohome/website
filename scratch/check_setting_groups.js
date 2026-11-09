const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const groups = await pool.query("SELECT DISTINCT \"group\" FROM setting");
  console.log('Distinct groups in setting:', groups.rows);
  await pool.end();
}

run().catch(console.error);
