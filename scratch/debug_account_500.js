const crypto = require('crypto');
const http = require('http');

const JWT_SECRET = 'supersecret';

function base64Url(obj) {
  return Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url');
}

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const expPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 86400, iat: Math.floor(Date.now() / 1000) };
  const head = base64Url(header);
  const pay = base64Url(expPayload);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${pay}`).digest('base64url');
  return `${head}.${pay}.${sig}`;
}

const token = createToken({ userId: 'cus_9876543210', role: 'CUSTOMER', phone: '9876543210', customerUid: 'cus_9876543210' });
const cookieHeader = `_cth_jwt=${token}; _cth_user_id=cus_9876543210; _cth_customer_uid=cus_9876543210; _cth_phone=9876543210; _cth_role=CUSTOMER`;

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:3000${path}`, {
      headers: {
        'Cookie': cookieHeader
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          headers: res.headers,
          data: data.slice(0, 500)
        });
      });
    });
    req.on('error', (err) => resolve({ path, error: err.message }));
  });
}

async function run() {
  console.log('Probing customer APIs...');
  const r1 = await testEndpoint('/account');
  console.log('/account:', r1.status);
  const r2 = await testEndpoint('/api/customer/me');
  console.log('/api/customer/me:', r2.status, r2.data);
  const r3 = await testEndpoint('/api/v1/customer/me');
  console.log('/api/v1/customer/me:', r3.status, r3.data);
  const r4 = await testEndpoint('/api/customer/orders');
  console.log('/api/customer/orders:', r4.status, r4.data);
  const r5 = await testEndpoint('/api/customer/address');
  console.log('/api/customer/address:', r5.status, r5.data);
}

run();
