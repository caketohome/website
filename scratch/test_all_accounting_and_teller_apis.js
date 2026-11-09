/**
 * CakeToHome ERP — Comprehensive Accounting, Teller, & Manager Cash API Acceptance Suite
 */

const crypto = require('crypto');
const BASE = 'http://localhost:3001';
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

const ADMIN_TOKEN = signJWT({ userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999', branchId: 'br_indiranagar' });
const MANAGER_TOKEN = signJWT({ userId: 'shpmgr_01', role: 'BRANCH_MANAGER', phone: '9888888888', branchId: 'br_indiranagar' });

async function api(path, options = {}) {
  const token = options.token || ADMIN_TOKEN;
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `_cth_jwt=${token}`,
    ...(options.headers || {})
  };
  const resp = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'manual'
  });
  const ct = resp.headers.get('content-type') || '';
  const body = ct.includes('json') ? await resp.json() : await resp.text();
  return { status: resp.status, body };
}

const summary = { total: 0, passed: 0, failed: 0, endpoints: [] };

function record(name, pass, details = '') {
  summary.total++;
  if (pass) {
    summary.passed++;
    console.log(`[PASS] ${name} ${details ? '- ' + details : ''}`);
  } else {
    summary.failed++;
    console.error(`[FAIL] ${name} ${details ? '- ' + details : ''}`);
  }
  summary.endpoints.push({ name, pass, details });
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Comprehensive Accounting & Teller API Acceptance Suite');
  console.log('=============================================================================\n');

  // 1. Chart of Accounts
  console.log('--- 1. Chart of Accounts & Configuration ---');
  const coa = await api('/api/v1/admin/accounting/accounts');
  record('GET /api/v1/admin/accounting/accounts', coa.status === 200, `HTTP ${coa.status}`);

  // 2. Trial Balance
  console.log('\n--- 2. General Ledger & Trial Balance ---');
  const tb = await api('/api/v1/admin/accounting/trial-balance');
  record('GET /api/v1/admin/accounting/trial-balance', tb.status === 200, `HTTP ${tb.status}`);
  if (tb.status === 200 && tb.body) {
    const s = tb.body.summary || tb.body;
    console.log(`    Trial balance: Balanced=${s.is_balanced}, Total Dr=₹${s.total_debit}, Total Cr=₹${s.total_credit}, Imbalance=₹${s.imbalance ?? 0}`);
  }

  // 3. Profit & Loss
  console.log('\n--- 3. Financial Statements ---');
  const pl = await api('/api/v1/admin/accounting/profit-loss?start_date=2026-04-01&end_date=2027-03-31');
  record('GET /api/v1/admin/accounting/profit-loss', pl.status === 200, `HTTP ${pl.status}`);

  // 4. Balance Sheet
  const bs = await api('/api/v1/admin/accounting/balance-sheet?as_of_date=2026-10-16');
  record('GET /api/v1/admin/accounting/balance-sheet', bs.status === 200, `HTTP ${bs.status}`);

  // 5. Cash Flow Statement
  const cf = await api('/api/v1/admin/accounting/cash-flow?start_date=2026-04-01&end_date=2027-03-31');
  record('GET /api/v1/admin/accounting/cash-flow', cf.status === 200, `HTTP ${cf.status}`);

  // 6. Canonical Teller Sessions
  console.log('\n--- 4. Canonical Teller Custody API ---');
  const sessions = await api('/api/v1/admin/teller/sessions?branch_id=br_indiranagar');
  record('GET /api/v1/admin/teller/sessions', sessions.status === 200, `HTTP ${sessions.status}`);

  // 7. Manager Cash Position (Consolidated Relational + Legacy)
  console.log('\n--- 5. Branch Manager Cash Position & Drawer ---');
  const pos = await api('/api/v1/manager/cash/position', { token: MANAGER_TOKEN });
  record('GET /api/v1/manager/cash/position', pos.status === 200, `HTTP ${pos.status}`);
  if (pos.status === 200 && pos.body) {
    console.log(`    Manager Drawer: status=${pos.body.drawer_status}, expected_cash=₹${pos.body.expected_drawer_cash}`);
  }

  // 8. Obsolete Manager Drawer Open Endpoint must return 410 GONE
  console.log('\n--- 5. Obsolete Legacy Endpoints Retirement Check ---');
  const openRes = await api('/api/v1/manager/cash/drawer/open', {
    method: 'POST',
    token: MANAGER_TOKEN,
    body: { opening_float: 500.00, notes: 'API Manager Drawer Shift Opening' }
  });
  record(
    'POST /api/v1/manager/cash/drawer/open returns 410 GONE', 
    openRes.status === 410 && openRes.body?.error === 'OBSOLETE_ENDPOINT', 
    `HTTP ${openRes.status} (error=${openRes.body?.error})`
  );

  // 9. Obsolete Manager Drawer Close Endpoint must return 410 GONE
  const closeRes = await api('/api/v1/manager/cash/drawer/close', {
    method: 'POST',
    token: MANAGER_TOKEN,
    body: { closing_count: 500.00, notes: 'API Manager Drawer Shift Closing' }
  });
  record(
    'POST /api/v1/manager/cash/drawer/close returns 410 GONE', 
    closeRes.status === 410 && closeRes.body?.error === 'OBSOLETE_ENDPOINT', 
    `HTTP ${closeRes.status} (error=${closeRes.body?.error})`
  );

  // 10. Canonical Tellers Master API
  console.log('\n--- 6. Canonical Teller Master & Custody API ---');
  const tellers = await api('/api/v1/admin/tellers?branch_id=br_indiranagar');
  record('GET /api/v1/admin/tellers', tellers.status === 200, `HTTP ${tellers.status} (count=${tellers.body?.tellers?.length ?? 0})`);

  // 11. Bank Accounts Master
  console.log('\n--- 6. Banking & Reconciliation API ---');
  const bankAccs = await api('/api/v1/admin/accounting/bank-accounts');
  record('GET /api/v1/admin/accounting/bank-accounts', bankAccs.status === 200, `HTTP ${bankAccs.status}`);

  // 12. Bank Deposit Slips
  const depSlips = await api('/api/v1/admin/bank-deposit-slips?branch_id=br_indiranagar');
  record('GET /api/v1/admin/bank-deposit-slips', depSlips.status === 200, `HTTP ${depSlips.status}`);

  console.log('\n=============================================================================');
  console.log(`API ACCEPTANCE SUMMARY: ${summary.passed}/${summary.total} PASSED (${summary.failed} FAILED)`);
  console.log('=============================================================================');

  if (summary.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
