const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const testCartId = `cart_test_repo_${Date.now()}`;
  const testItemId = `item_test_${Date.now()}`;
  console.log(`Testing CartRepository persistence with ${testCartId}...`);

  // 1. Insert cart
  await pool.query(
    `INSERT INTO "cart" (id, currency_code, metadata, created_at, updated_at)
     VALUES ($1, 'inr', $2, NOW(), NOW())`,
    [testCartId, JSON.stringify({ shop_id: 'br_koramangala', test: true })]
  );
  console.log('1. Inserted cart successfully');

  // 2. Insert line item with raw_unit_price
  const unitPrice = 499;
  const rawUnitPrice = JSON.stringify({ value: String(unitPrice), precision: 20 });
  await pool.query(
    `INSERT INTO "cart_line_item" (
       id, cart_id, title, thumbnail, quantity, product_id, product_title, unit_price, raw_unit_price, metadata, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
    [
      testItemId,
      testCartId,
      'Chocolate Fudge Cupcake',
      '/images/cupcake.jpg',
      2,
      'prod_01KXYMAJKNDZ4T2YVA7K144XP5',
      'Chocolate Fudge Cupcake',
      unitPrice,
      rawUnitPrice,
      JSON.stringify({ weight: '500g', price: 499 })
    ]
  );
  console.log('2. Inserted cart_line_item with raw_unit_price successfully!');

  // 3. Query back
  const cartRes = await pool.query('SELECT * FROM "cart" WHERE id = $1', [testCartId]);
  console.log('3. Retrieved cart row:', cartRes.rows[0].id);

  const itemsRes = await pool.query('SELECT * FROM "cart_line_item" WHERE cart_id = $1', [testCartId]);
  console.log('4. Retrieved items count:', itemsRes.rows.length, 'Title:', itemsRes.rows[0].title, 'Price:', itemsRes.rows[0].unit_price, 'Qty:', itemsRes.rows[0].quantity);

  // 4. Clean up test data
  await pool.query('DELETE FROM "cart_line_item" WHERE cart_id = $1', [testCartId]);
  await pool.query('DELETE FROM "cart" WHERE id = $1', [testCartId]);
  console.log('5. Cleaned up test rows.');

  await pool.end();
  console.log('ALL TESTS PASSED!');
}

main().catch(console.error);
