const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
let connStr = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connStr = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}
(async () => {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== EQUITY Accounts ===');
  const r = await client.query("SELECT id, code, name, type, subtype, is_group, level FROM public.accounting_account WHERE type = 'EQUITY' AND deleted_at IS NULL ORDER BY code");
  console.log(JSON.stringify(r.rows, null, 2));
  console.log('\n=== Setting table columns ===');
  const r2 = await client.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'setting' AND table_schema = 'public' ORDER BY ordinal_position");
  console.log(JSON.stringify(r2.rows, null, 2));
  console.log('\n=== VoucherCreateInput createDraft signature ===');
  const r3 = await client.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'accounting_voucher' AND table_schema = 'public' ORDER BY ordinal_position");
  console.log(JSON.stringify(r3.rows, null, 2));
  await client.end();
})();
