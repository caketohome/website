const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  console.log('=== PRODUCT QUERY FOR CROISSANT & CUPCAKE ===');
  const res = await pool.query(`
    SELECT id, title, handle, thumbnail, metadata 
    FROM product 
    WHERE title ILIKE '%croissant%' OR title ILIKE '%cupcake%' OR handle ILIKE '%croissant%' OR handle ILIKE '%cupcake%'
  `);
  for (const row of res.rows) {
    console.log(`Product: ${row.title} (ID: ${row.id}, Handle: ${row.handle})`);
    console.log(`  Metadata:`, JSON.stringify(row.metadata));
  }

  console.log('\n=== VARIANTS FOR THESE PRODUCTS ===');
  const variants = await pool.query(`
    SELECT pv.id, pv.title, pv.product_id, pv.sku, pv.metadata
    FROM product_variant pv
    WHERE pv.product_id IN (
      SELECT id FROM product 
      WHERE title ILIKE '%croissant%' OR title ILIKE '%cupcake%' OR handle ILIKE '%croissant%' OR handle ILIKE '%cupcake%'
    )
  `);
  for (const v of variants.rows) {
    console.log(`Variant: ${v.title} (ID: ${v.id}, ProductID: ${v.product_id})`);
    console.log(`  Metadata:`, JSON.stringify(v.metadata));
  }

  console.log('\n=== CHECK CART_LINE_ITEM FOR CROISSANT OR CUPCAKE ===');
  const lineItems = await pool.query(`
    SELECT id, cart_id, title, quantity, unit_price, raw_unit_price, metadata, created_at
    FROM cart_line_item
    WHERE title ILIKE '%croissant%' OR title ILIKE '%cupcake%'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  for (const li of lineItems.rows) {
    console.log(`LineItem: "${li.title}" | Cart: ${li.cart_id} | Qty: ${li.quantity} | UnitPrice: ₹${li.unit_price} | Raw: ${JSON.stringify(li.raw_unit_price)} | Created: ${li.created_at}`);
  }

  await pool.end();
}

check().catch(console.error);
