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

  console.log('--- JOURNAL ENTRIES ---');
  const je = await client.query('SELECT * FROM public.accounting_journal_entry');
  console.log(JSON.stringify(je.rows, null, 2));

  console.log('--- JOURNAL LINES WITH ACCOUNTS ---');
  const jl = await client.query(`
    SELECT jl.id, jl.entry_id, a.code, a.name, a.type, jl.debit_amount, jl.credit_amount, jl.narration
    FROM public.accounting_journal_line jl
    JOIN public.accounting_account a ON jl.account_id = a.id
    ORDER BY jl.entry_id, jl.id
  `);
  console.log(JSON.stringify(jl.rows, null, 2));

  await client.end();
}

run().catch(console.error);
