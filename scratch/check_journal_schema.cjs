const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function run() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounting_journal_entry' ORDER BY ordinal_position");
  console.log('accounting_journal_entry cols:', cols.rows.map(r => r.column_name));
  const sample = await c.query("SELECT * FROM public.accounting_journal_entry LIMIT 2");
  console.log('sample rows:', sample.rows);
  await c.end();
}

run().catch(console.error);
