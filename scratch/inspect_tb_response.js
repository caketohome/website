const crypto = require('crypto');
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

async function check() {
  const resp = await fetch('http://localhost:3001/api/v1/admin/accounting/trial-balance', {
    headers: { 'Cookie': `_cth_jwt=${ADMIN_TOKEN}` }
  });
  const json = await resp.json();
  console.log('Trial balance keys:', Object.keys(json));
  console.log('Trial balance summary:', json.summary || json.totals || json);
}

check().catch(console.error);
