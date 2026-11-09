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

  console.log('--- ALL ROWS IN public.expense (INCLUDING DELETED) ---');
  const allExps = await client.query(`SELECT id, description, total, payment_method, status, deleted_at, voucher_id FROM public.expense`);
  console.table(allExps.rows);

  console.log('\n--- CHECK JOURNAL ENTRIES FOR ALL VOUCHERS ---');
  const jeAll = await client.query(`
    SELECT v.id, v.voucher_no, v.status, count(je.id) as je_count 
    FROM public.accounting_voucher v
    LEFT JOIN public.accounting_journal_entry je ON je.voucher_id = v.id
    GROUP BY v.id, v.voucher_no, v.status
    ORDER BY v.created_at
  `);
  console.table(jeAll.rows);

  await client.end();
}

run().catch(console.error);
