const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const rows = await pool.query('SELECT id, name, url, mime_type, size, folder, alt_text, is_webp_generated, is_avif_generated FROM media WHERE deleted_at IS NULL LIMIT 5');
  console.log('Sample media rows:');
  rows.rows.forEach(r => console.log(JSON.stringify(r)));
  await pool.end();
}

run().catch(console.error);
