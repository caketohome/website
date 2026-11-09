/**
 * PRG-01 — Financial Statement API Tests with correct query params
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

const ADMIN_TOKEN = signJWT({ userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });

async function api(path) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'Cookie': `_cth_jwt=${ADMIN_TOKEN}` },
    redirect: 'manual'
  });
  const ct = resp.headers.get('content-type') || '';
  const body = ct.includes('json') ? await resp.json() : await resp.text();
  return { status: resp.status, body };
}

const results = [];
function record(name, pass, details) {
  results.push({ name, pass, details });
  console.log(`  ${pass ? '✓' : '✗'} ${name}: ${details}`);
}

async function run() {
  console.log('=== PRG-01 FINANCIAL STATEMENT API TESTS ===\n');

  // 1. Trial Balance
  console.log('--- Trial Balance ---');
  const tb = await api('/api/v1/admin/accounting/trial-balance');
  record('Trial Balance (no params)', tb.status === 200, `HTTP ${tb.status}`);
  if (tb.body && tb.status === 200) {
    console.log(`    Response keys: ${Object.keys(tb.body).join(', ')}`);
    console.log(`    Data: ${JSON.stringify(tb.body).substring(0, 500)}`);
  }

  // 2. GL Ledger — needs account_id
  console.log('\n--- General Ledger ---');
  const gl1 = await api('/api/v1/admin/accounting/ledger?account_id=bf1f8d20-8ad7-4a1b-bc0a-2870c1cca62f');
  record('GL Ledger (AR account)', gl1.status === 200, `HTTP ${gl1.status}`);
  if (gl1.body && gl1.status === 200) {
    console.log(`    Response keys: ${Object.keys(gl1.body).join(', ')}`);
    console.log(`    Data: ${JSON.stringify(gl1.body).substring(0, 500)}`);
  }

  // 3. P&L — needs start_date + end_date
  console.log('\n--- Profit & Loss ---');
  const pl = await api('/api/v1/admin/accounting/profit-loss?start_date=2026-10-01&end_date=2026-10-31');
  record('P&L (Oct 2026)', pl.status === 200, `HTTP ${pl.status}`);
  if (pl.body && pl.status === 200) {
    console.log(`    Response keys: ${Object.keys(pl.body).join(', ')}`);
    console.log(`    Data: ${JSON.stringify(pl.body).substring(0, 500)}`);
  }

  // 4. Balance Sheet — needs as_of_date
  console.log('\n--- Balance Sheet ---');
  const bs = await api('/api/v1/admin/accounting/balance-sheet?as_of_date=2026-10-03');
  record('Balance Sheet (2026-10-03)', bs.status === 200, `HTTP ${bs.status}`);
  if (bs.body && bs.status === 200) {
    console.log(`    Response keys: ${Object.keys(bs.body).join(', ')}`);
    const bsStr = JSON.stringify(bs.body);
    console.log(`    Data: ${bsStr.substring(0, 500)}`);
    // Verify A = L + E
    const a = parseFloat(bs.body?.totals?.total_assets || bs.body?.total_assets || 0);
    const l = parseFloat(bs.body?.totals?.total_liabilities || bs.body?.total_liabilities || 0);
    const e = parseFloat(bs.body?.totals?.total_equity || bs.body?.total_equity || 0);
    const balanced = Math.abs(a - l - e) < 0.01;
    record('BS Equation (A=L+E)', balanced, `A=${a} L=${l} E=${e}`);
  }

  // 5. Cash Flow — needs start_date + end_date
  console.log('\n--- Cash Flow ---');
  const cf = await api('/api/v1/admin/accounting/cash-flow?start_date=2026-10-01&end_date=2026-10-31');
  record('Cash Flow (Oct 2026)', cf.status === 200, `HTTP ${cf.status}`);
  if (cf.body && cf.status === 200) {
    console.log(`    Response keys: ${Object.keys(cf.body).join(', ')}`);
    console.log(`    Data: ${JSON.stringify(cf.body).substring(0, 500)}`);
  }

  // 6. CoA Accounts
  console.log('\n--- Chart of Accounts ---');
  const coa = await api('/api/v1/admin/accounting/accounts');
  record('CoA Accounts', coa.status === 200, `HTTP ${coa.status}`);
  if (coa.body && coa.status === 200) {
    const accts = coa.body?.accounts || coa.body?.data || [];
    console.log(`    Total accounts: ${Array.isArray(accts) ? accts.length : 'N/A'}`);
  }

  // 7. Fiscal Periods
  console.log('\n--- Fiscal Periods ---');
  const fp = await api('/api/v1/admin/accounting/fiscal-periods');
  record('Fiscal Periods', fp.status === 200, `HTTP ${fp.status}`);
  if (fp.body && fp.status === 200) {
    console.log(`    Data: ${JSON.stringify(fp.body).substring(0, 500)}`);
  }

  // 8. Work Queue with detail
  console.log('\n--- Work Queue Detail ---');
  const wq = await api('/api/v1/admin/accounting/work-queue/summary');
  record('Work Queue Summary', wq.status === 200, `HTTP ${wq.status}`);
  if (wq.body && wq.status === 200) {
    console.log(`    Summary: ${JSON.stringify(wq.body).substring(0, 500)}`);
  }

  // 9. Vouchers list
  console.log('\n--- Vouchers ---');
  const vouchers = await api('/api/v1/admin/accounting/work-queue/vouchers');
  record('Vouchers List', vouchers.status === 200, `HTTP ${vouchers.status}`);
  if (vouchers.body && vouchers.status === 200) {
    console.log(`    Data: ${JSON.stringify(vouchers.body).substring(0, 500)}`);
  }

  // SUMMARY
  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    console.log('\nFAILURES:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}: ${r.details}`));
  }

  const fs = require('fs');
  fs.writeFileSync('E:\\vig\\cakes2home-main\\cakes2home-main\\CHECKPOINTS\\acceptance-test-evidence\\financial_api_results.json', JSON.stringify(results, null, 2));
}

run().catch(err => { console.error(err); process.exit(1); });
