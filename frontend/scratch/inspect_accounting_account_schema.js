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
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_account'
    ORDER BY ordinal_position;
  `);

  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'accounting_account';
  `);

  const indexes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'accounting_account';
  `);

  console.log("=== ACCOUNTING_ACCOUNT COLUMNS ===");
  console.log(JSON.stringify(cols.rows, null, 2));

  console.log("=== ACCOUNTING_ACCOUNT CONSTRAINTS ===");
  console.log(JSON.stringify(constraints.rows, null, 2));

  console.log("=== ACCOUNTING_ACCOUNT INDEXES ===");
  console.log(JSON.stringify(indexes.rows, null, 2));

  await client.end();
}

run().catch(console.error);
