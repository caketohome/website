const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const [count, folders] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM media WHERE deleted_at IS NULL'),
    pool.query('SELECT folder, COUNT(*) FROM media WHERE deleted_at IS NULL GROUP BY folder')
  ]);
  console.log('Total media in DB:', count.rows[0].count);
  console.log('Folders in DB:');
  folders.rows.forEach(f => console.log(`  ${f.folder}: ${f.count}`));
  await pool.end();
}

run().catch(console.error);
