const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
});

async function main() {
  console.log('--- 1. Inspecting scratch/product_master_dump.json ---');
  const dump = JSON.parse(fs.readFileSync('scratch/product_master_dump.json', 'utf8'));
  console.log('Dump summary:', dump.summary);
  console.log('\n22 Active products in master dump:');
  dump.products.filter(p => !p.is_deleted).forEach(p => {
    console.log(`  ${p.id} | ${p.title} | ${p.category} (${p.category_slug}) | price: ${p.price}`);
  });

  console.log('\nSample deleted products in master dump:');
  dump.products.filter(p => p.is_deleted).slice(0, 10).forEach(p => {
    console.log(`  ${p.id} | ${p.title} | deleted_at: ${p.deleted_at}`);
  });

  console.log('\n--- 2. Inspecting live PostgreSQL public.product ---');
  const dbProducts = await pool.query(`
    SELECT id, title, sku, handle, merchandise_type, deleted_at, metadata
    FROM public.product
    ORDER BY created_at ASC;
  `);
  console.log(`Total products in PostgreSQL: ${dbProducts.rows.length}`);
  const activeDbProds = dbProducts.rows.filter(r => r.deleted_at === null);
  const deletedDbProds = dbProducts.rows.filter(r => r.deleted_at !== null);
  console.log(`Active (deleted_at IS NULL): ${activeDbProds.length}`);
  console.log(`Deleted (deleted_at IS NOT NULL): ${deletedDbProds.length}`);

  console.log('\n--- 3. Suspicious / Test / Audit Products in DB ---');
  const suspicious = dbProducts.rows.filter(r => {
    const t = r.title.toLowerCase();
    const id = r.id.toLowerCase();
    return t.includes('test') || t.includes('audit') || t.includes('forensic') ||
           t.includes('debug') || id.includes('audit') || id.includes('test') || id.startsWith('prod_1788');
  });
  console.log(`Total suspicious products: ${suspicious.length}`);
  for (const s of suspicious) {
    const oi = await pool.query('SELECT count(*) FROM order_item WHERE product_id = $1', [s.id]);
    const oli = await pool.query('SELECT count(*) FROM order_line_item WHERE product_id = $1', [s.id]);
    const bi = await pool.query('SELECT count(*) FROM branch_inventory WHERE product_id = $1', [s.id]);
    console.log(`- [${s.id}] "${s.title}" | deleted_at: ${s.deleted_at} | order_items: ${oi.rows[0].count} | order_line_items: ${oli.rows[0].count} | inv: ${bi.rows[0].count}`);
  }

  console.log('\n--- 4. Active GST Registration and Company ---');
  const gstRes = await pool.query('SELECT * FROM gst_registration;');
  console.log('gst_registration rows:', gstRes.rows);
  const compRes = await pool.query('SELECT * FROM company;');
  console.log('company rows:', compRes.rows);

  console.log('\n--- 5. Foreign Key Dependencies on 20 Empty Tables ---');
  const emptyTables = [
    'accounting_fiscal_period', 'accounting_journal_entry', 'accounting_journal_line',
    'cms_homepage_section', 'cms_page', 'customer_address', 'customer_favorite',
    'delivery_zone', 'inventory_cost_consumption', 'inventory_cost_lot', 'inventory_movement',
    'offer', 'order_sequence', 'popup_campaigns', 'popup_versions', 'product_review',
    'purchase', 'purchase_item', 'setting', 'supplier'
  ];

  for (const t of emptyTables) {
    const fkRes = await pool.query(`
      SELECT conname, confrelid::regclass AS referenced_table
      FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'f';
    `, [t]);
    const incomingFkRes = await pool.query(`
      SELECT conname, conrelid::regclass AS referencing_table
      FROM pg_constraint
      WHERE confrelid = $1::regclass AND contype = 'f';
    `, [t]);
    console.log(`Table ${t.padEnd(28)}: outgoing FK: ${fkRes.rows.map(r => r.referenced_table).join(', ') || 'none'} | incoming FK: ${incomingFkRes.rows.map(r => r.referencing_table).join(', ') || 'none'}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
