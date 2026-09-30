const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function run() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  const accounts = await client.query(`
    SELECT code, name, type, subtype, is_group 
    FROM public.accounting_account 
    WHERE code IN ('1131', '1132', '1133', '2111', '5240')
    ORDER BY code ASC;
  `);
  console.log('COA ACCOUNTS:', accounts.rows);
  await client.end();
}
run();
