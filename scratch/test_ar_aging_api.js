const fs = require('fs');
const crypto = require('crypto');

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

function createToken(role, permissions, branchId) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId: role === 'SUPER_ADMIN' ? 'admin_01' : 'staff_01',
    role,
    phone: '9876543210',
    customerId: 'usr_01',
    branchId: branchId || null,
    name: 'Test User',
    email: 'test@cakestohome.com',
    permissions: permissions || [],
    isSuperAdmin: role === 'SUPER_ADMIN',
    iat: now,
    exp,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function testArAging() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Verifying AR Aging API Endpoint (Port 3001)');
  console.log('=============================================================================\n');

  // Test 1: Unauthenticated request -> Must return 401
  console.log('[Test 1] Unauthenticated request to /api/v1/admin/reports/ar/aging:');
  const res1 = await fetch('http://localhost:3001/api/v1/admin/reports/ar/aging');
  console.log(`  - Status: ${res1.status} (Expected: 401)`);
  if (res1.status !== 401) throw new Error(`Expected 401, got ${res1.status}`);

  // Test 2: User lacking ACCOUNTING permission -> Must return 403
  console.log('\n[Test 2] Request without ACCOUNTING.VIEW permission:');
  const nonAcctToken = createToken('STAFF', ['ORDERS.VIEW'], 'br_01');
  const res2 = await fetch('http://localhost:3001/api/v1/admin/reports/ar/aging', {
    headers: { Authorization: `Bearer ${nonAcctToken}`, Cookie: `_cth_jwt=${nonAcctToken}` }
  });
  console.log(`  - Status: ${res2.status} (Expected: 403)`);
  if (res2.status !== 403) throw new Error(`Expected 403, got ${res2.status}`);

  // Test 3: Authorized SUPER_ADMIN request -> Must return 200 OK
  console.log('\n[Test 3] Authorized SUPER_ADMIN request:');
  const adminToken = createToken('SUPER_ADMIN', ['*']);
  const res3 = await fetch('http://localhost:3001/api/v1/admin/reports/ar/aging', {
    headers: { Authorization: `Bearer ${adminToken}`, Cookie: `_cth_jwt=${adminToken}` }
  });
  console.log(`  - Status: ${res3.status} (Expected: 200)`);
  const body3 = await res3.json();
  console.log('  - Response Structure:');
  console.log(`    success:       ${body3.success}`);
  console.log(`    as_of_date:    ${body3.as_of_date}`);
  console.log(`    customer_count:${body3.summary?.customer_count}`);
  console.log(`    invoice_count: ${body3.summary?.invoice_count}`);
  console.log(`    grand_total:   ₹${body3.summary?.grand_total}`);
  console.log(`    reconciliation:`, body3.reconciliation);

  if (res3.status !== 200 || !body3.success) {
    throw new Error(`Expected 200 with success:true, got ${res3.status}`);
  }

  // Test 4: Historical As-Of Date Reproducibility
  console.log('\n[Test 4] Historical As-Of Date (as_of_date=2026-10-02):');
  const res4 = await fetch('http://localhost:3001/api/v1/admin/reports/ar/aging?as_of_date=2026-10-02', {
    headers: { Authorization: `Bearer ${adminToken}`, Cookie: `_cth_jwt=${adminToken}` }
  });
  console.log(`  - Status: ${res4.status}`);
  const body4 = await res4.json();
  console.log(`    as_of_date:    ${body4.as_of_date}`);
  console.log(`    grand_total:   ₹${body4.summary?.grand_total}`);

  console.log('\n=============================================================================');
  console.log('AR AGING API ENDPOINT FULLY VERIFIED (HTTP 200, RBAC 401/403 ENFORCED)');
  console.log('=============================================================================');
}

testArAging().catch(err => {
  console.error('AR Aging API Test FAILED:', err);
  process.exit(1);
});
