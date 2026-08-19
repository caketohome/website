const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING CAKETOHOME CUSTOMER PLATFORM INTEGRITY AUDIT ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // TEST 1: Unauthenticated GET /api/auth/me
    const unauthRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/me',
      method: 'GET',
    });
    assert(unauthRes.status === 401, 'Test 1: Unauthenticated GET /api/auth/me returns 401 Unauthorized');
    assert(unauthRes.body.success === false, 'Test 1.1: Response payload has success: false');

    // TEST 2: Authenticated GET /api/auth/me with Cookie
    const authRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Cookie': '_cth_customer_uid=cus_9777770844; _cth_phone=%2B919777770844; _cth_role=customer'
      }
    });
    assert(authRes.status === 200, 'Test 2: Authenticated GET /api/auth/me returns 200 OK');
    assert(authRes.body.success === true, 'Test 2.1: Response payload has success: true');
    assert(authRes.body.data?.user?.customer_uid === 'cth_cus_9777770844', 'Test 2.2: Correct customer_uid resolved');

    // TEST 3: GET /api/customer/profile
    const profileRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customer/profile',
      method: 'GET',
      headers: {
        'Cookie': '_cth_customer_uid=cus_9777770844; _cth_phone=%2B919777770844; _cth_role=customer'
      }
    });
    assert(profileRes.status === 200, 'Test 3: GET /api/customer/profile returns 200 OK');
    assert(profileRes.body.data?.profile?.name !== undefined, 'Test 3.1: Profile name exists');
    assert(profileRes.body.data?.profile?.preferences?.eggless_only === undefined, 'Test 3.2: No eggless_only in customer profile preferences');

    // TEST 4: Validation Error on PUT /api/customer/profile (Name too short)
    const invalidPutRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customer/profile',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': '_cth_customer_uid=cus_9777770844; _cth_phone=%2B919777770844; _cth_role=customer'
      }
    }, { full_name: 'A' });
    assert(invalidPutRes.status === 400, 'Test 4: PUT /api/customer/profile rejects name shorter than 2 chars with 400');

    // TEST 5: Successful PUT /api/customer/profile
    const validPutRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customer/profile',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': '_cth_customer_uid=cus_9777770844; _cth_phone=%2B919777770844; _cth_role=customer'
      }
    }, {
      full_name: 'Alex R Ashok',
      email: 'alex.ashok@example.com',
      date_of_birth: '1992-08-15'
    });
    assert(validPutRes.status === 200, 'Test 5: PUT /api/customer/profile updates successfully with 200 OK');
    assert(validPutRes.body.data?.profile?.full_name === 'Alex R Ashok', 'Test 5.1: Updated full_name verified');

    // TEST 6: GET /api/customer/orders
    const ordersRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customer/orders',
      method: 'GET',
      headers: {
        'Cookie': '_cth_customer_uid=cus_9777770844; _cth_phone=%2B919777770844; _cth_role=customer'
      }
    });
    assert(ordersRes.status === 200, 'Test 6: GET /api/customer/orders returns 200 OK');
    assert(Array.isArray(ordersRes.body.data?.orders), 'Test 6.1: Orders array returned');

    // TEST 7: POST /api/auth/logout expires all cookies
    const logoutRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/logout',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { reason: 'user_initiated' });
    assert(logoutRes.status === 200, 'Test 7: POST /api/auth/logout returns 200 OK');
    const setCookieHeaders = logoutRes.headers['set-cookie'] || [];
    const clearedCookiesStr = setCookieHeaders.join('; ');
    assert(clearedCookiesStr.includes('_cth_customer_uid'), 'Test 7.1: _cth_customer_uid expired on logout');
    assert(clearedCookiesStr.includes('_cth_jwt'), 'Test 7.2: _cth_jwt expired on logout');

    console.log(`\n=== INTEGRITY AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Audit execution error:', err);
  }
}

runTests();
