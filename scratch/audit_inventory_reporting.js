const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== 1. DATABASE TABLES AUDIT ===');
  const allTables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('All public tables:', allTables.rows.map(r => r.table_name));

  // Find tables matching inventory, stock, branch, product, availability, order, report, account, party, grn
  const matching = allTables.rows.map(r => r.table_name).filter(t => 
    t.includes('invent') || t.includes('stock') || t.includes('branch') || 
    t.includes('avail') || t.includes('party') || t.includes('grn') || 
    t.includes('account') || t.includes('ledger') || t.includes('b2b') ||
    t.includes('report') || t.includes('sale')
  );
  console.log('Relevant tables found:', matching);

  console.log('\n=== 2. BRANCH TABLE SCHEMA ===');
  const branchCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'branch'
    ORDER BY ordinal_position;
  `);
  console.log('Branch columns:', branchCols.rows.map(r => `${r.column_name} (${r.data_type})`));

  console.log('\n=== 3. BRANCH INVENTORY TABLE SCHEMA ===');
  const biCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'branch_inventory'
    ORDER BY ordinal_position;
  `);
  console.log('BranchInventory columns:', biCols.rows.map(r => `${r.column_name} (${r.data_type})`));

  const sampleBi = await pool.query(`
    SELECT * FROM branch_inventory LIMIT 10;
  `);
  console.log('Sample branch_inventory rows:', sampleBi.rows);

  const sampleOrders = await pool.query(`
    SELECT id, display_id, status, metadata, created_at 
    FROM "order" 
    ORDER BY created_at DESC 
    LIMIT 5;
  `);
  console.log('Sample orders:', sampleOrders.rows.map(o => ({
    id: o.id,
    display_id: o.display_id,
    status: o.status,
    created_at: o.created_at,
    branch_id: o.metadata?.branch_id,
    items_count: o.metadata?.items?.length,
    metadata_keys: o.metadata ? Object.keys(o.metadata) : []
  })));
  if (sampleOrders.rows[0]?.metadata) {
    console.log('Latest order metadata detail:', JSON.stringify(sampleOrders.rows[0].metadata, null, 2));
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
