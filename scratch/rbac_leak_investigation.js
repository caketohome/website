/**
 * Focused RBAC leak investigation
 */
const crypto = require('crypto');
const BASE = 'http://localhost:3000';
const JWT_SECRET = 'supersecret';

function signJWT(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const full = { ...payload, iat: now, exp: now + 86400 };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${hB64}.${pB64}`).digest('base64url');
  return `${hB64}.${pB64}.${sig}`;
}

async function api(path, token) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'Cookie': `_cth_jwt=${token}` },
    redirect: 'manual'
  });
  const ct = resp.headers.get('content-type') || '';
  const body = ct.includes('json') ? await resp.json() : (await resp.text()).substring(0, 300);
  return { status: resp.status, body };
}

async function test() {
  console.log('=== FOCUSED RBAC INVESTIGATION ===\n');

  // DLP token — note: NOT setting isSuperAdmin
  const dlpToken = signJWT({ 
    userId: 'dlp_test_99', 
    role: 'DELIVERY_PARTNER', 
    phone: '1111111111', 
    partnerId: 'dlp_test_99',
    isSuperAdmin: false  // explicitly false
  });

  // BM token
  const bmToken = signJWT({
    userId: 'bm_test_99',
    role: 'BRANCH_MANAGER',
    phone: '2222222222',
    branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC',
    isSuperAdmin: false
  });

  // Customer token
  const custToken = signJWT({
    userId: 'cust_test_99',
    role: 'CUSTOMER',
    phone: '3333333333',
    isSuperAdmin: false
  });

  console.log('--- DLP (Delivery Partner) Access ---');
  const tests = [
    '/api/v1/admin/orders',
    '/api/v1/admin/branches',
    '/api/v1/admin/staff',
    '/api/v1/admin/products',
    '/api/v1/admin/suppliers',
    '/api/v1/admin/purchases',
    '/api/v1/admin/expenses',
    '/api/v1/admin/accounting/ledger?account_id=test',
    '/api/v1/admin/accounting/work-queue/summary',
    '/api/v1/admin/tax-configurations',
    '/api/v1/admin/gateway-settlements',
    '/api/v1/admin/bank-accounts',
  ];

  for (const path of tests) {
    const r = await api(path, dlpToken);
    const icon = r.status === 401 || r.status === 403 ? '✓' : '✗';
    console.log(`  ${icon} DLP → ${path}: HTTP ${r.status}${r.status >= 200 && r.status < 300 ? ' ⚠️ LEAK!' : ''}`);
  }

  console.log('\n--- BM (Branch Manager) Access ---');
  for (const path of tests) {
    const r = await api(path, bmToken);
    const icon = r.status === 401 || r.status === 403 ? '✓' : '✗';
    console.log(`  ${icon} BM → ${path}: HTTP ${r.status}${r.status >= 200 && r.status < 300 ? ' ⚠️ LEAK!' : ''}`);
  }

  console.log('\n--- Customer Access ---');
  for (const path of tests) {
    const r = await api(path, custToken);
    const icon = r.status === 401 || r.status === 403 ? '✓' : '✗';
    console.log(`  ${icon} CUST → ${path}: HTTP ${r.status}${r.status >= 200 && r.status < 300 ? ' ⚠️ LEAK!' : ''}`);
  }

  console.log('\n--- Anonymous (No auth) ---');
  for (const path of tests) {
    const resp = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    const icon = resp.status === 401 || resp.status === 403 ? '✓' : '✗';
    console.log(`  ${icon} ANON → ${path}: HTTP ${resp.status}${resp.status >= 200 && resp.status < 300 ? ' ⚠️ LEAK!' : ''}`);
  }
}

test().catch(err => { console.error(err); process.exit(1); });
