const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function test() {
  const localDb = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });
  await localDb.connect();
  const tables = await localDb.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('Total public tables in cth_rehearsal_phase5:', tables.rows.length);
  const cmsTables = tables.rows.filter(r => r.table_name.startsWith('cms_'));
  console.log('CMS tables:', cmsTables.map(r => r.table_name));

  const invRes = await localDb.query("SELECT id, invoice_number, customer_name FROM public.invoice WHERE invoice_number LIKE '%000216%'");
  console.log('216 invoice in localDb:', invRes.rows);

  await localDb.end();
}

test().catch(console.error);

