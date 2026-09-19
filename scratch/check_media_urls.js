const path = require('path');
const { Pool } = require(path.join(process.cwd(), 'frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
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
