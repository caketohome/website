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
  const expRes = await client.query('SELECT id, description, category_id, payment_method, subtotal, cgst, sgst, total, status FROM public.expense');
  console.log('Expenses in DB:');
  console.table(expRes.rows);

  // Check teller session tables
  const tellerTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND table_name LIKE '%teller%'
  `);
  console.log('Teller tables:', tellerTables.rows);
  for (const t of tellerTables.rows) {
    const r = await client.query(`SELECT * FROM public.${t.table_name}`);
    console.log(`Table ${t.table_name}:`);
    console.table(r.rows);
  }

  await client.end();
}

run();
