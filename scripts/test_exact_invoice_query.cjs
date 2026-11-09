const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const db = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });

async function run() {
  await db.connect();
  const rawParam = 'CH-26-27-000216';
  const standardStatutory = 'CH/26-27/000216';
  const slashParam = 'CH/26/27/000216';
  const p4 = '26-27-000216';

  console.log('Testing exact query from page:');
  const res = await db.query(
    `SELECT i.*, 
            o.order_number, o.created_at as order_created_at, o.customer_name as ord_customer_name, o.customer_phone as ord_customer_phone,
            o.metadata->>'delivery_address' as ord_delivery_address,
            b.name as branch_name, b.address as branch_address
     FROM public.invoice i
     LEFT JOIN public.order o ON i.order_id = o.id
     LEFT JOIN public.branch b ON i.branch_id = b.id
     WHERE i.invoice_number = $1 
        OR i.invoice_number = $2 
        OR i.invoice_number = $3 
        OR i.invoice_number LIKE '%' || $4 || '%'
        OR i.id = $1 
        OR i.order_id = $1
     ORDER BY i.created_at DESC
     LIMIT 1`,
    [rawParam, standardStatutory, slashParam, p4]
  );
  console.log('Rows found:', res.rows.length);
  if (res.rows.length > 0) {
    console.log('Invoice found:', res.rows[0].invoice_number, res.rows[0].customer_name);
  }
  await db.end();
}

run().catch(console.error);

