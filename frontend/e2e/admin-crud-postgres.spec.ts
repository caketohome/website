import { test, expect } from '@playwright/test';

test.describe('Master Admin PostgreSQL Pipeline E2E Playwright Suite — 100% Real Business Verification', () => {

  let token = '';

  test.beforeAll(async () => {
    const authRes = await fetch('http://localhost:9000/auth/user/emailpass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@email.com', password: 'supersecret' }),
    });
    const authData = await authRes.json();
    token = authData.token || authData.access_token;
    console.log('[PLAYWRIGHT AUTH TOKEN GENERATED]:', Boolean(token));
  });

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  });

  // ── 11 Core Admin CRUD Happy-Path Tests (assert HTTP 200, X-Data-Source: postgres) ───

  test('1. Verify Branch Creation via Next.js Proxy -> Port 9000 -> PostgreSQL', async ({ request }) => {
    const branchName = `Playwright E2E Hub ${Date.now()}`;
    const postRes = await request.post('http://localhost:3000/api/v1/admin/branches', {
      headers: getHeaders(),
      data: {
        name: branchName,
        code: `HUB-${Math.floor(100 + Math.random() * 900)}`,
        address: '100 Feet Rd, Indiranagar',
        city: 'Bengaluru',
        phone: '+91 98765 99999',
        email: `playwright_${Date.now()}@cakes2home.com`,
        latitude: 12.9716,
        longitude: 77.6412,
        shop_id: 'res_01KXYMAHGFPRY1G9TZKEVGAGAT',
        is_open: true,
      },
    });

    expect(postRes.status()).toBe(200);
    expect(postRes.headers()['x-data-source']).toBe('postgres');
    const body = await postRes.json();
    expect(body.storage).toBe('postgres');
    console.log('[Branch PASS] Created:', branchName);
  });

  test('2. Verify City Operations via PostgreSQL Pipeline', async ({ request }) => {
    const cityName = `TestCity_${Date.now()}`;
    const res = await request.post('http://localhost:3000/api/v1/admin/cities', {
      headers: getHeaders(),
      data: {
        name: cityName,
        state: 'Karnataka',
        country: 'India',
        is_active: true,
        pincodes: ['560001', '560038'],
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[City PASS] Created:', cityName);
  });

  test('3. Verify Delivery Zones via PostgreSQL Pipeline', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/delivery-zones', {
      headers: getHeaders(),
      data: {
        pincode: '560038',
        branch_id: 'res_01KXYMAHGFPRY1G9TZKEVGAGAT',
        delivery_fee: 49,
        is_serviceable: true,
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Delivery Zone PASS]');
  });

  test('4. Verify Offers & Coupons via PostgreSQL Pipeline', async ({ request }) => {
    const code = `OFFER_${Date.now()}`;
    const res = await request.post('http://localhost:3000/api/v1/admin/offers', {
      headers: getHeaders(),
      data: {
        name: 'Special 20% Off E2E',
        code,
        type: 'percentage',
        status: 'active',
        is_public: true,
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Offer PASS] Created:', code);
  });

  test('5. Verify Settings Module via PostgreSQL Pipeline', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/settings', {
      headers: getHeaders(),
      data: {
        group: 'general',
        key: 'store_name',
        value: 'CakeToHome Flagship',
        description: 'Primary Store Name',
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Settings PASS]');
  });

  test('6. Verify Customers CRM via PostgreSQL Pipeline', async ({ request }) => {
    const email = `customer_${Date.now()}@test.com`;
    const res = await request.post('http://localhost:3000/api/v1/admin/customers', {
      headers: getHeaders(),
      data: {
        first_name: 'John',
        last_name: 'Doe',
        email,
        phone: '+91 99887 76655',
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Customer PASS] Created:', email);
  });

  test('7. Verify Delivery Partners via PostgreSQL Pipeline', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/delivery-partners', {
      headers: getHeaders(),
      data: {
        first_name: 'Rider',
        last_name: 'Test',
        phone: '+91 91234 56789',
        email: `driver_${Date.now()}@cakes2home.com`,
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Delivery Partner PASS]');
  });

  test('8. Verify Product Catalog Creation via PostgreSQL Pipeline', async ({ request }) => {
    const title = `E2E Special Cake ${Date.now()}`;
    const res = await request.post('http://localhost:3000/api/v1/admin/catalog/products', {
      headers: getHeaders(),
      data: {
        title,
        options: [{ title: 'Weight', values: ['1kg'] }],
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Product PASS] Created:', title);
  });

  test('9. Verify Order Lifecycle Listing via PostgreSQL Pipeline', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/v1/admin/orders', {
      headers: getHeaders(),
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Orders PASS] Count:', body.count ?? body.total ?? 'N/A');
  });

  test('10. Verify Media Assets Registration via PostgreSQL Pipeline', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/media', {
      headers: getHeaders(),
      data: {
        name: 'truffle_cake_hero.jpg',
        url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587',
        mime_type: 'image/jpeg',
        folder: 'products',
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Media PASS]');
  });

  test('11. Verify Security IP Whitelist Management via PostgreSQL Pipeline', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/security/ip-whitelist', {
      headers: getHeaders(),
      data: {
        ip_address: '192.168.1.100',
        description: 'Office Admin Gateway',
      },
    });

    expect(res.status()).toBe(201);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.storage).toBe('postgres');
    console.log('[Security Whitelist PASS]');
  });

  // ── Negative Path & Error Handling Tests ──────────────────────────────

  test('12. Verify Negative Path: 400 on missing required field', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/security/ip-whitelist', {
      headers: getHeaders(),
      data: {}, // missing ip_address
    });

    expect(res.status()).toBe(400);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.message).toContain('ip_address');
    console.log('[Negative 400 PASS] Error:', body.message);
  });

  test('13. Verify Security: 401 on unauthenticated admin request', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/reports/schedules', {
      headers: { 'Content-Type': 'application/json' }, // no Bearer token
      data: { report_name: 'Weekly Sales' },
    });

    expect(res.status()).toBe(401);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.message).toContain('Unauthorized');
    console.log('[Auth 401 PASS] Error:', body.message);
  });

  // ── 100% Real Business Logic Verification: Payments ────────────────────

  test('14. Payment Initiate -> Capture -> Refund: 100% Real Business Verification (200 OK + Postgres)', async ({ request }) => {
    // 1. Initiate Session
    const initRes = await request.post('http://localhost:3000/api/v1/store/payments/initiate', {
      headers: {
        'Content-Type': 'application/json',
        'x-publishable-api-key': 'pk_7940766aa25f0496301693153851a2fa3fab6101b56602b448aab07e5021e554',
      },
      data: {
        amount: 2500,
        currency: 'INR',
        order_id: `order_pay_test_${Date.now()}`,
        branch_id: 'res_01KXYMAHGFPRY1G9TZKEVGAGAT',
        customer_id: 'cus_01KYWJADM819171B7VST0JKQWR',
        provider: 'cod',
      },
    });

    expect(initRes.status()).toBe(200);
    const initData = await initRes.json();
    expect(initData.session).toBeDefined();
    expect(initData.session.status).toBe('pending');
    const txnId = initData.session.id;

    // 2. Capture Payment
    const capRes = await request.post(`http://localhost:3000/api/v1/admin/payments/${txnId}/capture`, {
      headers: getHeaders(),
    });
    expect(capRes.status()).toBe(200);
    const capData = await capRes.json();
    const capturedTxn = capData.transaction?.[0] || capData.transaction;
    expect(capturedTxn.status).toBe('captured');

    // 3. Refund Payment
    const refRes = await request.post(`http://localhost:3000/api/v1/admin/payments/${txnId}/refund`, {
      headers: getHeaders(),
      data: { amount: 1000 },
    });
    expect(refRes.status()).toBe(200);
    const refData = await refRes.json();
    const refundedTxn = refData.transaction?.[0] || refData.transaction;
    expect(refundedTxn.status).toBe('partially_refunded');

    console.log('[Payments 100% PASS] Initiated, Captured, and Refunded:', txnId);
  });

  // ── 100% Real Business Logic Verification: Fleet Assignment ─────────────

  test('15. Fleet Delivery Creation -> Partner Creation -> Driver Assignment: 100% Real Business Verification (200 OK)', async ({ request }) => {
    // 1. Create Delivery Record
    const delRes = await request.post('http://localhost:3000/api/v1/admin/delivery', {
      headers: getHeaders(),
      data: {
        recipient_name: 'Jane Fleet Customer',
        recipient_phone: '+91 99887 71122',
        recipient_address: '456 Koramangala, Bengaluru',
        recipient_pincode: '560034',
        delivery_instructions: 'Leave with security',
      },
    });
    expect(delRes.status()).toBe(201);
    const delData = await delRes.json();
    const deliveryId = delData.delivery?.[0]?.id || delData.delivery?.id;
    expect(deliveryId).toBeDefined();

    // 2. Create Driver Partner
    const driverRes = await request.post('http://localhost:3000/api/v1/admin/delivery-partners', {
      headers: getHeaders(),
      data: {
        first_name: 'Speedy',
        last_name: 'Driver',
        phone: '+91 98888 77777',
        email: `speedy_${Date.now()}@cakes2home.com`,
      },
    });
    expect(driverRes.status()).toBe(200);
    const driverData = await driverRes.json();
    const driverId = driverData.partner?.[0]?.id || driverData.partner?.id;
    expect(driverId).toBeDefined();

    // 3. Assign Driver to Delivery
    const assignRes = await request.post('http://localhost:3000/api/v1/admin/delivery/assign', {
      headers: getHeaders(),
      data: {
        delivery_id: deliveryId,
        partner_id: driverId,
      },
    });
    expect(assignRes.status()).toBe(200);
    const assignData = await assignRes.json();
    expect(assignData.delivery.delivery_partner_id).toBe(driverId);
    expect(assignData.delivery.delivery_status).toBe('pickup_claimed');

    console.log('[Fleet 100% PASS] Assigned Driver', driverId, 'to Delivery', deliveryId);
  });

  // ── 100% Real Business Logic Verification: Full KDS Order Lifecycle ────

  test('16. Full KDS Order Lifecycle Progression: Real Order through all 6 statuses (200 OK + History Audit)', async ({ request }) => {
    // 1. Create a fresh order directly in PostgreSQL for clean lifecycle testing
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      test.skip(true, "DATABASE_URL environment variable required for direct DB lifecycle test");
      return;
    }
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(`
      INSERT INTO "order" (id, status, currency_code, display_id, email, customer_id, created_at, updated_at)
      VALUES ($1, 'pending', 'inr', $2, 'kds_playwright@test.com', 'cus_01KYWJADM819171B7VST0JKQWR', NOW(), NOW());
    `, [orderId, Math.floor(1000 + Math.random() * 9000)]);
    await client.end();

    // 2. Verify GET initial lifecycle status
    const getRes = await request.get(`http://localhost:3000/api/v1/admin/order-lifecycle/${orderId}`, {
      headers: getHeaders(),
    });
    expect(getRes.status()).toBe(200);

    // 3. Step through full status progression map
    const transitions = [
      { to: 'confirmed', from: 'pending' },
      { to: 'accepted', from: 'confirmed' },
      { to: 'packed', from: 'accepted' },
      { to: 'ready', from: 'packed' },
      { to: 'out_for_delivery', from: 'ready' },
      { to: 'delivered', from: 'out_for_delivery' },
    ];

    for (const step of transitions) {
      const transRes = await request.post(`http://localhost:3000/api/v1/admin/order-lifecycle/${orderId}`, {
        headers: getHeaders(),
        data: {
          to_status: step.to,
          reason: `Playwright E2E progression from ${step.from} to ${step.to}`,
        },
      });
      expect(transRes.status()).toBe(200);
      const transData = await transRes.json();
      expect(transData.to_status).toBe(step.to);
      expect(transData.from_status).toBe(step.from);
    }

    // 4. Verify final state and full history timeline
    const finalRes = await request.get(`http://localhost:3000/api/v1/admin/order-lifecycle/${orderId}`, {
      headers: getHeaders(),
    });
    expect(finalRes.status()).toBe(200);
    const finalData = await finalRes.json();
    expect(finalData.order.lifecycle_status).toBe('delivered');
    expect(finalData.order.status_history.length).toBeGreaterThanOrEqual(6);

    console.log('[KDS Lifecycle 100% PASS] Order', orderId, 'progressed through 6 statuses to delivered');
  });

  test('17. KDS Validation: invalid status "baking" returns 409 Conflict', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/v1/admin/order-lifecycle/order_e2e_real_1785598150886', {
      headers: getHeaders(),
      data: {
        to_status: 'baking', // not in ORDER_STATUSES
        reason: 'E2E invalid status test',
      },
    });

    expect(res.status()).toBe(409);
    expect(res.headers()['x-data-source']).toBe('postgres');
    const body = await res.json();
    expect(body.message).toContain('Unknown order status');
    expect(body.message).toContain('baking');
    console.log('[KDS Invalid Status PASS] Correctly rejected:', body.message);
  });

  // ── Dashboard UI Rendering Test ───────────────────────────────────────

  test('18. Dashboard Page Accessibility in Edge Browser', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await expect(page).toHaveTitle(/CakeToHome/);
    await expect(page.locator('h1')).toContainText('Super Admin Control Panel');
    console.log('[Dashboard UI PASS]');
  });

});
