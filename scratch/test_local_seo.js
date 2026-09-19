const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Testing Local SEO data sources:');
  const cities = await pool.query('SELECT id, name FROM city WHERE is_active = true');
  console.log('Active cities count:', cities.rows.length);
  cities.rows.forEach(c => console.log(`  ${c.id}: ${c.name}`));

  const branches = await pool.query('SELECT id, name, city_name, phone, address FROM branch WHERE deleted_at IS NULL LIMIT 5');
  console.log('\nBranches sample count:', branches.rows.length);
  branches.rows.forEach(b => console.log(`  ${b.name} (${b.city_name}) - ${b.phone}`));

  await pool.end();
  console.log('\nLocal SEO data sources verified successfully!');
}

run().catch(console.error);
