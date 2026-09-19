const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const pvConstraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'product_variant';
    `);
    console.log('--- PRODUCT_VARIANT CONSTRAINTS ---');
    console.table(pvConstraints.rows);

    const checkSkus = [
      'ACC-TOP-GOLD', 'ACC-CAN-MAGIC', 'ACC-CRD-HAND', 'ACC-FLW-ROSE10',
      'ACC-TOY-TEDDY', 'ACC-CHO-FER16', 'ACC-BAL-HEL', 'ACC-HMP-LUX'
    ];
    const existingPv = await pool.query(`
      SELECT id, product_id, sku, title FROM product_variant WHERE sku = ANY($1) OR id LIKE 'acc_%' OR id LIKE 'var_acc_%';
    `, [checkSkus]);
    console.log('Existing variants matching SKUs/IDs:', existingPv.rows);

    const checkIds = ['acc_01', 'acc_02', 'acc_03', 'acc_04', 'acc_05', 'acc_06', 'acc_07', 'acc_08'];
    const existingP = await pool.query(`
      SELECT id, title, handle FROM product WHERE id = ANY($1) OR id LIKE 'acc_%' OR id LIKE 'prod_acc_%';
    `, [checkIds]);
    console.log('Existing products matching IDs:', existingP.rows);

    const titles = [
      'Gold Acrylic Happy Birthday Topper', 'Magic Re-Lighting Birthday Candles (Pack of 10)',
      'Custom Handwritten Greeting Card', 'Fresh Bouquet of 10 Red Roses',
      'Soft Plush Brown Teddy Bear (8-Inch)', 'Ferrero Rocher Chocolate Box (16 Pieces)',
      'Helium Foil Metallic Balloon Bouquet (Bunch of 5)', 'Royal Celebration Luxury Gift Basket'
    ];
    const existingTitles = await pool.query(`SELECT id, title FROM product WHERE title = ANY($1)`, [titles]);
    console.log('Existing products matching titles:', existingTitles.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
