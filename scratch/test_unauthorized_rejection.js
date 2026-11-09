const http = require('http');
const crypto = require('crypto');

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    userId: payload.userId || 'test_user',
    role: payload.role || 'CUSTOMER',
    isSuperAdmin: payload.role === 'SUPER_ADMIN',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function probe(options) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body.substring(0, 200)
        });
      });
    });
    req.on('error', err => resolve({ status: 'ERROR', error: err.message }));
    req.end();
  });
}

async function run() {
  console.log("===============================================================================");
  console.log("   CAKETOHOME ERP — UNAUTHORIZED REQUEST DIRECT REJECTION AUDIT");
  console.log("===============================================================================\n");

  const customerToken = signTestToken({ userId: 'cus_test', role: 'CUSTOMER' });
  const branchMgrToken = signTestToken({ userId: 'mgr_test', role: 'BRANCH_MANAGER' });

  const probes = [
    {
      name: "1. Anonymous access to Admin Vouchers API (Expect 401/403)",
      path: "/api/v1/admin/accounting/vouchers",
      headers: {}
    },
    {
      name: "2. Customer token accessing Admin Vouchers API (Expect 401/403)",
      path: "/api/v1/admin/accounting/vouchers",
      headers: { "Authorization": `Bearer ${customerToken}`, "Cookie": `_cth_jwt=${customerToken}; _cth_role=CUSTOMER` }
    },
    {
      name: "3. Customer token accessing Admin Branches API (Expect 401/403)",
      path: "/api/v1/admin/branches",
      headers: { "Authorization": `Bearer ${customerToken}`, "Cookie": `_cth_jwt=${customerToken}; _cth_role=CUSTOMER` }
    },
    {
      name: "4. Branch Manager accessing Corporate Settings (Expect 401/403/Forbidden)",
      path: "/api/v1/admin/accounting/config",
      headers: { "Authorization": `Bearer ${branchMgrToken}`, "Cookie": `_cth_jwt=${branchMgrToken}; _cth_role=BRANCH_MANAGER` }
    },
    {
      name: "5. Anonymous access to Customer Profile API (Expect 401/403)",
      path: "/api/v1/customer/me",
      headers: {}
    }
  ];

  for (const p of probes) {
    const res = await probe({
      hostname: 'localhost',
      port: 3001,
      path: p.path,
      method: 'GET',
      headers: p.headers
    });
    const isRejected = res.status === 401 || res.status === 403 || res.status === 307;
    console.log(`${p.name}`);
    console.log(`  -> Status: ${res.status} | Genuinely Rejected: ${isRejected}`);
    console.log(`  -> Body Preview: ${res.body.replace(/\n/g, ' ')}\n`);
  }
}

run();
