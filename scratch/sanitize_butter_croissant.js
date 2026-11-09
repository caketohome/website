const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== 1. FETCH CURRENT BUTTER CROISSANT ===');
  const res = await pool.query("SELECT id, title, handle, weight, metadata FROM product WHERE handle = 'butter-croissant' OR id = 'prod_01KXYMAJKNS8AGWCN5S1WEGKSD'");
  if (res.rows.length === 0) {
    console.error('Butter Croissant not found!');
    process.exit(1);
  }
  const row = res.rows[0];
  console.log('Current row:', {
    id: row.id,
    title: row.title,
    handle: row.handle,
    weight: row.weight,
    metadata: row.metadata,
  });

  console.log('=== 2. SANITIZE METADATA ===');
  const meta = row.metadata || {};
  
  // Remove "1 pc" weight and fake weight_prices
  delete meta.weight;
  meta.weight_prices = [];
  
  // Set pim_config to not show or require weight
  meta.pim_config = {
    ...(meta.pim_config || {}),
    show_weight: false,
    required_weight: false,
    show_cake_message: false,
    required_cake_message: false,
    show_photo_cake: false,
    required_photo_cake: false,
  };

  // Ensure authoritative pricing
  meta.price = 149;
  meta.selling_price = 149;
  meta.mrp = 199;
  meta.price_correction_source = 'canonical_catalog_integrity_fix';
  meta.price_updated_at = new Date().toISOString();

  console.log('New metadata to write:', meta);

  const updateRes = await pool.query(
    `UPDATE product 
     SET weight = NULL, metadata = $1, updated_at = NOW() 
     WHERE id = $2 
     RETURNING id, title, weight, metadata`,
    [JSON.stringify(meta), row.id]
  );

  console.log('=== 3. VERIFY UPDATE ===');
  console.log('Updated row:', updateRes.rows[0]);

  console.log('=== 4. VERIFY PRODUCT VARIANT FOR CROISSANT ===');
  const varRes = await pool.query("SELECT id, product_id, title, sku, weight, metadata FROM product_variant WHERE product_id = $1", [row.id]);
  console.log('Variants in DB:', varRes.rows);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
