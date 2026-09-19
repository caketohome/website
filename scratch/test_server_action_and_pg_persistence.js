const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('====================================================');
  console.log(' Verifying PostgreSQL Cart & Line Item Persistence');
  console.log('====================================================\n');

  // Query latest 3 carts in DB
  const cartsRes = await pool.query(`
    SELECT c.id, c.currency_code, c.created_at, c.updated_at,
           COUNT(cli.id) as item_count,
           COALESCE(SUM(cli.unit_price * cli.quantity), 0) as total_subtotal
    FROM "cart" c
    LEFT JOIN "cart_line_item" cli ON cli.cart_id = c.id AND cli.deleted_at IS NULL
    GROUP BY c.id, c.currency_code, c.created_at, c.updated_at
    ORDER BY c.updated_at DESC
    LIMIT 5
  `);

  console.log('Recent Cart Records in PostgreSQL:');
  for (const row of cartsRes.rows) {
    console.log(`  Cart ID: ${row.id} | Items: ${row.item_count} | Total: ₹${row.total_subtotal} | Updated: ${row.updated_at}`);
  }

  // Also query recent line items
  const itemsRes = await pool.query(`
    SELECT id, cart_id, title, quantity, unit_price, product_id, variant_id, created_at
    FROM "cart_line_item"
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('\nRecent Cart Line Items in PostgreSQL:');
  for (const item of itemsRes.rows) {
    console.log(`  Item: "${item.title}" | Cart: ${item.cart_id} | Qty: ${item.quantity} | Unit: ₹${item.unit_price} | Created: ${item.created_at}`);
  }

  await pool.end();
  console.log('\nPostgreSQL inspection complete.');
}

main().catch(console.error);
