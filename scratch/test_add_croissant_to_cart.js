const http = require('http');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Testing adding Butter Croissant via POST /api/v1/cart/items:');
  const res = await postJson('http://localhost:3000/api/v1/cart/items', {
    productId: 'prod_01KXYMAJKNS8AGWCN5S1WEGKSD',
    weight: '1 pc',
    quantity: 1,
  });
  console.log('Response:', JSON.stringify(res, null, 2));
}

run().catch(console.error);
