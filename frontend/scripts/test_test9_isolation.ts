process.env.TEST_DATABASE_URL = 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';
process.env.DATABASE_URL = 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';
process.env.NODE_ENV = 'test';

import { Client } from 'pg';
import { DeliveryInvoicingService } from '../src/lib/services/delivery-invoicing.service';

async function testSingle() {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();

  const ts = Date.now();
  const persistOrderId = `ord_test9_${ts}`;
  const persistOrderNumber = `ORD-TEST9-${ts}`;
  await client.query(`
    INSERT INTO public.order (id, order_number, branch_id, status, grand_total, metadata, created_at)
    VALUES ($1, $2, 'br_indiranagar_01', 'delivered', 1450.50, '{"is_ledger_eligible": true}'::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET status = 'delivered';
  `, [persistOrderId, persistOrderNumber]);

  console.log('Testing generateInvoiceOnDelivery...');
  const res = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
    id: persistOrderId,
    order_number: persistOrderNumber,
    status: 'delivered',
    branch_id: 'br_indiranagar_01',
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    seller_state_code: '29',
    items: [
      { title: 'Dutch Truffle Cake 1kg', quantity: 1, unit_price: 1200, hsn_code: '19059010' },
      { title: 'Birthday Candles Pack', quantity: 1, unit_price: 100, hsn_code: '34060010' },
    ],
  });

  console.log('Result:', res);
  await client.end();

  // Fresh connection verification
  const { closeDbPool } = await import('../src/lib/db');
  await closeDbPool();

  const freshClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await freshClient.connect();

  const invQuery = await freshClient.query(
    "SELECT id, invoice_number, order_id, seller_gstin, seller_legal_name, grand_total, status FROM public.invoice WHERE order_id = $1",
    [persistOrderId]
  );
  const allocQuery = await freshClient.query(
    "SELECT status, invoice_number FROM public.invoice_allocation_log WHERE order_id = $1",
    [persistOrderId]
  );

  console.log('Fresh connection invoice row:', invQuery.rows[0]);
  console.log('Fresh connection allocation log row:', allocQuery.rows[0]);

  await freshClient.end();
  await closeDbPool();
}

testSingle().catch(console.error);
