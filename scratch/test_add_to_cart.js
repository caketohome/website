const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testCartPipeline() {
  console.log("=== TESTING ADD TO CART PIPELINE ===");

  // 1. Get initial cart
  console.log("\n1. Fetching guest cart...");
  const getRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/cart?cartId=cart_test_100',
    method: 'GET'
  });
  console.log("Status:", getRes.status, "Cart:", getRes.data);

  // 2. Add item to cart
  console.log("\n2. Adding item (Belgian Truffle Cake) to cart...");
  const addRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/cart/items',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    cartId: 'cart_test_100',
    productId: 'prod_1',
    variantId: 'var_prod_1_1kg',
    quantity: 2,
    price: 649,
    selectedOptions: { weight: '1.0 kg', eggless: true }
  });
  console.log("Status:", addRes.status, "Updated Cart:", JSON.stringify(addRes.data, null, 2));

  // 3. Verify cart state
  console.log("\n3. Verifying cart items count and total...");
  const cart = addRes.data.cart;
  if (cart && cart.items.length > 0 && cart.total > 0) {
    console.log(`✅ SUCCESS: Cart contains ${cart.items.length} item(s). Subtotal: ₹${cart.subtotal}, Total: ₹${cart.total}`);
  } else {
    console.log("❌ FAILED: Cart items or total invalid.");
  }
}

testCartPipeline().catch(console.error);
