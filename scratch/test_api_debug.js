const http = require('http');

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('Testing /api/v1/admin/accounting/config:');
  const res1 = await makeRequest('/api/v1/admin/accounting/config');
  console.log('Status:', res1.statusCode);
  console.log('Headers:', res1.headers);
  console.log('Body:', res1.body.substring(0, 300));

  console.log('\nTesting /api/v1/admin/accounting/journals:');
  const res2 = await makeRequest('/api/v1/admin/accounting/journals');
  console.log('Status:', res2.statusCode);
  console.log('Body:', res2.body.substring(0, 300));
}

run().catch(console.error);
