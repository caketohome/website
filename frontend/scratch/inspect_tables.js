const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function run() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('--- purchase_payment columns ---');
  const pp = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_payment'");
  console.log(pp.rows);

  console.log('--- refund columns ---');
  const rf = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'refund'");
  console.log(rf.rows);

  console.log('--- order_lifecycle_refund columns ---');
  const olr = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_lifecycle_refund'");
  console.log(olr.rows);

  await client.end();
}

run().catch(console.error);
