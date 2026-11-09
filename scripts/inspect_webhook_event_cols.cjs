const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function inspectWebhookEventCols() {
  const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });
  await client.connect();
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'payment_webhook_event'
    ORDER BY ordinal_position;
  `);
  console.log('payment_webhook_event columns:');
  console.table(cols.rows);
  await client.end();
}
inspectWebhookEventCols().catch(console.error);

