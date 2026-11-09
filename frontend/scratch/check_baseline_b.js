const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

async function main() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const c = await client.query('SELECT COUNT(*) FROM public.company');
  const g = await client.query('SELECT COUNT(*) FROM public.gst_registration');
  const b = await client.query('SELECT COUNT(*) FROM public.bank_account');
  const a = await client.query('SELECT COUNT(*) FROM public.accounting_account');
  const v = await client.query('SELECT COUNT(*) FROM public.accounting_voucher');
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%purchase%'");
  console.log('Purchase tables:', tables.rows.map(r => r.table_name));

  console.log('BASELINE COUNTS:', {
    company: c.rows[0].count,
    gst: g.rows[0].count,
    bank_account: b.rows[0].count,
    accounting_account: a.rows[0].count,
    accounting_voucher: v.rows[0].count
  });

  const vCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_voucher'");
  console.log('accounting_voucher columns:', vCols.rows);

  await client.end();
}

main().catch(console.error);
