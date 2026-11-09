const fs = require('fs');
const crypto = require('crypto');
const BASE = 'http://localhost:3001';

function signJWT(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const full = { ...payload, isSuperAdmin: true, iat: now, exp: now + 86400 };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', 'supersecret').update(`${hB64}.${pB64}`).digest('base64url');
  return `${hB64}.${pB64}.${sig}`;
}
const ADMIN_TOKEN = signJWT({ userId: 'admin_01', role: 'SUPER_ADMIN' });

async function req(path, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const ct = resp.headers.get('content-type') || '';
  const body = ct.includes('json') ? await resp.json() : await resp.text();
  return { status: resp.status, body };
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Storefront, Inventory & Cart Truthfulness Acceptance Suite');
  console.log('=============================================================================\n');

  let passed = 0;
  let total = 0;

  function record(name, pass, details = '') {
    total++;
    if (pass) {
      passed++;
      console.log(`[PASS] ${name} ${details ? '- ' + details : ''}`);
    } else {
      console.error(`[FAIL] ${name} ${details ? '- ' + details : ''}`);
    }
  }

  // 1. Products List
  console.log('--- 1. Catalog & Product Resolution ---');
  const prods = await req('/api/v1/products');
  const prodList = prods.body?.products || [];
  record('GET /api/v1/products', prods.status === 200 && prodList.length > 0, `HTTP ${prods.status} (${prodList.length} products)`);

  const sampleCake = prodList.find(p => p.metadata?.category_slug !== 'accessories') || prodList[0];
  console.log(`    Sample Cake: "${sampleCake?.title}" (id=${sampleCake?.id})`);

  // 2. Product Detail
  if (sampleCake) {
    const handle = sampleCake.handle || sampleCake.id;
    const pdp = await req(`/api/v1/products/${handle}`);
    record(`GET /api/v1/products/${handle}`, pdp.status === 200, `HTTP ${pdp.status}`);
  }

  // 3. Physical Accessories vs Made-To-Order Cakes
  console.log('\n--- 2. Physical Inventory vs Made-To-Order Fulfillment ---');
  const accs = await req('/api/v1/accessories');
  record('GET /api/v1/accessories', accs.status === 200, `HTTP ${accs.status} (${accs.body?.accessories?.length ?? 0} accessories)`);

  // 4. Cart Creation
  console.log('\n--- 3. Cart Lifecycle & Truthful Pricing ---');
  const cartRes = await req('/api/v1/cart', { method: 'POST', body: {} });
  const cart = cartRes.body?.cart;
  record('POST /api/v1/cart (Create Session Cart)', cartRes.status === 200 && !!cart?.id, `cart_id=${cart?.id}`);

  if (cart?.id && sampleCake) {
    const cartId = cart.id;
    const variantId = sampleCake.variants?.[0]?.id || `var_${sampleCake.id}`;

    // 5. Add Cake to Cart with Customization & Message
    const addRes = await req(`/api/v1/cart/items`, {
      method: 'POST',
      body: {
        cart_id: cartId,
        product_id: sampleCake.id,
        variant_id: variantId,
        quantity: 1,
        cake_message: 'Happy Birthday Vikram!',
        custom_instructions: 'Less sugar, dark chocolate drizzle',
        delivery_date: '2026-10-18',
        delivery_slot: '14:00 - 16:00',
        branch_id: 'br_indiranagar'
      }
    });
    record(
      'POST /api/v1/cart/items (Add Cake with Message & Instructions)', 
      addRes.status === 200, 
      `HTTP ${addRes.status}`
    );

    // 6. Inspect Cart State
    const getCart = await req(`/api/v1/cart/${cartId}`);
    const items = getCart.body?.cart?.items || [];
    const item = items[0];
    const hasMessage = item?.metadata?.cake_message === 'Happy Birthday Vikram!' || item?.cake_message === 'Happy Birthday Vikram!';
    record(
      'GET /api/v1/cart/:id (Customization Persistence)',
      getCart.status === 200 && items.length > 0 && hasMessage,
      `items=${items.length}, cake_message="${item?.metadata?.cake_message || item?.cake_message}"`
    );

    // 7. Update Quantity
    if (item?.id) {
      const lineId = item.id;
      const updateRes = await req(`/api/v1/cart/items/${lineId}`, {
        method: 'PUT',
        body: { quantity: 2 }
      });
      record('PUT /api/v1/cart/items/:lineItemId (Update Quantity to 2)', updateRes.status === 200, `HTTP ${updateRes.status}`);

      // 8. Delete Line Item (requires cartId query param)
      const delRes = await req(`/api/v1/cart/items/${lineId}?cartId=${cartId}`, {
        method: 'DELETE'
      });
      record('DELETE /api/v1/cart/items/:lineItemId?cartId=:id (Remove Item)', delRes.status === 200, `HTTP ${delRes.status}`);
    }
  }

  // 9. Delivery Locations / Service Area
  console.log('\n--- 4. Delivery Coverage & Service Area ---');
  const coverage = await req('/api/v1/admin/delivery-coverage/stores', {
    headers: { 'Cookie': `_cth_jwt=${ADMIN_TOKEN}; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01` }
  });
  record('GET /api/v1/admin/delivery-coverage/stores', coverage.status === 200, `HTTP ${coverage.status} (${coverage.body?.stores?.length ?? 0} stores)`);

  console.log('\n=============================================================================');
  console.log(`STOREFRONT ACCEPTANCE SUMMARY: ${passed}/${total} PASSED`);
  console.log('=============================================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
