const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const mappingPath = path.join(__dirname, 'accessory_product_migration_mapping.json');
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- STARTING TRANSACTION ---');

    // 1. Double-check for any collision
    const ids = mapping.map(m => m.proposed_product_id);
    const existing = await client.query('SELECT id, title FROM product WHERE id = ANY($1)', [ids]);
    if (existing.rows.length > 0) {
      throw new Error(`Collision detected: Products already exist: ${JSON.stringify(existing.rows)}`);
    }

    // 2. Ensure product_category row for accessories exists if needed
    const catCheck = await client.query("SELECT id FROM product_category WHERE id = 'cat_accessories' OR handle = 'accessories'");
    if (catCheck.rows.length === 0) {
      console.log('Inserting product_category cat_accessories...');
      await client.query(`
        INSERT INTO product_category (id, name, description, handle, mpath, is_active, is_internal, rank, created_at, updated_at)
        VALUES ('cat_accessories', 'Accessories', 'Celebration & Cake Accessories', 'accessories', 'cat_accessories', true, false, 99, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    // 3. Insert each product and its default variant
    for (const m of mapping) {
      console.log(`Inserting product ${m.proposed_product_id} (${m.title})...`);
      const weightNumeric = parseFloat(String(m.weight || '50').replace(/[^0-9.]/g, '')) / 1000 || 0.05;

      const metadata = {
        price: m.selling_price,
        selling_price: m.selling_price,
        cost_price: m.cost_price,
        mrp: m.mrp,
        category: m.category,
        category_slug: m.category_slug,
        primary_category_id: 'cat_accessories',
        sku: m.sku,
        low_stock_threshold: m.low_stock_threshold,
        weight: m.weight,
        gst_rate: m.gst_rate,
        tax_class: m.gst_rate === 5 ? 'GST_FOOD_5' : (m.gst_rate === 12 ? 'GST_FOOD_12' : 'GST_STANDARD_18'),
        hsn_code: '95059000',
        uqc: 'NOS',
        taxability: 'Taxable',
        tax_inclusive: true,
        pim_config: {
          inventory_mode: m.inventory_mode,
          show_weight: false,
          required_weight: false,
          show_flavour: false,
          show_shape: false
        }
      };

      await client.query(`
        INSERT INTO product (
          id, title, handle, description, thumbnail, status, weight, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
      `, [
        m.proposed_product_id,
        m.title,
        m.handle,
        m.description,
        m.thumbnail,
        m.status,
        weightNumeric,
        JSON.stringify(metadata)
      ]);

      console.log(`Inserting product_variant ${m.proposed_variant_id} for ${m.proposed_product_id}...`);
      await client.query(`
        INSERT INTO product_variant (
          id, product_id, title, sku, barcode, manage_inventory, allow_backorder, weight, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, true, false, $6, $7, NOW(), NOW()
        )
      `, [
        m.proposed_variant_id,
        m.proposed_product_id,
        'Default',
        m.sku,
        m.barcode || null,
        weightNumeric,
        JSON.stringify({
          price: m.selling_price,
          cost_price: m.cost_price,
          low_stock_threshold: m.low_stock_threshold
        })
      ]);
    }

    await client.query('COMMIT');
    console.log('--- TRANSACTION COMMITTED SUCCESSFULLY ---');

    // 4. Verification query
    const verifyProducts = await client.query(`
      SELECT p.id, p.title, p.handle, pv.id as variant_id, pv.sku, p.metadata->'pim_config'->>'inventory_mode' as inv_mode, (p.metadata->>'selling_price')::numeric as price
      FROM product p
      JOIN product_variant pv ON pv.product_id = p.id
      WHERE p.id = ANY($1)
      ORDER BY p.id ASC;
    `, [ids]);
    console.log('Verified inserted products & variants in PostgreSQL:');
    console.table(verifyProducts.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
