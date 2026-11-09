const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = process.env.DATABASE_URL || 'postgresql://[REDACTED_USER]:[REDACTED_SECRET]@[REDACTED_HOST]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('=== DATABASE INSTANCE INFO ===');
  const info = await c.query('SELECT current_database(), current_user, version()');
  console.log(info.rows);

  console.log('\n=== COMPANY RECORDS IN PUBLIC.COMPANY ===');
  const comp = await c.query('SELECT * FROM public.company');
  console.log(`Count: ${comp.rowCount}`);
  console.log(JSON.stringify(comp.rows, null, 2));

  console.log('\n=== GST REGISTRATIONS IN PUBLIC.GST_REGISTRATION ===');
  const gst = await c.query('SELECT * FROM public.gst_registration');
  console.log(`Count: ${gst.rowCount}`);
  console.log(JSON.stringify(gst.rows, null, 2));

  console.log('\n=== INVOICE SEQUENCE IN PUBLIC.INVOICE_SEQUENCE ===');
  const seq = await c.query('SELECT * FROM public.invoice_sequence');
  console.log(JSON.stringify(seq.rows, null, 2));

  console.log('\n=== TOTAL COUNTS IN KEY PRODUCTION TABLES ===');
  const tables = ['order', 'customer', 'branch', 'product', 'invoice', 'accounting_journal_entry', 'accounting_voucher', 'setting'];
  for (const t of tables) {
    const countRes = await c.query(`SELECT count(*) as cnt FROM public."${t}"`);
    console.log(`  public."${t}": ${countRes.rows[0].cnt} rows`);
  }

  await c.end();
}

main().catch(console.error);
