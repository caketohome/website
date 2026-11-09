const { Client } = require('pg');

async function checkSeq() {
  const client = new Client({ connectionString: 'postgresql://cth_test_user@127.0.0.1:5433/cth_test' });
  await client.connect();
  const res = await client.query('SELECT last_value, is_called FROM public.statutory_invoice_seq');
  console.log('statutory_invoice_seq:', res.rows[0]);
  await client.end();
}

checkSeq().catch(console.error);
