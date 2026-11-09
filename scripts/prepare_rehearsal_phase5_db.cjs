const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function setup() {
  const adminClient = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/postgres'
  });

  await adminClient.connect();

  // Terminate any active connections to cth_rehearsal_phase4 before templating
  await adminClient.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname IN ('cth_rehearsal_phase4', 'cth_rehearsal_phase5')
      AND pid <> pg_backend_pid();
  `);

  // Drop cth_rehearsal_phase5 if it already exists
  await adminClient.query('DROP DATABASE IF EXISTS cth_rehearsal_phase5;');
  console.log('Dropped any existing cth_rehearsal_phase5');

  // Create cth_rehearsal_phase5 from cth_rehearsal_phase4 template
  await adminClient.query('CREATE DATABASE cth_rehearsal_phase5 WITH TEMPLATE cth_rehearsal_phase4 OWNER cth_test_user;');
  console.log('Created cth_rehearsal_phase5 from cth_rehearsal_phase4 template');

  await adminClient.end();

  // Verify connection to cth_rehearsal_phase5
  const testClient = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await testClient.connect();
  const res = await testClient.query("SELECT count(*) as tables FROM information_schema.tables WHERE table_schema IN ('public', 'auth');");
  const orders = await testClient.query('SELECT count(*) as orders FROM public."order";');
  const invoices = await testClient.query('SELECT count(*) as invoices FROM public.invoice;');
  const vouchers = await testClient.query('SELECT count(*) as vouchers FROM public.accounting_voucher;');
  console.log('cth_rehearsal_phase5 ready. Total tables:', res.rows[0].tables, 'Orders:', orders.rows[0].orders, 'Invoices:', invoices.rows[0].invoices, 'Vouchers:', vouchers.rows[0].vouchers);
  await testClient.end();
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});

