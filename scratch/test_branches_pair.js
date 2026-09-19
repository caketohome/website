const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const cakeRes = await pool.query(`
    SELECT p.id, p.title, p.handle, pv.id as variant_id,
           COALESCE((p.metadata->>'selling_price')::numeric, 499) as price
    FROM product p
    JOIN product_variant pv ON pv.product_id = p.id
    WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'MADE_TO_ORDER_AVAILABILITY' OR p.metadata->>'category_slug' != 'accessories')
      AND p.id NOT LIKE 'acc_%'
      AND p.deleted_at IS NULL
    ORDER BY p.id ASC
    LIMIT 1
  `);
  console.log('Cake:', cakeRes.rows[0]);

  const accRes = await pool.query(`
    SELECT p.id, p.title, p.handle, pv.id as variant_id,
           COALESCE((p.metadata->>'selling_price')::numeric, 150) as price
    FROM product p
    JOIN product_variant pv ON pv.product_id = p.id
    WHERE p.id LIKE 'acc_%'
      AND p.deleted_at IS NULL
    ORDER BY p.id ASC
    LIMIT 1
  `);
  console.log('Accessory:', accRes.rows[0]);

  const invA = await pool.query(`
    SELECT * FROM branch_inventory WHERE branch_id = 'br_indiranagar' AND product_id = $1
  `, [accRes.rows[0].id]);
  console.log('Inv at br_indiranagar:', invA.rows);

  const invB = await pool.query(`
    SELECT * FROM branch_inventory WHERE branch_id = 'br_koramangala' AND product_id = $1
  `, [accRes.rows[0].id]);
  console.log('Inv at br_koramangala:', invB.rows);

  await pool.end();
}

check().catch(console.error);
