/**
 * PRG-01 — Investigate API failures from round 1
 */
const crypto = require('crypto');
const BASE = 'http://localhost:3000';
const JWT_SECRET = 'supersecret';

function signJWT(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const full = { ...payload, isSuperAdmin: payload.role === 'SUPER_ADMIN', iat: now, exp: now + 86400 };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${hB64}.${pB64}`).digest('base64url');
  return `${hB64}.${pB64}.${sig}`;
}

const ADMIN = signJWT({ userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });
const DLP = signJWT({ userId: 'dlp_01', role: 'DELIVERY_PARTNER', phone: '8888888888', partnerId: 'dlp_01' });
const BM = signJWT({ userId: 'branch_mgr_01', role: 'BRANCH_MANAGER', phone: '9876543210', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });

async function api(path, token = ADMIN) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'Cookie': `_cth_jwt=${token}` },
    redirect: 'manual'
  });
  const ct = resp.headers.get('content-type') || '';
  const body = ct.includes('json') ? await resp.json() : await resp.text();
  return { status: resp.status, body };
}

async function investigate() {
  console.log('=== INVESTIGATING API FAILURES ===\n');

  // 1. GL Ledger — try with query params
  console.log('--- GL Ledger investigation ---');
  const gl1 = await api('/api/v1/admin/accounting/ledger?fiscal_year=FY2026-27');
  console.log(`  With fiscal_year: HTTP ${gl1.status}`, typeof gl1.body === 'object' ? JSON.stringify(gl1.body).substring(0,300) : gl1.body?.substring(0,300));
  
  const gl2 = await api('/api/v1/admin/accounting/ledger?account_id=all');
  console.log(`  With account_id=all: HTTP ${gl2.status}`, typeof gl2.body === 'object' ? JSON.stringify(gl2.body).substring(0,300) : gl2.body?.substring(0,300));

  // 2. P&L — try with fiscal period
  console.log('\n--- P&L investigation ---');
  const pl1 = await api('/api/v1/admin/accounting/profit-loss?fiscal_year=FY2026-27');
  console.log(`  With fiscal_year: HTTP ${pl1.status}`, typeof pl1.body === 'object' ? JSON.stringify(pl1.body).substring(0,300) : pl1.body?.substring(0,300));

  const pl2 = await api('/api/v1/admin/accounting/profit-loss?period=2026-10');
  console.log(`  With period: HTTP ${pl2.status}`, typeof pl2.body === 'object' ? JSON.stringify(pl2.body).substring(0,300) : pl2.body?.substring(0,300));

  // 3. Balance Sheet
  console.log('\n--- Balance Sheet investigation ---');
  const bs1 = await api('/api/v1/admin/accounting/balance-sheet?as_of=2026-10-03');
  console.log(`  With as_of: HTTP ${bs1.status}`, typeof bs1.body === 'object' ? JSON.stringify(bs1.body).substring(0,300) : bs1.body?.substring(0,300));

  const bs2 = await api('/api/v1/admin/accounting/balance-sheet?fiscal_year=FY2026-27');
  console.log(`  With fiscal_year: HTTP ${bs2.status}`, typeof bs2.body === 'object' ? JSON.stringify(bs2.body).substring(0,300) : bs2.body?.substring(0,300));

  // 4. Cash Flow
  console.log('\n--- Cash Flow investigation ---');
  const cf1 = await api('/api/v1/admin/accounting/cash-flow?fiscal_year=FY2026-27');
  console.log(`  With fiscal_year: HTTP ${cf1.status}`, typeof cf1.body === 'object' ? JSON.stringify(cf1.body).substring(0,300) : cf1.body?.substring(0,300));

  const cf2 = await api('/api/v1/admin/accounting/cash-flow?period=2026-10');
  console.log(`  With period: HTTP ${cf2.status}`, typeof cf2.body === 'object' ? JSON.stringify(cf2.body).substring(0,300) : cf2.body?.substring(0,300));

  // 5. BM Reports — find correct endpoint
  console.log('\n--- BM Reports investigation ---');
  const bmr1 = await api('/api/v1/manager/reports/daily-sales', BM);
  console.log(`  /manager/reports/daily-sales: HTTP ${bmr1.status}`);
  
  const bmr2 = await api('/api/v1/manager/report', BM);
  console.log(`  /manager/report: HTTP ${bmr2.status}`);
  
  const bmr3 = await api('/api/v1/manager/reports/summary', BM);
  console.log(`  /manager/reports/summary: HTTP ${bmr3.status}`);

  // 6. DLP → Admin Orders RBAC LEAK — this is CRITICAL
  console.log('\n--- CRITICAL: DLP → Admin Orders RBAC LEAK ---');
  const dlpOrders = await api('/api/v1/admin/orders', DLP);
  console.log(`  DLP accessing /admin/orders: HTTP ${dlpOrders.status}`);
  if (dlpOrders.status === 200 && dlpOrders.body?.orders) {
    console.log(`  ⚠️ RBAC VIOLATION: Delivery Partner can see ${dlpOrders.body.orders.length} admin orders`);
    console.log(`  First order: ${JSON.stringify(dlpOrders.body.orders[0]).substring(0, 200)}`);
  }

  // Check other admin endpoints for DLP leak
  const dlpProducts = await api('/api/v1/admin/products', DLP);
  console.log(`  DLP → /admin/products: HTTP ${dlpProducts.status}`);
  
  const dlpBranches = await api('/api/v1/admin/branches', DLP);
  console.log(`  DLP → /admin/branches: HTTP ${dlpBranches.status}`);
  
  const dlpStaff = await api('/api/v1/admin/staff', DLP);
  console.log(`  DLP → /admin/staff: HTTP ${dlpStaff.status}`);

  const dlpPurchases = await api('/api/v1/admin/purchases', DLP);
  console.log(`  DLP → /admin/purchases: HTTP ${dlpPurchases.status}`);

  const dlpExpenses = await api('/api/v1/admin/expenses', DLP);
  console.log(`  DLP → /admin/expenses: HTTP ${dlpExpenses.status}`);

  const dlpSuppliers = await api('/api/v1/admin/suppliers', DLP);
  console.log(`  DLP → /admin/suppliers: HTTP ${dlpSuppliers.status}`);

  // Check BM access to admin-only resources
  console.log('\n--- BM → Admin-only resources ---');
  const bmOrders = await api('/api/v1/admin/orders', BM);
  console.log(`  BM → /admin/orders: HTTP ${bmOrders.status}`);
  
  const bmStaff = await api('/api/v1/admin/staff', BM);
  console.log(`  BM → /admin/staff: HTTP ${bmStaff.status}`);

  const bmProducts = await api('/api/v1/admin/products', BM);
  console.log(`  BM → /admin/products: HTTP ${bmProducts.status}`);

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

investigate().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
