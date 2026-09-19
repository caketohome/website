const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function inspectProductRecords() {
  console.log('=== INSPECTING DATABASE PRODUCT & VARIANT RECORDS ===\n');

  // 1. Inspect Products
  const productsRes = await pool.query(`
    SELECT id, title, handle, description, thumbnail, status, weight, metadata, created_at, updated_at
    FROM "product"
    WHERE handle IN ('butter-croissant', 'chocolate-fudge-cupcake')
       OR id IN ('prod_butter_croissant', 'prod_chocolate_fudge_cupcake')
       OR title ILIKE '%croissant%'
       OR title ILIKE '%cupcake%'
  `);

  console.log(`Found ${productsRes.rows.length} matching product records in "product" table:`);
  for (const row of productsRes.rows) {
    console.log('\n----------------------------------------');
    console.log('ID:', row.id);
    console.log('Title:', row.title);
    console.log('Handle:', row.handle);
    console.log('Weight (column):', row.weight);
    console.log('Status:', row.status);
    console.log('Metadata keys:', Object.keys(row.metadata || {}));
    console.log('Metadata price:', row.metadata?.price);
    console.log('Metadata selling_price:', row.metadata?.selling_price);
    console.log('Metadata weight:', row.metadata?.weight);
    console.log('Metadata unit:', row.metadata?.unit);
    console.log('Metadata weights:', row.metadata?.weights);
    console.log('Metadata weight_prices:', JSON.stringify(row.metadata?.weight_prices));
    console.log('Metadata pim_config:', JSON.stringify(row.metadata?.pim_config));
    console.log('Metadata variants_json:', JSON.stringify(row.metadata?.variants_json));
  }

  // 2. Check if product_variant table exists and has rows
  try {
    const variantsRes = await pool.query(`
      SELECT * FROM "product_variant"
      WHERE product_id IN (SELECT id FROM "product" WHERE handle IN ('butter-croissant', 'chocolate-fudge-cupcake') OR title ILIKE '%croissant%' OR title ILIKE '%cupcake%')
    `);
    console.log(`\nFound ${variantsRes.rows.length} records in "product_variant" table:`);
    for (const v of variantsRes.rows) {
      console.log('Variant:', v);
    }
  } catch (err) {
    console.log('\nQuery "product_variant" table error or not exists:', err.message);
  }

  // 3. Check variant_option table
  try {
    const voRes = await pool.query(`
      SELECT * FROM "variant_option" WHERE deleted_at IS NULL
    `);
    console.log(`\nFound ${voRes.rows.length} records in "variant_option" table:`);
    for (const vo of voRes.rows) {
      console.log(`- [${vo.type}] ${vo.name} (${vo.display_name}) price_modifier: ${vo.price_modifier}`);
    }
  } catch (err) {
    console.log('\nQuery "variant_option" table error:', err.message);
  }

  // 4. Check product_option table
  try {
    const poRes = await pool.query(`
      SELECT * FROM "product_option"
      WHERE product_id IN (SELECT id FROM "product" WHERE handle IN ('butter-croissant', 'chocolate-fudge-cupcake') OR title ILIKE '%croissant%' OR title ILIKE '%cupcake%')
    `);
    console.log(`\nFound ${poRes.rows.length} records in "product_option" table:`);
    for (const po of poRes.rows) {
      console.log('Product Option:', po);
    }
  } catch (err) {
    console.log('\nQuery "product_option" table error or not exists:', err.message);
  }

  await pool.end();
  process.exit(0);
}

inspectProductRecords().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
