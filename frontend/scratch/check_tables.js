const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log("Total tables in public schema:", res.rows.length);
    console.log(res.rows.map(r => r.table_name));

    // Check specific tables
    const checkNames = ['purchase_payment', 'customer_payment', 'payment', 'bill', 'bills_payable', 'bills_receivable', 'purchase', 'purchase_item', 'customer', 'supplier', 'orders'];
    for (const name of checkNames) {
      const exists = res.rows.some(r => r.table_name === name);
      console.log(`Table '${name}' exists: ${exists}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
