const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
let conn = '';
for (const l of env.split('\n')) {
  if (l.startsWith('DATABASE_URL=')) {
    conn = l.substring(13).trim().replace(/^['"]|['"]$/g, '');
  }
}

const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
client.connect().then(async () => {
  const v = await client.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'accounting_voucher' ORDER BY ordinal_position");
  console.log('VOUCHER COLS:', v.rows);
  const j = await client.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'accounting_journal_entry' ORDER BY ordinal_position");
  console.log('JOURNAL COLS:', j.rows);
  const l = await client.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'accounting_journal_line' ORDER BY ordinal_position");
  console.log('LINE COLS:', l.rows);
  await client.end();
}).catch(console.error);
