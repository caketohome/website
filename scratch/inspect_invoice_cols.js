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
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoice'
    ORDER BY ordinal_position
  `);
  console.log('Columns of public.invoice:', cols.rows.map(r => r.column_name).join(', '));
  const res = await client.query('SELECT * FROM public.invoice LIMIT 2');
  console.log('Sample invoice row:', JSON.stringify(res.rows[0], null, 2));
  await client.end();
}
run().catch(console.error);
