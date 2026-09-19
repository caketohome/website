const http = require('http');

function makeRequest(urlPath, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
      },
    };

    if (postData) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('   PHASE 7 LIVE HTTP & PDP/CART VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: PDP HTML Render for Butter Croissant
  // ----------------------------------------------------
  console.log('--- 1. Testing PDP HTML for /products/butter-croissant ---');
  const pdpRes = await makeRequest('/products/butter-croissant');
  assert(pdpRes.statusCode === 200, `PDP returns HTTP 200 (actual: ${pdpRes.statusCode})`);
  const html = pdpRes.data;

  // Check no "1 pc" or "1 piece"
  const has1pc = /1\s*pc\b|1\s*piece\b/i.test(html);
  assert(!has1pc, 'PDP HTML does NOT contain "1 pc" or "1 piece"');

  // Check no "Select Size & Weight" or "SELECT SIZE & WEIGHT"
  const hasSelectSize = /SELECT SIZE & WEIGHT/i.test(html);
  assert(!hasSelectSize, 'PDP HTML does NOT render "SELECT SIZE & WEIGHT" for Butter Croissant');

  // Check no fake "500G" SKU
  const has500gSku = /BUTTER-CROISSANT-500G/i.test(html);
  assert(!has500gSku, 'PDP HTML does NOT have synthetic "BUTTER-CROISSANT-500G" SKU');

  // Check authoritative price ₹149 is displayed
  assert(html.includes('149'), 'PDP HTML displays authoritative price ₹149');

  // ----------------------------------------------------
  // TEST 2: Add Butter Croissant to Cart
  // ----------------------------------------------------
  console.log('\n--- 2. Testing Add to Cart for Butter Croissant ---');
  const croissPost = JSON.stringify({
    productId: 'prod_01KXYMAJKNS8AGWCN5S1WEGKSD',
    variantId: 'variant_01KXYMAN3V20SZ3SR5HX46Q9NC',
    quantity: 1,
    metadata: {
      productId: 'prod_01KXYMAJKNS8AGWCN5S1WEGKSD',
      variantId: 'variant_01KXYMAN3V20SZ3SR5HX46Q9NC',
      price: 149,
      quantity: 1,
    },
  });

  const addCroissRes = await makeRequest('/api/v1/cart/items', { method: 'POST' }, croissPost);
  assert(addCroissRes.statusCode === 200, `Add Butter Croissant returned HTTP 200 (actual: ${addCroissRes.statusCode})`);

  let cookieHeader = '';
  if (addCroissRes.headers['set-cookie']) {
    const rawCookies = addCroissRes.headers['set-cookie'];
    cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');
  }

  const croissCartData = JSON.parse(addCroissRes.data);
  assert(croissCartData.success === true, 'Cart API returned success: true');
  assert(croissCartData.cart && Array.isArray(croissCartData.cart.items), 'Cart object returned with items array');
  const croissItem = croissCartData.cart.items.find((i) => i.title.includes('Croissant'));
  assert(croissItem !== undefined, 'Butter Croissant is present in cart');
  assert(Number(croissItem.unit_price) === 149, `Croissant unit price is ₹149 (actual: ₹${croissItem.unit_price})`);
  assert(Number(croissItem.total_price) === 149, `Croissant line total is ₹149 (actual: ₹${croissItem.total_price})`);
  assert(Number(croissItem.quantity) === 1, `Croissant quantity is 1 (actual: ${croissItem.quantity})`);
  assert(croissItem.weight === null, `Croissant weight is NULL (no "1 pc", no "1 kg", actual: ${croissItem.weight})`);
  assert(croissCartData.cart.subtotal === 149, `Cart subtotal is ₹149 (actual: ₹${croissCartData.cart.subtotal})`);

  // ----------------------------------------------------
  // TEST 3: Add Chocolate Fudge Cupcake to Cart
  // ----------------------------------------------------
  console.log('\n--- 3. Testing Add to Cart for Chocolate Fudge Cupcake ---');
  const cupcakePost = JSON.stringify({
    productId: 'prod_01KXYMAJKNDZ4T2YVA7K144XP5',
    variantId: 'variant_01KXYMAN40MW6VZV49HJA15CXE',
    quantity: 1,
    metadata: {
      productId: 'prod_01KXYMAJKNDZ4T2YVA7K144XP5',
      variantId: 'variant_01KXYMAN40MW6VZV49HJA15CXE',
      price: 499,
      quantity: 1,
    },
  });

  const addCupcakeRes = await makeRequest(
    '/api/v1/cart/items',
    { method: 'POST', headers: { Cookie: cookieHeader } },
    cupcakePost
  );
  assert(addCupcakeRes.statusCode === 200, `Add Chocolate Fudge Cupcake returned HTTP 200 (actual: ${addCupcakeRes.statusCode})`);
  const cupcakeCartData = JSON.parse(addCupcakeRes.data);
  assert(cupcakeCartData.success === true, 'Cart API returned success: true (no zero price error)');
  const cupcakeItem = cupcakeCartData.cart.items.find((i) => i.title.includes('Cupcake'));
  assert(cupcakeItem !== undefined, 'Chocolate Fudge Cupcake is present in cart');
  assert(Number(cupcakeItem.unit_price) === 499, `Cupcake unit price is ₹499 (actual: ₹${cupcakeItem.unit_price})`);
  assert(cupcakeCartData.cart.subtotal === 648, `Combined subtotal is ₹648 (149 + 499 = 648, actual: ₹${cupcakeCartData.cart.subtotal})`);

  // ----------------------------------------------------
  // TEST 4: Fetch Server Cart via /api/v1/cart
  // ----------------------------------------------------
  console.log('\n--- 4. Testing Canonical Cart Fetch via GET /api/v1/cart ---');
  const getCartRes = await makeRequest('/api/v1/cart', { headers: { Cookie: cookieHeader } });
  assert(getCartRes.statusCode === 200, `GET /api/v1/cart returned HTTP 200 (actual: ${getCartRes.statusCode})`);
  const fetchedCart = JSON.parse(getCartRes.data);
  assert(fetchedCart.cart && fetchedCart.cart.items.length === 2, 'Fetched server cart has exactly 2 items');
  assert(fetchedCart.cart.subtotal === 648, `Fetched server cart subtotal is ₹648 (actual: ₹${fetchedCart.cart.subtotal})`);

  // ----------------------------------------------------
  // TEST 5: Quantity Update on Croissant (1 -> 2)
  // ----------------------------------------------------
  console.log('\n--- 5. Testing Quantity Stepper (1 -> 2) ---');
  const updatePost = JSON.stringify({
    quantity: 2,
  });
  const updateRes = await makeRequest(
    `/api/v1/cart/items/${croissItem.id}`,
    { method: 'PATCH', headers: { Cookie: cookieHeader } },
    updatePost
  );
  assert(updateRes.statusCode === 200, `Update quantity returned HTTP 200 (actual: ${updateRes.statusCode})`);
  const updatedCartData = JSON.parse(updateRes.data);
  const updatedCroiss = updatedCartData.cart.items.find((i) => i.id === croissItem.id);
  assert(updatedCroiss.quantity === 2, `Updated Croissant quantity is 2 (actual: ${updatedCroiss.quantity})`);
  assert(updatedCroiss.total_price === 298, `Updated Croissant total price is ₹298 (actual: ₹${updatedCroiss.total_price})`);
  assert(updatedCartData.cart.subtotal === 797, `Updated subtotal is ₹797 (298 + 499 = 797, actual: ₹${updatedCartData.cart.subtotal})`);

  // ----------------------------------------------------
  // TEST 6: Remove Item from Cart
  // ----------------------------------------------------
  console.log('\n--- 6. Testing Delete Line Item from Cart ---');
  const deleteRes = await makeRequest(
    `/api/v1/cart/items/${croissItem.id}`,
    { method: 'DELETE', headers: { Cookie: cookieHeader } }
  );
  assert(deleteRes.statusCode === 200, `Delete item returned HTTP 200 (actual: ${deleteRes.statusCode})`);
  const deleteCartData = JSON.parse(deleteRes.data);
  assert(deleteCartData.cart.items.length === 1, 'Cart items length is 1 after deletion');
  assert(!deleteCartData.cart.items.some((i) => i.id === croissItem.id), 'Croissant is deleted from cart');
  assert(deleteCartData.cart.subtotal === 499, `Remaining cart subtotal is ₹499 (actual: ₹${deleteCartData.cart.subtotal})`);

  console.log('\n====================================================');
  console.log(`   LIVE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
