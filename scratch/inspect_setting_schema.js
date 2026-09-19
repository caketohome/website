const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const { rows: cols } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'setting'
    `);
    console.log('setting columns:', cols);

    const { rows: settings } = await pool.query(`SELECT * FROM setting LIMIT 10`);
    console.log('setting rows sample:', settings.map(s => ({
      id: s.id,
      key: s.key,
      group: s.group || s.group_name || s.section,
      val_preview: typeof s.value === 'string' ? s.value.slice(0, 80) : JSON.stringify(s.value).slice(0, 80)
    })));

    const { rows: accProds } = await pool.query(`SELECT id, title, handle, metadata FROM product WHERE id LIKE 'acc_%' OR id = 'acc_01'`);
    console.log('product rows with id acc_%:', accProds);

    const { rows: allProds } = await pool.query(`SELECT id, title, metadata->>'category_slug' as slug FROM product WHERE metadata->>'category_slug' LIKE '%acc%'`);
    console.log('product rows with category_slug LIKE %acc%:', allProds);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
