const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const allTables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  
  const tables = allTables.rows.map(r => r.table_name);
  console.log('Total public tables in PostgreSQL:', tables.length);
  
  const inventoryTables = tables.filter(t => t.includes('invent') || t.includes('stock'));
  console.log('Inventory/Stock tables:', inventoryTables);

  const branchTables = tables.filter(t => t.includes('branch'));
  console.log('Branch tables:', branchTables);

  const productTables = tables.filter(t => t.includes('product'));
  console.log('Product tables:', productTables);

  const orderTables = tables.filter(t => t.includes('order'));
  console.log('Order tables:', orderTables);

  const forbiddenTerms = ['grn', 'gnr', 'party', 'ledger', 'account', 'b2b', 'btb', 'teller'];
  const forbiddenTables = tables.filter(t => forbiddenTerms.some(term => t.toLowerCase().includes(term)));
  console.log('Any tables matching ERP terms (grn/party/ledger/account/b2b/teller):', forbiddenTables);

  // Check branch table columns and metadata structure
  const branchMeta = await pool.query(`
    SELECT id, name, code, metadata 
    FROM branch 
    WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object'
    LIMIT 3;
  `);
  console.log('Branch metadata examples:', branchMeta.rows.map(r => ({
    id: r.id,
    name: r.name,
    keys: r.metadata ? Object.keys(r.metadata) : []
  })));

  // Check how many rows in branch_inventory
  const biCount = await pool.query(`SELECT count(*) FROM branch_inventory;`);
  console.log('Total rows in branch_inventory:', biCount.rows[0].count);

  await pool.end();
}

main().catch(console.error);
