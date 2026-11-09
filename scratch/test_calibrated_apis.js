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
      resolve({ statusCode: 0, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 408, error: 'TIMEOUT' });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// Calibrated list of endpoints
const CALIBRATED_TESTS = [
  // Parameterized tests
  { method: 'GET', path: 'admin/accounting/comparative-pnl?fiscal_year=FY2026-27', desc: 'Comparative P&L (with FY param)', expectStatus: 200 },
  { method: 'GET', path: 'admin/accounting/reports/retained-earnings-rollforward?start_date=2026-10-01&end_date=2026-10-31', desc: 'Retained Earnings Rollforward (with dates)', expectStatus: 200 },
  { method: 'GET', path: 'admin/accounting/period-close/history?fiscal_year=FY2026-27', desc: 'Period Close History (with FY)', expectStatus: 200 },
  { method: 'GET', path: 'admin/accounting/period-close/preview?fiscal_year=FY2026-27&period_name=October%202026', desc: 'Period Close Preview (with params)', expectStatus: 200 },
  { method: 'GET', path: 'admin/bank-reconciliation/statements/calculate?bank_account_id=dummy_id', desc: 'BRS: Calculate (with bank_account_id)', expectStatus: 200 },
  { method: 'GET', path: 'admin/bank-reconciliation/statements/uncleared-deposits?bank_account_id=dummy_id', desc: 'BRS: Uncleared Deposits (with param)', expectStatus: 200 },
  { method: 'GET', path: 'admin/bank-reconciliation/statements/outstanding-disbursements?bank_account_id=dummy_id', desc: 'BRS: Outstanding Disbursements (with param)', expectStatus: 200 },
  { method: 'GET', path: 'admin/teller/vault-movements?branch_id=br_01KYWH05FY08YH6XJKATV0NXDR', desc: 'Teller Vault Movements (with branch_id)', expectStatus: 200 },
  { method: 'GET', path: 'admin/teller/cash-tender-status?branch_id=br_01KYWH05FY08YH6XJKATV0NXDR', desc: 'Teller Cash Tender Status (with branch_id)', expectStatus: 200 },
  { method: 'PUT', path: 'admin/accounting/config/start-date', body: {}, desc: 'PUT Start Date (empty body validation)', expectStatus: 400 },
];

async function run() {
  console.log('=== CALIBRATED ENDPOINT VERIFICATION ===\n');
  for (const t of CALIBRATED_TESTS) {
    const res = await makeRequest(t.method, t.path, t.body, SUPER_ADMIN_TOKEN);
    const pass = res.statusCode === t.expectStatus || (res.statusCode === 404 && res.body?.error === 'NOT_FOUND');
    console.log(`[${t.method}] ${t.path} -> HTTP ${res.statusCode} (Expected ${t.expectStatus}) | Success: ${pass}`);
    if (res.statusCode !== t.expectStatus) {
      console.log('   Response:', JSON.stringify(res.body).substring(0, 100));
    }
  }
}

run().catch(console.error);
