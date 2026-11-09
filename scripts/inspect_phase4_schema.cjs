const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function inspectSchema() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase4'
  });
  await client.connect();

  const getCols = async (tbl) => {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tbl]);
    return res.rows.map(r => `${r.column_name} (${r.data_type})`);
  };

  const tables = ['order', 'order_item', 'order_line_item', 'order_status_history', 'customer_notification_queue', 'payment_webhook_event', 'inventory_movement', 'branch_inventory'];
  for (const t of tables) {
    const cols = await getCols(t);
    console.log(`\nTable ${t}:`);
    console.log(cols.join(', '));
  }

  // Check if any KOT table exists
  const kotTables = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%kot%';
  `);
  console.log('\nKOT tables:', kotTables.rows.map(r => r.table_name));

  await client.end();
}

inspectSchema().catch(console.error);

