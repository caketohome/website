const path = require('path');
const http = require('http');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

async function test() {
  const pgClient = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await pgClient.connect();

  const realOrderId = 'ord_cf_verify_' + Date.now().toString().slice(-6);
  await pgClient.query(`
    INSERT INTO public."order" (
      id, order_number, customer_id, branch_id, status, payment_status,
      grand_total, subtotal, tax_total, created_at, updated_at
    ) VALUES (
      $1, $1, 'cus_test_100', 'br_indiranagar_01', 'pending', 'pending',
      525.00, 500.00, 25.00, NOW(), NOW()
    );
  `, [realOrderId]);

  // Disconnect pgClient so no lock is held!
  await pgClient.end();
  console.log('Order created and client disconnected:', realOrderId);

  // Now call verify
  const data = JSON.stringify({
    order_id: realOrderId,
    cf_payment_id: 'cf_pay_' + Date.now(),
    amount: 525.00,
    currency: 'INR',
    payment_method: 'cashfree_upi'
  });

  const req = http.request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/v1/payments/cashfree/verify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: 8000
  }, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('HTTP ' + res.statusCode + ': ' + body));
  });

  req.on('timeout', () => console.log('TIMED OUT'));
  req.on('error', err => console.log('ERR: ' + err.message));
  req.write(data);
  req.end();
}

test().catch(console.error);

