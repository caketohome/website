const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function inspectNotifQueue() {
  const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });
  await client.connect();
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'customer_notification_queue'
    ORDER BY ordinal_position;
  `);
  console.log('customer_notification_queue columns:');
  console.table(cols.rows);
  await client.end();
}
inspectNotifQueue().catch(console.error);

