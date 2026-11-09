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

async function checkMoreTables() {
  const client = await pool.connect();
  try {
    const targetTables = ['purchase_payment', 'payment', 'order', 'customer_receipt', 'receipt', 'invoice'];
    for (const t of targetTables) {
      const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [t]);
      if (res.rows.length === 0) {
        console.log(`Table '${t}' DOES NOT EXIST`);
        continue;
      }
      const count = await client.query(`SELECT count(*)::int as cnt FROM public."${t}"`);
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      console.log(`\nTABLE: ${t} (Count: ${count.rows[0].cnt})`);
      for (const c of cols.rows) {
        console.log(`  - ${c.column_name}: ${c.data_type} (null: ${c.is_nullable}, def: ${c.column_default})`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkMoreTables().catch(console.error);
