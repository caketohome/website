const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function setup() {
  const adminClient = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/postgres'
  });

  await adminClient.connect();

  // Terminate any active connections to cth_rehearsal_phase5_7 before templating
  await adminClient.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname IN ('cth_rehearsal_phase5_7', 'cth_rehearsal_phase4')
      AND pid <> pg_backend_pid();
  `);

  // Drop cth_rehearsal_phase4 if it already exists
  await adminClient.query('DROP DATABASE IF EXISTS cth_rehearsal_phase4;');
  console.log('Dropped any existing cth_rehearsal_phase4');

  // Create cth_rehearsal_phase4 from cth_rehearsal_phase5_7
  await adminClient.query('CREATE DATABASE cth_rehearsal_phase4 WITH TEMPLATE cth_rehearsal_phase5_7 OWNER cth_test_user;');
  console.log('Created cth_rehearsal_phase4 from cth_rehearsal_phase5_7 template');

  await adminClient.end();

  // Verify connection to cth_rehearsal_phase4
  const testClient = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase4'
  });
  await testClient.connect();
  const res = await testClient.query('SELECT count(*) as tables FROM information_schema.tables WHERE table_schema IN (\'public\', \'auth\');');
  const orders = await testClient.query('SELECT count(*) as orders FROM public."order";');
  console.log('cth_rehearsal_phase4 ready. Total tables:', res.rows[0].tables, 'Orders:', orders.rows[0].orders);
  await testClient.end();
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});

