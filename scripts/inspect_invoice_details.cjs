const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const db = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });

async function check() {
  await db.connect();
  const res = await db.query("SELECT * FROM public.invoice WHERE invoice_number LIKE '%000216%' LIMIT 1");
  console.log('Invoice Row:', JSON.stringify(res.rows[0], null, 2));

  if (res.rows[0]?.order_id) {
    const orderRes = await db.query("SELECT * FROM public.order WHERE id = $1", [res.rows[0].order_id]);
    console.log('Order Row:', JSON.stringify(orderRes.rows[0], null, 2));

    const itemsRes = await db.query("SELECT * FROM public.order_item WHERE order_id = $1", [res.rows[0].order_id]);
    console.log('Order Items:', JSON.stringify(itemsRes.rows, null, 2));
  }
  await db.end();
}

check().catch(console.error);
