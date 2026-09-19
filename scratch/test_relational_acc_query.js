const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const branches = await pool.query('SELECT id, name FROM branch WHERE deleted_at IS NULL LIMIT 2;');
    const b1 = branches.rows[0];
    const b2 = branches.rows[1];
    console.log('Testing with branches:', b1.id, 'and', b2.id);

    const q = `
      SELECT 
        p.id,
        pv.id as variant_id,
        pv.sku,
        p.title as name,
        p.metadata->>'category' as category_name,
        COALESCE((p.metadata->>'selling_price')::numeric, 0) as price,
        COALESCE((p.metadata->>'cost_price')::numeric, 0) as cost_price,
        COALESCE(bi.quantity, 0) as stock,
        COALESCE(bi.reserved, 0) as reserved,
        COALESCE(bi.quantity - bi.reserved, 0) as available_stock,
        COALESCE((p.metadata->>'low_stock_threshold')::int, 5) as low_stock_threshold
      FROM product p
      LEFT JOIN product_variant pv ON pv.product_id = p.id
      LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = $1 AND bi.deleted_at IS NULL
      WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'STOCK_CONTROLLED' OR p.metadata->>'category_slug' = 'accessories')
        AND p.deleted_at IS NULL
      ORDER BY p.id ASC;
    `;

    const res1 = await pool.query(q, [b1.id]);
    console.log(`Branch 1 (${b1.name}) accessories count:`, res1.rows.length);
    console.table(res1.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
