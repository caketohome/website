const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'invoice_sequence'
  `);
  console.log('invoice_sequence columns:', res.rows.map(r => r.column_name));
  const rows = await client.query('SELECT * FROM public.invoice_sequence');
  console.log('invoice_sequence rows:', rows.rows);
  await client.end();
}
main().catch(console.error);
