/** Pass 2 — Comprehensive API + DB Verification */
const L = require('./lib');
const { q, api, signJWT, num, save, rec, results } = L;

const ADMIN = signJWT({ userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });
const MGR   = signJWT({ userId: 'mgr_01',   role: 'BRANCH_MANAGER', phone: '8888888888', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });
const DP    = signJWT({ userId: 'dp_01',    role: 'DELIVERY_PARTNER', phone: '7777777777', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });
const NOROLE = signJWT({ userId: 'nobody',   role: 'CUSTOMER', phone: '1111111111', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });

(async () => {
  console.log('═══ COMPREHENSIVE VERIFICATION ═══\n');

  // ─── 1. DB INTEGRITY ──────────────────────────────────────────────
  console.log('▸ 1. DATABASE INTEGRITY');
  const tables = ['accounting_account','accounting_journal_entry','accounting_journal_line',
    'accounting_voucher','branch','branch_inventory','catalog_product','catalog_variant',
    'customer','order','order_item','invoice','inventory_movement','inventory_cost_lot',
    'delivery_partner','purchase_order','purchase_order_item','supplier'];
  for (const t of tables) {
    try {
      const r = await q(`SELECT COUNT(*) as cnt FROM public.${t}`);
      const cnt = parseInt(r.rows[0].cnt);
      rec(`DB-${t}`, `Table ${t} exists`, true, `rows=${cnt}`);
    } catch (e) {
      rec(`DB-${t}`, `Table ${t} exists`, false, e.message);
    }
  }

  // Double-entry integrity check
  const debitCredit = (await q(`SELECT SUM(debit_amount) as dr, SUM(credit_amount) as cr FROM public.accounting_journal_line`)).rows[0];
  const dr = num(debitCredit.dr), cr = num(debitCredit.cr);
  rec('DB-GL-BAL', 'GL DR = CR', Math.abs(dr - cr) < 0.01, `DR=${dr} CR=${cr}`);

  // ─── 2. ADMIN API ENDPOINTS ───────────────────────────────────────
  console.log('\n▸ 2. ADMIN API ENDPOINTS');
  const adminGets = [
    ['admin/dashboard/stats', 'Dashboard Stats'],
    ['admin/branches', 'List Branches'],
    ['admin/accounting/chart-of-accounts', 'Chart of Accounts'],
    ['admin/accounting/trial-balance', 'Trial Balance'],
    ['admin/accounting/balance-sheet?as_of_date=2026-10-31', 'Balance Sheet'],
    ['admin/accounting/profit-loss?start_date=2026-10-01&end_date=2026-10-31', 'P&L Statement'],
    ['admin/accounting/vouchers?page=1&limit=20', 'Voucher List'],
    ['admin/accounting/journal-entries?page=1&limit=20', 'Journal Entries'],
    ['admin/catalog/products', 'Catalog Products'],
    ['admin/suppliers', 'Suppliers'],
    ['admin/purchases', 'Purchases'],
    ['admin/orders', 'Orders'],
    ['admin/invoices', 'Invoices'],
    ['admin/customers', 'Customers'],
    ['admin/delivery-partners', 'Delivery Partners'],
    ['admin/users', 'User Management'],
    ['admin/inventory/movements', 'Inventory Movements'],
  ];

  for (const [path, name] of adminGets) {
    const r = await api('GET', `/api/v1/${path}`, { token: ADMIN });
    const ok = r.status === 200;
    rec(`API-${name.replace(/\s+/g, '-')}`, `GET ${name}`, ok, `HTTP ${r.status}`);
  }

  // ─── 3. FINANCIAL STATEMENT ACCURACY ──────────────────────────────
  console.log('\n▸ 3. FINANCIAL STATEMENT ACCURACY');
  
  // Balance Sheet identity
  const bs = await api('GET', '/api/v1/admin/accounting/balance-sheet?as_of_date=2026-10-31', { token: ADMIN });
  const bsd = bs.data;
  rec('FIN-BS-200', 'BS returns 200', bs.status === 200);
  if (bsd) {
    rec('FIN-BS-BAL', 'BS Assets = L + E', bsd.reconciliation?.is_balanced === true, 
      `A=${bsd.summary?.total_assets} L+E=${bsd.summary?.total_liabilities_and_equity} diff=${bsd.reconciliation?.difference}`);
    rec('FIN-BS-EQU', 'BS Equity includes dynamic P&L', bsd.sections?.equity?.current_year_net_earnings?.amount >= 0,
      `CY Earnings=${bsd.sections?.equity?.current_year_net_earnings?.amount}`);
  }

  // P&L statement
  const pl = await api('GET', '/api/v1/admin/accounting/profit-loss?start_date=2026-10-01&end_date=2026-10-31', { token: ADMIN });
  rec('FIN-PL-200', 'P&L returns 200', pl.status === 200);
  if (pl.data) {
    rec('FIN-PL-NET', 'P&L Net Profit matches GL', pl.data.summary?.net_profit_before_tax === 2000,
      `Net=${pl.data.summary?.net_profit_before_tax}`);
  }

  // Trial Balance
  const tb = await api('GET', '/api/v1/admin/accounting/trial-balance', { token: ADMIN });
  rec('FIN-TB-200', 'Trial Balance returns 200', tb.status === 200);
  if (tb.data?.rows) {
    // Total DR should equal Total CR across all leaf accounts
    let tbDr = 0, tbCr = 0;
    for (const r of tb.data.rows) {
      if (!r.is_group) {
        tbDr += num(r.total_debit);
        tbCr += num(r.total_credit);
      }
    }
    rec('FIN-TB-BAL', 'TB leaf DR = CR', Math.abs(tbDr - tbCr) < 0.01, `DR=${tbDr} CR=${tbCr}`);
  }

  // BS comparison mode
  const bsComp = await api('GET', '/api/v1/admin/accounting/balance-sheet?as_of_date=2026-10-31&compare_date=2026-10-02', { token: ADMIN });
  rec('FIN-BS-CMP', 'BS comparison mode works', bsComp.status === 200 && bsComp.data?.comparison != null,
    bsComp.data?.comparison ? 'Has comparison snapshot' : 'No comparison');

  // ─── 4. RBAC ENFORCEMENT ──────────────────────────────────────────
  console.log('\n▸ 4. RBAC ENFORCEMENT');
  
  // Manager should NOT access admin endpoints
  const mgrAdmin = await api('GET', '/api/v1/admin/dashboard/stats', { token: MGR });
  rec('RBAC-MGR-ADMIN', 'Manager blocked from admin dashboard', mgrAdmin.status === 403 || mgrAdmin.status === 401,
    `HTTP ${mgrAdmin.status}`);

  // DP should NOT access admin endpoints
  const dpAdmin = await api('GET', '/api/v1/admin/dashboard/stats', { token: DP });
  rec('RBAC-DP-ADMIN', 'DP blocked from admin dashboard', dpAdmin.status === 403 || dpAdmin.status === 401,
    `HTTP ${dpAdmin.status}`);

  // No-role user should be blocked
  const noAuth = await api('GET', '/api/v1/admin/dashboard/stats', {});
  rec('RBAC-NOAUTH', 'Unauthenticated blocked from admin', noAuth.status === 401 || noAuth.status === 403 || noAuth.status === 302,
    `HTTP ${noAuth.status}`);

  // Customer role blocked from admin
  const custAdmin = await api('GET', '/api/v1/admin/dashboard/stats', { token: NOROLE });
  rec('RBAC-CUST-ADMIN', 'Customer blocked from admin', custAdmin.status === 403 || custAdmin.status === 401,
    `HTTP ${custAdmin.status}`);

  // Manager CAN access manager endpoints
  const mgrDash = await api('GET', '/api/v1/manager/dashboard', { token: MGR });
  rec('RBAC-MGR-OWN', 'Manager can access own dashboard', mgrDash.status === 200,
    `HTTP ${mgrDash.status}`);

  // DP CAN access delivery endpoints
  const dpDash = await api('GET', '/api/v1/delivery/dashboard', { token: DP });
  rec('RBAC-DP-OWN', 'DP can access own dashboard', dpDash.status === 200,
    `HTTP ${dpDash.status}`);

  // Admin BOLA on BS - branch filter
  const bsBOLA = await api('GET', '/api/v1/admin/accounting/balance-sheet?as_of_date=2026-10-31', { token: MGR });
  rec('RBAC-MGR-BS', 'Manager can view own branch BS', bsBOLA.status === 200, `HTTP ${bsBOLA.status}`);

  // ─── 5. MANAGER PANEL APIs ────────────────────────────────────────
  console.log('\n▸ 5. MANAGER PANEL APIs');
  const mgrGets = [
    ['manager/dashboard', 'Manager Dashboard'],
    ['manager/inventory', 'Manager Inventory'],
    ['manager/orders', 'Manager Orders'],
    ['manager/purchases', 'Manager Purchases'],
  ];
  for (const [path, name] of mgrGets) {
    const r = await api('GET', `/api/v1/${path}`, { token: MGR });
    rec(`MGR-${name.replace(/\s+/g, '-')}`, `GET ${name}`, r.status === 200, `HTTP ${r.status}`);
  }

  // ─── 6. DELIVERY PARTNER APIs ─────────────────────────────────────
  console.log('\n▸ 6. DELIVERY PARTNER APIs');
  const dpGets = [
    ['delivery/dashboard', 'DP Dashboard'],
    ['delivery/orders', 'DP Orders'],
  ];
  for (const [path, name] of dpGets) {
    const r = await api('GET', `/api/v1/${path}`, { token: DP });
    rec(`DP-${name.replace(/\s+/g, '-')}`, `GET ${name}`, r.status === 200, `HTTP ${r.status}`);
  }

  // ─── 7. EXPORT / DOWNLOAD ENDPOINTS ──────────────────────────────
  console.log('\n▸ 7. EXPORT ENDPOINTS');
  const exports = [
    ['admin/accounting/trial-balance/export?format=csv', 'TB CSV Export'],
    ['admin/accounting/trial-balance/export?format=pdf', 'TB PDF Export'],
    ['admin/accounting/profit-loss/export?format=csv&start_date=2026-10-01&end_date=2026-10-31', 'P&L CSV Export'],
    ['admin/accounting/balance-sheet/export?format=csv&as_of_date=2026-10-31', 'BS CSV Export'],
    ['admin/orders/export?format=csv', 'Orders CSV Export'],
    ['admin/invoices/export?format=csv', 'Invoices CSV Export'],
  ];
  for (const [path, name] of exports) {
    const r = await api('GET', `/api/v1/${path}`, { token: ADMIN, raw: true });
    // Success can be 200 or 404 (if endpoint doesn't exist yet)
    const pass = r.status === 200;
    rec(`EXP-${name.replace(/\s+/g, '-')}`, `${name}`, pass, `HTTP ${r.status}`);
  }

  // ─── 8. CROSS-PANEL DATA CONSISTENCY ──────────────────────────────
  console.log('\n▸ 8. CROSS-PANEL CONSISTENCY');
  
  // Orders visible to admin should match count from manager
  const adminOrders = await api('GET', '/api/v1/admin/orders', { token: ADMIN });
  const mgrOrders = await api('GET', '/api/v1/manager/orders', { token: MGR });
  if (adminOrders.status === 200 && mgrOrders.status === 200) {
    const aCount = adminOrders.data?.orders?.length ?? adminOrders.data?.length ?? 0;
    const mCount = mgrOrders.data?.orders?.length ?? mgrOrders.data?.length ?? 0;
    // Manager sees same or fewer (branch-filtered)
    rec('XPANEL-ORDERS', 'Manager orders <= Admin orders', mCount <= aCount || mCount === aCount,
      `admin=${aCount} mgr=${mCount}`);
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────
  console.log('\n═══ SUMMARY ═══');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const na   = results.filter(r => r.status === 'N/A' || r.status === 'BLOCKED').length;
  console.log(`PASS: ${pass}  FAIL: ${fail}  N/A+BLK: ${na}  TOTAL: ${results.length}`);
  
  if (fail > 0) {
    console.log('\n─── FAILURES ───');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ✗ ${r.id} ${r.name}: ${r.detail}`));
  }

  save('19_comprehensive_verify.json', { results, totals: { pass, fail, na, total: results.length } });
  await L.pool.end();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
