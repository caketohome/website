const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('--- Checking branch metadata for accessory inventory ---');
    const { rows: branchesWithAcc } = await pool.query(`
      SELECT id, name, metadata->'accessory_inventory' as acc_inv
      FROM branch 
      WHERE metadata->'accessory_inventory' IS NOT NULL
    `);
    console.log('Branches with metadata.accessory_inventory:', branchesWithAcc);

    console.log('\n--- Checking setting table for group=catalog ---');
    const { rows: catalogSettings } = await pool.query(`
      SELECT id, "group", key, substring(value from 1 for 60) as preview 
      FROM setting 
      WHERE "group" = 'catalog'
    `);
    console.log('Settings with group=catalog:', catalogSettings);

    console.log('\n--- Checking all setting keys in DB ---');
    const { rows: allSettings } = await pool.query(`SELECT id, "group", key FROM setting`);
    console.log('All settings in DB:', allSettings);

    console.log('\n--- Checking product_variant table for accessories ---');
    const { rows: pvAcc } = await pool.query(`
      SELECT id, product_id, sku, title, metadata 
      FROM product_variant 
      WHERE sku ILIKE '%acc%' OR title ILIKE '%topper%' OR title ILIKE '%candle%'
    `);
    console.log('Product variants matching accessory keywords:', pvAcc);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
