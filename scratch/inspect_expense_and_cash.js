const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const expRes = await client.query('SELECT id, description, total, payment_method, status, deleted_at, branch_id FROM public.expense');
  console.log('Expenses count:', expRes.rows.length);
  console.log(JSON.stringify(expRes.rows, null, 2));

  const branches = await client.query('SELECT id, name, code, metadata FROM public.branch LIMIT 5');
  console.log('\nSample branches:', branches.rows);

  await client.end();
}

run().catch(console.error);
