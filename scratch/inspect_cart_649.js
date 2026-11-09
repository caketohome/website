const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  const item = await pool.query("SELECT * FROM cart_line_item WHERE cart_id = 'cart_1789620244523_53ipv'");
  console.log('Cart line item details:', JSON.stringify(item.rows, null, 2));
  const cart = await pool.query("SELECT * FROM cart WHERE id = 'cart_1789620244523_53ipv'");
  console.log('Cart details:', JSON.stringify(cart.rows, null, 2));
  await pool.end();
}

inspect().catch(console.error);
