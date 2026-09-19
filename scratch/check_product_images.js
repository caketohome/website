const path = require('path');
const { Pool } = require(path.join(process.cwd(), 'frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product';");
  console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
  const res = await pool.query('SELECT id, title, thumbnail, handle FROM product LIMIT 20;');
  res.rows.forEach(r => {
    console.log(`[${r.id}] ${r.title} (${r.handle}) -> thumbnail: ${r.thumbnail}`);
  });
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
