const { Client } = require(require('path').resolve(__dirname, '../frontend/node_modules/pg'));
const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test' });

async function main() {
  await client.connect();
  const orders = await client.query('SELECT count(*)::int as count FROM public."order"');
  const invoices = await client.query('SELECT count(*)::int as count FROM public.invoice');
  const payments = await client.query('SELECT count(*)::int as count FROM public.payment_transaction');
  
  console.log('--- PROTECTED BASELINE DATABASE ATTESTATION (cth_test) ---');
  console.log('Orders count:', orders.rows[0].count, '(Baseline: 127)');
  console.log('Invoices count:', invoices.rows[0].count, '(Baseline: 71)');
  console.log('Payments count:', payments.rows[0].count, '(Baseline: 40)');

  if (orders.rows[0].count === 127 && invoices.rows[0].count === 71 && payments.rows[0].count === 40) {
    console.log('STATUS: PASS — Zero writes detected to protected baseline database.');
  } else {
    console.error('STATUS: FAIL — Row count mismatch against baseline!');
    process.exit(1);
  }
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
