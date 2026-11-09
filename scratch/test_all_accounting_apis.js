const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

function getJwtSecret() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('JWT_SECRET=')) {
      let val = line.trim().substring('JWT_SECRET='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return 'supersecret';
}

function createToken(role = 'SUPER_ADMIN', userId = 'admin_01', permissions = ['*']) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    role,
    phone: '9876543210',
    customerId: userId,
    branchId: null,
    partnerId: null,
    name: role + ' User',
    email: `${role.toLowerCase()}@caketohome.com`,
    permissions,
    isSuperAdmin: role === 'SUPER_ADMIN',
    iat: now,
    exp,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const SUPER_ADMIN_TOKEN = createToken('SUPER_ADMIN', 'admin_01', ['*']);
const UNPRIVILEGED_TOKEN = createToken('CUSTOMER', 'cus_test_01', []);

function makeRequest(method, path, body = null, token = SUPER_ADMIN_TOKEN) {
  return new Promise((resolve) => {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['Cookie'] = `_cth_jwt=${token}; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/' + path,
      method,
      headers,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 0, error: err.message, body: { error: err.message } });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 408, error: 'TIMEOUT', body: { error: 'TIMEOUT' } });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// Master list of endpoints to audit
const TEST_MATRIX = [
  // 1. Work Queue & Vouchers
  { method: 'GET', path: 'admin/accounting/work-queue/summary', desc: 'Work Queue: Stream Summary', authRequired: true },
  { method: 'GET', path: 'admin/accounting/vouchers', desc: 'Work Queue: Vouchers List', authRequired: true },
  { method: 'GET', path: 'admin/accounting/vouchers?status=POSTED&limit=5', desc: 'Work Queue: Vouchers Filtered', authRequired: true },
  { method: 'GET', path: 'admin/accounting/vouchers/vch_00MUR1BRX9F9X7J8', desc: 'Work Queue: Voucher Detail', authRequired: true },
  { method: 'GET', path: 'admin/accounting/work-queue/sales', desc: 'Work Queue: Sales Orders Stream', authRequired: true },

  // 2. Financial Reports
  { method: 'GET', path: 'admin/accounting/trial-balance', desc: 'Report: Trial Balance', authRequired: true },
  { method: 'GET', path: 'admin/accounting/ledger?account_id=bf1f8d20-8ad7-4a1b-bc0a-2870c1cca62f', desc: 'Report: General Ledger', authRequired: true },
  { method: 'GET', path: 'admin/accounting/profit-loss?start_date=2026-10-01&end_date=2026-10-31', desc: 'Report: Profit & Loss', authRequired: true },
  { method: 'GET', path: 'admin/accounting/balance-sheet?as_of_date=2026-10-15', desc: 'Report: Balance Sheet', authRequired: true },
  { method: 'GET', path: 'admin/accounting/cash-flow?start_date=2026-10-01&end_date=2026-10-31', desc: 'Report: Cash Flow', authRequired: true },
  { method: 'GET', path: 'admin/accounting/comparative-pnl', desc: 'Report: Comparative P&L', authRequired: true },
  { method: 'GET', path: 'admin/accounting/reports/retained-earnings-rollforward', desc: 'Report: Retained Earnings Rollforward', authRequired: true },
  { method: 'GET', path: 'admin/accounting/reports/fiscal-year-summary', desc: 'Report: Fiscal Year Summary', authRequired: true },

  // 3. Setup & Master Data
  { method: 'GET', path: 'admin/accounting/accounts', desc: 'Setup: Chart of Accounts List', authRequired: true },
  { method: 'GET', path: 'admin/accounting/config', desc: 'Setup: Accounting Config Status', authRequired: true },
  { method: 'GET', path: 'admin/accounting/company', desc: 'Setup: Company Master Status', authRequired: true },
  { method: 'GET', path: 'admin/accounting/gst-registrations', desc: 'Setup: GST Registrations', authRequired: true },
  { method: 'GET', path: 'admin/accounting/fiscal-periods', desc: 'Setup: Fiscal Periods List', authRequired: true },
  { method: 'GET', path: 'admin/accounting/opening-balances/status', desc: 'Setup: Opening Balances Status', authRequired: true },

  // 4. Bills Payable (AP) & Suppliers
  { method: 'GET', path: 'admin/suppliers', desc: 'AP: Suppliers List', authRequired: true },
  { method: 'GET', path: 'admin/purchases', desc: 'AP: Purchase Bills List', authRequired: true },
  { method: 'GET', path: 'admin/purchases/report/register', desc: 'AP: Purchase Register Report', authRequired: true },
  { method: 'GET', path: 'admin/purchases/report/supplier-wise', desc: 'AP: Supplier-Wise Purchases', authRequired: true },
  { method: 'GET', path: 'admin/purchases/report/item-wise', desc: 'AP: Item-Wise Purchases', authRequired: true },
  { method: 'GET', path: 'admin/purchases/report/bill-wise', desc: 'AP: Bill-Wise Purchases', authRequired: true },
  { method: 'GET', path: 'admin/purchases/report/gst-hsn', desc: 'AP: GST HSN Purchases', authRequired: true },

  // 5. Bills Receivable (AR)
  { method: 'GET', path: 'admin/reports/ar/aging', desc: 'AR: Aging Analysis', authRequired: true },
  { method: 'GET', path: 'admin/reports/ar/invoices', desc: 'AR: Corporate Invoices List', authRequired: true },

  // 6. Bank Accounts & Deposits
  { method: 'GET', path: 'admin/bank-accounts', desc: 'Bank: Bank Accounts List', authRequired: true },
  { method: 'GET', path: 'admin/bank-deposit-slips', desc: 'Bank: Deposit Slips List', authRequired: true },

  // 7. Bank Reconciliation (BRS)
  { method: 'GET', path: 'admin/bank-reconciliation/statements/calculate', desc: 'BRS: Statement Calculate', authRequired: true },
  { method: 'GET', path: 'admin/bank-reconciliation/statements/uncleared-deposits', desc: 'BRS: Uncleared Deposits', authRequired: true },
  { method: 'GET', path: 'admin/bank-reconciliation/statements/outstanding-disbursements', desc: 'BRS: Outstanding Disbursements', authRequired: true },
  { method: 'GET', path: 'admin/bank-reconciliation/sessions', desc: 'BRS: Sessions List', authRequired: true },

  // 8. Gateway Settlements
  { method: 'GET', path: 'admin/gateway-settlements/batches', desc: 'Gateway: Batches List', authRequired: true },

  // 9. Teller Cash Custody & Petty Cash
  { method: 'GET', path: 'admin/tellers', desc: 'Teller: Master List', authRequired: true },
  { method: 'GET', path: 'admin/teller/sessions', desc: 'Teller: Sessions List', authRequired: true },
  { method: 'GET', path: 'admin/teller/sessions/active', desc: 'Teller: Active Session', authRequired: true },
  { method: 'GET', path: 'admin/teller/vault-movements', desc: 'Teller: Vault Movements', authRequired: true },
  { method: 'GET', path: 'admin/teller/cash-tender-status', desc: 'Teller: Cash Tender Status', authRequired: true },
  { method: 'GET', path: 'admin/accounting/branch-cash-position', desc: 'Teller: Branch Cash Position', authRequired: true },
  { method: 'GET', path: 'admin/accounting/petty-cash', desc: 'Petty Cash: Positions List', authRequired: true },

  // 10. Cost Allocations
  { method: 'GET', path: 'admin/accounting/cost-allocations/cost-centres', desc: 'Cost Allocation: Cost Centres', authRequired: true },
  { method: 'GET', path: 'admin/accounting/cost-allocations/rules', desc: 'Cost Allocation: Rules List', authRequired: true },

  // 11. Manual Journals
  { method: 'GET', path: 'admin/accounting/journals', desc: 'Journals: Drafts & Posted List', authRequired: true },

  // 12. Period Close
  { method: 'GET', path: 'admin/accounting/period-close/history', desc: 'Period Close: History', authRequired: true },
  { method: 'GET', path: 'admin/accounting/period-close/preview?fiscal_period_id=nonexistent', desc: 'Period Close: Preview', authRequired: true },

  // 13. POST Validation & Auth Failure Tests
  { method: 'POST', path: 'admin/accounting/journals/draft', body: {}, desc: 'POST Journals: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/accounting/cost-allocations/rules', body: {}, desc: 'POST Cost Allocation: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/bank-accounts', body: {}, desc: 'POST Bank Account: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/accounting/fiscal-periods', body: {}, desc: 'POST Fiscal Period: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/accounting/fiscal-periods/generate-year', body: {}, desc: 'POST Gen Fiscal Year: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/accounting/opening-balances', body: {}, desc: 'POST Opening Balance: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/gateway-settlements/batches/ingest', body: {}, desc: 'POST Gateway Ingest: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/suppliers', body: {}, desc: 'POST Supplier: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/purchases', body: {}, desc: 'POST Purchase: Empty Body Validation', expectStatus: 400 },
  { method: 'POST', path: 'admin/accounting/config/start-date', body: {}, desc: 'POST Start Date: Empty Body Validation', expectStatus: 400 },
];

async function run() {
  console.log('=== COMPREHENSIVE ACCOUNTING API COVERAGE & SECURITY AUDIT ===\n');
  const results = [];

  for (const t of TEST_MATRIX) {
    process.stdout.write(`Testing [${t.method}] /api/v1/${t.path} ... `);

    // 1. Unauthenticated test (should fail with 401)
    let unauthPass = true;
    if (t.authRequired) {
      const unauthRes = await makeRequest(t.method, t.path, t.body, null);
      if (unauthRes.statusCode !== 401 && unauthRes.statusCode !== 403) {
        unauthPass = false;
        console.log(`\n  ⚠️ WARN: Expected 401 unauth, got HTTP ${unauthRes.statusCode}`);
      }
    }

    // 2. Authenticated test
    const authRes = await makeRequest(t.method, t.path, t.body, SUPER_ADMIN_TOKEN);
    const expected = t.expectStatus || 200;
    const isSuccess = authRes.statusCode === expected || (expected === 200 && authRes.statusCode === 201) || (t.expectStatus && authRes.statusCode === t.expectStatus);

    if (isSuccess) {
      console.log(`✓ HTTP ${authRes.statusCode} (${t.desc})`);
    } else {
      console.log(`❌ HTTP ${authRes.statusCode} (Expected ${expected}) - ${(JSON.stringify(authRes.body) || '').substring(0, 80)}`);
    }

    results.push({
      method: t.method,
      path: t.path,
      desc: t.desc,
      expectedStatus: expected,
      actualStatus: authRes.statusCode,
      unauthProtected: unauthPass,
      success: isSuccess,
      bodyPreview: typeof authRes.body === 'object' ? Object.keys(authRes.body) : String(authRes.body).substring(0, 50)
    });
  }

  console.log('\n=== AUDIT SUMMARY ===');
  const total = results.length;
  const passed = results.filter(r => r.success).length;
  console.log(`Total Endpoints Tested: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  const unauthProtectedCount = results.filter(r => r.unauthProtected).length;
  console.log(`Auth-Protected Endpoints: ${unauthProtectedCount} / ${results.filter(r => r.authRequired).length}`);

  fs.writeFileSync('scratch/all_accounting_api_test_results.json', JSON.stringify(results, null, 2));
}

run().catch(console.error);
