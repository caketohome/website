/**
 * CakeToHome - Branch Manager Cake Availability Control Test Suite (Phase X)
 * Verifies server-side authorization, PostgreSQL persistence, branch isolation,
 * PDP reflection, cart/checkout enforcement, and independent accessory stock.
 */

const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const http = require('http');

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false },
});

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const port = u.port || process.env.PORT || 3001;
    const req = http.request({
      hostname: u.hostname,
      port: port === '3000' && process.env.PORT ? process.env.PORT : (port === '3000' ? 3001 : port),
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, text: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('  CakeToHome — Branch Manager Cake Availability Control Test Suite       ');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS ${passed + 1}] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL ${total}] ${message}`);
    }
  }

  try {
    // 1. Dynamically discover two operational branches
    const branchRes = await pool.query(`
      SELECT id, name, code, is_open, metadata
      FROM branch
      WHERE deleted_at IS NULL AND is_open = true
      ORDER BY created_at ASC
      LIMIT 2
    `);
    assert(branchRes.rows.length >= 2, `Discovered 2 operational branches: ${branchRes.rows[0]?.name} (${branchRes.rows[0]?.id}) and ${branchRes.rows[1]?.name} (${branchRes.rows[1]?.id})`);
    const branchA = branchRes.rows[0];
    const branchB = branchRes.rows[1];

    // 2. Dynamically discover a made-to-order cake
    const cakeRes = await pool.query(`
      SELECT p.id, p.title, p.handle, pv.id as variant_id,
             COALESCE((p.metadata->>'selling_price')::numeric, 549) as price
      FROM product p
      JOIN product_variant pv ON pv.product_id = p.id
      WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'MADE_TO_ORDER_AVAILABILITY' OR p.metadata->>'category_slug' != 'accessories')
        AND p.id NOT LIKE 'acc_%'
        AND p.deleted_at IS NULL
      ORDER BY p.id ASC
      LIMIT 1
    `);
    assert(cakeRes.rows.length > 0, `Discovered made-to-order cake: ${cakeRes.rows[0]?.title} (${cakeRes.rows[0]?.id})`);
    const cake = cakeRes.rows[0];

    // 3. Dynamically discover physical accessory for interaction testing
    const accRes = await pool.query(`
      SELECT p.id, p.title, pv.id as variant_id,
             COALESCE((p.metadata->>'selling_price')::numeric, 99) as price
      FROM product p
      JOIN product_variant pv ON pv.product_id = p.id
      WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'STOCK_CONTROLLED' OR p.metadata->>'category_slug' = 'accessories')
        AND p.deleted_at IS NULL
      ORDER BY p.id ASC
      LIMIT 1
    `);
    assert(accRes.rows.length > 0, `Discovered physical accessory: ${accRes.rows[0]?.title} (${accRes.rows[0]?.id})`);
    const accessory = accRes.rows[0];

    // Ensure initial baseline: Cake is AVAILABLE at both branches
    await pool.query(`
      UPDATE branch
      SET metadata = jsonb_set(
        jsonb_set(COALESCE(metadata, '{}'::jsonb), '{product_availability, ${cake.id}}', '{"status": "AVAILABLE"}'),
        '{cake_fulfilment, ${cake.id}}', '{"can_fulfil": true}'
      ),
      updated_at = NOW()
      WHERE id IN ($1, $2)
    `, [branchA.id, branchB.id]);

    // Test A & B: Manager Authentication and Branch Authorization
    // Unauthorized user attempts mutation
    const unauthMut = await fetchJson(`http://localhost:3000/api/v1/branches/${branchB.id}/products/${cake.id}/availability`, {
      method: 'PATCH',
      body: { status: 'OFF', reason: 'Unauthenticated attempt' },
    });
    assert(unauthMut.status === 401 || unauthMut.status === 403, `Unauthenticated request rejected with ${unauthMut.status}`);

    // Test J: Manager A attempts to mutate Branch B (Cross-branch modification rejection)
    // Manager A has session credentials for branchA.id
    const crossBranchMut = await fetchJson(`http://localhost:3000/api/v1/branches/${branchB.id}/products/${cake.id}/availability`, {
      method: 'PATCH',
      headers: {
        'x-user-id': `shpmgr_${branchA.id.replace(/^br_/, '')}`,
        'x-branch-id': branchA.id,
        'x-user-role': 'branch_manager',
      },
      body: { status: 'OFF', reason: 'Cross branch attack' },
    });
    assert(crossBranchMut.status === 403, `Manager A rejected with 403 Forbidden when mutating Branch B (Status: ${crossBranchMut.status})`);

    // Verify Branch B state remained unchanged after rejected attack
    const checkBPostgres1 = await pool.query(`SELECT metadata FROM branch WHERE id = $1`, [branchB.id]);
    const bAvail1 = checkBPostgres1.rows[0]?.metadata?.product_availability?.[cake.id];
    assert(!bAvail1 || (bAvail1.status || '').toUpperCase() !== 'OFF', `Branch B availability remained unchanged in PostgreSQL after cross-branch rejection`);

    // Test C: Manager B turns cake OFF at Branch B
    const managerBMut = await fetchJson(`http://localhost:3000/api/v1/branches/${branchB.id}/products/${cake.id}/availability`, {
      method: 'PATCH',
      headers: {
        'x-user-id': `shpmgr_${branchB.id.replace(/^br_/, '')}`,
        'x-branch-id': branchB.id,
        'x-user-role': 'branch_manager',
      },
      body: { status: 'OFF', reason: 'Oven under scheduled cleaning' },
    });
    assert(managerBMut.status === 200 && managerBMut.data?.success, `Manager B successfully turned cake OFF at Branch B`);

    // Test D: PostgreSQL Persistence
    const checkBPostgres2 = await pool.query(`SELECT metadata FROM branch WHERE id = $1`, [branchB.id]);
    const bAvail2 = checkBPostgres2.rows[0]?.metadata?.product_availability?.[cake.id];
    assert(bAvail2 && (bAvail2.status || '').toUpperCase() === 'UNAVAILABLE', `PostgreSQL contains persisted UNAVAILABLE state for Branch B`);

    // Test E: Branch Isolation (Branch A MUST remain AVAILABLE)
    const checkAPostgres = await pool.query(`SELECT metadata FROM branch WHERE id = $1`, [branchA.id]);
    const aAvail = checkAPostgres.rows[0]?.metadata?.product_availability?.[cake.id];
    assert(!aAvail || (aAvail.status || '').toUpperCase() === 'AVAILABLE', `Branch A remains AVAILABLE in PostgreSQL while Branch B is OFF`);

    // Test F: PDP Branch-Specific State
    const pdpResA = await fetchJson(`http://localhost:3000/api/v1/products/${cake.handle || cake.id}?branch_id=${branchA.id}`);
    const pdpResB = await fetchJson(`http://localhost:3000/api/v1/products/${cake.handle || cake.id}?branch_id=${branchB.id}`);

    assert(pdpResA.data?.is_out_of_stock_at_branch !== true, `PDP for Branch A shows cake is available`);
    assert(pdpResB.data?.is_out_of_stock_at_branch === true, `PDP for Branch B shows cake is out of stock / unavailable`);

    // Test G: Add-to-Cart Enforcement
    const cartCreateA = await fetchJson(`http://localhost:3000/api/v1/cart`, { method: 'POST' });
    const cartIdA = cartCreateA.data?.cart?.id || cartCreateA.data?.id || 'cart_test_avail_A';

    const cartAddA = await fetchJson(`http://localhost:3000/api/v1/cart/items`, {
      method: 'POST',
      body: {
        cart_id: cartIdA,
        variant_id: cake.variant_id,
        product_id: cake.id,
        quantity: 1,
        branch_id: branchA.id,
      },
    });
    assert(cartAddA.status === 200 && cartAddA.data?.success !== false, `Add to Cart succeeds for Branch A where cake is ON`);

    const cartCreateB = await fetchJson(`http://localhost:3000/api/v1/cart`, { method: 'POST' });
    const cartIdB = cartCreateB.data?.cart?.id || cartCreateB.data?.id || 'cart_test_avail_B';

    const cartAddB = await fetchJson(`http://localhost:3000/api/v1/cart/items`, {
      method: 'POST',
      body: {
        cart_id: cartIdB,
        variant_id: cake.variant_id,
        product_id: cake.id,
        quantity: 1,
        branch_id: branchB.id,
      },
    });
    assert(cartAddB.status >= 400 || !cartAddB.data?.success, `Add to Cart rejected for Branch B where cake is OFF (Status: ${cartAddB.status})`);

    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Test H: Checkout Enforcement (Order creation revalidation)
    // Order for Branch A succeeds
    const orderA = await fetchJson(`http://localhost:3000/api/v1/orders`, {
      method: 'POST',
      body: {
        branch_id: branchA.id,
        customer_name: 'Branch A Customer',
        customer_phone: '+919876543210',
        payment_method: 'cod',
        delivery_type: 'standard',
        delivery_date: tomorrowStr,
        delivery_slot: '12:00 - 14:00',
        delivery_address: 'Address in Area A',
        items: [
          {
            product_id: cake.id,
            variant_id: cake.variant_id,
            quantity: 1,
            unit_price: Number(cake.price),
          },
        ],
      },
    });
    assert((orderA.status === 200 || orderA.status === 201) && orderA.data?.success, `Order creation succeeds for Branch A: ${orderA.data?.order?.id}`);

    // Order for Branch B MUST be rejected at checkout even if someone bypasses cart
    const orderB = await fetchJson(`http://localhost:3000/api/v1/orders`, {
      method: 'POST',
      body: {
        branch_id: branchB.id,
        customer_name: 'Branch B Customer',
        customer_phone: '+919876543210',
        payment_method: 'cod',
        delivery_type: 'standard',
        delivery_date: tomorrowStr,
        delivery_slot: '12:00 - 14:00',
        delivery_address: 'Address in Area B',
        items: [
          {
            product_id: cake.id,
            variant_id: cake.variant_id,
            quantity: 1,
            unit_price: Number(cake.price),
          },
        ],
      },
    });
    assert(orderB.status >= 400 || !orderB.data?.success, `Order creation strictly rejected for Branch B where cake is OFF`);

    // Test I: Re-enable Behavior (Manager B turns cake back ON)
    const managerBReenable = await fetchJson(`http://localhost:3000/api/v1/branches/${branchB.id}/products/${cake.id}/availability`, {
      method: 'PATCH',
      headers: {
        'x-user-id': `shpmgr_${branchB.id.replace(/^br_/, '')}`,
        'x-branch-id': branchB.id,
        'x-user-role': 'branch_manager',
      },
      body: { status: 'ON', reason: 'Oven cleaning completed' },
    });
    assert(managerBReenable.status === 200 && managerBReenable.data?.success, `Manager B successfully turned cake back ON at Branch B`);

    // Verify PDP and Add to Cart now succeed for Branch B
    const pdpResB2 = await fetchJson(`http://localhost:3000/api/v1/products/${cake.handle || cake.id}?branch_id=${branchB.id}`);
    assert(pdpResB2.data?.is_out_of_stock_at_branch !== true, `PDP for Branch B shows cake is available again after turning ON`);

    // Test K: Physical Accessory Interaction
    // Ensure accessory stock at Branch A
    const invAId = `binv_${branchA.id}_${accessory.variant_id}`.slice(0, 60);
    await pool.query(`
      INSERT INTO branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 10, 0, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET quantity = 10, reserved = 0, updated_at = NOW(), deleted_at = NULL
    `, [invAId, branchA.id, accessory.id, accessory.variant_id]);

    const orderCakeAndAcc = await fetchJson(`http://localhost:3000/api/v1/orders`, {
      method: 'POST',
      body: {
        branch_id: branchA.id,
        customer_name: 'Combo Buyer',
        customer_phone: '+919876543210',
        payment_method: 'cod',
        delivery_type: 'standard',
        delivery_date: tomorrowStr,
        delivery_slot: '14:00 - 16:00',
        delivery_address: '123 Test Street, Bengaluru',
        items: [
          {
            product_id: cake.id,
            variant_id: cake.variant_id,
            quantity: 1,
            unit_price: Number(cake.price),
            customization: {
              selected_addons_detail: [
                {
                  id: accessory.id,
                  product_id: accessory.id,
                  variant_id: accessory.variant_id,
                  title: accessory.title,
                  price: Number(accessory.price),
                  quantity: 1,
                },
              ],
            },
          },
        ],
      },
    });
    assert((orderCakeAndAcc.status === 200 || orderCakeAndAcc.status === 201) && orderCakeAndAcc.data?.success, `Combo order succeeded: Cake (made-to-order) + Accessory Topper (stock-controlled)`);

    const accStockAfter = await pool.query(`SELECT quantity FROM branch_inventory WHERE id = $1`, [invAId]);
    assert(Number(accStockAfter.rows[0].quantity) === 9, `Accessory stock accurately deducted from 10 to 9 on combo order`);

    // Test L: Cake Availability Report Correctness
    const reportRes = await fetchJson(`http://localhost:3000/api/v1/admin/reports/cake-availability`);
    assert(reportRes.status === 200 && reportRes.data?.matrix, `Cake availability matrix report retrieved successfully`);
    const matrixEntryA = (reportRes.data.matrix || []).find(m => m.branch_id === branchA.id && m.product_id === cake.id);
    const matrixEntryB = (reportRes.data.matrix || []).find(m => m.branch_id === branchB.id && m.product_id === cake.id);
    assert(matrixEntryA && matrixEntryA.is_available, `Report reflects Branch A Cake is available`);
    assert(matrixEntryB && matrixEntryB.is_available, `Report reflects Branch B Cake is available`);

  } catch (err) {
    console.error('Fatal error during test run:', err);
    assert(false, `Unexpected error: ${err.message}`);
  } finally {
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(`  Cake Availability Suite Completed: ${passed}/${total} assertions passed`);
  console.log('========================================================================\n');

  if (passed < total) process.exit(1);
}

run();
