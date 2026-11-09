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

function createSuperAdminToken() {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { userId: 'admin_01', role: 'SUPER_ADMIN', permissions: ['*'], isSuperAdmin: true, iat: now, exp };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function test() {
  const token = createSuperAdminToken();
  const res = await fetch('http://localhost:3001/api/v1/admin/accounting/fiscal-periods', {
    headers: { 'Authorization': 'Bearer ' + token, 'Cookie': '_cth_jwt=' + token }
  });
  console.log('Status:', res.status);
  const data = await res.json();
  const periods = data.periods || data.data || (Array.isArray(data) ? data : []);
  console.log('Count of periods returned:', periods.length);
  periods.forEach(p => console.log(`  - ${p.fiscal_year} | ${p.period_name} | ${p.start_date.substring(0, 10)} to ${p.end_date.substring(0, 10)} | Locked: ${p.is_locked}`));
}

test();
