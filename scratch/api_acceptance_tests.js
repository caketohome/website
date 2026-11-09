/**
 * PRG-01 Manual ERP Acceptance Test — API Verification Suite
 * Tests critical API endpoints through actual HTTP calls
 */

const BASE = 'http://localhost:3000';

// Helper to make authenticated API calls
async function apiCall(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=9999999999; _cth_branch_id=br_01KYWH9YFVV5AK15D6313HB1NC',
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
      body = await resp.text();
    }
    return { status, body, ok: resp.ok, url };
  } catch (err) {
    return { status: 0, body: null, error: err.message, url };
  }
}

// Test registry
const results = [];
function record(test, status, details) {
  results.push({ test, status, details });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} ${test}: ${status} ${details ? '— ' + (typeof details === 'string' ? details : JSON.stringify(details).substring(0, 200)) : ''}`);
}

async function runTests() {
  console.log('=== PRG-01 API ACCEPTANCE TESTS ===\n');

  // ============================================================
  // 1. ADMIN DASHBOARD API
  // ============================================================
  console.log('\n--- 1. Admin Dashboard APIs ---');
  
  const dashKpis = await apiCall('/api/v1/admin/dashboard');
  record('Admin Dashboard KPIs', dashKpis.status === 200 ? 'PASS' : 'FAIL', `HTTP ${dashKpis.status}`);

  // ============================================================
  // 2. ORDERS API
  // ============================================================
  console.log('\n--- 2. Orders APIs ---');
  
  const orders = await apiCall('/api/v1/admin/orders');
  record('List Orders', orders.status === 200 ? 'PASS' : 'FAIL', `HTTP ${orders.status}, ${Array.isArray(orders.body?.orders) ? orders.body.orders.length + ' orders' : 'no orders array'}`);

  // ============================================================
  // 3. PRODUCTS API
  // ============================================================
  console.log('\n--- 3. Products / Catalog APIs ---');
  
  const products = await apiCall('/api/v1/admin/products');
  record('List Products', products.status === 200 ? 'PASS' : 'FAIL', `HTTP ${products.status}`);

  // ============================================================
  // 4. BRANCHES API
  // ============================================================
  console.log('\n--- 4. Branches APIs ---');
  
  const branches = await apiCall('/api/v1/admin/branches');
  record('List Branches', branches.status === 200 ? 'PASS' : 'FAIL', `HTTP ${branches.status}`);

  // ============================================================
  // 5. ACCOUNTING WORK QUEUE
  // ============================================================
  console.log('\n--- 5. Accounting Work Queue APIs ---');
  
  const workQueue = await apiCall('/api/v1/admin/accounting/work-queue/summary');
  record('Work Queue Summary', workQueue.status === 200 ? 'PASS' : 'FAIL', `HTTP ${workQueue.status}`);
  if (workQueue.body) {
    record('Work Queue Data', typeof workQueue.body === 'object' ? 'PASS' : 'FAIL', JSON.stringify(workQueue.body).substring(0, 300));
  }

  // ============================================================
  // 6. GENERAL LEDGER & TRIAL BALANCE
  // ============================================================
  console.log('\n--- 6. General Ledger & Trial Balance ---');
  
  const gl = await apiCall('/api/v1/admin/accounting/ledger');
  record('General Ledger', gl.status === 200 ? 'PASS' : 'FAIL', `HTTP ${gl.status}`);

  const tb = await apiCall('/api/v1/admin/accounting/trial-balance');
  record('Trial Balance', tb.status === 200 ? 'PASS' : 'FAIL', `HTTP ${tb.status}`);
  if (tb.body) {
    // Verify debits == credits
    const totalDebit = tb.body?.total_debit ?? tb.body?.totals?.debit;
    const totalCredit = tb.body?.total_credit ?? tb.body?.totals?.credit;
    if (totalDebit !== undefined) {
      record('TB Balance Check', parseFloat(totalDebit) === parseFloat(totalCredit) ? 'PASS' : 'FAIL', `DR=${totalDebit} CR=${totalCredit}`);
    }
  }

  // ============================================================
  // 7. PROFIT & LOSS
  // ============================================================
  console.log('\n--- 7. Profit & Loss ---');
  
  const pl = await apiCall('/api/v1/admin/accounting/profit-loss');
  record('Profit & Loss', pl.status === 200 ? 'PASS' : 'FAIL', `HTTP ${pl.status}`);

  // ============================================================
  // 8. BALANCE SHEET
  // ============================================================
  console.log('\n--- 8. Balance Sheet ---');
  
  const bs = await apiCall('/api/v1/admin/accounting/balance-sheet');
  record('Balance Sheet', bs.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bs.status}`);
  if (bs.body) {
    const assets = parseFloat(bs.body?.total_assets || bs.body?.assets?.total || 0);
    const liabilities = parseFloat(bs.body?.total_liabilities || bs.body?.liabilities?.total || 0);
    const equity = parseFloat(bs.body?.total_equity || bs.body?.equity?.total || 0);
    record('BS Equation', Math.abs(assets - liabilities - equity) < 0.01 ? 'PASS' : 'FAIL', `A=${assets} L=${liabilities} E=${equity}`);
  }

  // ============================================================
  // 9. CASH FLOW
  // ============================================================
  console.log('\n--- 9. Cash Flow ---');
  
  const cf = await apiCall('/api/v1/admin/accounting/cash-flow');
  record('Cash Flow', cf.status === 200 ? 'PASS' : 'FAIL', `HTTP ${cf.status}`);

  // ============================================================
  // 10. FISCAL PERIODS
  // ============================================================
  console.log('\n--- 10. Fiscal Periods ---');
  
  const fp = await apiCall('/api/v1/admin/accounting/fiscal-periods');
  record('Fiscal Periods', fp.status === 200 ? 'PASS' : 'FAIL', `HTTP ${fp.status}`);

  // ============================================================
  // 11. TAX CONFIGURATION
  // ============================================================
  console.log('\n--- 11. Tax Configuration ---');
  
  const tax = await apiCall('/api/v1/admin/tax-configurations');
  record('Tax Configurations', tax.status === 200 ? 'PASS' : 'FAIL', `HTTP ${tax.status}`);

  // ============================================================
  // 12. SUPPLIERS
  // ============================================================
  console.log('\n--- 12. Suppliers ---');
  
  const suppliers = await apiCall('/api/v1/admin/suppliers');
  record('List Suppliers', suppliers.status === 200 ? 'PASS' : 'FAIL', `HTTP ${suppliers.status}`);

  // ============================================================
  // 13. PURCHASES
  // ============================================================
  console.log('\n--- 13. Purchases ---');
  
  const purchases = await apiCall('/api/v1/admin/purchases');
  record('List Purchases', purchases.status === 200 ? 'PASS' : 'FAIL', `HTTP ${purchases.status}`);

  // ============================================================
  // 14. EXPENSES
  // ============================================================
  console.log('\n--- 14. Expenses ---');
  
  const expenses = await apiCall('/api/v1/admin/expenses');
  record('List Expenses', expenses.status === 200 ? 'PASS' : 'FAIL', `HTTP ${expenses.status}`);

  // ============================================================
  // 15. GATEWAY SETTLEMENTS
  // ============================================================
  console.log('\n--- 15. Gateway Settlements ---');
  
  const gw = await apiCall('/api/v1/admin/gateway-settlements');
  record('Gateway Settlements', gw.status === 200 ? 'PASS' : 'FAIL', `HTTP ${gw.status}`);

  // ============================================================
  // 16. BANK RECONCILIATION
  // ============================================================
  console.log('\n--- 16. Bank Accounts & Reconciliation ---');
  
  const banks = await apiCall('/api/v1/admin/bank-accounts');
  record('Bank Accounts', banks.status === 200 ? 'PASS' : 'FAIL', `HTTP ${banks.status}`);

  // ============================================================
  // 17. INVENTORY
  // ============================================================
  console.log('\n--- 17. Inventory ---');
  
  const inv = await apiCall('/api/v1/manager/inventory');
  record('Branch Inventory', inv.status === 200 ? 'PASS' : 'FAIL', `HTTP ${inv.status}`);

  // ============================================================
  // 18. REPORTS
  // ============================================================
  console.log('\n--- 18. Reports ---');
  
  const reports = await apiCall('/api/v1/admin/reports');
  record('Reports Endpoint', reports.status === 200 ? 'PASS' : 'FAIL', `HTTP ${reports.status}`);

  // ============================================================
  // 19. BRANCH MANAGER APIs (with BRANCH_MANAGER role)
  // ============================================================
  console.log('\n--- 19. Branch Manager APIs ---');
  
  const branchHeaders = {
    'Cookie': '_cth_role=BRANCH_MANAGER; _cth_user_id=branch_mgr_01; _cth_phone=9876543210; _cth_branch_id=br_01KYWH9YFVV5AK15D6313HB1NC'
  };
  
  const bmDash = await apiCall('/api/v1/manager/dashboard', { headers: branchHeaders });
  record('Branch Dashboard', bmDash.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmDash.status}`);

  const bmOrders = await apiCall('/api/v1/manager/orders', { headers: branchHeaders });
  record('Branch Orders', bmOrders.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmOrders.status}`);

  const bmCash = await apiCall('/api/v1/manager/cash/position', { headers: branchHeaders });
  record('Branch Cash Position', bmCash.status === 200 ? 'PASS' : 'FAIL', `HTTP ${bmCash.status}`);

  // ============================================================
  // 20. RBAC - Branch Manager should NOT access admin accounting
  // ============================================================
  console.log('\n--- 20. RBAC Tests ---');
  
  const rbac1 = await apiCall('/api/v1/admin/accounting/ledger', { headers: branchHeaders });
  record('RBAC: BM → GL (should deny)', rbac1.status === 401 || rbac1.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac1.status}`);

  const rbac2 = await apiCall('/api/v1/admin/accounting/trial-balance', { headers: branchHeaders });
  record('RBAC: BM → TB (should deny)', rbac2.status === 401 || rbac2.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac2.status}`);

  const rbac3 = await apiCall('/api/v1/admin/accounting/work-queue/summary', { headers: branchHeaders });
  record('RBAC: BM → Work Queue (should deny)', rbac3.status === 401 || rbac3.status === 403 ? 'PASS' : 'FAIL', `HTTP ${rbac3.status}`);

  // ============================================================
  // 21. DELIVERY PARTNER APIs
  // ============================================================
  console.log('\n--- 21. Delivery Partner APIs ---');
  
  const dlpHeaders = {
    'Cookie': '_cth_role=DELIVERY_PARTNER; _cth_user_id=dlp_01; _cth_phone=8888888888; _cth_partner_id=dlp_01'
  };
  
  const dlpRbac1 = await apiCall('/api/v1/admin/accounting/ledger', { headers: dlpHeaders });
  record('RBAC: DLP → GL (should deny)', dlpRbac1.status === 401 || dlpRbac1.status === 403 ? 'PASS' : 'FAIL', `HTTP ${dlpRbac1.status}`);

  const dlpRbac2 = await apiCall('/api/v1/admin/orders', { headers: dlpHeaders });
  record('RBAC: DLP → Admin Orders (should deny)', dlpRbac2.status === 401 || dlpRbac2.status === 403 ? 'PASS' : 'FAIL', `HTTP ${dlpRbac2.status}`);

  // ============================================================
  // 22. STAFF / ACCESS PROFILES
  // ============================================================
  console.log('\n--- 22. Staff & Access Profiles ---');
  
  const staff = await apiCall('/api/v1/admin/staff');
  record('List Staff', staff.status === 200 ? 'PASS' : 'FAIL', `HTTP ${staff.status}`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  console.log(`TOTAL: ${results.length} tests | PASS: ${passed} | FAIL: ${failed} | WARN: ${warned}`);
  
  // List failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  ✗ ${f.test}: ${f.details}`));
  }

  // Save results
  const fs = require('fs');
  const path = 'E:\\vig\\cakes2home-main\\cakes2home-main\\CHECKPOINTS\\acceptance-test-evidence\\api_test_results.json';
  fs.writeFileSync(path, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${path}`);
}

runTests().catch(err => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
