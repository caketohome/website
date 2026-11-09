/**
 * PRG-01 Manual ERP Acceptance Test — API Verification with JWT Auth
 * Generates proper JWT tokens using the same HMAC-SHA256 signing as the app
 */
const crypto = require('crypto');

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const JWT_SECRET = 'supersecret'; // from .env

// JWT sign helper (replicates signAuthToken)
function signJWT(payload, secret, expiresInSeconds = 86400 * 7) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    ...payload,
    isSuperAdmin: payload.role === 'SUPER_ADMIN' || payload.userId === 'admin_01',
    iat: now,
    exp: now + expiresInSeconds
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

// Generate tokens for each role
const SUPER_ADMIN_TOKEN = signJWT({
  userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999',
  branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC'
}, JWT_SECRET);

const BRANCH_MANAGER_TOKEN = signJWT({
  userId: 'branch_mgr_01', role: 'BRANCH_MANAGER', phone: '9876543210',
  branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC'
}, JWT_SECRET);

const DELIVERY_PARTNER_TOKEN = signJWT({
  userId: 'dlp_01', role: 'DELIVERY_PARTNER', phone: '8888888888',
  partnerId: 'dlp_01'
}, JWT_SECRET);

const PREPARER_TOKEN = signJWT({
  userId: 'preparer_staff_01', role: 'SUPER_ADMIN', phone: '7777777777',
  branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC'
}, JWT_SECRET);

const APPROVER_TOKEN = signJWT({
  userId: 'supervisor_staff_02', role: 'SUPER_ADMIN', phone: '6666666666',
  branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC'
}, JWT_SECRET);

async function apiCall(path, options = {}, token = SUPER_ADMIN_TOKEN) {
  const url = `${BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `_cth_jwt=${token}; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01`,
    ...(options.headers || {})
  };
  
  try {
    const resp = await fetch(url, { ...options, headers, redirect: 'manual' });
    const status = resp.status;
    let body = null;
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('json')) {
      try { body = await resp.json(); } catch(e) { body = await resp.text(); }
    } else {
      body = (await resp.text()).substring(0, 500);
    }
    return { status, body, ok: resp.ok, url };
  } catch (err) {
    return { status: 0, body: null, error: err.message, url };
  }
}

const results = [];
function record(test, status, details) {
  results.push({ test, status, details: typeof details === 'string' ? details : JSON.stringify(details).substring(0, 500) });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} ${test}: ${status}${details ? ' — ' + (typeof details === 'string' ? details : JSON.stringify(details).substring(0, 200)) : ''}`);
}

async function runTests() {
  console.log('=== PRG-01 API ACCEPTANCE TESTS (JWT Auth) ===\n');

  // ─────────────────────────────────────────────────────
  // 1. ADMIN DASHBOARD
  // ─────────────────────────────────────────────────────
  console.log('--- 1. Admin Dashboard ---');
  const dash = await apiCall('/api/v1/admin/dashboard');
  record('Admin Dashboard', dash.status === 200 ? 'PASS' : 'FAIL', `HTTP ${dash.status}`);

  // ─────────────────────────────────────────────────────
  // 2. ORDERS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 2. Orders ---');
  const orders = await apiCall('/api/v1/admin/orders');
  record('List Orders', orders.status === 200 ? 'PASS' : 'FAIL', `HTTP ${orders.status}`);
  if (orders.body?.orders) record('Orders Data', Array.isArray(orders.body.orders) ? 'PASS' : 'FAIL', `${orders.body.orders?.length} orders`);

  // ─────────────────────────────────────────────────────
  // 3. PRODUCTS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 3. Products ---');
  const products = await apiCall('/api/v1/admin/products');
  record('List Products', products.status === 200 ? 'PASS' : 'FAIL', `HTTP ${products.status}`);

  // ─────────────────────────────────────────────────────
  // 4. BRANCHES
  // ─────────────────────────────────────────────────────
  console.log('\n--- 4. Branches ---');
  const branches = await apiCall('/api/v1/admin/branches');
  record('List Branches', branches.status === 200 ? 'PASS' : 'FAIL', `HTTP ${branches.status}`);

  // ─────────────────────────────────────────────────────
  // 5. ACCOUNTING WORK QUEUE
  // ─────────────────────────────────────────────────────
  console.log('\n--- 5. Accounting Work Queue ---');
  const wq = await apiCall('/api/v1/admin/accounting/work-queue/summary');
  record('Work Queue', wq.status === 200 ? 'PASS' : 'FAIL', `HTTP ${wq.status}`);
  if (wq.body) record('WQ Data', typeof wq.body === 'object' ? 'PASS' : 'FAIL', JSON.stringify(wq.body).substring(0, 300));

  // ─────────────────────────────────────────────────────
  // 6. GENERAL LEDGER
  // ─────────────────────────────────────────────────────
  console.log('\n--- 6. General Ledger ---');
  const gl = await apiCall('/api/v1/admin/accounting/ledger');
  record('GL Ledger', gl.status === 200 ? 'PASS' : 'FAIL', `HTTP ${gl.status}`);
  if (gl.body?.accounts) record('GL Accounts', 'PASS', `${gl.body.accounts.length} accounts`);

  // ─────────────────────────────────────────────────────
  // 7. TRIAL BALANCE
  // ─────────────────────────────────────────────────────
  console.log('\n--- 7. Trial Balance ---');
  const tb = await apiCall('/api/v1/admin/accounting/trial-balance');
  record('Trial Balance', tb.status === 200 ? 'PASS' : 'FAIL', `HTTP ${tb.status}`);
  if (tb.body) {
    const tbd = parseFloat(tb.body?.totals?.total_debit || tb.body?.total_debit || 0);
    const tbc = parseFloat(tb.body?.totals?.total_credit || tb.body?.total_credit || 0);
    record('TB Balance', Math.abs(tbd - tbc) < 0.01 ? 'PASS' : 'FAIL', `DR=${tbd} CR=${tbc}`);
  }

  // ─────────────────────────────────────────────────────
  // 8. PROFIT & LOSS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 8. Profit & Loss ---');
  const pl = await apiCall('/api/v1/admin/accounting/profit-loss');
  record('P&L', pl.status === 200 ? 'PASS' : 'FAIL', `HTTP ${pl.status}`);

  // ─────────────────────────────────────────────────────
  // 9. BALANCE SHEET
  // ─────────────────────────────────────────────────────
  console.log('\n--- 9. Balance Sheet ---');
  const bs = await apiCall('/api/v1/admin/accounting/balance-sheet');
  record('Balance Sheet', bs.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bs.status}`);
  if (bs.body) {
    const a = parseFloat(bs.body?.totals?.total_assets || bs.body?.total_assets || 0);
    const l = parseFloat(bs.body?.totals?.total_liabilities || bs.body?.total_liabilities || 0);
    const e = parseFloat(bs.body?.totals?.total_equity || bs.body?.total_equity || 0);
    record('BS A=L+E', Math.abs(a - l - e) < 0.01 ? 'PASS' : 'FAIL', `A=${a} L=${l} E=${e}`);
  }

  // ─────────────────────────────────────────────────────
  // 10. CASH FLOW
  // ─────────────────────────────────────────────────────
  console.log('\n--- 10. Cash Flow ---');
  const cf = await apiCall('/api/v1/admin/accounting/cash-flow');
  record('Cash Flow', cf.status === 200 ? 'PASS' : 'FAIL', `HTTP ${cf.status}`);

  // ─────────────────────────────────────────────────────
  // 11. FISCAL PERIODS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 11. Fiscal Periods ---');
  const fp = await apiCall('/api/v1/admin/accounting/fiscal-periods');
  record('Fiscal Periods', fp.status === 200 ? 'PASS' : 'FAIL', `HTTP ${fp.status}`);

  // ─────────────────────────────────────────────────────
  // 12. SUPPLIERS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 12. Suppliers ---');
  const sup = await apiCall('/api/v1/admin/suppliers');
  record('Suppliers', sup.status === 200 ? 'PASS' : 'FAIL', `HTTP ${sup.status}`);

  // ─────────────────────────────────────────────────────
  // 13. PURCHASES
  // ─────────────────────────────────────────────────────
  console.log('\n--- 13. Purchases ---');
  const purch = await apiCall('/api/v1/admin/purchases');
  record('Purchases', purch.status === 200 ? 'PASS' : 'FAIL', `HTTP ${purch.status}`);

  // ─────────────────────────────────────────────────────
  // 14. EXPENSES
  // ─────────────────────────────────────────────────────
  console.log('\n--- 14. Expenses ---');
  const exp = await apiCall('/api/v1/admin/expenses');
  record('Expenses', exp.status === 200 ? 'PASS' : 'FAIL', `HTTP ${exp.status}`);

  // ─────────────────────────────────────────────────────
  // 15. GATEWAY SETTLEMENTS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 15. Gateway Settlements ---');
  const gw = await apiCall('/api/v1/admin/gateway-settlements');
  record('Gateway Settlements', gw.status === 200 ? 'PASS' : 'FAIL', `HTTP ${gw.status}`);

  // ─────────────────────────────────────────────────────
  // 16. BANK ACCOUNTS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 16. Bank Accounts ---');
  const banks = await apiCall('/api/v1/admin/bank-accounts');
  record('Bank Accounts', banks.status === 200 ? 'PASS' : 'FAIL', `HTTP ${banks.status}`);

  // ─────────────────────────────────────────────────────
  // 17. TAX CONFIG
  // ─────────────────────────────────────────────────────
  console.log('\n--- 17. Tax Configuration ---');
  const tax = await apiCall('/api/v1/admin/tax-configurations');
  record('Tax Config', tax.status === 200 ? 'PASS' : 'FAIL', `HTTP ${tax.status}`);

  // ─────────────────────────────────────────────────────
  // 18. STAFF
  // ─────────────────────────────────────────────────────
  console.log('\n--- 18. Staff ---');
  const staff = await apiCall('/api/v1/admin/staff');
  record('Staff', staff.status === 200 ? 'PASS' : 'FAIL', `HTTP ${staff.status}`);

  // ─────────────────────────────────────────────────────
  // 19. REPORTS
  // ─────────────────────────────────────────────────────
  console.log('\n--- 19. Reports ---');
  const rep = await apiCall('/api/v1/admin/reports');
  record('Reports', rep.status === 200 ? 'PASS' : 'FAIL', `HTTP ${rep.status}`);

  // ─────────────────────────────────────────────────────
  // 20. BRANCH MANAGER APIs (with BM token)
  // ─────────────────────────────────────────────────────
  console.log('\n--- 20. Branch Manager APIs ---');
  const bmCookie = `_cth_jwt=${BRANCH_MANAGER_TOKEN}; _cth_role=BRANCH_MANAGER; _cth_user_id=branch_mgr_01; _cth_branch_id=br_01KYWH9YFVV5AK15D6313HB1NC`;
  const bmHeaders = { 'Cookie': bmCookie };
  
  const bmDash = await apiCall('/api/v1/manager/dashboard', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('BM Dashboard', bmDash.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmDash.status}`);

  const bmOrders = await apiCall('/api/v1/manager/orders', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('BM Orders', bmOrders.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmOrders.status}`);

  const bmCash = await apiCall('/api/v1/manager/cash/position', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('BM Cash Position', bmCash.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmCash.status}`);

  const bmInv = await apiCall('/api/v1/manager/inventory', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('BM Inventory', bmInv.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmInv.status}`);

  const bmReports = await apiCall('/api/v1/manager/reports', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('BM Reports', bmReports.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmReports.status}`);

  // ─────────────────────────────────────────────────────
  // 21. RBAC — BM should NOT access admin accounting
  // ─────────────────────────────────────────────────────
  console.log('\n--- 21. RBAC Tests ---');
  
  const rbac1 = await apiCall('/api/v1/admin/accounting/ledger', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('RBAC: BM→GL (deny)', rbac1.status === 401 || rbac1.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac1.status}`);

  const rbac2 = await apiCall('/api/v1/admin/accounting/trial-balance', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('RBAC: BM→TB (deny)', rbac2.status === 401 || rbac2.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac2.status}`);

  const rbac3 = await apiCall('/api/v1/admin/accounting/profit-loss', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('RBAC: BM→P&L (deny)', rbac3.status === 401 || rbac3.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac3.status}`);

  const rbac4 = await apiCall('/api/v1/admin/accounting/balance-sheet', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('RBAC: BM→BS (deny)', rbac4.status === 401 || rbac4.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac4.status}`);

  const rbac5 = await apiCall('/api/v1/admin/accounting/work-queue/summary', { headers: bmHeaders }, BRANCH_MANAGER_TOKEN);
  record('RBAC: BM→WQ (deny)', rbac5.status === 401 || rbac5.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac5.status}`);

  // DLP RBAC
  const dlpCookie = `_cth_jwt=${DELIVERY_PARTNER_TOKEN}; _cth_role=DELIVERY_PARTNER`;
  const dlpHeaders = { 'Cookie': dlpCookie };
  
  const rbac6 = await apiCall('/api/v1/admin/accounting/ledger', { headers: dlpHeaders }, DELIVERY_PARTNER_TOKEN);
  record('RBAC: DLP→GL (deny)', rbac6.status === 401 || rbac6.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac6.status}`);

  const rbac7 = await apiCall('/api/v1/admin/orders', { headers: dlpHeaders }, DELIVERY_PARTNER_TOKEN);
  record('RBAC: DLP→Admin Orders (deny)', rbac7.status === 401 || rbac7.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac7.status}`);

  // ─────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(f => console.log(`  ✗ ${f.test}: ${f.details}`));
  }

  const fs = require('fs');
  const path = 'E:\\vig\\cakes2home-main\\cakes2home-main\\CHECKPOINTS\\acceptance-test-evidence\\api_test_results_jwt.json';
  fs.writeFileSync(path, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${path}`);
}

runTests().catch(err => {
  console.error('SUITE FAILED:', err);
  process.exit(1);
});
