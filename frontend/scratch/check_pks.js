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

async function checkPKs() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  const res = await client.query(`
    SELECT
      tc.table_name, kcu.column_name
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name IN ('product', 'product_variant', 'branch', 'supplier', 'purchase', 'purchase_item');
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
checkPKs().catch(console.error);
