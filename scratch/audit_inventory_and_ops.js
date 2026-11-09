const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== CAKETOHOME INVENTORY & OPERATIONS AUDIT ===\n');

  // 1. All Tables
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('--- 1. Tables in Database ---');
  console.log(tablesRes.rows.map(r => r.table_name));

  // 2. Inventory / Availability Tables Columns
  const targetTables = [
    'branch_inventory',
    'product',
    'product_variant',
    'branch',
    'delivery_zone',
    'order',
    'order_item',
    'order_status_history',
    'product_category',
    'product_collection',
    'inventory_item',
    'inventory_level',
    'product_branch',
    'branch_product',
    'stock_movement',
    'stock_log'
  ];

  for (const t of targetTables) {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    if (cols.rows.length > 0) {
      console.log(`\n--- Schema for [${t}] ---`);
      cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));
    }
  }

  // 3. Inspect sample products and their metadata / PIM configs
  console.log('\n--- 3. Sample Products and PIM metadata ---');
  const prods = await pool.query(`
    SELECT id, title, handle, metadata 
    FROM product 
    WHERE deleted_at IS NULL 
    LIMIT 10
  `);
  for (const p of prods.rows) {
    const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
    console.log(`\nProduct: "${p.title}" (ID: ${p.id}, handle: ${p.handle})`);
    console.log(`  category: ${meta.category || meta.category_slug || 'none'}`);
    console.log(`  pim_config:`, JSON.stringify(meta.pim_config || {}));
    console.log(`  inventory_mode / tracking:`, meta.inventory_mode, meta.track_inventory, meta.is_stock_controlled);
    console.log(`  branch_availability:`, meta.branch_availability ? Object.keys(meta.branch_availability) : 'none');
  }

  // 4. Inspect branch_inventory rows
  console.log('\n--- 4. Sample branch_inventory rows ---');
  const invRows = await pool.query(`
    SELECT * 
    FROM branch_inventory 
    LIMIT 5
  `);
  console.log(invRows.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
