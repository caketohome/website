const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDatabaseUrl() {
  const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return line.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
}

async function verifyPersistenceAndSync() {
  const client = new Client({ connectionString: getDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("===============================================================================");
  console.log("   CAKETOHOME ERP — ARCHITECTURAL PERSISTENCE & SYNCHRONIZATION AUDIT");
  console.log("===============================================================================\n");

  // 1. Products, Variants & Branch Inventory
  console.log("--- 1. Product & Variant Inventory Sync ---");
  const prodRes = await client.query(`
    SELECT 
      p.id, p.title, p.status,
      COUNT(DISTINCT v.id) as variant_count,
      COUNT(DISTINCT bi.id) as branch_inventory_records,
      COALESCE(SUM(bi.quantity), 0) as total_units_stocked
    FROM public.product p
    LEFT JOIN public.product_variant v ON v.product_id = p.id
    LEFT JOIN public.branch_inventory bi ON bi.product_id = p.id
    WHERE p.deleted_at IS NULL
    GROUP BY p.id, p.title, p.status
    ORDER BY total_units_stocked DESC
    LIMIT 5;
  `);
  console.table(prodRes.rows);

  // 2. Customer Identity & Saved Addresses
  console.log("\n--- 2. Customer Identity & Address Persistence ---");
  const addrTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%address%'");
  console.log("Address tables:", addrTables.rows.map(r => r.table_name));

  const addrTable = addrTables.rows[0]?.table_name || null;
  let custRes;
  if (addrTable) {
    custRes = await client.query(`
      SELECT 
        c.id, c.first_name, c.last_name, c.phone, c.email,
        COUNT(a.id) as address_count
      FROM public.customer c
      LEFT JOIN public.${addrTable} a ON a.customer_id = c.id
      GROUP BY c.id, c.first_name, c.last_name, c.phone, c.email
      ORDER BY address_count DESC
      LIMIT 5;
    `);
  } else {
    custRes = await client.query(`
      SELECT c.id, c.first_name, c.last_name, c.phone, c.email, (c.metadata IS NOT NULL) as has_metadata
      FROM public.customer c
      LIMIT 5;
    `);
  }
  console.table(custRes.rows);

  // 3. Order Lines & Customer Relationship Integrity
  console.log("\n--- 3. Order Lines & Customer Relationship Integrity ---");
  const ordCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'order'");
  console.log("Order columns:", ordCols.rows.map(r => r.column_name));
  const itemTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%order_item%' OR table_name LIKE '%line_item%'");
  console.log("Order item tables:", itemTables.rows.map(r => r.table_name));
  const ordRes = await client.query(`
    SELECT 
      o.id, o.display_id, o.customer_id, o.status, o.currency_code, o.created_at
    FROM public."order" o
    ORDER BY o.created_at DESC
    LIMIT 5;
  `);
  console.table(ordRes.rows);

  // 4. Delivery Handovers & Partner Assignments
  console.log("\n--- 4. Delivery Handovers & Partner Assignments ---");
  const hndCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'delivery_cash_handover'");
  console.log("Handover columns:", hndCols.rows.map(r => r.column_name));
  const hndRes = await client.query(`
    SELECT *
    FROM public.delivery_cash_handover
    ORDER BY created_at DESC
    LIMIT 5;
  `);
  console.table(hndRes.rows.map(r => ({
    id: r.id,
    handover_code: r.handover_code || r.code || r.id,
    status: r.status,
    amount: r.amount || r.total_amount || r.collected_amount,
    created_at: r.created_at
  })));

  // 5. Expense Approval & Cash Custody
  console.log("\n--- 5. Expense Approval & Cash Custody Trace ---");
  const expRes = await client.query(`
    SELECT id, reference_no, branch_id, total, status, payment_method, voucher_id, created_at
    FROM public.expense
    ORDER BY created_at DESC
    LIMIT 5;
  `);
  console.table(expRes.rows);

  // 6. Tax Master Configurations
  console.log("\n--- 6. Statutory Tax Master Configurations ---");
  const taxRes = await client.query(`
    SELECT *
    FROM public.tax_rate
    ORDER BY rate ASC;
  `);
  console.table(taxRes.rows.map(r => ({
    id: r.id,
    name: r.name,
    code: r.code,
    rate: `${r.rate}%`,
    created_at: r.created_at
  })));

  await client.end();
}

verifyPersistenceAndSync().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
