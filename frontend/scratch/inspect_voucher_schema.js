const { Client } = require('../node_modules/pg');
const fs = require('fs');
const path = require('path');

function getDbUrl() {
  const env = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
  for (const line of env.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getDbUrl() });
  await client.connect();

  const res = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.accounting_voucher'::regclass
  `);
  console.log('VOUCHER CONSTRAINTS:', JSON.stringify(res.rows, null, 2));

  await client.end();
}

run().catch(console.error);
