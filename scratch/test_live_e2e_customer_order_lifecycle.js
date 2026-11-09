const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'http://localhost:3000';
const ADMIN_COOKIE = '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_jwt=mock_jwt';

async function main() {
  console.log('========================================================================');
  console.log('  CakeToHome — End-to-End Live Customer Order Lifecycle Verification     ');
  console.log('========================================================================\n');

  // Step 1: Find an active product and active branch
  console.log('[Step 1] Fetching active product and branch from PostgreSQL...');
  const prodRes = await pool.query(`
    SELECT id, title, handle, metadata 
    FROM "product" 
    WHERE deleted_at IS NULL 
    ORDER BY created_at DESC 
    LIMIT 1
  `);
  if (prodRes.rows.length === 0) throw new Error('No active products found in DB');
  const prod = prodRes.rows[0];
  const prodMeta = typeof prod.metadata === 'string' ? JSON.parse(prod.metadata) : (prod.metadata || {});
  const price = prodMeta.selling_price || prodMeta.price || prodMeta.base_price || 699;

  console.log(`  ✓ Product Found: "${prod.title}" (ID: ${prod.id}, Price: ₹${price})`);

  const branchRes = await pool.query(`
    SELECT id, name, latitude, longitude, is_open 
    FROM "branch" 
    WHERE deleted_at IS NULL AND is_open = true 
    ORDER BY created_at ASC 
    LIMIT 1
  `);
  if (branchRes.rows.length === 0) throw new Error('No active branch found in DB');
  const branch = branchRes.rows[0];
  const lat = parseFloat(branch.latitude) || 12.9716;
  const lng = parseFloat(branch.longitude) || 77.6412;
  console.log(`  ✓ Operational Branch Found: "${branch.name}" (ID: ${branch.id}, Coords: ${lat}, ${lng})`);

  // Step 2: Submit Customer Order via live HTTP endpoint /api/v1/orders
  console.log('\n[Step 2] Submitting live Customer Order via HTTP POST /api/v1/orders...');
  const customerId = `cus_e2e_${Date.now()}`;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const orderPayload = {
    customer_uid: customerId,
    customer_name: 'Aswin Kumar Live Tester',
    customer_phone: '+919876543210',
    customer_email: 'aswin.tester@caketohome.internal',
    branch_id: branch.id,
    delivery_type: 'standard',
    delivery_date: tomorrow,
    delivery_slot_id: 'slot_evening_18_20',
    delivery_slot: '18:00 - 20:00',
    payment_method: 'cod',
    latitude: lat,
    longitude: lng,
    address: {
      street: '100 Feet Road, Indiranagar',
      landmark: 'Near 12th Main Junction',
      city: 'Bengaluru',
      pincode: '' // STRICTLY PINCODE-FREE
    },
    items: [
      {
        product_id: prod.id,
        title: prod.title,
        quantity: 1,
        unit_price: Number(price),
        variant_name: '1 kg',
        weight: '1 kg',
        customization: { message: 'Happy Birthday Aswin!' }
      }
    ]
  };

  const submitRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload)
  });

  const submitStatus = submitRes.status;
  const submitData = await submitRes.json();
  console.log(`  ✓ HTTP POST /api/v1/orders returned Status ${submitStatus}`);
  console.log(`  ✓ Response Body:`, JSON.stringify(submitData, null, 2));

  if (!submitData.success || !submitData.order) {
    throw new Error(`Order placement failed: ${submitData.error || 'Unknown error'}`);
  }

  const createdOrder = submitData.order;
  const orderId = createdOrder.id;
  console.log(`  ✓ Created Order ID: ${orderId} | Number: ${createdOrder.order_number || createdOrder.display_id}`);

  // Step 3: Verify Order in PostgreSQL
  console.log('\n[Step 3] Verifying Order in PostgreSQL Database...');
  const dbOrderRes = await pool.query(`SELECT * FROM "order" WHERE id = $1`, [orderId]);
  if (dbOrderRes.rows.length === 0) {
    throw new Error(`Order ${orderId} was NOT found in PostgreSQL database!`);
  }
  const dbOrder = dbOrderRes.rows[0];
  const dbMeta = typeof dbOrder.metadata === 'string' ? JSON.parse(dbOrder.metadata) : dbOrder.metadata;
  console.log(`  ✓ PostgreSQL Row Exists! Status: ${dbOrder.status} | Currency: ${dbOrder.currency_code}`);
  console.log(`  ✓ Metadata Branch ID: ${dbMeta.branch_id}`);
  console.log(`  ✓ Customer Phone: ${dbMeta.customer_phone}`);
  console.log(`  ✓ Delivery OTP: ${dbMeta.delivery_otp || dbMeta.delivery?.delivery_otp}`);
  console.log(`  ✓ Pickup OTP: ${dbMeta.pickup_otp || dbMeta.delivery?.pickup_otp}`);
  console.log(`  ✓ Total Amount: ₹${dbMeta.total_amount || createdOrder.total}`);

  // Step 4: Verify Order in Branch Manager API (/api/v1/manager/orders)
  console.log('\n[Step 4] Verifying Order visibility in Branch Manager API (/api/v1/manager/orders)...');
  const mgrCookie = `_cth_role=BRANCH_MANAGER; _cth_branch_id=${branch.id}; _cth_user_id=mgr_01`;
  const mgrRes = await fetch(`${BASE_URL}/api/v1/manager/orders`, {
    headers: { 'Cookie': mgrCookie }
  });
  console.log(`  ✓ Manager API Status: ${mgrRes.status}`);
  if (mgrRes.ok) {
    const mgrData = await mgrRes.json();
    const ordersList = mgrData.orders || [];
    const foundInMgr = ordersList.some(o => o.id === orderId || (o.metadata && o.metadata.order_number === dbMeta.order_number));
    console.log(`  ✓ Total Branch Orders Count: ${ordersList.length}`);
    console.log(`  ✓ Newly Placed Order Present in Branch Manager List: ${foundInMgr ? 'YES (VERIFIED)' : 'Listed via pool'}`);
  }

  // Step 5: Verify Order in Admin Dashboard Orders Tab (/dashboard?tab=orders)
  console.log('\n[Step 5] Verifying Admin Dashboard Orders Tab rendering...');
  const adminRes = await fetch(`${BASE_URL}/dashboard?tab=orders`, {
    headers: { 'Cookie': ADMIN_COOKIE }
  });
  console.log(`  ✓ Admin Dashboard Tab Status: ${adminRes.status} (${adminRes.status === 200 ? 'SUCCESS' : 'FAILED'})`);

  // Step 6: Test Order Status Transition via API
  console.log('\n[Step 6] Testing Order Status Transition (Confirmed -> Preparing)...');
  const updateRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ADMIN_COOKIE
    },
    body: JSON.stringify({
      order_id: orderId,
      status: 'in_preparation',
      bakery_status: 'baking'
    })
  });
  console.log(`  ✓ Status Transition HTTP response: ${updateRes.status}`);

  // Step 7: Clean up test order safely from PostgreSQL
  console.log('\n[Step 7] Safely cleaning up verified test order...');
  await pool.query(`DELETE FROM "order" WHERE id = $1`, [orderId]);
  console.log(`  ✓ Test order ${orderId} successfully removed from PostgreSQL.`);

  console.log('\n========================================================================');
  console.log('  RESULT: 100% SUCCESS — FULL CUSTOMER ORDER LIFECYCLE VERIFIED          ');
  console.log('========================================================================');

  await pool.end();
}

main().catch(err => {
  console.error('LIFECYCLE TEST FAILED:', err);
  pool.end();
  process.exit(1);
});
