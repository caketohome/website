const fs = require('fs');
const { Client } = require('../frontend/node_modules/pg');

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

  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'accounting_journal_line'
  `);
  console.log('accounting_journal_line columns:', cols.rows);

  const lines = await client.query(`SELECT * FROM public.accounting_journal_line`);
  console.log('all journal lines:', lines.rows);

  await client.end();
}

run().catch(console.error);
