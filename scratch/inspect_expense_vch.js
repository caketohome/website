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

  const v = await client.query("SELECT * FROM public.accounting_voucher WHERE id = 'vch_00MUV2R8CL99MMI0'");
  console.log('Voucher vch_00MUV2R8CL99MMI0:', v.rows[0]);

  const vl = await client.query("SELECT * FROM public.accounting_voucher_line WHERE voucher_id = 'vch_00MUV2R8CL99MMI0'");
  console.log('Voucher lines:');
  console.table(vl.rows);

  const j = await client.query("SELECT * FROM public.accounting_journal_entry WHERE voucher_id = 'vch_00MUV2R8CL99MMI0'");
  console.log('Journal Entry:', j.rows[0]);

  const jl = await client.query("SELECT * FROM public.accounting_journal_line WHERE journal_entry_id = $1", [j.rows[0]?.id]);
  console.log('Journal Lines:');
  console.table(jl.rows);

  await client.end();
}

run();
