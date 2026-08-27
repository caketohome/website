import http from 'http';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  dataSource: string | null;
  backendTarget: string | null;
  backendHealth: string | null;
  fallback: string | null;
  data: any;
  passed: boolean;
}

function request(options: http.RequestOptions, body?: any): Promise<TestResult> {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json: any = null;
        try {
          json = JSON.parse(raw);
        } catch {
          json = raw;
        }
        resolve({
          endpoint: String(options.path),
          method: options.method || 'GET',
          status: res.statusCode || 0,
          dataSource: res.headers['x-data-source'] as string || null,
          backendTarget: res.headers['x-backend-target'] as string || null,
          backendHealth: res.headers['x-backend-health'] as string || null,
          fallback: res.headers['x-fallback'] as string || null,
          data: json,
          passed: (res.statusCode || 0) < 400
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        endpoint: String(options.path),
        method: options.method || 'GET',
        status: 0,
        dataSource: null,
        backendTarget: null,
        backendHealth: null,
        fallback: null,
        data: { error: err.message },
        passed: false
      });
    });
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log('REAL BACKEND PATH AUDIT (Zero Fallback Masking)');
  console.log('====================================================\n');

  // 1. Direct Medusa 9000 health check
  console.log('1. Testing Direct Medusa Backend (http://localhost:9000/health)...');
  const directMedusa = await request({ host: 'localhost', port: 9000, path: '/health', method: 'GET' });
  console.log(`   Direct Backend Status: ${directMedusa.status} -> ${JSON.stringify(directMedusa.data)}`);
  if (directMedusa.status !== 200) {
    console.error('   FAIL: Direct Medusa Backend is not returning HTTP 200!');
  } else {
    console.log('   PASS: Direct Medusa Backend is HEALTHY (HTTP 200)');
  }

  // 2. Testing Frontend Health API
  console.log('\n2. Testing Frontend Health API (http://localhost:3000/api/v1/health)...');
  const healthRes = await request({ host: 'localhost', port: 3000, path: '/api/v1/health', method: 'GET' });
  console.log(`   Status: ${healthRes.status}`);
  console.log(`   X-Data-Source: ${healthRes.dataSource}`);
  console.log(`   X-Backend-Health: ${healthRes.backendHealth}`);
  console.log(`   X-Fallback: ${healthRes.fallback}`);
  console.log(`   Service: ${healthRes.data?.service}, Database: ${healthRes.data?.database}`);

  // 3. Testing States API
  console.log('\n3. Testing States API (http://localhost:3000/api/v1/states)...');
  const statesRes = await request({ host: 'localhost', port: 3000, path: '/api/v1/states', method: 'GET' });
  console.log(`   Status: ${statesRes.status}`);
  console.log(`   States Count: ${statesRes.data?.states?.length || 0}`);

  // 4. Testing Cities API
  console.log('\n4. Testing Cities API (http://localhost:3000/api/v1/cities)...');
  const citiesRes = await request({ host: 'localhost', port: 3000, path: '/api/v1/cities', method: 'GET' });
  console.log(`   Status: ${citiesRes.status}`);
  console.log(`   Cities Count: ${citiesRes.data?.cities?.length || 0}`);

  // 5. Testing Delivery Resolution API
  console.log('\n5. Testing Delivery Resolution (http://localhost:3000/api/v1/delivery/resolve)...');
  const deliveryRes = await request(
    {
      host: 'localhost',
      port: 3000,
      path: '/api/v1/delivery/resolve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { lat: 12.9716, lng: 77.5946, address: 'Indiranagar, Bengaluru' }
  );
  console.log(`   Status: ${deliveryRes.status}`);
  console.log(`   Delivery Serviceable: ${deliveryRes.data?.serviceable || deliveryRes.data?.success}`);

  // 6. Testing Cart API
  console.log('\n6. Testing Cart API (http://localhost:3000/api/v1/cart)...');
  const cartRes = await request({ host: 'localhost', port: 3000, path: '/api/v1/cart', method: 'GET' });
  console.log(`   Status: ${cartRes.status}`);
  console.log(`   Cart Available: ${cartRes.status < 400}`);

  // 7. Testing Products API
  console.log('\n7. Testing Products API (http://localhost:3000/api/v1/products)...');
  const productsRes = await request({ host: 'localhost', port: 3000, path: '/api/v1/products?limit=5', method: 'GET' });
  console.log(`   Status: ${productsRes.status}`);
  console.log(`   Products Count: ${productsRes.data?.products?.length || productsRes.data?.results?.length || 0}`);

  // 8. Testing Checkout Validation API
  console.log('\n8. Testing Checkout Validation API (http://localhost:3000/api/v1/checkout/validate)...');
  const checkoutRes = await request(
    {
      host: 'localhost',
      port: 3000,
      path: '/api/v1/checkout/validate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      cart_id: 'cart_test_audit',
      items: [{ id: 'prod_belgian_truffle', title: 'Belgian Truffle Cake', quantity: 1, unit_price: 599, total_price: 599 }],
      pincode: '560038',
      delivery_date: '2026-08-26',
      delivery_slot_id: 'slot_standard_10_12'
    }
  );
  console.log(`   Status: ${checkoutRes.status}`);
  console.log(`   Validation Valid: ${checkoutRes.data?.valid ?? checkoutRes.data?.success ?? false}`);

  console.log('\n====================================================');
  console.log('PATH AUDIT SUMMARY:');
  console.log(`Direct Medusa Backend: ${directMedusa.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`Frontend Health: ${healthRes.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`States API: ${statesRes.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`Cities API: ${citiesRes.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`Delivery Resolve: ${deliveryRes.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`Cart API: ${cartRes.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`Products API: ${productsRes.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`Checkout Validate: ${checkoutRes.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log('====================================================');
}

runAudit();
