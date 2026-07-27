const http = require('http');

const BACKEND_URL = 'http://localhost:9000';
const FRONTEND_URL = 'http://localhost:3001';

async function fetchUrl(url, options = {}) {
  const u = new URL(url);
  return new Promise((resolve) => {
    const req = http.request(u, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: 3000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runRealSystemProbe() {
  console.log("=========================================");
  console.log("🔍 REAL LIVE SYSTEM END-TO-END PROBE");
  console.log("=========================================\n");

  const endpoints = [
    // Next.js Native API v1 Endpoints (Port 3000)
    { name: "API v1 Health", url: `${FRONTEND_URL}/api/v1/health` },
    { name: "API v1 Products List", url: `${FRONTEND_URL}/api/v1/products` },
    { name: "API v1 Single Product", url: `${FRONTEND_URL}/api/v1/products/prod_1` },
    { name: "API v1 OTP Request (POST)", url: `${FRONTEND_URL}/api/v1/auth/otp/request`, method: "POST", body: JSON.stringify({ phone: "+919876543210" }) },
    { name: "API v1 OTP Verify (POST)", url: `${FRONTEND_URL}/api/v1/auth/otp/verify`, method: "POST", body: JSON.stringify({ phone: "+919876543210", otp: "123456" }) },
    { name: "API v1 Cart Get", url: `${FRONTEND_URL}/api/v1/cart?cartId=cart_guest_100` },
    { name: "API v1 Cart Add Item (POST)", url: `${FRONTEND_URL}/api/v1/cart/items`, method: "POST", body: JSON.stringify({ cartId: "cart_guest_100", productId: "prod_1", variantId: "var_1", quantity: 1 }) },
    { name: "API v1 Cart Apply Promo (POST)", url: `${FRONTEND_URL}/api/v1/cart/promo`, method: "POST", body: JSON.stringify({ cartId: "cart_guest_100", promoCode: "CAKE100" }) },
    { name: "API v1 Create Order (POST)", url: `${FRONTEND_URL}/api/v1/orders`, method: "POST", body: JSON.stringify({ customerId: "cus_123", paymentProvider: "COD" }) },

    // Frontend Pages (Port 3000)
    { name: "Frontend Login Page", url: `${FRONTEND_URL}/login` },
    { name: "Frontend Account Page", url: `${FRONTEND_URL}/account` },
    { name: "Frontend Shop Dashboard", url: `${FRONTEND_URL}/dashboard/shop` },
    { name: "Frontend Delivery Dashboard", url: `${FRONTEND_URL}/dashboard/delivery-partner` },
  ];

  for (const ep of endpoints) {
    const res = await fetchUrl(ep.url, { method: ep.method, body: ep.body, headers: ep.headers });
    const isSuccess = res.status >= 200 && res.status < 400;
    const statusLabel = res.status === 0 ? `FAIL (${res.error})` : `${res.status}`;
    const symbol = isSuccess ? "✅" : "🔴";
    
    console.log(`${symbol} ${ep.name.padEnd(35)} -> Status: ${statusLabel}`);
    if (res.body && (isSuccess || res.status >= 400)) {
      console.log(`   Response: ${res.body.slice(0, 120).replace(/\n/g, ' ')}`);
    }
  }

  console.log("\n=========================================");
  console.log("PROBE SUMMARY COMPLETE");
  console.log("=========================================");
}

runRealSystemProbe();
