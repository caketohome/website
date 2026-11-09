const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^DATABASE_URL\s*=\s*["']?([^\r\n"']+)["']?/m);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

async function runSyncAudit() {
  const dbUrl = getDbUrl();
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    console.log('=============================================================================');
    console.log('CakeToHome ERP — Comprehensive Database Entity Synchronization Audit');
    console.log('=============================================================================\n');

    // 1. Branches Audit
    console.log('[1] BRANCH SYNCHRONIZATION:');
    const branchRes = await client.query(`
      SELECT b.id, b.name, b.code, b.is_active, b.city_id, c.name AS city_name
      FROM branch b
      LEFT JOIN city c ON c.id = b.city_id
      ORDER BY b.is_active DESC, b.name ASC
      LIMIT 10;
    `);
    const branchCountRes = await client.query(`
      SELECT 
        count(*) AS total_branches,
        count(*) FILTER (WHERE is_active = true) AS active_branches,
        count(*) FILTER (WHERE city_id IS NULL) AS branches_without_city
      FROM branch;
    `);
    console.log('  Summary:', branchCountRes.rows[0]);
    console.log('  Sample Branches:');
    console.table(branchRes.rows);

    // 2. Products & Variants Audit
    console.log('\n[2] PRODUCTS & INVENTORY SYNCHRONIZATION:');
    const prodCountRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM product) AS total_products,
        (SELECT count(*) FROM product WHERE status = 'published') AS published_products,
        (SELECT count(*) FROM product_variant) AS total_variants,
        (SELECT count(*) FROM product_variant WHERE sku IS NULL OR sku = '') AS variants_missing_sku,
        (SELECT count(*) FROM product p WHERE NOT EXISTS (SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id)) AS products_without_variants;
    `);
    console.log('  Summary:', prodCountRes.rows[0]);

    // Check tax master assignment on products
    const taxLinkageRes = await client.query(`
      SELECT 
        count(*) AS total_products,
        count(*) FILTER (WHERE metadata->>'tax_rate_id' IS NOT NULL) AS products_with_tax_rate,
        count(*) FILTER (WHERE metadata->>'hsn_code' IS NOT NULL) AS products_with_hsn
      FROM product;
    `);
    console.log('  Tax Master Product Linkage:', taxLinkageRes.rows[0]);

    // 3. Orders Synchronization & Consistency
    console.log('\n[3] ORDERS & STATUS TRANSITIONS:');
    const orderStatusRes = await client.query(`
      SELECT 
        status, 
        count(*) AS order_count,
        sum(total) AS total_value
      FROM orders
      GROUP BY status
      ORDER BY order_count DESC;
    `);
    console.table(orderStatusRes.rows);

    // Check orphaned order items
    const orphanedItemsRes = await client.query(`
      SELECT 
        count(*) AS total_order_items,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = oi.order_id)) AS orphaned_order_items,
        count(*) FILTER (WHERE variant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_variant pv WHERE pv.id = oi.variant_id)) AS items_referencing_deleted_variants
      FROM order_items oi;
    `);
    console.log('  Order Items Referential Check:', orphanedItemsRes.rows[0]);

    // 4. Branch Inventory & Stock Movement
    console.log('\n[4] INVENTORY MOVEMENTS & STOCK CONSISTENCY:');
    let invTable = 'inventory_level';
    try {
      const invCheck = await client.query(`SELECT count(*) FROM inventory_level;`);
      console.log('  inventory_level rows:', invCheck.rows[0].count);
    } catch {
      console.log('  inventory_level table not present, checking alternative inventory tables...');
      const altTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE '%inventory%' OR table_name LIKE '%stock%';
      `);
      console.log('  Available inventory/stock tables:', altTables.rows.map(r => r.table_name));
    }

    // 5. Customer & Partner Isolation
    console.log('\n[5] CUSTOMERS & DELIVERY PARTNERS:');
    const custRes = await client.query(`
      SELECT 
        count(*) AS total_customers,
        count(*) FILTER (WHERE phone IS NULL OR phone = '') AS customers_without_phone,
        count(*) FILTER (WHERE email IS NULL OR email = '') AS customers_without_email
      FROM customer;
    `);
    console.log('  Customers Summary:', custRes.rows[0]);

    const delivRes = await client.query(`
      SELECT 
        count(*) AS total_partners,
        count(*) FILTER (WHERE is_active = true) AS active_partners
      FROM delivery_partner;
    `);
    console.log('  Delivery Partners Summary:', delivRes.rows[0]);

    // 6. Referential Integrity & Foreign Key Audit
    console.log('\n[6] REFERENTIAL INTEGRITY AUDIT:');
    const fkChecks = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('orders', 'order_items', 'branch', 'product_variant', 'invoices', 'journal_lines')
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.log(`  Found ${fkChecks.rows.length} explicit Foreign Keys on core tables:`);
    console.table(fkChecks.rows);

    // 7. Double-Entry Financial Equilibrium Assertion
    console.log('\n[7] FINANCIAL EQUILIBRIUM & TRIAL BALANCE:');
    const tbRes = await client.query(`
      SELECT 
        SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) AS total_debits,
        SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) AS total_credits,
        SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE -amount END) AS net_imbalance
      FROM journal_lines;
    `);
    console.log('  Journal Lines Ledger Equilibrium:', tbRes.rows[0]);

    // Quarantined Invoices Check
    const qRes = await client.query(`
      SELECT invoice_number, status, is_posted, total_amount
      FROM invoices
      WHERE invoice_number IN ('CTH/26-27/000031','CTH/26-27/000032','CTH/26-27/000033','CTH/26-27/000034','CTH/26-27/000035')
      ORDER BY invoice_number ASC;
    `);
    console.log('  Quarantined Invoices Status (Must be UNPOSTED):');
    console.table(qRes.rows);

    console.log('\nAudit complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

runSyncAudit().catch(err => {
  console.error('Audit encountered error:', err);
});
