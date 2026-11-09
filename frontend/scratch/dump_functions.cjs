const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let envFile = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envFile)) envFile = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envFile, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const funcs = ['allocate_invoice_number', 'allocate_order_number', 'commit_invoice_allocation', 'void_invoice_allocation'];
  for (const f of funcs) {
    const res = await client.query(`
      SELECT pg_get_functiondef(oid) as def 
      FROM pg_proc 
      WHERE proname = $1 AND pronamespace = 'public'::regnamespace;
    `, [f]);
    console.log('=== ' + f + ' ===');
    console.log(res.rows[0]?.def || 'NOT FOUND');
  }

  await client.end();
}
run().catch(console.error);
