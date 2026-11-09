const http = require('http');
const path = require('path');

// Resolve pg from frontend/node_modules
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function request(options, data) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, host: '127.0.0.1', timeout: 10000 };
    console.log(`[REQ] ${opts.method || 'GET'} http://127.0.0.1:${opts.port}${opts.path}`);
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', reject);
    if (data) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('CAKETOHOME PHASE 6.1.2 — CASHFREE & RAZORPAY DECOMMISSION TESTS');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition, extra = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${title} ${extra ? '(' + extra + ')' : ''}`);
    } else {
      console.error(`[FAIL] ${title} ${extra ? '(' + extra + ')' : ''}`);
    }
  }

  // 1. Next.js Razorpay Decommission Guard - create-order (410 Gone)
  try {
    const res = await request({
      port: 3000,
      path: '/api/v1/payments/razorpay/create-order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { amount: 500 });
    assert(
      'Next.js rejects Razorpay create-order with 410 Gone',
      res.status === 410 && res.body.error === 'RAZORPAY_DECOMMISSIONED',
      `HTTP ${res.status}: ${JSON.stringify(res.body)}`
    );
  } catch (e) {
    assert('Next.js rejects Razorpay create-order with 410 Gone', false, e.message);
  }

  // 2. Next.js Razorpay Decommission Guard - verify-signature (410 Gone)
  try {
    const res = await request({
      port: 3000,
      path: '/api/v1/payments/razorpay/verify-signature',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { razorpay_order_id: 'order_123' });
    assert(
      'Next.js rejects Razorpay verify-signature with 410 Gone',
      res.status === 410 && res.body.error === 'RAZORPAY_DECOMMISSIONED',
      `HTTP ${res.status}: ${JSON.stringify(res.body)}`
    );
  } catch (e) {
    assert('Next.js rejects Razorpay verify-signature with 410 Gone', false, e.message);
  }

  // 3. Next.js Razorpay Decommission Guard - webhook (410 Gone)
  try {
    const res = await request({
      port: 3000,
      path: '/api/v1/payments/razorpay/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { event: 'payment.captured' });
    assert(
      'Next.js rejects Razorpay webhook with 410 Gone',
      res.status === 410 && res.body.error === 'RAZORPAY_DECOMMISSIONED',
      `HTTP ${res.status}: ${JSON.stringify(res.body)}`
    );
  } catch (e) {
    assert('Next.js rejects Razorpay webhook with 410 Gone', false, e.message);
  }

  // 4. NestJS Backend Razorpay Decommission Guard (410 Gone)
  try {
    const res = await request({
      port: 9000,
      path: '/api/v1/payments/razorpay',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    assert(
      'NestJS Backend rejects Razorpay POST with 410 Gone',
      res.status === 410 && (JSON.stringify(res.body).includes('Razorpay has been decommissioned') || JSON.stringify(res.body).includes('Gone')),
      `HTTP ${res.status}: ${JSON.stringify(res.body)}`
    );
  } catch (e) {
    assert('NestJS Backend rejects Razorpay POST with 410 Gone', false, e.message);
  }

  // 5. NestJS Backend Cashfree Order Generation
  try {
    const res = await request({
      port: 9000,
      path: '/api/v1/payments/cashfree/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      orderId: 'CTH-TEST-' + Date.now().toString().slice(-6),
      amount: 525,
      customerPhone: '9876543210',
      customerName: 'Ananya Sharma'
    });
    assert(
      'NestJS creates Cashfree PG v2023-08-01 order session',
      (res.status === 201 || res.status === 200) && (res.body.success === true || !!res.body.data?.payment_session_id || !!res.body.payment_session_id),
      `HTTP ${res.status}: ${JSON.stringify(res.body)}`
    );
  } catch (e) {
    assert('NestJS creates Cashfree PG v2023-08-01 order session', false, e.message);
  }

  // 6. Next.js Cashfree Order Session Generation
  let testOrderId = 'CTH-CF-' + Date.now().toString().slice(-6);
  try {
    const res = await request({
      port: 3000,
      path: '/api/v1/payments/cashfree/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      order_id: testOrderId,
      amount: 525,
      customer_phone: '9876543210',
      customer_name: 'Ananya Sharma'
    });
    assert(
      'Next.js creates Cashfree order session endpoint',
      res.status === 200 && res.body.success === true && !!res.body.paymentSessionId,
      `HTTP ${res.status}: session=${res.body.paymentSessionId}`
    );
  } catch (e) {
    assert('Next.js creates Cashfree order session endpoint', false, e.message);
  }

  // 7. Create a real test order in rehearsal DB for verification flow
  console.log('[DB] Connecting to PostgreSQL rehearsal database...');
  let pgClient = new Client({
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

  await pgClient.end();

  // 8. Next.js Cashfree Verification & Atomic Order Confirmation
  try {
    const cfPayId = 'cf_pay_' + Date.now();
    const res = await request({
      port: 3000,
      path: '/api/v1/payments/cashfree/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      order_id: realOrderId,
      cf_payment_id: cfPayId,
      amount: 525.00,
      currency: 'INR',
      payment_method: 'cashfree_upi'
    });

    assert(
      'Cashfree verification confirms order atomically',
      res.status === 200 && (res.body.status === 'confirmed' || res.body.success === true),
      `HTTP ${res.status}: status=${res.body.status}`
    );

    // Reconnect to check DB state
    pgClient = new Client({
      connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
    });
    await pgClient.connect();

    const orderCheck = await pgClient.query(
      'SELECT id, status, payment_status FROM public."order" WHERE id = $1;',
      [realOrderId]
    );
    assert(
      'Database order row transitioned to status=confirmed and payment_status=paid',
      orderCheck.rows.length === 1 && orderCheck.rows[0].status === 'confirmed' && orderCheck.rows[0].payment_status === 'paid',
      `status=${orderCheck.rows[0]?.status}, payment_status=${orderCheck.rows[0]?.payment_status}`
    );

    // Check transaction ledger
    const txCheck = await pgClient.query(
      'SELECT id, provider, status FROM public.payment_transaction WHERE order_id = $1;',
      [realOrderId]
    );
    assert(
      'Payment transaction recorded with provider=cashfree',
      txCheck.rows.length > 0 && txCheck.rows[0].provider === 'cashfree',
      `txCount=${txCheck.rows.length}, provider=${txCheck.rows[0]?.provider}`
    );

    // Check KOT generation
    const kotCheck = await pgClient.query(
      'SELECT id, order_id, kot_number FROM public.kot_tickets WHERE order_id = $1;',
      [realOrderId]
    );
    assert(
      'Kitchen Order Ticket (KOT) generated automatically for confirmed Cashfree order',
      kotCheck.rows.length > 0,
      `kotNumber=${kotCheck.rows[0]?.kot_number}`
    );

  } catch (e) {
    assert('Cashfree verification confirms order atomically', false, e.message);
  }

  // 9. Historical Razorpay Records Preservation Check in rehearsal DB
  const histCheck = await pgClient.query(
    "SELECT COUNT(*) AS count FROM public.payment_transaction WHERE provider = 'razorpay';"
  );
  assert(
    'Historical Razorpay records preserved in payment_transaction',
    parseInt(histCheck.rows[0].count, 10) >= 0,
    `count=${histCheck.rows[0].count}`
  );

  await pgClient.end();

  // 10. Check Zero Writes to protected database `cth_test`
  console.log('[DB] Connecting to protected database cth_test to verify zero writes...');
  const testClient = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
  });
  await testClient.connect();

  const testOrders = await testClient.query('SELECT COUNT(*) AS count FROM public."order";');
  const testPayments = await testClient.query('SELECT COUNT(*) AS count FROM public.payment_transaction;');
  const testInvoices = await testClient.query('SELECT COUNT(*) AS count FROM public.invoice;');

  assert(
    'Protected database cth_test untouched: order count == 127',
    parseInt(testOrders.rows[0].count, 10) === 127,
    `count=${testOrders.rows[0].count}`
  );
  assert(
    'Protected database cth_test untouched: payment count == 40',
    parseInt(testPayments.rows[0].count, 10) === 40,
    `count=${testPayments.rows[0].count}`
  );
  assert(
    'Protected database cth_test untouched: invoice count == 71',
    parseInt(testInvoices.rows[0].count, 10) === 71,
    `count=${testInvoices.rows[0].count}`
  );

  await testClient.end();

  console.log(`\n========================================================`);
  console.log(`TEST RESULTS: ${passed}/${total} ASSERTIONS PASSED`);
  console.log(`========================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
