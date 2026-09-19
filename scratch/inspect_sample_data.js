const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const pvRows = await pool.query(`
      SELECT id, title, sku, product_id, weight, metadata 
      FROM product_variant 
      WHERE deleted_at IS NULL 
      LIMIT 10;
    `);
    console.log('--- SAMPLE PRODUCT_VARIANTS ---');
    console.table(pvRows.rows);

    const pRows = await pool.query(`
      SELECT id, title, handle, status, metadata->>'category_slug' as cat_slug, metadata->'pim_config'->>'inventory_mode' as inv_mode
      FROM product
      WHERE deleted_at IS NULL
      LIMIT 10;
    `);
    console.log('--- SAMPLE PRODUCTS ---');
    console.table(pRows.rows);

    const bRows = await pool.query(`
      SELECT id, name, code, is_open, city_id 
      FROM branch 
      WHERE deleted_at IS NULL 
      ORDER BY id ASC;
    `);
    console.log('--- BRANCHES (COUNT: ' + bRows.rows.length + ') ---');
    console.table(bRows.rows.slice(0, 15));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
