const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const groups = await pool.query("SELECT DISTINCT \"group\" FROM setting");
  console.log('Distinct groups in setting:', groups.rows);
  await pool.end();
}

run().catch(console.error);
