const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
});

async function run() {
  const dbs = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
  console.log('Databases:', dbs.rows.map(r => r.datname));

  const vouchers = await pool.query('SELECT count(*) FROM public.accounting_voucher;');
  console.log('Voucher count in cth_test:', vouchers.rows[0].count);

  await pool.end();
}

run().catch(console.error);

