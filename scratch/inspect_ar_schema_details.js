const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== public.invoice Schema ===');
  const invCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'invoice' 
    ORDER BY ordinal_position
  `);
  console.table(invCols.rows);

  console.log('=== public.customer_receipt_allocation Schema ===');
  const craCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'customer_receipt_allocation' 
    ORDER BY ordinal_position
  `);
  console.table(craCols.rows);

  console.log('=== Customer Receipts / Payments Tables ===');
  const crCols = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND (table_name LIKE '%receipt%' OR table_name LIKE '%credit_note%')
  `);
  console.table(crCols.rows);

  for (const t of crCols.rows) {
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = '${t.table_name}' ORDER BY ordinal_position
    `);
    console.log(`Columns for ${t.table_name}:`, cols.rows.map(c => c.column_name).join(', '));
  }

  await client.end();
}

run();
