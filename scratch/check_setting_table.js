const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'setting' ORDER BY ordinal_position"
  );
  console.log('setting columns:');
  res.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));

  const sample = await pool.query("SELECT * FROM setting LIMIT 5");
  console.log('Sample settings:', sample.rows);

  await pool.end();
}

run().catch(console.error);
