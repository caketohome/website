const http = require('http');
const crypto = require('crypto');

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    userId: payload.userId,
    role: payload.role,
    isSuperAdmin: payload.role === 'SUPER_ADMIN' || payload.userId === 'admin_01',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const adminToken = signTestToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
const finToken = signTestToken({ userId: 'fin_01', role: 'FINANCE_CONTROLLER' });

function makeRequest(urlPath, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, 'http://localhost:3001');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/json,*/*',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          bodySnippet: data.substring(0, 300),
          length: data.length,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 'ERROR', error: err.message });
    });

    req.setTimeout(25000, () => {
      req.destroy();
      resolve({ status: 'TIMEOUT' });
    });

    req.end();
  });
}

async function runVerification() {
  console.log("=== VERIFYING REPAIRED ROUTES & AUTHORIZATION GATES ===\n");

  const routesToTest = [
    { name: "/catalog (Storefront Rewrite)", path: "/catalog", headers: {} },
    { name: "/occasions (Storefront Occasions Index)", path: "/occasions", headers: {} },
    { name: "/terms-conditions (Legal Rewrite)", path: "/terms-conditions", headers: {} },
    { name: "/terms (Legal Rewrite)", path: "/terms", headers: {} },
    { name: "/api/v1/tax-master (Public/Store Tax Config)", path: "/api/v1/tax-master", headers: {} },
    { name: "/api/v1/catalog/products (Admin Auth)", path: "/api/v1/catalog/products", headers: { 'Authorization': `Bearer ${adminToken}` } },
    { name: "/api/v1/accounting/general-ledger (Admin Auth)", path: "/api/v1/accounting/general-ledger?account_id=afdd90ab-7096-41fd-a268-7df89f7ed9b0", headers: { 'Authorization': `Bearer ${adminToken}` } },
    { name: "/api/v1/accounting/chart-of-accounts (Admin Auth)", path: "/api/v1/accounting/chart-of-accounts", headers: { 'Authorization': `Bearer ${adminToken}` } },
    { name: "/api/v1/accounting/trial-balance (Admin Auth)", path: "/api/v1/accounting/trial-balance", headers: { 'Authorization': `Bearer ${adminToken}` } },
    { name: "/dashboard (Super Admin Role)", path: "/dashboard", headers: { 'Cookie': `_cth_jwt=${adminToken};_cth_role=SUPER_ADMIN;_cth_user_id=admin_01` } },
  ];

  for (const r of routesToTest) {
    const res = await makeRequest(r.path, r.headers);
    const pass = res.status >= 200 && res.status < 400;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${r.name} -> HTTP ${res.status} (Length: ${res.length} bytes)`);
    if (!pass) {
      console.log(`  Details: ${res.bodySnippet}`);
    }
  }

  console.log("\n=== ALL-ROLE RBAC MIDDLEWARE TESTS ===");
  const roles = [
    { role: "SUPER_ADMIN", user_id: "admin_01", expected: 200 },
    { role: "INTERNAL_ADMIN", user_id: "int_admin_01", expected: 200 },
    { role: "FINANCE_CONTROLLER", user_id: "fin_ctrl_01", expected: 200 },
    { role: "FINANCE", user_id: "fin_01", expected: 200 },
    { role: "PLANNER", user_id: "plan_01", expected: 200 },
    { role: "DELIVERY_MANAGER", user_id: "del_mgr_01", expected: 200 },
    { role: "BRANCH_STAFF", user_id: "staff_br_01", expected: 200 },
    { role: "TELECALLER", user_id: "tele_01", expected: 200 },
    { role: "BRANCH_MANAGER", user_id: "mgr_01", expected: 307 },
    { role: "DELIVERY_PARTNER", user_id: "dlp_01", expected: 307 },
    { role: "CUSTOMER", user_id: "cust_01", expected: 307 },
  ];

  for (const item of roles) {
    const token = signTestToken({ userId: item.user_id, role: item.role });
    const cookies = `_cth_role=${item.role};_cth_user_id=${item.user_id};_cth_jwt=${token}`;
    const res = await makeRequest("/dashboard", { 'Cookie': cookies });
    const isRedirect = res.status === 307 || res.status === 302;
    const location = res.headers ? res.headers['location'] : '';
    let pass = false;
    if (item.expected === 200) {
      pass = res.status === 200;
      console.log(`[${pass ? 'PASS' : 'FAIL'}] Role ${item.role} -> HTTP ${res.status}`);
    } else {
      pass = isRedirect;
      console.log(`[${pass ? 'PASS' : 'FAIL'}] Role ${item.role} -> HTTP ${res.status} Redirect to: ${location}`);
    }
  }
}

runVerification();
