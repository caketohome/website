const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('--- 1. branch_inventory Inspection ---');
    const { rows: invCount } = await pool.query('SELECT COUNT(*) FROM branch_inventory');
    console.log('branch_inventory total rows:', invCount[0].count);

    const { rows: invSample } = await pool.query('SELECT * FROM branch_inventory LIMIT 5');
    console.log('branch_inventory sample:', invSample);

    console.log('\n--- 2. Setting Table Inspection for Accessories / Inventory ---');
    const { rows: settingRows } = await pool.query(`
      SELECT key, substring(value from 1 for 100) as val_sample
      FROM setting 
      WHERE key ILIKE '%accessor%' OR key ILIKE '%catalog%' OR key ILIKE '%inventory%'
    `);
    console.log('Settings matching keywords:', settingRows);

    const { rows: accSetting } = await pool.query(`SELECT value FROM setting WHERE key = 'catalog.accessories'`);
    if (accSetting.length > 0) {
      const parsed = JSON.parse(accSetting[0].value);
      console.log('catalog.accessories count:', parsed.length);
      console.log('catalog.accessories all items:', JSON.stringify(parsed, null, 2));
    } else {
      console.log('No setting found for catalog.accessories');
    }

    console.log('\n--- 3. Product Table Accessories Inspection ---');
    const { rows: prodAcc } = await pool.query(`
      SELECT id, title, handle, metadata->>'category_slug' as cat_slug, metadata->'pim_config'->>'inventory_mode' as inv_mode,
             metadata->>'price' as meta_price, price, selling_price
      FROM product 
      WHERE metadata->>'category_slug' = 'accessories' 
         OR title ILIKE '%topper%' 
         OR title ILIKE '%candle%'
         OR title ILIKE '%card%'
    `);
    console.log(`Products matching accessory criteria (count: ${prodAcc.length}):`, prodAcc);

    console.log('\n--- 4. Inventory-related tables in schema ---');
    const { rows: invTables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name ILIKE '%inventory%' OR table_name ILIKE '%stock%' OR table_name ILIKE '%accessory%')
    `);
    console.log('Tables matching inventory/stock/accessory:', invTables.map(t => t.table_name));

    console.log('\n--- 5. Branch Table Metadata for Accessory Inventory ---');
    const { rows: branchSample } = await pool.query(`
      SELECT id, name, 
             metadata->'inventory' as meta_inventory,
             metadata->'accessories' as meta_accessories,
             metadata->'accessory_inventory' as meta_acc_inv,
             metadata->'stock' as meta_stock
      FROM branch 
      LIMIT 3
    `);
    console.log('Branch metadata sample:', branchSample);

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await pool.end();
  }
}

main();
