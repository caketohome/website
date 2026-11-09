const { Client } = require(require('path').resolve(__dirname, '../frontend/node_modules/pg'));

async function checkRazorpay(dbName) {
  const client = new Client({ connectionString: `postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/${dbName}` });
  await client.connect();
  const res = await client.query("SELECT count(*)::int as count FROM public.payment_transaction WHERE provider = 'razorpay' OR id LIKE 'pay_rzp_%'");
  console.log(`[${dbName}] Historical Razorpay transactions:`, res.rows[0].count);
  await client.end();
}

async function main() {
  await checkRazorpay('cth_test');
  await checkRazorpay('cth_rehearsal_phase5');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

