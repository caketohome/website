const http = require('http');

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ url, status: res.statusCode, headers: res.headers, body: data.slice(0, 500) });
      });
    });
    req.on('error', (err) => {
      resolve({ url, error: err.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ url, error: 'TIMEOUT (5s)' });
    });
  });
}

async function run() {
  console.log('=== TESTING LOCALHOST:3000 ===');
  const home = await checkUrl('http://localhost:3000/');
  console.log('GET http://localhost:3000/ ->', home.status || home.error);
  if (home.status) console.log('  Body snippet:', home.body.slice(0, 150));

  const health = await checkUrl('http://localhost:3000/api/v1/health');
  console.log('GET http://localhost:3000/api/v1/health ->', health.status || health.error);
  if (health.body) console.log('  Body:', health.body);

  const realBackendHealth = await checkUrl('http://localhost:9000/health');
  console.log('GET http://localhost:9000/health ->', realBackendHealth.status || realBackendHealth.error);
}

run();
