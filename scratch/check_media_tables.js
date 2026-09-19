const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name LIKE '%media%' OR table_name LIKE '%asset%' OR table_name LIKE '%image%' OR table_name LIKE '%file%'
    ORDER BY table_name
  `);
  console.log('Media-related tables in DB:');
  tables.rows.forEach(r => console.log('  ', r.table_name));

  for (const row of tables.rows) {
    const cols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = $1 ORDER BY ordinal_position
    `, [row.table_name]);
    console.log(`\nColumns for ${row.table_name}:`);
    cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
    const count = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
    console.log(`  Count: ${count.rows[0].count}`);
  }

  await pool.end();
}

run().catch(console.error);
