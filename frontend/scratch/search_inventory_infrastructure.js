const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function searchTables() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (
        table_name ILIKE '%inventory%' 
        OR table_name ILIKE '%stock%' 
        OR table_name ILIKE '%movement%'
        OR table_name ILIKE '%consumption%'
        OR table_name ILIKE '%ledger%'
      )
    ORDER BY table_name;
  `);
  console.log('TABLES MATCHING inventory/stock/movement/consumption/ledger:');
  console.log(JSON.stringify(res.rows.map(r => r.table_name), null, 2));

  // Inspect columns of branch_inventory
  const biCols = await client.query(`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'branch_inventory'
    ORDER BY ordinal_position;
  `);
  console.log('\nCOLUMNS OF branch_inventory:');
  console.log(JSON.stringify(biCols.rows, null, 2));

  await client.end();
}
searchTables().catch(console.error);
