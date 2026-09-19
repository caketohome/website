const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const cats = await pool.query(`
      SELECT id, name, handle, metadata 
      FROM product_category 
      ORDER BY id ASC;
    `).catch(() => pool.query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%categor%'`));
    console.log('Categories / tables:');
    console.table(cats.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
