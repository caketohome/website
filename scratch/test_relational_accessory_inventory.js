/**
 * CakeToHome - Relational Physical Accessory Inventory Verification Suite
 * Tests PostgreSQL branch_inventory authority, atomic deduction, branch isolation, and cake+addon separation.
 */

const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const http = require('http');

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 3000,
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
  console.log('  CakeToHome — Relational Accessory Inventory Authority Test Suite      ');
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
    // 1. Discover real physical accessory dynamically
    const accRes = await pool.query(`
      SELECT p.id, p.title, pv.id as variant_id, pv.sku,
             COALESCE((p.metadata->>'selling_price')::numeric, 99) as price
      FROM product p
      JOIN product_variant pv ON pv.product_id = p.id
      WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'STOCK_CONTROLLED' OR p.metadata->>'category_slug' = 'accessories')
        AND p.deleted_at IS NULL
      ORDER BY p.id ASC
      LIMIT 1
    `);
    assert(accRes.rows.length > 0, `Discovered real physical accessory: ${accRes.rows[0]?.title} (${accRes.rows[0]?.id})`);
    const accessory = accRes.rows[0];

    // 2. Discover two real operational branches dynamically
    const branchRes = await pool.query(`
      SELECT id, name, code, is_open, metadata
      FROM branch
      WHERE deleted_at IS NULL AND is_open = true
      ORDER BY created_at ASC
      LIMIT 2
    `);
    assert(branchRes.rows.length >= 2, `Discovered 2 operational branches: ${branchRes.rows[0]?.name} and ${branchRes.rows[1]?.name}`);
    const branchA = branchRes.rows[0];
    const branchB = branchRes.rows[1];

    // 3. Discover a real made-to-order cake
    const cakeRes = await pool.query(`
      SELECT p.id, p.title, pv.id as variant_id,
             COALESCE((p.metadata->>'selling_price')::numeric, 500) as price
      FROM product p
      JOIN product_variant pv ON pv.product_id = p.id
      WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'MADE_TO_ORDER_AVAILABILITY' OR p.metadata->>'category_slug' != 'accessories')
        AND p.id NOT LIKE 'acc_%'
        AND p.deleted_at IS NULL
      ORDER BY p.id ASC
      LIMIT 1
    `);
    assert(cakeRes.rows.length > 0, `Discovered real made-to-order cake: ${cakeRes.rows[0]?.title} (${cakeRes.rows[0]?.id})`);
    const cake = cakeRes.rows[0];

    // 4. Set controlled opening stock in PostgreSQL branch_inventory
    // Branch A: 45 units. Branch B: 0 units.
    const invAId = `binv_${branchA.id}_${accessory.variant_id}`.slice(0, 60);
    const invBId = `binv_${branchB.id}_${accessory.variant_id}`.slice(0, 60);

    await pool.query(`
      INSERT INTO branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 45, 0, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET quantity = 45, reserved = 0, updated_at = NOW(), deleted_at = NULL
    `, [invAId, branchA.id, accessory.id, accessory.variant_id]);

    await pool.query(`
      INSERT INTO branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 0, 0, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET quantity = 0, reserved = 0, updated_at = NOW(), deleted_at = NULL
    `, [invBId, branchB.id, accessory.id, accessory.variant_id]);

    // 5. Read stock directly from PostgreSQL
    const pgStockA = await pool.query(`SELECT quantity, reserved FROM branch_inventory WHERE id = $1`, [invAId]);
    const pgStockB = await pool.query(`SELECT quantity, reserved FROM branch_inventory WHERE id = $1`, [invBId]);
    assert(Number(pgStockA.rows[0].quantity) === 45, `PostgreSQL branch_inventory for Branch A has quantity 45`);
    assert(Number(pgStockB.rows[0].quantity) === 0, `PostgreSQL branch_inventory for Branch B has quantity 0`);

    // 6. Read stock through API for both branches
    const apiA = await fetchJson(`http://localhost:3000/api/v1/accessories?branchId=${branchA.id}`);
    const apiB = await fetchJson(`http://localhost:3000/api/v1/accessories?branchId=${branchB.id}`);

    const itemInA = (apiA.data?.accessories || []).find(a => a.id === accessory.id || a.variant_id === accessory.variant_id);
    const itemInB = (apiB.data?.accessories || []).find(a => a.id === accessory.id || a.variant_id === accessory.variant_id);

    assert(itemInA && (itemInA.available_stock === 45 || itemInA.stock === 45), `API reflects Branch A stock = 45 (got ${itemInA?.available_stock})`);
    assert(itemInB && (itemInB.available_stock === 0 || itemInB.stock === 0), `API reflects Branch B stock = 0 (got ${itemInB?.available_stock})`);

    // 7. Branch isolation: Selecting Branch B must NEVER display 45
    assert(itemInA.available_stock !== itemInB.available_stock, `Branch isolation confirmed: Branch A (45) != Branch B (0)`);

    // 8. Add accessory to cart for Branch A (succeeds)
    const cartCreate = await fetchJson(`http://localhost:3000/api/v1/cart`, { method: 'POST' });
    const cartId = cartCreate.data?.cart?.id || cartCreate.data?.id || 'cart_test_inv_01';

    const cartAddA = await fetchJson(`http://localhost:3000/api/v1/cart/items`, {
      method: 'POST',
      body: {
        cart_id: cartId,
        variant_id: accessory.variant_id,
        product_id: accessory.id,
        quantity: 1,
        branch_id: branchA.id,
      },
    });
    assert(cartAddA.status === 200 && cartAddA.data?.success !== false, `Add accessory to cart for Branch A succeeds`);

    // 9. Add accessory to cart for Branch B with stock=0 (rejected)
    const cartAddB = await fetchJson(`http://localhost:3000/api/v1/cart/items`, {
      method: 'POST',
      body: {
        cart_id: cartId,
        variant_id: accessory.variant_id,
        product_id: accessory.id,
        quantity: 1,
        branch_id: branchB.id,
      },
    });
    assert(cartAddB.status >= 400 || cartAddB.data?.error || cartAddB.data?.success === false, `Add accessory to cart for Branch B rejected due to 0 stock`);

    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // 10. Place an order containing Cake + attached physical Topper at Branch A
    const orderRes = await fetchJson(`http://localhost:3000/api/v1/orders`, {
      method: 'POST',
      body: {
        branch_id: branchA.id,
        customer_name: 'Inventory Test Customer',
        customer_phone: '+919876543210',
        customer_email: 'invtest@caketohome.com',
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
              selected_addons: [accessory.title],
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

    assert((orderRes.status === 200 || orderRes.status === 201) && orderRes.data?.success, `Order placed successfully with Cake + attached Topper: ${orderRes.data?.order?.id}`);

    // 11. Confirm Cake receives NO inventory deduction
    const cakeInvCheck = await pool.query(
      `SELECT * FROM branch_inventory WHERE branch_id = $1 AND (product_id = $2 OR variant_id = $2)`,
      [branchA.id, cake.id]
    );
    assert(cakeInvCheck.rows.length === 0, `Cake has NO physical stock record or synthetic deduction in branch_inventory`);

    // 12. Confirm Topper receives exactly one physical deduction (45 -> 44)
    const topperStockAfter = await pool.query(
      `SELECT quantity, reserved FROM branch_inventory WHERE id = $1`,
      [invAId]
    );
    const remainingStock = Number(topperStockAfter.rows[0].quantity);
    assert(remainingStock === 44, `Topper stock in PostgreSQL accurately deducted from 45 to 44 (got ${remainingStock})`);

    // 13. Attempt oversell (request 100 units when 44 available)
    const oversellRes = await fetchJson(`http://localhost:3000/api/v1/orders`, {
      method: 'POST',
      body: {
        branch_id: branchA.id,
        customer_name: 'Oversell Tester',
        customer_phone: '+919876543210',
        payment_method: 'cod',
        delivery_type: 'standard',
        delivery_date: tomorrowStr,
        delivery_slot: '14:00 - 16:00',
        delivery_address: '123 Test Street, Bengaluru',
        items: [
          {
            product_id: accessory.id,
            variant_id: accessory.variant_id,
            quantity: 100,
            unit_price: Number(accessory.price),
          },
        ],
      },
    });
    assert(oversellRes.status >= 400 || !oversellRes.data?.success, `Oversell order rejected (Status: ${oversellRes.status}, Error: ${oversellRes.data?.error})`);

    // 14. Confirm stock did not go negative and remained 44
    const stockCheckAfterOversell = await pool.query(
      `SELECT quantity FROM branch_inventory WHERE id = $1`,
      [invAId]
    );
    assert(Number(stockCheckAfterOversell.rows[0].quantity) === 44, `PostgreSQL stock unchanged at 44 after rejected oversell`);

    // 15. Concurrency test: Set stock to 1, fire two competing orders
    await pool.query(`UPDATE branch_inventory SET quantity = 1, reserved = 0 WHERE id = $1`, [invAId]);

    const orderPayload = {
      branch_id: branchA.id,
      customer_name: 'Concurrent Buyer',
      customer_phone: '+919876543210',
      payment_method: 'cod',
      delivery_type: 'standard',
      delivery_date: tomorrowStr,
      delivery_slot: '14:00 - 16:00',
      delivery_address: '123 Test Street, Bengaluru',
      items: [
        {
          product_id: accessory.id,
          variant_id: accessory.variant_id,
          quantity: 1,
          unit_price: Number(accessory.price),
        },
      ],
    };

    const [orderA1, orderA2] = await Promise.all([
      fetchJson(`http://localhost:3000/api/v1/orders`, { method: 'POST', body: orderPayload }),
      fetchJson(`http://localhost:3000/api/v1/orders`, { method: 'POST', body: orderPayload }),
    ]);

    const successCount = (orderA1.data?.success ? 1 : 0) + (orderA2.data?.success ? 1 : 0);
    const failCount = (!orderA1.data?.success ? 1 : 0) + (!orderA2.data?.success ? 1 : 0);

    assert(successCount === 1 && failCount === 1, `Concurrency test: Exactly 1 order succeeded and 1 failed (Success: ${successCount}, Failed: ${failCount})`);

    const stockAfterConcurrent = await pool.query(`SELECT quantity FROM branch_inventory WHERE id = $1`, [invAId]);
    assert(Number(stockAfterConcurrent.rows[0].quantity) === 0, `Stock reached exactly 0 without overselling or negative quantity`);

    // 16. Inventory report reflects PostgreSQL stock
    const reportRes = await fetchJson(`http://localhost:3000/api/v1/admin/reports/inventory?branch_id=${branchA.id}`);
    assert(reportRes.status === 200 && reportRes.data?.success !== false, `Inventory report returned 200`);
    const reportedItem = (reportRes.data?.items || []).find(i => i.product_id === accessory.id);
    assert(reportedItem && reportedItem.stock === 0, `Inventory report reflects PostgreSQL stock 0 for tested accessory`);

  } catch (err) {
    console.error('Fatal error during test run:', err);
    assert(false, `Unexpected error: ${err.message}`);
  } finally {
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(`  Relational Inventory Suite Completed: ${passed}/${total} assertions passed`);
  console.log('========================================================================\n');

  if (passed < total) process.exit(1);
}

run();
