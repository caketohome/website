const { Client } = require('pg');

async function inspectFunc() {
  const client = new Client({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'allocate_invoice_number'
  `);
  console.log('Function definition:');
  console.log(res.rows[0]?.def);
  await client.end();
}

inspectFunc().catch(console.error);
