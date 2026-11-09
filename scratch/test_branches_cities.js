const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const branches = await pool.query('SELECT b.id, b.name, b.city_id, c.name as city_name, b.phone, b.address FROM branch b LEFT JOIN city c ON b.city_id = c.id WHERE b.deleted_at IS NULL');
  console.log('Branches with city names:');
  branches.rows.forEach(b => console.log(`  ${b.name} (${b.city_name || b.city_id}) - ${b.phone}`));
  await pool.end();
}

run().catch(console.error);
