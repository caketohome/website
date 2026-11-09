const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function inspectOrderItemCols() {
  const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });
  await client.connect();
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'order_item'
    ORDER BY ordinal_position;
  `);
  console.log('order_item columns:');
  console.table(cols.rows);
  await client.end();
}
inspectOrderItemCols().catch(console.error);

