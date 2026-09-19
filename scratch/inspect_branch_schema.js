const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const bCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'branch'
      ORDER BY ordinal_position;
    `);
    console.log('--- BRANCH COLUMNS ---');
    console.table(bCols.rows);

    const branches = await pool.query(`SELECT id, name, code, is_main, status, metadata FROM branch ORDER BY id ASC LIMIT 5;`);
    console.log('--- SAMPLE BRANCHES ---');
    console.table(branches.rows.map(b => ({ id: b.id, name: b.name, code: b.code, status: b.status })));

    const count = await pool.query(`SELECT count(*)::int FROM branch WHERE deleted_at IS NULL;`);
    console.log('Total non-deleted branches:', count.rows[0].count);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
