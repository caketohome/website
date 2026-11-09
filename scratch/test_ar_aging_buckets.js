const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

function getJwtSecret() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('JWT_SECRET=')) {
      let val = line.trim().substring('JWT_SECRET='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
  return 'supersecret';
}

function createSuperAdminToken() {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { userId: 'admin_01', role: 'SUPER_ADMIN', permissions: ['*'], isSuperAdmin: true, iat: now, exp };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — End-to-End AR Aging Bucket Verification via HTTP API');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const testCustId = `cus_test_aging_${Date.now()}`;
  let testOrderId = `ord_test_aging_${Date.now()}`;
  const testInvoices = [
    { id: `inv_test_cur_${Date.now()}`, num: 'INV-TEST-CUR', due: '2026-10-25', total: 500.00 },   // CURRENT (will be fully paid)
    { id: `inv_test_130_${Date.now()}`, num: 'INV-TEST-130', due: '2026-10-01', total: 1000.00 },  // 15 days overdue -> DAYS_1_30
    { id: `inv_test_316_${Date.now()}`, num: 'INV-TEST-316', due: '2026-08-25', total: 1500.00 },  // 52 days overdue -> DAYS_31_60
    { id: `inv_test_619_${Date.now()}`, num: 'INV-TEST-619', due: '2026-07-20', total: 2000.00 },  // 88 days overdue -> DAYS_61_90
    { id: `inv_test_90p_${Date.now()}`, num: 'INV-TEST-90P', due: '2026-06-01', total: 3000.00 },  // 137 days overdue -> DAYS_90_PLUS
  ];
  const craIds = [`cra_full_${Date.now()}`, `cra_part_${Date.now()}`];

  try {
    // 1. Create temporary test customer and pick existing order id
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, company_name, email, phone, is_corporate, created_at, updated_at)
      VALUES ($1, 'Acme', 'Enterprises', 'Acme Corp Ltd', $2, '9876543210', true, NOW(), NOW())
    `, [testCustId, `billing_${Date.now()}@acme.com`]);

    const orderRes = await client.query(`
      SELECT id FROM public.order 
      WHERE id NOT IN (SELECT order_id FROM public.invoice WHERE order_id IS NOT NULL)
      LIMIT 5
    `);
    if (orderRes.rows.length < 5) throw new Error('Not enough unbilled orders in database');
    const orderIds = orderRes.rows.map(r => r.id);

    // 2. Insert test invoices with distinct due dates
    for (let i = 0; i < testInvoices.length; i++) {
      const inv = testInvoices[i];
      await client.query(`
        INSERT INTO public.invoice (
          id, invoice_number, order_id, customer_id, customer_name,
          grand_total, status, due_date, is_corporate, created_at, updated_at, delivered_at
        ) VALUES ($1, $2, $3, $4, 'Acme Corp Ltd', $5, 'POSTED', $6::date, true, '2026-06-01'::timestamp, NOW(), NOW())
      `, [inv.id, inv.num, orderIds[i], testCustId, inv.total, inv.due]);
    }

    const vchRes = await client.query("SELECT id FROM public.accounting_voucher WHERE status = 'POSTED' LIMIT 1");
    const testVoucherId = vchRes.rows[0].id;

    // 3. Full receipt allocation for invoice 0 (500)
    await client.query(`
      INSERT INTO public.customer_receipt_allocation (
        id, invoice_id, voucher_id, allocated_amount, created_at, updated_at
      ) VALUES ($1, $2, $3, 500.00, NOW(), NOW())
    `, [craIds[0], testInvoices[0].id, testVoucherId]);

    // 4. Partial receipt allocation for invoice 1 (400)
    await client.query(`
      INSERT INTO public.customer_receipt_allocation (
        id, invoice_id, voucher_id, allocated_amount, created_at, updated_at
      ) VALUES ($1, $2, $3, 400.00, NOW(), NOW())
    `, [craIds[1], testInvoices[1].id, testVoucherId]);

    console.log('[1] Seeded temporary test data for customer', testCustId);

    // 5. Query HTTP API /api/v1/admin/reports/ar/aging
    const token = createSuperAdminToken();
    const res = await fetch(`http://localhost:3001/api/v1/admin/reports/ar/aging?as_of_date=2026-10-16&customer_id=${testCustId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `_cth_jwt=${token}`
      }
    });

    const body = await res.json();
    console.log('\n[2] HTTP API Response Status:', res.status);
    console.log('    Response Summary:', JSON.stringify(body.summary, null, 2));

    const cust = body.customers?.find(c => c.customer_id === testCustId);
    if (!cust) throw new Error(`Customer ${testCustId} not found in aging response`);

    console.log('\n[3] Customer Aging Row:');
    console.log(`    - current_amount: ₹${cust.current_amount} (Expected: 0 - fully settled)`);
    console.log(`    - days_1_30:      ₹${cust.days_1_30} (Expected: 600 - 1000 minus 400 allocated)`);
    console.log(`    - days_31_60:     ₹${cust.days_31_60} (Expected: 1500)`);
    console.log(`    - days_61_90:     ₹${cust.days_61_90} (Expected: 2000)`);
    console.log(`    - days_90_plus:   ₹${cust.days_90_plus} (Expected: 3000)`);
    console.log(`    - total_outstd:   ₹${cust.total_outstanding} (Expected: 7100)`);
    console.log(`    - open_inv_count: ${cust.invoice_count} (Expected: 4 open invoices)`);

    // Invariant Assertions
    if (cust.current_amount !== 0) throw new Error(`Expected current 0, got ${cust.current_amount}`);
    if (cust.days_1_30 !== 600) throw new Error(`Expected days_1_30 600, got ${cust.days_1_30}`);
    if (cust.days_31_60 !== 1500) throw new Error(`Expected days_31_60 1500, got ${cust.days_31_60}`);
    if (cust.days_61_90 !== 2000) throw new Error(`Expected days_61_90 2000, got ${cust.days_61_90}`);
    if (cust.days_90_plus !== 3000) throw new Error(`Expected days_90_plus 3000, got ${cust.days_90_plus}`);
    if (cust.total_outstanding !== 7100) throw new Error(`Expected total 7100, got ${cust.total_outstanding}`);
    if (cust.invoice_count !== 4) throw new Error(`Expected 4 invoices, got ${cust.invoice_count}`);

    console.log('\n>>> SUCCESS: ALL AGING BUCKETS AND ALLOCATION INVARIANTS PASSED 100% <<<');
  } finally {
    // Clean up temporary test data cleanly
    console.log('\n[4] Cleaning up test records from database...');
    await client.query("DELETE FROM public.customer_receipt_allocation WHERE id = ANY($1)", [craIds]);
    await client.query("DELETE FROM public.invoice WHERE id = ANY($1)", [testInvoices.map(i => i.id)]);
    await client.query("DELETE FROM public.customer WHERE id = $1", [testCustId]);
    console.log('    Cleaned up customer, invoices, and allocations. DB baseline pristine.');
    await client.end();
  }
}

run().catch(err => {
  console.error('Test FAILED:', err);
  process.exit(1);
});

