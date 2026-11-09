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

function createToken(role = 'SUPER_ADMIN', userId = 'admin_01') {
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
    name: 'Super Admin',
    email: 'admin@caketohome.com',
    permissions: ['*'],
    isSuperAdmin: true,
    iat: now,
    exp,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const token = createToken();
console.log('Generated token length:', token.length);

const req = http.get('http://localhost:3001/api/v1/admin/accounting/trial-balance', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Cookie': `_cth_jwt=${token}; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01`
  }
}, (res) => {
  console.log('Status with signed token:', res.statusCode);
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('Response preview:', d.substring(0, 100)));
});
req.on('error', console.error);
