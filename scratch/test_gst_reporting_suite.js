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

function signJWT(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const full = { ...payload, isSuperAdmin: true, iat: now, exp: now + 86400 };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', getJwtSecret()).update(`${hB64}.${pB64}`).digest('base64url');
  return `${hB64}.${pB64}.${sig}`;
}

const ADMIN_TOKEN = signJWT({ userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999' });

async function api(path) {
  const resp = await fetch(`http://localhost:3001${path}`, {
    headers: { 'Cookie': `_cth_jwt=${ADMIN_TOKEN}` }
  });
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('json')) {
    return { status: resp.status, body: await resp.json() };
  } else {
    return { status: resp.status, body: await resp.text(), contentType: ct };
  }
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — GST Statutory Reporting API Acceptance Suite');
  console.log('=============================================================================\n');

  const tests = [
    { name: 'GET /api/v1/admin/reports/gst/summary', path: '/api/v1/admin/reports/gst/summary?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/complete', path: '/api/v1/admin/reports/gst/complete?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/invoices', path: '/api/v1/admin/reports/gst/invoices?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/sales-register', path: '/api/v1/admin/reports/gst/sales-register?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/hsn-summary', path: '/api/v1/admin/reports/gst/hsn-summary?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/tax-summary', path: '/api/v1/admin/reports/gst/tax-summary?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/gstr1', path: '/api/v1/admin/reports/gst/gstr1?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/gstr3b', path: '/api/v1/admin/reports/gst/gstr3b?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/input-tax', path: '/api/v1/admin/reports/gst/input-tax?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/validation', path: '/api/v1/admin/reports/gst/validation?dateRange=all' },
    { name: 'GET /api/v1/admin/reports/gst/export/csv', path: '/api/v1/admin/reports/gst/export/csv?dateRange=all&reportType=SUMMARY' }
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await api(t.path);
      const isPass = res.status === 200;
      if (isPass) {
        passed++;
        console.log(`[PASS] ${t.name} -> HTTP ${res.status}`);
      } else {
        console.error(`[FAIL] ${t.name} -> HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(`[ERR]  ${t.name} -> ${err.message}`);
    }
  }

  console.log('\n=============================================================================');
  console.log(`GST SUITE SUMMARY: ${passed}/${tests.length} PASSED`);
  console.log('=============================================================================');
}

run().catch(console.error);
