const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const branches = await pool.query('SELECT id, name, code, is_open FROM branch WHERE deleted_at IS NULL ORDER BY created_at ASC');
  console.log('Branches in PG:', branches.rows);
  const indira = await pool.query('SELECT * FROM branch WHERE id = $1', ['br_indiranagar']);
  console.log('br_indiranagar exists in PG:', indira.rows.length > 0 ? indira.rows[0].name : 'NO');
  await pool.end();
}

check().catch(console.error);
