const http = require('http');

async function testCart() {
  console.log('--- 1. Testing Add to Cart with Chocolate Fudge Cupcake (prod_01KXYMAJKNDZ4T2YVA7K144XP5) ---');
  
  const postData = JSON.stringify({
    productId: 'prod_01KXYMAJKNDZ4T2YVA7K144XP5',
    variantId: 'variant_01KXYMAJKNDZ4T2YVA7K144XP5',
    quantity: 1,
    metadata: {
      productId: 'prod_01KXYMAJKNDZ4T2YVA7K144XP5',
      variantId: 'variant_01KXYMAJKNDZ4T2YVA7K144XP5',
      price: 499,
      quantity: 1
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/cart/items',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const resData = await new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data, cookies }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  console.log('Response Status:', resData.statusCode);
  console.log('Response Body:', resData.data.slice(0, 500));
  console.log('Cookies Set:', resData.cookies);

  let cartCookie = '';
  if (resData.cookies) {
    const cthCookie = resData.cookies.find(c => c.includes('_cth_cart_id'));
    if (cthCookie) {
      cartCookie = cthCookie.split(';')[0];
    }
  }

  const parsed = JSON.parse(resData.data);
  if (parsed.success && parsed.cart && parsed.cart.items && parsed.cart.items.length > 0) {
    const item = parsed.cart.items[0];
    console.log('✅ Success! Cart item added:');
    console.log('   - ID:', item.id);
    console.log('   - Title:', item.title || item.name);
    console.log('   - Unit Price:', item.unit_price || item.price);
    console.log('   - Quantity:', item.quantity);
    console.log('   - Subtotal:', parsed.cart.subtotal);
  } else {
    console.error('❌ Failed! Cart did not contain expected items:', parsed);
  }

  // Test 2: Verify zero-price rejection
  console.log('\n--- 2. Testing Invalid / Zero-Price Rejection ---');
  const zeroPriceData = JSON.stringify({
    productId: 'fake_zero_prod',
    variantId: 'fake_zero_variant',
    quantity: 1,
    metadata: {
      productId: 'fake_zero_prod',
      variantId: 'fake_zero_variant',
      price: 0,
      quantity: 1
    }
  });

  const zeroRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/cart/items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(zeroPriceData),
        ...(cartCookie ? { 'Cookie': cartCookie } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(zeroPriceData);
    req.end();
  });

  console.log('Zero Price Response Status:', zeroRes.statusCode);
  console.log('Zero Price Response Body:', zeroRes.data);
  const zeroParsed = JSON.parse(zeroRes.data);
  if (zeroRes.statusCode === 400 || zeroParsed.error) {
    console.log('✅ Rejection verified! Zero-price item was safely rejected by server with message:', zeroParsed.error);
  } else {
    console.error('❌ Zero-price item was not rejected!');
  }
}

testCart().catch(console.error);
